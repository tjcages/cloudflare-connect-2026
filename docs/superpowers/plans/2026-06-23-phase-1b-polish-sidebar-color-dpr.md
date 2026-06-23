# Phase 1b polish — bg/AA/DPR + 1:1 sidebar + stripe color editor + Shift+S

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development. Steps use `- [ ]`.

**Goal:** Address 6 user-reported items: (1) default background white, (2) fix the gray borders around stripe cells, (3) make the lab sidebar 1:1 with the old studio (theme + structure), (4) add the stripe color config (the old stripe-colors table editor), (5) Shift+S toggles stripes, (6) field/texture resolution default 1× DPR + a config for it.

**Architecture:** (1)/(6) are config-default changes; (2) is a stripe-shader AA fix (use a constant DPR-based AA width, not `fwidth` over the `fract`-discontinuous cell coordinate — re-add `uDpr`); (3)/(4)/(5) port the old studio's Leva setup into the lab — the light theme + `useCreateStore`/`<LevaPanel store>` schema with the old folders/labels/ranges, the `StripeColorsTable`/`stripeColorsTablePlugin`/`HexColorPopover` (adapted to the new numeric `Stripe` via an id/hex bridge), and a Shift+S keydown.

**Tech Stack:** TypeScript, WebGL2/ES 3.00, React 19 + Leva + motion + lucide-react (lab), Vitest, Playwright.

## Global Constraints

- `pir`/`pi` only (`pi add <pkg> --filter lab` for lab deps). WebGL2/ES 3.00. `compileProgram` throws. TS strict. Work on main; don't branch. Husky precommit runs — let it.
- Capture/update goldens with `pir test:e2e:update` or `node_modules/.bin/playwright test --update-snapshots` (pir does NOT forward `--update-snapshots`). Goldens use `?hud=0`.
- Use `motion` (motion.dev / `motion/react`), NEVER `framer-motion`.
- Verify: `pir verify` + `pir test:e2e` green.
- Reference (read, do not modify): old studio at `apps/studio/src/playground/` — `playgroundLevaTheme.ts`, `StripeColorsTable.tsx`, `stripeColorsTablePlugin.tsx`, `apps/studio/src/components/HexColorPopover.tsx`, and the schema in `playgroundLevaSchema.ts`. `packages/stripes-shader/src/stripeColors.ts` for the old Stripe shape.

---

### Task 1: Engine — white bg, field DPR 1× + config, stripe AA fix

**Files:** `packages/stripes-engine/src/config/types.ts`, `config/normalize.ts`, `config/normalize.test.ts`, `shaders/stripe.frag.ts`, `passes/stripePass.ts`, `engine.ts`; `tests/visual.spec.ts-snapshots/*` (recapture).

**Changes:**

1. **White bg:** `DEFAULT_BACKGROUND = { color: 0xffffff }` (was 0x000000). Update any test asserting the old default.
2. **Field DPR config:** add `fieldScale: number` to `EngineConfig` (types.ts) and to normalize (`DEFAULT` 1.0, clamp 0.25..2, e.g. `clamp(num(i.fieldScale,1),0.25,2)`), and to `DEFAULT_ENGINE_CONFIG`. The engine reads `config.fieldScale` in `applySizes` (`fieldSize = resolveFieldSize(output, config.fieldScale)`) instead of the constructor `fieldScale`. Keep `EngineOptions.fieldScale` as an initial seed only if present, else the config drives it — simplest: drop the `let fieldScale` var, use `config.fieldScale` directly in applySizes; `setFieldScale(s)` becomes `setConfig({ fieldScale: s })` or is removed (note which). Default is now 1.0.
3. **Stripe AA fix (gray borders):** in `shaders/stripe.frag.ts` re-add `uniform float uDpr;` and replace `float w = max(fwidth(d), 1e-4);` with `float w = max(1.0 / uDpr, 1e-4);` (constant ~1 device-px AA, avoiding the `fwidth` spike at the `fract(cellF)` cell boundaries). In `passes/stripePass.ts` re-add `dpr` to `StripeUniforms`, the `uDpr` location, and the `gl.uniform1f` upload. In `engine.ts` pass `dpr: getDpr()` in the stripe pass uniforms.

