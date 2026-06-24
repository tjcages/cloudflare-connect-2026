# Phase 6a — Cursor Trail (warp infrastructure + trail) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Port the legacy interactive "cursor trail" to the new GPU engine: a particle sim follows the pointer, accumulates into cell-resolution float RTs (brighten + push-vector), a tear pass derives positive push-divergence, and a field-stage warp pass displaces/thins/brightens the field — visible with stripes on or off. This phase also builds the shared cursor warp INFRASTRUCTURE that Phase 6b (click wave) reuses.

**Architecture:** New stages, all gated on `cursorTrail.enabled`:

1. **Input** — the engine gains a cursor API (`setCursor(x|null, y)`); the lab wires live pointer events; goldens inject a scripted path.
2. **CPU sim** (`cursorTrail/cursorTrailSim.ts`, ported from legacy `cursorTrail.ts`) — emits/updates particles each frame from the pointer path; produces a `samples[]` array (position, alpha, radius, push-center, progress, seed). Deterministic given a fresh state + fixed pointer path + fixed dt + the built-in `nextSeed` counter.
3. **GPU accumulation** (cell-res RTs `cols×rows`, rebuilt each frame — particle decay lives in the CPU sim, so no cross-frame ping-pong): instanced splats add a radial-falloff `brighten` (R) into a trail RT and a radial displacement `(pushX,pushY)` (RG float) into a push RT.
4. **Tear pass** — positive divergence of the push RT (neighbour-difference) → tear scalar.
5. **Field warp pass** (`shaders/cursorWarp.frag`, ported from legacy `cursorFieldFilter.ts`) — per field pixel, find its cell, read brighten/push/tear; sample the field displaced by `push`, thin by `tear`, lift by `brighten`. Inserted as the LAST field-stage pass (after flames/reveal/edge-mask), before downsample/present.

**Decisions locked:**

- **Default OFF** (`cursorTrail.enabled` default `false`) so the existing 15 goldens stay byte-unchanged.
- **Small visible push by default:** `pushStrengthPx` default ~14 (DEVIATION from legacy 0) so the warp shows when enabled. All other trail defaults faithful to legacy.
- **GPU-first, float push RT:** redesign the legacy CPU byte-128 push encoding as a float RG push RT (no 128-bias trick); tear = GPU neighbour-difference divergence pass (not a CPU pass).
- **Cell-resolution data textures** (`cols×rows`, nearest) like legacy; the field-res warp pass samples them per-pixel by cell.
- **Determinism:** seeded sim (`nextSeed` from a fixed start) + injected pointer path + fixed-dt stepping in manual mode → reproducible goldens.

**Tech Stack:** raw WebGL2 / GLSL ES 3.00, in-house gl helpers; TypeScript; Vitest; Playwright real-GPU goldens.

## Global Constraints

