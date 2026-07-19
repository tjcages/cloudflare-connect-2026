# Particle Merge Reveal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the four rejected merge styles with one `"particles"` style — a nebula-condense particle swarm that coalesces into the texture with natural (non-spring) motion.

**Architecture:** `reveal.assembly.style` shrinks to `"scatter" | "particles"`. A new instanced particle pass derives every particle procedurally from `gl_InstanceID` in the vertex shader (target texel, start position, timing jitter, curved path) and samples the field at the target for its brightness; MAX blending assembles the swarm; a constant-alpha fullscreen blend crossfades to the true field at the end. The energeticMerge pass/shader and their engine branch are deleted.

**Tech Stack:** TypeScript, WebGL2 (GLSL ES 3.00), vitest, leva. Scripts via `pir` only.

**Spec:** `docs/superpowers/specs/2026-07-19-particle-merge-reveal-design.md`

## Global Constraints

- `"scatter"` behavior byte-for-byte preserved; wave untouched. Invalid/legacy styles (incl. `"streaks"`, `"implosion"`, `"chargeup"`, `"shards"`) normalize to `"scatter"`.
- Timing model unchanged: duration = `staggerMs + speedMaxMs`; derived math identical to scatter (`dur`, `spread`, `avgTotal`, `moveEnd = min(1, spread + avgTotal)`).
- New fields: `particleCount` (default 9000, clamp 500–20000), `particleSizePx` (default 5, clamp 1–20), `swirl` (default 0.5, clamp 0–1). `massCount`/`overshoot`/`impact` removed everywhere.
- Motion contract: cubic-out ease only (no overshoot), sin(ease·π) perpendicular arc, per-particle stagger jitter.
- No code comments unless they state a non-obvious constraint.
- Tests from repo root: `pir test`; typecheck: `pir typecheck`. Commit per task (lint-staged precommit runs). Never set git identity; never push.

---

### Task 1: Config swap (types + normalize + legacy + tests)

**Files:**

- Modify: `packages/stripes-engine/src/config/types.ts` (`AssemblyStyle`, `RevealConfig["assembly"]`)
- Modify: `packages/stripes-engine/src/config/normalize.ts` (`ASSEMBLY_STYLES`, `DEFAULT_REVEAL`, `normalizeReveal`)
- Modify: `packages/stripes-engine/src/legacy/migrateLegacyConfig.ts` (+ its test) — drop removed fields, keep `style: "scatter"`
- Modify: `apps/lab/src/defaultLabConfig.ts` and the hardcoded assembly literal near the top of `apps/lab/src/controls/levaSchema.ts` (~lines 32–41) — swap removed fields for the three new ones (`particleCount: 9000, particleSizePx: 5, swirl: 0.5`); leave the leva Reveal-folder controls/mapping for Task 4, but if `pir typecheck` fails on the mapping object (~line 2085) because removed fields are referenced, replace those three mapping entries with the new fields reading `d.reveal.assembly.*` temporarily and note it in the commit (Task 4 rewires them to leva values).
- Test: `packages/stripes-engine/src/config/normalize.test.ts`

**Interfaces:**

- Produces: `AssemblyStyle = "scatter" | "particles"`; assembly fields `particleCount: number; particleSizePx: number; swirl: number` (required in normalized config); `massCount`/`overshoot`/`impact` gone from all types.

- [ ] **Step 1: Rewrite the "assembly merge styles" describe block in `normalize.test.ts`** (replace the existing one from the previous feature):

```ts
describe("assembly particle style", () => {
  it("defaults style to scatter and accepts particles", () => {
    expect(normalizeReveal({}).assembly.style).toBe("scatter");
    expect(normalizeReveal({ assembly: { style: "particles" } }).assembly.style).toBe("particles");
  });

  it("falls back to scatter on invalid or legacy styles", () => {
    expect(normalizeReveal({ assembly: { style: "bogus" as never } }).assembly.style).toBe("scatter");
    expect(normalizeReveal({ assembly: { style: "streaks" as never } }).assembly.style).toBe("scatter");
    expect(normalizeReveal({ assembly: { style: "shards" as never } }).assembly.style).toBe("scatter");
  });

  it("defaults and clamps particleCount, particleSizePx, swirl", () => {
    const d = normalizeReveal({}).assembly;
    expect(d.particleCount).toBe(9000);
    expect(d.particleSizePx).toBe(5);
    expect(d.swirl).toBe(0.5);
    const c = normalizeReveal({ assembly: { particleCount: 99999, particleSizePx: 0, swirl: 2 } }).assembly;
    expect(c.particleCount).toBe(20000);
    expect(c.particleSizePx).toBe(1);
    expect(c.swirl).toBe(1);
    expect(normalizeReveal({ assembly: { particleCount: 10 } }).assembly.particleCount).toBe(500);
  });
});
```

