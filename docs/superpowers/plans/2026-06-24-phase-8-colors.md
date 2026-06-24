# Phase 8 — Colors Mode (+ flames color) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "colors" mode where stripes take the SOURCE image's own colors instead of the fixed palette: per-cell presence = color-distance from the (auto-detected) background, the source color tints the bar, and width scales with coverage. Color/coverage ride a GPU **MRT side-channel** from the field stage; the field stays a grayscale presence mask. Also colorize flames (the per-streak vibrant palette deferred from Phase 4).

**Architecture:** A new `colors.mode` (`"luminance" | "colors"`, default luminance). In **colors** mode the source→field pass emits MRT: attachment 0 = presence (grayscale, = `colorDistanceLuminance(srcColor, bg)`), attachment 1 = the source color (rgb) + coverage (a). Reveal/edge-mask/cursor keep operating on the presence field; the color RT is downsampled alongside it; the stripe pass tints the bar by the cell color and scales width by coverage. Background is **auto-detected** (corner/edge sampling) with a **manual override**. Flames, in colors mode, additionally write their vibrant-palette color into the color RT. **CRITICAL INVARIANT:** luminance mode (default) builds the exact current pipeline (no MRT, no color RT) → all 20 goldens byte-unchanged; the colors path is topology-gated on `colors.mode === "colors"`.

**Decisions locked:**

- **Default luminance** (current behavior) — colors is opt-in; existing 20 goldens stay byte-identical.
- **Background: auto-detect + manual override** — auto from source corner/edge sampling; `colors.backgroundColor` overrides when `colors.autoDetectBackground` is off.
- **Scope: stripes + flames color** — colors mode colorizes stripes AND flames (vibrant palette). Letters stay white.
- **MRT color side-channel** consumed only by the stripe pass; field stays grayscale presence (the field-first mandate).
- Presence/coverage in colors mode = `colorDistanceLuminance` (distance from bg), per legacy `colorWhiteness.ts` "colors" mode.

**Tech Stack:** raw WebGL2 / GLSL ES 3.00 (MRT via `gl.drawBuffers`); TypeScript; Vitest; Playwright real-GPU goldens.

## Global Constraints

- pi/pir ONLY; prefix verify/e2e with `npm_config_store_dir="$HOME/Library/pnpm/store/v10"` if needed. WebGL2 `#version 300 es`; MRT needs `layout(location=N) out` + `gl.drawBuffers`; compile must throw on failure.
- Color/index/data textures = raw buffers, never canvas color uploads ([[gpu-data-textures-must-be-raw-buffers]]).
- NO code comments unless asked. Object styles. Work on `main`; commit per task; never push. ([[work-directly-on-main]], [[no-push-offers-show-results]])
- Goldens `?hud=0`, darwin-keyed, `--update-snapshots`, `maxDiffPixelRatio 0.01`.
- **ALL 20 existing goldens MUST stay byte-unchanged** — luminance mode (default) must build the identical current pipeline (no new RTs/passes/MRT). This is the headline invariant; verify after every task.
- Watch the recurring Y-orientation gotcha for any new field-stage output ([[gpu-engine-rewrite-progress]]).

## Reference: legacy → new mapping

| Legacy                                                                                                                | New (engine)                                                            | Notes                       |
| --------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- | --------------------------- |
| `colorWhiteness.ts` (`colorDistanceLuminance`, `pixelSaturation`, modes)                                              | `colors/colorMath.ts`                                                   | presence math + bg-distance |
| `playgroundVibrantColors.ts` (`extractVibrantColors`, synthetic palette)                                              | `colors/vibrantPalette.ts`                                              | flames palette from source  |
| `stripeDuotoneFilter.ts` + `stripeFilterShaders.ts` colors branch (`uUseCellColors`, `uCellColorMap`, coverage→width) | `shaders/stripe.frag.ts` colors branch + `shaders/sourceField.frag` MRT | tint + coverage             |
| `textureLuminanceBackgroundColor` / auto-detect                                                                       | `colors/backgroundDetect.ts` + config                                   | bg color                    |

