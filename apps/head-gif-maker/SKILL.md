---
name: head-gif-maker
description: >-
  Make a short head-only reaction GIF from a portrait or headshot reference.
  Use when Codex needs to turn a person's photo into a 3- to 5-frame laughing,
  smiling, talking, nodding, or other head GIF while preserving identity,
  extracting the natural head boundary, removing the body/background, and
  assembling transparent PNG frames plus an animated GIF.
---

# Head GIF Maker

Use this skill when the user wants a head-only animated GIF from a portrait or headshot. The reliable workflow is:

1. Use image generation to create a clean head-only sprite sheet from the reference portrait.
2. Inspect the sprite sheet for identity, full head boundary, expression progression, and background.
3. Use the bundled local script only to split frames, remove border-connected background, and assemble the GIF.

Do not hand-warp a rectangular crop from the original portrait. That usually leaves wall pixels, hard crop edges, or broken head contours. The generated sprite sheet should define the head boundary.

Resolve `scripts/split_head_sprite.py` relative to the directory containing this `SKILL.md`.

## Inputs

Required:

- reference image path or URL
- requested reaction or motion, such as `laughing`, `smiling`, `talking`, `nodding`, or `surprised`

Defaults:

- frame count: `5` unless the user asks for `3`
- output canvas: `512x512`
- background: transparent PNG frames; GIF with a transparent index when feasible
- output directory: near the user's source image or under the current task output folder

## ImageGen Prompt Shape

Use the user-provided portrait as the strict identity reference. Ask for a single horizontal sprite sheet, not separate unrelated images.

```text
Use the input portrait as the strict identity reference. Create one horizontal <FRAME_COUNT>-frame sprite sheet for a short <REACTION> head animation.

Each frame must contain only the person's full head cutout: full hair outline, ears, glasses or facial accessories if present, face, cheeks, chin, and at most a tiny natural neck base. Remove the body, clothing, arms, original room, wall, and all background.

Do not use a rectangular crop; the visible boundary must follow the natural head silhouette. Preserve the same person, same facial proportions, same skin tone, same hairstyle, and photoreal portrait texture across all frames.

Frame progression left to right: <FRAME_SEQUENCE>.

Keep every head the same scale, centered, evenly spaced, front-facing unless the user requested otherwise, and fully visible. No text, no watermark, no extra objects.
```

For a laughing GIF, use:

```text
1 gentle smile, 2 bigger smile with cheeks raised, 3 open-mouth laugh with eyes slightly squinted, 4 laugh relaxing, 5 back to gentle smile
```

For 3 frames, use:

```text
1 gentle smile, 2 open-mouth laugh with eyes slightly squinted, 3 back to gentle smile
```

## Workflow

1. Generate or edit a sprite sheet using the image-generation path available in the current environment.

   Prefer an edit workflow with the portrait attached as the reference. Use high input fidelity when the API or tool supports it. If the local OpenAI CLI is available and authenticated:

   ```bash
   python3 "$CODEX_HOME/skills/imagegen/scripts/image_gen.py" edit \
     --image "/absolute/path/to/portrait.jpeg" \
     --prompt-file "/absolute/path/to/head-gif-prompt.txt" \
     --size 1536x1024 \
     --quality high \
     --input-fidelity high \
     --background transparent \
     --output-format png \
     --out "/absolute/path/to/head_sprite.png" \
     --force
   ```

   If the local API key is missing or invalid but in-app image generation is available, use the in-app ImageGen tool and then copy the generated image from the generated-images cache to the task output path. Leave the original generated image in place.

2. Visually inspect the sprite sheet.

   Reject or iterate if:

   - the output is a rectangular crop instead of a natural head boundary
   - the head is cut off
   - identity or glasses drift too much across frames
   - frames have inconsistent scale or spacing
   - the result contains body, shoulders, clothing, text, watermark, or extra objects

3. Split and assemble the GIF.

   ```bash
   python3 scripts/split_head_sprite.py \
     --sprite "/absolute/path/to/head_sprite.png" \
     --frames-dir "/absolute/path/to/head_frames" \
     --out-gif "/absolute/path/to/head.gif" \
     --preview-strip "/absolute/path/to/head_frames_strip.png" \
     --frame-count 5 \
     --canvas-size 512 \
     --remove-border-white \
     --force
   ```

   If the default Python lacks Pillow, use the bundled Codex runtime when available:

   ```bash
   /Users/liqingpan/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3 scripts/split_head_sprite.py ...
   ```

4. Verify the output.

   ```bash
   ffprobe -v error -select_streams v:0 -count_frames \
     -show_entries stream=width,height,nb_read_frames \
     -of default=nw=1 "/absolute/path/to/head.gif"
   ```

   Inspect the preview strip and at least the most expressive middle frame. Confirm the GIF has the requested frame count.

5. Return the GIF path, frame directory, sprite sheet path, and preview strip path. Render the GIF inline when the client supports local image display.

## Rules

- Keep identity preservation more important than dramatic expression.
- Prefer 5 frames for smooth laughing; use 3 frames when the user asks for a very small GIF.
- Preserve glasses, hairline, ears, face shape, and skin tone unless the user explicitly asks for stylization.
- Keep the head-only boundary natural. A tiny neck base is acceptable if it makes the cutout believable.
- Do not include the original body, hoodie, shoulders, arms, room, wall, or other background.
- Do not erase internal white details such as teeth or eye highlights when removing the background. Remove only border-connected background.
- Keep the original reference image untouched.
- Keep generated source images and intermediate frames unless the user asks to clean them up.
- If ImageGen produces white background instead of alpha, use the script's `--remove-border-white`; do not globally remove every white pixel.