- [ ] **Step 2: Run `pir test -- normalize`** — expect FAIL (fields missing / old fields present).

- [ ] **Step 3: Implement.** `types.ts`:

```ts
export type AssemblyStyle = "scatter" | "particles";
```

Assembly block: remove `massCount`, `overshoot`, `impact`; add:

```ts
particleCount: number;
particleSizePx: number;
swirl: number;
```

`normalize.ts`: `ASSEMBLY_STYLES: readonly AssemblyStyle[] = ["scatter", "particles"]`; `DEFAULT_REVEAL.assembly` swaps the three removed defaults for `particleCount: 9000, particleSizePx: 5, swirl: 0.5`; `normalizeReveal` assembly return swaps the removed entries for:

```ts
particleCount: clamp(Math.round(num(a.particleCount, DEFAULT_REVEAL.assembly.particleCount)), 500, 20000),
particleSizePx: clamp(num(a.particleSizePx, DEFAULT_REVEAL.assembly.particleSizePx), 1, 20),
swirl: clamp(num(a.swirl, DEFAULT_REVEAL.assembly.swirl), 0, 1),
```

(`style` line unchanged — the narrowed `ASSEMBLY_STYLES` makes legacy strings fall back automatically.) Update `migrateLegacyConfig.ts` (+ test) and the two lab literals accordingly.

- [ ] **Step 4: `pir test` + `pir typecheck`** — full suite green. Engine still references removed fields (merge branch) — if engine compile breaks, that's expected ONLY if you're running ahead: this task must leave the repo green, so ALSO make the minimal engine edit now if required: in `engine.ts`'s merge-branch uniforms replace `massCount: assembly.massCount, overshoot: assembly.overshoot, impact: assembly.impact` with `massCount: 8, overshoot: 0, impact: 0` as a temporary shim (Task 3 deletes the whole branch) and note it in the commit message.

- [ ] **Step 5: Commit** — `git add -A && git commit -m "feat(engine): reveal style config becomes scatter|particles (drop merge styles)"`

---

### Task 2: Particle shaders + pass (delete energeticMerge files)

**Files:**

- Create: `packages/stripes-engine/src/shaders/particleMerge.vert.ts`
- Create: `packages/stripes-engine/src/shaders/particleMerge.frag.ts`
- Create: `packages/stripes-engine/src/shaders/particleSettle.frag.ts`
- Create: `packages/stripes-engine/src/passes/particleMergePass.ts`
- Delete: `packages/stripes-engine/src/shaders/energeticMerge.frag.ts`, `packages/stripes-engine/src/passes/energeticMergePass.ts` — ONLY if engine.ts no longer imports them; if Task 3 hasn't run yet and engine.ts still imports energeticMergePass, leave the two old files in place and note it (Task 3 deletes them with the branch).

**Interfaces:**

- Consumes: `FULLSCREEN_VERT`, `compileProgram`, `bindRenderTarget`/`RenderTarget`.
- Produces: `createParticleMergePass(gl: WebGL2RenderingContext, quad: { draw(): void })` → `{ render(target, fieldTex, p: ParticleMergeUniforms), dispose() }`; `ParticleMergeUniforms = { count: number; progress: number; spread: number; flight: number; settle: number; sizeUv: [number, number]; swirl: number }`.

- [ ] **Step 1: `particleMerge.vert.ts`:**

```ts
export const PARTICLE_MERGE_VERT = `#version 300 es
precision highp float;
uniform sampler2D uField;
uniform float uProgress;
uniform float uSpread;
uniform float uFlight;
uniform vec2 uSizeUv;
uniform float uSwirl;
out vec2 vQuad;
flat out highp float vVal;
flat out highp float vAlpha;

highp float hash11(highp float n) {
  return fract(sin(n * 127.1 + 311.7) * 43758.5453123);
}

