from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

from .image_utils import apply_circular_alpha, square_crop


EMOTIONS = [
    ("happy", ("gentle smile", "open smile")),
    ("excited", ("wide eyes", "energy marks")),
    ("sad", ("worried eyebrows", "tear")),
    ("dizzy", ("spiral eyes", "stars")),
    ("playful", ("wink tongue", "mischievous tongue")),
    ("sleepy", ("closed eyes", "yawn Z")),
]
FRAME_COLUMNS = 3
FRAME_ROWS = 4


@dataclass(frozen=True)
class GeneratedFace:
    face_dir: Path
    frame_paths: list[Path]
    sprite_sheet_path: Path
    preview_sheet_path: Path
    metadata_path: Path


def generate_frames(source: Image.Image, bbox: tuple[int, int, int, int], frame_size: int, style_strength: str) -> list[tuple[str, Image.Image]]:
    base = square_crop(source, bbox, frame_size)
    frames: list[tuple[str, Image.Image]] = []
    for row_index, (emotion, variations) in enumerate(EMOTIONS):
        for variation_index, variation in enumerate(variations, start=1):
            frame_id = f"{emotion}_{variation_index:02d}"
            frames.append((frame_id, _render_emotion_frame(base, frame_size, emotion, variation, row_index, variation_index, style_strength)))
    return frames


def save_face_outputs(
    source: Image.Image,
    bbox: tuple[int, int, int, int],
    face_index: int,
    output_dir: Path,
    frame_size: int,
    include_labels: bool,
    style_strength: str,
) -> GeneratedFace:
    face_dir = output_dir / f"face_{face_index}"
    face_dir.mkdir(parents=True, exist_ok=True)

    frames = generate_frames(source, bbox, frame_size, style_strength)
    frame_paths: list[Path] = []
    for frame_id, frame in frames:
        path = face_dir / f"face_{face_index}_{frame_id}.png"
        frame.save(path)
        frame_paths.append(path)

    sheet = assemble_sheet([frame for _frame_id, frame in frames], frame_size)
    sprite_sheet_path = face_dir / f"face_{face_index}_sprite_sheet.png"
    sheet.save(sprite_sheet_path)

    preview = assemble_sheet([frame for _frame_id, frame in frames], frame_size)
    if include_labels:
        _draw_preview_labels(preview, [frame_id for frame_id, _frame in frames], frame_size)
    preview_sheet_path = face_dir / f"face_{face_index}_sprite_sheet_preview.png"
    preview.save(preview_sheet_path)

    return GeneratedFace(face_dir, frame_paths, sprite_sheet_path, preview_sheet_path, face_dir / f"face_{face_index}_metadata.json")


def assemble_sheet(frames: list[Image.Image], frame_size: int) -> Image.Image:
    expected_frames = sum(len(variations) for _emotion, variations in EMOTIONS)
    if len(frames) != expected_frames:
        raise ValueError(f"Expected {expected_frames} frames, got {len(frames)}")
    sheet = Image.new("RGBA", (FRAME_COLUMNS * frame_size, FRAME_ROWS * frame_size), (255, 255, 255, 0))
    for index, frame in enumerate(frames):
        row = index // FRAME_COLUMNS
        column = index % FRAME_COLUMNS
        sheet.alpha_composite(frame, (column * frame_size, row * frame_size))
    return sheet


