# Phase 4 — Background Flames Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Port the legacy "background flames" — soft-edged light streaks that drift across the canvas — to the new GPU engine as a **field-stage** effect: a cheap CPU particle sim feeds a GPU additive instanced raster that brightens the field _before_ reveal/downsample/stripe.

**Architecture:** Flames are NOT a stripe effect; they add luminance to the FIELD. Pipeline becomes `source → field → [flames: additive light into the field RT] → [reveal] → downsample/present → stripe`. The CPU keeps only the cheap particle sim (≤200 streaks: spawn/move/cull); the GPU draws each active streak as an instanced quad with a cross-axis gradient, blended **additively** into the field RT in place (no new RT, no clear). A pure-TS sim module (`flamesSim.ts`) holds the simulation + gradient/speed math and is unit-tested; the GLSL frag mirrors only the gradient ramp. Determinism: the sim uses the engine's seeded RNG and seeds `maxActive` streaks scattered across the field on its first step, so a single `renderAt(T)` in manual mode yields a deterministic, representative "flames active" frame.

**Decisions locked:**

- **Grayscale now:** streaks add WHITE luminance to the grayscale field; per-streak vibrant color is deferred to Phase 8 (colors mode, where the color side-channel lands). Drop the `color`/palette from the port.
- **Full 1:1 controls:** all legacy knobs (direction, min/max width & height ratios, base speed + variation, spawn interval + jitter, max active, edge sharpness, opacity min/max).
- **Default OFF:** `flames.enabled` default `false` (DEVIATION from legacy `true`) so existing field/stripes/reveal/sparkle goldens stay byte-unchanged. Lab toggle.
- **CPU sim + GPU additive instanced raster** (per the master roadmap).
- **Field-stage, before reveal:** flames brighten the field; visible with stripes ON and OFF.

**Tech Stack:** raw WebGL2 / GLSL ES 3.00, in-house gl helpers (no Pixi); TypeScript; Vitest; Playwright real-GPU goldens.

## Global Constraints

- pi/pir ONLY (never npm/pnpm/yarn/npx); prefix verify/e2e with `npm_config_store_dir="$HOME/Library/pnpm/store/v10"` if a store mismatch appears. ([[use-pir-for-dev-commands]])
- WebGL2 / `#version 300 es`; compile must throw on failure. ([[webgl1-shader-compat]])
- Data textures / instance buffers are raw typed arrays, never canvases. ([[gpu-data-textures-must-be-raw-buffers]])
- NO code comments unless asked. Object styles, not string styles.
- Work directly on `main`; commit per task; never push or ask git disposition. ([[work-directly-on-main]], [[no-push-offers-show-results]])
- Goldens use `?hud=0`; darwin-keyed; update with `node_modules/.bin/playwright test <spec> --update-snapshots`. Tolerance `maxDiffPixelRatio: 0.01`.
- Field / stripe / reveal / sparkle goldens MUST stay byte-unchanged (defaults-off guarantees this).
- Reuse the user's dev server at http://localhost:5174; never spawn a competitor.

## Reference: legacy → new mapping

| Legacy (Pixi/CPU)                                                                    | New (engine)                                                                      | Notes                                                     |
| ------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------- | --------------------------------------------------------- |
| `packages/stripes-shader/src/playgroundFlamesConfig.ts`                              | `packages/stripes-engine/src/config/{types,normalize}.ts` + `flames/flamesSim.ts` | config shape, clamps, gradient-stop + speed-range helpers |
| `packages/stripes-shader/src/playgroundFlames.ts` (sim: create/seed/step/spawn/cull) | `packages/stripes-engine/src/flames/flamesSim.ts`                                 | CPU sim, seeded RNG, grayscale (drop color)               |
| `playgroundFlames.ts` canvas gradient + `"lighter"` composite                        | `shaders/flames.vert.ts` + `flames.frag.ts` + `passes/flamesPass.ts`              | GPU additive instanced gradient quads into the field RT   |

## Constants & formulas (verbatim from legacy)

