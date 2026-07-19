# Hadouken Reveal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Keep turbulence + glitch (reworked to ignite from black, turbulence animated), delete the four rejected warp styles, and add the `hadouken` style: particles converge to center and the field blooms outward with accumulated charge.

**Architecture:** `AssemblyStyle` becomes `"scatter" | "turbulence" | "glitch" | "hadouken"`. `energyWarp.frag.ts` shrinks to two modes with emergence-from-black and time-advected turbulence noise. A new `hadoukenPass` runs two programs: a fullscreen core composite (radial reveal mask + ring + core glow driven by a CPU `charge` uniform) then instanced PCG-hashed particles MAX-blended on top. Topology adds a `"hadouken"` kind.

**Tech Stack:** TypeScript, WebGL2 (GLSL ES 3.00), vitest, leva. Scripts via `pir` only.

**Spec:** `docs/superpowers/specs/2026-07-19-hadouken-reveal-design.md`

## Global Constraints

- `"scatter"` byte-for-byte preserved; wave untouched. Invalid/legacy styles normalize to scatter.
- Timing model unchanged (`dur`, `spread`, `avgTotal` identical to scatter); progress raw.
- From-nothing invariant: every non-scatter style renders BLACK at progress 0 and the exact field at rest.
- Cubic-out easing only; no overshoot. GLSL: never `pow` with a possibly-negative base — write `x*x`.
- `intensity`/`detail`/`glow` keep their clamps; new `particleCount` default 4000, clamp 500–20000 (rounded).
- Hadouken particle hashes use salted uint PCG (never sin-fract for per-instance hashing).
- No code comments unless non-obvious constraint. `pir test` / `pir typecheck` at repo root. Commit per task. Never set git identity; never push.

---

### Task 1: Config swap + lab (types/normalize/legacy/leva/tests)

**Files:**

- Modify: `packages/stripes-engine/src/config/types.ts`, `packages/stripes-engine/src/config/normalize.ts`, `packages/stripes-engine/src/legacy/migrateLegacyConfig.ts` (+ test if needed), `apps/lab/src/defaultLabConfig.ts`, `apps/lab/src/controls/levaSchema.ts`
- Test: `packages/stripes-engine/src/config/normalize.test.ts`

**Interfaces:**

- Produces: `AssemblyStyle = "scatter" | "turbulence" | "glitch" | "hadouken"`; assembly gains `particleCount: number` (keeps `intensity`/`detail`/`glow`).

- [ ] **Step 1: Update the "assembly warp styles" describe block in `normalize.test.ts`:**

```ts
describe("assembly warp styles", () => {
  it("defaults style to scatter and accepts surviving styles", () => {
    expect(normalizeReveal({}).assembly.style).toBe("scatter");
    for (const s of ["turbulence", "glitch", "hadouken"] as const) {
      expect(normalizeReveal({ assembly: { style: s } }).assembly.style).toBe(s);
    }
  });

  it("falls back to scatter on invalid or removed styles", () => {
    for (const s of ["bogus", "particles", "vortex", "streams", "pull", "ripple"]) {
      expect(normalizeReveal({ assembly: { style: s as never } }).assembly.style).toBe("scatter");
    }
  });

  it("defaults and clamps intensity, detail, glow, particleCount", () => {
    const d = normalizeReveal({}).assembly;
    expect(d.intensity).toBe(1);
    expect(d.detail).toBe(0.5);
    expect(d.glow).toBe(0.6);
    expect(d.particleCount).toBe(4000);
    const c = normalizeReveal({ assembly: { intensity: 5, detail: -1, glow: 2, particleCount: 999999 } }).assembly;
    expect(c.intensity).toBe(2);
    expect(c.detail).toBe(0);
    expect(c.glow).toBe(1);
    expect(c.particleCount).toBe(20000);
    expect(normalizeReveal({ assembly: { particleCount: 10 } }).assembly.particleCount).toBe(500);
  });
});
```

- [ ] **Step 2:** `pir test -- normalize` — FAIL expected.

- [ ] **Step 3: Implement.** `types.ts`: `AssemblyStyle` = the four styles; add `particleCount: number` to assembly (keep intensity/detail/glow). `normalize.ts`: `ASSEMBLY_STYLES` = four styles; `DEFAULT_REVEAL.assembly` adds `particleCount: 4000`; `normalizeReveal` adds:

```ts
particleCount: clamp(Math.round(num(a.particleCount, DEFAULT_REVEAL.assembly.particleCount)), 500, 20000),
```

