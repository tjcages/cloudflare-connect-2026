# Stripes Downsample the Field (Phase 2) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Make the stripe pass derive its per-cell band by GPU-downsampling the render field (`processedRT`) instead of reading the CPU block grid, for **luminance + overlay** modes — so stripes become a true pure post-process of the field (field-first / R4). Reveal, flames, and cursor already live in the field, so the stripe shader stops re-computing them in these modes.

**Architecture:** A new GPU pass box-averages `processedRT` (the final field) into a `cols×rows` RenderTexture (`fieldCellRT`). The stripe fragment shader, in the luminance/overlay branch, samples `fieldCellRT` per cell → `stripeBandForBucketLuma(fieldValue)` → bars (+ sparkle + width-shuffle). The colors-mode branch is untouched (keeps reading `uBlockMap` and the in-shader effects — deferred to Phase 5). The CPU block grid is still built (SVG export, letters, colors), it just no longer feeds the luminance/overlay **render**.

**Tech Stack:** PixiJS v8 (RenderTexture, GlProgram/Filter or Mesh+Shader, `app.renderer.render`), GLSL ES 1.00, TypeScript, Vitest. Run via `pir`.

## Global Constraints

- **WebGL1 / GLSL ES 1.00 (R6).** No integer `abs`/`min`/`max`/`mod`; cast ints to float first (`abs(float(x))`). Constant-bound loops only. A failed compile renders nothing (silent white screen) — after any shader edit, check the browser console for `Could not initialize shader` / `no matching overloaded function`.
- **Field-first (R1–R4).** The field is the single source of truth; the stripe pass may only render bars + sparkle + width-shuffle. Do not add effect logic to the stripe pass.
- **GPU-first (R7).** The downsample is a GPU pass; no per-frame CPU pixel loops added.
- **Scope = luminance + overlay only.** Do NOT change colors-mode (`uUseCellColors > 0.5`) behavior. Do NOT delete the in-shader reveal/flames/cursor GLSL (colors still uses it). Do NOT remove or stop building the CPU block grid (export/letters/colors still need it).
- **Field value is already bucketing-space.** `sourceTextureFilter` already applied overlay inversion (`1 - luma`). Map the field value through `uStripeIndexLut` directly (`stripeBandForBucketLuma`); do NOT re-apply `uInvertStripeBucketing`/`bucketingLuma()` to it.
- Package manager: `pi` / `pir` only (never npm/pnpm/npx). Studio dev server is the user's, at http://localhost:5173 — do not spawn a competitor.
- Verify visual changes in-browser (the controller does this between tasks); the existing Vitest suite (`pir test`) must stay green and `pir typecheck` must pass.

---

### Task 1: GPU field-downsample pass → `fieldCellRT`

**Files:**

- Create: `packages/stripes-shader/src/fieldDownsampleFilter.ts` (the box-average shader + a small helper to render `processedRT` → `fieldCellRT`)
- Modify: `packages/stripes-shader/src/setupTextureShaderScene.ts` (own a `fieldCellRT` RenderTexture sized to the grid; (re)create it on grid resize; render the downsample each tick right after `renderProcessed()`)
- Test: `packages/stripes-shader/src/fieldDownsampleFilter.test.ts` (a pure-TS test of the cell-UV / tap-offset math extracted as a helper, since GLSL itself is not unit-testable)

**Interfaces:**

- Produces: `createFieldDownsample()` returning `{ render(renderer, fieldTexture, target, cols, rows): void }` (or equivalent) — box-averages `fieldTexture` into `target` (a `cols×rows` RenderTexture, R = mean field, origin matching `processedRT` so cell `(0,0)` is top-left like `flameCellUv`). Also export the `fieldCellRT` (RenderTexture) from the scene wiring for Task 2.
- The box average uses a constant tap grid (e.g. 6×6) positioned within each cell footprint in field UV; WebGL1-safe.

- [ ] **Step 1: Write the failing test** for the tap-offset helper (e.g. `cellTapUv(col,row,tapX,tapY,cols,rows,taps)` returns UVs inside cell `(col,row)`; the mean of taps for a uniform field returns that field value). Assert tap UVs land within `[col/cols,(col+1)/cols]×[row/rows,(row+1)/rows]`.
- [ ] **Step 2: Run it, verify it fails** — `pir test -- packages/stripes-shader/src/fieldDownsampleFilter.test.ts`.
- [ ] **Step 3: Implement** `fieldDownsampleFilter.ts`: the box-average GLSL (sample N×N taps per output texel from `uField`, average the `.r`), the tap helper, and `createFieldDownsample()`. Reuse `STRIPE_FILTER_VERTEX` if convenient. Make it WebGL1-safe.
- [ ] **Step 4: Wire into the scene**: create `fieldCellRT = RenderTexture.create({ width: cols, height: rows, resolution: 1 })`; recreate it wherever the grid is resized (`applyStructuralChanges` / `blockGridTexture.resize`); after `renderProcessed()` in BOTH ticker paths, render the downsample into `fieldCellRT`. Do not yet read it anywhere.
- [ ] **Step 5: Run tests + typecheck** — `pir test -- packages/stripes-shader` and `pir typecheck`. Expected: PASS.
- [ ] **Step 6: Commit** — `feat(pipeline): GPU box-average downsample of the field to a per-cell texture (R7)`.

