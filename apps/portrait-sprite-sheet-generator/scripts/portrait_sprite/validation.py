from __future__ import annotations

from pathlib import Path

from PIL import Image

from .sprite_sheet import EMOTIONS, FRAME_COLUMNS, FRAME_ROWS


def validate_face_outputs(face_dir: Path, frame_size: int) -> dict:
    frame_paths = sorted(path for path in face_dir.glob("face_*_*.png") if "sprite_sheet" not in path.name)
    sheet_path = next(face_dir.glob("face_*_sprite_sheet.png"))
    preview_path = next(face_dir.glob("face_*_sprite_sheet_preview.png"))

    errors: list[str] = []
    expected_frames = sum(len(variations) for _emotion, variations in EMOTIONS)
    expected_sheet_size = (FRAME_COLUMNS * frame_size, FRAME_ROWS * frame_size)
    if len(frame_paths) != expected_frames:
        errors.append(f"Expected {expected_frames} frame PNGs, found {len(frame_paths)}")

    dimensions = []
    circular_mask_ok = True
    clean_background_ok = True
    for frame_path in frame_paths:
        with Image.open(frame_path).convert("RGBA") as image:
            dimensions.append(image.size)
            if image.size != (frame_size, frame_size):
                errors.append(f"{frame_path.name} has dimensions {image.size}, expected {(frame_size, frame_size)}")
            if not _outside_circle_is_transparent(image):
                circular_mask_ok = False
                clean_background_ok = False

    with Image.open(sheet_path) as sheet:
        if sheet.size != expected_sheet_size:
            errors.append(f"{sheet_path.name} has dimensions {sheet.size}, expected {expected_sheet_size}")
    with Image.open(preview_path) as preview:
        if preview.size != expected_sheet_size:
            errors.append(f"{preview_path.name} has dimensions {preview.size}, expected {expected_sheet_size}")

    if not circular_mask_ok:
        errors.append("One or more frames have non-transparent pixels outside the circular boundary")

    return {
        "ok": not errors,
        "errors": errors,
        "frame_count": len(frame_paths),
        "frame_dimensions": sorted({f"{width}x{height}" for width, height in dimensions}),
        "sprite_sheet_dimensions": f"{expected_sheet_size[0]}x{expected_sheet_size[1]}",
        "circular_mask_consistent": circular_mask_ok,
        "clean_background_outside_circle": clean_background_ok,
    }


def _outside_circle_is_transparent(image: Image.Image) -> bool:
    width, height = image.size
    cx = width / 2
    cy = height / 2
    radius = min(width, height) / 2 - max(18, round(width * 0.055)) + 2
    alpha = image.getchannel("A")
    samples = 0
    violations = 0
    for y in range(0, height, max(1, height // 64)):
        for x in range(0, width, max(1, width // 64)):
            if ((x - cx) ** 2 + (y - cy) ** 2) ** 0.5 > radius:
                samples += 1
                if alpha.getpixel((x, y)) > 8:
                    violations += 1
    return violations <= max(2, samples // 200)
