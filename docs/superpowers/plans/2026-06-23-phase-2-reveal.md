# Phase 2 — Reveal (Wave + Assembly) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reimplement the old product's animated **reveal** — both the radial **wave** mode and the **assembly** (fly-in) mode — as a GPU-first, field-first effect in `packages/stripes-engine`, driven by the engine clock and surfaced in `apps/lab`.

**Architecture:** Reveal is a **per-cell mask** that multiplies the downsampled cell-value texture toward 0 _before_ the stripe pass. Unrevealed cells fall below the lowest stripe threshold → no stripe → background shows; partially-revealed cells shift down a band → stripes "grow in." This reuses the existing threshold/LUT machinery for free (exactly how the old Pixi engine did `field * revealMask`). Assembly adds a per-cell **fly-in**: each cell's own rendered content flies in from off-canvas as a soft, low-res blob that **sharpens** into its exact 1:1 stripe as it lands (radial spawn only; **no separate additive-glow layer** — the flying element IS the cell's content). Progress is time-driven off the injectable clock so manual-clock goldens are deterministic.

**Decisions locked (from the user):** (1) **No additive glow overlay** — assembly is the cell's own content flying in soft/low-res and sharpening to 1:1 on arrival. (2) **Radial spawn only** (off-canvas along the center→cell ray); the old `scatter`/`edge` strategies are dropped. (3) **Autoplay on load + a Replay button** — the lab enables + triggers reveal when a texture loads and offers a Replay button; the _engine_ default stays `reveal.enabled: false` so existing goldens (which never enable reveal) are unaffected.

**Tech Stack:** Raw WebGL2 / GLSL ES 3.00 (in-house gl helpers), TypeScript, Leva (lab), Playwright real-GPU visual goldens.

## Global Constraints

- **GL floor:** WebGL2 only, shaders `#version 300 es`; compile must throw on failure. (`[[webgl1-shader-compat]]`)
- **Field-first / GPU-first:** all per-cell work on GPU; no CPU multi-sample reads. (`[[pipeline-field-first-gpu-first]]`)
- **Data textures:** any LUT/index/order texture uploaded as a **raw `Uint8Array` buffer** via `gl/dataTexture.ts`, never a canvas (`unpackColorSpace="display-p3"` corrupts non-grayscale canvas uploads). (`[[gpu-data-textures-must-be-raw-buffers]]`)
- **Topology gating:** `engine.setConfig` rebuilds passes ONLY on a topology change (e.g. `reveal.enabled` flip or `reveal.type` change); per-frame param/progress changes update via uniforms + a dirty signal, never a shader recompile.
- **Goldens:** Playwright visual goldens use `?manual=1&...&hud=0`; the perf overlay/chrome must stay out of the canvas screenshot. Capture/update with `pir test:e2e:update` (pir does NOT forward `--update-snapshots`). Goldens are OS-keyed → Linux CI needs its own.
- **Determinism:** reveal progress = `(clock.now() − startMs) / durationMs`; with the manual clock and `startMs = 0`, `renderAt(ms)` yields an exact progress. Per-cell noise/order hashes must be identical CPU↔GPU.
- **No `prefers-reduced-motion` handling** (user rule override) and **no code comments**.
- Package manager: `pir` for scripts, `pi add` for deps. Work on `main`, no branches; commit per task only when the task's gate is green.

## Reference (old Pixi implementation — read for exact behavior, do NOT port the Pixi/CPU structure)

| Concern                                              | Old file                                                                       |
| ---------------------------------------------------- | ------------------------------------------------------------------------------ |
| Config schema + normalize + duration resolve         | `packages/stripes-shader/src/playgroundRevealConfig.ts`                        |
| CPU reveal math, hashes, order, overshoot consts     | `packages/stripes-shader/src/playgroundReveal.ts`                              |
| Wave GPU field mask                                  | `packages/stripes-shader/src/revealFieldFilter.ts`                             |
| Assembly GPU branch (`uRevealMode=2`) + uniform sync | `packages/stripes-shader/src/stripeFilterShaders.ts`, `stripeDuotoneFilter.ts` |
| Assembly glow overlay (Pixi additive sprites)        | `packages/stripes-shader/src/assemblyGlowOverlay.ts`                           |
| Scene wiring / playback                              | `packages/stripes-shader/src/setupTextureShaderScene.ts`                       |

