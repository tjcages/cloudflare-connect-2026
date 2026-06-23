# Phase 1b revision — real stripes + remove overlay/field

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development. Steps use `- [ ]`.

**Goal:** Fix the stripe rendering to match the real model (luminance picks a band → full-cell-height bar whose WIDTH is the band's configured width and whose COLOR is the band's color; below the lowest threshold draws no stripe), restore the real ascending-width default palette, and remove overlay mode + the `field` config (deferred to a later phase).

**Architecture:** The stripe pass already samples the per-cell field value and a 256-entry LUT. Change (a) the LUT so values below the lowest `startFrom` encode "no stripe" (width 0); (b) the stripe shader so the bar is full cell height × band width (no gap subtraction), skipped when width 0, colored by the band; (c) the default palette to the real ascending-width values. Strip overlay everywhere (config `field`, `overlayStripes`, the source→field overlay-invert, engine selection, lab control, goldens).

**Tech Stack:** TypeScript, WebGL2/ES 3.00, the Phase-1 engine + lab, Vitest, Playwright.

## Global Constraints

- `pir`/`pi` only. WebGL2/ES 3.00. `compileProgram` throws. TS strict. Work on main; don't branch. Husky precommit runs — let it.
- Real `DEFAULT_STRIPES` (numeric 0xRRGGBB, ascending widths): `0xF3F3F3@0.12 w1`, `0xFADA98@0.28 w1`, `0xF8BD70@0.44 w2`, `0xF69E4D@0.6 w3`, `0xF27C33@0.76 w4`, `0xEB5729@0.9 w5`.
- Stripe geometry: height = FULL cell height; width = band width (px), centered, clamped to cell width; cornerRadius + orientation preserved; below lowest threshold (LUT width 0) = no stripe (background shows); color = band color from config.
- Remove overlay: no `field` config, no `overlayStripes`, no overlay-invert in the source→field shader, no field-mode lab control, no overlay goldens. Engine is luminance-only.
- Capture/update goldens with `pir test:e2e:update` or `node_modules/.bin/playwright test --update-snapshots` (pir does NOT forward `--update-snapshots`). Goldens use `?hud=0`.
- Verify: `pir verify` + `pir test:e2e` green.

---

### Task 1: Config — remove field/overlayStripes, real default palette

**Files:** Modify `packages/stripes-engine/src/config/types.ts`, `config/normalize.ts`; update `config/normalize.test.ts`, `config/serialize.test.ts` as needed.

**Changes:**

- `types.ts`: delete `FieldMode`, the `field: { mode: FieldMode }` member, and the `overlayStripes: Stripe[]` member from `EngineConfig`. (Keep `Stripe`, `grid`, `stripes`, `background`, `stripesEnabled`, `transform`, `adjustments`.)
- `normalize.ts`: delete `DEFAULT_FIELD`/`normalizeField`, `DEFAULT_OVERLAY_STRIPES`; in `DEFAULT_ENGINE_CONFIG` drop `field` + `overlayStripes`; in `normalizeEngineConfig` drop `field` + `overlayStripes`. Replace `DEFAULT_STRIPES` with the real ascending-width palette:

```ts
export const DEFAULT_STRIPES: Stripe[] = [
  { color: 0xf3f3f3, startFrom: 0.12, width: 1 },
  { color: 0xfada98, startFrom: 0.28, width: 1 },
  { color: 0xf8bd70, startFrom: 0.44, width: 2 },
  { color: 0xf69e4d, startFrom: 0.6, width: 3 },
  { color: 0xf27c33, startFrom: 0.76, width: 4 },
  { color: 0xeb5729, startFrom: 0.9, width: 5 },
];
```

- Update tests: remove `normalizeField`/overlay assertions; update any `DEFAULT_STRIPES` expectations to the new values; ensure `normalizeEngineConfig({})` equals the new `DEFAULT_ENGINE_CONFIG` (no field/overlayStripes).

- [ ] **Step 1:** Edit `types.ts` (drop FieldMode/field/overlayStripes).
- [ ] **Step 2:** Edit `normalize.ts` (drop field/overlay normalizers + defaults; new DEFAULT_STRIPES; update DEFAULT_ENGINE_CONFIG + normalizeEngineConfig).
- [ ] **Step 3:** Update `normalize.test.ts` + `serialize.test.ts` (remove field/overlay cases; new stripe defaults). Run `pir test -- run config/` → PASS.
- [ ] **Step 4:** Commit `feat(engine): real default stripe palette; remove field/overlay config`.

---

