# Energy Warp Reveal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the rejected particle style with a six-variant unified "energy warp" family — the texture itself, sampled through a decaying displacement field, settles into place.

**Architecture:** `reveal.assembly.style` becomes `"scatter" | "turbulence" | "vortex" | "streams" | "pull" | "ripple" | "glitch"`. One fullscreen fragment shader (`energyWarp.frag.ts`) computes a per-mode displacement field and per-pixel arrival jitter, samples the real field through the decaying displacement with a 5-tap motion smear and motion-proportional glow. The particleMerge pass/shaders and engine branch are deleted.

**Tech Stack:** TypeScript, WebGL2 (GLSL ES 3.00), vitest, leva. Scripts via `pir` only.

**Spec:** `docs/superpowers/specs/2026-07-19-energy-warp-reveal-design.md`

## Global Constraints

- `"scatter"` byte-for-byte preserved; wave untouched. Invalid/legacy styles (incl. `"particles"`) normalize to `"scatter"`.
- Timing model unchanged: derived math identical to scatter (`dur`, `spread`, `avgTotal`); progress passed raw.
- New fields: `intensity` (default 1, clamp 0–2), `detail` (default 0.5, clamp 0–1), `glow` (default 0.6, clamp 0–1). `particleCount`/`particleSizePx`/`swirl` removed everywhere.
- Motion: cubic-out ease only, no overshoot/spring anywhere. At decay 0 output must equal the field exactly.
- sin-hash noise is allowed in this shader (lattice coords stay small); do NOT flag or replace it with PCG.
- No code comments unless non-obvious constraint. `pir test` / `pir typecheck` from repo root. Commit per task. Never set git identity; never push.

---

### Task 1: Config swap (types + normalize + legacy + lab literals + tests)

**Files:**

- Modify: `packages/stripes-engine/src/config/types.ts`, `packages/stripes-engine/src/config/normalize.ts`, `packages/stripes-engine/src/legacy/migrateLegacyConfig.ts` (+ test), `apps/lab/src/defaultLabConfig.ts`, `apps/lab/src/controls/levaSchema.ts` (assembly literals + Reveal-folder controls + mapping — full swap is EXPECTED this round, the union change breaks the old control bindings; do the complete leva rewire here, Task 4 becomes verify-only)
- Test: `packages/stripes-engine/src/config/normalize.test.ts`

**Interfaces:**

- Produces: `AssemblyStyle = "scatter" | "turbulence" | "vortex" | "streams" | "pull" | "ripple" | "glitch"`; assembly fields `intensity: number; detail: number; glow: number` (required in normalized config); particle fields gone.

- [ ] **Step 1: Replace the "assembly particle style" describe block in `normalize.test.ts`:**

```ts
describe("assembly warp styles", () => {
  it("defaults style to scatter and accepts all warp styles", () => {
    expect(normalizeReveal({}).assembly.style).toBe("scatter");
    for (const s of ["turbulence", "vortex", "streams", "pull", "ripple", "glitch"] as const) {
      expect(normalizeReveal({ assembly: { style: s } }).assembly.style).toBe(s);
    }
  });

  it("falls back to scatter on invalid or legacy styles", () => {
    expect(normalizeReveal({ assembly: { style: "bogus" as never } }).assembly.style).toBe("scatter");
    expect(normalizeReveal({ assembly: { style: "particles" as never } }).assembly.style).toBe("scatter");
  });

  it("defaults and clamps intensity, detail, glow", () => {
    const d = normalizeReveal({}).assembly;
    expect(d.intensity).toBe(1);
    expect(d.detail).toBe(0.5);
    expect(d.glow).toBe(0.6);
    const c = normalizeReveal({ assembly: { intensity: 5, detail: -1, glow: 2 } }).assembly;
    expect(c.intensity).toBe(2);
    expect(c.detail).toBe(0);
    expect(c.glow).toBe(1);
  });
});
```

- [ ] **Step 2:** `pir test -- normalize` — FAIL expected.

- [ ] **Step 3: Implement.** `types.ts`:

```ts
export type AssemblyStyle = "scatter" | "turbulence" | "vortex" | "streams" | "pull" | "ripple" | "glitch";
```

Assembly block: remove `particleCount`/`particleSizePx`/`swirl`; add `intensity: number; detail: number; glow: number`.

`normalize.ts`: `ASSEMBLY_STYLES` lists all seven; `DEFAULT_REVEAL.assembly` swaps particle defaults for `intensity: 1, detail: 0.5, glow: 0.6`; `normalizeReveal` swaps the particle entries for:

```ts
intensity: clamp(num(a.intensity, DEFAULT_REVEAL.assembly.intensity), 0, 2),
detail: clamp(num(a.detail, DEFAULT_REVEAL.assembly.detail), 0, 1),
glow: clamp(num(a.glow, DEFAULT_REVEAL.assembly.glow), 0, 1),
```

Update `migrateLegacyConfig.ts` (+ test) and `defaultLabConfig.ts` the same way.

`levaSchema.ts` full rewire:
(a) top assembly literal: swap particle fields for `intensity: 1, detail: 0.5, glow: 0.6`.
(b) Reveal folder: `revealAssemblyStyle.options` becomes

```ts
options: {
  Scatter: "scatter",
  Turbulence: "turbulence",
  Vortex: "vortex",
  Streams: "streams",
  Pull: "pull",
  Ripple: "ripple",
  Glitch: "glitch",
} as const,
```

Replace the three particle controls with:

```ts
revealIntensity: {
  value: d.reveal.assembly.intensity,
  min: 0,
  max: 2,
  step: 0.05,
  label: "Intensity",
  render: (get) =>
    get("Reveal.revealType") === "assembly" && get("Reveal.revealAssemblyStyle") !== "scatter",
},
revealDetail: {
  value: d.reveal.assembly.detail,
  min: 0,
  max: 1,
  step: 0.05,
  label: "Detail",
  render: (get) =>
    get("Reveal.revealType") === "assembly" && get("Reveal.revealAssemblyStyle") !== "scatter",
},
revealGlow: {
  value: d.reveal.assembly.glow,
  min: 0,
  max: 1,
  step: 0.05,
  label: "Glow",
  render: (get) =>
    get("Reveal.revealType") === "assembly" && get("Reveal.revealAssemblyStyle") !== "scatter",
},
```

(c) mapping: replace particle entries with `intensity: values.revealIntensity, detail: values.revealDetail, glow: values.revealGlow` (keep `style: values.revealAssemblyStyle`).
(d) Scatter-only narrowing on slice/scatter/jitter controls stays; speed/stagger stay assembly-wide.

- [ ] **Step 4:** `pir test` + `pir typecheck` green. The engine's `particleMergeField` branch references removed fields — shim minimally if needed (hardcode `count: 9000, sizeUv: [...], swirl: 0.5` equivalents with literals) and note it; Task 3 deletes the branch.

- [ ] **Step 5: Commit** — `git add -A && git commit -m "feat(engine): reveal style config becomes scatter|warp-family (drop particles)"`

---

### Task 2: Energy warp shader + pass

**Files:**

- Create: `packages/stripes-engine/src/shaders/energyWarp.frag.ts`
- Create: `packages/stripes-engine/src/passes/energyWarpPass.ts`
- Delete (only if engine.ts no longer imports them — otherwise leave for Task 3): `packages/stripes-engine/src/passes/particleMergePass.ts`, `packages/stripes-engine/src/shaders/particleMerge.vert.ts`, `packages/stripes-engine/src/shaders/particleMerge.frag.ts`, `packages/stripes-engine/src/shaders/particleSettle.frag.ts`

**Interfaces:**

- Consumes: `FULLSCREEN_VERT`, `compileProgram`, `bindRenderTarget`/`RenderTarget`.
- Produces: `createEnergyWarpPass(gl: WebGL2RenderingContext, quad: { draw(): void })` → `{ render(target, fieldTex, p: EnergyWarpUniforms), dispose() }`; `EnergyWarpUniforms = { mode: number; progress: number; spread: number; flight: number; intensity: number; detail: number; glow: number; aspect: number }`. Modes: 0 turbulence, 1 vortex, 2 streams, 3 pull, 4 ripple, 5 glitch.