void main() {
  highp float i = float(gl_InstanceID);
  vec2 target = vec2(hash11(i * 2.31 + 0.7), hash11(i * 7.13 + 2.9));
  highp float v = texture(uField, target).r;
  highp float o = hash11(i * 3.7 + 1.3);
  highp float p = max(uProgress, 0.0);
  highp float f = clamp((p - uSpread * o) / max(uFlight, 1e-4), 0.0, 1.0);
  if (v < 0.02 || f <= 0.0) {
    vQuad = vec2(0.0);
    vVal = 0.0;
    vAlpha = 0.0;
    gl_Position = vec4(0.0, 0.0, 2.0, 1.0);
    return;
  }
  vec2 start = vec2(hash11(i * 5.77 + 4.1), hash11(i * 9.29 + 6.3)) * 1.3 - 0.15;
  highp float ease = 1.0 - pow(1.0 - f, 3.0);
  vec2 delta = target - start;
  highp float dist = length(delta);
  vec2 perp = dist > 1e-5 ? vec2(-delta.y, delta.x) / dist : vec2(0.0, 1.0);
  highp float amp = uSwirl * dist * 0.35 * (hash11(i * 11.71 + 8.9) - 0.5) * 2.0;
  vec2 pos = mix(start, target, ease) + perp * sin(ease * 3.14159265) * amp;
  highp float sizeScale = mix(1.6, 1.0, ease) * (0.6 + 0.8 * hash11(i * 13.3 + 0.2));
  vec2 halfExt = 0.5 * uSizeUv * sizeScale;
  int vid = gl_VertexID;
  highp float qx = (vid == 1 || vid == 2 || vid == 4) ? 1.0 : 0.0;
  highp float qy = (vid == 2 || vid == 4 || vid == 5) ? 1.0 : 0.0;
  vec2 corner = pos + (vec2(qx, qy) - 0.5) * 2.0 * halfExt;
  vQuad = vec2(qx, qy);
  vVal = v;
  vAlpha = smoothstep(0.0, 0.2, f);
  gl_Position = vec4(corner * 2.0 - 1.0, 0.0, 1.0);
}
`;
```

- [ ] **Step 2: `particleMerge.frag.ts`:**

```ts
export const PARTICLE_MERGE_FRAG = `#version 300 es
precision highp float;
in vec2 vQuad;
flat in highp float vVal;
flat in highp float vAlpha;
out vec4 finalColor;
void main() {
  highp float d = length(vQuad - 0.5) * 2.0;
  highp float a = smoothstep(1.0, 0.15, d);
  finalColor = vec4(vec3(vVal * a * vAlpha), 1.0);
}
`;
```

- [ ] **Step 3: `particleSettle.frag.ts`:**

```ts
export const PARTICLE_SETTLE_FRAG = `#version 300 es
precision highp float;
in vec2 vUv;
uniform sampler2D uField;
out vec4 finalColor;
void main() {
  finalColor = vec4(vec3(texture(uField, vUv).r), 1.0);
}
`;
```

- [ ] **Step 4: `particleMergePass.ts`:**