### Task 2: Stripe LUT — below-lowest-threshold = no stripe

**Files:** Modify `packages/stripes-engine/src/field/stripeLut.ts`; update `field/stripeLut.test.ts`.

**Change:** In `buildStripeLut`, a value below the lowest `startFrom` must encode "no stripe" (width byte 0). Sort a copy ascending, then for each value pick the greatest band with `startFrom ≤ t`; if NONE qualifies, write `[0,0,0,0]` (width 0 = no stripe). Otherwise the band's color + width.

```ts
export function buildStripeLut(stripes: Stripe[]): Uint8Array {
  const lut = new Uint8Array(256 * 4);
  if (stripes.length === 0) return lut;
  const sorted = [...stripes].sort((a, b) => a.startFrom - b.startFrom);
  for (let v = 0; v < 256; v++) {
    const t = v / 255;
    let band = -1;
    for (let i = 0; i < sorted.length; i++) if (sorted[i].startFrom <= t) band = i;
    const o = v * 4;
    if (band < 0) {
      lut[o] = lut[o + 1] = lut[o + 2] = lut[o + 3] = 0;
      continue;
    } // no stripe
    const s = sorted[band];
    lut[o] = (s.color >> 16) & 255;
    lut[o + 1] = (s.color >> 8) & 255;
    lut[o + 2] = s.color & 255;
    lut[o + 3] = Math.max(0, Math.min(255, Math.round(s.width)));
  }
  return lut;
}
```

- [ ] **Step 1:** Add a failing test: a value below the lowest startFrom → `[0,0,0,0]` (no stripe); a value above → the band color+width. (Use stripes with lowest startFrom 0.2; assert v=0 → all zero; v=255 → top band.)
- [ ] **Step 2:** Run `pir test -- run field/stripeLut` → FAIL.
- [ ] **Step 3:** Implement the above. Run → PASS (update the existing tests if their lowest startFrom was 0.0 — with a 0.0 lowest band, v=0 still qualifies, so keep one test with a >0 lowest to cover the no-stripe path).
- [ ] **Step 4:** Commit `feat(engine): stripe LUT encodes no-stripe below the lowest threshold`.

---

### Task 3: Shaders + engine — real stripe geometry, drop overlay

**Files:** Modify `packages/stripes-engine/src/shaders/sourceField.frag.ts`, `shaders/stripe.frag.ts`, `passes/sourceFieldPass.ts`, `engine.ts`.

**Changes:**

- `sourceField.frag.ts`: remove `uniform float uOverlay;` and the `if (uOverlay > 0.5) luma = 1.0 - luma;` line (always luminance).
- `sourceFieldPass.ts`: remove the `overlay` field from `SourceFieldUniforms`, the `uOverlay` location, and its upload.
- `stripe.frag.ts`: change the geometry so the bar is FULL cell height × band width, skipped when width 0:

```glsl
  vec4 lut = texture(uLut, vec2((v * 255.0 + 0.5) / 256.0, 0.5));
  vec3 barColor = lut.rgb;
  float barWidthPx = lut.a * 255.0;
  if (barWidthPx < 0.5) { finalColor = vec4(uBg, 1.0); return; } // no stripe → background
  vec2 p = (local - 0.5) * uCellPx;
  vec2 halfExt;
  if (uOrient < 0.5) {
    halfExt = vec2(min(barWidthPx, uCellPx.x) * 0.5, uCellPx.y * 0.5);   // width=band, height=full cell
  } else {
    halfExt = vec2(uCellPx.x * 0.5, min(barWidthPx, uCellPx.y) * 0.5);
  }
  float r = min(uCorner, min(halfExt.x, halfExt.y));
  float d = sdRoundBox(p, halfExt, r);
  float w = max(fwidth(d), 1e-4);
  float alpha = clamp(0.5 - d / w, 0.0, 1.0);
  finalColor = vec4(mix(uBg, barColor, alpha), 1.0);
```

(Remove the `uGapPx` use from the bar extents — height is full cell, width is band width. Keep `uGapPx` uniform declared if the pass still uploads it, OR remove it too; simplest: remove `uGapPx` from the shader + pass + engine call. Keep `uCorner`/`uOrient`/`uBg`.)

