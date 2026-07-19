# Reveal Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Per-style reveal configs (fast glitch default), curl-noise turbulence with early vorticity, hadouken naturalness polish (spiral in-fall, wobble, orbs, two-lobe pulsing core, richer edge, suction warp).

**Architecture:** `reveal.assembly` restructures into per-style blocks (`scatter`/`turbulence`/`glitch`/`hadouken`), `resolveRevealDurationMs` reads the active block, engine branches read their own block, leva grows per-style controls. Shader work: energyWarp mode 0 swaps fbm-angle flow for two-layer central-difference curl noise; hadouken vert/frag get the polish set.

**Tech Stack:** TypeScript, WebGL2 (GLSL ES 3.00), vitest, leva. Scripts via `pir` only.

**Spec:** `docs/superpowers/specs/2026-07-20-reveal-polish-design.md` — the defaults table there is normative.

## Global Constraints

- Scatter render path byte-for-byte preserved (only its config ACCESS paths change to `assembly.scatter.*`); wave untouched.
- From-nothing invariant (black at p=0) and exact-field-at-rest invariant hold for turbulence/glitch/hadouken.
- Cubic-out easing only. Never `pow` with a possibly-negative base (write `x*x`). PCG hash for per-instance data; sin-hash fine for continuous noise fields.
- Defaults per the spec table: glitch 80/350/220 (fast), turbulence 400/1800/800, hadouken 500/1800/1400 + particleCount 4000; knob clamps unchanged (intensity 0–2, detail 0–1, glow 0–1, particleCount 500–20000, speeds 100 floor DOES NOT apply to glitch's 80 — lower the speed clamp floor to 50 for the three warp-style blocks; scatter keeps 100).
- Legacy flat assembly fields seed the `scatter` block only; nested blocks read as given; invalid styles → scatter.
- No code comments unless non-obvious constraint. `pir test` / `pir typecheck` at repo root. Commit per task. Never set git identity; never push.

---

### Task 1: Per-style config restructure (types/normalize/legacy/revealMath/engine/lab/tests)

**Files:**

- Modify: `packages/stripes-engine/src/config/types.ts`, `packages/stripes-engine/src/config/normalize.ts`, `packages/stripes-engine/src/reveal/revealMath.ts` (`resolveRevealDurationMs`), `packages/stripes-engine/src/legacy/migrateLegacyConfig.ts` (+ its test), `packages/stripes-engine/src/engine.ts` (scatter/warp/hadouken branches read their blocks; RT preallocation + any other `config.reveal.assembly.<flat>` readers), `apps/lab/src/defaultLabConfig.ts`, `apps/lab/src/controls/levaSchema.ts`, `apps/lab/src/connectShader/underlayIntro.ts` (check: if it re-implements duration math make it style-aware; if it imports `resolveRevealDurationMs`, no change — record which in the report)
- Tests: `packages/stripes-engine/src/config/normalize.test.ts`, `packages/stripes-engine/src/reveal/revealMath.test.ts`, `packages/stripes-engine/src/engine.topology.test.ts` (update config literals only — kind semantics unchanged)

**Interfaces:**

- Produces (types.ts):

```ts
export interface WarpStyleConfig {
  speedMinMs: number;
  speedMaxMs: number;
  staggerMs: number;
  intensity: number;
  detail: number;
  glow: number;
}

assembly: {
  style: AssemblyStyle;
  scatter: {
    sliceSizePx: number;
    speedMinMs: number;
    speedMaxMs: number;
    staggerMs: number;
    scatterPx: number;
    angleJitterDeg: number;
    blurPx?: number;
    blurStart?: number;
  };
  turbulence: WarpStyleConfig;
  glitch: WarpStyleConfig;
  hadouken: WarpStyleConfig & { particleCount: number };
};
```

- [ ] **Step 1: Tests first.** Rewrite the assembly describe block in `normalize.test.ts`:

```ts
describe("assembly per-style configs", () => {
  it("provides per-style defaults incl. fast glitch", () => {
    const a = normalizeReveal({}).assembly;
    expect(a.style).toBe("scatter");
    expect(a.glitch.speedMinMs).toBe(80);
    expect(a.glitch.speedMaxMs).toBe(350);
    expect(a.glitch.staggerMs).toBe(220);
    expect(a.turbulence.speedMaxMs).toBe(1800);
    expect(a.hadouken.staggerMs).toBe(1400);
    expect(a.hadouken.particleCount).toBe(4000);
    expect(a.scatter.sliceSizePx).toBe(29);
  });

  it("reads nested per-style overrides independently", () => {
    const a = normalizeReveal({
      assembly: { style: "glitch", glitch: { speedMaxMs: 900 }, turbulence: { glow: 0.2 } },
    }).assembly;
    expect(a.glitch.speedMaxMs).toBe(900);
    expect(a.turbulence.glow).toBe(0.2);
    expect(a.turbulence.speedMaxMs).toBe(1800);
  });

  it("seeds scatter block from legacy flat fields", () => {
    const a = normalizeReveal({
      assembly: { style: "scatter", speedMinMs: 111, speedMaxMs: 2222, staggerMs: 333, sliceSizePx: 50 } as never,
    }).assembly;
    expect(a.scatter.speedMinMs).toBe(111);
    expect(a.scatter.speedMaxMs).toBe(2222);
    expect(a.scatter.staggerMs).toBe(333);
    expect(a.scatter.sliceSizePx).toBe(50);
    expect(a.glitch.speedMaxMs).toBe(350);
  });

  it("still falls back to scatter on invalid styles", () => {
    expect(normalizeReveal({ assembly: { style: "bogus" as never } }).assembly.style).toBe("scatter");
  });
});
```

Add to `revealMath.test.ts`:

```ts
it("assembly duration follows the active style block", () => {
  const base = normalizeReveal({ enabled: true, type: "assembly", assembly: { style: "glitch" } });
  expect(resolveRevealDurationMs(base)).toBe(220 + 350);
  const turb = normalizeReveal({ enabled: true, type: "assembly", assembly: { style: "turbulence" } });
  expect(resolveRevealDurationMs(turb)).toBe(800 + 1800);
});
```

(import `normalizeReveal` from `../config/normalize` in that test file if not present).

- [ ] **Step 2:** `pir test -- normalize revealMath` — FAIL expected.

- [ ] **Step 3: Implement.**

`normalize.ts` defaults (spec table is normative):

```ts
export const DEFAULT_REVEAL: RevealConfig = {
  enabled: false,
  type: "assembly",
  wave: { position: "center", durationMs: 1200, softness: 0.22, waviness: 0.11 },
  assembly: {
    style: "scatter",
    scatter: {
      sliceSizePx: 29,
      speedMinMs: 300,
      speedMaxMs: 1600,
      staggerMs: 6550,
      scatterPx: 90,
      angleJitterDeg: 35,
      blurPx: 17.5,
      blurStart: 0.45,
    },
    turbulence: { speedMinMs: 400, speedMaxMs: 1800, staggerMs: 800, intensity: 1, detail: 0.5, glow: 0.6 },
    glitch: { speedMinMs: 80, speedMaxMs: 350, staggerMs: 220, intensity: 1, detail: 0.5, glow: 0.7 },
    hadouken: {
      speedMinMs: 500,
      speedMaxMs: 1800,
      staggerMs: 1400,
      intensity: 1,
      detail: 0.5,
      glow: 0.7,
      particleCount: 4000,
    },
  },
};
```

`normalizeReveal`: build each block with a helper; warp-style blocks clamp speeds to [50, 30000] (speedMax ≥ speedMin), stagger [0, 30000], intensity [0,2], detail/glow [0,1], particleCount rounded [500, 20000]. Scatter block keeps its existing clamps (speeds [100, 30000], slice [8,200], scatter [0,300], jitter [0,90], blur [0,50], blurStart [0,0.95]) and reads nested `a.scatter.*` first, falling back to legacy FLAT `a.speedMinMs`/`a.speedMaxMs`/`a.staggerMs`/`a.sliceSizePx`/`a.scatterPx`/`a.angleJitterDeg`/`a.blurPx`/`a.blurStart` (cast the partial input loosely for the flat reads), then defaults.

`revealMath.ts`:

```ts
export function resolveRevealDurationMs(r: RevealConfig): number {
  if (r.type !== "assembly") return r.wave.durationMs;
  const s = r.assembly.style;
  const block = s === "scatter" ? r.assembly.scatter : r.assembly[s];
  return block.staggerMs + block.speedMaxMs;
}
```

`engine.ts`: scatter branch reads `config.reveal.assembly.scatter.*` (render logic byte-identical otherwise); warp branch reads `const style = config.reveal.assembly.style; const block = style === "glitch" ? assembly.glitch : assembly.turbulence;` for timing + intensity/detail/glow; hadouken branch reads `assembly.hadouken.*`. Any other flat readers (RT preallocation uses only `reveal.type` — verify) updated.

`migrateLegacyConfig.ts`: produce the new nested shape (legacy migration always produced scatter-style values — put them in the scatter block, other blocks default).

`defaultLabConfig.ts`: nested shape; scatter block keeps the lab's current values (sliceSizePx 40, speedMin 300, speedMax 1600, stagger 900, scatterPx 50, angleJitterDeg 22, blurPx 17.5, blurStart 0.45); other blocks = engine defaults.

`levaSchema.ts`: existing scatter keys (`revealSliceSizePx`, `revealSpeedMinMs`, `revealSpeedMaxMs`, `revealStaggerMs`, `revealScatterPx`, `revealAngleJitterDeg`) become scatter-only (render `=== "scatter"`) and map into `assembly.scatter`. Remove the shared `revealIntensity`/`revealDetail`/`revealGlow`/`revealParticleCount` keys. Add per-style keys — pattern (turbulence shown; repeat for glitch and hadouken with their defaults):

```ts
revealTurbSpeedMinMs: { value: d.reveal.assembly.turbulence.speedMinMs, min: 50, max: 30000, step: 10, label: "Speed min (ms)", render: (get) => get("Reveal.revealType") === "assembly" && get("Reveal.revealAssemblyStyle") === "turbulence" },
revealTurbSpeedMaxMs: { value: d.reveal.assembly.turbulence.speedMaxMs, min: 50, max: 30000, step: 10, label: "Speed max (ms)", render: ... same predicate },
revealTurbStaggerMs: { value: d.reveal.assembly.turbulence.staggerMs, min: 0, max: 30000, step: 10, label: "Stagger (ms)", render: ... },
revealTurbIntensity: { value: d.reveal.assembly.turbulence.intensity, min: 0, max: 2, step: 0.05, label: "Intensity", render: ... },
revealTurbDetail: { value: d.reveal.assembly.turbulence.detail, min: 0, max: 1, step: 0.05, label: "Detail", render: ... },
revealTurbGlow: { value: d.reveal.assembly.turbulence.glow, min: 0, max: 1, step: 0.05, label: "Glow", render: ... },
```

Glitch keys `revealGlitch*` (same six), hadouken keys `revealHad*` (same six) plus:

```ts
revealHadParticleCount: { value: d.reveal.assembly.hadouken.particleCount, min: 500, max: 20000, step: 100, label: "Particle count", render: (get) => get("Reveal.revealType") === "assembly" && get("Reveal.revealAssemblyStyle") === "hadouken" },
```

Mapping builds the nested object from these keys (scatter block from the old keys, each style block from its keys).

`underlayIntro.ts`: check and handle per the Files note.

- [ ] **Step 4:** `pir test` (full workspace) + `pir typecheck` green.

- [ ] **Step 5: Commit** — `git add -A && git commit -m "feat(engine): per-style reveal configs (fast glitch default)"`

---

### Task 2: Curl-noise turbulence

**Files:**

- Modify: `packages/stripes-engine/src/shaders/energyWarp.frag.ts` — replace ONLY the `uMode == 0` displacement block inside the second if-chain (the `D`/`emerge` computation); everything else byte-identical.

- [ ] **Step 1:** Replace the current mode-0 branch:

```glsl
  if (uMode == 0) {
    vec2 flow = vec2(p * 2.2, -p * 1.7);
    highp float ang = fbm2(vUv * freq + flow + 2.1) * 12.566370;
    highp float mag = 0.5 + 0.5 * fbm2(vUv * freq * 1.7 - flow.yx + 5.9);
    D = vec2(cos(ang), sin(ang)) * 0.28 * mag;
    emerge = smoothstep(0.0, 0.4, f);
  } else {
```

with:

```glsl
  if (uMode == 0) {
    vec2 flow = vec2(p * 0.9, -p * 0.6);
    vec2 q1 = vUv * freq + flow + 2.1;
    vec2 q2 = vUv * freq * 2.6 + flow * 1.8 + 17.3;
    highp float e = 0.09;
    vec2 c1 = vec2(
      fbm2(q1 + vec2(0.0, e)) - fbm2(q1 - vec2(0.0, e)),
      fbm2(q1 - vec2(e, 0.0)) - fbm2(q1 + vec2(e, 0.0))
    ) / (2.0 * e);
    vec2 c2 = vec2(
      fbm2(q2 + vec2(0.0, e)) - fbm2(q2 - vec2(0.0, e)),
      fbm2(q2 - vec2(e, 0.0)) - fbm2(q2 + vec2(e, 0.0))
    ) / (2.0 * e);
    vec2 curlV = c1 * 0.75 + c2 * 0.35;
    highp float vort = 0.55 + 0.9 * decay;
    D = curlV * 0.09 * vort;
    emerge = smoothstep(0.0, 0.4, f);
  } else {
```

(Curl of ψ = (∂ψ/∂y, −∂ψ/∂x) by central differences — divergence-free vortices; two layers = large + small eddies; `vort` peaks at start per the spec. `D` is still multiplied by `uIntensity · decay` downstream, so rest = exact field.)

- [ ] **Step 2:** `pir typecheck` + `pir test` green.

- [ ] **Step 3: Commit** — `git add -A && git commit -m "feat(engine): curl-noise turbulence with early vorticity"`

---

### Task 3: Hadouken naturalness polish

**Files:**

- Modify: `packages/stripes-engine/src/shaders/hadoukenParticles.vert.ts` — replace `main()` entirely (keep the pcg/hashLane helpers and uniform/out declarations as-is):

```glsl
uniform float uAspect;
```

must be ADDED to the particle vert's uniform list, and the pass (`packages/stripes-engine/src/passes/hadoukenPass.ts`) must set it on the particle program (`aspect` value already exists in `HadoukenUniforms`; add a `P.aspect` location + `gl.uniform1f` in the particle draw).

- Modify: `packages/stripes-engine/src/shaders/hadoukenCore.frag.ts` — targeted edits below.

- [ ] **Step 1: New `main()` for `hadoukenParticles.vert.ts`:**

```glsl
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
  vec2 startUv = vec2(hashLane(id, 2u), hashLane(id, 3u)) * 1.3 - 0.15;
  vec2 targetUv = vec2(0.5) + (vec2(hashLane(id, 4u), hashLane(id, 5u)) - 0.5) * 0.05;
  vec2 asp = vec2(uAspect, 1.0);
  vec2 rel = (startUv - targetUv) * asp;
  highp float rad = length(rel);
  highp float baseAng = rad > 1e-5 ? atan(rel.y, rel.x) : 0.0;
  highp float orb = step(hashLane(id, 8u), 0.12);
  highp float spin = (hashLane(id, 6u) - 0.5) * 2.0 * mix(1.2, 2.6, hashLane(id, 9u)) * (1.0 - 0.5 * orb);
  highp float wob = sin(f * (7.0 + 6.0 * hashLane(id, 10u)) + hashLane(id, 11u) * 6.2831853) * 0.015 * (1.0 - (1.0 - pow(1.0 - f, 3.0)));
  highp float ease = 1.0 - pow(1.0 - f, 3.0);
  highp float ang = baseAng + spin * ease;
  highp float rr = max(rad * (1.0 - ease) + wob, 0.0);
  vec2 posA = vec2(cos(ang), sin(ang)) * rr;
  highp float f2 = min(f + 0.03, 1.0);
  highp float ease2 = 1.0 - pow(1.0 - f2, 3.0);
  highp float ang2 = baseAng + spin * ease2;
  highp float rr2 = max(rad * (1.0 - ease2) + wob, 0.0);
  vec2 posB = vec2(cos(ang2), sin(ang2)) * rr2;
  vec2 vel = posB - posA;
  highp float vlen = length(vel);
  vec2 dirN = vlen > 1e-5 ? vel / vlen : vec2(1.0, 0.0);
  highp float stretch = mix(1.0 + min(6.0, vlen * 55.0), 1.0, orb);
  highp float sizeScale = (0.6 + 0.8 * hashLane(id, 7u)) * (1.0 - 0.55 * ease) * (1.0 + 1.6 * orb);
  highp float sizeA = 0.5 * uSizeUv.y * sizeScale;
  int vid = gl_VertexID;
  highp float qx = (vid == 1 || vid == 2 || vid == 4) ? 1.0 : 0.0;
  highp float qy = (vid == 2 || vid == 4 || vid == 5) ? 1.0 : 0.0;
  vec2 corner0 = (vec2(qx, qy) - 0.5) * 2.0 * sizeA * vec2(stretch, 1.0);
  vec2 rot = vec2(corner0.x * dirN.x - corner0.y * dirN.y, corner0.x * dirN.y + corner0.y * dirN.x);
  vec2 uvPos = targetUv + (posA + rot) / asp;
  vQuad = vec2(qx, qy);
  highp float fadeIn = smoothstep(0.0, 0.15, f);
  highp float fadeOut = 1.0 - smoothstep(0.85, 1.0, f);
  vVal = (0.55 + 0.45 * hashLane(id, 12u)) * fadeIn * fadeOut * (1.0 + 0.3 * orb);
  gl_Position = vec4(uvPos * 2.0 - 1.0, 0.0, 1.0);
}
```

(The `wob` line intentionally computes its own `(1 − ease)` inline because `ease` is declared after it — keep the exact ordering above so it compiles.)

- [ ] **Step 2: `hadoukenCore.frag.ts` edits.** Replace the `edgeN` line with the two-octave version:

```glsl
  highp float k = mix(1.0, 4.0, uDetail);
  highp float edgeN = ((fbm2(edir * k + vec2(3.1, p * 1.5)) - 0.5) + 0.5 * (fbm2(edir * k * 2.3 + vec2(p * 2.6, 7.7)) - 0.5)) * 0.22;
```

Replace the `coreSize`/`core` pair with:

```glsl
  highp float pulse = 1.0 + 0.06 * sin(p * 9.0 + uCharge * 5.0);
  highp float coreSize = (0.045 + 0.11 * uCharge) * pulse;
  highp float nuc = exp(-(r * r) / (coreSize * coreSize * 0.16));
  highp float halo = exp(-(r * r) / (coreSize * coreSize));
  highp float core = (nuc * 1.1 + halo * 0.45) * uGlow * (0.4 + 1.2 * uCharge) * (1.0 - done) * step(0.001, uCharge);
```

Replace the field sample line (`highp float v = texture(uField, vUv).r * mask;`) with the suction-warped version (place AFTER `rw`/ring computation so `rw` is in scope; reorder if needed):

```glsl
  vec2 pullUv = r > 1e-4 ? (a / r) / vec2(uAspect, 1.0) : vec2(0.0);
  highp float v = texture(uField, clamp(vUv + pullUv * exp(-rw * rw) * 0.02 * (1.0 - done), 0.0, 1.0)).r * mask;
```

- [ ] **Step 3: Pass edit** — add `aspect` uniform to the particle program in `hadoukenPass.ts` (location `P.aspect = pu("uAspect")`, set `gl.uniform1f(P.aspect, p.aspect)` in the particle draw).

- [ ] **Step 4:** `pir typecheck` + `pir test` green. Invariant recheck: done = 1 → suction offset 0, mask 1, ring/core 0 → exact field; charge 0 → black.

- [ ] **Step 5: Commit** — `git add -A && git commit -m "feat(engine): hadouken naturalness polish (spiral in-fall, orbs, pulsing core, suction edge)"`

---

### Task 4: Visual verification (main session)

- [ ] Replay each of Turbulence (visible rotating vortices early, calming), Glitch (fast — done in ~0.6 s), Hadouken (curved spiral convergence, orbs among sparks, pulsing core, organic dragged edge).
- [ ] Confirm per-style configs: switching styles swaps the visible control set and timing.
- [ ] Show the user.