- Defaults: direction `"up"`, minWidthRatio `0.0223`, maxWidthRatio `0.0453`, minHeightRatio `0.0245`, maxHeightRatio `0.08`, baseSpeedPxPerSec `40`, speedVariation `1`, spawnIntervalMs `50`, spawnJitterMs `80`, maxActive `48`, edgeSharpness `1`, opacityMin `0.3`, opacityMax `1`. **`enabled` default `false`** (override of legacy).
- Clamps: width/height ratios `0.001..0.5` (max ≥ min); baseSpeed `1..500`; speedVariation `0..1`; spawnInterval `20..5000` (int); spawnJitter `0..2000` (int); maxActive `1..200` (int); edgeSharpness `0..1`; opacity `0..1` (max ≥ min).
- Gradient stops: `halfBand = 0.4 + (0.06 - 0.4) * clamp(sharpness,0,1)`; `inner = 0.5 - halfBand`, `outer = 0.5 + halfBand`.
- Speed range: `spread = baseSpeedPxPerSec * 0.5 * speedVariation`; `min = max(1, base - spread)`, `max = base + spread`.
- Streak span px: `displaySize * lerp(minRatio, maxRatio, rand)`. Cross-axis position: `rand in [0, displaySize - span]`. Vertical dirs (up/down) span width & travel along y; horizontal (left/right) span height & travel along x.
- Seed (first step): `maxActive` streaks; along-travel-axis position `rand in [-span, displaySize]` (scattered); cross-axis as above.
- Move per step: `pos ± speed*dtSec` per direction. Cull when fully off the exit edge. Respawn (placed just off the entry edge) when `count < maxActive && now-lastSpawn >= interval + rand(-jitter, jitter)`.
- Gradient alpha at cross-axis local `t∈[0,1]`: `ramp = min(t/inner, (1-t)/(1-outer))`; `alpha = opacity * clamp(ramp, 0, 1)` (linear 4-stop: 0→peak@inner→peak@outer→0). Additive luminance contribution = `alpha` (white).

## File Structure

**New:**

- `packages/stripes-engine/src/flames/flamesSim.ts` — config-driven CPU sim + gradient/speed helpers (pure-TS, seeded RNG, grayscale).
- `packages/stripes-engine/src/flames/flamesSim.test.ts` — unit tests.
- `packages/stripes-engine/src/shaders/flames.vert.ts` — instanced quad from per-flame instance attributes.
- `packages/stripes-engine/src/shaders/flames.frag.ts` — cross-axis gradient × opacity, white luminance out.
- `packages/stripes-engine/src/passes/flamesPass.ts` — additive instanced draw into the field RT.
- `tests/flames.spec.ts` — Playwright golden(s).

**Modified:**

- `packages/stripes-engine/src/config/types.ts` — `FlamesConfig` + `flames` on `EngineConfig`.
- `packages/stripes-engine/src/config/normalize.ts` — `DEFAULT_FLAMES` + `normalizeFlames` + wire-in + `DEFAULT_ENGINE_CONFIG`.
- `packages/stripes-engine/src/config/normalize.test.ts` — clamp/default tests.
- `packages/stripes-engine/src/legacy/migrateLegacyConfig.ts` — map legacy `flames` (best-effort) or default.
- `packages/stripes-engine/src/engine.ts` — sim instance + flamesPass; topology-gate on `flames.enabled`; step sim in `renderFrame`; upload instance data; seeded RNG from engine seed.

---

### Task 1: Config — `flames` section

**Files:** types.ts, normalize.ts, normalize.test.ts, migrateLegacyConfig.ts

**Interfaces — Produces:**

```ts
type FlamesDirection = "up" | "down" | "left" | "right";
interface FlamesConfig {
  enabled: boolean;
  direction: FlamesDirection;
  minWidthRatio: number;
  maxWidthRatio: number;
  minHeightRatio: number;
  maxHeightRatio: number;
  baseSpeedPxPerSec: number;
  speedVariation: number;
  spawnIntervalMs: number;
  spawnJitterMs: number;
  maxActive: number;
  edgeSharpness: number;
  opacityMin: number;
  opacityMax: number;
}
// EngineConfig gains: flames: FlamesConfig
// DEFAULT_FLAMES per the constants above (enabled: false)
// normalizeFlames(partial): clamps per the constants; direction guarded to the 4 values; max≥min for ratios+opacity.
```

- [ ] **Step 1:** Add `FlamesDirection` + `FlamesConfig` to types.ts; add `flames` to `EngineConfig`.
- [ ] **Step 2:** Failing tests in normalize.test.ts: defaults (enabled false, direction "up", values above); clamp width ratio to 0.001..0.5; maxWidthRatio ≥ minWidthRatio; baseSpeed 1..500; maxActive int 1..200; opacityMax ≥ opacityMin; bogus direction → "up".
- [ ] **Step 3:** `pir verify` → FAIL.
- [ ] **Step 4:** Add `DEFAULT_FLAMES`, `normalizeFlames` (port the legacy clamps exactly), wire `flames: normalizeFlames(i.flames)` into `normalizeEngineConfig` + `DEFAULT_ENGINE_CONFIG`; add `flames` to migrate output (default; legacy fields mapped best-effort if present).
- [ ] **Step 5:** `pir verify` → PASS.
- [ ] **Step 6:** Commit `feat(engine): flames config (default off)`.

