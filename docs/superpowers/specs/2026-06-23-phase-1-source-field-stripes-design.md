# Phase 1 — Source → field → stripes (luminance + overlay) — design

**Date:** 2026-06-23
**Status:** Design pending user review → plan.
**Builds on:** `docs/superpowers/specs/2026-06-22-gpu-engine-rewrite-design.md` (north star) and Phase 0 foundations (`docs/superpowers/plans/2026-06-23-phase-0-foundations.md`, landed `c886649..5e73f30`).

Phase 1 turns the Phase-0 placeholder into a real engine: upload an image/video, derive the
black/white render field from it (adjustments + luminance, with overlay invert), and draw the
duotone stripe grid on top — for the **luminance** and **overlay** modes. Effects, letters,
colors-mode, and export are later phases.

---

## Goal & scope

**In:** image/video source upload (GPU texture), source transform (fit/zoom/pan), the texture
adjustment chain → grayscale render field, overlay mode (`1−luma`), background, grid geometry
(cell size / gap / corner radius / orientation), the band LUT + palette, the terminal stripe
pass (rounded-box SDF bars), the fresh engine config + a deprecatable legacy-config migration,
and a Leva-driven lab harness with per-feature visual goldens.

**Out (later phases):** reveal/assembly (2), sparkle (3), flames (4), edge mask (5), cursor (6),
letters (7), colors mode (8), SVG/video export + studio cutover (9).

**Acceptance:** stripes-off shows a correct b/w field for real images + video; luminance + overlay
stripes look right (your visual sign-off → committed goldens); **4K@60 perf gate holds**.

---

## Decisions (locked)

