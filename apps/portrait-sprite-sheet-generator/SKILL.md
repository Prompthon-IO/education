---
name: portrait-sprite-sheet-generator
description: >-
  Detect one or more faces in a user-supplied portrait/photo and generate a
  fixed 4 inch x 7 inch locally generated circular emoji-avatar sticker sheet
  for each detected face. Use when Codex needs app/game-ready cute avatar
  stickers from the local ImageGen model, preview sheets, and metadata.
---

# Portrait Sprite Sheet Generator

Use this skill when the user wants a reusable emoji/avatar sprite sheet from a portrait or group photo. The primary generator is the local ImageGen model: first create a polished fixed 4 inch x 7 inch review sheet like a professional avatar guide, then use the local CLI only to normalize or validate production frames, metadata, and validation outputs.

The final artwork must be a local-model-generated cartoon/avatar transformation of the reference photo. Do not treat a raw photo with drawn-on eyes, mouths, symbols, or labels as an acceptable final output.

## Local Model Only

This skill must use the local ImageGen model, not the OpenAI Image API or any other cloud image API. Do not call `~/.codex/skills/imagegen/scripts/image_gen.py`, do not depend on `OPENAI_API_KEY`, and do not fall back to remote generation when the local model is unavailable.

If no local ImageGen runner/service is available, stop with a clear blocker and keep the current template/preview unchanged. The deterministic Python renderer may be used only for smoke tests, geometry validation, and placeholder previews; it is not an acceptable final visual style.

The preferred local ImageGen preview output per detected face is:

- `current-sprite-sheet-preview.png`: fixed 4 inch x 7 inch preview sheet.
- `sprite-template-4x7.png`: reusable template with a pure white background, the original source photo as a square rounded-corner face crop with the same light gray border treatment as the aligned Discord QR code, and the FIRA 2026 plus Prompthon.io logos on the right.
- `sprite-template-4x7-manifest.json`: exact circle coordinates, circle diameter, logo bounds, QR bounds, and source portrait bounds.
- A 3-column by 4-row light gray dashed circle grid with fixed size and location.

When a downstream animation engine needs extracted production frames, also produce:

- `face_{index}_sprite_sheet.png`: production sheet, 4 rows x 3 columns, no labels by default.
- `face_{index}_sprite_sheet_preview.png`: same layout with optional review labels.
- 12 individual square PNG frames.
- `face_{index}_metadata.json`.

The default local ImageGen review sheet uses the fixed 3-column by 4-row circle template. Fill the sheet left-to-right, top-to-bottom with six emotions and two variants per emotion. If production animation frames are required afterward, each extracted frame is a square transparent canvas containing a mathematically circular avatar badge. The default sticker order is:

1. `happy_01`
2. `happy_02`
3. `excited_01`
4. `excited_02`
5. `sad_01`
6. `sad_02`
7. `dizzy_01`
8. `dizzy_02`
9. `playful_01`
10. `playful_02`
11. `sleepy_01`
12. `sleepy_02`

Keep the header order, square bordered source photo crop, QR code, logos, circle diameter, circle positions, and gutters unchanged. The model-generated result is only allowed to supply artwork for the 12 sticker slots; do not publish model-generated pixels for the source photo, QR, or logo header assets.

Always reattach the canonical header assets after local ImageGen finishes. Local image models often distort QR modules and can redraw or crop the FIRA/Prompthon logos, so treat those generated header pixels as disposable. Composite the real face-centered crop from the original source photo, the approved QR PNG, and the approved logo PNGs back into the manifest-defined bounds before publishing the live sheet.

## Header Asset Geometry

Use these measured header bounds on the `1200 x 2100` canvas. The original photo belongs in the upper-left rounded rectangle and must be a face-centered crop, not a full-body or uncropped source image.

| Asset | Content bounds | Visible frame bounds | Rule |
| --- | --- | --- | --- |
| Source photo crop | `x=58 y=52 width=220 height=220` | `x=42 y=36 width=252 height=252 radius=26` | Face-centered square crop with rounded crop radius about `27`; frame padding `16`. |
| Discord QR | `x=340 y=52 width=220 height=220` | `x=324 y=36 width=252 height=252 radius=26` | Same size, frame, padding, and vertical alignment as the source photo, with visible spacing from the photo frame. |
| FIRA 2026 logo | `x=620 y=58 width=520 height=85` | none | Right header top row. |
| Prompthon.io logo | `x=620 y=201 width=520 height=44` | none | Right header second row. |

Scale rule: the source photo content box is `18.33%` of canvas width and `10.48%` of canvas height; its visible rounded frame is `21.00%` of canvas width and `12.00%` of canvas height. Keep the photo and QR square and equal-sized.

## Slot Geometry Contract

Use `sprite-template-4x7-manifest.json` as the authoritative geometry source. The template canvas is exactly `1200 x 2100` pixels in a `4:7` ratio. The header occupies `x=0 y=0 width=1200 height=340`.

The local ImageGen result must preserve these measured circle slots exactly. Do not let the model invent a new grid, shift the icons, scale circles differently, or redraw the header.

