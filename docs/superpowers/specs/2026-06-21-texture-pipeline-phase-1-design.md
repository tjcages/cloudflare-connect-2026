# Texture pipeline rework — Phase 1 design

Date: 2026-06-21

## Why

Today the renderer is a single `Sprite` with at most one `Filter` (the stripe duotone
filter). Everything — luminance adjustments, flames, reveal, cursor-trail/push,
click-wave, sparkle, width-shuffle — is entangled inside that one stripe shader, and
per-cell band data is sampled on the CPU. Consequences:

- Disabling stripes (`resolveStripeSpriteFilters` returns `null`) drops the entire
  filter, so reveal and every effect die with it. "Stripes off" should only turn off
  stripes.
- The same work is duplicated across three places: a CPU preview bake
  (`renderAdjustedPreviewPixels`), an unused-in-chain GPU `sourceTextureFilter`, and the
  stripe shader. Adjustments and flames each live in ~3 spots.
- There is no way to inspect intermediate state — debugging is guesswork.

## Target architecture (the whole rework, for context)

One explicit **GPU texture-pass chain**, each stage transforming a texture:

```
source(image/video)
  → [adjustments]      per-pixel tone-mapping/blur
  → [reveal]           per-pixel: assembles the image by the per-cell timing field
  → [flames]           per-pixel light
  → [cursor / click]   per-pixel paint + displacement
  = PROCESSED TEXTURE  ← shown when stripes are OFF
  → [stripe post-process]  GPU downsample → per-cell luma → bands → bars (+ sparkle, width-shuffle)
  + glow overlay        (assembly motes) composited on top
```

Stripes become a pure post-process of the processed texture; nothing upstream knows
stripes exist. Approved decisions: execute **phase by phase, verifying each**, and derive
per-cell luma on the **GPU** (a downsample pass) so the stripe pass is a true
post-process.

**Phase roadmap** (each its own spec → plan → ship):

1. **Phase 1 (this spec):** stand up the GPU pass chain + the adjustments pass + the
   "stripes off shows the processed texture" behavior + a debug stage-view. **Band
   derivation stays on the CPU; no effect moves yet.**
2. Phase 2: GPU downsample → GPU band derivation (the pixel-parity-critical change),
   isolated and verified against `computeBlockGrid`.
3. Phase 3: reveal becomes its own texture pass; the assembly glow gets the visible
   colored/blended treatment. (Reveal decoupling + "assembly looks right" lands here.)
4. Phase 4: consolidate adjustments + flames into the single texture pass; delete the
   CPU bake / dual-flames / duplicate adjustment code.
5. Phase 5: cursor-trail / click-wave → texture-space passes (the delicate push; measured
   against recordings).
6. Phase 6: colors-mode on GPU, re-point letters/export off the CPU grid, prune.

## Phase 1 goal

Establish the first render-to-texture chain and make it debuggable, **without changing
how stripes or any effect are computed**:

- Render `source → [adjustments] → PROCESSED TEXTURE` (a `RenderTexture`) every frame,
  using the already-existing `sourceTextureFilter` (its math already mirrors the CPU
  bake — see [sourceTextureFilter.ts:186](packages/stripes-shader/src/sourceTextureFilter.ts:186)).
- **Stripes OFF** → display the PROCESSED TEXTURE (replaces the CPU preview bake at
  [setupTextureShaderScene.ts:511](packages/stripes-shader/src/setupTextureShaderScene.ts:511)
  and the overlay-mode bake).
- **Stripes ON** → unchanged stripe output; the stripe filter still reads the CPU block
  map exactly as today. The only behavioral change is that overlay-mode's underlay now
  samples the GPU PROCESSED TEXTURE instead of the CPU bake (they must match).
- A **debug stage-view** selector renders an intermediate texture straight to screen.

## Non-goals (Phase 1)

- No GPU downsample, no GPU band derivation (Phase 2). The stripe shader is unchanged.
- No moving reveal/flames/cursor/click out of the stripe shader (Phases 3–5).
- No colors-mode changes; the CPU `LumaGrid`/`uCellColorMap` path stays as-is.
- The CPU block grid stays and keeps feeding the stripe bands, the letters layer, SVG
  export, and the assembly glow. No re-pointing of those (Phase 6).

## Architecture (Phase 1)