### Task 2: CPU sim `flamesSim.ts`

**Files:** flames/flamesSim.ts, flames/flamesSim.test.ts

**Interfaces — Produces:**

```ts
interface Flame {
  x: number;
  y: number;
  width: number;
  height: number;
  speedPxPerSec: number;
  opacity: number;
}
interface FlamesState {
  flames: Flame[];
  lastSpawnMs: number;
  lastStepMs: number;
  random: () => number;
}
function createFlamesState(random: () => number): FlamesState;
function stepFlames(
  state: FlamesState,
  config: FlamesConfig,
  display: { width: number; height: number },
  nowMs: number,
): void;
function flamesGradientStops(sharpness: number): { inner: number; outer: number };
function flamesSpeedRange(config: FlamesConfig): { minPxPerSec: number; maxPxPerSec: number };
function isVerticalFlamesDirection(d: FlamesDirection): boolean;
```

- [ ] **Step 1:** Failing tests: seeded `createFlamesState(mulberry32(1))` + `stepFlames` once → seeds exactly `maxActive` flames (deterministic positions for seed 1 — assert count + that two different seeds differ); a second `stepFlames` at +1000ms moves flames in the direction and culls/​respawns within `maxActive`; `flamesGradientStops(1) → {inner:0.44, outer:0.56}` and `flamesGradientStops(0) → {inner:0.1, outer:0.9}`; `flamesSpeedRange({base:40, variation:1})` → `{min:20, max:60}`. Disabled config → no flames.
- [ ] **Step 2:** `pir verify` → FAIL.
- [ ] **Step 3:** Port `playgroundFlames.ts` sim EXACTLY (seed/step/spawn/cull/visibility, span/position helpers), dropping `color`/palette (grayscale). Add a tiny `mulberry32` seeded RNG helper (in flamesSim.ts or a shared util) for tests + engine determinism.
- [ ] **Step 4:** `pir verify` → PASS.
- [ ] **Step 5:** Commit `feat(engine): flames CPU particle sim (seeded, grayscale)`.

### Task 3: GPU pass + shaders (additive instanced gradient)

**Files:** shaders/flames.vert.ts, shaders/flames.frag.ts, passes/flamesPass.ts

**Interfaces — Produces:**

```ts
// createFlamesPass(gl): { render(fieldRT, flames: Flame[], opts: { canvasW, canvasH, vertical: boolean, inner: number, outer: number }), dispose() }
// Instance attributes (one per flame): aRect = vec4(x,y,w,h) in CSS px; aOpacity = float.
// Quad: 6 verts (or triangle-strip 4) in [0,1]^2 local; vert maps to px rect -> UV (px/canvas) -> clip; passes local cross-axis coord to frag.
```

- [ ] **Step 1:** `flames.vert.ts`: per-instance `aRect`(vec4)+`aOpacity`; uniforms `uCanvas`(vec2 css px), `uVertical`(float). Build the quad corner from `gl_VertexID`; world px = `aRect.xy + corner*aRect.zw`; `uv = worldPx/uCanvas`; `gl_Position = vec4(uv*2-1, 0, 1)`. Output `vCross` = local cross-axis coord (`corner.x` if vertical else `corner.y`) and `vOpacity`.
- [ ] **Step 2:** `flames.frag.ts`: uniforms `uInner`,`uOuter`; `ramp = min(vCross/uInner, (1.0-vCross)/(1.0-uOuter)); a = vOpacity * clamp(ramp,0,1);` output `vec4(vec3(a),1.0)` (luminance; additive blend supplies the add).
- [ ] **Step 3:** `flamesPass.ts`: a dynamic instance VBO (raw Float32Array, re-uploaded each frame); `render` binds the field RT as target, `gl.enable(BLEND); gl.blendFunc(ONE, ONE)` (additive), uploads instance data for the active flames, `drawArraysInstanced`, restores blend. NO clear (adds onto the existing field). Skip when `flames.length === 0`.
- [ ] **Step 4:** `pir verify` (typecheck/compile) → PASS. (Visual coverage in Task 6.)
- [ ] **Step 5:** Commit `feat(engine): flames GPU additive instanced gradient pass`.

### Task 4: Engine wiring (sim step + topology)

**Files:** engine.ts

**Interfaces — Consumes:** Task 1 config, Task 2 sim, Task 3 pass.

