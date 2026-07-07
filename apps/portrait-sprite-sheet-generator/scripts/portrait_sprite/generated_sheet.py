from __future__ import annotations

from collections import deque
from pathlib import Path

from PIL import Image

from .image_utils import circular_mask
from .sprite_sheet import assemble_sheet, _draw_preview_labels


FRAME_IDS = [
    "happy_01",
    "happy_02",
    "excited_01",
    "excited_02",
    "sad_01",
    "sad_02",
    "dizzy_01",
    "dizzy_02",
    "playful_01",
    "playful_02",
    "sleepy_01",
    "sleepy_02",
]


def save_generated_sheet_outputs(
    generated_sheet: Path,
    face_index: int,
    output_dir: Path,
    frame_size: int,
    include_labels: bool,
) -> tuple[Path, list[Path], Path, Path]:
    face_dir = output_dir / f"face_{face_index}"
    face_dir.mkdir(parents=True, exist_ok=True)
    source = Image.open(generated_sheet).convert("RGBA")
    frames = extract_frames_from_generated_sheet(source, frame_size)

    frame_paths: list[Path] = []
    for frame_id, frame in zip(FRAME_IDS, frames, strict=True):
        path = face_dir / f"face_{face_index}_{frame_id}.png"
        frame.save(path)
        frame_paths.append(path)

    sheet = assemble_sheet(frames, frame_size)
    sprite_sheet_path = face_dir / f"face_{face_index}_sprite_sheet.png"
    sheet.save(sprite_sheet_path)

    preview = assemble_sheet(frames, frame_size)
    if include_labels:
        _draw_preview_labels(preview, FRAME_IDS, frame_size)
    preview_sheet_path = face_dir / f"face_{face_index}_sprite_sheet_preview.png"
    preview.save(preview_sheet_path)
    return face_dir, frame_paths, sprite_sheet_path, preview_sheet_path


def extract_frames_from_generated_sheet(image: Image.Image, frame_size: int) -> list[Image.Image]:
    components = _find_badge_background_components(image)
    if len(components) == 12:
        components = _sort_components_as_grid(components)
    else:
        components = _find_avatar_components(image)
    if len(components) >= 12:
        components = _sort_components_as_grid(components[:12])
    else:
        components = _infer_regular_grid_components(components, image.size)
    return [_normalize_component(image, bbox, frame_size) for bbox in components]


def _find_badge_background_components(image: Image.Image) -> list[tuple[int, int, int, int, int]]:
    width, height = image.size
    pixels = image.convert("RGBA").load()
    mask = [[False] * width for _ in range(height)]
    for y in range(height):
        for x in range(width):
            red, green, blue, alpha = pixels[x, y]
            if alpha > 20 and red > 205 and green > 145 and blue < 210 and red > green and green > blue:
                mask[y][x] = True

    visited = [[False] * width for _ in range(height)]
    components: list[tuple[int, int, int, int, int]] = []
    for y in range(height):
        for x in range(width):
            if visited[y][x] or not mask[y][x]:
                continue
            bbox = _collect_component(mask, visited, x, y)
            bx, by, bw, bh, area = bbox
            if bw >= min(width, height) * 0.145 and bh >= min(width, height) * 0.095 and area > min(width, height) * min(width, height) * 0.0025:
                components.append(bbox)
    return components


def _find_avatar_components(image: Image.Image) -> list[tuple[int, int, int, int, int]]:
    width, height = image.size
    pixels = image.convert("RGBA").load()
    mask = [[False] * width for _ in range(height)]
    for y in range(height):
        for x in range(width):
            red, green, blue, alpha = pixels[x, y]
            if alpha > 20 and not (red > 244 and green > 244 and blue > 244):
                mask[y][x] = True

    visited = [[False] * width for _ in range(height)]
    components: list[tuple[int, int, int, int, int]] = []
    for y in range(height):
        for x in range(width):
            if visited[y][x] or not mask[y][x]:
                continue
            bbox = _collect_component(mask, visited, x, y)
            bx, by, bw, bh, area = bbox
            if _looks_like_avatar_component(bw, bh, area, width, height):
                components.append(bbox)

    return sorted(components, key=lambda item: item[4], reverse=True)