`migrateLegacyConfig.ts` + `defaultLabConfig.ts`: add `particleCount: 4000`.

`levaSchema.ts`: dropdown options become `{ Scatter: "scatter", Turbulence: "turbulence", Glitch: "glitch", Hadouken: "hadouken" } as const`; add after `revealGlow`:

```ts
revealParticleCount: {
  value: d.reveal.assembly.particleCount,
  min: 500,
  max: 20000,
  step: 100,
  label: "Particle count",
  render: (get) =>
    get("Reveal.revealType") === "assembly" && get("Reveal.revealAssemblyStyle") === "hadouken",
},
```

Mapping adds `particleCount: values.revealParticleCount`. Intensity/Detail/Glow predicates stay `!== "scatter"`.

- [ ] **Step 4:** `pir test` + `pir typecheck` green (no engine shim should be needed — the engine's WARP_MODES record is `Record<string, number>` and tolerates the union shrink; if anything else breaks, fix minimally and note it).

- [ ] **Step 5: Commit** — `git add -A && git commit -m "feat(engine): reveal styles scatter|turbulence|glitch|hadouken + particleCount"`

---

### Task 2: Rework energyWarp shader (2 living modes, emergence)

**Files:**

- Modify: `packages/stripes-engine/src/shaders/energyWarp.frag.ts` (full replacement below)
- Modify: `packages/stripes-engine/src/passes/energyWarpPass.ts` (remove `aspect` from `EnergyWarpUniforms`, its uniform location, and its `uniform1f` call — everything else unchanged)
- Modify: `packages/stripes-engine/src/engine.ts` (warp branch: `WARP_MODES` becomes `{ turbulence: 0, glitch: 1 }`; remove the `aspect:` entry from the uniforms object)

**Interfaces:**

- `EnergyWarpUniforms` = { mode, progress, spread, flight, intensity, detail, glow } (aspect removed). Modes: 0 turbulence, 1 glitch.

- [ ] **Step 1: Replace `ENERGY_WARP_FRAG` entirely with:**

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
  highp float freq = mix(2.0, 10.0, uDetail);

  highp float n;
  if (uMode == 0) {
    n = fbm2(vUv * mix(3.0, 12.0, uDetail) + 7.3);
  } else {
    highp float rows = mix(14.0, 56.0, uDetail);
    n = vhash(vec2(floor(vUv.y * rows) * 0.61, 8.8));
  }

  highp float f = clamp((p - uSpread * n) / max(uFlight, 1e-4), 0.0, 1.0);
  highp float ease = 1.0 - pow(1.0 - f, 3.0);
  highp float decay = 1.0 - ease;

  vec2 D;
  highp float emerge;
  if (uMode == 0) {
    vec2 flow = vec2(p * 2.2, -p * 1.7);
    highp float ang = fbm2(vUv * freq + flow + 2.1) * 12.566370;
    highp float mag = 0.5 + 0.5 * fbm2(vUv * freq * 1.7 - flow.yx + 5.9);
    D = vec2(cos(ang), sin(ang)) * 0.28 * mag;
    emerge = smoothstep(0.0, 0.4, f);
  } else {
    highp float rows = mix(14.0, 56.0, uDetail);
    highp float row = floor(vUv.y * rows);
    highp float h = vhash(vec2(row * 0.37 + floor(p * 22.0) * 1.13, 4.2));
    D = vec2((h - 0.5) * 0.55, 0.0);
    emerge = smoothstep(0.0, 0.25, f);
  }

  vec2 disp = D * uIntensity * decay;
  highp float acc = 0.0;
  for (int t = 0; t < 5; t++) {
    highp float w = 0.55 + 0.225 * float(t);
    acc += texture(uField, clamp(vUv + disp * w, 0.0, 1.0)).r;
  }
  highp float v = acc * 0.2;
  highp float gain = 1.0 + uGlow * 1.2 * min(1.0, length(disp) * 8.0) * decay + uGlow * 1.6 * emerge * (1.0 - emerge);
  if (uMode == 1) {
    gain += uGlow * 0.5 * decay * (vhash(vec2(floor(p * 22.0), 3.7)) - 0.5) * 2.0;
  }
  finalColor = vec4(vec3(v * gain * emerge), 1.0);
}
`;
```

(Invariant check: p = 0 → f = 0 → emerge = 0 → black. Rest: f = 1 → decay = 0, emerge = 1, gain = 1 → exact field.)

- [ ] **Step 2:** Apply the pass/engine `aspect` removal and `WARP_MODES = { turbulence: 0, glitch: 1 }`.