- [ ] **Step 1:** Add a seeded RNG (`mulberry32(opts.seed ?? default)`), a `flamesState`, and a `flamesPass` (created in `buildPasses` when `config.flames.enabled`). Topology-gate: rebuild passes when `flames.enabled` flips (extend the existing `setConfig` topology check).
- [ ] **Step 2:** Insert flames into the pass chain **after `fieldPass`, before `revealFieldPasses`**: a pass whose `render` (a) steps the sim — `stepFlames(flamesState, config.flames, {width:cssW,height:cssH}, clock.now())`; (b) calls `flamesPass.render(field RT, flamesState.flames, { canvasW:cssW, canvasH:cssH, vertical:isVerticalFlamesDirection(dir), inner, outer })` additively into the `"field"` RT. Both the stripes-on (downsample) and stripes-off (present) chains already read `"field"`/`activeFieldRT` downstream, so flames appear in both.
- [ ] **Step 3:** Reset `flamesState` (`lastStepMs=0`, clear) when flames toggles on, or on a fresh seed, so manual `renderAt` seeds deterministically. Ensure `triggerReveal`/manual paths don't double-step.
- [ ] **Step 4:** `pir verify` → PASS. `pir test:e2e` → existing 11 goldens UNCHANGED (flames default off ⇒ field byte-identical; confirm the flames pass truly does not run when disabled).
- [ ] **Step 5:** Commit `feat(engine): wire flames sim + additive field pass (topology-gated, off by default)`.

### Task 5: Lab UI — "Background Flames" folder

**Files:** apps/lab/src/controls/levaSchema.ts

- [ ] **Step 1:** Add a `Background Flames` folder mirroring the existing folder pattern: `flamesEnabled` (bool); `flamesDirection` (select Up/Down/Left/Right); width/height ratio min+max (shown as % — value×100, min 0.1, max 50, step 0.1, mapped back /100); `flamesBaseSpeed` (1..500); `flamesSpeedVariation` (0..1 step .01); `flamesSpawnInterval` (20..5000); `flamesSpawnJitter` (0..2000); `flamesMaxActive` (1..200 step 1); `flamesEdgeSharpness` (0..1 step .01); `flamesOpacityMin`/`flamesOpacityMax` (0..1 step .01). Gate the non-enabled controls with `render: (get) => get("Background Flames.flamesEnabled") === true`.
- [ ] **Step 2:** Map into config `flames: { ... }`.
- [ ] **Step 3:** `pir verify` → PASS. Live-verify on http://localhost:5174 (temp Playwright: enable flames, screenshot the field with stripes off — confirm light streaks; then stripes on — confirm brighter/denser stripe regions). Delete temps.
- [ ] **Step 4:** Commit `feat(lab): Background Flames controls`.

### Task 6: Deterministic golden

**Files:** tests/flames.spec.ts

- [ ] **Step 1:** Add tests at `/?manual=1&seed=1&dpr=2&w=400&h=300&hud=0`, `renderAt(1000)`: (a) "flames — field" with `stripesEnabled:false`, `flames:{enabled:true, ...defaults}` → `flames-field.png`; (b) "flames — stripes" with `stripesEnabled:true` same flames → `flames-stripes.png`. `maxDiffPixelRatio: 0.01`.
- [ ] **Step 2:** Capture: `node_modules/.bin/playwright test flames --update-snapshots`. READ both PNGs — confirm (a) scattered soft light streaks on the field, (b) brighter/denser stripes where streaks are. Re-capture if wrong.
- [ ] **Step 3:** Full `pir test:e2e` → all green (13 now); prior 11 unchanged.
- [ ] **Step 4:** Commit `test(engine): flames goldens (field + stripes)`.

## Self-Review

- **Spec coverage:** config (T1), sim (T2), GPU additive raster (T3), wiring+topology (T4), full-knob UI (T5), determinism+goldens (T6), grayscale (T2 drops color), default-off invariant (T1, verified T4/T6). ✓
- **Type consistency:** `FlamesConfig` fields identical across types/normalize/engine/lab; `Flame`/`FlamesState` shared by sim (T2), pass (T3), engine (T4); `flamesGradientStops`/`flamesSpeedRange`/`isVerticalFlamesDirection` exported from flamesSim and consumed by engine; GLSL `uInner/uOuter` fed from `flamesGradientStops`. ✓
- **Placeholders:** none — clamps, defaults, gradient/speed formulas, blend mode, instance layout, and determinism approach are all concrete. ✓
- **Risk note:** float accumulation across many sim steps is avoided for goldens by relying on the single-step seed (renderAt once → seeded scattered frame); the live lab steps continuously (fine, not golden'd).