- pi/pir ONLY (never npm/pnpm/yarn/npx); prefix verify/e2e with `npm_config_store_dir="$HOME/Library/pnpm/store/v10"` if a store mismatch appears. ([[use-pir-for-dev-commands]])
- WebGL2 / `#version 300 es`; compile must throw on failure. Float RTs require `EXT_color_buffer_float` (already used by the engine's float RTs — follow the existing float-RT pool usage). ([[webgl1-shader-compat]])
- Data textures / accumulation buffers are GPU RTs or raw typed arrays, never canvases. ([[gpu-data-textures-must-be-raw-buffers]], [[cursor-trail-push-is-core]])
- NO code comments unless asked. Object styles, not string styles.
- Work directly on `main`; commit per task; never push or ask git disposition. ([[work-directly-on-main]], [[no-push-offers-show-results]])
- Goldens use `?hud=0`; darwin-keyed; `node_modules/.bin/playwright test <spec> --update-snapshots`; tolerance `maxDiffPixelRatio: 0.01`.
- ALL existing goldens (15) MUST stay byte-unchanged (default-off guarantees this).
- Reuse the user's dev server at http://localhost:5174; never spawn a competitor.

## Reference: legacy → new mapping

| Legacy                                                                                                                      | New (engine)                                                     | Notes                               |
| --------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- | ----------------------------------- |
| `cursorTrail.ts` (particle sim: state/emit/update/samples)                                                                  | `cursorTrail/cursorTrailSim.ts`                                  | port 1:1; deterministic             |
| `playgroundCursorTrailConfig.ts`                                                                                            | `config/{types,normalize}.ts`                                    | config + clamps (push default ~14)  |
| `cursorTrailOverlay.ts` `accumulateCursorTrailCellMap` (per-cell alpha/pushX/pushY, falloff, dissolve, brighten/push radii) | `shaders/cursorSplat.vert+frag.ts` + `passes/cursorSplatPass.ts` | GPU instanced splats into float RTs |
| `cursorTrailOverlay.ts` tear = positive push divergence                                                                     | `shaders/cursorTear.frag.ts` + `passes/cursorTearPass.ts`        | GPU neighbour-difference            |
| `cursorFieldFilter.ts` (warp+tear+brighten frag)                                                                            | `shaders/cursorWarp.frag.ts` + `passes/cursorWarpPass.ts`        | float push (no byte-128)            |

## Key formulas (from legacy — port exactly unless noted)

- Sim: see `cursorTrail.ts` (`MAX_DT_MS=48`, `seededUnit`, emit count = `min(maxEmitPerTick, floor(distance/spacing + emitRemainder)+1)`, particle velocity = `emitterVel*velScale + tangent*side*tangentVel`, curl/damping update, `alpha = particleAlpha*life²`, `radius = particleRadius*(0.75+rand*0.8)*(densityRadiusMinScale + life*densityRadiusLifeScale)`, push center = drop pos + lag(`-vel/speed*pushLagPx`) + wobble(`cos/sin(seed,age)*pushWobblePx`)).
- Splat: `falloff(dist,radius) = clamp01(1 - dist/radius)` style radial (see legacy `falloff`); brighten splat adds `alpha*falloff` into trail R; push splat adds `pushScale*alpha*falloff(dist,pushRadius) * (dx,dy)/dist` into push RG, where `pushScale = pushStrengthPx*(cols/displayWidth)`, `pushRadius = radius*pushRadiusScale`. Pixelated dissolve on exit via `clickDissolveProgress(progress)` + `clickCellDissolved(seed,cell,dissolve)`.
- Tear: `tear = clamp01(TEAR_STRENGTH * max(0, -divergence(push)))` where divergence ≈ `(pushX[x+1]-pushX[x-1]) + (pushY[y+1]-pushY[y-1])` over the push RT (positive divergence = stretch). Copy `TEAR_STRENGTH` constant from `cursorTrailOverlay.ts`.
- Warp (port `cursorFieldFilter.ts` frag, float push): `offset = push.xy * uPushRange` (cells; no byte-128 decode); `offsetUv = offset*uCellSize/uPixelSize`; `field = texture(uField, vUv - offsetUv).r`; `field *= (1 - tear)`; `field += (1-field)*trailLift`. (Non-inverted branch only; the engine field is luminance.)

## File Structure

**New:** `cursorTrail/cursorTrailSim.ts` (+ test); `shaders/cursorSplat.vert.ts`, `cursorSplat.frag.ts`, `cursorTear.frag.ts`, `cursorWarp.frag.ts`; `passes/cursorSplatPass.ts`, `cursorTearPass.ts`, `cursorWarpPass.ts`; `tests/cursor-trail.spec.ts`.
**Modified:** `config/types.ts`, `config/normalize.ts` (+ test), `legacy/migrateLegacyConfig.ts`, `engine.ts` (cursor API + sim step + accumulation/tear/warp passes + topology gate + activeFieldRT), `apps/lab/src/LabApp.tsx` (pointer events) + `controls/levaSchema.ts` (Cursor Trail folder).

---

### Task 1: Config — `cursorTrail` section

**Files:** types.ts, normalize.ts, normalize.test.ts, migrateLegacyConfig.ts

- [ ] **Step 1:** Add `CursorTrailConfig` (all 21 legacy fields) to types.ts + `cursorTrail` on `EngineConfig`.
- [ ] **Step 2:** Failing normalize tests: omitted → `enabled:false`; the legacy clamps (port `normalizePlaygroundCursorTrailConfig` exactly); `pushStrengthPx` default `14`; `spreadMaxPx ≥ spreadMinPx`. (Use `!== undefined ? !!v : default` for enabled, NOT legacy `!== false`, so omitted → false.)
- [ ] **Step 3:** `pir verify` → FAIL. **Step 4:** implement `DEFAULT_CURSOR_TRAIL` + `normalizeCursorTrail`, wire into normalizeEngineConfig + DEFAULT_ENGINE_CONFIG + partial type + migrate. **Step 5:** `pir verify` → PASS. **Step 6:** commit `feat(engine): cursor-trail config (default off, push 14)`.

### Task 2: CPU sim `cursorTrailSim.ts`

**Files:** cursorTrail/cursorTrailSim.ts (+ test)

- [ ] **Step 1:** Failing tests: fresh state + `setCursorTrailTarget` along a path + `updateCursorTrail` over fixed dt steps → deterministic sample count/positions (same vs same, differs if path differs); disabled → no samples + clear frames; `alpha = particleAlpha*life²` shape; emit count respects `maxEmitPerTick`.
- [ ] **Step 2:** `pir verify` → FAIL. **Step 3:** port `cursorTrail.ts` EXACTLY (`CursorTrailState`, `createCursorTrailState`, `setCursorTrailTarget`, `updateCursorTrail`, `emitParticle`, `pushCenterForDrop`, `seededUnit`); import `CursorTrailConfig` from `../config/types`. **Step 4:** `pir verify` → PASS. **Step 5:** commit `feat(engine): cursor-trail CPU particle sim (seeded)`.

### Task 3: GPU accumulation — splat + tear passes

**Files:** shaders/cursorSplat.vert+frag.ts, cursorTear.frag.ts; passes/cursorSplatPass.ts, cursorTearPass.ts

- [ ] **Step 1:** `cursorSplatPass`: instanced quads (one per sample), additive blend, into TWO cell-res RTs — `cursorTrail` (R = brighten) and `cursorPush` (RG float = pushX,pushY). Instance attrs: center(cell), radius(cell), alpha, pushCenter(cell), pushRadius(cell), progress, seed. Frag: radial `falloff`; brighten target writes `alpha*falloff`; push target writes `pushScale*alpha*falloff * dir`. Clear both RTs each frame before splatting. Pixelated dissolve via seed+progress. (MRT if available, else two draws.)
- [ ] **Step 2:** `cursorTearPass`: fullscreen over the push RT → `tear` (R) = `clamp01(TEAR_STRENGTH * max(0, positive-divergence(push)))` via neighbour differences (uTexel step = 1/cols,1/rows).
- [ ] **Step 3:** `pir verify` (compile/typecheck) → PASS. **Step 4:** commit `feat(engine): cursor splat (brighten+push float RT) + tear divergence passes`.

### Task 4: Field warp pass + engine wiring (cursor API, sim step, topology)

**Files:** shaders/cursorWarp.frag.ts, passes/cursorWarpPass.ts, engine.ts

- [ ] **Step 1:** `cursorWarp.frag` + `cursorWarpPass`: per field pixel → cell → read brighten/push/tear (nearest, cell-res); warp/thin/lift per the Key formula. `render(target, fieldTex, trailTex, pushTex, tearTex, { cols, rows, cellW, cellH, pixelW, pixelH, pushRange })`.
- [ ] **Step 2:** engine.ts: add `setCursor(x: number|null, y?: number)` to the public API + a `cursorTrailState` (created with a fixed seed start) + a `lastCursorMs` for dt. In `buildPasses`, when `cursorTrail.enabled`: build splat/tear/warp passes; push a field-stage pass (LAST, after edge-mask) that (a) steps the sim `updateCursorTrail(state, clock.now()-lastCursorMs, config.cursorTrail)`, (b) uploads samples to the splat instance buffer + runs splat → tear, (c) warps the current `activeFieldRT` into `pool.get("cursorField", ...)`, then reassign `activeFieldRT = "cursorField"`. Spread in BOTH stripes branches. Topology-gate on `cursorTrail.enabled`; reset sim state on enable. Dispose all passes.
- [ ] **Step 3:** `pir verify` → PASS. `pir test:e2e` → existing 15 UNCHANGED (off ⇒ no cursor passes, activeFieldRT unchanged). **Step 4:** commit `feat(engine): cursor warp field pass + input API (topology-gated, off by default)`.

### Task 5: Lab — pointer input + "Cursor Trail" controls

**Files:** apps/lab/src/LabApp.tsx, controls/levaSchema.ts

- [ ] **Step 1:** In the lab, attach `pointermove`/`pointerleave` on the canvas → `engine.setCursor(localX, localY)` / `setCursor(null)` (convert client→canvas CSS px). Only in interactive (non-manual) mode.
- [ ] **Step 2:** Add a `Cursor Trail` folder exposing the key knobs (enabled, particleRadius, particleAlpha, particleLifeMs, particleSpacingPx, maxEmitPerTick, spreadMin/MaxPx, spinStrength, pushStrengthPx, pushRadiusScale, pushWobblePx) with the legacy ranges; gate non-enabled on `get("Cursor Trail.cursorTrailEnabled")===true`; map into config.
- [ ] **Step 3:** `pir verify` → PASS. Live-verify: move the pointer over the canvas at http://localhost:5174 → confirm a brightening trail + (with pushStrengthPx>0) a visible warp. Temp screenshot, then delete temps.
- [ ] **Step 4:** commit `feat(lab): cursor pointer input + Cursor Trail controls`.

### Task 6: Deterministic golden

**Files:** tests/cursor-trail.spec.ts

- [ ] **Step 1:** Add `__lab` hooks if needed: `cursorTo(x,y)` (→ engine.setCursor) callable in manual mode. Test at `/?manual=1&seed=1&dpr=2&w=400&h=300&hud=0`, `cursorTrail:{enabled:true, pushStrengthPx:30}`: script a path — e.g. `setCursor` at a sequence of points each followed by `renderAt(t)` with fixed dt (so the sim emits + steps deterministically), ending mid-trail; screenshot. Two tests: stripes off (`cursor-trail-field.png`) and stripes on (`cursor-trail-stripes.png`). `maxDiffPixelRatio: 0.01`.
- [ ] **Step 2:** Capture (`--update-snapshots`). READ both PNGs — confirm a curved brightened wake + warp displacement along the scripted path. Run the cursor test a SECOND time (no update) to confirm determinism.
- [ ] **Step 3:** Full `pir test:e2e` → all green (17 now); prior 15 unchanged.
- [ ] **Step 4:** commit `test(engine): cursor-trail goldens (field + stripes)`.

## Self-Review

- **Coverage:** config (T1), sim (T2), GPU accumulation+tear (T3), warp+wiring+input API (T4), lab input+controls (T5), determinism+goldens (T6); default-off invariant (T1, verified T4/T6); float push RT + GPU tear (T3) per the rewrite mandate. ✓
- **Type consistency:** `CursorTrailConfig` identical across types/normalize/engine/lab; `CursorTrailState`/`CursorTrailSample` shared sim↔engine; splat instance attrs match between `cursorSplatPass` and the engine upload; warp `render` opts match the frag uniforms. ✓
- **Risk:** float-RT support (EXT_color_buffer_float) — follow the engine's existing float-RT usage; if unavailable, the perf/visual goldens soft-skip like the 4K perf gate. Determinism relies on fixed-dt stepping + seeded `nextSeed` + scripted path (no rAF in manual mode).