- `stripe.frag.ts` + `passes/stripePass.ts`: remove `uGapPx`/`gapX`/`gapY` from the shader, the `StripeUniforms` type, and the upload (gap is not used by the real stripe geometry; the grid config keeps gapX/gapY but the stripe pass ignores them for now). NOTE: keep `grid.gapX/gapY` in the CONFIG (don't remove config fields) — only the stripe SHADER stops consuming them.
- `engine.ts`: in `ensureLut()` use `config.stripes` ALWAYS (remove the `mode === "overlay" ? overlayStripes : stripes` selection). Remove the `overlay:` field from the source-field pass uniforms. Remove the `gapX/gapY` fields from the stripe pass uniforms object. Remove any `config.field` reference.

- [ ] **Step 1:** Edit the source→field shader + pass (drop overlay).
- [ ] **Step 2:** Edit the stripe shader + pass (full height × band width, no-stripe when width 0, drop gap).
- [ ] **Step 3:** Edit the engine (always config.stripes, drop overlay/field/gap-uniform).
- [ ] **Step 4:** `pir --filter @necatikcl/stripes-engine typecheck` → PASS. Commit `feat(engine): real stripe geometry (band width × full cell height, no-stripe below threshold); drop overlay`.

---

### Task 4: Lab — remove field-mode control

**Files:** Modify `apps/lab/src/controls/levaSchema.ts` (and `LabApp.tsx` if it references `field`).

**Change:** Remove the field-mode (luminance/overlay) Leva control and the `field: { mode }` from the returned config. Keep grid + stripesEnabled + the rest. `normalizeEngineConfig` no longer has `field`, so the returned object must not include it.

- [ ] **Step 1:** Remove the field-mode control + `field` from the returned config in `levaSchema.ts`. Grep `apps/lab/src` for `field:` / `mode` / `overlay` and clean any references.
- [ ] **Step 2:** `pir --filter lab build` → success. Commit `feat(lab): remove field-mode control (luminance-only)`.

---

### Task 5: Legacy migration — drop field.mode + overlayStripes

**Files:** Modify `packages/stripes-engine/src/legacy/migrateLegacyConfig.ts`; update `legacy/migrateLegacyConfig.test.ts`.

**Change:** Remove the `textureLuminanceMode → field.mode` mapping and the `overlayStripes` mapping (those fields no longer exist on `EngineConfig`). Keep adjustments/transform/grid/background/stripes/stripesEnabled. Update the test (remove the colors→luminance / overlay assertions; keep the rest).

- [ ] **Step 1:** Edit `migrateLegacyConfig.ts` (drop field.mode + overlayStripes). Update the test.
- [ ] **Step 2:** `pir test -- run legacy/` → PASS. Commit `feat(engine): legacy migration drops field-mode/overlayStripes (deferred)`.

---

### Task 6: Goldens — luminance-only, re-capture real stripes

**Files:** Modify `tests/visual.spec.ts`; delete the overlay golden PNGs.

**Changes:**

- Remove the two overlay tests (`field — overlay`, `stripes — overlay`) and their `bootStripes`/`boot` overlay calls; the `boot`/`bootStripes` helpers no longer set `field.mode` (just `stripesEnabled`). Keep `field — luminance` and `stripes — luminance` (drop the `field: { mode }` from their setConfig — engine is luminance-only).
- Delete `tests/visual.spec.ts-snapshots/field-overlay-darwin.png` + `stripes-overlay-darwin.png`.

- [ ] **Step 1:** Edit `tests/visual.spec.ts` (luminance-only; remove `field:{mode}` from setConfig calls; keep `stripesEnabled`).
- [ ] **Step 2:** Re-capture: `pir test:e2e:update` (or the direct binary). Then `pir test:e2e` → all (now 2) goldens match + perf passes.
- [ ] **Step 3:** INSPECT the new `stripes-luminance` PNG: it must show real stripes — vertical bars whose WIDTH grows with brightness (narrow ~1px in dim areas, wide ~5px + orange in the brightest), full cell height, and NO stripe (background) in the darkest areas (below 0.12). If it still looks like uniform rects, STOP and report (the model is still wrong).
- [ ] **Step 4:** `git rm` the two overlay goldens; `pir verify` → PASS. Commit `test(engine): luminance-only goldens; recapture real stripes`.

---

## Self-Review

- Real stripe model (width=band, full height, no-stripe-below-threshold, config color) → Tasks 2,3 ✓
- Real ascending-width default palette → Task 1 ✓
- Remove overlay + field config (config, shader, engine, lab, migration, goldens) → Tasks 1,3,4,5,6 ✓
- Goldens re-captured + visually verified → Task 6 ✓
- No placeholders; types consistent (`EngineConfig` loses `field`/`overlayStripes`; `SourceFieldUniforms` loses `overlay`; `StripeUniforms` loses `gapX/gapY`). Each task typecheck/test-gated; Task 6 is the visual gate.