**Old defaults & constants (carry forward verbatim):**

- Wave: `position:"center"`, `durationMs:1300` (100–30000), `softness:0.16` (0–1), `waviness:0.35` (0–1), `noiseScale:14.5` (0.1–50). Positions (9): `center`, `left top`, `center top`, `right top`, `left center`, `right center`, `left bottom`, `center bottom`, `right bottom`.
- Assembly: `order:"center"` (center|edges|sweep|random), `speedMinMs:300`, `speedMaxMs:1600` (≥min), `staggerMs:900` (0–30000).
- `bandRamp = clamp(330 / durationMs, 0.04, 0.4)`.
- `ASSEMBLY_SETTLE = 0.12`. Wave overshoot `= softness + bandRamp + 0.5*waviness`; assembly overshoot `= max(SETTLE, bandRamp)`.
- Mask math: wave `smoothstep(dist−soft, dist+soft+bandRamp, progress+edgeNoise)`; assembly `arrival = o*(1−flight)*spread + flight`, `smoothstep(arrival, arrival+bandRamp, progress)`.

---

## File Structure

**New:**

- `packages/stripes-engine/src/reveal/revealMath.ts` — pure TS: `cellNoise`, `assemblyOrderNorm`, `waveRevealAt`, `assemblyRevealAt`, `resolveRevealDurationMs`, `resolveBandRamp`, `WAVE_POSITIONS`, origin-from-position. The single source of truth mirrored by the shader.
- `packages/stripes-engine/src/reveal/revealMath.test.ts` — unit tests (numeric goldens + CPU↔intended-GPU parity).
- `packages/stripes-engine/src/shaders/reveal.frag.ts` — fragment shader, masks the cols×rows cell texture.
- `packages/stripes-engine/src/passes/revealPass.ts` — the reveal pass (cell-tex in → masked cell-tex out).
- `packages/stripes-engine/src/shaders/assemblyScatter.vert.ts` + `assemblyScatter.frag.ts` — instanced 40px-block quads that scatter the cols×rows cell texture (each block flies spawn→home, textured from its home region).
- `packages/stripes-engine/src/passes/assemblyScatterPass.ts` — the PRE-STRIPE block fly-in pass (cell texture in → assembled cell texture out, consumed by the stripe pass).
- `tests/reveal-wave.spec.ts`, `tests/reveal-assembly.spec.ts` — visual goldens.

**Modified:**

- `packages/stripes-engine/src/config/types.ts` — add `RevealConfig` + `reveal` on `EngineConfig`.
- `packages/stripes-engine/src/config/normalize.ts` — `DEFAULT_REVEAL`, clamps, normalize.
- `packages/stripes-engine/src/config/serialize.ts` — round-trip `reveal`.
- `packages/stripes-engine/src/legacy/migrateLegacyConfig.ts` + `legacyTypes.ts` — map `PlaygroundRevealConfig` → `reveal`.
- `packages/stripes-engine/src/engine.ts` — insert `revealPass` (wave mask, after downsample before stripe) + `assemblyScatterPass` (assembly, after downsample before stripe — REPLACES the mask for assembly); progress/playback API; topology gating on `reveal.enabled` and `(enabled && type==="assembly")`. NO post-stripe pass.
- `packages/stripes-engine/src/pipeline/pipeline.ts` — allow the reveal/scatter pass between downsample and stripe (the stripe pass stays terminal/unchanged).
- `apps/lab/src/controls/levaSchema.ts` — `Reveal` folder + `Play`/progress wiring.
- `apps/lab/src/LabApp.tsx` — reveal trigger button + progress; expose `__lab.triggerReveal()`.

---

### Task 1: Reveal config (types, normalize, serialize, legacy migrate)

**Files:**

- Modify: `packages/stripes-engine/src/config/types.ts`
- Modify: `packages/stripes-engine/src/config/normalize.ts`
- Modify: `packages/stripes-engine/src/config/serialize.ts`
- Modify: `packages/stripes-engine/src/legacy/migrateLegacyConfig.ts`, `legacyTypes.ts`
- Test: `packages/stripes-engine/src/config/normalize.test.ts` (extend)

