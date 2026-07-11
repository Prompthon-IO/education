#!/usr/bin/env python3
from __future__ import annotations

import argparse
import sys
from pathlib import Path

from portrait_sprite.face_detection import detect_faces
from portrait_sprite.generated_sheet import save_generated_sheet_outputs
from portrait_sprite.image_utils import load_image
from portrait_sprite.metadata import write_metadata
from portrait_sprite.sprite_sheet import save_face_outputs
from portrait_sprite.validation import validate_face_outputs


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Generate circular emoji-avatar sprite sheets from a portrait or group photo.")
    parser.add_argument("--input", type=Path, help="Source image path.")
    parser.add_argument(
        "--generated-sheet",
        type=Path,
        help="ImageGen-produced 3x4 review sheet to normalize into production frames.",
    )
    parser.add_argument("--output-dir", required=True, type=Path, help="Directory for generated face folders.")
    parser.add_argument("--frame-size", default=512, type=int, help="Square frame size in pixels.")
    parser.add_argument("--include-labels", action="store_true", help="Add labels to preview sheets.")
    parser.add_argument("--max-faces", type=int, help="Optional maximum number of faces after left-to-right sorting.")
    parser.add_argument("--style-strength", choices=("medium", "high"), default="high", help="Amount of deterministic expression overlay.")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    if args.frame_size < 128:
        print("--frame-size must be at least 128", file=sys.stderr)
        return 2
    if args.max_faces is not None and args.max_faces < 1:
        print("--max-faces must be at least 1", file=sys.stderr)
        return 2
    if args.input is None and args.generated_sheet is None:
        print("Provide --input for face detection/generation or --generated-sheet for ImageGen sheet post-processing.", file=sys.stderr)
        return 2

    args.output_dir.mkdir(parents=True, exist_ok=True)

    if args.generated_sheet is not None:
        if not args.generated_sheet.exists():
            print(f"Generated sheet does not exist: {args.generated_sheet}", file=sys.stderr)
            return 2
        try:
            face_dir, _frame_paths, _sheet_path, _preview_path = save_generated_sheet_outputs(
                generated_sheet=args.generated_sheet,
                face_index=0,
                output_dir=args.output_dir,
                frame_size=args.frame_size,
                include_labels=args.include_labels,
            )
        except Exception as exc:
            print(f"Could not post-process generated sheet: {exc}", file=sys.stderr)
            return 1
        validation = validate_face_outputs(face_dir, args.frame_size)
        metadata_path = face_dir / "face_0_metadata.json"
        write_metadata(
            metadata_path,
            source_image=args.input or args.generated_sheet,
            face_index=0,
            detected_face_bbox=(0, 0, 0, 0),
            frame_size=args.frame_size,
            detection_method="imagegen-generated-sheet",
            validation=validation,
        )
        if not validation["ok"]:
            print(f"Validation failed for {face_dir}: {validation['errors']}", file=sys.stderr)
            return 1
        print(face_dir)
        return 0

    try:
        image = load_image(args.input)
    except Exception as exc:
        print(str(exc), file=sys.stderr)
        return 2

    faces = detect_faces(image, args.max_faces)
    if not faces:
        print("No visible human faces were detected in the input image.", file=sys.stderr)
        return 1

    generated = []
    for face_index, face in enumerate(faces):
        result = save_face_outputs(
            source=image,
            bbox=face.bbox,
            face_index=face_index,
            output_dir=args.output_dir,
            frame_size=args.frame_size,
            include_labels=args.include_labels,
            style_strength=args.style_strength,
        )
        validation = validate_face_outputs(result.face_dir, args.frame_size)
        write_metadata(
            result.metadata_path,
            source_image=args.input,
            face_index=face_index,
            detected_face_bbox=face.bbox,
            frame_size=args.frame_size,
            detection_method=face.method,
            validation=validation,
        )
        if not validation["ok"]:
            print(f"Validation failed for {result.face_dir}: {validation['errors']}", file=sys.stderr)
            return 1
        generated.append(result.face_dir)

    for path in generated:
        print(path)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
