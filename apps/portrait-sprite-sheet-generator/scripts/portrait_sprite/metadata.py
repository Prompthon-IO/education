from __future__ import annotations

import json
from pathlib import Path

from .sprite_sheet import EMOTIONS


def write_metadata(
    path: Path,
    source_image: Path,
    face_index: int,
    detected_face_bbox: tuple[int, int, int, int],
    frame_size: int,
    detection_method: str,
    validation: dict,
) -> None:
    payload = {
        "source_image": str(source_image),
        "face_index": face_index,
        "detected_face_bbox": list(detected_face_bbox),
        "detection_method": detection_method,
        "frame_size": frame_size,
        "rows": 6,
        "columns": 2,
        "emotions": [{"name": name, "frames": 2} for name, _variations in EMOTIONS],
        "layout": [[f"{name}_01", f"{name}_02"] for name, _variations in EMOTIONS],
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
