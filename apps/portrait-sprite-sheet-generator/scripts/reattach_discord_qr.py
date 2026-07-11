#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
from pathlib import Path

from PIL import Image, ImageChops, ImageDraw

from portrait_sprite.generated_sheet import extract_frames_from_generated_sheet


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Normalize manifest-defined avatar slots and reattach canonical header assets.")
    parser.add_argument("--sheet", required=True, type=Path, help="PNG sheet to update.")
    parser.add_argument("--manifest", required=True, type=Path, help="Template manifest with header.logos.discord_qr bounds.")
    parser.add_argument("--qr-code", required=True, type=Path, help="Canonical QR PNG.")
    parser.add_argument("--source-photo", type=Path, help="Original user photo. When provided, a face-centered crop is restored to the source portrait bounds.")
    parser.add_argument("--fira-logo", type=Path, help="Canonical FIRA 2026 logo PNG. When provided, the logo area is cleaned and restored.")
    parser.add_argument("--prompthon-logo", type=Path, help="Canonical Prompthon.io logo PNG. When provided, the logo area is cleaned and restored.")
    parser.add_argument("--out", type=Path, help="Output PNG. Defaults to overwriting --sheet.")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    manifest = json.loads(args.manifest.read_text())
    header_bounds = manifest["header"]
    qr_bounds = manifest["header"]["logos"]["discord_qr"]
    frame_bounds = qr_bounds.get("frame_bounds")
    fira_bounds = manifest["header"]["logos"].get("fira", {})
    prompthon_bounds = manifest["header"]["logos"].get("prompthon", {})
    source_portrait_bounds = manifest["header"]["logos"].get("source_portrait", {})

    sheet = Image.open(args.sheet).convert("RGBA")
    sheet = normalize_sticker_grid(sheet, manifest)
    draw = ImageDraw.Draw(sheet)

    if frame_bounds:
        x0 = int(frame_bounds["x"])
        y0 = int(frame_bounds["y"])
        x1 = x0 + int(frame_bounds["width"])
        y1 = y0 + int(frame_bounds["height"])
        cleanup_padding = 24
        cleanup_right_padding = 84
        cleanup_bottom_padding = 56
        cleanup_right = min(sheet.width, x1 + cleanup_right_padding)
        cleanup_bottom = min(sheet.height, y1 + cleanup_bottom_padding)
        cleanup_bottom = max(cleanup_bottom, min(sheet.height, int(header_bounds["y"]) + int(header_bounds["height"]) + 20))
        if isinstance(fira_bounds.get("x"), (int, float)):
            cleanup_right = min(cleanup_right, int(fira_bounds["x"]) - cleanup_padding)
        draw.rectangle(
            (
                max(0, x0 - cleanup_padding),
                max(0, y0 - cleanup_padding),
                cleanup_right,
                cleanup_bottom,
            ),
            fill="#ffffff",
        )
        draw.rounded_rectangle(
            (x0, y0, x1, y1),
            radius=int(frame_bounds.get("corner_radius", 26)),
            fill="#ffffff",
            outline="#d1d5db",
            width=3,
        )

    x = int(qr_bounds["x"])
    y = int(qr_bounds["y"])
    width = int(qr_bounds["width"])
    height = int(qr_bounds["height"])
    qr = Image.open(args.qr_code).convert("RGBA").resize((width, height), Image.Resampling.NEAREST)
    sheet.alpha_composite(qr, (x, y))

    if args.source_photo:
        restore_source_photo(sheet, draw, args.source_photo, source_portrait_bounds, header_bounds)

    if args.fira_logo and args.prompthon_logo:
        restore_logo_block(sheet, draw, args.fira_logo, args.prompthon_logo, fira_bounds, prompthon_bounds, header_bounds)

    out = args.out or args.sheet
    out.parent.mkdir(parents=True, exist_ok=True)
    sheet.save(out)
    return 0


def normalize_sticker_grid(sheet: Image.Image, manifest: dict) -> Image.Image:
    grid = manifest.get("grid", {})
    circles = grid.get("circles", [])
    if not isinstance(circles, list) or not circles:
        raise ValueError("Manifest does not define grid.circles")

    diameters = {int(circle["diameter"]) for circle in circles}
    if len(diameters) != 1:
        raise ValueError("All manifest avatar circles must use one diameter")
    frame_size = diameters.pop()
    if sticker_grid_matches_manifest(sheet, circles, manifest["header"]):
        return sheet.copy()

    frames = extract_frames_from_generated_sheet(sheet, frame_size)
    if len(frames) != len(circles):
        raise ValueError(f"Expected {len(circles)} generated avatar frames, found {len(frames)}")

    normalized = sheet.copy()
    header = manifest["header"]
    grid_top = int(header["y"]) + int(header["height"])
    ImageDraw.Draw(normalized).rectangle((0, grid_top, normalized.width, normalized.height), fill="#ffffff")

    for frame, circle in zip(frames, circles, strict=True):
        diameter = int(circle["diameter"])
        if frame.size != (diameter, diameter):
            frame = frame.resize((diameter, diameter), Image.Resampling.LANCZOS)
        normalized.alpha_composite(frame, (int(circle["x"]), int(circle["y"])))

    return normalized


