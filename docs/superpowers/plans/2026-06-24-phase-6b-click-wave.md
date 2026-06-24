# Phase 6b — Click Wave (ripple + radial push) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Port the legacy "click wave" to the new GPU engine — expanding rings on pointer-down that add a white brighten + a ring-front radial push to the field — REUSING the Phase 6a cursor warp infrastructure (shared brighten/push/tear RTs + tear pass + field warp pass).

**Architecture:** Click waves are a SECOND accumulation source feeding the SAME `cursorTrail`(brighten) + `cursorPush`(RG float) RTs that 6a created. The engine's cursor field-stage pass (built in 6a) is refactored to build the warp infrastructure when `cursorTrail.enabled OR clickWave.enabled`, and within it: step the trail sim (if trail on) + step the click sim (if click on), splat trail samples + splat click-ring samples into the shared RTs, then the existing tear → warp passes run unchanged. So 6b adds: a click config, a click CPU sim, a click-ring splat pass, the `click(x,y)` input + lab wiring, controls, and goldens.

**Decisions locked:**

- **Default OFF** (`clickWave.enabled` default `false`) so existing goldens stay byte-unchanged.
- **Faithful push default:** click `pushStrengthPx` default `38` (legacy — already visibly pushes; unlike the trail, no change needed).
- **Reuse 6a infra:** the brighten/push/tear RTs, `cursorTearPass`, and `cursorWarpPass` are shared; 6b only adds the ring splat + sim + input + config.
- **Determinism:** seeded click sim (`nextSeed`) + injected `click(x,y)` at a fixed clock + fixed-dt stepping → reproducible goldens.

**Tech Stack:** raw WebGL2 / GLSL ES 3.00; TypeScript; Vitest; Playwright real-GPU goldens.

## Global Constraints

- pi/pir ONLY; prefix verify/e2e with `npm_config_store_dir="$HOME/Library/pnpm/store/v10"` if needed. WebGL2 `#version 300 es`. NO code comments. Object styles.
- Work on `main`; commit per task; never push. ([[work-directly-on-main]], [[no-push-offers-show-results]])
- Goldens `?hud=0`, darwin-keyed, `--update-snapshots`, `maxDiffPixelRatio 0.01`.
- ALL existing goldens (17 after 6a) MUST stay byte-unchanged (default-off).
- Reuse the user's dev server at http://localhost:5174.
- **Depends on Phase 6a** (cursor warp infra) being merged first.

## Reference: legacy → new mapping

| Legacy                                                                                                          | New (engine)                                                   | Notes                                             |
| --------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- | ------------------------------------------------- |
| `clickWave.ts` (sim: state/addWave/update/samples)                                                              | `cursorTrail/clickWaveSim.ts`                                  | port 1:1; deterministic                           |
| `playgroundClickWaveConfig.ts`                                                                                  | `config/{types,normalize}.ts`                                  | config + clamps (push default 38)                 |
| `cursorTrailOverlay.ts` `accumulateClickWaveCellMap` (ring brighten + ring-front push, wobble/breakup/dissolve) | `shaders/clickSplat.vert+frag.ts` + `passes/clickSplatPass.ts` | GPU ring splats into the SHARED brighten+push RTs |
| `cursorFieldFilter.ts` (warp)                                                                                   | reuses 6a `cursorWarpPass`                                     | unchanged                                         |

## Key formulas (from legacy — port exactly)

- Sim (`clickWave.ts`): `addClickWave` on click; per wave `progress=age/life`, `eased=easeOutQuart(progress)`, `radius=start+(max-start)*eased`, `strokeWidth=max(end, start+(end-start)*progress)`, `pushPower=smoothstep(life)` (`life²(3-2life)`), `whitePower=smokeLifeCurve(progress)*birthBoost`, seed per wave; cull at age≥life; `maxWaves` cap.
- Ring splat (`accumulateClickWaveCellMap`): brighten the ring band (`forRingCells` around `radius±halfStroke`) by `whitePower*stripeWhiteAlpha` with wobble (`clickRadiusWobble`)/breakup (`clickStrengthBreakup`)/dissolve (`clickCellDissolved`). Ring-front push: interior ramps `0→peak` at the wobbled front, `pushPeak=pushScale*pushPower`, band `= max(0.5, halfStroke*pushBandScale)`, `pushScale=pushStrengthPx*(cols/displayWidth)`; push direction radial (outward) → adds into the shared push RG. Copy the wobble/breakup/dissolve helpers + constants exactly.

## File Structure

**New:** `cursorTrail/clickWaveSim.ts` (+ test); `shaders/clickSplat.vert.ts`, `clickSplat.frag.ts`; `passes/clickSplatPass.ts`; `tests/click-wave.spec.ts`.
**Modified:** `config/types.ts`, `config/normalize.ts` (+ test), `legacy/migrateLegacyConfig.ts`, `engine.ts` (click sim + ring splat into shared RTs + `click(x,y)` API + gate refactor to trail||click), `apps/lab/src/LabApp.tsx` (pointerdown) + `controls/levaSchema.ts` (Click Wave folder).

---

### Task 1: Config — `clickWave` section

**Files:** types.ts, normalize.ts, normalize.test.ts, migrateLegacyConfig.ts

- [ ] **Step 1:** Add `ClickWaveConfig` (10 legacy fields) + `clickWave` on `EngineConfig`.
- [ ] **Step 2:** Failing tests: omitted → `enabled:false`; legacy clamps (port `normalizePlaygroundClickWaveConfig`); `pushStrengthPx` default `38`; `maxWaves` int 1..32. (enabled via `!== undefined ? !!v : default`, omitted → false.)
- [ ] **Step 3:** verify FAIL. **Step 4:** `DEFAULT_CLICK_WAVE` + `normalizeClickWave` + wire-in + DEFAULT_ENGINE_CONFIG + partial + migrate. **Step 5:** verify PASS. **Step 6:** commit `feat(engine): click-wave config (default off)`.