**Interfaces — Produces:**

```ts
export type WavePosition =
  | "center"
  | "left top"
  | "center top"
  | "right top"
  | "left center"
  | "right center"
  | "left bottom"
  | "center bottom"
  | "right bottom";
export type AssemblyOrder = "center" | "edges" | "sweep" | "random";
export interface RevealConfig {
  enabled: boolean; // default false
  type: "wave" | "assembly"; // default "wave"
  wave: { position: WavePosition; durationMs: number; softness: number; waviness: number; noiseScale: number };
  assembly: { order: AssemblyOrder; speedMinMs: number; speedMaxMs: number; staggerMs: number };
}
// EngineConfig gains: reveal: RevealConfig
```

- [ ] **Step 1: Write failing tests** — `normalizeEngineConfig({})` yields `DEFAULT_REVEAL` (enabled false, type "wave", wave/assembly defaults above); out-of-range `durationMs`/`softness`/etc. clamp to the documented ranges; `speedMaxMs` is forced `≥ speedMinMs`; an unknown `wave.position`/`assembly.order` falls back to the default; `serializeEngineConfig` → `normalizeEngineConfig` round-trips `reveal` losslessly.
- [ ] **Step 2: Run, verify red** — `pir --filter @necatikcl/stripes-engine test -- normalize`.
- [ ] **Step 3: Implement** — add `RevealConfig` to types; `DEFAULT_REVEAL` + `num()`/`clamp()` normalization in `normalize.ts` (reuse existing helpers; enum guards via `WAVE_POSITIONS.includes(...)`); extend `serialize.ts`.
- [ ] **Step 4: Legacy migrate** — in `migrateLegacyConfig.ts`, map old `PlaygroundRevealConfig` (`{enabled,type,wave:{position,durationMs,softness,waviness,noiseScale},assembly:{speedMinMs,speedMaxMs,staggerMs}}`) into `reveal` (the old `assembly` had no `order` → default `"center"`). Add a migration test asserting an old-format paste produces the right `reveal`.
- [ ] **Step 5: Run, verify green** — `pir --filter @necatikcl/stripes-engine test`.
- [ ] **Step 6: Commit** — `feat(engine): reveal config (types/normalize/serialize/legacy)`.

---

### Task 2: Reveal math module (pure TS, single source of truth)

**Files:**

- Create: `packages/stripes-engine/src/reveal/revealMath.ts`
- Test: `packages/stripes-engine/src/reveal/revealMath.test.ts`

**Interfaces — Produces:**

```ts
export const WAVE_POSITIONS: readonly WavePosition[];
export function originForPosition(p: WavePosition): [number, number]; // 0..1 canvas UV
export function cellNoise(col: number, row: number, scale: number): number; // 0..1, matches old recipe
export function assemblyOrderNorm(col, row, cols, rows, order: AssemblyOrder): number; // 0..1
export function resolveRevealDurationMs(r: RevealConfig): number; // wave.durationMs OR stagger+speedMax
export function resolveBandRamp(durationMs: number): number; // clamp(330/durationMs,0.04,0.4)
export function waveRevealAt(col, row, cols, rows, progress, wave, bandRamp): number; // 0..1
export function assemblyRevealAt(col, row, cols, rows, progress, assembly, bandRamp): number; // 0..1
```

- [ ] **Step 1: Write failing tests** — pin numeric goldens: at the wave origin `progress≥0` gives ≈1; a far corner stays 0 until `progress` passes its distance; `assemblyOrderNorm` for `sweep` equals `col/(cols-1)`, for `center` is 0 at the center cell and ≈1 at a corner, `edges` is its complement; `cellNoise` is deterministic and identical for identical inputs (lock 3–4 exact values to guard the hash recipe). Verify `resolveBandRamp(1300)≈0.2538`, clamps at the ends.
- [ ] **Step 2: Run, verify red** — `pir --filter @necatikcl/stripes-engine test -- revealMath`.
- [ ] **Step 3: Implement** — port the exact hash + order + smoothstep math from old `playgroundReveal.ts` (read it; replicate the Weyl-style `fract(sin(...)*prime)` recipe **bit-for-bit** so it matches the shader). `smoothstep(a,b,x)` helper. `originForPosition` maps the 9 enum strings to `(x,y)` in 0..1.
- [ ] **Step 4: Run, verify green.**
- [ ] **Step 5: Commit** — `feat(engine): reveal math (wave+assembly, CPU reference)`.

