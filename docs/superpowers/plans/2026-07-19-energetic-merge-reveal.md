# Energetic Merge Reveal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add four energetic merge styles (streaks, implosion, chargeup, shards) to the assembly reveal, switchable in the lab, with the current behavior preserved as `"scatter"`.

**Architecture:** New config field `reveal.assembly.style` selects between the existing instanced scatter pass and a new full-screen fragment pass (`energeticMergePass`) that implements all four new styles via a `uMode` uniform. Each pixel loops over ≤32 procedurally defined masses, tests membership in the mass's displaced footprint, and samples the field/blur-mip chain at the displaced UV. The convergence impact pulse lives in the same shader.

**Tech Stack:** TypeScript, WebGL2 (GLSL ES 3.00), vitest, leva (lab controls). Package manager: `pi` for installs, `pir` for scripts (never npm/pnpm directly).

**Spec:** `docs/superpowers/specs/2026-07-19-energetic-merge-reveal-design.md`

## Global Constraints

- WebGL2 / `#version 300 es` only; shader compile must throw on failure (existing `compileProgram` does this).
- `"scatter"` behavior must be preserved verbatim; existing presets normalize to it (missing `style` → `"scatter"`).
- Timing model unchanged: total duration = `staggerMs + speedMaxMs`; `resolveRevealDurationMs` untouched.
- New config fields: `style` (default `"scatter"`), `massCount` (default 8, clamp 2–24), `overshoot` (default 0.15, clamp 0–0.3), `impact` (default 0.6, clamp 0–1).
- No code comments unless they state a non-obvious constraint (user rule).
- Run tests from repo root: `pir test` (workspace vitest). Typecheck: `pir typecheck`.
- Commit after each task (repo has lint-staged precommit; work directly on `main`).
- Never set git identity; never push unless the user asks.

---

### Task 1: Config types + normalize + tests

**Files:**

- Modify: `packages/stripes-engine/src/config/types.ts` (RevealConfig, ~line 14–33)
- Modify: `packages/stripes-engine/src/config/normalize.ts` (DEFAULT_REVEAL ~line 237, normalizeReveal ~line 260)
- Test: `packages/stripes-engine/src/config/normalize.test.ts`

**Interfaces:**

- Produces: `export type AssemblyStyle = "scatter" | "streaks" | "implosion" | "chargeup" | "shards"` in types.ts; `RevealConfig["assembly"]` gains required fields `style: AssemblyStyle; massCount: number; overshoot: number; impact: number` (normalized config always has them; input is partial). `ASSEMBLY_STYLES` const exported from normalize.ts.

