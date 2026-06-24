# Phase 5 — Edge Mask Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Port the legacy "edge mask" — a separable ramp that fades the field to black near the canvas edges — to the new GPU engine as the LAST field-stage effect (after flames + reveal, before downsample/stripe).

**Architecture:** A stateless fullscreen multiply pass: read the current field RT, multiply its luminance by `edgeMaskAlpha(uv)` (a per-axis ramp product), write to a `maskedField` RT that becomes the new `activeFieldRT`. Pure function of uv + config (trivially deterministic). A pure-TS `edgeMaskMath.ts` holds `edgeMaskAlpha` and is unit-tested; the GLSL frag mirrors it exactly.

**Decisions locked:**

- **Default OFF:** `edgeMask.enabled` default `false` (DEVIATION from legacy `true`) so the existing 13 goldens stay byte-unchanged. (Legacy default was enabled with end 0.1; flipping the default later is a one-liner + golden recapture.)
- **Uniform 4-edge fade** (1:1 with legacy `resolveEdgeMaskAlpha`): same start/end/power for all edges; alpha = ramp(min(u,1-u)) × ramp(min(v,1-v)).
- **Field-stage, last:** runs AFTER flames and reveal, BEFORE downsample/present — so the fade applies to the fully-composed field and shows with stripes on AND off.

**Tech Stack:** raw WebGL2 / GLSL ES 3.00, in-house gl helpers; TypeScript; Vitest; Playwright real-GPU goldens.

## Global Constraints

- pi/pir ONLY (never npm/pnpm/yarn/npx); prefix verify/e2e with `npm_config_store_dir="$HOME/Library/pnpm/store/v10"` if a store mismatch appears. ([[use-pir-for-dev-commands]])
- WebGL2 / `#version 300 es`; compile must throw on failure. ([[webgl1-shader-compat]])
- NO code comments unless asked. Object styles, not string styles.
- Work directly on `main`; commit per task; never push or ask git disposition. ([[work-directly-on-main]], [[no-push-offers-show-results]])
- Goldens use `?hud=0`; darwin-keyed; update with `node_modules/.bin/playwright test <spec> --update-snapshots`. Tolerance `maxDiffPixelRatio: 0.01`.
- ALL existing goldens (field/stripes/reveal×4/sparkle×2/flames×2 = 13) MUST stay byte-unchanged (defaults-off guarantees this).
- Reuse the user's dev server at http://localhost:5174; never spawn a competitor.

## Reference: legacy → new mapping

| Legacy                                                                                                        | New (engine)                                                                             | Notes                                                       |
| ------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| `packages/stripes-shader/src/playgroundEdgeMaskConfig.ts` (type, defaults, normalize, `resolveEdgeMaskAlpha`) | `config/{types,normalize}.ts` + `edgeMask/edgeMaskMath.ts`                               | config + alpha math                                         |
| `resolveEdgeMaskAlpha` applied per-cell in `computeBlockGrid.ts`                                              | `shaders/edgeMask.frag.ts` + `passes/edgeMaskPass.ts` (fullscreen multiply on the field) | applied on the field before downsample, not per-cell on CPU |

## Constants & formula (verbatim from legacy)

- Defaults: `start 0`, `end 0.1`, `power 1`. **`enabled` default `false`** (override of legacy `true`).
- Clamps: `start` `0..0.5`; `end` `(start+0.001)..0.5`; `power` `0.1..4`.
- `resolveEdgeMaskAlpha(u, v, config)`: `end = max(end, start+0.0001)`; `ramp(inset) = clamp((inset-start)/(end-start), 0, 1) ^ power`; `insetX = min(u, 1-u)`, `insetY = min(v, 1-v)`; `alpha = ramp(insetX) * ramp(insetY)`. Disabled → `1`.

## File Structure

**New:**

- `packages/stripes-engine/src/edgeMask/edgeMaskMath.ts` — `edgeMaskAlpha(u,v,config)` (pure-TS reference).
- `packages/stripes-engine/src/edgeMask/edgeMaskMath.test.ts` — unit tests.
- `packages/stripes-engine/src/shaders/edgeMask.frag.ts` — fullscreen ramp-multiply on the field.
- `packages/stripes-engine/src/passes/edgeMaskPass.ts` — fullscreen pass (read field → ×alpha → maskedField).
- `tests/edge-mask.spec.ts` — Playwright golden(s).