- [ ] **Step 1:** Edit config (white bg + fieldScale field + normalize + default). Update config tests. `pir test -- run config/` → PASS.
- [ ] **Step 2:** Edit the stripe shader + pass + engine (uDpr AA + field DPR from config). `pir --filter @necatikcl/stripes-engine typecheck` → PASS.
- [ ] **Step 3:** Recapture goldens (bg white + fieldScale 1.0 + AA change all alter pixels): `pir test:e2e:update`, then `pir test:e2e`. INSPECT `stripes-luminance-darwin.png`: stripes on a WHITE background, NO gray borders at cell boundaries (clean stripe edges), width still grows with luminance. Also confirm the **perf gate still passes at fieldScale 1.0 + 4K** (the field now renders at full DPR — report the p50; if it exceeds 16.6ms, STOP and report so we can decide quality vs perf).
- [ ] **Step 4:** `pir verify` → PASS. Commit `feat(engine): white bg default, field DPR 1x + config, stripe AA fix (no cell borders)`.

---

### Task 2: Lab — 1:1 Leva theme + structure + Texture DPR control

**Files:** Create `apps/lab/src/controls/levaTheme.ts`; rewrite `apps/lab/src/controls/levaSchema.ts`; modify `apps/lab/src/LabApp.tsx`.

**Changes:**

- Copy the old theme verbatim into `levaTheme.ts` as `LAB_LEVA_THEME` (the `PLAYGROUND_LEVA_LIGHT_THEME` object from `apps/studio/src/playground/playgroundLevaTheme.ts`).
- Rewrite the lab controls to mirror the old studio's panel using Leva folders with the OLD labels/ranges (match the old app's UI ranges even where the engine normalizer clamps wider):
  - **General**: `stripesEnabled` (bool, "Stripes enabled").
  - **Texture Tone**: exposure (-2..2, .05), brightness (-0.5..0.5, .01), contrast (0..2, .01), gamma (0.05..5, .05), invert (bool "Invert luminance").
  - **Texture Levels**: blackPoint (0..1,.01), whitePoint (0..1,.01), thresholdBias (-0.5..0.5,.01), posterizeLevels (0..16,1 "Posterize"), noiseAmount (0..0.5,.01 "Noise"), blurRadius (0..4,1 "Blur"), sharpenAmount (0..4,.1 "Sharpen").
  - **Texture Source**: fit (select Stretch/Cover/Contain), zoom (0.5..4,.01), panX (-1..1,.01), panY (-1..1,.01).
  - **Background**: color (Leva color picker hex ↔ numeric `background.color`).
  - **Grid**: cellWidth (1..24,1 "Cell width"), cellHeight (1..24,1 "Cell height"), gapX (0..cellWidth,.5 "Gap X"), gapY (0..cellHeight,.5 "Gap Y"), cornerRadius (0..max(cellW,cellH)/2,.5 "Corner radius"), orientation (select Vertical/Horizontal).
  - **Quality**: NEW `fieldScale` control — number 0.25..2, step 0.25, default 1, label "Texture DPR" → `config.fieldScale`.
  - **Stripes**: the stripe color editor lands in Task 3 — leave a placeholder folder ("Stripes") now.
- Render with `<Leva theme={LAB_LEVA_THEME} fill={false} titleBar />` OR (closer 1:1) `<LevaPanel theme={LAB_LEVA_THEME} fill flat titleBar={false} />` inside a fixed-position `<aside>` (width 360) on the right, HUD-gated (`?hud=0` hides it — reuse `hudEnabled()`). Map all folder values into `normalizeEngineConfig({ adjustments, transform, grid, background:{color}, stripesEnabled, fieldScale })` exactly as the current schema does. Keep the seed-from-storage behavior (`useMemo(() => normalizeEngineConfig(loadInitialConfig()), [])`).
- `LabApp.tsx`: render the panel HUD-gated; keep `engine.setConfig(controls)` + `saveConfig(controls)` on change.

- [ ] **Step 1:** Create `levaTheme.ts` (verbatim theme).
- [ ] **Step 2:** Rewrite `levaSchema.ts` with the folders/labels/ranges above + the Texture DPR control; ensure the returned config matches `EngineConfig` (incl. `fieldScale`).
- [ ] **Step 3:** Wire `LabApp.tsx` (themed panel, HUD-gated). `pir --filter lab build` → success.
- [ ] **Step 4:** Commit `feat(lab): 1:1 leva theme + control structure + texture-DPR control`.

---

### Task 3: Lab — stripe color editor (port StripeColorsTable)