**Controller verification (in-browser, before Task 2):** temporarily bind the debug/Field display to `fieldCellRT` (or sample it) and confirm it shows a sensible coarse black/white field (white content, black background) that tracks reveal/flames/cursor. Revert the temporary binding.

---

### Task 2: Stripe shader derives the band from `fieldCellRT` (luminance + overlay)

**Files:**

- Modify: `packages/stripes-shader/src/stripeFilterShaders.ts` (add `uniform sampler2D uFieldCells;` and a `uFieldBands` toggle uniform; in `main()`, when `uUseCellColors < 0.5` AND `uFieldBands > 0.5`, derive `storedBand` from the field cell value and SKIP the in-shader reveal/flames/cursor application for that branch)
- Modify: `packages/stripes-shader/src/setupTextureShaderScene.ts` (each tick: set `stripeFilter.resources.uFieldCells = fieldCellRT.source`; set `uFieldBands = (luminanceMode !== "colors") ? 1 : 0`)
- Modify (if the stripe filter is constructed in a dedicated factory): wherever `STRIPE_FILTER_FRAGMENT` uniforms/resources are declared, register `uFieldCells` (default `Texture.EMPTY.source`) and `uFieldBands` (default 0).
- Test: extend `fieldDownsampleFilter.test.ts` or a stripe-band helper test asserting `field value → band` mapping intent (document that LUT mapping is unchanged).

**Interfaces:**

- Consumes: `fieldCellRT` from Task 1; the existing `uStripeIndexLut` + `stripeBandForBucketLuma`.
- Band derivation (luminance/overlay): `float fieldVal = texture(uFieldCells, flameCellUv(colIndex,rowIndex)).r; float storedBand = stripeBandForBucketLuma(fieldVal);` — no `bucketingLuma()` re-invert (field is already bucketing-space). Then go straight to bar rendering; `resolveStripeBand` flame promotion, the reveal block, and the cursor trail/push block are bypassed in this branch.

- [ ] **Step 1:** Add the `uFieldCells` sampler + `uFieldBands` toggle to `STRIPE_FILTER_FRAGMENT` and to the filter's uniform/resource declarations (default empty texture / 0). Keep the existing colors-mode path intact.
- [ ] **Step 2:** In `main()`, branch: when `uFieldBands > 0.5` (luminance/overlay), set `storedBand` from `uFieldCells` and skip reveal/flames/cursor; otherwise run the existing path unchanged. Render bars + sparkle + width-shuffle as today. WebGL1-safe.
- [ ] **Step 3:** Wire the scene: bind `uFieldCells` to `fieldCellRT.source` and set `uFieldBands` per mode each tick.
- [ ] **Step 4: Tests + typecheck** — `pir test -- packages/stripes-shader`, `pir typecheck`. Expected: PASS.
- [ ] **Step 5: Commit** — `feat(pipeline): stripes derive bands from the downsampled field for luminance+overlay (R4)`.

**Controller verification (in-browser):**

1. Stripes ON, luminance and overlay, on a representative image (e.g. example 10 bridge): stripes look consistent with the field shown stripes-OFF — turning stripes off/on changes only "bars vs field", not which cells are content.
2. Reveal, flames, and cursor trail/click now drive the stripes THROUGH the field (drag → trail adds stripes; reveal animates; flames promote) — with NO double-application (no doubled/!=field artifacts).
3. Colors mode is visually unchanged from before.
4. No console shader errors.

---

## Verification (whole phase)

- `pir typecheck`, `pir test` green; studio build (`pir verify` if available) green.
- In-browser (controller): the four checks in Task 2 plus the Task 1 field-cell inspection.
- The field shown with stripes off and the stripes shown with stripes on are derived from the SAME texture — that is the acceptance criterion (consistency over byte-parity with the old CPU build).

## Out of scope (deferred)

- Colors-mode band derivation from the field (Phase 5).
- Deleting the in-shader reveal/flames/cursor GLSL and retiring `computeBlockGrid` from the render path (Phase 5; colors still needs them now).
- Skipping the CPU block-grid build for performance when only the render needs it (export/letters still consume it).
