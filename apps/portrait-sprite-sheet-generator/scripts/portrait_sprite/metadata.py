from __future__ import annotations

import json
from pathlib import Path

from .sprite_sheet import EMOTIONS, FRAME_COLUMNS, FRAME_ROWS


def write_metadata(
    path: Path,
    source_image: Path,
    face_index: int,
    detected_face_bbox: tuple[int, int, int, int],
    frame_size: int,
    detection_method: str,
    validation: dict,
) -> None:
    frame_ids = [f"{name}_{variation_index:02d}" for name, variations in EMOTIONS for variation_index in range(1, len(variations) + 1)]
    payload = {
        "source_image": str(source_image),
        "face_index": face_index,
        "detected_face_bbox": list(detected_face_bbox),
        "detection_method": detection_method,
        "frame_size": frame_size,
        "rows": FRAME_ROWS,
        "columns": FRAME_COLUMNS,
        "stickers": frame_ids,
        "emotions": [{"name": name, "frames": len(variations)} for name, variations in EMOTIONS],
        "layout": [
            frame_ids[row * FRAME_COLUMNS : (row + 1) * FRAME_COLUMNS]
            for row in range(FRAME_ROWS)
        ],
        "style": {
            "outer_shape": "perfect_circle",
            "identity_preservation": True,
            "large_eyes": True,
            "large_mouth": True,
            "cute_abstracted_avatar": True,
        },
        "validation": validation,
    }
    path.write_text(json.dumps(payload, indent=2), encoding="utf-8")
