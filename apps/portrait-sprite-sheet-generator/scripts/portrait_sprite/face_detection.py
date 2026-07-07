from __future__ import annotations

from collections import deque
from dataclasses import dataclass
from pathlib import Path

from PIL import Image


@dataclass(frozen=True)
class DetectedFace:
    bbox: tuple[int, int, int, int]
    confidence: float
    method: str


def detect_faces(image: Image.Image, max_faces: int | None = None) -> list[DetectedFace]:
    faces = _detect_with_opencv(image)
    if not faces:
        faces = _detect_with_skin_components(image)
    faces = sorted(faces, key=lambda face: face.confidence, reverse=True)
    if max_faces is not None:
        faces = faces[:max_faces]
    faces = sorted(faces, key=lambda face: face.bbox[0])
    return faces


def _detect_with_opencv(image: Image.Image) -> list[DetectedFace]:
    try:
        import cv2  # type: ignore
        import numpy as np  # type: ignore
    except Exception:
        return []

    rgb = image.convert("RGB")
    max_dim = 1600
    scale = min(1.0, max_dim / max(rgb.size))
    if scale < 1:
        rgb = rgb.resize((round(rgb.width * scale), round(rgb.height * scale)), Image.Resampling.BILINEAR)
    array = np.array(rgb)
    gray = cv2.cvtColor(array, cv2.COLOR_RGB2GRAY)
    gray = cv2.equalizeHist(gray)
    cascade_paths = [
        Path(getattr(cv2.data, "haarcascades", "")) / "haarcascade_frontalface_alt2.xml",
        Path(getattr(cv2.data, "haarcascades", "")) / "haarcascade_frontalface_alt.xml",
        Path(getattr(cv2.data, "haarcascades", "")) / "haarcascade_frontalface_default.xml",
        Path(getattr(cv2.data, "haarcascades", "")) / "haarcascade_profileface.xml",
    ]
    detections: list[DetectedFace] = []
    for cascade_path in cascade_paths:
        if not cascade_path.exists():
            continue
        cascade = cv2.CascadeClassifier(str(cascade_path))
        for scale_factor in (1.05, 1.08, 1.1):
            boxes = cascade.detectMultiScale(gray, scaleFactor=scale_factor, minNeighbors=4, minSize=(25, 25))
            for x, y, width, height in boxes:
                bbox = (
                    round(int(x) / scale),
                    round(int(y) / scale),
                    round(int(width) / scale),
                    round(int(height) / scale),
                )
                score = _face_likelihood(bbox, image.size, (width * height) / max(1, rgb.width * rgb.height))
                if score > 0:
                    detections.append(DetectedFace(bbox, score + 1.0, f"opencv-haar:{cascade_path.name}"))
    return _dedupe_faces(detections)


def _detect_with_skin_components(image: Image.Image) -> list[DetectedFace]:
    small = image.convert("RGB")
    max_dim = 700
    scale = min(1.0, max_dim / max(small.size))
    if scale < 1:
        small = small.resize((round(small.width * scale), round(small.height * scale)), Image.Resampling.BILINEAR)

    width, height = small.size
    pixels = small.load()
    mask = [[False] * width for _ in range(height)]
    for y in range(height):
        for x in range(width):
            red, green, blue = pixels[x, y]
            if _is_skin_like(red, green, blue):
                mask[y][x] = True

    visited = [[False] * width for _ in range(height)]
    components: list[tuple[int, int, int, int, int]] = []
    for y in range(height):
        for x in range(width):
            if visited[y][x] or not mask[y][x]:
                continue
            bbox = _collect_component(mask, visited, x, y)
            bx, by, bw, bh, area = bbox
            if area < 70:
                continue
            aspect = bw / max(1, bh)
            if 0.42 <= aspect <= 1.45 and 18 <= bw <= width * 0.45 and 18 <= bh <= height * 0.55:
                components.append(bbox)

    candidates: list[DetectedFace] = []
    inv_scale = 1 / scale
    for x, y, w, h, area in sorted(components, key=lambda item: item[4], reverse=True)[:12]:
        expanded = _expand_component((x, y, w, h), (width, height))
        ex, ey, ew, eh = expanded
        bbox = (round(ex * inv_scale), round(ey * inv_scale), round(ew * inv_scale), round(eh * inv_scale))
        score = _face_likelihood(bbox, image.size, area / max(1, width * height))
        if score <= 0:
            continue
        candidates.append(
            DetectedFace(
                bbox,
                score,
                "skin-component",
            )
        )
    return _dedupe_faces(candidates)