| Decision           | Choice                                                                                                                                                                                                          |
| ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Config             | **Fresh canonical engine config** (clean names, Phase-1 subset)                                                                                                                                                 |
| Legacy compat      | A **quarantined, deprecatable `legacy/` module**: silent localStorage migration on load + import-paste accepts old `StripesShaderConfig` JSON; self-contained for one-shot deletion later                       |
| Architecture       | **Pass-pipeline refactor first** — replace the inline `field→present` with an ordered pass list + a managed RT/ping-pong pool (the final review's recommendation), before more passes harden the inline pattern |
| Orientation        | **Y-flip pinned:** upload sources with `UNPACK_FLIP_Y_WEBGL` so field, screen, and future export readback share one top-down convention                                                                         |
| Adjustment order   | composite-over-bg → blur/sharpen → levels (black/white point) → gamma → exposure → contrast → brightness/threshold → invert → posterize → noise → rec709 luma → overlay-invert                                  |
| Band LUT + palette | built CPU-side from the stripe list into **raw byte-buffer textures** (not canvases — P3 data-texture rule), uploaded only on config change                                                                     |
| Lab controls       | **Leva** added to `apps/lab` + a **baked-in deterministic test image** so goldens need no external files                                                                                                        |
| Sub-split          | **1a** (source→field, b/w field visible) → checkpoint → **1b** (downsample + stripes)                                                                                                                           |

---

## Fresh engine config (Phase-1 subset)

Canonical, clean. Numeric `0xRRGGBB` colors; the lab converts to/from hex for Leva.

```ts
type Fit = "stretch" | "contain" | "cover";
type FieldMode = "luminance" | "overlay"; // "colors" arrives in Phase 8

type Stripe = { color: number; startFrom: number; width: number }; // startFrom 0..1, width px

type EngineConfig = {
  transform: { fit: Fit; zoom: number; panX: number; panY: number };
  adjustments: {
    brightness: number;
    exposure: number;
    contrast: number;
    blackPoint: number;
    whitePoint: number;
    gamma: number;
    invert: boolean;
    posterizeLevels: number;
    thresholdBias: number;
    noiseAmount: number;
    blurRadius: number;
    sharpenAmount: number;
  };
  field: { mode: FieldMode };
  background: { color: number }; // 0xRRGGBB
  grid: {
    cellWidth: number;
    cellHeight: number;
    gapX: number;
    gapY: number;
    cornerRadius: number;
    orientation: "vertical" | "horizontal";
  };
  stripes: Stripe[];
  overlayStripes: Stripe[];
  stripesEnabled: boolean; // false => show the field
};
```

Each sub-config gets a `normalize*`/`DEFAULT_*` (pure, unit-tested) — same discipline as Phase 0's
`resolution`/`rng`. The `source` (media element) is passed to the engine separately, not in config.

### Deprecatable legacy migration (`packages/stripes-engine/src/legacy/`)

A self-contained, clearly-marked-deprecated module — deletable in one `rm` later:

- `migrateLegacyConfig(old: unknown): Partial<EngineConfig>` — maps the old `StripesShaderConfig`
  shape (`textureAdjustments` → `adjustments`, `sourceTransform` → `transform`,
  `textureLuminanceMode` → `field.mode` with `colors` → `luminance` until Phase 8, `grid.{cellWidth…}`
  → `grid`, `stripes`/`overlayStripes` hex → numeric) onto the fresh config. Unsupported old fields
  (reveal/flames/cursor/letters/…) are ignored gracefully; coverage grows as later phases land.
- The lab uses it: on load, read the new key first; if absent, read the old
  `section-grid-playground` localStorage key, migrate **silently** (no prompt), and persist forward
  under the new key. The import-paste path tries fresh-format, then falls back to migration when the
  JSON looks legacy (`textureAdjustments`/`sourceTransform` present).
- Header comment on every file: `@deprecated legacy-config shim — delete once old configs are gone`.

---

## Architecture — pass pipeline + Phase-1 pass graph

**First, the refactor.** Replace `engine.ts`'s hardcoded `field→present` with:

- a small **pass-pipeline** abstraction: an ordered list of passes, each `{ name, render(ctx) }`,
  timed by the gpuTimer, where `ctx` exposes the input texture(s), the target RT, and uniforms;
- a **managed RT pool** (allocate/resize/reuse field-res + cell-res + full-res targets; ping-pong
  available) so passes don't each own fixed targets.

Then the Phase-1 graph (every box a WebGL2 FBO pass; no CPU pixel reads):

```
source texture (image once / video per-frame, UNPACK_FLIP_Y)
  │
  ▼  PASS A  source → FIELD            [fieldScale res]
  │           transform (fit/zoom/pan) + adjustment chain + rec709 luma + overlay-invert
  │           → grayscale RT (white = draw)                  ← shown when stripes OFF (present)
  │
  ▼  PASS C  field → fieldCellRT       [cols×rows]  box-average per cell
  │
  ▼  PASS D  STRIPE (terminal)   [full DPR]
  │           per cell: sample fieldCellRT → band via 256-LUT → palette color
  │           → rounded-box SDF bar (cell size / gap / corner / orientation)
  │           over the background color
  │
  ▼  canvas (display-p3)
```

When `stripesEnabled` is false, PASS D is replaced by the present pass (field → canvas), so
turning stripes off shows the b/w field — the field-first invariant.

**Source handling:** images upload once on load; video re-uploads each frame (`texImage2D` from the
`<video>`). The transform (fit/zoom/pan) is computed into the source→field sampling (UVs), not a
separate blit. Y-flip via `UNPACK_FLIP_Y_WEBGL`.

**Band LUT + palette:** from the active stripe list (luminance vs overlay per mode), build a
256-entry index LUT (field value 0–255 → band index) + a palette texture (band index → color),
both raw `Uint8Array` textures, rebuilt only when the stripe list/mode changes.

---

## Module structure (additions)

```
packages/stripes-engine/src/
  config/            EngineConfig type + per-sub-config normalize/DEFAULT (pure, tested)
  legacy/            @deprecated migrateLegacyConfig + old-shape types (isolated, deletable)
  source/            media load + GPU upload (image once / video per-frame, Y-flip)
  pipeline/          pass-pipeline abstraction + RT pool (the refactor)
  passes/            sourceFieldPass (replaces fieldPass), downsamplePass, stripePass (+ present)
  field/             band LUT + palette builders (raw-buffer textures)
  shaders/           sourceField.frag, downsample.frag, stripe.frag (ES 3.00)
apps/lab/src/
  controls/          Leva schema for transform/adjustments/field/background/grid/stripes
  testImage.ts       baked deterministic source for goldens
  persistence.ts     new-key save/load + silent legacy migrate-on-load + import-paste
```

---

## Testing

- **Pure logic (Vitest, TDD):** every `normalize*`/`DEFAULT_*`, `migrateLegacyConfig` (old→new
  mapping + graceful drop of unsupported fields), band-LUT construction (stripe list → 256 indices),
  transform UV math.
- **Visual goldens (Playwright, fixed seed/clock/dpr + the baked test image):** the b/w field
  (luminance + overlay), then stripes (luminance + overlay), plus a couple of adjustment extremes
  (high contrast, posterize). Captured once you sign off the look.
- **Perf gate:** the existing 4K@60 gate must stay green with the real source→field→downsample→stripe
  chain (field at 0.5×, stripe at full DPR — the scaling design).

---

## Non-goals

- No reveal/sparkle/flames/edge-mask/cursor/letters/colors/export (later phases).
- No studio integration yet — `apps/lab` is the only consumer until the Phase 9 cutover.
- The legacy migration covers only Phase-1 fields now; it grows per phase and is deleted at/after cutover.

```

```