- [ ] **Step 1: `energyWarp.frag.ts`:**

```ts
export const ENERGY_WARP_FRAG = `#version 300 es
precision highp float;
in vec2 vUv;
uniform sampler2D uField;
uniform int uMode;
uniform float uProgress;
uniform float uSpread;
uniform float uFlight;
uniform float uIntensity;
uniform float uDetail;
uniform float uGlow;
uniform float uAspect;
out vec4 finalColor;

highp float vhash(vec2 q) {
  return fract(sin(dot(q, vec2(127.1, 311.7))) * 43758.5453123);
}

highp float vnoise(vec2 q) {
  vec2 i = floor(q);
  vec2 fr = fract(q);
  vec2 u = fr * fr * (3.0 - 2.0 * fr);
  highp float a = vhash(i);
  highp float b = vhash(i + vec2(1.0, 0.0));
  highp float c = vhash(i + vec2(0.0, 1.0));
  highp float d = vhash(i + vec2(1.0, 1.0));
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

highp float fbm2(vec2 q) {
  return 0.62 * vnoise(q) + 0.38 * vnoise(q * 2.73 + 13.7);
}

void main() {
  highp float p = max(uProgress, 0.0);
  vec2 a = (vUv - 0.5) * vec2(uAspect, 1.0);
  highp float r = length(a);
  vec2 rdir = r > 1e-4 ? a / r : vec2(0.0, 1.0);
  highp float freq = mix(2.0, 10.0, uDetail);

  highp float n;
  if (uMode == 0) {
    n = fbm2(vUv * mix(3.0, 12.0, uDetail) + 7.3);
  } else if (uMode == 1) {
    n = fbm2(vUv * 6.0 + 3.3) * 0.6 + r * 0.4;
  } else if (uMode == 2) {
    n = fbm2(vec2(vUv.x * freq * 2.0, 1.7)) * 0.8 + 0.2 * fbm2(vUv * 5.0);
  } else if (uMode == 3) {
    n = fbm2(vUv * 7.0 + 1.9);
  } else if (uMode == 4) {
    n = 0.15;
  } else {
    highp float rows = mix(14.0, 56.0, uDetail);
    n = vhash(vec2(floor(vUv.y * rows) * 0.61, 8.8));
  }

  highp float f = clamp((p - uSpread * n) / max(uFlight, 1e-4), 0.0, 1.0);
  highp float ease = 1.0 - pow(1.0 - f, 3.0);
  highp float decay = 1.0 - ease;

  vec2 D;
  if (uMode == 0) {
    highp float ang = fbm2(vUv * freq + 2.1) * 12.566370;
    highp float mag = 0.5 + 0.5 * fbm2(vUv * freq * 1.7 + 5.9);
    D = vec2(cos(ang), sin(ang)) * 0.28 * mag;
  } else if (uMode == 1) {
    vec2 perp = vec2(-rdir.y, rdir.x);
    highp float fall = 1.0 - smoothstep(0.0, 0.85, r);
    D = perp * (0.9 * fall + 0.15) * r + a * 0.55;
  } else if (uMode == 2) {
    highp float dy = 0.45 + 0.75 * fbm2(vec2(vUv.x * freq * 2.0, vUv.y * 1.2 + 9.1));
    D = vec2((fbm2(vec2(vUv.x * freq, vUv.y * 2.0)) - 0.5) * 0.12, -dy);
  } else if (uMode == 3) {
    highp float best = 1e9;
    vec2 bw = vec2(0.0);
    for (int k = 0; k < 4; k++) {
      highp float fk = float(k);
      vec2 w = (vec2(vhash(vec2(fk * 1.7 + 0.3, 2.9)), vhash(vec2(fk * 3.1 + 1.1, 7.7))) - 0.5) * vec2(uAspect, 1.0) * 0.9;
      highp float dd = length(a - w);
      if (dd < best) {
        best = dd;
        bw = w;
      }
    }
    vec2 dir = best > 1e-4 ? (bw - a) / best : vec2(0.0, 1.0);
    D = dir * exp(-best * 2.2) * 0.55;
  } else if (uMode == 4) {
    highp float R = ease * 1.4;
    D = rdir * exp(-pow((r - R) * 6.0, 2.0)) * 0.3 + rdir * smoothstep(R, R + 0.6, r) * 0.12;
  } else {
    highp float rows = mix(14.0, 56.0, uDetail);
    highp float row = floor(vUv.y * rows);
    highp float h = vhash(vec2(row * 0.37 + floor(p * 22.0) * 1.13, 4.2));
    D = vec2((h - 0.5) * 0.55, 0.0);
  }

  vec2 disp = D * uIntensity * decay;
  highp float acc = 0.0;
  for (int t = 0; t < 5; t++) {
    highp float w = 0.55 + 0.225 * float(t);
    acc += texture(uField, clamp(vUv + disp * w, 0.0, 1.0)).r;
  }
  highp float v = acc * 0.2;
  highp float gain = 1.0 + uGlow * 1.2 * min(1.0, length(disp) * 8.0) * decay;
  if (uMode == 5) {
    gain += uGlow * 0.5 * decay * (vhash(vec2(floor(p * 22.0), 3.7)) - 0.5) * 2.0;
  }
  highp float fadeIn = smoothstep(0.0, 0.08, p);
  finalColor = vec4(vec3(v * gain * fadeIn), 1.0);
}
`;
```

- [ ] **Step 2: `energyWarpPass.ts`** (mirror `revealPass.ts`):

```ts
import { compileProgram } from "../gl/program";
import { bindRenderTarget, type RenderTarget } from "../gl/renderTarget";
import { FULLSCREEN_VERT } from "../shaders/fullscreen.vert";
import { ENERGY_WARP_FRAG } from "../shaders/energyWarp.frag";

export type EnergyWarpUniforms = {
  mode: number;
  progress: number;
  spread: number;
  flight: number;
  intensity: number;
  detail: number;
  glow: number;
  aspect: number;
};

export function createEnergyWarpPass(gl: WebGL2RenderingContext, quad: { draw(): void }) {
  const program = compileProgram(gl, FULLSCREEN_VERT, ENERGY_WARP_FRAG);
  const u = (n: string) => gl.getUniformLocation(program, n);
  const L = {
    field: u("uField"),
    mode: u("uMode"),
    progress: u("uProgress"),
    spread: u("uSpread"),
    flight: u("uFlight"),
    intensity: u("uIntensity"),
    detail: u("uDetail"),
    glow: u("uGlow"),
    aspect: u("uAspect"),
  };
  return {
    render(target: RenderTarget, fieldTex: WebGLTexture, p: EnergyWarpUniforms) {
      bindRenderTarget(gl, target);
      gl.useProgram(program);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, fieldTex);
      gl.uniform1i(L.field, 0);
      gl.uniform1i(L.mode, p.mode);
      gl.uniform1f(L.progress, p.progress);
      gl.uniform1f(L.spread, p.spread);
      gl.uniform1f(L.flight, p.flight);
      gl.uniform1f(L.intensity, p.intensity);
      gl.uniform1f(L.detail, p.detail);
      gl.uniform1f(L.glow, p.glow);
      gl.uniform1f(L.aspect, p.aspect);
      quad.draw();
    },
    dispose() {
      gl.deleteProgram(program);
    },
  };
}
```

- [ ] **Step 3:** `pir typecheck` + `pir test` green. Handle the particleMerge file deletions per the Files note.

- [ ] **Step 4: Commit** — `git add -A && git commit -m "feat(engine): energy warp reveal pass (6 unified variants)"`

---

### Task 3: Engine wiring swap + topology test

**Files:**

- Modify: `packages/stripes-engine/src/engine.ts`
- Delete (if still present): the four particleMerge shader/pass files
- Test: `packages/stripes-engine/src/engine.topology.test.ts`

**Interfaces:**

- Consumes: `createEnergyWarpPass`, `EnergyWarpUniforms`; config fields from Task 1.
- Produces: `energyWarpField` pass when `style !== "scatter"`; `assemblyPassKind` → `"none" | "scatter" | "warp"`.

- [ ] **Step 1: Topology test.** Helper kind: `cfg.reveal.assembly.style === "scatter" ? "scatter" : "warp"`. Replace the two particle style tests:

```ts
it("switching assembly style scatter <-> turbulence triggers rebuild", () => {
  const scatter = normalizeEngineConfig({
    reveal: { enabled: true, type: "assembly", assembly: { style: "scatter" } },
  });
  const warp = normalizeEngineConfig({
    reveal: { enabled: true, type: "assembly", assembly: { style: "turbulence" } },
  });
  expect(needsRebuild(scatter, warp)).toBe(true);
  expect(needsRebuild(warp, scatter)).toBe(true);
});

it("switching among warp styles or params does not trigger rebuild", () => {
  const a = normalizeEngineConfig({
    reveal: { enabled: true, type: "assembly", assembly: { style: "turbulence", intensity: 0.5 } },
  });
  const b = normalizeEngineConfig({
    reveal: { enabled: true, type: "assembly", assembly: { style: "glitch", intensity: 2 } },
  });
  expect(needsRebuild(a, b)).toBe(false);
});
```

- [ ] **Step 2: Engine.** (a) `assemblyPassKind`: `"particles"` literal → `"warp"`. (b) Replace the whole `particleMergeField` branch with:

```ts
if (assemblyTopology && config.reveal.assembly.style !== "scatter") {
  const warpPass = createEnergyWarpPass(gl, quad);
  const WARP_MODES: Record<string, number> = {
    turbulence: 0,
    vortex: 1,
    streams: 2,
    pull: 3,
    ripple: 4,
    glitch: 5,
  };
  revealFieldPasses.push({
    name: "energyWarpField",
    render: () => {
      const fieldRT = pool.get("field", fieldSize.width, fieldSize.height, { linear: true });
      const revealedRT = pool.get("revealedField", fieldSize.width, fieldSize.height, { linear: true });
      const { assembly } = config.reveal;
      const durationMs = resolveRevealDurationMs(config.reveal);
      const rawProgress = (clock.now() - revealStartMs) / durationMs;
      const dur = Math.max(1, assembly.staggerMs + assembly.speedMaxMs);
      const speedMin = Math.max(0, assembly.speedMinMs);
      const speedMax = Math.max(speedMin, assembly.speedMaxMs);
      const avgTotal = Math.min(0.98, Math.max(0.05, (speedMin + speedMax) / 2 / dur));
      const spread = assembly.staggerMs / dur;
      warpPass.render(revealedRT, fieldRT.texture, {
        mode: WARP_MODES[assembly.style] ?? 0,
        progress: rawProgress,
        spread,
        flight: avgTotal,
        intensity: assembly.intensity,
        detail: assembly.detail,
        glow: assembly.glow,
        aspect: cssW / Math.max(1, cssH),
      });
    },
    dispose: () => warpPass.dispose(),
  });
} else if (assemblyTopology) {
```

(c) Swap imports (`createParticleMergePass` → `createEnergyWarpPass`); delete the four particleMerge files; grep to confirm zero references to particleMerge/particleCount/particleSizePx/swirl remain in packages/stripes-engine/src.

- [ ] **Step 3:** `pir test` + `pir typecheck` green.

- [ ] **Step 4: Commit** — `git add -A && git commit -m "feat(engine): wire energy warp pass, drop particle merge"`

---

### Task 4: Lab verify (likely no-op)

- [ ] Task 1 already rewired leva. Verify: dropdown has 7 options; Intensity/Detail/Glow render for any non-scatter style; mapping uses `values.reveal*`; grep confirms no particle control leftovers. Commit only if a fix is needed.

---

### Task 5: Visual verification (main session)

- [ ] Dev server via existing `pir dev --host` background task; remote pool browser; for each of the six styles: Replay, capture early/mid/late frames.
- [ ] Confirm: image present-but-stirred from the start (no empty phase, no crossfade seam), settles to exact field, glow decays with motion, no NaN/banding.
- [ ] Show the user; feel verdict is theirs live.
