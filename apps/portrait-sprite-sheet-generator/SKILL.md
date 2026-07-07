---
name: portrait-sprite-sheet-generator
description: >-
  Detect one or more faces in a user-supplied portrait/photo and generate a
  standardized 6-row by 2-column circular emoji-avatar sprite sheet for each
  detected face. Use when Codex needs app/game-ready cute emotional avatar
  frames, individual PNG frames, preview sheets, and metadata for each face.
---

# Portrait Sprite Sheet Generator

Use this skill when the user wants a reusable emoji/avatar sprite sheet from a portrait or group photo. The primary generator is ImageGen: first create a polished 6-row by 2-column review sheet like a professional avatar guide, then use the local CLI to normalize that sheet into exact production frames, metadata, and validation outputs.

The required output per detected face is:

- `face_{index}_sprite_sheet.png`: production sheet, 6 rows x 2 columns, no labels by default.
- `face_{index}_sprite_sheet_preview.png`: same layout with optional review labels.
- 12 individual square PNG frames.
- `face_{index}_metadata.json`.

Each frame is a square transparent canvas containing a mathematically circular avatar badge. The rows must be:

1. `happy`
2. `excited`
3. `sad`
4. `dizzy`
5. `playful`
6. `sleepy`

Each row has exactly 2 frames.

## Primary Workflow: ImageGen First

1. Validate the input image and detect/crop the target face(s).
2. For each face, use ImageGen/edit with the face crop as the identity reference and the prompt template:
   [templates/imagegen-sprite-sheet-prompt.md](templates/imagegen-sprite-sheet-prompt.md)
3. Visually inspect the generated sheet. It should look like a polished 6-emotion avatar guide: row labels may appear on the left, with two circular icons per emotion row.
4. Post-process the ImageGen sheet with the CLI:

```bash
python3 scripts/generate_portrait_sprite_sheet.py \
  --generated-sheet "/absolute/path/to/imagegen_sheet.png" \
  --input "/absolute/path/to/source_photo.jpg" \
  --output-dir "/absolute/path/to/output" \
  --frame-size 512 \
  --include-labels
```

The post-processor extracts the 12 circular badges, normalizes each to a square frame, applies a consistent circular mask, assembles the production sheet, creates the preview sheet, writes metadata, and validates dimensions/masks.

## CLI

Run the bundled CLI from the skill folder:

```bash
python3 scripts/generate_portrait_sprite_sheet.py \
  --input "/absolute/path/to/photo.jpg" \
  --output-dir "/absolute/path/to/output" \
  --frame-size 512 \
  --include-labels \
  --max-faces 2 \
  --style-strength high
```

That command uses the local deterministic fallback renderer. Use it for smoke tests or when ImageGen is unavailable, not as the preferred visual output.

If default `python3` lacks Pillow, use the Codex bundled Python:

```bash
/Users/liqingpan/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3 \
  scripts/generate_portrait_sprite_sheet.py \
  --input "/absolute/path/to/photo.jpg" \
  --output-dir "/absolute/path/to/output"
```

Dependencies:

- Pillow is required.
- `opencv-python-headless<5` is strongly preferred for reliable face detection. The CLI has a broad skin-region fallback, but use OpenCV for production work:

```bash
python3 -m pip install "opencv-python-headless<5"
```

CLI arguments:

- `--input`: source image path.
- `--generated-sheet`: optional ImageGen-produced 6x2 review sheet to post-process.
- `--output-dir`: output directory.
- `--frame-size`: square frame size, default `512`.
- `--include-labels`: add labels to preview sheet only.
- `--max-faces`: optional cap after left-to-right face sorting.
- `--style-strength`: `medium` or `high`, default `high`.

## Local Fallback Workflow

1. Validate the input image.
2. Detect all visible faces, sorted left to right by bounding-box x-coordinate.
3. Crop and normalize each face independently.
4. Generate 12 same-size circular avatar frames per face with deterministic overlays.
5. Assemble the production and preview sprite sheets.
6. Write metadata.
7. Run post-generation validation.

If no faces are detected, stop with a clear error. Do not silently generate a sheet from the whole image.

## Visual Rules

- Every production frame must have a perfect circular visible boundary.
- The area outside the avatar circle must be transparent or clean.
- Keep all hair, ears, accessories, emotion symbols, and marks inside the circular boundary.
- Preserve key identity markers: face shape, glasses, hairstyle or hairline, eyebrows, eyes, nose, mouth/smile, facial hair, and skin tone.
- Keep eyes and mouths exaggerated and readable at small app/game sizes.
- Use a cute, stylized, sprite-friendly emoji-avatar look.
- Use a warm pale circle background inside the avatar.

Do not treat the deterministic fallback as the desired art style when ImageGen is available. It is a structural fallback for layout, validation, and downstream extraction.

## ImageGen Visual Target

The generated sheet should match this kind of output:

- Left-side row labels are acceptable in the review sheet: `HAPPY`, `EXCITED`, `SAD`, `DIZZY`, `PLAYFUL`, `SLEEPY`.
- Two aligned circular emoji-avatar icons per row.
- Icons have identical size, warm circular badge backgrounds, large readable eyes, and large readable mouths.
- The character remains consistent across all 12 icons.
- Any excited marks, stars, tears, tongue, or Z symbols stay inside or close to the circular badge and must not prevent extraction.

## Emotion Definitions

- `happy_01`: gentle smile, bright eyes.
- `happy_02`: open smile, cheerful eyes.
- `excited_01`: wide eyes, open-mouth smile.
- `excited_02`: bigger open mouth, energy marks.
- `sad_01`: downturned mouth, worried eyebrows.
- `sad_02`: sad eyes, downturned mouth, one tear.
- `dizzy_01`: spiral eyes, small open mouth.
- `dizzy_02`: spiral eyes, wavy mouth, small stars.
- `playful_01`: wink, tongue out.
- `playful_02`: both eyes open, tongue out, mischievous smile.
- `sleepy_01`: closed eyes, small sleepy mouth.
- `sleepy_02`: closed eyes, yawning mouth, small Z symbols.

## Metadata

Each `face_{index}_metadata.json` must include:

- `source_image`
- `face_index`
- `detected_face_bbox` as `[x, y, width, height]`
- `frame_size`
- `rows`: `6`
- `columns`: `2`
- `emotions`
- `layout`
- `style`
- `validation`

## Acceptance Checks

After generation, confirm:

- There are exactly 12 frame PNGs per face.
- All frame PNGs have identical square dimensions.
- The production sheet is exactly `columns * frame_size` by `rows * frame_size`.
- The preview sheet is the same size as the production sheet.
- The circular mask is applied consistently.
- The background outside the circle is transparent or clean.