| Slot | Sticker | Top-left x,y | Diameter | Center x,y |
| --- | --- | --- | --- | --- |
| `r1c1` | `happy_01` | `70,360` | `310` | `225,515` |
| `r1c2` | `happy_02` | `445,360` | `310` | `600,515` |
| `r1c3` | `excited_01` | `820,360` | `310` | `975,515` |
| `r2c1` | `excited_02` | `70,750` | `310` | `225,905` |
| `r2c2` | `sad_01` | `445,750` | `310` | `600,905` |
| `r2c3` | `sad_02` | `820,750` | `310` | `975,905` |
| `r3c1` | `dizzy_01` | `70,1140` | `310` | `225,1295` |
| `r3c2` | `dizzy_02` | `445,1140` | `310` | `600,1295` |
| `r3c3` | `playful_01` | `820,1140` | `310` | `975,1295` |
| `r4c1` | `playful_02` | `70,1530` | `310` | `225,1685` |
| `r4c2` | `sleepy_01` | `445,1530` | `310` | `600,1685` |
| `r4c3` | `sleepy_02` | `820,1530` | `310` | `975,1685` |

Scale rule: each avatar badge should occupy the full existing `310 x 310` circular slot, centered on the slot center. On the 1200 x 2100 canvas, that diameter is `25.83%` of the canvas width and `14.76%` of the canvas height. Leave expression marks inside or immediately attached to that badge without crossing into neighboring slots.

## Primary Workflow: Local ImageGen First

1. Validate the input image and detect/crop the target face(s).
2. For each face, use the local ImageGen model with the face crop as the identity reference and the prompt template:
   [templates/imagegen-sprite-sheet-prompt.md](templates/imagegen-sprite-sheet-prompt.md)
3. Reattach the original source photo crop, canonical Discord QR code, and logo assets using the manifest bounds before saving the live preview:

```bash
python3 scripts/reattach_discord_qr.py \
  --sheet "/absolute/path/to/local_imagegen_sheet.png" \
  --manifest "/absolute/path/to/sprite-template-4x7-manifest.json" \
  --source-photo "/absolute/path/to/source_photo.jpg" \
  --qr-code "/absolute/path/to/prompthon_discord_invite_qr_clean_icon.png" \
  --fira-logo "/absolute/path/to/FIRA2026_words_for_light_bg_red.png" \
  --prompthon-logo "/absolute/path/to/prompthon_io_clean_transparent_light.png"
```

4. Visually inspect the generated sheet. It should look like a polished six-emotion avatar guide with two variants per emotion on the fixed 4 inch x 7 inch FIRA x Prompthon template, with the square source photo, QR code, and logos preserved and avatar artwork centered inside the predefined dashed circles.
5. Post-process the ImageGen sheet with the CLI:

```bash
python3 scripts/generate_portrait_sprite_sheet.py \
  --generated-sheet "/absolute/path/to/local_imagegen_sheet.png" \
  --input "/absolute/path/to/source_photo.jpg" \
  --output-dir "/absolute/path/to/output" \
  --frame-size 512 \
  --include-labels
```

The post-processor extracts circular badges for production animation only, normalizes each to a square frame, applies a consistent circular mask, assembles the production sheet, creates the preview sheet, writes metadata, and validates dimensions/masks.

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

That command uses the local deterministic fallback renderer. Use it for smoke tests only, not as the preferred visual output.

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
- `--generated-sheet`: optional local-ImageGen-produced review sheet to post-process when production frames are needed.
- `--output-dir`: output directory.
- `--frame-size`: square frame size, default `512`.
- `--include-labels`: add labels to preview sheet only.
- `--max-faces`: optional cap after left-to-right face sorting.
- `--style-strength`: `medium` or `high`, default `high`.

## Local Fallback Workflow

1. Validate the input image.
2. Detect all visible faces, sorted left to right by bounding-box x-coordinate.
3. Crop and normalize each face independently.
4. Generate same-size circular avatar frames per face with deterministic overlays for structural testing only.
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
- Use a cute, stylized, sprite-friendly emoji-avatar look with exaggerated emotion differences.
- Use a warm pale circle background inside the avatar.

Do not treat the deterministic fallback as the desired art style. It is a structural fallback for layout, validation, and downstream extraction.

## Local ImageGen Visual Target

The generated sheet should match this kind of output:

- The review sheet must keep a fixed 4 inch x 7 inch canvas ratio.
- The review sheet must preserve the pure white template background, square rounded-corner original photo crop with matching light gray border, Discord QR code, and right-side FIRA 2026 plus Prompthon.io logos.
- Do not add square or rounded-square panels behind the circle slots; the light gray dashed circles themselves are the placeholders.
- Labels are acceptable in the review sheet only if they do not change the template.
- Place one clearly separated circular emoji-avatar display in each sticker slot.
- Icons have identical size, warm circular badge backgrounds, large readable eyes, and large readable mouths.
- The character remains consistent across all 12 stickers: six emotions, two variants each.
- Any excited marks, stars, tears, dizzy symbols, tongue marks, or Z symbols stay inside or close to the circular badge and must not prevent extraction.
- Expressions should be cute but more exaggerated than a subtle portrait edit.

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
- `rows`: `4`
- `columns`: `3`
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
- The local ImageGen review sheet still matches the Slot Geometry Contract: every avatar center, circle diameter, and sticker order matches the manifest.
