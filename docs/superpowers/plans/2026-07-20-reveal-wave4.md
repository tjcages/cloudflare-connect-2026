# Reveal Wave 4 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Lean early-peak hadouken, delete ink/trace/pulse, add storm + digital detonation (energyWarp modes) and a REAL feedback fluid-sim reveal (own pass).

**Spec:** `docs/superpowers/specs/2026-07-20-reveal-wave4-design.md` — normative.

## Global Constraints

- Black at p 0; exact field at rest via early-outs; no springs; no pow(negative) — `x*x`; NO GLSL ES reserved words; coverage floors on mask modes; scatter/wave untouched.
- Controller live-loads and cycles all energy types after shader tasks; ultracode verification workflow before that.
- `pir` only; no code comments; commit per task; never set git identity; never push.

---

### Task 1: Config swap (types/normalize/leva/tests)

Mirror commit b795b2e's shape: `RevealType` swaps ink/trace/pulse → fluid/storm/detonation; normalize blocks + defaults per spec (fluid 400/2800/400/1/0.5/0.7, storm 400/2600/600/1/0.5/0.7, detonation 200/1400/1200/1/0.5/0.8; hadouken particleCount 1800 + staggerMs 900 at BOTH declaration sites); removed strings → assembly fallback (tested); engine `WARP_MODES = { turbulence: 0, glitch: 1, storm: 2, detonation: 3 }` + `isWarpRevealType` = those four; `revealPassKind` gains `"fluid"` kind (type === "fluid" → "fluid"); an INTERIM no-op branch for fluid is acceptable this task ONLY if needed to keep types exhaustive — prefer routing fluid to a placeholder that renders the plain field via the existing wave/reveal pass? NO — simplest interim: `revealPassKind` returns "fluid" but `buildPasses` has no fluid branch yet, so reveal falls through to no reveal pass; verify `activeFieldRT` handling doesn't break (if `revealEnabled` is true but no pass pushed, revealedField RT is never written — check how activeFieldRT is chosen and ensure fluid interim falls back to `"field"` until Task 4; note what you did). Leva: Type dropdown 8 entries (…/Fluid/Storm/Detonation), delete three removed groups, add `revealFluid*`/`revealStorm*`/`revealDetonation*` groups (6 controls each, ranges as turbulence); defaultLabConfig + underlayIntro sync; tests (defaults, fallback, durations fluid 3200 / storm 3200 / detonation 2600, topology: storm↔detonation no rebuild, fluid↔storm rebuilds).

- [ ] Tests first → implement → full `pir test` + `pir typecheck` green → commit `feat(engine): swap reveal modes to fluid/storm/detonation (+lean hadouken defaults)`.

---

### Task 2: energyWarp modes 2/3 (storm, detonation)

Replace the mode 2 (ink), mode 3 (trace), and trailing mode 4 (pulse) blocks in `packages/stripes-engine/src/shaders/energyWarp.frag.ts` — modes 0/1 and the n-phase/f/early-out skeleton stay, EXCEPT the n-phase entries for modes 2/3/5 which become:

```glsl
  } else if (uMode == 2) {
    n = 0.1 + fbm2(vUv * 6.0 + 11.7) * 0.1;
  } else {
    highp float rows = mix(14.0, 60.0, uDetail);
    n = vhash(vec2(floor(vUv.y * rows) * 0.57, 12.3));
  }
```

(the old `uMode == 3` texture-fetch n and `uMode == 5` seed n entries are deleted; mode 3 uses the else branch above). After the mode 1 block, the remaining code becomes exactly:

```glsl
  if (uMode == 2) {
    vec2 c0 = vUv - 0.5;
    highp float r = length(c0);
    vec2 rdir = r > 1e-4 ? c0 / r : vec2(1.0, 0.0);
    vec2 perp = vec2(-rdir.y, rdir.x);
    highp float settleStart = 0.55 + 0.35 * clamp(r * 1.4, 0.0, 1.0);
    highp float s = smoothstep(settleStart, 1.0, f);
    highp float dsettle = s * s * (3.0 - 2.0 * s);
    highp float decay = 1.0 - dsettle;
    highp float emerge = smoothstep(0.0, 0.18, f);
    highp float eye = smoothstep(0.04, 0.3, r);
    highp float spinUp = smoothstep(0.05, 0.45, f);
    vec2 flow = vec2(p * 1.1, -p * 0.8);
    vec2 q1 = vUv * freq + flow + 4.2;
    highp float e = 0.09;
    vec2 c1 = vec2(fbm2(q1 + vec2(0.0, e)) - fbm2(q1 - vec2(0.0, e)), fbm2(q1 - vec2(e, 0.0)) - fbm2(q1 + vec2(e, 0.0))) / (2.0 * e);
    vec2 disp = (perp * 0.38 * eye * spinUp + c1 * 0.05) * uIntensity * decay;
    highp float acc = 0.0;
    for (int t = 0; t < 5; t++) {
      highp float w = 0.55 + 0.225 * float(t);
      acc += texture(uField, clamp(vUv + disp * w, 0.0, 1.0)).r;
    }
    highp float v = acc * 0.2;
    highp float gain = 1.0 + uGlow * 1.1 * min(1.0, length(disp) * 6.0) * decay + uGlow * 1.4 * emerge * (1.0 - emerge);
    finalColor = vec4(vec3(v * gain * emerge), 1.0);
    return;
  }

  highp float inten = smoothstep(0.0, 0.75, f);
  inten *= inten;
  highp float masterDecay = 1.0 - smoothstep(0.82, 0.95, f);
  highp float emerge = smoothstep(0.0, 0.1, f) * (0.45 + 0.55 * smoothstep(0.3, 0.9, f));
  highp float rows = mix(14.0, 60.0, uDetail);
  highp float rowC = floor(vUv.y * rows);
  highp float stp = floor(p * 46.0);
  highp float duty = mix(0.92, 0.3, inten);
  highp float act = step(duty, vhash(vec2(rowC * 0.53 + stp * 1.71, 6.1)));
  highp float h = vhash(vec2(rowC * 0.37 + stp * 1.13, 4.2));
  vec2 disp = vec2((h - 0.5) * (0.25 + 0.45 * inten), (vhash(vec2(rowC * 0.71 + stp * 1.31, 2.6)) - 0.5) * 0.05 * inten) * act * masterDecay * uIntensity;
  highp float acc = 0.0;
  for (int t = 0; t < 5; t++) {
    highp float w = 0.55 + 0.225 * float(t);
    acc += texture(uField, clamp(vUv + disp * w, 0.0, 1.0)).r;
  }
  highp float v = acc * 0.2;
  highp float white = smoothstep(0.78, 0.86, f) * (1.0 - smoothstep(0.88, 0.97, f));
  highp float gain = 1.0 + uGlow * 0.6 * act * inten * masterDecay + uGlow * 0.5 * inten * masterDecay * (vhash(vec2(stp, 3.7)) - 0.5) * 2.0;
  finalColor = vec4(vec3(v * max(gain, 0.0) * emerge + white * uGlow * 1.6), 1.0);
}
```

- [ ] `pir typecheck` + `pir test` green → commit `feat(engine): storm + digital detonation modes`.

---

### Task 3: Hadouken lean arc

**hadoukenParticles.vert.ts** — replace the o line:

```glsl
  highp float o = u0 < 0.5 ? sqrt(0.5 * u0) : 1.0 - sqrt(0.5 * (1.0 - u0));
```

with:

```glsl
  highp float o = u0 < 0.3 ? sqrt(u0 * 0.3) : 1.0 - sqrt((1.0 - u0) * 0.7);
```

**engine.ts** (hadouken branch) — replace the charge-shaping pair:

```ts
const charge = lin < 0.5 ? 2 * lin * lin : 1 - 2 * (1 - lin) * (1 - lin);
```

with:

```ts
const charge = lin < 0.3 ? (lin * lin) / 0.3 : 1 - ((1 - lin) * (1 - lin)) / 0.7;
```

and the chargeEnd coefficient `0.82` → `0.68`.

- [ ] `pir typecheck` + `pir test` green → commit `feat(engine): hadouken lean early-peak arc, immediate detonation`.

---

### Task 4: Fluid sim pass

**Create `packages/stripes-engine/src/shaders/fluidSim.frag.ts`:**

