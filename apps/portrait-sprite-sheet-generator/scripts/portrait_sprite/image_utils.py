from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter


SUPPORTED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp", ".bmp", ".tif", ".tiff"}


def load_image(path: Path) -> Image.Image:
    if not path.exists():
        raise FileNotFoundError(f"Input image does not exist: {path}")
    if not path.is_file():
        raise ValueError(f"Input path is not a file: {path}")
    if path.suffix.lower() not in SUPPORTED_EXTENSIONS:
        raise ValueError(f"Unsupported image extension: {path.suffix}")
    try:
        image = Image.open(path)
        image.load()
    except Exception as exc:
        raise ValueError(f"Could not read input image: {path}") from exc
    return image.convert("RGBA")


def expand_bbox(bbox: tuple[int, int, int, int], image_size: tuple[int, int], scale: float = 2.65) -> tuple[int, int, int, int]:
    x, y, width, height = bbox
    center_x = x + width / 2
    center_y = y + height / 2
    size = max(width, height) * scale
    left = max(0, round(center_x - size / 2))
    top = max(0, round(center_y - size / 2))
    right = min(image_size[0], round(center_x + size / 2))
    bottom = min(image_size[1], round(center_y + size / 2))
    return left, top, right - left, bottom - top


def square_crop(image: Image.Image, bbox: tuple[int, int, int, int], output_size: int) -> Image.Image:
    expanded = expand_bbox(bbox, image.size)
    x, y, width, height = expanded
    crop = image.crop((x, y, x + width, y + height))
    side = max(crop.width, crop.height)
    square = Image.new("RGBA", (side, side), (255, 255, 255, 0))
    square.alpha_composite(crop, ((side - crop.width) // 2, (side - crop.height) // 2))
    return square.resize((output_size, output_size), Image.Resampling.LANCZOS)


def circular_mask(size: int, padding: int) -> Image.Image:
    mask = Image.new("L", (size, size), 0)
    draw = ImageDraw.Draw(mask)
    draw.ellipse((padding, padding, size - padding, size - padding), fill=255)
    return mask.filter(ImageFilter.GaussianBlur(0.35))


def apply_circular_alpha(image: Image.Image, padding: int) -> Image.Image:
    image = image.convert("RGBA")
    mask = circular_mask(image.width, padding)
    result = Image.new("RGBA", image.size, (255, 255, 255, 0))
    result.alpha_composite(image)
    result.putalpha(mask)
    return result