## File Structure

**New:** `colors/colorMath.ts` (+ test); `colors/vibrantPalette.ts` (+ test); `colors/backgroundDetect.ts` (+ test); `shaders/sourceFieldColor.frag.ts` (MRT colors variant) + `passes/` updates; `tests/colors.spec.ts`.
**Modified:** `config/types.ts`, `config/normalize.ts` (+ test), `legacy/migrateLegacyConfig.ts`, the source→field pass (MRT in colors mode), the downsample pass (downsample color RT), `shaders/stripe.frag.ts` + `passes/stripePass.ts` (colors-mode tint + coverage width), `passes/flamesPass.ts` + flames wiring (per-streak color), `engine.ts` (mode topology, bg detect, color RT, MRT wiring), `apps/lab/src/controls/levaSchema.ts` (Colors folder).

---

### Task 1: Config — `colors` section

**Files:** types.ts, normalize.ts, normalize.test.ts, migrateLegacyConfig.ts
**Produces:** `interface ColorsConfig { mode: "luminance" | "colors"; autoDetectBackground: boolean; backgroundColor: number }`; `DEFAULT_COLORS = { mode: "luminance", autoDetectBackground: true, backgroundColor: 0x000000 }`.

- [ ] **Step 1:** Add `ColorsConfig` + `colors` on `EngineConfig`.
- [ ] **Step 2:** Failing tests: omitted → mode "luminance"; bogus mode → "luminance"; mode "colors" preserved; backgroundColor coerced to 24-bit; autoDetectBackground default true / boolean coercion.
- [ ] **Step 3:** verify FAIL. **Step 4:** `DEFAULT_COLORS` + `normalizeColors` + wire-in + DEFAULT_ENGINE_CONFIG + partial + migrate (map legacy textureLuminanceMode/backgroundColor best-effort or default). **Step 5:** verify PASS. **Step 6:** commit `feat(engine): colors-mode config (default luminance)`.

### Task 2: Pure-TS `colorMath.ts`

**Files:** colors/colorMath.ts (+ test)
**Produces:** `colorDistanceLuminance(r,g,b, bg): number` (0..1, port legacy); `pixelSaturation`, `pixelLuminance` (port); helpers the bg-detect + GLSL mirror need.

- [ ] **Step 1:** Failing tests: `colorDistanceLuminance` 0 at bg, ~1 at max distance, matches legacy values; saturation/luminance ports. **Step 2:** verify FAIL. **Step 3:** port `colorWhiteness.ts` exactly. **Step 4:** verify PASS. **Step 5:** commit `feat(engine): colorMath (distance/saturation/luminance)`.

### Task 3: Background auto-detect `backgroundDetect.ts`

**Files:** colors/backgroundDetect.ts (+ test)
**Produces:** `detectBackgroundColor(pixels, width, height): number` — sample the source's corners/edges (most-common / median of a corner ring) → 0xRRGGBB. Used when `autoDetectBackground` is on; else use `colors.backgroundColor`.

- [ ] **Step 1:** Failing tests: an image with a uniform black border → detects 0x000000; a white border → 0xffffff; deterministic; ignores the center. **Step 2:** verify FAIL. **Step 3:** implement (corner/edge ring sampling + majority/median). **Step 4:** verify PASS. **Step 5:** commit `feat(engine): background auto-detect from source edges`.

### Task 4: Colors field stage — MRT presence + color RT

**Files:** shaders/sourceFieldColor.frag.ts, the source→field pass, the downsample pass, engine.ts

