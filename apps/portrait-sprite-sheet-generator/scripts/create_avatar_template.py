#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
from pathlib import Path

from PIL import Image, ImageDraw


CANVAS_WIDTH = 1200
CANVAS_HEIGHT = 2100
HEADER_HEIGHT = 340
CIRCLE_DIAMETER = 310
CIRCLE_COLUMN_XS = (70, 445, 820)
CIRCLE_TOP_Y = 360
CIRCLE_ROW_GAP = 80
TEMPLATE_ROWS = 4
TEMPLATE_COLUMNS = 3
BACKGROUND = "#ffffff"
PLACEHOLDER_STROKE = "#cbd5e1"
CIRCLE_FILL = "#fffdf5"
EMOTIONS = ["happy", "excited", "sad", "dizzy", "playful", "sleepy"]
STICKERS = [f"{emotion}_{variation:02d}" for emotion in EMOTIONS for variation in (1, 2)]


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Create a fixed 4:7 avatar sprite-sheet template with logo header and 3x4 circle slots.")
    parser.add_argument("--fira-logo", required=True, type=Path)
    parser.add_argument("--prompthon-logo", required=True, type=Path)
    parser.add_argument("--qr-code", required=True, type=Path)
    parser.add_argument("--portrait", type=Path)
    parser.add_argument("--out", required=True, type=Path)
    parser.add_argument("--manifest", required=True, type=Path)
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    image = Image.new("RGBA", (CANVAS_WIDTH, CANVAS_HEIGHT), BACKGROUND)
    draw = ImageDraw.Draw(image)

    draw.rectangle((0, 0, CANVAS_WIDTH, CANVAS_HEIGHT), fill=BACKGROUND)

    header_media_y = 52
    header_media_size = 220
    portrait_bounds = (
        paste_portrait_crop(image, args.portrait, (58, header_media_y), header_media_size)
        if args.portrait
        else draw_source_photo_placeholder(image, draw, (58, header_media_y), header_media_size)
    )
    qr_bounds = paste_qr_code(image, draw, args.qr_code, (340, header_media_y), header_media_size)
    fira_bounds = paste_logo(image, args.fira_logo, (620, 58), (520, 94), crop_mode="first-alpha-run")
    prompthon_bounds = paste_logo(image, args.prompthon_logo, (620, fira_bounds["y"] + fira_bounds["height"] + 58), (520, 68), crop_mode="alpha")

    circles = []
    for row in range(TEMPLATE_ROWS):
        for column, x in enumerate(CIRCLE_COLUMN_XS):
            y = CIRCLE_TOP_Y + row * (CIRCLE_DIAMETER + CIRCLE_ROW_GAP)
            slot_id = f"r{row + 1}c{column + 1}"
            sticker_index = row * TEMPLATE_COLUMNS + column
            draw.ellipse((x, y, x + CIRCLE_DIAMETER, y + CIRCLE_DIAMETER), fill=CIRCLE_FILL)
            draw_dashed_ellipse(draw, (x, y, x + CIRCLE_DIAMETER, y + CIRCLE_DIAMETER), PLACEHOLDER_STROKE, width=5)
            circles.append(
                {
                    "slot": slot_id,
                    "sticker": STICKERS[sticker_index],
                    "emotion": EMOTIONS[sticker_index // 2],
                    "variation": sticker_index % 2 + 1,
                    "row": row + 1,
                    "column": column + 1,
                    "x": x,
                    "y": y,
                    "diameter": CIRCLE_DIAMETER,
                    "center": [x + CIRCLE_DIAMETER / 2, y + CIRCLE_DIAMETER / 2],
                }
            )

    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.manifest.parent.mkdir(parents=True, exist_ok=True)
    image.save(args.out)
    args.manifest.write_text(
        json.dumps(
            {
                "canvas": {
                    "width": CANVAS_WIDTH,
                    "height": CANVAS_HEIGHT,
                    "ratio": "4:7",
                    "print_size_inches": [4, 7],
                },
                "header": {
                    "x": 0,
                    "y": 0,
                    "width": CANVAS_WIDTH,
                    "height": HEADER_HEIGHT,
                    "logos": {
                        "fira": fira_bounds,
                        "prompthon": prompthon_bounds,
                        "discord_qr": qr_bounds,
                        "source_portrait": portrait_bounds,
                    },
                },
                "grid": {
                    "columns": TEMPLATE_COLUMNS,
                    "rows": TEMPLATE_ROWS,
                    "circle_diameter": CIRCLE_DIAMETER,
                    "row_gap": CIRCLE_ROW_GAP,
                    "emotions": EMOTIONS,
                    "stickers": STICKERS,
                    "circles": circles,
                },
            },
            indent=2,
        )
        + "\n"
    )
    return 0


def paste_logo(image: Image.Image, path: Path, xy: tuple[int, int], max_size: tuple[int, int], crop_mode: str) -> dict[str, int]:
    logo = Image.open(path).convert("RGBA")
    if crop_mode == "alpha":
        logo = crop_to_alpha(logo)
    elif crop_mode == "first-alpha-run":
        logo = crop_to_first_alpha_run(logo)
    logo.thumbnail(max_size, Image.Resampling.LANCZOS)
    x, y = xy
    image.alpha_composite(logo, (x, y))
    return {
        "x": x,
        "y": y,
        "width": logo.width,
        "height": logo.height,
    }


def paste_qr_code(image: Image.Image, draw: ImageDraw.ImageDraw, path: Path, xy: tuple[int, int], size: int) -> dict[str, int]:
    x, y = xy
    padding = 16
    radius = 26
    frame_bounds = {
        "x": x - padding,
        "y": y - padding,
        "width": size + padding * 2,
        "height": size + padding * 2,
        "corner_radius": radius,
        "padding": padding,
    }
    draw.rounded_rectangle(
        (x - padding, y - padding, x + size + padding, y + size + padding),
        radius=radius,
        fill="#ffffff",
        outline="#d1d5db",
        width=3,
    )
    qr = Image.open(path).convert("RGBA")
    qr = qr.resize((size, size), Image.Resampling.NEAREST)
    image.alpha_composite(qr, (x, y))
    return {
        "x": x,
        "y": y,
        "width": qr.width,
        "height": qr.height,
        "frame_bounds": frame_bounds,
    }


def draw_source_photo_placeholder(image: Image.Image, draw: ImageDraw.ImageDraw, xy: tuple[int, int], size: int) -> dict[str, int | bool]:
    x, y = xy
    padding = 16
    radius = 26
    inner_radius = size // 8
    frame_bounds = {
        "x": x - padding,
        "y": y - padding,
        "width": size + padding * 2,
        "height": size + padding * 2,
        "corner_radius": radius,
        "padding": padding,
    }
    draw.rounded_rectangle(
        (x - padding, y - padding, x + size + padding, y + size + padding),
        radius=radius,
        fill="#ffffff",
        outline="#d1d5db",
        width=3,
    )
    draw.rounded_rectangle(
        (x, y, x + size, y + size),
        radius=inner_radius,
        fill="#f8fafc",
        outline="#cbd5e1",
        width=3,
    )
    icon_color = "#94a3b8"
    face_center_x = x + size // 2
    face_center_y = y + size // 2 - 12
    draw.ellipse(
        (face_center_x - 34, face_center_y - 44, face_center_x + 34, face_center_y + 24),
        outline=icon_color,
        width=6,
    )
    draw.arc(
        (face_center_x - 70, face_center_y + 18, face_center_x + 70, face_center_y + 120),
        start=205,
        end=335,
        fill=icon_color,
        width=6,
    )
    return {
        "x": x,
        "y": y,
        "width": size,
        "height": size,
        "corner_radius": inner_radius,
        "frame_bounds": frame_bounds,
        "placeholder": True,
    }


def paste_portrait_crop(image: Image.Image, path: Path, xy: tuple[int, int], size: int) -> dict[str, int]:
    x, y = xy
    portrait = Image.open(path).convert("RGBA")
    portrait = crop_to_face_square(portrait)
    portrait = portrait.resize((size, size), Image.Resampling.LANCZOS)

    mask = Image.new("L", (size, size), 0)
    mask_draw = ImageDraw.Draw(mask)
    radius = size // 8
    mask_draw.rounded_rectangle((0, 0, size - 1, size - 1), radius=radius, fill=255)

    padding = 16
    frame_radius = 26
    frame_bounds = {
        "x": x - padding,
        "y": y - padding,
        "width": size + padding * 2,
        "height": size + padding * 2,
        "corner_radius": frame_radius,
        "padding": padding,
    }
    draw = ImageDraw.Draw(image)
    draw.rounded_rectangle(
        (x - padding, y - padding, x + size + padding, y + size + padding),
        radius=frame_radius,
        fill="#ffffff",
        outline="#d1d5db",
        width=3,
    )
    image.paste(portrait, (x, y), mask)
    return {
        "x": x,
        "y": y,
        "width": size,
        "height": size,
        "corner_radius": radius,
        "frame_bounds": frame_bounds,
    }


def draw_dashed_ellipse(draw: ImageDraw.ImageDraw, box: tuple[int, int, int, int], fill: str, width: int) -> None:
    for start in range(0, 360, 18):
        draw.arc(box, start=start, end=start + 10, fill=fill, width=width)


def crop_to_face_aspect(image: Image.Image, aspect_ratio: float) -> Image.Image:
    box = detect_face_bbox(image)
    if box is None:
        width, height = image.size
        crop_width = min(width, int(height * aspect_ratio))
        crop_height = min(height, int(crop_width / aspect_ratio))
        left = max(0, min(width - crop_width, int(width * 0.18)))
        top = max(0, min(height - crop_height, int(height * 0.03)))
        return image.crop((left, top, left + crop_width, top + crop_height))

    left, top, width, height = box
    center_x = left + width / 2
    center_y = top + height / 2
    crop_height = max(height * 2.2, width * 2.2 / aspect_ratio)
    crop_width = crop_height * aspect_ratio
    crop_left = int(round(center_x - crop_width / 2))
    crop_top = int(round(center_y - crop_height * 0.46))
    crop_right = int(round(crop_left + crop_width))
    crop_bottom = int(round(crop_top + crop_height))
    return crop_rect_with_bounds(image, crop_left, crop_top, crop_right, crop_bottom)


def crop_to_face_square(image: Image.Image) -> Image.Image:
    box = detect_face_bbox(image)
    if box is None:
        width, height = image.size
        fallback_side_ratio = 0.52
        side = int(min(width, height) * fallback_side_ratio)
        left = max(0, min(width - side, int((width - side) / 2)))
        top = max(0, min(height - side, int(height * 0.03)))
        return image.crop((left, top, left + side, top + side))

    left, top, width, height = box
    center_x = left + width / 2
    center_y = top + height / 2
    side = max(width, height) * 1.15
    crop_left = int(round(center_x - side / 2))
    crop_top = int(round(center_y - side * 0.48))
    crop_right = int(round(crop_left + side))
    crop_bottom = int(round(crop_top + side))
    return crop_box_with_bounds(image, crop_left, crop_top, crop_right, crop_bottom)


def detect_face_bbox(image: Image.Image) -> tuple[int, int, int, int] | None:
    try:
        import cv2  # type: ignore
        import numpy as np  # type: ignore
    except Exception:
        return None

    rgb = image.convert("RGB")
    array = np.array(rgb)
    gray = cv2.cvtColor(array, cv2.COLOR_RGB2GRAY)
    cascade_path = Path(cv2.data.haarcascades) / "haarcascade_frontalface_default.xml"
    detector = cv2.CascadeClassifier(str(cascade_path))
    faces = detector.detectMultiScale(gray, scaleFactor=1.08, minNeighbors=5, minSize=(70, 70))
    if len(faces) == 0:
        return None

    img_width, _img_height = image.size
    candidates = sorted(
        ((int(x), int(y), int(w), int(h)) for x, y, w, h in faces),
        key=lambda face: (
            0 if face[0] < img_width * 0.72 else 1,
            -face[2] * face[3],
            face[0],
        ),
    )
    return candidates[0]


def crop_box_with_bounds(image: Image.Image, left: int, top: int, right: int, bottom: int) -> Image.Image:
    width, height = image.size
    crop_width = right - left
    crop_height = bottom - top
    if left < 0:
        right -= left
        left = 0
    if top < 0:
        bottom -= top
        top = 0
    if right > width:
        left -= right - width
        right = width
    if bottom > height:
        top -= bottom - height
        bottom = height
    left = max(0, left)
    top = max(0, top)
    right = min(width, max(left + 1, right))
    bottom = min(height, max(top + 1, bottom))

    side = min(crop_width, crop_height, right - left, bottom - top)
    return image.crop((left, top, left + side, top + side))


def crop_rect_with_bounds(image: Image.Image, left: int, top: int, right: int, bottom: int) -> Image.Image:
    width, height = image.size
    crop_width = right - left
    crop_height = bottom - top
    if left < 0:
        right -= left
        left = 0
    if top < 0:
        bottom -= top
        top = 0
    if right > width:
        left -= right - width
        right = width
    if bottom > height:
        top -= bottom - height
        bottom = height
    left = max(0, left)
    top = max(0, top)
    right = min(width, max(left + 1, right))
    bottom = min(height, max(top + 1, bottom))
    actual_width = min(crop_width, right - left)
    actual_height = min(crop_height, bottom - top)
    return image.crop((left, top, left + actual_width, top + actual_height))


def crop_to_alpha(image: Image.Image) -> Image.Image:
    box = image.getchannel("A").getbbox()
    return image.crop(box) if box else image


def crop_to_first_alpha_run(image: Image.Image) -> Image.Image:
    alpha = image.getchannel("A")
    rows = []
    for y in range(image.height):
        if any(alpha.getpixel((x, y)) > 20 for x in range(image.width)):
            rows.append(y)
    if not rows:
        return image

    runs: list[tuple[int, int]] = []
    start = previous = rows[0]
    for y in rows[1:]:
        if y == previous + 1:
            previous = y
        else:
            runs.append((start, previous))
            start = previous = y
    runs.append((start, previous))
    first_top, first_bottom = runs[0]
    box = alpha.crop((0, first_top, image.width, first_bottom + 1)).getbbox()
    if not box:
        return image
    left, _top, right, _bottom = box
    padding = 10
    return image.crop((
        max(0, left - padding),
        max(0, first_top - padding),
        min(image.width, right + padding),
        min(image.height, first_bottom + 1 + padding),
    ))


if __name__ == "__main__":
    raise SystemExit(main())