def _collect_component(mask: list[list[bool]], visited: list[list[bool]], start_x: int, start_y: int) -> tuple[int, int, int, int, int]:
    height = len(mask)
    width = len(mask[0])
    queue: deque[tuple[int, int]] = deque([(start_x, start_y)])
    visited[start_y][start_x] = True
    min_x = max_x = start_x
    min_y = max_y = start_y
    area = 0
    while queue:
        x, y = queue.popleft()
        area += 1
        min_x = min(min_x, x)
        max_x = max(max_x, x)
        min_y = min(min_y, y)
        max_y = max(max_y, y)
        for nx, ny in ((x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)):
            if 0 <= nx < width and 0 <= ny < height and not visited[ny][nx] and mask[ny][nx]:
                visited[ny][nx] = True
                queue.append((nx, ny))
    return min_x, min_y, max_x - min_x + 1, max_y - min_y + 1, area


def _looks_like_avatar_component(width: int, height: int, area: int, image_width: int, image_height: int) -> bool:
    aspect = width / max(1, height)
    min_side = min(image_width, image_height)
    return (
        0.72 <= aspect <= 1.28
        and width >= min_side * 0.07
        and height >= min_side * 0.07
        and area >= min_side * min_side * 0.004
    )


def _sort_components_as_grid(components: list[tuple[int, int, int, int, int]]) -> list[tuple[int, int, int, int, int]]:
    sorted_by_y = sorted(components, key=lambda item: item[1] + item[3] / 2)
    rows = [sorted_by_y[index : index + 2] for index in range(0, 12, 2)]
    return [item for row in rows for item in sorted(row, key=lambda value: value[0] + value[2] / 2)]


def _infer_regular_grid_components(
    components: list[tuple[int, int, int, int, int]],
    image_size: tuple[int, int],
) -> list[tuple[int, int, int, int, int]]:
    if len(components) < 4:
        raise ValueError(f"Expected enough avatar components to infer a 6x2 grid, found {len(components)}")

    image_width, image_height = image_size
    centers = [(x + width / 2, y + height / 2, width, height) for x, y, width, height, _area in components]
    centers_by_x = sorted(centers, key=lambda item: item[0])
    midpoint = len(centers_by_x) // 2
    left_column_x = sum(item[0] for item in centers_by_x[:midpoint]) / max(1, midpoint)
    right_column_x = sum(item[0] for item in centers_by_x[midpoint:]) / max(1, len(centers_by_x) - midpoint)

    y_centers = sorted({round(item[1]) for item in centers})
    top_y = min(y_centers)
    diffs = [b - a for a, b in zip(y_centers, y_centers[1:]) if 40 <= b - a <= image_height / 3]
    if diffs:
        row_gap = sorted(diffs)[len(diffs) // 2]
    else:
        row_gap = (image_height - top_y * 2) / 5

    near_square_widths = [width for _cx, _cy, width, height in centers if 0.65 <= width / max(1, height) <= 1.35]
    base_side = sorted(near_square_widths or [item[2] for item in centers])[len(near_square_widths or centers) // 2]
    side = max(64, round(min(base_side * 1.06, row_gap * 0.96)))

    inferred: list[tuple[int, int, int, int, int]] = []
    for row in range(6):
        center_y = top_y + row * row_gap
        for center_x in (left_column_x, right_column_x):
            left = max(0, round(center_x - side / 2))
            top = max(0, round(center_y - side / 2))
            if left + side > image_width:
                left = max(0, image_width - side)
            if top + side > image_height:
                top = max(0, image_height - side)
            inferred.append((left, top, side, side, side * side))
    return inferred


def _normalize_component(image: Image.Image, bbox: tuple[int, int, int, int, int], frame_size: int) -> Image.Image:
    x, y, width, height, _area = bbox
    side = max(width, height)
    pad = round(side * 0.08)
    center_x = x + width / 2
    center_y = y + height / 2
    left = max(0, round(center_x - side / 2 - pad))
    top = max(0, round(center_y - side / 2 - pad))
    right = min(image.width, round(center_x + side / 2 + pad))
    bottom = min(image.height, round(center_y + side / 2 + pad))
    crop = image.crop((left, top, right, bottom)).convert("RGBA")

    content_size = round(frame_size * 0.9)
    crop.thumbnail((content_size, content_size), Image.Resampling.LANCZOS)
    frame = Image.new("RGBA", (frame_size, frame_size), (255, 255, 255, 0))
    frame.alpha_composite(crop, ((frame_size - crop.width) // 2, (frame_size - crop.height) // 2))
    frame.putalpha(circular_mask(frame_size, max(18, round(frame_size * 0.055))))
    return frame