Restructure the single on-stage sprite into a **source sprite (offscreen) → processed
render target → display sprite (on stage)** pipeline.

```
sourceSprite (texture = source frame, filters = [sourceTextureFilter])
    │   rendered offscreen each tick:  renderer.render({ container: sourceSprite, target: processedRT })
    ▼
processedRT (RenderTexture, display-sized)
    │   becomes the display sprite's texture
    ▼
displaySprite (texture = processedRT)  ── on app.stage
    filters = [stripeFilter]  when stripes ON   (stripeFilter.uTexture = processedRT → overlay underlay = processed image)
    filters = null            when stripes OFF  (shows the processed image directly)
```

Because the stripe shader computes bands from `uBlockMap` (the CPU block grid), **not**
from its input texture, swapping the display sprite's input from the raw source to
`processedRT` changes only the overlay-mode underlay — the stripe bars are byte-identical.

### Components

1. **Processed render target** — a `RenderTexture` sized to `display.width × display.height`
   (× resolution as the rest of the scene uses). Created at scene setup, resized when the
   display size changes (alongside `blockGridTexture.resize`), destroyed in teardown. One
   per ticker (image and video paths each construct their scene).

2. **Source sprite (offscreen).** The existing per-source sprite becomes the _source_
   sprite: `texture = source frame`, `filters = [sourceTextureFilter]`. It is **not** added
   to `app.stage`; it is rendered into `processedRT` each tick. Its layout/transform logic
   (`syncSpriteToDisplay`, the image `load` relayout) is preserved.

3. **Display sprite (on stage).** A new `Sprite` whose `texture = processedRT`, added to
   `app.stage` in place of today's sprite. Sized to the display. Its `filters` are set per
   the mode/stage matrix below. The letter layer and assembly glow overlay remain stage
   children layered above it (unchanged z-order: display sprite → letters → glow).

4. **Per-tick offscreen render.** Inside the ticker callback, after the source frame and
   `sourceTextureFilter` uniforms are updated, render the source sprite into `processedRT`
   via `app.renderer.render({ container: sourceSprite, target: processedRT, clear: true })`.
   This runs before Pixi's automatic stage render, so the display sprite samples the
   fresh `processedRT`.

5. **Display mode / stage-view matrix.** A `debugStage` value drives what the display
   sprite shows:

   | debugStage             | display sprite texture | display sprite filters | letters/glow |
   | ---------------------- | ---------------------- | ---------------------- | ------------ |
   | `normal` + stripes ON  | processedRT            | `[stripeFilter]`       | visible      |
   | `normal` + stripes OFF | processedRT            | `null`                 | visible      |
   | `source`               | raw source frame       | `null`                 | hidden       |
   | `processed`            | processedRT            | `null`                 | hidden       |

   `normal` reproduces today's behavior except "stripes off" now shows the GPU processed
   texture. `source`/`processed` are inspection views that hide the overlays so the
   inspected texture is unobstructed. (Later phases append stages: `cell-luma`,
   `revealed`, etc.)

6. **Stripe filter underlay wiring.** When stripes are on, set the stripe filter's input
   so its overlay-mode underlay (`uTexture`) is the processed texture. Since the display
   sprite's own texture is `processedRT` and Pixi feeds a filter its sprite's rendered
   input, `uTexture` is already the processed texture — no extra wiring, but verify
   overlay mode visually.

7. **Remove the CPU preview/overlay bake.** Delete the `bakeAdjustedPreviewTexture` /
   `renderAdjustedPreviewPixels` usage from the live tick (the preview-mode path and the
   overlay-mode bake). The processed RT now serves both. `renderAdjustedPreviewPixels`
   itself may remain in the module if still referenced by tests; remove its scene call
   sites.

8. **Studio control.** Add a `debugStage` selector (Normal / Source / Processed) to the
   studio Leva schema, plumbed through `StripesSceneConfig` like the other config fields.
   Default `normal`. It is a **studio-only debug affordance**, NOT part of the published
   package config (`StripesShaderConfig` / `public.ts` are untouched). `StripesSceneConfig`
   is the scene's internal per-tick contract, so adding `debugStage` there does not change
   the public surface. Persisted via the studio's normal config flow.

### Data flow per tick (Phase 1)

1. `syncInternalRefs()` (unchanged).
2. Sample the source frame and (re)build the CPU block grid → `blockGridTexture`
   (unchanged — still drives stripe bands, letters, export, glow).