def _render_emotion_frame(base: Image.Image, frame_size: int, emotion: str, variation: str, row_index: int, variation_index: int, style_strength: str) -> Image.Image:
    padding = max(18, round(frame_size * 0.055))
    circle_bg = Image.new("RGBA", (frame_size, frame_size), (255, 255, 255, 0))
    draw = ImageDraw.Draw(circle_bg)
    warm = (255, 239 - row_index * 3, 196 + row_index * 5, 255)
    draw.ellipse((padding, padding, frame_size - padding, frame_size - padding), fill=warm)

    crop_padding = max(30, round(frame_size * 0.08))
    crop = apply_circular_alpha(base, crop_padding)
    opacity = 220 if style_strength == "high" else 240
    crop.putalpha(crop.getchannel("A").point(lambda alpha: min(alpha, opacity)))
    circle_bg.alpha_composite(crop)

    overlay = Image.new("RGBA", (frame_size, frame_size), (255, 255, 255, 0))
    _draw_expression(overlay, emotion, variation, frame_size, variation_index)
    circle_bg.alpha_composite(overlay)

    border = Image.new("RGBA", (frame_size, frame_size), (255, 255, 255, 0))
    border_draw = ImageDraw.Draw(border)
    border_draw.ellipse((padding, padding, frame_size - padding, frame_size - padding), outline=(7, 17, 31, 255), width=max(8, frame_size // 40))
    border_draw.ellipse((padding + 8, padding + 8, frame_size - padding - 8, frame_size - padding - 8), outline=(255, 255, 255, 150), width=max(3, frame_size // 120))
    circle_bg.alpha_composite(border)
    return apply_circular_alpha(circle_bg, padding)


def _draw_expression(image: Image.Image, emotion: str, variation: str, frame_size: int, variation_index: int) -> None:
    draw = ImageDraw.Draw(image)
    cx = frame_size // 2
    eye_y = round(frame_size * 0.42)
    left_eye = round(frame_size * 0.39)
    right_eye = round(frame_size * 0.61)
    mouth_y = round(frame_size * 0.62)
    stroke = max(5, frame_size // 64)
    ink = (7, 17, 31, 220)
    white = (255, 255, 255, 230)
    red = (239, 68, 68, 230)
    blue = (59, 130, 246, 230)

    def eye(x: int, y: int, wide: bool = False) -> None:
        r = round(frame_size * (0.036 if not wide else 0.045))
        draw.ellipse((x - r, y - r, x + r, y + r), fill=white, outline=ink, width=max(2, stroke // 2))
        draw.ellipse((x - r // 3, y - r // 3, x + r // 3, y + r // 3), fill=ink)

    if emotion in {"happy", "excited"}:
        eye(left_eye, eye_y, emotion == "excited")
        eye(right_eye, eye_y, emotion == "excited")
        if variation_index == 1:
            draw.arc((cx - 56, mouth_y - 28, cx + 56, mouth_y + 42), 10, 170, fill=ink, width=stroke)
        else:
            draw.ellipse((cx - 44, mouth_y - 14, cx + 44, mouth_y + 54), fill=(145, 37, 37, 230), outline=ink, width=stroke)
            draw.arc((cx - 35, mouth_y + 12, cx + 35, mouth_y + 66), 200, 340, fill=(255, 190, 190, 230), width=stroke)
        if emotion == "excited" and variation_index == 2:
            for dx, dy in [(-135, -85), (132, -82), (-150, -5), (150, 5)]:
                draw.line((cx + dx, eye_y + dy, cx + dx * 0.9, eye_y + dy - 28), fill=(255, 90, 0, 230), width=stroke)
    elif emotion == "sad":
        eye(left_eye, eye_y)
        eye(right_eye, eye_y)
        draw.line((left_eye - 32, eye_y - 45, left_eye + 35, eye_y - 25), fill=ink, width=stroke)
        draw.line((right_eye - 35, eye_y - 25, right_eye + 32, eye_y - 45), fill=ink, width=stroke)
        draw.arc((cx - 54, mouth_y + 8, cx + 54, mouth_y + 78), 200, 340, fill=ink, width=stroke)
        if variation_index == 2:
            draw.ellipse((right_eye + 28, eye_y + 28, right_eye + 48, eye_y + 68), fill=blue)
    elif emotion == "dizzy":
        for x in (left_eye, right_eye):
            for radius in (8, 18, 28):
                draw.arc((x - radius, eye_y - radius, x + radius, eye_y + radius), 30, 330, fill=ink, width=max(3, stroke // 2))
        draw.arc((cx - 48, mouth_y - 10, cx + 48, mouth_y + 45), 20, 160, fill=ink, width=stroke)
        if variation_index == 2:
            _star(draw, cx + 125, eye_y - 65, 20, (255, 176, 0, 230))
            _star(draw, cx - 128, eye_y - 48, 16, (255, 176, 0, 230))
    elif emotion == "sleepy":
        draw.arc((left_eye - 35, eye_y - 12, left_eye + 35, eye_y + 20), 10, 170, fill=ink, width=stroke)
        draw.arc((right_eye - 35, eye_y - 12, right_eye + 35, eye_y + 20), 10, 170, fill=ink, width=stroke)
        if variation_index == 1:
            draw.arc((cx - 28, mouth_y, cx + 28, mouth_y + 34), 0, 180, fill=ink, width=stroke)
        else:
            draw.ellipse((cx - 24, mouth_y - 8, cx + 24, mouth_y + 42), fill=(145, 37, 37, 220), outline=ink, width=stroke)
            font = _font(frame_size // 9)
            draw.text((cx + 82, eye_y - 105), "Z", fill=ink, font=font)
            draw.text((cx + 124, eye_y - 150), "z", fill=ink, font=_font(frame_size // 12))
    elif emotion == "playful":
        if variation_index == 1:
            draw.arc((left_eye - 34, eye_y - 20, left_eye + 34, eye_y + 24), 15, 165, fill=ink, width=stroke)
            eye(right_eye, eye_y)
        else:
            eye(left_eye, eye_y)
            eye(right_eye, eye_y)
        draw.arc((cx - 62, mouth_y - 18, cx + 62, mouth_y + 48), 10, 170, fill=ink, width=stroke)
        draw.ellipse((cx - 18, mouth_y + 22, cx + 28, mouth_y + 76), fill=(255, 115, 145, 235), outline=ink, width=max(2, stroke // 2))


def _star(draw: ImageDraw.ImageDraw, x: int, y: int, radius: int, fill: tuple[int, int, int, int]) -> None:
    points = [
        (x, y - radius),
        (x + radius // 4, y - radius // 4),
        (x + radius, y),
        (x + radius // 4, y + radius // 4),
        (x, y + radius),
        (x - radius // 4, y + radius // 4),
        (x - radius, y),
        (x - radius // 4, y - radius // 4),
    ]
    draw.polygon(points, fill=fill)


def _draw_preview_labels(sheet: Image.Image, frame_ids: list[str], frame_size: int) -> None:
    draw = ImageDraw.Draw(sheet)
    font = _font(max(16, frame_size // 26))
    for index, frame_id in enumerate(frame_ids):
        row = index // 2
        column = index % 2
        x = column * frame_size + 16
        y = row * frame_size + 14
        draw.rounded_rectangle((x - 8, y - 6, x + 210, y + 34), radius=10, fill=(255, 255, 255, 210))
        draw.text((x, y), frame_id, fill=(7, 17, 31, 255), font=font)


def _font(size: int) -> ImageFont.ImageFont:
    for path in (
        "/System/Library/Fonts/Supplemental/Arial Bold.ttf",
        "/System/Library/Fonts/Supplemental/Arial.ttf",
        "/Library/Fonts/Arial.ttf",
    ):
        try:
            return ImageFont.truetype(path, size=size)
        except Exception:
            continue
    return ImageFont.load_default()