- [ ] **Step 3:** `pir test` + `pir typecheck` green.

- [ ] **Step 4: Commit** — `git add -A && git commit -m "feat(engine): living turbulence + glitch ignition, drop dead warp modes"`

---

### Task 3: Hadouken pass (shaders + pass)

**Files:**

- Create: `packages/stripes-engine/src/shaders/hadoukenCore.frag.ts`
- Create: `packages/stripes-engine/src/shaders/hadoukenParticles.vert.ts`
- Create: `packages/stripes-engine/src/shaders/hadoukenParticles.frag.ts`
- Create: `packages/stripes-engine/src/passes/hadoukenPass.ts`

**Interfaces:**

- Consumes: `FULLSCREEN_VERT`, `compileProgram`, `bindRenderTarget`/`RenderTarget`.
- Produces: `createHadoukenPass(gl: WebGL2RenderingContext, quad: { draw(): void })` → `{ render(target, fieldTex, p: HadoukenUniforms), dispose() }`; `HadoukenUniforms = { progress: number; spread: number; flight: number; charge: number; count: number; sizeUv: [number, number]; detail: number; glow: number; aspect: number }`.

- [ ] **Step 1: `hadoukenCore.frag.ts`:**

```ts
export const HADOUKEN_CORE_FRAG = `#version 300 es
precision highp float;
in vec2 vUv;
uniform sampler2D uField;
uniform float uProgress;
uniform float uCharge;
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
  highp float angn = r > 1e-5 ? atan(a.y, a.x) : 0.0;
  highp float maxR = length(vec2(uAspect, 1.0)) * 0.5;
  highp float R = (maxR * 1.15 + 0.16) * pow(uCharge, 0.8);
  highp float edgeN = (fbm2(vec2(angn * mix(1.0, 4.0, uDetail) + 3.1, p * 1.5)) - 0.5) * 0.25;
  highp float Rl = max(0.0, R * (1.0 + edgeN));
  highp float done = smoothstep(0.85, 1.0, uCharge);
  highp float mask = max(smoothstep(Rl, Rl - 0.12, r), done);
  highp float rw = (r - Rl) * 9.0;
  highp float ring = exp(-rw * rw) * uGlow * 1.2 * (1.0 - done) * step(0.001, uCharge);
  highp float coreSize = 0.04 + 0.1 * uCharge;
  highp float core = exp(-(r * r) / (coreSize * coreSize)) * uGlow * (0.4 + 1.2 * uCharge) * (1.0 - done) * step(0.001, uCharge);
  highp float v = texture(uField, vUv).r * mask;
  finalColor = vec4(vec3(v + ring + core), 1.0);
}
`;
```

(pow(uCharge, 0.8) has non-negative base — safe. charge 0 → R 0, mask 0, ring/core gated off by step → black. charge 1 → done 1, R ≥ maxR·1.006 even at edgeN −0.125 → mask 1 everywhere → exact field.)

- [ ] **Step 2: `hadoukenParticles.vert.ts`:**

```ts
export const HADOUKEN_PARTICLES_VERT = `#version 300 es
precision highp float;
uniform float uProgress;
uniform float uSpread;
uniform float uFlight;
uniform vec2 uSizeUv;
out vec2 vQuad;
flat out highp float vVal;

highp uint pcg(highp uint v) {
  v = v * 747796405u + 2891336453u;
  highp uint s = ((v >> ((v >> 28) + 4u)) ^ v) * 277803737u;
  return (s >> 22) ^ s;
}

highp float hashLane(highp uint i, highp uint salt) {
  return float(pcg(i * 747796405u + salt)) * (1.0 / 4294967296.0);
}