---

### Task 3: Wave reveal GPU pass

**Files:**

- Create: `packages/stripes-engine/src/shaders/reveal.frag.ts`
- Create: `packages/stripes-engine/src/passes/revealPass.ts`
- Modify: `packages/stripes-engine/src/engine.ts`, `pipeline/pipeline.ts`
- Test: `tests/reveal-wave.spec.ts`

**Interfaces — Consumes:** the cols×rows cell-value texture produced by `downsamplePass` (single-channel grayscale in `.r`), `uGridCount`. **Produces:** a masked cell-value texture consumed unchanged by `stripePass`.

Shader core (`reveal.frag` — runs on the cell grid, `uRevealMode`: 0 off, 1 wave, 2 assembly later):

```glsl
float v = texture(uCell, vUv).r;
float mask = 1.0;
if (uRevealMode > 0.5) {
  vec2 cellUv = vUv;                       // already cell-centered sampling
  float dist = length(cellUv - uOrigin) / max(uMaxDist, 1e-4);
  vec2 cell = floor(vUv * uGridCount);
  float n = (cellNoise(cell.x, cell.y, uNoiseScale) - 0.5) * uWaviness;
  mask = smoothstep(dist - uSoftness, dist + uSoftness + uBandRamp, uProgress + n);
}
finalColor = vec4(vec3(v * mask), 1.0);
```

`uMaxDist` = max distance from `uOrigin` to any canvas corner (CPU-computed). `cellNoise` GLSL must match `revealMath.cellNoise` exactly.

Engine progress: add `revealStartMs` (default 0). Per frame, `uProgress = (clock.now() − revealStartMs) / resolveRevealDurationMs(reveal)`. Pass gated by `reveal.enabled` (topology rebuild on flip); origin/maxDist/params + progress flow as uniforms each frame (no recompile). Insert `revealPass` strictly between `downsamplePass` and `stripePass`.

- [ ] **Step 1: Write failing visual test** — `tests/reveal-wave.spec.ts`: boot `?manual=1&seed=1&dpr=2&w=400&h=300&hud=0`, `setConfig({ reveal:{ enabled:true, type:"wave" }, stripesEnabled:true })`, `renderAt(650)` (≈ progress 0.5 of the 1300ms default), screenshot `reveal-wave-mid.png`. (First run will fail with no baseline.)
- [ ] **Step 2: Implement** the shader, pass, pipeline insertion, engine progress + topology gating.
- [ ] **Step 3: Capture baseline** — `pir test:e2e:update` then inspect the PNG yourself: a centered circular front, stripes present inside it, background outside, **no gray cell borders** (the existing `1/uDpr` AA in the stripe pass must be unaffected).
- [ ] **Step 4: Verify** — `pir test:e2e` green; existing `field-luminance`/`stripes-luminance` goldens unchanged (reveal disabled by default).
- [ ] **Step 5: Commit** — `feat(engine): wave reveal GPU pass`.

---

### Task 4: Progress/playback API + lab Reveal controls

**Files:**

- Modify: `packages/stripes-engine/src/engine.ts` (+ `index.ts` export)
- Modify: `apps/lab/src/controls/levaSchema.ts`, `apps/lab/src/LabApp.tsx`

**Interfaces — Produces:** `engine.triggerReveal(): void` (sets `revealStartMs = clock.now()`); progress auto-derives from the clock. For deterministic scrubbing the lab maps a 0..1 slider to `revealStartMs = clock.now() − progress*duration`. The **engine default is `reveal.enabled: false`** (goldens safe); **autoplay is a lab behavior**, not an engine default.