```ts
import { compileProgram } from "../gl/program";
import { bindRenderTarget, type RenderTarget } from "../gl/renderTarget";
import { FULLSCREEN_VERT } from "../shaders/fullscreen.vert";
import { PARTICLE_MERGE_VERT } from "../shaders/particleMerge.vert";
import { PARTICLE_MERGE_FRAG } from "../shaders/particleMerge.frag";
import { PARTICLE_SETTLE_FRAG } from "../shaders/particleSettle.frag";

export type ParticleMergeUniforms = {
  count: number;
  progress: number;
  spread: number;
  flight: number;
  settle: number;
  sizeUv: [number, number];
  swirl: number;
};

export function createParticleMergePass(gl: WebGL2RenderingContext, quad: { draw(): void }) {
  const particleProgram = compileProgram(gl, PARTICLE_MERGE_VERT, PARTICLE_MERGE_FRAG);
  const settleProgram = compileProgram(gl, FULLSCREEN_VERT, PARTICLE_SETTLE_FRAG);
  const vao = gl.createVertexArray();
  if (!vao) throw new Error("Failed to create VAO");
  const u = (n: string) => gl.getUniformLocation(particleProgram, n);
  const L = {
    field: u("uField"),
    progress: u("uProgress"),
    spread: u("uSpread"),
    flight: u("uFlight"),
    sizeUv: u("uSizeUv"),
    swirl: u("uSwirl"),
  };
  const settleField = gl.getUniformLocation(settleProgram, "uField");
  return {
    render(target: RenderTarget, fieldTex: WebGLTexture, p: ParticleMergeUniforms) {
      bindRenderTarget(gl, target);
      gl.clearColor(0, 0, 0, 1);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, fieldTex);
      if (p.settle < 1) {
        gl.useProgram(particleProgram);
        gl.uniform1i(L.field, 0);
        gl.uniform1f(L.progress, p.progress);
        gl.uniform1f(L.spread, p.spread);
        gl.uniform1f(L.flight, p.flight);
        gl.uniform2f(L.sizeUv, p.sizeUv[0], p.sizeUv[1]);
        gl.uniform1f(L.swirl, p.swirl);
        gl.enable(gl.BLEND);
        gl.blendEquation(gl.MAX);
        gl.bindVertexArray(vao);
        gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, Math.max(1, Math.floor(p.count)));
        gl.bindVertexArray(null);
        gl.blendEquation(gl.FUNC_ADD);
        gl.disable(gl.BLEND);
      }
      if (p.settle > 0) {
        gl.useProgram(settleProgram);
        gl.uniform1i(settleField, 0);
        if (p.settle < 1) {
          gl.enable(gl.BLEND);
          gl.blendColor(0, 0, 0, p.settle);
          gl.blendFunc(gl.CONSTANT_ALPHA, gl.ONE_MINUS_CONSTANT_ALPHA);
          quad.draw();
          gl.blendFunc(gl.ONE, gl.ZERO);
          gl.disable(gl.BLEND);
        } else {
          quad.draw();
        }
      }
    },
    dispose() {
      gl.deleteProgram(particleProgram);
      gl.deleteProgram(settleProgram);
      gl.deleteVertexArray(vao);
    },
  };
}
```

- [ ] **Step 5: Verify** — `pir typecheck` and `pir test` pass. Delete the two energeticMerge files only if nothing imports them (see Files note).

- [ ] **Step 6: Commit** — `git add -A && git commit -m "feat(engine): particle merge reveal pass (nebula condense)"`

---

### Task 3: Engine wiring swap + topology test

**Files:**

- Modify: `packages/stripes-engine/src/engine.ts`
- Delete (if still present): `packages/stripes-engine/src/passes/energeticMergePass.ts`, `packages/stripes-engine/src/shaders/energeticMerge.frag.ts`
- Test: `packages/stripes-engine/src/engine.topology.test.ts`

**Interfaces:**

- Consumes: `createParticleMergePass`, `ParticleMergeUniforms` from Task 2; config fields from Task 1.
- Produces: `particleMergeField` pass into `revealedField` when `style === "particles"`; `assemblyPassKind` returns `"none" | "scatter" | "particles"`.

- [ ] **Step 1: Topology test.** In `engine.topology.test.ts`, update the helper's kind: `cfg.reveal.assembly.style === "scatter" ? "scatter" : "particles"`, and replace the two style tests from the previous feature:

```ts
it("switching assembly style scatter <-> particles triggers rebuild", () => {
  const scatter = normalizeEngineConfig({
    reveal: { enabled: true, type: "assembly", assembly: { style: "scatter" } },
  });
  const particles = normalizeEngineConfig({
    reveal: { enabled: true, type: "assembly", assembly: { style: "particles" } },
  });
  expect(needsRebuild(scatter, particles)).toBe(true);
  expect(needsRebuild(particles, scatter)).toBe(true);
});

it("particles param change does not trigger rebuild", () => {
  const a = normalizeEngineConfig({
    reveal: { enabled: true, type: "assembly", assembly: { style: "particles", particleCount: 5000 } },
  });
  const b = normalizeEngineConfig({
    reveal: { enabled: true, type: "assembly", assembly: { style: "particles", particleCount: 12000 } },
  });
  expect(needsRebuild(a, b)).toBe(false);
});
```

- [ ] **Step 2: Engine.** In `engine.ts`:

(a) `assemblyPassKind` helper: replace the `"merge"` literal with `"particles"` (condition logic unchanged: non-scatter assembly style → `"particles"`).

(b) Replace the entire merge build branch (`if (assemblyTopology && config.reveal.assembly.style !== "scatter") { ... }` — the `energeticMergeField` pass with its blur-pyramid block) with:

```ts
if (assemblyTopology && config.reveal.assembly.style !== "scatter") {
  const particlePass = createParticleMergePass(gl, quad);
  revealFieldPasses.push({
    name: "particleMergeField",
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
      const moveEnd = Math.min(1, spread + avgTotal);
      const settleEnd = Math.min(1, moveEnd + 0.12);
      const settleRange = Math.max(1e-4, settleEnd - moveEnd);
      const settleT = Math.min(1, Math.max(0, (rawProgress - moveEnd) / settleRange));
      const settle = settleT * settleT * (3 - 2 * settleT);
      particlePass.render(revealedRT, fieldRT.texture, {
        count: assembly.particleCount,
        progress: rawProgress,
        spread,
        flight: avgTotal,
        settle,
        sizeUv: [assembly.particleSizePx / Math.max(1, cssW), assembly.particleSizePx / Math.max(1, cssH)],
        swirl: assembly.swirl,
      });
    },
    dispose: () => particlePass.dispose(),
  });
} else if (assemblyTopology) {
```

Remove the `createEnergeticMergePass` import; add `createParticleMergePass`. If Task 1 left a temporary uniform shim, it disappears with this replacement. Delete the two old energeticMerge files now and any lingering imports.

(c) RT pre-allocation block (~line 1011): the four `assemblyBlur*` pool.get warmups can stay (scatter still uses them); no change required.

- [ ] **Step 3: `pir test` + `pir typecheck`** — green.

- [ ] **Step 4: Commit** — `git add -A && git commit -m "feat(engine): wire particle merge pass, drop energetic merge branch"`

---

### Task 4: Lab controls swap

**Files:**

- Modify: `apps/lab/src/controls/levaSchema.ts` (Reveal folder + values→config mapping)

**Interfaces:**

- Consumes: `AssemblyStyle` (`"scatter" | "particles"`), config fields from Task 1.
- Produces: leva keys `revealAssemblyStyle` (Scatter | Particles), `revealParticleCount`, `revealParticleSizePx`, `revealSwirl` mapped into `reveal.assembly.{style, particleCount, particleSizePx, swirl}`.

- [ ] **Step 1:** In the Reveal folder: shrink `revealAssemblyStyle.options` to `{ Scatter: "scatter", Particles: "particles" } as const`. Replace the `revealMassCount`/`revealOvershoot`/`revealImpact` control definitions with:

```ts
revealParticleCount: {
  value: d.reveal.assembly.particleCount,
  min: 500,
  max: 20000,
  step: 100,
  label: "Particle count",
  render: (get) =>
    get("Reveal.revealType") === "assembly" && get("Reveal.revealAssemblyStyle") === "particles",
},
revealParticleSizePx: {
  value: d.reveal.assembly.particleSizePx,
  min: 1,
  max: 20,
  step: 0.5,
  label: "Particle size (px)",
  render: (get) =>
    get("Reveal.revealType") === "assembly" && get("Reveal.revealAssemblyStyle") === "particles",
},
revealSwirl: {
  value: d.reveal.assembly.swirl,
  min: 0,
  max: 1,
  step: 0.05,
  label: "Swirl",
  render: (get) =>
    get("Reveal.revealType") === "assembly" && get("Reveal.revealAssemblyStyle") === "particles",
},
```

Scatter-only narrowing on `revealSliceSizePx`/`revealScatterPx`/`revealAngleJitterDeg` stays as-is; speed/stagger stay assembly-wide.

- [ ] **Step 2:** In the values→config mapping, replace the `massCount`/`overshoot`/`impact` entries (or the Task-1 temporary defaults) with:

```ts
style: values.revealAssemblyStyle,
particleCount: values.revealParticleCount,
particleSizePx: values.revealParticleSizePx,
swirl: values.revealSwirl,
```

- [ ] **Step 3:** `pir typecheck` + `pir test` green. Grep `massCount\|overshoot\|impact` under `apps/lab/src` and `packages/stripes-engine/src` to confirm zero survivors (word-boundary matches for these exact reveal fields; unrelated hits like clickWave `impact`-free naming stay untouched — report what the grep shows).

- [ ] **Step 4: Commit** — `git add -A && git commit -m "feat(lab): particle merge controls (count/size/swirl)"`

---

### Task 5: Visual verification (main session)

- [ ] Confirm dev server (`pir dev --host` background task) still serving; open via remote pool, set Reveal → Assembly → Particles, Replay, capture early/mid/settle frames.
- [ ] Confirm: swarm visible early, curved drift, image emerges, seamless settle, no popping.
- [ ] Show captures to the user; the feel verdict is theirs live.
