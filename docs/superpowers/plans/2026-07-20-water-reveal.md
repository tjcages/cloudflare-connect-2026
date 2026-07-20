# Water Reveal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** New reveal type `"water"` — a ghost cursor serpentine-sweeps the canvas laying real water ripples (same wave-equation sim as the cursor trail's wave mode); an accumulation buffer records where ripple energy has passed and becomes the reveal mask, so the image fills in the wake of the strokes while the live wavefront refracts freshly revealed pixels.

**Architecture:** A dedicated `waterRevealSim` (forked concept from `cursorTrail/waterSim.ts`) owns two ping-pongs: the RG float height/velocity sim (reuses `WATER_SIM_FRAG` + `createWaterSimPass`) and a single-channel coverage accumulator (`cover = max(prev, smoothstep(lo, hi, |h|))`, monotonic). A pure `serpentinePoint()` driver in `revealMath.ts` converts reveal progress to ghost-cursor positions. A new `waterRevealPass` writes `revealedField = displaced(field) × cover`, slotting into the existing reveal branch chain in `engine.ts` exactly like `vortexPass` does. Spec: `docs/superpowers/specs/2026-07-20-water-reveal-design.md`.

**Tech Stack:** TypeScript, raw WebGL2 (#version 300 es shaders), vitest, leva (lab controls).

## Global Constraints

- WebGL2 / GLSL ES 3.00 only; shader compile must throw on failure (existing `compileProgram` does this).
- Engine steady state after the reveal completes must be byte-identical to no-reveal (passthrough copy, no residual sim influence).
- If `EXT_color_buffer_float` is unavailable, the sim disables itself with one `console.warn` and the mask snaps to fully revealed (waterSim's pattern).
- No code comments unless they state a non-obvious constraint (user rule); match surrounding style.
- Git: work directly on `main`. The working tree already has UNRELATED dirty files (`packages/stripes-engine/src/flames/flamesSim.ts`, `flamesSim.test.ts`) — NEVER `git add` them; always add only the files you touched, by exact path.
- Run tests from repo root with `pir test -- <path>` or from `packages/stripes-engine` with `pir test` (vitest). Use `pir`, never npm/pnpm directly.
- Reveal knob naming hazard: `resolveRevealDurationMs` (packages/stripes-engine/src/reveal/revealMath.ts:53-57) indexes `r[r.type]` and reads `staggerMs + speedMaxMs`. Water's knobs differ, so it gets an explicit branch there AND in the lab mirror `apps/lab/src/connectShader/underlayIntro.ts`.

---

### Task 1: Config plumbing — types, normalize, duration resolution, lab mirror

**Files:**

- Modify: `packages/stripes-engine/src/config/types.ts` (union at line ~14, RevealConfig at ~29-51)
- Modify: `packages/stripes-engine/src/config/normalize.ts` (REVEAL_TYPES ~241, DEFAULT_REVEAL ~242-267, block normalizers ~310-328, return object ~357-360, DEFAULT_ENGINE_CONFIG.reveal clone ~821-828)
- Modify: `packages/stripes-engine/src/reveal/revealMath.ts` (resolveRevealDurationMs, lines 53-57)
- Modify: `apps/lab/src/connectShader/underlayIntro.ts` (RevealTypeLike/RevealLike ~5-23)
- Test: `packages/stripes-engine/src/reveal/revealMath.test.ts`, `packages/stripes-engine/src/config/normalize.test.ts`, `apps/lab/src/connectShader/underlayIntro.test.ts`

**Interfaces:**

- Consumes: existing `RevealConfig`, `normalizeReveal`, clamp helpers already used by `normalizeWarpStyleBlock` (read that function and reuse its exact helpers).
- Produces: the `WaterRevealConfig` shape every later task relies on:

```ts
export interface WaterRevealConfig {
  durationMs: number;
  settleMs: number;
  rows: number;
  intensity: number;
  wobble: number;
  refraction: number;
  softness: number;
}
```

with defaults `{ durationMs: 2600, settleMs: 900, rows: 5, intensity: 0.85, wobble: 0.5, refraction: 1, softness: 0.35 }`, and `resolveRevealDurationMs` returning `durationMs + settleMs` for water.

- [ ] **Step 1: Write the failing tests**

In `revealMath.test.ts`, mirror the existing vortex duration case (lines ~92-93):

```ts
it("resolves water duration as durationMs + settleMs", () => {
  const water = normalizeReveal({ enabled: true, type: "water" });
  expect(resolveRevealDurationMs(water)).toBe(2600 + 900);
});
```

In `normalize.test.ts`, mirror the existing vortex normalization tests (find them by searching `vortex`); add:

```ts
it("defaults and clamps the water reveal block", () => {
  const r = normalizeReveal({ enabled: true, type: "water" });
  expect(r.type).toBe("water");
  expect(r.water).toEqual({
    durationMs: 2600,
    settleMs: 900,
    rows: 5,
    intensity: 0.85,
    wobble: 0.5,
    refraction: 1,
    softness: 0.35,
  });
  const clamped = normalizeReveal({
    enabled: true,
    type: "water",
    water: { durationMs: -5, settleMs: -5, rows: 99, intensity: 99, wobble: 9, refraction: 99, softness: 9 },
  });
  expect(clamped.water.durationMs).toBeGreaterThan(0);
  expect(clamped.water.rows).toBeLessThanOrEqual(24);
  expect(clamped.water.wobble).toBe(1);
  expect(clamped.water.softness).toBe(1);
});
```

In `underlayIntro.test.ts`, mirror the per-type cases (lines ~11-60) with a water case asserting the same delay rule the file applies to other timed types, using `durationMs + settleMs` as the total (read the file first; keep its existing delay formula, just feed water's total).

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd packages/stripes-engine && pir test -- src/reveal/revealMath.test.ts src/config/normalize.test.ts`
Expected: FAIL — type errors / `water` unknown.

- [ ] **Step 3: Implement**

`types.ts`:

- Line 14: `export type RevealType = "wave" | "assembly" | "turbulence" | "glitch" | "vortex" | "water";`
- Add the `WaterRevealConfig` interface (exact shape above) next to `VortexRevealConfig`.
- Add `water: WaterRevealConfig;` to `RevealConfig`.

`normalize.ts`:

- Add `"water"` to `REVEAL_TYPES`.
- Add the default block to `DEFAULT_REVEAL`: `water: { durationMs: 2600, settleMs: 900, rows: 5, intensity: 0.85, wobble: 0.5, refraction: 1, softness: 0.35 }`.
- Add `water?: Partial<WaterRevealConfig>;` to the `PartialReveal` input shim.
- Write `normalizeWaterBlock` beside `normalizeVortexBlock`, reusing the same clamp helper the warp block uses (clamp ranges: durationMs 1..60000, settleMs 0..20000, rows 1..24 rounded, intensity 0..3, wobble 0..1, refraction 0..4, softness 0..1).
- Wire into `normalizeReveal`'s return: `water: normalizeWaterBlock(i.water ?? a.water, DEFAULT_REVEAL.water),`.
- Add `water: { ...DEFAULT_REVEAL.water },` to `DEFAULT_ENGINE_CONFIG.reveal` (~line 827).

`revealMath.ts` (lines 53-57):

```ts
export function resolveRevealDurationMs(r: RevealConfig): number {
  if (r.type === "wave") return r.wave.durationMs;
  if (r.type === "water") return r.water.durationMs + r.water.settleMs;
  const block = r.type === "assembly" ? r.assembly : r[r.type];
  return block.staggerMs + block.speedMaxMs;
}
```

`underlayIntro.ts`: add `"water"` to `RevealTypeLike`, add `water: { durationMs: number; settleMs: number }` to `RevealLike`, and an explicit branch returning the file's existing delay formula computed from `durationMs + settleMs` (mirror how it treats `wave.durationMs`).

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd packages/stripes-engine && pir test` then `cd ../../apps/lab && pir test -- src/connectShader/underlayIntro.test.ts`
Expected: PASS, including all pre-existing tests (typecheck-sensitive files like `engine.ts` may now error on exhaustive switches — if `revealPassKind` or the engine branch chain fails typecheck, that fix belongs to Task 4; only if the package typecheck runs as part of `pir test` and fails, add the minimal `case "water": return "water";` stub to `revealPassKind` now and note it in the report).

- [ ] **Step 5: Commit**

```bash
git add packages/stripes-engine/src/config/types.ts packages/stripes-engine/src/config/normalize.ts packages/stripes-engine/src/config/normalize.test.ts packages/stripes-engine/src/reveal/revealMath.ts packages/stripes-engine/src/reveal/revealMath.test.ts apps/lab/src/connectShader/underlayIntro.ts apps/lab/src/connectShader/underlayIntro.test.ts
git commit -m "feat(engine): water reveal config plumbing"
```

---

### Task 2: Serpentine ghost-cursor driver

**Files:**

- Modify: `packages/stripes-engine/src/reveal/revealMath.ts`
- Test: `packages/stripes-engine/src/reveal/revealMath.test.ts`

**Interfaces:**

- Produces: `export function serpentinePoint(progress: number, rows: number, wobble: number): { x: number; y: number }` — normalized 0..1 canvas coords (y down). Task 3's sim consumes exactly this signature.

- [ ] **Step 1: Write the failing tests**

```ts
describe("serpentinePoint", () => {
  it("starts at the left of the top row and ends at the right or left of the bottom row", () => {
    const start = serpentinePoint(0, 5, 0);
    expect(start.x).toBeCloseTo(0, 5);
    expect(start.y).toBeLessThan(0.2);
    const end = serpentinePoint(1, 5, 0);
    expect(end.y).toBeGreaterThan(0.8);
  });
  it("alternates sweep direction per row", () => {
    const rows = 4;
    const early = serpentinePoint(0.1 / rows, rows, 0);
    const later = serpentinePoint(0.9 / rows, rows, 0);
    expect(later.x).toBeGreaterThan(early.x);
    const row2early = serpentinePoint(1.1 / rows, rows, 0);
    const row2later = serpentinePoint(1.9 / rows, rows, 0);
    expect(row2later.x).toBeLessThan(row2early.x);
  });
  it("descends monotonically without wobble", () => {
    let prevY = -1;
    for (let t = 0; t <= 1.0001; t += 0.01) {
      const { y } = serpentinePoint(Math.min(1, t), 6, 0);
      expect(y).toBeGreaterThanOrEqual(prevY);
      prevY = y;
    }
  });
  it("clamps progress and keeps wobble inside the canvas", () => {
    expect(serpentinePoint(-1, 5, 1).y).toBeCloseTo(serpentinePoint(0, 5, 1).y, 5);
    expect(serpentinePoint(2, 5, 1).y).toBeCloseTo(serpentinePoint(1, 5, 1).y, 5);
    for (let t = 0; t <= 1.0001; t += 0.01) {
      const p = serpentinePoint(Math.min(1, t), 3, 1);
      expect(p.x).toBeGreaterThanOrEqual(0);
      expect(p.x).toBeLessThanOrEqual(1);
      expect(p.y).toBeGreaterThanOrEqual(0);
      expect(p.y).toBeLessThanOrEqual(1);
    }
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd packages/stripes-engine && pir test -- src/reveal/revealMath.test.ts`
Expected: FAIL — `serpentinePoint` not exported.

- [ ] **Step 3: Implement in `revealMath.ts`**

```ts
export function serpentinePoint(progress: number, rows: number, wobble: number): { x: number; y: number } {
  const r = Math.max(1, Math.round(rows));
  const t = Math.min(1, Math.max(0, progress));
  const f = Math.min(r - 1e-6, t * r);
  const row = Math.floor(f);
  const frac = f - row;
  const x = row % 2 === 0 ? frac : 1 - frac;
  const half = 1 / (2 * r);
  const yBase = half + t * (1 - 2 * half);
  const wobbleAmp = (wobble * 0.35) / r;
  const wob = Math.sin(frac * Math.PI * 5 + row * 1.7) * wobbleAmp;
  const y = Math.min(1, Math.max(0, yBase + wob));
  return { x, y };
}
```

Note: the monotonic-descent test uses `wobble: 0`, so `wob` is 0 there and `yBase` is linear in `t` — monotone. With wobble the clamp keeps it in-canvas.

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd packages/stripes-engine && pir test -- src/reveal/revealMath.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/stripes-engine/src/reveal/revealMath.ts packages/stripes-engine/src/reveal/revealMath.test.ts
git commit -m "feat(engine): serpentine ghost-cursor driver for water reveal"
```

---

### Task 3: Water reveal sim, shaders, and pass

**Files:**

- Create: `packages/stripes-engine/src/shaders/waterRevealAccum.frag.ts`
- Create: `packages/stripes-engine/src/shaders/waterReveal.frag.ts`
- Create: `packages/stripes-engine/src/passes/waterRevealPass.ts`
- Create: `packages/stripes-engine/src/reveal/waterRevealSim.ts`

**Interfaces:**

- Consumes: `serpentinePoint` from `../reveal/revealMath` (Task 2); `createWaterSimPass` + `WaterSimStep` from `../passes/waterSimPass`; `createPingPong(gl, w, h, { float?, linear? })` from `../gl/pingPong`; `bindRenderTarget` from `../gl/renderTarget`; `WATER_SIM_FRAG` untouched.
- Produces (Task 4 consumes exactly these):

```ts
export type WaterRevealTextures = {
  height: WebGLTexture;
  cover: WebGLTexture;
  texelX: number;
  texelY: number;
};
export type WaterRevealSim = {
  tick(p: {
    sweepT: number;
    settleT: number;
    displayWidth: number;
    displayHeight: number;
    rows: number;
    wobble: number;
    intensity: number;
    softness: number;
  }): void;
  current(): WaterRevealTextures | null;
  dispose(): void;
};
export function createWaterRevealSim(gl: WebGL2RenderingContext, quad: { draw(): void }): WaterRevealSim;
```

```ts
export function createWaterRevealPass(
  gl: WebGL2RenderingContext,
  quad: { draw(): void },
): {
  render(
    target: RenderTarget,
    fieldTex: WebGLTexture,
    sim: WaterRevealTextures | null,
    p: { refraction: number },
  ): void;
  dispose(): void;
};
```

`render` with `sim === null` must be a pure passthrough (`revealedField = field`, mask 1, no displacement) — this is both the pre-float-extension fallback and the post-reveal steady state.

- [ ] **Step 1: Write the shaders**

`waterRevealAccum.frag.ts`:

```ts
export const WATER_REVEAL_ACCUM_FRAG = `#version 300 es
precision highp float;
in vec2 vUv;
uniform sampler2D uPrevCover;
uniform sampler2D uHeight;
uniform float uThreshLo;
uniform float uThreshHi;
uniform float uFillFloor;
out vec4 outColor;

void main() {
  float prev = texture(uPrevCover, vUv).r;
  float h = abs(texture(uHeight, vUv).r);
  float energy = smoothstep(uThreshLo, uThreshHi, h);
  float cover = max(max(prev, energy), uFillFloor);
  outColor = vec4(cover, 0.0, 0.0, 1.0);
}
`;
```

`waterReveal.frag.ts`:

```ts
export const WATER_REVEAL_FRAG = `#version 300 es
precision highp float;
in vec2 vUv;
uniform sampler2D uField;
uniform sampler2D uCover;
uniform sampler2D uHeight;
uniform vec2 uHeightTexel;
uniform float uRefraction;
uniform float uActive;
out vec4 finalColor;

void main() {
  if (uActive < 0.5) {
    finalColor = vec4(vec3(texture(uField, vUv).r), 1.0);
    return;
  }
  float hL = texture(uHeight, vUv - vec2(uHeightTexel.x, 0.0)).r;
  float hR = texture(uHeight, vUv + vec2(uHeightTexel.x, 0.0)).r;
  float hT = texture(uHeight, vUv + vec2(0.0, uHeightTexel.y)).r;
  float hB = texture(uHeight, vUv - vec2(0.0, uHeightTexel.y)).r;
  vec2 grad = vec2(hR - hL, hT - hB);
  vec2 uv = clamp(vUv - grad * uRefraction * 0.04, 0.0, 1.0);
  float v = texture(uField, uv).r;
  float crest = max(texture(uHeight, vUv).r, 0.0);
  v = clamp(v + crest * uRefraction * 0.22, 0.0, 1.0);
  float cover = texture(uCover, vUv).r;
  finalColor = vec4(vec3(v * cover), 1.0);
}
`;
```

- [ ] **Step 2: Write `waterRevealPass.ts`**

Mirror `waterSimPass.ts` / `revealPass.ts` structure exactly (compileProgram, uniform lookup table, bindRenderTarget, texture units 0=field, 1=cover, 2=height). When `sim` is null: bind only `uField`, set `uActive` 0 (bind field texture to units 1 and 2 as well so no unit is left with a stale/incomplete texture). When sim present: `uActive` 1, `uHeightTexel` = (texelX, texelY), `uRefraction` from params.

- [ ] **Step 3: Write `waterRevealSim.ts`**

Fork the skeleton of `cursorTrail/waterSim.ts` (read it first; keep its constants where meaningful). Key structure:

```ts
import { serpentinePoint } from "./revealMath";
import { createPingPong, type PingPong } from "../gl/pingPong";
import { bindRenderTarget } from "../gl/renderTarget";
import { createWaterSimPass } from "../passes/waterSimPass";
import { compileProgram } from "../gl/program"; // only if accum needs a bespoke mini-pass; otherwise write a tiny inline pass like waterSimPass

const RESOLUTION_DIVISOR = 2;
const MAX_SIM_EDGE = 420;
const SUBSTEPS = 15;
const SPLAT_AMP_PER_STEP = 0.5;
```

Behavior:

- Lazy-create on first tick: height ping-pong `createPingPong(gl, sw, sh, { float: true, linear: true })` (guard `EXT_color_buffer_float` exactly like waterSim: on throw → `disabled = true`, `console.warn("[stripes-engine] water reveal sim disabled:", error)`, `current()` returns null forever). Cover ping-pong `createPingPong(gl, sw, sh, { linear: true })` (non-float). Clear both to black on create/resize.
- Resolution: same divisor/cap math as waterSim (`RESOLUTION_DIVISOR`, `MAX_SIM_EDGE`).
- Replay detection: keep `lastSweepT`; if `p.sweepT < lastSweepT`, clear both ping-pongs and reset internal prev-point state. Update `lastSweepT` each tick.
- Each tick while `sweepT < 1`: `const pt = serpentinePoint(p.sweepT, p.rows, p.wobble)`; convert to sim pixels with GL y-flip: `sx = pt.x * sw`, `sy = (1 - pt.y) * sh`. First tick after reset: prev = current (zero-length splat). Splat radius: `const radius = Math.max(3, sh / (Math.max(1, p.rows) * 2.2))`. Amp: `p.intensity * SPLAT_AMP_PER_STEP`. Run SUBSTEPS sim steps interpolating prev→current segment exactly as `waterSim.step` does (t0/t1 slices), swapping the height ping-pong per substep.
- During settle (`sweepT >= 1`): keep running SUBSTEPS sim steps per tick with `amp: 0` so waves ring down.
- After the height steps, run ONE accumulation step per tick: render into cover write target with `uPrevCover` = cover read, `uHeight` = height read, `uThreshLo = 0.015`, `uThreshHi = 0.015 + Math.max(0.01, p.softness * 0.25)`, `uFillFloor = smoothstep01((p.settleT - 0.35) / 0.55)` (clamped 0..1, i.e. floor starts rising at settleT 0.35 and reaches 1 by 0.9); swap cover.
- `current()` returns null while disabled or before first tick; else `{ height: heightPingPong.read().texture, cover: coverPingPong.read().texture, texelX: 1/sw, texelY: 1/sh }`.

- [ ] **Step 4: Typecheck and run the full engine test suite**

Run: `cd packages/stripes-engine && pir test`
Expected: PASS (no unit tests for GL code; this gate is typecheck + no regressions).

- [ ] **Step 5: Commit**

```bash
git add packages/stripes-engine/src/shaders/waterRevealAccum.frag.ts packages/stripes-engine/src/shaders/waterReveal.frag.ts packages/stripes-engine/src/passes/waterRevealPass.ts packages/stripes-engine/src/reveal/waterRevealSim.ts
git commit -m "feat(engine): water reveal sim, shaders, and pass"
```

---

### Task 4: Engine integration

**Files:**

- Modify: `packages/stripes-engine/src/engine.ts` (`revealPassKind` ~204-210; reveal branch chain in `buildPasses` ~590-757)
- Test: `packages/stripes-engine/src/engine.topology.test.ts`

**Interfaces:**

- Consumes: `createWaterRevealSim`, `createWaterRevealPass` (Task 3 signatures verbatim); `resolveRevealDurationMs` water branch (Task 1); existing `revealStartMs`, `clock`, `pool`, `revealFieldPasses` machinery.
- Produces: reveal type `"water"` fully renders; `revealPassKind()` returns `"water"` so type switches rebuild passes.

- [ ] **Step 1: Write the failing topology test**

In `engine.topology.test.ts`, mirror the vortex cases (revealKind helper at ~6-15, rebuild test ~100):

```ts
expect(revealKind({ enabled: true, type: "water" })).toBe("water");
```

and a "switching water <-> wave triggers rebuild" case copied from the vortex<->glitch pattern.

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/stripes-engine && pir test -- src/engine.topology.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement**

`revealPassKind()`: add `if (t === "water") return "water";` (extend the kind union with `"water"`).

In `buildPasses`, insert a new branch BEFORE the wave else-branch, modeled line-for-line on the vortex branch's lifecycle (read it first — pass creation, `revealFieldPasses.push`, dispose handling):

```ts
} else if (revealEnabled && config.reveal.type === "water") {
  const w = config.reveal.water;
  const sim = createWaterRevealSim(gl, quad);
  const waterPass = createWaterRevealPass(gl, quad);
  const durationMs = Math.max(1, w.durationMs);
  const settleMs = Math.max(0, w.settleMs);
  revealFieldPasses.push({
    render() {
      const fieldRT = pool.get("field", fieldW, fieldH);
      const revealedRT = pool.get("revealedField", fieldW, fieldH);
      const elapsed = clock.now() - revealStartMs;
      const sweepT = Math.min(1, Math.max(0, elapsed / durationMs));
      const settleT =
        settleMs <= 0
          ? sweepT >= 1 ? 1 : 0
          : Math.min(1, Math.max(0, (elapsed - durationMs) / settleMs));
      const done = sweepT >= 1 && settleT >= 1;
      if (!done) {
        sim.tick({
          sweepT, settleT,
          displayWidth: cssW, displayHeight: cssH,
          rows: w.rows, wobble: w.wobble,
          intensity: w.intensity, softness: w.softness,
        });
      }
      waterPass.render(revealedRT, fieldRT.texture, done ? null : sim.current(), {
        refraction: w.refraction,
      });
    },
    dispose() {
      sim.dispose();
      waterPass.dispose();
    },
  });
}
```

IMPORTANT: adapt the identifier names (`fieldW`, `fieldH`, `cssW`, `cssH`, the `Pass` object shape, how `pool.get` is called) to what the surrounding branches actually use — copy the vortex/wave branches' exact conventions rather than trusting the sketch above. The sketch is the logic; the neighbors are the syntax.

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd packages/stripes-engine && pir test`
Expected: PASS, all suites.

- [ ] **Step 5: Commit**

```bash
git add packages/stripes-engine/src/engine.ts packages/stripes-engine/src/engine.topology.test.ts
git commit -m "feat(engine): water reveal renders via dedicated sim branch"
```

---

### Task 5: Lab wiring — dropdown, knobs, defaults

**Files:**

- Modify: `apps/lab/src/controls/levaSchema.ts` (dropdown ~1701-1712; per-type panels — add after vortex block ~1897-1951; values→config mapping ~2431-2472)
- Modify: `apps/lab/src/defaultLabConfig.ts` (reveal ~153-183)
- Modify: `apps/lab/src/factoryDefaults.json` (reveal ~122-165)

**Interfaces:**

- Consumes: `WaterRevealConfig` field names from Task 1 — the mapping object must produce exactly `{ durationMs, settleMs, rows, intensity, wobble, refraction, softness }`.
- Produces: "Water" selectable in the lab's Reveal dropdown with 7 knobs; defaults JSONs carry the water block.

- [ ] **Step 1: Add the dropdown option**

In the `revealType` options object add `Water: "water"` after `Vortex`.

- [ ] **Step 2: Add the control block**

Copy the vortex block's exact leva syntax (labels, folder, `render: (get) => get("Reveal.revealType") === "water"` gating) with these controls:

```ts
revealWaterDurationMs: { value: 2600, min: 400, max: 8000, step: 50, label: "Sweep ms", render: waterGate },
revealWaterSettleMs: { value: 900, min: 0, max: 4000, step: 50, label: "Settle ms", render: waterGate },
revealWaterRows: { value: 5, min: 1, max: 12, step: 1, label: "Rows", render: waterGate },
revealWaterIntensity: { value: 0.85, min: 0, max: 1.5, step: 0.01, label: "Intensity", render: waterGate },
revealWaterWobble: { value: 0.5, min: 0, max: 1, step: 0.01, label: "Wobble", render: waterGate },
revealWaterRefraction: { value: 1, min: 0, max: 2, step: 0.01, label: "Refraction", render: waterGate },
revealWaterSoftness: { value: 0.35, min: 0, max: 1, step: 0.01, label: "Softness", render: waterGate },
```

(`waterGate` = whatever gating idiom the vortex block uses, inlined per control if that's the file's style.)

- [ ] **Step 3: Map values→config**

In the reveal mapping (~2464-2471 region), after the vortex object add:

```ts
water: {
  durationMs: values.revealWaterDurationMs,
  settleMs: values.revealWaterSettleMs,
  rows: values.revealWaterRows,
  intensity: values.revealWaterIntensity,
  wobble: values.revealWaterWobble,
  refraction: values.revealWaterRefraction,
  softness: values.revealWaterSoftness,
},
```

- [ ] **Step 4: Add water blocks to `defaultLabConfig.ts` and `factoryDefaults.json`**

Mirror the vortex entries with the Task 1 default values (JSON: `"water": { "durationMs": 2600, "settleMs": 900, "rows": 5, "intensity": 0.85, "wobble": 0.5, "refraction": 1, "softness": 0.35 }`).

- [ ] **Step 5: Run lab tests + typecheck**

Run: `cd apps/lab && pir test`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/lab/src/controls/levaSchema.ts apps/lab/src/defaultLabConfig.ts apps/lab/src/factoryDefaults.json
git commit -m "feat(lab): water reveal controls"
```

---

### Task 6: Live visual verification and tuning

**Files:** none created — browser verification against the user's running lab dev server (port 5174). Tuning edits may touch `waterReveal.frag.ts` / `waterRevealSim.ts` constants.

- [ ] **Step 1: Probe the dev server** — `curl -s -o /dev/null -w "%{http_code}" http://localhost:5174`. If not live, STOP and report (do not start one; the user runs their own dev server).
- [ ] **Step 2: Open the lab via `agent-browser open http://localhost:5174 --session water-reveal`** (the shim routes to the remote Chrome pool; confirm stderr shows `[ab-open] remote chrome`; on `BLOCKED` exit 3, STOP and report — do not fall back locally). The lab canvas is rAF-gated and needs a foregrounded tab — the pool Chrome tab is foregrounded by default.
- [ ] **Step 3: Select Reveal → Water in the leva panel, hit Replay.** Screenshot at ~15%, ~50%, ~90%, and after settle. Verify: image builds up in serpentine stroke wakes (not a uniform wipe), live wavefront visibly refracts revealed pixels, coverage completes, waves ring down, final frame is the clean full image (compare against reveal disabled).
- [ ] **Step 4: Check console for shader/GL warnings; check no engine errors on replay spam (hit Replay 3× rapidly — sim must reset cleanly).**
- [ ] **Step 5: If the effect is illegible (wake too thin → raise splat radius factor 2.2 → 1.8; fill reads as plain wipe → raise `uThreshLo`; refraction invisible → raise 0.04 displacement scale), tune constants, let HMR reload, re-verify.** Commit any tuning as `fix(engine): tune water reveal defaults`.
- [ ] **Step 6: Close the browser session (`agent-browser --session water-reveal close`) and report results with screenshots.**

---

## Self-review notes

- Spec coverage: fill carrier (accum shader, Task 3), serpentine choreography (Task 2), dedicated sim (Task 3), refraction at wavefront (waterReveal.frag), completion/steady-state passthrough (`done` → null → `uActive 0`, Task 4), float-extension fallback (sim disable → null → passthrough = image visible, Task 3), config knobs + normalize + duration hazard (Task 1), lab controls (Task 5), live verification (Task 6).
- Type consistency: `WaterRevealConfig` field names identical across Tasks 1, 4, 5; `WaterRevealSim.tick` params identical between Tasks 3 and 4; `serpentinePoint(progress, rows, wobble)` identical between Tasks 2 and 3.
- Known judgment call for implementers: `uActive 0` passthrough writes `vec3(field.r)` exactly like `reveal.frag`'s mask=1 path, satisfying the byte-identical steady-state constraint only if the wave reveal's passthrough is also `vec3(v)` — it is (see `reveal.frag` line 38).