void main() {
  highp uint id = uint(gl_InstanceID);
  highp float o = hashLane(id, 1u);
  highp float p = max(uProgress, 0.0);
  highp float f = clamp((p - uSpread * o) / max(uFlight, 1e-4), 0.0, 1.0);
  if (f <= 0.0 || f >= 1.0) {
    vQuad = vec2(0.0);
    vVal = 0.0;
    gl_Position = vec4(0.0, 0.0, 2.0, 1.0);
    return;
  }
  vec2 start = vec2(hashLane(id, 2u), hashLane(id, 3u)) * 1.3 - 0.15;
  vec2 target = vec2(0.5) + (vec2(hashLane(id, 4u), hashLane(id, 5u)) - 0.5) * 0.05;
  highp float ease = 1.0 - pow(1.0 - f, 3.0);
  vec2 pos = mix(start, target, ease);
  vec2 delta = target - start;
  highp float len = max(length(delta), 1e-4);
  vec2 dirN = delta / len;
  highp float speed = 3.0 * (1.0 - f) * (1.0 - f) * len;
  highp float stretch = 1.0 + min(6.0, speed * 10.0);
  highp float sizeScale = (0.6 + 0.8 * hashLane(id, 6u)) * (1.0 - 0.6 * ease);
  vec2 halfExt = 0.5 * uSizeUv * sizeScale;
  int vid = gl_VertexID;
  highp float qx = (vid == 1 || vid == 2 || vid == 4) ? 1.0 : 0.0;
  highp float qy = (vid == 2 || vid == 4 || vid == 5) ? 1.0 : 0.0;
  vec2 corner0 = (vec2(qx, qy) - 0.5) * 2.0 * halfExt * vec2(stretch, 1.0);
  vec2 rot = vec2(corner0.x * dirN.x - corner0.y * dirN.y, corner0.x * dirN.y + corner0.y * dirN.x);
  vQuad = vec2(qx, qy);
  highp float fadeIn = smoothstep(0.0, 0.15, f);
  highp float fadeOut = 1.0 - smoothstep(0.85, 1.0, f);
  vVal = (0.55 + 0.45 * hashLane(id, 7u)) * fadeIn * fadeOut;
  gl_Position = vec4((pos + rot) * 2.0 - 1.0, 0.0, 1.0);
}
`;
```

- [ ] **Step 3: `hadoukenParticles.frag.ts`:**

```ts
export const HADOUKEN_PARTICLES_FRAG = `#version 300 es
precision highp float;
in vec2 vQuad;
flat in highp float vVal;
out vec4 finalColor;
void main() {
  highp float d = length(vQuad - 0.5) * 2.0;
  highp float a = smoothstep(1.0, 0.1, d);
  finalColor = vec4(vec3(vVal * a), 1.0);
}
`;
```

- [ ] **Step 4: `hadoukenPass.ts`:**

```ts
import { compileProgram } from "../gl/program";
import { bindRenderTarget, type RenderTarget } from "../gl/renderTarget";
import { FULLSCREEN_VERT } from "../shaders/fullscreen.vert";
import { HADOUKEN_CORE_FRAG } from "../shaders/hadoukenCore.frag";
import { HADOUKEN_PARTICLES_VERT } from "../shaders/hadoukenParticles.vert";
import { HADOUKEN_PARTICLES_FRAG } from "../shaders/hadoukenParticles.frag";

export type HadoukenUniforms = {
  progress: number;
  spread: number;
  flight: number;
  charge: number;
  count: number;
  sizeUv: [number, number];
  detail: number;
  glow: number;
  aspect: number;
};

export function createHadoukenPass(gl: WebGL2RenderingContext, quad: { draw(): void }) {
  const coreProgram = compileProgram(gl, FULLSCREEN_VERT, HADOUKEN_CORE_FRAG);
  const particleProgram = compileProgram(gl, HADOUKEN_PARTICLES_VERT, HADOUKEN_PARTICLES_FRAG);
  const vao = gl.createVertexArray();
  if (!vao) throw new Error("Failed to create VAO");
  const cu = (n: string) => gl.getUniformLocation(coreProgram, n);
  const C = {
    field: cu("uField"),
    progress: cu("uProgress"),
    charge: cu("uCharge"),
    detail: cu("uDetail"),
    glow: cu("uGlow"),
    aspect: cu("uAspect"),
  };
  const pu = (n: string) => gl.getUniformLocation(particleProgram, n);
  const P = {
    progress: pu("uProgress"),
    spread: pu("uSpread"),
    flight: pu("uFlight"),
    sizeUv: pu("uSizeUv"),
  };
  return {
    render(target: RenderTarget, fieldTex: WebGLTexture, p: HadoukenUniforms) {
      bindRenderTarget(gl, target);
      gl.useProgram(coreProgram);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, fieldTex);
      gl.uniform1i(C.field, 0);
      gl.uniform1f(C.progress, p.progress);
      gl.uniform1f(C.charge, p.charge);
      gl.uniform1f(C.detail, p.detail);
      gl.uniform1f(C.glow, p.glow);
      gl.uniform1f(C.aspect, p.aspect);
      quad.draw();
      if (p.charge < 1) {
        gl.useProgram(particleProgram);
        gl.uniform1f(P.progress, p.progress);
        gl.uniform1f(P.spread, p.spread);
        gl.uniform1f(P.flight, p.flight);
        gl.uniform2f(P.sizeUv, p.sizeUv[0], p.sizeUv[1]);
        gl.enable(gl.BLEND);
        gl.blendEquation(gl.MAX);
        gl.bindVertexArray(vao);
        gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, Math.max(1, Math.floor(p.count)));
        gl.bindVertexArray(null);
        gl.blendEquation(gl.FUNC_ADD);
        gl.disable(gl.BLEND);
      }
    },
    dispose() {
      gl.deleteProgram(coreProgram);
      gl.deleteProgram(particleProgram);
      gl.deleteVertexArray(vao);
    },
  };
}
```