**Files:** Add deps `motion`, `lucide-react` to `apps/lab`. Create `apps/lab/src/components/HexColorPopover.tsx`, `apps/lab/src/controls/StripeColorsTable.tsx`, `apps/lab/src/controls/stripeColorsTablePlugin.tsx`, `apps/lab/src/controls/stripeAdapter.ts`. Modify `levaSchema.ts`.

**Changes:**

- `pi add motion lucide-react --filter lab` (use `motion`, NOT framer-motion).
- `stripeAdapter.ts`: bridge the new numeric `Stripe = {color:number, startFrom, width}` to the table's needs:
  - `type EditableStripe = { id: string; hex: string; startFrom: number; width: number }`.
  - `toEditable(stripes: Stripe[]): EditableStripe[]` — `id = String(index)` (stable per position), `hex = "#" + color.toString(16).padStart(6,"0")`.
  - `fromEditable(rows: EditableStripe[]): Stripe[]` — `color = parseInt(hex.replace("#",""),16) || 0`, keep startFrom/width.
- Copy `HexColorPopover.tsx` from `apps/studio/src/components/` into the lab (adjust imports to be self-contained).
- Port `StripeColorsTable.tsx` + `stripeColorsTablePlugin.tsx` from the old studio, swapping: the old `Stripe`/clamp/const imports for the new `EditableStripe` + local clamp helpers (startFrom 0..1, width 1..64); drag-reorder via `motion/react` `Reorder`; `lucide-react` `GripVertical`. Keep the same two-column layout (color swatches | threshold+width), drag-to-reorder (color-only), and per-row hex/threshold/width editing. Add **add/remove-row** buttons (the old table lacked them in-panel; add a "+ add stripe" and per-row remove so the lab is self-sufficient).
- `levaSchema.ts`: render the stripe table plugin in the **Stripes** folder, sourced from `toEditable(config.stripes)`; on edit, `fromEditable(rows)` → `config.stripes` → `engine.setConfig`. Because the stripe list drives the LUT (engine rebuilds on stripe change), editing colors/thresholds/widths updates the render live.

- [ ] **Step 1:** Add deps; create `stripeAdapter.ts` (+ a unit test for toEditable/fromEditable round-trip). `pir test -- run stripeAdapter` (if placed in a tested package) — or keep it in the lab and rely on the build.
- [ ] **Step 2:** Copy/adapt `HexColorPopover`, `StripeColorsTable`, `stripeColorsTablePlugin` into the lab.
- [ ] **Step 3:** Wire the table into the Stripes folder in `levaSchema.ts` (toEditable/fromEditable bridge). `pir --filter lab build` → success.
- [ ] **Step 4:** Commit `feat(lab): stripe color editor (ported StripeColorsTable) with numeric-stripe adapter`.

---

### Task 4: Lab — Shift+S toggles stripes

**Files:** Modify `apps/lab/src/LabApp.tsx` (+ the Leva store/set wiring from Task 2/3).

**Change:** Add a `keydown` listener (window) in the mount effect: when `event.shiftKey && (event.key === "S" || event.key === "s")` and the target is not an input/textarea, toggle `stripesEnabled` — both on the engine (`engine.setConfig({ stripesEnabled: next })`) AND reflected in the Leva panel so the UI checkbox updates (use the Leva store's `set`/`setValueAtPath` for the `stripesEnabled` path, mirroring how the old studio updates Leva programmatically; if using `useControls`, expose its `set`). `preventDefault` the event. Remove the listener on cleanup.

- [ ] **Step 1:** Add the keydown listener + the Leva-reflect (store set). `pir --filter lab build` → success.
- [ ] **Step 2:** Commit `feat(lab): Shift+S toggles stripes (engine + leva reflect)`.

---

## Self-Review

- (1) white bg → Task 1 ✓; (2) gray borders → Task 1 AA fix ✓; (6) field DPR 1× + config → Task 1 ✓
- (3) 1:1 sidebar (theme + structure) → Task 2 ✓; (4) color config → Task 3 ✓; (5) Shift+S → Task 4 ✓
- Goldens recaptured + visually verified (no borders, white bg) + perf re-checked at fieldScale 1.0 → Task 1 ✓
- No placeholders; `EngineConfig` gains `fieldScale`; `StripeUniforms` regains `dpr`; the adapter bridges numeric↔hex stripes. Tasks 2-4 are lab-only (build-gated; goldens use `setConfig` directly so the lab UI port doesn't affect them).
- Open: the stripe table add/remove buttons are an addition beyond the old table (which lacked them in-panel) — justified so the lab can edit the stripe list standalone.