**Modified:**

- `packages/stripes-engine/src/config/types.ts` — `EdgeMaskConfig` + `edgeMask` on `EngineConfig`.
- `packages/stripes-engine/src/config/normalize.ts` — `DEFAULT_EDGE_MASK` + `normalizeEdgeMask` + wire-in + `DEFAULT_ENGINE_CONFIG`.
- `packages/stripes-engine/src/config/normalize.test.ts` — clamp/default tests.
- `packages/stripes-engine/src/legacy/migrateLegacyConfig.ts` — default (or best-effort map).
- `packages/stripes-engine/src/engine.ts` — edgeMaskPass after flames+reveal; reassign `activeFieldRT`; topology-gate on `edgeMask.enabled`.

---

### Task 1: Config — `edgeMask` section

**Files:** types.ts, normalize.ts, normalize.test.ts, migrateLegacyConfig.ts

**Interfaces — Produces:**

```ts
interface EdgeMaskConfig {
  enabled: boolean;
  start: number;
  end: number;
  power: number;
}
// EngineConfig gains: edgeMask: EdgeMaskConfig
// DEFAULT_EDGE_MASK = { enabled: false, start: 0, end: 0.1, power: 1 }
// normalizeEdgeMask(partial): start 0..0.5; end clamp((start+0.001)..0.5); power 0.1..4; enabled default false.
```

- [ ] **Step 1:** Add `EdgeMaskConfig` to types.ts + `edgeMask` to `EngineConfig`.
- [ ] **Step 2:** Failing tests in normalize.test.ts: defaults (enabled false, start 0, end 0.1, power 1); clamp start to 0..0.5; end ≥ start+0.001 (e.g. `{start:0.3, end:0.1}` → end ≥ 0.301); power clamp 0.1..4.
- [ ] **Step 3:** `pir verify` → FAIL.
- [ ] **Step 4:** Add `DEFAULT_EDGE_MASK`, `normalizeEdgeMask` (port legacy clamps; enabled default false), wire `edgeMask: normalizeEdgeMask(i.edgeMask)` into `normalizeEngineConfig` + `DEFAULT_ENGINE_CONFIG` + the partial input type; add to migrate output (default or best-effort).
- [ ] **Step 5:** `pir verify` → PASS.
- [ ] **Step 6:** Commit `feat(engine): edge-mask config (default off)`.

### Task 2: Pure-TS math `edgeMaskMath.ts`

**Files:** edgeMask/edgeMaskMath.ts, edgeMask/edgeMaskMath.test.ts

**Interfaces — Produces:** `edgeMaskAlpha(u: number, v: number, config: EdgeMaskConfig): number`

- [ ] **Step 1:** Failing tests: disabled → 1 everywhere; center (0.5,0.5) → 1; a corner (0,0) → 0; with `{start:0, end:0.1, power:1}` an edge-adjacent point like `(0.05, 0.5)` → `0.5` (ramp(0.05)=0.5, ramp(0.5)=1); `power:2` squares the ramp (`(0.05,0.5)` → 0.25); symmetry `alpha(u,v)===alpha(1-u,v)===alpha(u,1-v)`.
- [ ] **Step 2:** `pir verify` → FAIL.
- [ ] **Step 3:** Implement `edgeMaskAlpha` EXACTLY per the legacy `resolveEdgeMaskAlpha` (import `EdgeMaskConfig` from `../config/types`).
- [ ] **Step 4:** `pir verify` → PASS.
- [ ] **Step 5:** Commit `feat(engine): edgeMaskAlpha pure-TS reference`.

### Task 3: GPU pass + shader + engine wiring

**Files:** shaders/edgeMask.frag.ts, passes/edgeMaskPass.ts, engine.ts

**Interfaces — Consumes:** Task 1 config, Task 2 math.