def _is_skin_like(red: int, green: int, blue: int) -> bool:
    if red <= 70 or green <= 35 or blue <= 25:
        return False
    if red < green or red < blue:
        return False
    if max(red, green, blue) - min(red, green, blue) < 12:
        return False
    # YCbCr skin band, intentionally broad for varied lighting.
    cb = 128 - 0.168736 * red - 0.331264 * green + 0.5 * blue
    cr = 128 + 0.5 * red - 0.418688 * green - 0.081312 * blue
    return 76 <= cb <= 132 and 132 <= cr <= 184


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


def _expand_component(bbox: tuple[int, int, int, int], image_size: tuple[int, int]) -> tuple[int, int, int, int]:
    x, y, width, height = bbox
    pad_x = round(width * 0.45)
    pad_top = round(height * 0.85)
    pad_bottom = round(height * 0.45)
    left = max(0, x - pad_x)
    top = max(0, y - pad_top)
    right = min(image_size[0], x + width + pad_x)
    bottom = min(image_size[1], y + height + pad_bottom)
    return left, top, right - left, bottom - top


def _dedupe_faces(faces: list[DetectedFace]) -> list[DetectedFace]:
    kept: list[DetectedFace] = []
    for face in sorted(faces, key=lambda item: item.confidence, reverse=True):
        if all(_iou(face.bbox, existing.bbox) < 0.35 for existing in kept):
            kept.append(face)
    return kept


def _face_likelihood(bbox: tuple[int, int, int, int], image_size: tuple[int, int], component_area_ratio: float) -> float:
    x, y, width, height = bbox
    image_width, image_height = image_size
    if width <= 0 or height <= 0:
        return 0.0

    width_ratio = width / image_width
    height_ratio = height / image_height
    aspect = width / height
    center_y = (y + height / 2) / image_height
    touches_edge = x <= 2 or y <= 2 or x + width >= image_width - 2 or y + height >= image_height - 2

    if not 0.045 <= width_ratio <= 0.34:
        return 0.0
    if not 0.055 <= height_ratio <= 0.40:
        return 0.0
    if not 0.48 <= aspect <= 1.35:
        return 0.0

    # Favor face-like regions in the upper/middle part of a portrait and penalize
    # edge-connected arms, legs, and signs that the broad skin heuristic may catch.
    target_width = 0.16
    target_height = 0.22
    width_score = max(0.0, 1.0 - abs(width_ratio - target_width) / target_width)
    height_score = max(0.0, 1.0 - abs(height_ratio - target_height) / target_height)
    aspect_score = max(0.0, 1.0 - abs(aspect - 0.82) / 0.55)
    vertical_score = max(0.0, 1.0 - max(0.0, center_y - 0.44) / 0.28)
    edge_score = 0.18 if touches_edge else 1.0
    size_signal = min(1.0, component_area_ratio / 0.004)
    return (0.25 + width_score + height_score + aspect_score + vertical_score + size_signal) * edge_score


def _iou(a: tuple[int, int, int, int], b: tuple[int, int, int, int]) -> float:
    ax, ay, aw, ah = a
    bx, by, bw, bh = b
    left = max(ax, bx)
    top = max(ay, by)
    right = min(ax + aw, bx + bw)
    bottom = min(ay + ah, by + bh)
    if right <= left or bottom <= top:
        return 0.0
    intersection = (right - left) * (bottom - top)
    union = aw * ah + bw * bh - intersection
    return intersection / max(1, union)