```ts
export const FLUID_SIM_FRAG = `#version 300 es
precision highp float;
in vec2 vUv;
uniform sampler2D uState;
uniform float uDt;
uniform float uProgress;
uniform float uIntensity;
uniform float uDetail;
out vec4 outState;

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
  vec4 st = texture(uState, vUv);
  vec2 src = clamp(vUv - st.rg * uDt, 0.0, 1.0);
  vec4 adv = texture(uState, src);
  vec2 vel = adv.rg * 0.985;
  highp float dye = adv.b * 0.996;
  vec2 q = vUv * mix(3.0, 8.0, uDetail) + p * 0.35;
  highp float e = 0.09;
  vec2 curl = vec2(fbm2(q + vec2(0.0, e)) - fbm2(q - vec2(0.0, e)), fbm2(q - vec2(e, 0.0)) - fbm2(q + vec2(e, 0.0))) / (2.0 * e);
  vel += curl * 0.045 * uIntensity * uDt * 60.0;
  for (int k = 0; k < 3; k++) {
    highp float fk = float(k);
    highp float ang = p * (0.5 + 0.2 * fk) + fk * 2.094;
    vec2 ip = vec2(0.5) + vec2(cos(ang), sin(ang) * 0.6) * (0.22 + 0.08 * fk);
    vec2 d = vUv - ip;
    highp float splat = exp(-dot(d, d) * 260.0);
    dye += splat * uDt * (2.6 + 0.5 * fk);
    vel += vec2(-d.y, d.x) * splat * uDt * 30.0 * uIntensity;
  }
  outState = vec4(clamp(vel, vec2(-2.0), vec2(2.0)), clamp(dye, 0.0, 2.0), 1.0);
}
`;
```

**Create `packages/stripes-engine/src/shaders/fluidComposite.frag.ts`:**

```ts
export const FLUID_COMPOSITE_FRAG = `#version 300 es
precision highp float;
in vec2 vUv;
uniform sampler2D uField;
uniform sampler2D uStateTex;
uniform float uProgress;
uniform float uSpread;
uniform float uFlight;
uniform float uGlow;
out vec4 finalColor;

void main() {
  highp float p = max(uProgress, 0.0);
  highp float f = clamp(p / max(uSpread + uFlight, 1e-4), 0.0, 1.0);
  if (f >= 1.0) {
    finalColor = vec4(vec3(texture(uField, vUv).r), 1.0);
    return;
  }
  vec4 st = texture(uStateTex, vUv);
  highp float visRaw = smoothstep(0.12, 0.85, st.b);
  highp float vis = max(visRaw, smoothstep(0.88, 1.0, f));
  vec2 su = clamp(vUv - st.rg * 0.04 * (1.0 - vis), 0.0, 1.0);
  highp float v = texture(uField, su).r;
  highp float edge = visRaw * (1.0 - visRaw) * 4.0;
  finalColor = vec4(vec3(v * vis + edge * edge * uGlow * 0.45), 1.0);
}
`;
```

**Create `packages/stripes-engine/src/passes/fluidPass.ts`** — two programs (sim: FULLSCREEN_VERT + FLUID_SIM_FRAG; composite: FULLSCREEN_VERT + FLUID_COMPOSITE_FRAG), following `revealPass.ts` structure. Exports `createFluidPass(gl, quad)` → `{ simStep(dst: RenderTarget, stateTex: WebGLTexture, u: { dt, progress, intensity, detail }), composite(target: RenderTarget, fieldTex: WebGLTexture, stateTex: WebGLTexture, u: { progress, spread, flight, glow }), dispose() }`.

**Engine wiring** — new `"fluid"` branch in `buildPasses` (before the warp branch):

- State RTs: half field resolution, ping-pong pair from the pool: `pool.get("fluidStateA"/"fluidStateB", halfW, halfH, { linear: true, float: true })`. Inspect `gl/renderTarget.ts` + the pool first: if a float/RGBA16F option doesn't exist, add one (WebGL2 `RGBA16F` + `EXT_color_buffer_float` — the context already enables float RTs elsewhere per the codebase; follow existing precedent). If float RTs are genuinely unavailable, fall back to RGBA8 with velocity encoded around 0.5 (×4 range) and note it in the report.
- Per-frame render closure: compute `rawProgress` (style block = `config.reveal.fluid`, same derived timing math as the warp branch); track `lastFluidProgress` and `lastFrameMs` in closure vars; if `rawProgress < lastFluidProgress` clear BOTH state RTs (bind + clearColor 0 + clear); `dt = Math.min((now - lastFrameMs)/1000, 1/30)`; while `rawProgress < spread + flight`: simStep into B reading A, swap refs; always composite into `revealedField` reading the field RT + current state A.
- Dispose the pass with the branch.
- Topology: `revealPassKind` "fluid" already routes (Task 1); ensure the rebuild test covers fluid↔storm.

- [ ] `pir typecheck` + `pir test` green → commit `feat(engine): real fluid-sim reveal (feedback advection pass)`.

---

### Task 5: Verification (controller, ultracode)

- [ ] Parallel adversarial review workflow (transcription, GLSL validity/reserved words, per-mode invariants, config consistency, fluid lifecycle/reset).
- [ ] Live-load; cycle all energy types with error hook; replay fluid twice (reset check); captures.