- [ ] **Step 5:** `pir typecheck` + `pir test` green.

- [ ] **Step 6: Commit** — `git add -A && git commit -m "feat(engine): hadouken reveal pass (charge-driven radial bloom)"`

---

### Task 4: Engine wiring + topology

**Files:**

- Modify: `packages/stripes-engine/src/engine.ts`
- Test: `packages/stripes-engine/src/engine.topology.test.ts`

**Interfaces:**

- Consumes: `createHadoukenPass`/`HadoukenUniforms` from Task 3.
- Produces: `assemblyPassKind` → `"none" | "scatter" | "warp" | "hadouken"`; `hadoukenField` pass renders when style === "hadouken".

- [ ] **Step 1: Topology test.** Helper kind:

```ts
const assemblyKind = !assemblyTopo
  ? "none"
  : cfg.reveal.assembly.style === "scatter"
    ? "scatter"
    : cfg.reveal.assembly.style === "hadouken"
      ? "hadouken"
      : "warp";
```

Replace the warp style tests with:

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

it("switching warp <-> hadouken triggers rebuild", () => {
  const warp = normalizeEngineConfig({ reveal: { enabled: true, type: "assembly", assembly: { style: "glitch" } } });
  const hadouken = normalizeEngineConfig({
    reveal: { enabled: true, type: "assembly", assembly: { style: "hadouken" } },
  });
  expect(needsRebuild(warp, hadouken)).toBe(true);
  expect(needsRebuild(hadouken, warp)).toBe(true);
});

it("turbulence <-> glitch and param changes do not trigger rebuild", () => {
  const a = normalizeEngineConfig({
    reveal: { enabled: true, type: "assembly", assembly: { style: "turbulence", intensity: 0.5 } },
  });
  const b = normalizeEngineConfig({
    reveal: { enabled: true, type: "assembly", assembly: { style: "glitch", intensity: 2 } },
  });
  expect(needsRebuild(a, b)).toBe(false);
});
```

- [ ] **Step 2: Engine.** (a) `assemblyPassKind` returns `"hadouken"` for that style, `"warp"` for turbulence/glitch, unchanged otherwise. (b) Branch chain: BEFORE the existing warp branch add:

```ts
if (assemblyTopology && config.reveal.assembly.style === "hadouken") {
  const hadoukenPass = createHadoukenPass(gl, quad);
  revealFieldPasses.push({
    name: "hadoukenField",
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
      const charge = Math.min(1, Math.max(0, (rawProgress - avgTotal) / Math.max(spread, 0.2)));
      const sizePx = 6 * Math.max(0.05, assembly.intensity);
      hadoukenPass.render(revealedRT, fieldRT.texture, {
        progress: rawProgress,
        spread,
        flight: avgTotal,
        charge,
        count: assembly.particleCount,
        sizeUv: [sizePx / Math.max(1, cssW), sizePx / Math.max(1, cssH)],
        detail: assembly.detail,
        glow: assembly.glow,
        aspect: cssW / Math.max(1, cssH),
      });
    },
    dispose: () => hadoukenPass.dispose(),
  });
} else if (assemblyTopology && config.reveal.assembly.style !== "scatter") {
```

(the existing warp branch becomes the `else if` shown; scatter/wave branches untouched).

- [ ] **Step 3:** `pir test` + `pir typecheck` green (run the FULL workspace suite from repo root).

- [ ] **Step 4: Commit** — `git add -A && git commit -m "feat(engine): wire hadouken reveal into topology"`

---

### Task 5: Visual verification (main session)

- [ ] For each of Turbulence / Glitch / Hadouken: Replay and capture early (~black + first energy), mid (motion), settle frames.
- [ ] Confirm the from-nothing invariant (first frame black), turbulence roiling, hadouken particle convergence + center bloom, exact field at rest.
- [ ] Show the user; feel verdict theirs.