def sticker_grid_matches_manifest(sheet: Image.Image, circles: list[dict], header: dict) -> bool:
    grid_top = int(header["y"]) + int(header["height"])
    outside = sheet.crop((0, grid_top, sheet.width, sheet.height)).convert("RGBA")
    outside_draw = ImageDraw.Draw(outside)
    for circle in circles:
        x = int(circle["x"])
        y = int(circle["y"])
        diameter = int(circle["diameter"])
        crop = sheet.crop((x, y, x + diameter, y + diameter))
        if count_nonwhite_pixels(crop) < diameter * diameter * 0.12:
            return False
        outside_draw.rectangle((x, y - grid_top, x + diameter - 1, y - grid_top + diameter - 1), fill="#ffffff")

    return count_nonwhite_pixels(outside) <= 200


def count_nonwhite_pixels(image: Image.Image) -> int:
    rgb = image.convert("RGB")
    white = Image.new("RGB", rgb.size, "#ffffff")
    difference = ImageChops.difference(rgb, white).convert("L")
    return sum(difference.histogram()[13:])


def restore_source_photo(
    sheet: Image.Image,
    draw: ImageDraw.ImageDraw,
    source_photo_path: Path,
    bounds: dict,
    header_bounds: dict,
) -> None:
    frame_bounds = bounds.get("frame_bounds", {})
    frame_x = int(frame_bounds["x"])
    frame_y = int(frame_bounds["y"])
    frame_w = int(frame_bounds["width"])
    frame_h = int(frame_bounds["height"])
    frame_radius = int(frame_bounds.get("corner_radius", 26))
    cleanup_padding = 18
    cleanup_bottom = min(sheet.height, int(header_bounds["y"]) + int(header_bounds["height"]) + 20)
    draw.rectangle(
        (
            max(0, frame_x - cleanup_padding),
            max(0, frame_y - cleanup_padding),
            min(sheet.width, frame_x + frame_w + cleanup_padding),
            cleanup_bottom,
        ),
        fill="#ffffff",
    )
    draw.rounded_rectangle(
        (frame_x, frame_y, frame_x + frame_w, frame_y + frame_h),
        radius=frame_radius,
        fill="#ffffff",
        outline="#d1d5db",
        width=3,
    )

    x = int(bounds["x"])
    y = int(bounds["y"])
    width = int(bounds["width"])
    height = int(bounds["height"])
    radius = int(bounds.get("corner_radius", min(width, height) // 8))
    photo = Image.open(source_photo_path).convert("RGBA")
    photo = crop_to_face_square(photo).resize((width, height), Image.Resampling.LANCZOS)

    mask = Image.new("L", (width, height), 0)
    mask_draw = ImageDraw.Draw(mask)
    mask_draw.rounded_rectangle((0, 0, width - 1, height - 1), radius=radius, fill=255)
    sheet.paste(photo, (x, y), mask)


def restore_logo_block(
    sheet: Image.Image,
    draw: ImageDraw.ImageDraw,
    fira_logo_path: Path,
    prompthon_logo_path: Path,
    fira_bounds: dict,
    prompthon_bounds: dict,
    header_bounds: dict,
) -> None:
    logo_x = int(fira_bounds["x"])
    header_y = int(header_bounds["y"])
    header_bottom = header_y + int(header_bounds["height"])
    cleanup_left = max(0, logo_x - 28)
    cleanup_top = max(0, header_y + 18)
    cleanup_bottom = min(sheet.height, header_bottom + 20)
    draw.rectangle((cleanup_left, cleanup_top, sheet.width, cleanup_bottom), fill="#ffffff")

    paste_logo(
        sheet,
        fira_logo_path,
        (int(fira_bounds["x"]), int(fira_bounds["y"])),
        (int(fira_bounds["width"]), int(fira_bounds["height"])),
        "first-alpha-run",
    )
    paste_logo(
        sheet,
        prompthon_logo_path,
        (int(prompthon_bounds["x"]), int(prompthon_bounds["y"])),
        (int(prompthon_bounds["width"]), int(prompthon_bounds["height"])),
        "alpha",
    )


def paste_logo(image: Image.Image, path: Path, xy: tuple[int, int], size: tuple[int, int], crop_mode: str) -> None:
    logo = Image.open(path).convert("RGBA")
    if crop_mode == "alpha":
        logo = crop_to_alpha(logo)
    elif crop_mode == "first-alpha-run":
        logo = crop_to_first_alpha_run(logo)
    logo.thumbnail(size, Image.Resampling.LANCZOS)
    image.alpha_composite(logo, xy)


def crop_to_alpha(image: Image.Image) -> Image.Image:
    box = image.getchannel("A").getbbox()
    return image.crop(box) if box else image


def crop_to_face_square(image: Image.Image) -> Image.Image:
    box = detect_face_bbox(image)
    if box is None:
        width, height = image.size
        side = int(min(width, height) * 0.52)
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