- [ ] **Step 1:** Add a colors-mode source→field fragment with TWO outputs: `layout(location=0) out vec4 oField` = `vec4(vec3(colorDistanceLuminance(src, uBg)), 1)` (presence, with the existing adjustment chain applied to the distance); `layout(location=1) out vec4 oColor` = `vec4(srcColor.rgb, coverage)`. (Coverage = presence or saturation-weighted — match legacy.)
- [ ] **Step 2:** Pass/engine: in colors mode build the field RT with a 2nd color attachment (`pool` gains a 2-attachment "fieldColor" RT or an MRT field RT) + `gl.drawBuffers`; pass `uBg` (from Task 3 / config). Downsample the color RT to a cell-res "cellColor" RT (a colors-mode branch of the downsample). LUMINANCE mode unchanged (single RT, current frag). Topology-gate on `colors.mode`.
- [ ] **Step 3:** `pir verify` → PASS. `pir test:e2e` → 20 UNCHANGED (luminance mode is the identical current path). **Step 4:** commit `feat(engine): colors-mode MRT field (presence + source-color side-channel)`.

### Task 5: Stripe colors-mode tint + coverage→width

**Files:** shaders/stripe.frag.ts, passes/stripePass.ts, engine.ts

- [ ] **Step 1:** stripe.frag: add `uUseCellColors`, `uCellColor` (sampler), and in colors mode set `barColor = cellColor.rgb` (instead of LUT color) and scale `barWidthPx` by coverage (port the legacy coverage→width). Band still from presence (cell field). NO-OP in luminance mode (`uUseCellColors=0` → current LUT path byte-identical).
- [ ] **Step 2:** stripePass + engine: bind the cellColor RT + uUseCellColors when colors mode.
- [ ] **Step 3:** `pir verify` + `pir test:e2e` 20 UNCHANGED. Live-verify a colorful source → stripes take the source colors. **Step 4:** commit `feat(engine): colors-mode stripe tint + coverage width`.

### Task 6: Flames color (vibrant palette)

**Files:** colors/vibrantPalette.ts (+ test), passes/flamesPass.ts, flames wiring, engine.ts

- [ ] **Step 1:** `vibrantPalette.ts`: port `extractVibrantColors` + `createSyntheticVibrantPalette` (CPU, from the source ImageData, one-time per source). **Step 2:** flames: each streak picks a palette color (seeded); the flames pass, IN COLORS MODE, writes the streak color into the color RT (additive) alongside its luminance into the field. In luminance mode flames stay white (current). **Step 3:** `pir verify` + e2e 20 unchanged (flames default off; colors default luminance). Live-verify colored flames in colors mode. **Step 4:** commit `feat(engine): colored flames in colors mode (vibrant palette)`.

### Task 7: Lab controls + goldens

**Files:** apps/lab/src/controls/levaSchema.ts, tests/colors.spec.ts

- [ ] **Step 1:** "Colors" folder: `colorsMode` (select Luminance/Colors); `autoDetectBackground` (bool, render when mode=colors); `backgroundColor` (color, render when mode=colors && !autoDetect). Map into `colors:{...}`.
- [ ] **Step 2:** `tests/colors.spec.ts`: a golden with a COLORFUL test source (or the baked image), `colors:{mode:"colors"}`, stripes on, `renderAt(0)` → `colors-stripes.png`; READ it (stripes tinted by source color). Determinism re-run.
- [ ] **Step 3:** Full `pir test:e2e` → all green (21+); prior 20 unchanged. **Step 4:** commit `feat(lab)+test(engine): Colors controls + golden`.

## Self-Review

- **Coverage:** config (T1), color/bg math (T2/T3), MRT field (T4), stripe tint+coverage (T5), flames color (T6), UI+golden (T7). Default-luminance byte-stable invariant verified at T4/T5/T6/T7. ✓
- **Type consistency:** `ColorsConfig` across types/normalize/engine/lab; colorMath consumed by bg-detect + mirrored in sourceFieldColor.frag; cellColor RT flows field→downsample→stripe; vibrant palette flows source→flames. ✓
- **Risks:** MRT setup (drawBuffers + 2-attachment RT) is the most invasive change — keep luminance mode on the untouched single-RT path (topology-gated) so goldens stay byte-stable; verify after T4. Flames-color couples flames into the color RT (colors mode only). Coverage→width + bg-distance presence: port exact legacy formulas; verify visually. Y-flip on the color RT (same as field).
