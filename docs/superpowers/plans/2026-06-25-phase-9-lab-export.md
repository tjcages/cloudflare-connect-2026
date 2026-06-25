# Phase 9 — Lab Export (SVG + Video) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `apps/lab` (which already renders via the new `@necatikcl/stripes-engine`) export-complete: add a GPU cell-data readback to the engine, an SVG exporter that exactly matches the render, and a video exporter (MediaRecorder + ffmpeg.wasm) — so the lab becomes the product.

**Architecture:** The engine gains `readCellGrid()` returning the real per-cell grid (cols/rows, per-cell value, and per-cell RGBA in colors mode) read back from the GPU `cell`/`cellColor` RTs. A pure `cellGridToSvg()` (ported from the studio's `stripeGridToSvg`) turns that grid + the lab's stripes into an SVG. A ported video pipeline records the engine's canvas (captureStream → webm → ffmpeg.wasm → mp4). The lab wires two export buttons. **No cutover/deletion** of the old studio or legacy `stripes-shader` this phase (kept as fallback per decision).

**Tech Stack:** raw WebGL2 readback; TypeScript; Vitest; Playwright; `@ffmpeg/ffmpeg` (ffmpeg.wasm) for webm→mp4; MediaRecorder / `canvas.captureStream`.

## Global Constraints

- pi/pir ONLY; prefix verify/e2e with `npm_config_store_dir="$HOME/Library/pnpm/store/v10"` if the store mismatches. Add deps with `pi add`.
- NO code comments unless explicitly asked. Object styles, not string styles. Work on `main`; commit per task; **never push** ([[work-directly-on-main]], [[no-push-offers-show-results]]).
- ALL existing goldens MUST stay byte-unchanged — this phase only ADDS engine API + lab features; it must not alter any render path. `readCellGrid()` is a pure readback (no pipeline change). Verify after every task.
- Data textures = raw buffers, never canvas color uploads ([[gpu-data-textures-must-be-raw-buffers]]).
- Reuse the user's dev server (lab on :5174); never spawn a competitor ([[use-pir-for-dev-commands]]).
- The lab is the product target; the old `apps/studio` + `packages/stripes-shader` remain untouched (fallback).

## Reference (legacy → new)

| Legacy (studio)                                                                                                | New (lab)                                                    | Notes                                                        |
| -------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------ | ------------------------------------------------------------ |
| `apps/studio/src/playground/stripeGridToSvg.ts`                                                                | `apps/lab/src/export/cellGridToSvg.ts`                       | pure grid→SVG; adapt to engine cell data + lab stripes       |
| `buildPlaygroundBlockGrid` (CPU field re-derive)                                                               | `engine.readCellGrid()` (GPU readback)                       | exact match to render, incl. colors + adjusted normalization |
| `apps/studio/src/playground/playgroundVideoExport.ts` + `playgroundVideoCompositor.ts` + `playgroundFfmpeg.ts` | `apps/lab/src/export/videoExport.ts` (+ compositor + ffmpeg) | renderer-agnostic; record the engine canvas                  |

## File Structure

**New:**

- `packages/stripes-engine/src/field/cellBand.ts` (+ `.test.ts`) — pure `bandIndexForValue(value01, stripes)`.
- `apps/lab/src/export/cellGridToSvg.ts` (+ `.test.ts`) — pure cell-data → SVG.
- `apps/lab/src/export/videoExport.ts`, `videoCompositor.ts`, `ffmpeg.ts` (+ tests ported) — video pipeline.
- `tests/lab-svg-export.spec.ts` — e2e smoke of the SVG export wiring.

**Modified:**

- `packages/stripes-engine/src/engine.ts` — add `readCellGrid()` + return type; expose on `StripesEngine`.
- `packages/stripes-engine/src/index.ts` — export `readCellGrid` return type + `bandIndexForValue`.
- `apps/lab/src/LabApp.tsx` — export buttons / wiring; expose `readCellGrid`/export via `__lab` for e2e.
- `apps/lab/src/controls/levaSchema.ts` (or a UI control) — "Export SVG" / "Export video" buttons.
- `apps/lab/package.json` — add `@ffmpeg/ffmpeg` (+ core) dep.

---

### Task 1: Engine cell-grid readback + band helper

**Files:** `field/cellBand.ts` (+ test), `engine.ts`, `index.ts`

**Interfaces produced:**

- `bandIndexForValue(value01: number, stripes: Stripe[]): number` — 0 = no band; else 1-based index into the `startFrom`-sorted stripes (mirrors `buildStripeLut` band selection: highest `startFrom <= value` wins; below the lowest threshold → 0).
- `readCellGrid(): CellGridReadback` where `CellGridReadback = { cols: number; rows: number; values: Uint8Array /* len cols*rows, the cell R 0..255 */; colors: Uint8Array | null /* len cols*rows*4 RGBA, present iff colors mode */ }`.

- [ ] **Step 1 — failing test** (`field/cellBand.test.ts`): with `DEFAULT_STRIPES` (startFrom 0.12/0.28/0.44/0.6/0.76/0.9), assert `bandIndexForValue(0.05,…)===0`, `bandIndexForValue(0.13,…)===1`, `bandIndexForValue(0.95,…)===6`, monotonic, and that order-independence holds (unsorted input). Mirror exact band logic of `buildStripeLut` (`packages/stripes-engine/src/field/stripeLut.ts`).
- [ ] **Step 2 — verify FAIL.**
- [ ] **Step 3 — implement** `bandIndexForValue` (sort by startFrom, pick highest `startFrom <= value01`, return 1-based; -? → 0).
- [ ] **Step 4 — verify PASS.**
- [ ] **Step 5 — engine `readCellGrid()`:** in `engine.ts`, after the pipeline has rendered at least once, read the `cell` RT (`pool.get("cell", cols, rows)`) via `gl.bindFramebuffer(FRAMEBUFFER, cellRT.fbo); gl.readPixels(0,0,cols,rows, RGBA, UNSIGNED_BYTE, buf)` → take R per cell into `values`. If `config.colors.mode === "colors"`, also read `pool.get("cellColor", cols, rows)` into `colors` (RGBA). Restore `bindFramebuffer(null)`. Return `{cols, rows, values, colors}`. Add to the `StripesEngine` type. NOTE: readPixels row order is bottom-up; document the orientation by matching what `cellGridToSvg` expects (Task 2 must account for the same flip the render uses — verify against the on-screen result).
- [ ] **Step 6 — export** `bandIndexForValue` + `CellGridReadback` type from `index.ts`.
- [ ] **Step 7 — verify** `pir verify` PASS; `pir test:e2e` UNCHANGED (no render path touched). **Step 8 — commit** `feat(engine): readCellGrid() per-cell readback + bandIndexForValue`.

### Task 2: Lab SVG export

**Files:** `apps/lab/src/export/cellGridToSvg.ts` (+ test), `LabApp.tsx`, a UI button, `tests/lab-svg-export.spec.ts`

**Consumes:** `engine.readCellGrid()` (Task 1), `bandIndexForValue`, the lab's editable stripes (`{hex, startFrom, width}`), grid cell size, orientation, colors mode flag.

- [ ] **Step 1 — failing test** (`cellGridToSvg.test.ts`): feed a tiny hand-built `CellGridReadback` (e.g. 3×2 with known values) + stripes; assert the SVG contains the expected `<path>` per band with the stripe hex, and (colors mode) per-cell fills from the RGBA. Port the band/gap/width geometry from `apps/studio/src/playground/stripeGridToSvg.ts` (cell unit, ROW_WIDTH_GAP, coverage→width, vertical band chaining) but drive band from `bandIndexForValue(values[i]/255, stripes)` and color from `colors` in colors mode. **Letters are OUT OF SCOPE for v1** (note in the file's export doc-less code; revisit later).
- [ ] **Step 2 — verify FAIL. Step 3 — implement** `cellGridToSvg(readback, stripes, { cellSizePx, orientation, useCellColors }): string` (pure). Match the studio geometry; emit `<style>` display-p3 fallbacks per used band (port `supportsDisplayP3`/p3 css from the lab's color utils or inline sRGB+p3).
- [ ] **Step 4 — verify PASS.**
- [ ] **Step 5 — wire the button:** add an "Export SVG" action (leva `button` in a new "Export" folder, or a bottom-bar button) that calls `engine.readCellGrid()` → `cellGridToSvg(...)` → triggers a download (Blob `image/svg+xml` + object URL click) and/or clipboard. Expose `__lab.exportSvg(): string` (returns the SVG string) for e2e.
- [ ] **Step 6 — e2e smoke** (`tests/lab-svg-export.spec.ts`): `?manual=1`, set a colorful source + `colors:{mode:"colors"}`, `renderAt(0)`, then `const svg = await page.evaluate(()=>window.__lab.exportSvg())`; assert it starts with `<svg` and contains `<path`. (No byte golden — SVG is deterministic but DPR/size-sensitive; assert structure.)
- [ ] **Step 7 — verify** `pir verify` + `pir test:e2e` (existing goldens UNCHANGED, +1 new spec). Live-verify the downloaded SVG visually matches the canvas. **Step 8 — commit** `feat(lab): SVG export from engine cell readback`.

### Task 3: Lab video export

**Files:** `apps/lab/src/export/videoExport.ts`, `videoCompositor.ts`, `ffmpeg.ts` (+ ported tests), `LabApp.tsx`, button, `apps/lab/package.json`

**Consumes:** the lab's `canvasRef` (the engine's canvas), the current source (video element for timed capture), background color.

- [ ] **Step 1 — add dep:** `pi add @ffmpeg/ffmpeg @ffmpeg/util` in `apps/lab` (match the versions the studio uses — check `apps/studio/package.json`).
- [ ] **Step 2 — port** `playgroundVideoExport.ts` + `playgroundVideoCompositor.ts` + `playgroundFfmpeg.ts` into `apps/lab/src/export/` as `videoExport.ts`/`videoCompositor.ts`/`ffmpeg.ts`. Keep them renderer-agnostic (operate on a `canvas` + optional `video`). Strip studio-specific config; keep the MediaRecorder fast/slow paths, the compositor (background fill), and the ffmpeg webm→mp4 transcode. Port the existing tests (`playgroundVideoExport.test.ts`) adapting imports.
- [ ] **Step 3 — verify** the ported unit tests pass (mocked MediaRecorder/ffmpeg).
- [ ] **Step 4 — wire the button:** add "Export video" (Export folder) → `exportLabVideo({ canvas: canvasRef.current, sourceKind, video, backgroundColor, onPhase, onProgress })`. For a video source, drive frames via the existing fast path (seek + `requestFrame`); for an image, the fixed-duration path. The engine already renders the canvas (real-time `start()` loop), so `captureStream` works directly.
- [ ] **Step 5 — verify** `pir verify` (ported tests green) + `pir test:e2e` UNCHANGED. Live-verify a short export downloads a playable mp4. **Step 6 — commit** `feat(lab): video export (MediaRecorder + ffmpeg.wasm)`.

## Self-Review

- **Coverage:** engine readback (T1), SVG export (T2), video export (T3). Lab-as-product export-complete. Old studio/legacy untouched (kept). ✓
- **Byte-stability:** no render path changes; `readCellGrid` is pure readback; export is additive. Verify goldens unchanged after T1/T2/T3. ✓
- **Type consistency:** `CellGridReadback` (T1) consumed by `cellGridToSvg` (T2); `bandIndexForValue` shared with the stripe LUT logic; `Stripe` from engine. ✓
- **Risks:** (1) `readPixels` row orientation — the field RT is y-up (uploaded flipped); `cellGridToSvg` must match the on-screen orientation — verify live, not just by structure. (2) ffmpeg.wasm bundle size + cross-origin-isolation (SharedArrayBuffer) — the studio already solved this; mirror its vite headers/config. (3) Letters in SVG deferred — note it. (4) colors-mode SVG width: band from value via `bandIndexForValue` must reproduce the discrete LUT width the GPU uses.
