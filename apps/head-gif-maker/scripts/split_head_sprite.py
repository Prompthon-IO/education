#!/usr/bin/env python3
"""Split a generated head sprite sheet into PNG frames and an animated GIF."""

from __future__ import annotations

import argparse
from collections import deque
from pathlib import Path
from typing import Iterable

from PIL import Image


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--sprite", required=True, type=Path, help="Horizontal sprite sheet image.")
    parser.add_argument("--frames-dir", required=True, type=Path, help="Directory for PNG frames.")
    parser.add_argument("--out-gif", required=True, type=Path, help="Animated GIF output path.")
    parser.add_argument("--preview-strip", type=Path, help="Optional preview strip output path.")
    parser.add_argument("--frame-count", type=int, default=5, help="Number of horizontal frames.")
    parser.add_argument("--canvas-size", type=int, default=512, help="Square frame canvas size.")
    parser.add_argument(
        "--durations",
        default="100,105,150,105,100",
        help="Comma-separated frame durations in milliseconds.",
    )
    parser.add_argument(
        "--remove-border-white",
        action="store_true",
        help="Remove near-white pixels connected to the tile border.",
    )
    parser.add_argument("--force", action="store_true", help="Overwrite outputs.")
    return parser.parse_args()


def parse_durations(value: str, frame_count: int) -> list[int]:
    durations = [int(part.strip()) for part in value.split(",") if part.strip()]
    if not durations:
        return [120] * frame_count
    if len(durations) == 1:
        return durations * frame_count
    if len(durations) != frame_count:
        raise ValueError("--durations must contain one value or one value per frame")
    return durations


def near_white(pixel: tuple[int, int, int, int]) -> bool:
    red, green, blue, alpha = pixel
    return alpha > 0 and red >= 235 and green >= 235 and blue >= 235


def border_connected_white_mask(image: Image.Image) -> set[tuple[int, int]]:
    width, height = image.size
    pixels = image.load()
    visited: set[tuple[int, int]] = set()
    queue: deque[tuple[int, int]] = deque()

    def add_if_background(x: int, y: int) -> None:
        if (x, y) not in visited and near_white(pixels[x, y]):
            visited.add((x, y))
            queue.append((x, y))

    for x in range(width):
        add_if_background(x, 0)
        add_if_background(x, height - 1)
    for y in range(height):
        add_if_background(0, y)
        add_if_background(width - 1, y)

    while queue:
        x, y = queue.popleft()
        for nx, ny in ((x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)):
            if 0 <= nx < width and 0 <= ny < height:
                add_if_background(nx, ny)

    return visited


def transparentize_border_white(image: Image.Image) -> Image.Image:
    image = image.convert("RGBA")
    pixels = image.load()
    background = border_connected_white_mask(image)
    for x, y in background:
        red, green, blue, _alpha = pixels[x, y]
        pixels[x, y] = (red, green, blue, 0)

    width, height = image.size
    fringe: set[tuple[int, int]] = set()
    for x, y in background:
        for nx in range(max(0, x - 1), min(width, x + 2)):
            for ny in range(max(0, y - 1), min(height, y + 2)):
                if (nx, ny) in background:
                    continue
                red, green, blue, alpha = pixels[nx, ny]
                if alpha > 0 and red >= 220 and green >= 220 and blue >= 220:
                    fringe.add((nx, ny))
    for x, y in fringe:
        red, green, blue, alpha = pixels[x, y]
        pixels[x, y] = (red, green, blue, min(alpha, 90))

    return image


def split_tiles(sprite: Image.Image, frame_count: int) -> Iterable[Image.Image]:
    width, height = sprite.size
    for index in range(frame_count):
        left = round(index * width / frame_count)
        right = round((index + 1) * width / frame_count)
        yield sprite.crop((left, 0, right, height)).convert("RGBA")


def fit_on_canvas(image: Image.Image, canvas_size: int) -> Image.Image:
    bbox = image.getbbox()
    if not bbox:
        raise ValueError("Frame is empty after background removal")
    cropped = image.crop(bbox)
    max_dim = canvas_size - 52
    scale = min(max_dim / cropped.width, max_dim / cropped.height)
    resized = cropped.resize(
        (max(1, round(cropped.width * scale)), max(1, round(cropped.height * scale))),
        Image.Resampling.LANCZOS,
    )
    canvas = Image.new("RGBA", (canvas_size, canvas_size), (255, 255, 255, 0))
    canvas.alpha_composite(resized, ((canvas_size - resized.width) // 2, (canvas_size - resized.height) // 2))
    return canvas


def gif_frame(frame: Image.Image) -> Image.Image:
    alpha = frame.getchannel("A")
    matte = Image.new("RGBA", frame.size, (255, 255, 255, 255))
    matte.alpha_composite(frame)
    paletted = matte.convert("P", palette=Image.Palette.ADAPTIVE, colors=255)
    transparent_index = 255
    paletted.info["transparency"] = transparent_index
    mask = alpha.point(lambda value: transparent_index if value <= 8 else 0)
    paletted.paste(transparent_index, mask)
    return paletted


def ensure_writable(paths: Iterable[Path], force: bool) -> None:
    existing = [path for path in paths if path.exists()]
    if existing and not force:
        names = ", ".join(str(path) for path in existing)
        raise FileExistsError(f"Refusing to overwrite existing output(s): {names}")


def main() -> int:
    args = parse_args()
    if args.frame_count < 2:
        raise ValueError("--frame-count must be at least 2")

    durations = parse_durations(args.durations, args.frame_count)
    ensure_writable([args.out_gif, *(path for path in [args.preview_strip] if path)], args.force)
    args.frames_dir.mkdir(parents=True, exist_ok=True)

    sprite = Image.open(args.sprite).convert("RGBA")
    frames: list[Image.Image] = []
    for index, tile in enumerate(split_tiles(sprite, args.frame_count), start=1):
        if args.remove_border_white:
            tile = transparentize_border_white(tile)
        frame = fit_on_canvas(tile, args.canvas_size)
        frame_path = args.frames_dir / f"frame_{index:02d}.png"
        if frame_path.exists() and not args.force:
            raise FileExistsError(f"Refusing to overwrite existing output: {frame_path}")
        frame.save(frame_path)
        frames.append(frame)

    gif_frames = [gif_frame(frame) for frame in frames]
    gif_frames[0].save(
        args.out_gif,
        save_all=True,
        append_images=gif_frames[1:],
        duration=durations,
        loop=0,
        disposal=2,
        transparency=255,
    )

    if args.preview_strip:
        strip = Image.new("RGBA", (args.canvas_size * len(frames), args.canvas_size), (255, 255, 255, 255))
        for index, frame in enumerate(frames):
            strip.alpha_composite(frame, (index * args.canvas_size, 0))
        strip.save(args.preview_strip)

    print(args.out_gif)
    print(args.frames_dir)
    if args.preview_strip:
        print(args.preview_strip)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