3. Sync `sourceTextureFilter` uniforms (adjustments, flames, luminance, texel size).
4. Render `sourceSprite` (with `sourceTextureFilter`) → `processedRT`.
5. Set `displaySprite.texture` + `.filters` and overlay visibility per the mode/stage
   matrix; sync the stripe filter (block map, palette, reveal, etc.) as today.
6. Pixi renders the stage (display sprite [+ letters + glow]).

## What stays untouched

- The CPU `computeBlockGrid` / `blockGridTexture` path and everything it feeds (stripe
  bands via `uBlockMap`, letters, SVG export, assembly glow).
- The stripe fragment shader (reveal, flames, cursor/click, sparkle, width-shuffle all
  exactly as today).
- Colors mode (`uCellColorMap`, coverage) and the cursor-trail colors-mode tint.
- Temporal smoothing/throttle on the CPU grid.

## Edge cases

- **Resize:** recreate/resize `processedRT` when `display` dimensions change, in the same
  place `blockGridTexture.resize` runs; re-layout both sprites.
- **Video vs image:** identical structure; the video path samples on `currentTime` change
  and throttles grid rebuilds — the offscreen render to `processedRT` still runs every
  tick so the displayed image stays smooth.
- **Blur padding:** `sourceTextureFilter` expands its region for blur
  (`previewBlurPadding`); ensure the offscreen render preserves edge pixels (render at
  display size; verify no edge clipping with blur > 0).
- **Overlay luminance mode:** the underlay must equal the old CPU bake — primary
  verification target.
- **Teardown:** destroy `processedRT` and the source sprite alongside the existing
  overlay/`destroy()` cleanup.

## Testing & verification

Rendering is not unit-testable, so Phase 1 relies on the project's recording-diff method
plus the automated gates:

- **Automated gates (must pass):** `pir typecheck`, `pir test` (existing suite stays
  green — no behavioral test should change), `pir verify` (studio client build).
- **Recording diffs (the project's standard — "measure recordings, not guesses"):**
  capture current-build vs Phase-1-build recordings and ffmpeg frame-diff for:
  1. static image, stripes ON, **luminance** mode — diff must be ~0 (bands unchanged).
  2. static image, stripes ON, **overlay** mode — diff ~0 (processed underlay == old bake).
  3. **stripes OFF** — shows the processed image; compare against the old CPU-baked
     preview (should match within tone-map rounding).
  4. a **video** clip, stripes ON — no new shimmer/regression.
- **Stage-view smoke:** `source` shows the raw frame; `processed` shows the adjusted
  image with overlays hidden.

The GPU adjustments (`sourceTextureFilter`) vs CPU adjustments
(`applyTextureLuminanceAdjustments`) equivalence is the crux of items 2–3; if they
diverge, reconcile the shader to the CPU math (the CPU function is the ground truth and is
unit-tested).

## File touch list

`packages/stripes-shader/src/setupTextureShaderScene.ts` — the source/display sprite
split, `processedRT` lifecycle, per-tick offscreen render, the mode/stage matrix, removal
of the CPU bake call sites, `debugStage` in `StripesSceneConfig`.
`packages/stripes-shader/src/sourceTextureFilter.ts` — likely no change (already complete);
verify uniforms cover everything the bake did.
`apps/studio/src/playground/*` — `debugStage` Leva control + plumbing through the studio's
`getConfig`.
`packages/stripes-shader/src/public.ts` / `StripesShaderConfig.ts` — **untouched**
(`debugStage` is studio-only; it rides `StripesSceneConfig`, the internal per-tick
contract, not the public package config).

## Risks

- **R1 — GPU vs CPU adjustment parity (overlay underlay + stripes-off image).** Mitigation:
  the shader already mirrors the CPU math; verify with recording diff #2/#3 and reconcile
  to the CPU ground truth if needed.
- **R2 — First render-to-texture in the codebase.** New `RenderTexture` lifecycle (create/
  resize/destroy) and an explicit `renderer.render(target)` per tick. Mitigation: small,
  well-scoped; modeled on standard Pixi v8 render-to-texture.
- **R3 — Two scene constructors (image + video) duplicate the wiring.** Mitigation: factor
  the RT + sprite-split setup into a shared helper used by both (the plan specifies it).