- [ ] **Step 1: Write failing tests** — append to `normalize.test.ts` (follow the file's existing describe style; `normalizeReveal` is already imported there — if not, import from `./normalize`):

```ts
describe("assembly merge styles", () => {
  it("defaults style to scatter and accepts valid styles", () => {
    expect(normalizeReveal({}).assembly.style).toBe("scatter");
    expect(normalizeReveal({ assembly: { style: "streaks" } }).assembly.style).toBe("streaks");
    expect(normalizeReveal({ assembly: { style: "chargeup" } }).assembly.style).toBe("chargeup");
  });

  it("falls back to scatter on invalid style", () => {
    expect(normalizeReveal({ assembly: { style: "bogus" as never } }).assembly.style).toBe("scatter");
  });

  it("defaults and clamps massCount, overshoot, impact", () => {
    const d = normalizeReveal({}).assembly;
    expect(d.massCount).toBe(8);
    expect(d.overshoot).toBe(0.15);
    expect(d.impact).toBe(0.6);
    const c = normalizeReveal({ assembly: { massCount: 99, overshoot: 5, impact: -1 } }).assembly;
    expect(c.massCount).toBe(24);
    expect(c.overshoot).toBe(0.3);
    expect(c.impact).toBe(0);
    expect(normalizeReveal({ assembly: { massCount: 1 } }).assembly.massCount).toBe(2);
  });
});
```

- [ ] **Step 2: Run to verify failure** — `pir test -- normalize` from repo root. Expected: FAIL (style undefined / type errors).

- [ ] **Step 3: Implement.** In `types.ts`, above `RevealConfig`:

```ts
export type AssemblyStyle = "scatter" | "streaks" | "implosion" | "chargeup" | "shards";
```

Extend the `assembly` block of `RevealConfig`:

```ts
assembly: {
  style: AssemblyStyle;
  sliceSizePx: number;
  speedMinMs: number;
  speedMaxMs: number;
  staggerMs: number;
  scatterPx: number;
  angleJitterDeg: number;
  massCount: number;
  overshoot: number;
  impact: number;
  blurPx?: number;
  blurStart?: number;
};
```

In `normalize.ts`: import `AssemblyStyle` from `./types`; add near `WAVE_POSITIONS` usage:

```ts
export const ASSEMBLY_STYLES: readonly AssemblyStyle[] = ["scatter", "streaks", "implosion", "chargeup", "shards"];
```

Extend `DEFAULT_REVEAL.assembly` with `style: "scatter", massCount: 8, overshoot: 0.15, impact: 0.6` (keep existing fields). In `normalizeReveal`'s returned `assembly` object add:

```ts
style: ASSEMBLY_STYLES.includes(a.style as AssemblyStyle) ? (a.style as AssemblyStyle) : DEFAULT_REVEAL.assembly.style,
massCount: clamp(Math.round(num(a.massCount, DEFAULT_REVEAL.assembly.massCount)), 2, 24),
overshoot: clamp(num(a.overshoot, DEFAULT_REVEAL.assembly.overshoot), 0, 0.3),
impact: clamp(num(a.impact, DEFAULT_REVEAL.assembly.impact), 0, 1),
```

If `PartialReveal["assembly"]`'s type makes `a.style` unreachable, keep it `Partial<RevealConfig["assembly"]>` — it now includes the new optional fields automatically.

- [ ] **Step 4: Run tests + typecheck** — `pir test -- normalize` PASS, then `pir test` (full suite; fix any compile fallout in `legacy/migrateLegacyConfig.ts` or engine — those construct partial reveal configs, which remain valid since new fields are optional on input). `pir typecheck`. Note: `apps/lab` typecheck may fail until Task 4 if `defaultLabConfig.ts` declares a full `RevealConfig` — if so, add the four defaults there now (`style: "scatter", massCount: 8, overshoot: 0.15, impact: 0.6`) and mention it in the commit.

- [ ] **Step 5: Commit** — `git add -A && git commit -m "feat(engine): assembly reveal style config (scatter/streaks/implosion/chargeup/shards)"`

---

### Task 2: Energetic merge shader + pass

**Files:**

- Create: `packages/stripes-engine/src/shaders/energeticMerge.frag.ts`
- Create: `packages/stripes-engine/src/passes/energeticMergePass.ts`

**Interfaces:**

- Consumes: `FULLSCREEN_VERT` from `../shaders/fullscreen.vert`, `compileProgram` from `../gl/program`, `bindRenderTarget, RenderTarget` from `../gl/renderTarget`.
- Produces: `createEnergeticMergePass(gl: WebGL2RenderingContext, quad: { draw(): void })` returning `{ render(target, fieldTex, blurQuarterTex, blurHalfTex, blurFullTex, p: EnergeticMergeUniforms), dispose() }`; exported type `EnergeticMergeUniforms = { mode: number; progress: number; spread: number; flight: number; moveEnd: number; massCount: number; overshoot: number; impact: number; sigmaUv: [number, number]; blurStart: number; aspect: number }`. Mode mapping: 0 streaks, 1 implosion, 2 chargeup, 3 shards.

No unit test (GLSL); compile failure throws at pass creation (covered by Task 3 wiring + visual verification). Verify with `pir typecheck` in this task.

- [ ] **Step 1: Write the shader** — `energeticMerge.frag.ts`:

```ts
export const ENERGETIC_MERGE_FRAG = `#version 300 es
precision highp float;
in vec2 vUv;
uniform sampler2D uField;
uniform sampler2D uBlurQuarter;
uniform sampler2D uBlurHalf;
uniform sampler2D uBlurFull;
uniform int uMode;
uniform float uProgress;
uniform float uSpread;
uniform float uFlight;
uniform float uMoveEnd;
uniform float uMassCount;
uniform float uOvershoot;
uniform float uImpact;
uniform vec2 uSigmaUv;
uniform float uBlurStart;
uniform float uAspect;
out vec4 finalColor;

const int MAX_MASSES = 32;

highp float hash11(highp float n) {
  return fract(sin(n * 127.1 + 311.7) * 43758.5453123);
}

highp float backOut(highp float f, highp float s) {
  highp float t = f - 1.0;
  return 1.0 + (s + 1.0) * t * t * t + s * t * t;
}

highp float flightF(highp float order) {
  return clamp((max(uProgress, 0.0) - uSpread * order) / max(uFlight, 1e-4), 0.0, 1.0);
}

highp float sampleBlur(vec2 uv, highp float s) {
  vec2 suv = clamp(uv, 0.0, 1.0);
  if (s <= 0.0) return texture(uField, suv).r;
  if (s <= 0.25) return mix(texture(uField, suv).r, texture(uBlurQuarter, suv).r, s * 4.0);
  if (s <= 0.5) return mix(texture(uBlurQuarter, suv).r, texture(uBlurHalf, suv).r, (s - 0.25) * 4.0);
  return mix(texture(uBlurHalf, suv).r, texture(uBlurFull, suv).r, clamp((s - 0.5) * 2.0, 0.0, 1.0));
}

highp float remainingBlur(highp float f) {
  highp float fb = clamp((f - uBlurStart) / max(1.0 - uBlurStart, 1e-4), 0.0, 1.0);
  return 1.0 - fb * fb * (3.0 - 2.0 * fb);
}

void main() {
  highp float p = max(uProgress, 0.0);
  highp float s = uOvershoot * 17.0;

  if (p >= uMoveEnd && uMode != 2) {
    highp float tI = clamp((p - uMoveEnd) / 0.25, 0.0, 1.0);
    highp float fade = 1.0 - tI;
    vec2 uv = vUv;
    highp float boost = 0.0;
    if (uMode == 1 || uMode == 3) {
      vec2 c = (vUv - 0.5) * vec2(uAspect, 1.0);
      highp float d = length(c);
      highp float ring = exp(-pow((d - tI * 0.9) * 7.0, 2.0));
      vec2 dir = d > 1e-4 ? c / d : vec2(0.0);
      uv += dir * ring * 0.012 * uImpact * fade / vec2(uAspect, 1.0);
      boost = ring * 0.5 * uImpact * fade;
    } else if (uMode == 0) {
      boost = 0.25 * uImpact * fade;
    }
    highp float v = texture(uField, clamp(uv, 0.0, 1.0)).r;
    finalColor = vec4(vec3(v * (1.0 + boost)), 1.0);
    return;
  }

  highp float v = 0.0;

  if (uMode == 0) {
    highp float n = clamp(uMassCount, 2.0, 16.0);
    highp float col = min(floor(vUv.x * n), n - 1.0);
    highp float h = hash11(col + 1.0);
    highp float f = flightF(h);
    highp float dir = mod(col, 2.0) < 0.5 ? 1.0 : -1.0;
    highp float spawn = dir * (1.0 + 0.3 * h);
    highp float ease = backOut(f, s);
    highp float offY = (1.0 - ease) * spawn;
    highp float vel = abs(spawn) * 3.0 * (1.0 - f) * (1.0 - f);
    highp float smear = min(vel * 0.03, 0.05);
    highp float blurAmt = remainingBlur(f) * 0.5;
    highp float acc = 0.0;
    for (int t = -2; t <= 2; t++) {
      highp float sy = vUv.y - offY + float(t) * smear;
      acc += (sy >= 0.0 && sy <= 1.0 && f > 0.0) ? sampleBlur(vec2(vUv.x, sy), blurAmt) : 0.0;
    }
    v = acc * 0.2;
  } else if (uMode == 1) {
    highp float gc = max(2.0, floor(sqrt(uMassCount * uAspect) + 0.5));
    highp float gr = max(2.0, ceil(uMassCount / gc));
    int count = int(gc * gr);
    for (int i = 0; i < MAX_MASSES; i++) {
      if (i >= count) break;
      highp float fi = float(i);
      highp float bx = mod(fi, gc);
      highp float by = floor(fi / gc);
      vec2 rMin = vec2(bx / gc, by / gr);
      vec2 rMax = vec2((bx + 1.0) / gc, (by + 1.0) / gr);
      vec2 c = 0.5 * (rMin + rMax);
      highp float h = hash11(fi + 7.0);
      vec2 d = c - 0.5;
      vec2 dir = length(d) > 1e-3 ? normalize(d) : vec2(0.0, -1.0);
      vec2 spawnOff = dir * (0.6 + 0.5 * h);
      highp float f = flightF(hash11(fi + 41.0));
      if (f <= 0.0) continue;
      vec2 off = (1.0 - backOut(f, s)) * spawnOff;
      vec2 q = vUv - off;
      if (q.x < rMin.x || q.x > rMax.x || q.y < rMin.y || q.y > rMax.y) continue;
      v = max(v, sampleBlur(q, remainingBlur(f)));
    }
  } else if (uMode == 2) {
    highp float f = clamp(p / max(uMoveEnd, 1e-4), 0.0, 1.0);
    highp float charge = smoothstep(0.0, 0.7, f);
    highp float blurAmt = f < 0.7 ? mix(1.0, 0.3, charge) : 0.0;
    highp float scale = mix(1.04, 1.0, f * f * (3.0 - 2.0 * f));
    vec2 suv = 0.5 + (vUv - 0.5) / scale;
    highp float gain = f < 0.7 ? 0.3 * uImpact * charge : 0.0;
    highp float flash = f >= 0.7 ? 0.6 * uImpact * (1.0 - smoothstep(0.7, 0.85, f)) : 0.0;
    v = sampleBlur(suv, blurAmt) * (1.0 + gain + flash);
  } else {
    highp float k = clamp(uMassCount, 3.0, 8.0);
    int count = int(k);
    for (int i = 0; i < 8; i++) {
      if (i >= count) break;
      highp float fi = float(i);
      vec2 seed = vec2(hash11(fi * 2.3 + 1.7), hash11(fi * 3.1 + 0.37)) * 0.8 + 0.1;
      vec2 d = seed - 0.5;
      vec2 dir = length(d) > 1e-3 ? normalize(d) : vec2(0.0, -1.0);
      highp float h = hash11(fi + 13.0);
      highp float f = flightF(h * 0.5);
      if (f <= 0.0) continue;
      vec2 off = dir * (0.7 + 0.4 * h) * (1.0 - backOut(f, s));
      vec2 q = vUv - off;
      highp float dSelf = length((q - seed) * vec2(uAspect, 1.0));
      bool nearest = true;
      for (int j = 0; j < 8; j++) {
        if (j >= count || j == i) continue;
        highp float fj = float(j);
        vec2 seedJ = vec2(hash11(fj * 2.3 + 1.7), hash11(fj * 3.1 + 0.37)) * 0.8 + 0.1;
        if (length((q - seedJ) * vec2(uAspect, 1.0)) < dSelf) { nearest = false; break; }
      }
      if (!nearest || q.x < 0.0 || q.x > 1.0 || q.y < 0.0 || q.y > 1.0) continue;
      v = max(v, sampleBlur(q, remainingBlur(f)));
    }
  }

  finalColor = vec4(vec3(v), 1.0);
}
`;
```

- [ ] **Step 2: Write the pass** — `energeticMergePass.ts` (mirror `revealPass.ts` structure):

```ts
import { compileProgram } from "../gl/program";
import { bindRenderTarget, type RenderTarget } from "../gl/renderTarget";
import { FULLSCREEN_VERT } from "../shaders/fullscreen.vert";
import { ENERGETIC_MERGE_FRAG } from "../shaders/energeticMerge.frag";

export type EnergeticMergeUniforms = {
  mode: number;
  progress: number;
  spread: number;
  flight: number;
  moveEnd: number;
  massCount: number;
  overshoot: number;
  impact: number;
  sigmaUv: [number, number];
  blurStart: number;
  aspect: number;
};

export function createEnergeticMergePass(gl: WebGL2RenderingContext, quad: { draw(): void }) {
  const program = compileProgram(gl, FULLSCREEN_VERT, ENERGETIC_MERGE_FRAG);
  const u = (n: string) => gl.getUniformLocation(program, n);
  const L = {
    field: u("uField"),
    blurQuarter: u("uBlurQuarter"),
    blurHalf: u("uBlurHalf"),
    blurFull: u("uBlurFull"),
    mode: u("uMode"),
    progress: u("uProgress"),
    spread: u("uSpread"),
    flight: u("uFlight"),
    moveEnd: u("uMoveEnd"),
    massCount: u("uMassCount"),
    overshoot: u("uOvershoot"),
    impact: u("uImpact"),
    sigmaUv: u("uSigmaUv"),
    blurStart: u("uBlurStart"),
    aspect: u("uAspect"),
  };
  return {
    render(
      target: RenderTarget,
      fieldTex: WebGLTexture,
      blurQuarterTex: WebGLTexture,
      blurHalfTex: WebGLTexture,
      blurFullTex: WebGLTexture,
      p: EnergeticMergeUniforms,
    ) {
      bindRenderTarget(gl, target);
      gl.useProgram(program);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, fieldTex);
      gl.uniform1i(L.field, 0);
      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, blurQuarterTex);
      gl.uniform1i(L.blurQuarter, 1);
      gl.activeTexture(gl.TEXTURE2);
      gl.bindTexture(gl.TEXTURE_2D, blurHalfTex);
      gl.uniform1i(L.blurHalf, 2);
      gl.activeTexture(gl.TEXTURE3);
      gl.bindTexture(gl.TEXTURE_2D, blurFullTex);
      gl.uniform1i(L.blurFull, 3);
      gl.activeTexture(gl.TEXTURE0);
      gl.uniform1i(L.mode, p.mode);
      gl.uniform1f(L.progress, p.progress);
      gl.uniform1f(L.spread, p.spread);
      gl.uniform1f(L.flight, p.flight);
      gl.uniform1f(L.moveEnd, p.moveEnd);
      gl.uniform1f(L.massCount, p.massCount);
      gl.uniform1f(L.overshoot, p.overshoot);
      gl.uniform1f(L.impact, p.impact);
      gl.uniform2f(L.sigmaUv, p.sigmaUv[0], p.sigmaUv[1]);
      gl.uniform1f(L.blurStart, p.blurStart);
      gl.uniform1f(L.aspect, p.aspect);
      quad.draw();
    },
    dispose() {
      gl.deleteProgram(program);
    },
  };
}
```

- [ ] **Step 3: Verify** — `pir typecheck` passes (files compile; shader is a string, exercised in Task 3/5).

- [ ] **Step 4: Commit** — `git add -A && git commit -m "feat(engine): energetic merge reveal pass (streaks/implosion/chargeup/shards)"`

---

### Task 3: Engine wiring + topology tracking + topology tests

**Files:**

- Modify: `packages/stripes-engine/src/engine.ts` (~line 179 topology state, ~line 522–597 pass build, ~line 1061–1101 setConfig gating)
- Test: `packages/stripes-engine/src/engine.topology.test.ts`

**Interfaces:**

- Consumes: `createEnergeticMergePass`, `EnergeticMergeUniforms` from Task 2; config fields from Task 1.
- Produces: engine renders `energeticMergeField` pass into the `revealedField` RT when `style !== "scatter"`; style switches between scatter and any merge style rebuild passes; switches among merge styles do NOT rebuild (mode is a per-frame uniform).

- [ ] **Step 1: Write failing topology tests.** In `engine.topology.test.ts`, update the local `topologyKey` helper to mirror the new engine gating and add cases:

```ts
function topologyKey(cfg: EngineConfig): string {
  const assemblyTopo = cfg.reveal.enabled && cfg.reveal.type === "assembly";
  const assemblyKind = !assemblyTopo ? "none" : cfg.reveal.assembly.style === "scatter" ? "scatter" : "merge";
  return `${cfg.stripesEnabled}:${cfg.reveal.enabled}:${assemblyTopo}:${assemblyKind}:${cfg.flames.enabled}`;
}
```

New tests inside the existing describe:

```ts
it("switching assembly style scatter -> streaks triggers rebuild", () => {
  const scatter = normalizeEngineConfig({
    reveal: { enabled: true, type: "assembly", assembly: { style: "scatter" } },
  });
  const streaks = normalizeEngineConfig({
    reveal: { enabled: true, type: "assembly", assembly: { style: "streaks" } },
  });
  expect(needsRebuild(scatter, streaks)).toBe(true);
  expect(needsRebuild(streaks, scatter)).toBe(true);
});

it("switching among merge styles does not trigger rebuild", () => {
  const streaks = normalizeEngineConfig({
    reveal: { enabled: true, type: "assembly", assembly: { style: "streaks" } },
  });
  const shards = normalizeEngineConfig({ reveal: { enabled: true, type: "assembly", assembly: { style: "shards" } } });
  expect(needsRebuild(streaks, shards)).toBe(false);
});
```

- [ ] **Step 2: Run to verify failure** — `pir test -- topology`. The two new tests pass trivially against the local helper — the helper IS the spec of engine behavior, so the real check is Step 3's engine change matching it. Still run to confirm no compile errors.

- [ ] **Step 3: Wire the engine.** In `engine.ts`:

(a) Near line 179 replace the single boolean with kind tracking:

```ts
const assemblyPassKind = () =>
  !config.reveal.enabled || config.reveal.type !== "assembly"
    ? "none"
    : config.reveal.assembly.style === "scatter"
      ? "scatter"
      : "merge";
let lastAssemblyKind = assemblyPassKind();
```

Remove `lastAssemblyTopo` (and its assignment at ~line 1092); in the `setConfig` condition (~line 1065) replace `assemblyTopo !== lastAssemblyTopo` with `assemblyPassKind() !== lastAssemblyKind`, and in the post-rebuild assignments set `lastAssemblyKind = assemblyPassKind();`. Delete the now-unused `const assemblyTopo = ...` at ~line 1061 if nothing else reads it.

(b) Import the pass: `import { createEnergeticMergePass } from "./passes/energeticMergePass";`

(c) In the pass-build section (~line 522), split the assembly branch. Keep `const assemblyTopology = revealEnabled && config.reveal.type === "assembly";` and change the chain to:

```ts
if (assemblyTopology && config.reveal.assembly.style !== "scatter") {
  const mergePass = createEnergeticMergePass(gl, quad);
  const blurPass = createBlurPass(gl, quad);
  revealFieldPasses.push({
    name: "energeticMergeField",
    render: () => {
      const fieldRT = pool.get("field", fieldSize.width, fieldSize.height, { linear: true });
      const revealedRT = pool.get("revealedField", fieldSize.width, fieldSize.height, { linear: true });
      const { assembly } = config.reveal;
      const mode =
        assembly.style === "streaks" ? 0 : assembly.style === "implosion" ? 1 : assembly.style === "chargeup" ? 2 : 3;
      const baseBlurPx = assembly.blurPx ?? DEFAULT_REVEAL.assembly.blurPx ?? 0;
      const blurPx = assembly.style === "chargeup" ? Math.max(baseBlurPx, 17.5) : baseBlurPx;
      const blurStart = assembly.blurStart ?? DEFAULT_REVEAL.assembly.blurStart ?? 0;
      const durationMs = resolveRevealDurationMs(config.reveal);
      const rawProgress = (clock.now() - revealStartMs) / durationMs;
      const progress = Math.max(0, Math.min(1, rawProgress));
      const dur = Math.max(1, assembly.staggerMs + assembly.speedMaxMs);
      const speedMin = Math.max(0, assembly.speedMinMs);
      const speedMax = Math.max(speedMin, assembly.speedMaxMs);
      const avgTotal = Math.min(0.98, Math.max(0.05, (speedMin + speedMax) / 2 / dur));
      const spread = assembly.staggerMs / dur;
      const moveEnd = Math.min(1, spread + avgTotal);

      let blurQuarterTex = fieldRT.texture;
      let blurHalfTex = fieldRT.texture;
      let blurFullTex = fieldRT.texture;
      if (progress < moveEnd && blurPx > 0) {
        const halfSize = {
          width: Math.max(1, Math.round(fieldSize.width / 2)),
          height: Math.max(1, Math.round(fieldSize.height / 2)),
        };
        const quarterRT = pool.get("assemblyBlurQuarter", halfSize.width, halfSize.height, { linear: true });
        const halfRT = pool.get("assemblyBlurHalf", halfSize.width, halfSize.height, { linear: true });
        const fullRT = pool.get("assemblyBlurFull", halfSize.width, halfSize.height, { linear: true });
        const blurTempRT = pool.get("assemblyBlurTemp", halfSize.width, halfSize.height, { linear: true });
        const sigmaPx = (blurPx * halfSize.width) / Math.max(1, cssW);
        blurPass.copy(fieldRT.texture, quarterRT);
        blurPass.render(quarterRT.texture, blurTempRT, quarterRT, (sigmaPx * 0.25) / 0.45, halfSize);
        blurPass.render(quarterRT.texture, blurTempRT, halfRT, (sigmaPx * (Math.sqrt(3) / 4)) / 0.45, halfSize);
        const fullStepRadius = (sigmaPx * (Math.sqrt(3) / 2 / Math.SQRT2)) / 0.45;
        blurPass.render(halfRT.texture, blurTempRT, fullRT, fullStepRadius, halfSize);
        blurPass.render(fullRT.texture, blurTempRT, fullRT, fullStepRadius, halfSize);
        blurQuarterTex = quarterRT.texture;
        blurHalfTex = halfRT.texture;
        blurFullTex = fullRT.texture;
      }

      mergePass.render(revealedRT, fieldRT.texture, blurQuarterTex, blurHalfTex, blurFullTex, {
        mode,
        progress: rawProgress,
        spread,
        flight: avgTotal,
        moveEnd,
        massCount: assembly.massCount,
        overshoot: assembly.overshoot,
        impact: assembly.impact,
        sigmaUv: [blurPx / Math.max(1, cssW), blurPx / Math.max(1, cssH)],
        blurStart,
        aspect: cssW / Math.max(1, cssH),
      });
    },
    dispose: () => {
      mergePass.dispose();
      blurPass.dispose();
    },
  });
} else if (assemblyTopology) {
  // ... existing scatter branch, byte-for-byte unchanged ...
} else if (revealEnabled) {
  // ... existing wave branch unchanged ...
}
```

The blur-pyramid block is intentionally duplicated from the scatter branch rather than shared — extracting a helper is acceptable if it keeps both call sites trivially identical; otherwise duplicate. `quad` is the same fullscreen quad object already passed to `createRevealPass`/`createBlurPass` in this scope.

(d) RT pre-allocation (~line 931): the existing `config.reveal.type === "assembly"` check already covers merge styles; no change.

- [ ] **Step 4: Run all tests + typecheck** — `pir test` PASS, `pir typecheck` PASS.

- [ ] **Step 5: Commit** — `git add -A && git commit -m "feat(engine): wire energetic merge pass into reveal topology"`

---

### Task 4: Lab controls + config mapping

**Files:**

- Modify: `apps/lab/src/controls/levaSchema.ts` (Reveal folder ~line 1476–1571; config mapping ~line 2035–2052)
- Modify: `apps/lab/src/defaultLabConfig.ts` (reveal.assembly ~line 141, if not already done in Task 1)

**Interfaces:**

- Consumes: `AssemblyStyle` values from Task 1.
- Produces: leva keys `revealAssemblyStyle`, `revealMassCount`, `revealOvershoot`, `revealImpact` flowing into `reveal.assembly.{style,massCount,overshoot,impact}`.

- [ ] **Step 1: defaultLabConfig** — extend `reveal.assembly` with `style: "scatter", massCount: 8, overshoot: 0.15, impact: 0.6` (skip if already added during Task 1 typecheck fallout).

- [ ] **Step 2: Leva schema.** In the Reveal folder, insert directly after `revealType`:

```ts
revealAssemblyStyle: {
  value: d.reveal.assembly.style,
  options: {
    Scatter: "scatter",
    Streaks: "streaks",
    Implosion: "implosion",
    "Charge-up": "chargeup",
    Shards: "shards",
  } as const,
  label: "Style",
  render: (get) => get("Reveal.revealType") === "assembly",
},
revealMassCount: {
  value: d.reveal.assembly.massCount,
  min: 2,
  max: 24,
  step: 1,
  label: "Mass count",
  render: (get) =>
    get("Reveal.revealType") === "assembly" &&
    ["streaks", "implosion", "shards"].includes(get("Reveal.revealAssemblyStyle")),
},
revealOvershoot: {
  value: d.reveal.assembly.overshoot,
  min: 0,
  max: 0.3,
  step: 0.01,
  label: "Overshoot",
  render: (get) =>
    get("Reveal.revealType") === "assembly" &&
    ["streaks", "implosion", "shards"].includes(get("Reveal.revealAssemblyStyle")),
},
revealImpact: {
  value: d.reveal.assembly.impact,
  min: 0,
  max: 1,
  step: 0.05,
  label: "Impact",
  render: (get) =>
    get("Reveal.revealType") === "assembly" && get("Reveal.revealAssemblyStyle") !== "scatter",
},
```

Then narrow the scatter-only controls — `revealSliceSizePx`, `revealScatterPx`, `revealAngleJitterDeg` get:

```ts
render: (get) => get("Reveal.revealType") === "assembly" && get("Reveal.revealAssemblyStyle") === "scatter",
```

(`revealSpeedMinMs`, `revealSpeedMaxMs`, `revealStaggerMs` keep their existing assembly-wide render.)

- [ ] **Step 3: Config mapping.** In the `reveal.assembly` object of the values→config mapping (~line 2044), add:

```ts
style: values.revealAssemblyStyle,
massCount: values.revealMassCount,
overshoot: values.revealOvershoot,
impact: values.revealImpact,
```

- [ ] **Step 4: Preset flow check.** Run `grep -rn "revealScatterPx" apps/lab/src` and confirm the new leva keys need no extra handling anywhere revealScatterPx appears (preset save/load is keyed off the leva schema; if any file enumerates reveal keys explicitly, add the four new keys there the same way).

- [ ] **Step 5: Verify** — `pir typecheck` PASS, `pir test` PASS.

- [ ] **Step 6: Commit** — `git add -A && git commit -m "feat(lab): assembly style controls (streaks/implosion/chargeup/shards)"`

---

### Task 5: Visual verification (main session, not a subagent)

- [ ] Probe the user's dev server: `curl -s -o /dev/null -w "%{http_code}" http://localhost:5174` — if not live, start `pir dev` in background Bash (project convention).
- [ ] Open the lab via the remote browser pool (`agent-browser open --session merge http://localhost:5174`), set Reveal type = Assembly, and for each style (Streaks, Implosion, Charge-up, Shards): select it, set Stagger ≈ 200ms / Speed max ≈ 700ms, hit Replay, and capture mid-flight + impact-moment screenshots.
- [ ] Check `tests/reveal-assembly.spec.ts` + `pir test:e2e` still pass (scatter default unchanged).
- [ ] Show captures to the user per style; iterate on feel from their feedback.