- [ ] **Step 1:** Add `triggerReveal()` to the engine + expose on `__lab`.
- [ ] **Step 2:** Lab `Reveal` folder: `enabled` (bool), `type` (Wave/Assembly select), wave params (position select, durationMs, softness, waviness, noiseScale) and assembly params (order select, speedMinMs, speedMaxMs, staggerMs) — ranges per Global Constraints. A `button("Replay")` calling `__lab.triggerReveal()`. (Leva `button` from the schema factory form.)
- [ ] **Step 3: Autoplay on load** — in `LabApp.tsx`, when a texture finishes loading in interactive (non-manual) mode and `reveal.enabled` is on, call `engine.triggerReveal()` once so the reveal plays automatically; the **Replay** button re-triggers. (Hook this into the existing `[textureId]` source-load effect.)
- [ ] **Step 4:** Wire reveal config into the returned `EngineConfig` (it flows through `engine.setConfig`). In non-manual mode the running clock animates it from the trigger point.
- [ ] **Step 5: Verify live** — `pir --filter lab dev`, confirm wave autoplays on load, Replay re-runs, and scrubbing works; `pir verify` green.
- [ ] **Step 6: Commit** — `feat(lab): reveal controls + autoplay-on-load + replay`.

---

### Task 5: Assembly reveal mask

**Files:**

- Modify: `packages/stripes-engine/src/shaders/reveal.frag.ts`, `passes/revealPass.ts`, `engine.ts`
- Test: `tests/reveal-assembly.spec.ts`

Add the `uRevealMode==2` branch:

```glsl
float o = assemblyOrderNorm(cell.x, cell.y, uGridCount.x, uGridCount.y, uOrder);
float flight = (uSpeedMin + (uSpeedMax - uSpeedMin) * cellNoise(cell.x, cell.y, 1.0)) / uTotal;
float arrival = o * (1.0 - flight) * uSpread + flight;
mask = smoothstep(arrival, arrival + uBandRamp, uProgress);
```

`uTotal = staggerMs + speedMaxMs`, `uSpread = staggerMs / uTotal`. `assemblyOrderNorm` GLSL mirrors `revealMath.assemblyOrderNorm` exactly. Progress duration uses `resolveRevealDurationMs` (assembly branch).

- [ ] **Step 1: Write failing visual test** — `tests/reveal-assembly.spec.ts`: `setConfig({ reveal:{ enabled:true, type:"assembly", assembly:{ order:"center" } } })`, `renderAt(1250)` (≈ progress 0.5 of 2500ms), screenshot `reveal-assembly-mid.png`.
- [ ] **Step 2: Implement** the assembly branch + uniforms + topology rebuild on `reveal.type` change.
- [ ] **Step 3: Capture + inspect** — center cells revealed first, a staggered front by order; verify against `assemblyRevealAt` expectations at a few cells.
- [ ] **Step 4: Verify** — `pir test:e2e` green; wave + default goldens unchanged.
- [ ] **Step 5: Commit** — `feat(engine): assembly reveal mask`.

---

### Task 6: Assembly block fly-in (PRE-STRIPE field scatter)

**Files:**

- Create: `packages/stripes-engine/src/shaders/assemblyScatter.vert.ts` + `assemblyScatter.frag.ts`, `packages/stripes-engine/src/passes/assemblyScatterPass.ts`
- Modify: `packages/stripes-engine/src/engine.ts` (insert the scatter pass for assembly BEFORE the stripe pass, replacing the wave mask routing for assembly), `pipeline/pipeline.ts` if needed
- Test: re-capture `reveal-assembly-mid` + add `reveal-assembly-flyin`

**BASE RULE (non-negotiable, from the user):** the effect runs ENTIRELY BEFORE the stripe pass, on the cell texture. The stripe pass is UNCHANGED and renders 1:1 SHARP on whatever the assembled field is. Nothing is drawn on top of stripes — NO post-stripe pass, NO glow, NO blur of the stripe output.

The flying units are **40×40 CSS-px blocks** (NOT per stripe-cell — far fewer particles, ~ `(cssW/40)×(cssH/40)`). Each block carries its home slice of the cell texture and flies from an off-canvas spawn to its home, locking into the grid. Implementation:

- A PRE-STRIPE pass renders the assembled cols×rows cell texture that the stripe pass then consumes. Clear to background (0).
- **Block size** = a fixed integer number of cells closest to 40px (`blockCells = max(1, round(40 / cellPx))`), so blocks TILE the cell grid exactly and map 1:1 at home (this guarantees the f=1 identity below).
- **Instanced block quads**: one instance per block (block grid = `ceil(cols/blockCells) × ceil(rows/blockCells)`). Per block: `homeRect` = its cell-region; `outwardDir = normalize(blockHomeCenterUV − vec2(0.5))` (guard center); `spawn = home + outwardDir·spawnDist` (push fully off-canvas). Per-block flight `f = clamp((progress − start)/flight, 0, 1)` using the assembly order/timing from `revealMath` evaluated at BLOCK granularity (block-center index → `assemblyOrderNorm`). Draw the quad at `mix(spawn, home, ease(f))`, textured by sampling the source cell texture at the block's `homeRect` → the block's SHARP stripe-content flies in.
- Blocks with `progress < start` are not drawn (background). At `f = 1` every block sits exactly at home with 1:1 texel mapping → the assembled cell texture **equals the source cell texture exactly** → stripes render pixel-identical to no-reveal. Once all blocks land it is a pure passthrough.
- Overlap: blocks tile exactly at home (no overlap); transient flight overlap resolves by overwrite (or draw in arrival order). Instance count is the bounded block grid — no per-pixel cap needed.

- [ ] **Step 1:** Extend `tests/reveal-assembly.spec.ts`: re-capture `reveal-assembly-mid` (renderAt 1250) + add `reveal-assembly-flyin` (renderAt 900).
- [ ] **Step 2: Implement** the instanced block-scatter vert+frag, the pass, engine wiring (scatter pass replaces the assembly mask routing; runs after downsample, before stripe), topology gate on `(enabled && type==="assembly")`.
- [ ] **Step 3: Capture + READ both PNGs** — confirm discrete ~40px SHARP stripe-blocks flying in from off-canvas toward home; landed (center-first) blocks crisp; unlanded = background; final state == exact logo. Debug if it smears or never resolves; do NOT accept a bad golden.
- [ ] **Step 4: Verify** — `pir test:e2e`: `field`, `stripes`, `reveal-wave-mid` UNCHANGED; perf 4K within budget.
- [ ] **Step 5: Commit** — `feat(engine): assembly block fly-in (pre-stripe field scatter)`.

---

### Task 7: Perf gate + phase cleanup

**Files:** `tests/*` (perf assertions), docs/memory.

- [ ] **Step 1:** Extend the 4K perf gate to render with reveal animating (wave and assembly) and assert p50 within budget (target ≤ frame budget at 60fps; soft-skip on software GL as today).
- [ ] **Step 2:** Confirm topology gating: toggling `reveal.enabled`/`type` recompiles once; param/progress changes do not (assert no recompile via a spy or by timing).
- [ ] **Step 3:** Update `docs/engine-architecture.md` (reveal pass placement) and the memory file `[[gpu-engine-rewrite-progress]]` (Phase 2 done, defaults, glow approach, golden names).
- [ ] **Step 4: Commit** — `chore(engine): phase-2 perf gate + docs`.

---

## Self-Review

- **Spec coverage:** wave (Task 3) + assembly mask (Task 5) + assembly glow (Task 6) + config/migration (Task 1) + controls (Task 4) + perf/cleanup (Task 7) cover the old reveal feature set. Wave positions, assembly orders, all old defaults, bandRamp, overshoot constants carried in Tasks 1–2.
- **Type consistency:** `RevealConfig`, `WavePosition`, `AssemblyOrder` defined in Task 1 and reused verbatim in Tasks 2–6; `revealMath` signatures fixed in Task 2 and mirrored by shaders in Tasks 3/5/6.
- **Determinism:** every visual test uses `manual=1` + fixed `seed`/`dpr` + a `renderAt(ms)` that maps to an exact progress; CPU↔GPU hash parity locked in Task 2.
- **Decisions (resolved with the user):**
  1. **No additive glow.** Assembly = the cell's own content flying in soft/low-res and sharpening to 1:1 on landing (Task 6 rewritten accordingly).
  2. **Radial spawn only.** The old `scatter`/`edge` strategies are dropped.
  3. **Autoplay on load + Replay button.** Engine default `reveal.enabled: false` (goldens safe); the lab enables + auto-triggers reveal on texture load and offers a Replay button (Task 4).