### Task 2: CPU sim `clickWaveSim.ts`

**Files:** cursorTrail/clickWaveSim.ts (+ test)

- [ ] **Step 1:** Failing tests: `addClickWave` then `updateClickWave` over fixed dt → ring radius grows (easeOutQuart), strokeWidth interpolates, `pushPower`/`whitePower` shapes; cull at life end; `maxWaves` cap; disabled → no samples + clear frames; deterministic seeds.
- [ ] **Step 2:** verify FAIL. **Step 3:** port `clickWave.ts` EXACTLY (`ClickWaveState`, `createClickWaveState`, `addClickWave`, `updateClickWave`, `easeOutQuart`, `smokeLifeCurve`, `computeRingWhiteFalloff`); import `ClickWaveConfig` from `../config/types`. **Step 4:** verify PASS. **Step 5:** commit `feat(engine): click-wave CPU sim (seeded)`.

### Task 3: Click ring splat pass + engine wiring (shared RTs, gate refactor)

**Files:** shaders/clickSplat.vert+frag.ts, passes/clickSplatPass.ts, engine.ts

- [ ] **Step 1:** `clickSplatPass`: instanced ring quads (one per click sample), additive into the SHARED `cursorTrail`(R brighten) + `cursorPush`(RG push) RTs. Instance attrs: center(cell), radius(cell), halfStroke(cell), pushBand(cell), pushPeak, whiteAmt, progress, seed. Frag: ring-band brighten (`whiteAmt` within `|dist-radius|<halfStroke`, wobble/breakup/dissolve) + ring-front radial push (interior ramp to `pushPeak` at front) × outward dir. Mirror `accumulateClickWaveCellMap`.
- [ ] **Step 2:** engine.ts: add `click(x: number, y?: number)` to the API (→ `addClickWave(clickState, {x,y}, config.clickWave.lifeMs)`); a `clickWaveState`. Refactor the 6a cursor field-stage gate from `cursorTrail.enabled` to `cursorTrail.enabled || clickWave.enabled`. Inside the cursor pass: after the trail splat (gated on trail.enabled), step the click sim (gated on click.enabled) and run the click ring splat into the SAME RTs (before the tear pass). Topology-gate now keys on BOTH `cursorTrail.enabled` and `clickWave.enabled` (track both lastFlags). Reset clickState on enable. Dispose clickSplatPass.
- [ ] **Step 3:** `pir verify` → PASS. `pir test:e2e` → existing 17 UNCHANGED (both off ⇒ no cursor/click passes). **Step 4:** commit `feat(engine): click-wave ring splat into shared cursor RTs + click API`.

### Task 4: Lab — pointerdown + "Click Wave" controls

**Files:** apps/lab/src/LabApp.tsx, controls/levaSchema.ts

- [ ] **Step 1:** Lab: `pointerdown` on the canvas → `engine.click(localX, localY)` (interactive mode only).
- [ ] **Step 2:** `Click Wave` folder: enabled, lifeMs, startRadiusPx, maxRadiusPx, startStrokeWidthPx, endStrokeWidthPx, maxWaves, pushStrengthPx, pushBandScale, stripeWhiteAlpha (legacy ranges); gate non-enabled on `get("Click Wave.clickWaveEnabled")===true`; map into config.
- [ ] **Step 3:** `pir verify` → PASS. Live-verify: click the canvas → expanding ring with brighten + radial warp. Temp screenshot, delete temps.
- [ ] **Step 4:** commit `feat(lab): click input + Click Wave controls`.

### Task 5: Deterministic golden

**Files:** tests/click-wave.spec.ts

- [ ] **Step 1:** `__lab.clickAt(x,y)` hook (→ engine.click) if needed. Test at `/?manual=1&seed=1&dpr=2&w=400&h=300&hud=0`, `clickWave:{enabled:true}`: `clickAt(center)` then `renderAt(t)` mid-life (e.g. t≈300ms with fixed dt steps) so a ring is mid-expansion; screenshot. Two tests: stripes off (`click-wave-field.png`) and stripes on (`click-wave-stripes.png`). `maxDiffPixelRatio 0.01`.
- [ ] **Step 2:** Capture; READ both PNGs — confirm an expanding ring (brighten band + radial push displacement). Re-run once (no update) to confirm determinism.
- [ ] **Step 3:** Full `pir test:e2e` → all green (19 now); prior 17 unchanged.
- [ ] **Step 4:** commit `test(engine): click-wave goldens (field + stripes)`.

## Self-Review

- **Coverage:** config (T1), sim (T2), ring splat into shared RTs + gate refactor (T3), lab input+controls (T4), determinism+goldens (T5); reuses 6a tear+warp; default-off invariant (T1, verified T3/T5). ✓
- **Type consistency:** `ClickWaveConfig` identical across types/normalize/engine/lab; `ClickWaveState`/`ClickWaveSample` shared sim↔engine; click splat instance attrs match the engine upload; the shared RTs (`cursorTrail`/`cursorPush`) and `cursorTearPass`/`cursorWarpPass` are the SAME objects 6a created (no duplication). ✓
- **Dependency:** requires 6a merged (the warp infra). The gate refactor (trail.enabled → trail||click) must keep 6a's trail-only path identical. ✓