- [ ] **Step 1:** `edgeMask.frag.ts` (`#version 300 es`): `in vec2 vUv; uniform sampler2D uField; uniform float uStart, uEnd, uPower;` GLSL `ramp(inset) = pow(clamp((inset-uStart)/(uEnd-uStart),0.0,1.0), uPower)`; `insetX=min(vUv.x,1-vUv.x)`, `insetY=min(vUv.y,1-vUv.y)`; `a=ramp(insetX)*ramp(insetY)`; `finalColor = vec4(texture(uField,vUv).rgb * a, 1.0)`. Use `FULLSCREEN_VERT`.
- [ ] **Step 2:** `edgeMaskPass.ts`: `createEdgeMaskPass(gl, quad)` → `{ render(target: RenderTarget, fieldTex: WebGLTexture, p: { start, end, power }), dispose() }`. Mirror `createBlurPass`/`createDownsamplePass`: `bindRenderTarget(gl, target)`, useProgram, bind fieldTex to TEXTURE0, set uStart/uEnd/uPower, `quad.draw()`. No blend, no special state.
- [ ] **Step 3:** engine.ts: build `edgeMaskPass` in `buildPasses` when `config.edgeMask.enabled`. After the flames + reveal field passes, push a pass that reads the CURRENT `activeFieldRT` and writes `pool.get("maskedField", fieldSize.width, fieldSize.height, {linear:true})`, then reassign `activeFieldRT = "maskedField"`. Insert in BOTH the stripes-on and stripes-off chains (so `downsample`/`present` read the masked RT). Topology-gate: rebuild on `edgeMask.enabled` flip (track `lastEdgeMaskEnabled`). Wire `dispose`.
- [ ] **Step 4:** `pir verify` → PASS. `pir test:e2e` → existing 13 goldens UNCHANGED (edge mask default off ⇒ activeFieldRT path identical).
- [ ] **Step 5:** Commit `feat(engine): edge-mask field pass (topology-gated, off by default)`.

### Task 4: Lab UI — "Edge Mask" folder

**Files:** apps/lab/src/controls/levaSchema.ts

- [ ] **Step 1:** Add an `Edge Mask` folder: `edgeMaskEnabled` (bool, `d.edgeMask.enabled`); `edgeMaskStart` (`d.edgeMask.start`, min 0, max 0.5, step 0.005, label "Start inset"); `edgeMaskEnd` (`d.edgeMask.end`, min 0, max 0.5, step 0.005, label "End inset"); `edgeMaskPower` (`d.edgeMask.power`, min 0.1, max 4, step 0.05, label "Power"). Gate start/end/power with `render: (get) => get("Edge Mask.edgeMaskEnabled") === true`.
- [ ] **Step 2:** Map into config `edgeMask: { enabled, start, end, power }`.
- [ ] **Step 3:** `pir verify` → PASS. Live-verify on http://localhost:5174 (temp Playwright: enable edge mask with end ~0.2, stripes off → confirm the field darkens to black toward all edges; stripes on → confirm stripes vanish near edges). Delete temps.
- [ ] **Step 4:** Commit `feat(lab): Edge Mask controls`.

### Task 5: Goldens

**Files:** tests/edge-mask.spec.ts

- [ ] **Step 1:** Two tests at `/?manual=1&seed=1&dpr=2&w=400&h=300&hud=0`, `renderAt(0)`, `edgeMask:{enabled:true, start:0.05, end:0.25, power:1.5}`: (a) "edge mask — field" `stripesEnabled:false` → `edge-mask-field.png`; (b) "edge mask — stripes" `stripesEnabled:true` → `edge-mask-stripes.png`. `maxDiffPixelRatio: 0.01`.
- [ ] **Step 2:** Capture (`--update-snapshots`). READ both PNGs — confirm (a) the field is full-strength in the center and fades to black toward every edge; (b) stripes present in the center, absent near edges.
- [ ] **Step 3:** Full `pir test:e2e` → all green (15 now); prior 13 unchanged.
- [ ] **Step 4:** Commit `test(engine): edge-mask goldens (field + stripes)`.

## Self-Review

- **Spec coverage:** config (T1), math (T2), GPU pass + wiring (T3), UI (T4), goldens (T5), uniform-4-edge (T2/T3), default-off invariant (T1, verified T3/T5). ✓
- **Type consistency:** `EdgeMaskConfig{enabled,start,end,power}` identical across types/normalize/engine/lab; `edgeMaskAlpha` signature matches between math + tests; GLSL `uStart/uEnd/uPower` fed from config; `edgeMaskPass.render` opts `{start,end,power}` match. ✓
- **Placeholders:** none — formula, clamps, defaults, placement (after flames+reveal, before downsample/present), and the `activeFieldRT` reassignment are concrete. ✓
