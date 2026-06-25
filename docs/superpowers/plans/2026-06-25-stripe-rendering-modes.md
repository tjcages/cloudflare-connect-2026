# Stripe Rendering Modes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a configurable `renderMode` that restyles the final stripes (16 looks + `sharp` default) via a screen-space post-process pass, with one global `renderIntensity` dial, all modes animated.

**Architecture:** A new "stylize" fullscreen post-process pass runs after the existing stripe pass. When `renderMode === "sharp"` the pipeline is unchanged (stripe → canvas). Otherwise the stripe pass renders into a `stripeOut` render target and the stylize pass reads it, applies a per-mode fragment shader, and draws to the canvas. Each mode is a small GLSL `main()` composed from a shared helper library; the stylize pass lazily compiles and caches one program per mode.

**Tech Stack:** TypeScript, raw WebGL2 (GLSL ES 3.00), Vitest, Leva (lab controls). Package manager: `pi`/`pir` (never npm/pnpm directly).

## Global Constraints

- WebGL2 only; all shaders begin `#version 300 es` with `precision highp float;`. Compile must throw on failure (existing `compileProgram` already does).
- No code comments unless explicitly required by a step.
- Run scripts with `pir` (e.g. `pir test`, `pir build`), installs with `pi`. Never `npm`/`pnpm`/`npx`.
- Engine package root: `packages/stripes-engine`. Lab app root: `apps/lab`.
- Sharp must remain byte-for-byte today's output: no stylize pass, no `stripeOut` RT, stripe still draws straight to the canvas.
- `renderIntensity` is clamped `[0,1]`; unknown `renderMode` falls back to `"sharp"`.
- Do NOT touch the untracked WIP files `src/shared/coordinator.ts`, `src/shared/sharedWorker.ts`, `src/shared/protocol.ts`, `src/shared/media.ts` — they are unrelated in-progress work.
- Commit after each task. Tests run from the engine package dir: `cd packages/stripes-engine && pir test -- --run <file>`.

---

## File Structure

**Engine (`packages/stripes-engine/src`):**

- `config/types.ts` — add `RenderMode` type + `renderMode`/`renderIntensity` on `EngineConfig` (modify).
- `config/normalize.ts` — defaults + validation (modify).
- `config/normalize.test.ts` — tests (modify).
- `index.ts` — export `RenderMode` (modify).
- `shaders/stylize/common.ts` — shared GLSL helper preamble (create).
- `shaders/stylize/<mode>.frag.ts` — one per mode (create, 16 files).
- `shaders/stylize/index.ts` — `STYLIZE_FRAGS` registry + `PASSTHROUGH_FRAG` (create).
- `passes/stylizePass.ts` — the post-process pass (create).
- `passes/stripePass.ts` — add optional render target (modify).
- `engine.ts` — wire stylize into `buildPasses`/`applySizes`/`setConfig` + state var (modify).

**Lab (`apps/lab/src`):**

- `controls/levaSchema.ts` — `renderMode` dropdown + `renderIntensity` slider + config mapping (modify).

---

## Task 1: Config — `renderMode` + `renderIntensity`

**Files:**

- Modify: `packages/stripes-engine/src/config/types.ts`
- Modify: `packages/stripes-engine/src/config/normalize.ts`
- Modify: `packages/stripes-engine/src/index.ts`
- Test: `packages/stripes-engine/src/config/normalize.test.ts`

**Interfaces:**

- Produces: `type RenderMode` (string union of 17 modes); `EngineConfig.renderMode: RenderMode`; `EngineConfig.renderIntensity: number`; `DEFAULT_ENGINE_CONFIG.renderMode === "sharp"`, `renderIntensity === 1`. Validation: `normalizeEngineConfig` clamps intensity to `[0,1]` and falls back to `"sharp"` for unknown modes.

- [ ] **Step 1: Write the failing test**

Add to `packages/stripes-engine/src/config/normalize.test.ts` (append a new `describe` block before the final closing of the file):

```ts
describe("renderMode + renderIntensity", () => {
  it("defaults to sharp at full intensity", () => {
    const c = normalizeEngineConfig({});
    expect(c.renderMode).toBe("sharp");
    expect(c.renderIntensity).toBe(1);
  });
  it("keeps a known mode", () => {
    expect(normalizeEngineConfig({ renderMode: "abstract" }).renderMode).toBe("abstract");
    expect(normalizeEngineConfig({ renderMode: "caramel" }).renderMode).toBe("caramel");
  });
  it("falls back to sharp for an unknown mode", () => {
    expect(normalizeEngineConfig({ renderMode: "bogus" as any }).renderMode).toBe("sharp");
  });
  it("clamps renderIntensity to 0..1", () => {
    expect(normalizeEngineConfig({ renderIntensity: -1 }).renderIntensity).toBe(0);
    expect(normalizeEngineConfig({ renderIntensity: 5 }).renderIntensity).toBe(1);
    expect(normalizeEngineConfig({ renderIntensity: 0.4 }).renderIntensity).toBe(0.4);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/stripes-engine && pir test -- --run src/config/normalize.test.ts`
Expected: FAIL (`renderMode` is `undefined`, property does not exist on type).

- [ ] **Step 3: Add the type**

In `packages/stripes-engine/src/config/types.ts`, add above `export interface EngineConfig`:

```ts
export type RenderMode =
  | "sharp"
  | "abstract"
  | "watercolor"
  | "charcoal"
  | "pencil"
  | "brush"
  | "halftone"
  | "risograph"
  | "stainedGlass"
  | "paperCutout"
  | "crt"
  | "glitch"
  | "vhs"
  | "plasma"
  | "amber"
  | "gummy"
  | "caramel";
```

Then inside `EngineConfig` (after `colors: ColorsConfig;`) add:

```ts
renderMode: RenderMode;
renderIntensity: number;
```

- [ ] **Step 4: Add defaults + validation**

In `packages/stripes-engine/src/config/normalize.ts`:

Add `RenderMode` to the type import from `./types` (extend the existing import list).

Add near the other constants (e.g. after `DEFAULT_COLORS`'s normalizer):

```ts
export const RENDER_MODES: RenderMode[] = [
  "sharp",
  "abstract",
  "watercolor",
  "charcoal",
  "pencil",
  "brush",
  "halftone",
  "risograph",
  "stainedGlass",
  "paperCutout",
  "crt",
  "glitch",
  "vhs",
  "plasma",
  "amber",
  "gummy",
  "caramel",
];
function normalizeRenderMode(v: unknown): RenderMode {
  return RENDER_MODES.includes(v as RenderMode) ? (v as RenderMode) : "sharp";
}
```

In `DEFAULT_ENGINE_CONFIG`, add (after `colors: { ...DEFAULT_COLORS },`):

```ts
  renderMode: "sharp",
  renderIntensity: 1,
```

In `normalizeEngineConfig`'s returned object, add (after `colors: normalizeColors(i.colors),`):

```ts
    renderMode: normalizeRenderMode(i.renderMode),
    renderIntensity: clamp(num(i.renderIntensity, 1), 0, 1),
```

- [ ] **Step 5: Export the type**

In `packages/stripes-engine/src/index.ts`, add `RenderMode` to the type export from `./config/types`:

```ts
export type { EngineConfig, Stripe, Fit, RenderMode } from "./config/types";
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `cd packages/stripes-engine && pir test -- --run src/config/normalize.test.ts`
Expected: PASS (all green, including the existing `normalizeEngineConfig({})` equality test, since the new defaults are present in both `DEFAULT_ENGINE_CONFIG` and the normalizer output).

- [ ] **Step 7: Commit**

```bash
git add packages/stripes-engine/src/config/types.ts packages/stripes-engine/src/config/normalize.ts packages/stripes-engine/src/config/normalize.test.ts packages/stripes-engine/src/index.ts
git commit -m "feat(engine): renderMode + renderIntensity config"
```

---

## Task 2: Shared stylize GLSL helpers

**Files:**

- Create: `packages/stripes-engine/src/shaders/stylize/common.ts`

**Interfaces:**

- Produces: `export const STYLIZE_COMMON: string` — a GLSL preamble that declares `#version`, precision, `in vec2 vUv`, uniforms `uTex`/`uTime`/`uIntensity`/`uResolution`/`uDpr`, `out vec4 fragColor`, and helpers `hash21`, `vnoise`, `fbm`, `warp`, `grain`, `luma`, `blurTex`. Every mode shader is `STYLIZE_COMMON + "<mode main()>"`. The matching JS uniform names a pass must set: `uTex`(sampler, unit 0), `uTime`(float), `uIntensity`(float), `uResolution`(vec2), `uDpr`(float).

- [ ] **Step 1: Create the helper preamble**

Create `packages/stripes-engine/src/shaders/stylize/common.ts`:

```ts
export const STYLIZE_COMMON = `#version 300 es
precision highp float;
in vec2 vUv;
uniform sampler2D uTex;
uniform float uTime;
uniform float uIntensity;
uniform vec2 uResolution;
uniform float uDpr;
out vec4 fragColor;

float hash21(vec2 p){ p = fract(p * vec2(123.34, 345.45)); p += dot(p, p + 34.345); return fract(p.x * p.y); }
float vnoise(vec2 p){
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float a = hash21(i), b = hash21(i + vec2(1.0, 0.0));
  float c = hash21(i + vec2(0.0, 1.0)), d = hash21(i + vec2(1.0, 1.0));
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}
float fbm(vec2 p){ float s = 0.0, a = 0.5; for (int i = 0; i < 5; i++){ s += a * vnoise(p); p *= 2.0; a *= 0.5; } return s; }
vec2 warp(vec2 uv, vec2 freq, float scale, float t){
  float nx = fbm(uv * freq + vec2(0.0, t));
  float ny = fbm(uv * freq + vec2(5.2, 1.3) - vec2(t, 0.0));
  return uv + (vec2(nx, ny) - 0.5) * scale;
}
float grain(vec2 uv, float t){ return hash21(uv * uResolution + t); }
float luma(vec3 c){ return dot(c, vec3(0.299, 0.587, 0.114)); }
vec3 blurTex(vec2 uv, float px){
  vec2 o = px / uResolution;
  vec3 s = texture(uTex, uv).rgb * 0.4;
  s += texture(uTex, uv + vec2(o.x, 0.0)).rgb * 0.15;
  s += texture(uTex, uv - vec2(o.x, 0.0)).rgb * 0.15;
  s += texture(uTex, uv + vec2(0.0, o.y)).rgb * 0.15;
  s += texture(uTex, uv - vec2(0.0, o.y)).rgb * 0.15;
  return s;
}
`;
```

- [ ] **Step 2: Typecheck**

Run: `cd packages/stripes-engine && pir build`
Expected: PASS (no type errors; the file only exports a string).

- [ ] **Step 3: Commit**

```bash
git add packages/stripes-engine/src/shaders/stylize/common.ts
git commit -m "feat(engine): stylize shared GLSL helpers"
```

---

## Task 3: Abstract shader + registry

**Files:**

- Create: `packages/stripes-engine/src/shaders/stylize/abstract.frag.ts`
- Create: `packages/stripes-engine/src/shaders/stylize/index.ts`

**Interfaces:**

- Consumes: `STYLIZE_COMMON` (Task 2).
- Produces: `export const ABSTRACT_FRAG: string`; `export const PASSTHROUGH_FRAG: string`; `export const STYLIZE_FRAGS: Partial<Record<RenderMode, string>>` (keys are the non-sharp modes that are implemented so far). The stylize pass (Task 4) reads `STYLIZE_FRAGS[mode] ?? PASSTHROUGH_FRAG`.

- [ ] **Step 1: Create the abstract shader**

Create `packages/stripes-engine/src/shaders/stylize/abstract.frag.ts`:

```ts
import { STYLIZE_COMMON } from "./common";

export const ABSTRACT_FRAG =
  STYLIZE_COMMON +
  `
void main(){
  float t = uTime * 0.25;
  vec2 uv = warp(vUv, vec2(60.0, 140.0), 0.012 * uIntensity, t);
  vec3 c = blurTex(uv, 0.6 * uIntensity * uDpr);
  float g = grain(vUv, floor(t * 8.0));
  c *= mix(1.0, 0.82 + 0.36 * g, 0.5 * uIntensity);
  fragColor = vec4(c, 1.0);
}
`;
```

- [ ] **Step 2: Create the registry with a passthrough fallback**

Create `packages/stripes-engine/src/shaders/stylize/index.ts`:

```ts
import type { RenderMode } from "../../config/types";
import { STYLIZE_COMMON } from "./common";
import { ABSTRACT_FRAG } from "./abstract.frag";

export const PASSTHROUGH_FRAG =
  STYLIZE_COMMON +
  `
void main(){ fragColor = vec4(texture(uTex, vUv).rgb, 1.0); }
`;

export const STYLIZE_FRAGS: Partial<Record<RenderMode, string>> = {
  abstract: ABSTRACT_FRAG,
};
```

- [ ] **Step 3: Typecheck**

Run: `cd packages/stripes-engine && pir build`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add packages/stripes-engine/src/shaders/stylize/abstract.frag.ts packages/stripes-engine/src/shaders/stylize/index.ts
git commit -m "feat(engine): abstract stylize shader + registry"
```

---

## Task 4: Stylize pass

**Files:**

- Create: `packages/stripes-engine/src/passes/stylizePass.ts`

**Interfaces:**

- Consumes: `STYLIZE_FRAGS`, `PASSTHROUGH_FRAG` (Task 3); `FULLSCREEN_VERT`; `compileProgram`; `bindRenderTarget`, `RenderTarget`; `RenderMode`.
- Produces: `export function createStylizePass(gl, quad): { render(target, srcTex, p): void; dispose(): void }` where `p: { mode: RenderMode; time: number; intensity: number; resolution: [number, number]; dpr: number }`. Lazily compiles one program per mode, caching it. `target` is a `RenderTarget | null` (null = canvas).

- [ ] **Step 1: Create the pass**

Create `packages/stripes-engine/src/passes/stylizePass.ts`:

```ts
import { compileProgram } from "../gl/program";
import { bindRenderTarget, type RenderTarget } from "../gl/renderTarget";
import { FULLSCREEN_VERT } from "../shaders/fullscreen.vert";
import type { RenderMode } from "../config/types";
import { STYLIZE_FRAGS, PASSTHROUGH_FRAG } from "../shaders/stylize";

type StylizeUniforms = {
  mode: RenderMode;
  time: number;
  intensity: number;
  resolution: [number, number];
  dpr: number;
};

type ModeProgram = {
  program: WebGLProgram;
  uTex: WebGLUniformLocation | null;
  uTime: WebGLUniformLocation | null;
  uIntensity: WebGLUniformLocation | null;
  uResolution: WebGLUniformLocation | null;
  uDpr: WebGLUniformLocation | null;
};

export function createStylizePass(gl: WebGL2RenderingContext, quad: { draw(): void }) {
  const cache = new Map<RenderMode, ModeProgram>();

  function getProgram(mode: RenderMode): ModeProgram {
    const cached = cache.get(mode);
    if (cached) return cached;
    const frag = STYLIZE_FRAGS[mode] ?? PASSTHROUGH_FRAG;
    const program = compileProgram(gl, FULLSCREEN_VERT, frag);
    const mp: ModeProgram = {
      program,
      uTex: gl.getUniformLocation(program, "uTex"),
      uTime: gl.getUniformLocation(program, "uTime"),
      uIntensity: gl.getUniformLocation(program, "uIntensity"),
      uResolution: gl.getUniformLocation(program, "uResolution"),
      uDpr: gl.getUniformLocation(program, "uDpr"),
    };
    cache.set(mode, mp);
    return mp;
  }

  return {
    render(target: RenderTarget | null, srcTex: WebGLTexture, p: StylizeUniforms) {
      const mp = getProgram(p.mode);
      bindRenderTarget(gl, target);
      if (!target) gl.viewport(0, 0, p.resolution[0], p.resolution[1]);
      gl.useProgram(mp.program);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, srcTex);
      gl.uniform1i(mp.uTex, 0);
      gl.uniform1f(mp.uTime, p.time);
      gl.uniform1f(mp.uIntensity, p.intensity);
      gl.uniform2f(mp.uResolution, p.resolution[0], p.resolution[1]);
      gl.uniform1f(mp.uDpr, p.dpr);
      quad.draw();
    },
    dispose() {
      for (const mp of cache.values()) gl.deleteProgram(mp.program);
      cache.clear();
    },
  };
}
```

Note: `bindRenderTarget(gl, null)` binds the default framebuffer but does not set the viewport, so the `if (!target)` line sets it explicitly for the canvas case.

- [ ] **Step 2: Typecheck**

Run: `cd packages/stripes-engine && pir build`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add packages/stripes-engine/src/passes/stylizePass.ts
git commit -m "feat(engine): stylize post-process pass with per-mode program cache"
```

---

## Task 5: Stripe pass — optional render target

**Files:**

- Modify: `packages/stripes-engine/src/passes/stripePass.ts`

**Interfaces:**

- Produces: `createStripePass(...).render` gains a trailing optional param `target?: RenderTarget | null`. When omitted/null it binds the canvas and sets the viewport from `outWidth`/`outHeight` (today's behavior). When a `RenderTarget` is passed it renders into it via `bindRenderTarget`.

- [ ] **Step 1: Add the import**

In `packages/stripes-engine/src/passes/stripePass.ts`, add to the imports at the top:

```ts
import { bindRenderTarget, type RenderTarget } from "../gl/renderTarget";
```

- [ ] **Step 2: Add the param and switch the bind**

Change the `render` signature from:

```ts
    render(cellTex: WebGLTexture, lutTex: WebGLTexture, p: StripeUniforms, outWidth: number, outHeight: number) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.viewport(0, 0, outWidth, outHeight);
```

to:

```ts
    render(
      cellTex: WebGLTexture,
      lutTex: WebGLTexture,
      p: StripeUniforms,
      outWidth: number,
      outHeight: number,
      target: RenderTarget | null = null,
    ) {
      if (target) {
        bindRenderTarget(gl, target);
      } else {
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        gl.viewport(0, 0, outWidth, outHeight);
      }
```

Leave the rest of `render` unchanged.

- [ ] **Step 3: Typecheck**

Run: `cd packages/stripes-engine && pir build`
Expected: PASS (the existing call site passes 5 args; `target` defaults to null → unchanged behavior).

- [ ] **Step 4: Commit**

```bash
git add packages/stripes-engine/src/passes/stripePass.ts
git commit -m "feat(engine): stripe pass can render into an offscreen target"
```

---

## Task 6: Engine wiring

**Files:**

- Modify: `packages/stripes-engine/src/engine.ts`

**Interfaces:**

- Consumes: `createStylizePass` (Task 4); stripe pass `target` param (Task 5); `config.renderMode`, `config.renderIntensity` (Task 1).
- Produces: pipeline that, when `renderMode !== "sharp"`, renders stripe → `stripeOut` RT → stylize → canvas; otherwise unchanged. Mode changes trigger `buildPasses()`; intensity changes flow per-frame.

- [ ] **Step 1: Import the stylize pass**

In `packages/stripes-engine/src/engine.ts`, after the existing `import { createStripePass } from "./passes/stripePass";` line add:

```ts
import { createStylizePass } from "./passes/stylizePass";
```

- [ ] **Step 2: Add the change-tracking state var**

Near the other `last*` declarations (around `let lastEdgeMaskEnabled = config.edgeMask.enabled;`) add:

```ts
let lastRenderMode = config.renderMode;
```

- [ ] **Step 3: Build the stripe pass into a target + append stylize**

In `buildPasses()`, in the `stripesEnabled` branch, find where `const stripePass = createStripePass(gl, quad);` is created (just before `letterDataPasses`). Immediately after it add:

```ts
const stylizePass = config.renderMode !== "sharp" ? createStylizePass(gl, quad) : null;
```

Then, in the `passes = [ ... ]` array, replace the `stripe` pass object's `render` body's final `stripePass.render(...)` call's tail so the stripe targets `stripeOut` when stylizing. Concretely, change the end of the stripe `render` from:

```ts
              output.width,
              output.height,
            );
```

to:

```ts
              output.width,
              output.height,
              stylizePass ? pool.get("stripeOut", output.width, output.height, { linear: true }) : null,
            );
```

And change the stripe pass object's `dispose` to also dispose stylize is NOT needed (separate pass). Instead, directly after the `stripe` pass object (the closing `},` of its entry, before the closing `];` of the array) insert a stylize pass entry:

```ts
        ...(stylizePass
          ? [
              {
                name: "stylize",
                render: () => {
                  const src = pool.get("stripeOut", output.width, output.height, { linear: true });
                  stylizePass.render(null, src.texture, {
                    mode: config.renderMode,
                    time: clock.now() / 1000,
                    intensity: config.renderIntensity,
                    resolution: [output.width, output.height] as [number, number],
                    dpr: getDpr(),
                  });
                },
                dispose: () => stylizePass.dispose(),
              },
            ]
          : []),
```

- [ ] **Step 4: Allocate the stripeOut RT on resize**

In `applySizes()`, after the `pool.get("cell", cellGrid.cols, cellGrid.rows);` line add:

```ts
if (config.renderMode !== "sharp") {
  pool.get("stripeOut", output.width, output.height, { linear: true });
}
```

- [ ] **Step 5: Rebuild passes on mode change**

In `setConfig`, add `config.renderMode !== lastRenderMode` to the big `if (...)` rebuild condition (add it as another `||` clause alongside `config.edgeMask.enabled !== lastEdgeMaskEnabled ||`):

```ts
        config.renderMode !== lastRenderMode ||
```

And inside that `if` block, after `lastColorsMode = config.colors.mode;`, add:

```ts
lastRenderMode = config.renderMode;
```

(Do NOT add `renderIntensity` to the condition — it is read per-frame and must not trigger a rebuild.)

- [ ] **Step 6: Typecheck**

Run: `cd packages/stripes-engine && pir build`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add packages/stripes-engine/src/engine.ts
git commit -m "feat(engine): wire stylize pass into the pipeline behind renderMode"
```

---

## Task 7: Lab controls + end-to-end verification (P1 gate)

**Files:**

- Modify: `apps/lab/src/controls/levaSchema.ts`

**Interfaces:**

- Consumes: engine `setConfig({ renderMode, renderIntensity })`.
- Produces: a `renderMode` dropdown (all 17 modes) and a `renderIntensity` slider in the Stripes folder, mapped into the engine config the lab already builds.

- [ ] **Step 1: Add the controls to the Stripes folder**

In `apps/lab/src/controls/levaSchema.ts`, inside the `Stripes: folder({ ... })` block (after the `colorsBackgroundColor` entry, before the folder's closing `})`), add:

```ts
        renderMode: {
          value: d.renderMode,
          options: {
            Sharp: "sharp",
            Abstract: "abstract",
            Watercolor: "watercolor",
            Charcoal: "charcoal",
            Pencil: "pencil",
            Brush: "brush",
            Halftone: "halftone",
            Risograph: "risograph",
            "Stained glass": "stainedGlass",
            "Paper cut-out": "paperCutout",
            CRT: "crt",
            Glitch: "glitch",
            VHS: "vhs",
            Plasma: "plasma",
            Amber: "amber",
            Gummy: "gummy",
            Caramel: "caramel",
          } as const,
          label: "Render mode",
        },
        renderIntensity: {
          value: d.renderIntensity,
          min: 0,
          max: 1,
          step: 0.01,
          label: "Intensity",
          render: (get) => get("Stripes.renderMode") !== "sharp",
        },
```

- [ ] **Step 2: Map the values into the engine config**

In the same file, in the object that maps `values.*` to the engine config (the block containing `stripesEnabled: values.stripesEnabled,`), add after `stripesEnabled: values.stripesEnabled,`:

```ts
    renderMode: values.renderMode,
    renderIntensity: values.renderIntensity,
```

- [ ] **Step 3: Typecheck the lab**

Run: `cd apps/lab && pir build`
Expected: PASS. (If the lab build is heavy, `pir typecheck` if defined; otherwise `pir build`.)

- [ ] **Step 4: Verify live in the browser**

The user runs the dev server on the canonical port (do not start a second one — probe `http://localhost:5174` first; ask the user to start it if down). In the lab:

- Confirm `Render mode` defaults to `Sharp` and the output is identical to before.
- Select `Abstract`: stripes should gain wobbly edges + grain and animate subtly.
- Drag `Intensity` 1 → 0: the look should collapse back toward sharp.
- Switch back to `Sharp`: confirm the stylize pass is gone (output crisp again) and no console errors.

Expected: Abstract reads like its mockup; Sharp unchanged; intensity dials the effect.

- [ ] **Step 5: Commit**

```bash
git add apps/lab/src/controls/levaSchema.ts
git commit -m "feat(lab): render mode dropdown + intensity slider"
```

---

## Mode-task recipe (Tasks 8–22)

Every remaining mode follows the identical shape. For mode `<m>` with file `shaders/stylize/<m>.frag.ts` exporting `<M>_FRAG`:

1. Create the shader file (code given per task).
2. Register it: import `<M>_FRAG` in `shaders/stylize/index.ts` and add `<m>: <M>_FRAG,` to `STYLIZE_FRAGS`.
3. `cd packages/stripes-engine && pir build` → PASS.
4. Verify live: select the mode in the lab, compare to its mockup, sweep intensity. Tune the numeric constants in the shader if it diverges from the mockup (the constants are starting points, not sacred).
5. Commit: `git add packages/stripes-engine/src/shaders/stylize/<m>.frag.ts packages/stripes-engine/src/shaders/stylize/index.ts && git commit -m "feat(engine): <m> stylize mode"`.

Each shader file has the form:

```ts
import { STYLIZE_COMMON } from "./common";
export const <M>_FRAG = STYLIZE_COMMON + `
<optional helper fns>
void main(){ ... }
`;
```

---

## Phase 2 — painterly / print

### Task 8: Watercolor

**Files:** Create `packages/stripes-engine/src/shaders/stylize/watercolor.frag.ts`; Modify `shaders/stylize/index.ts`.

- [ ] **Step 1: Shader** — `WATERCOLOR_FRAG` main:

```glsl
void main(){
  float t = uTime * 0.18;
  vec2 uv = warp(vUv, vec2(30.0, 40.0), 0.03 * uIntensity, t);
  vec3 c = blurTex(uv, 2.2 * uIntensity * uDpr);
  float g = grain(vUv, floor(t * 6.0));
  c *= mix(1.0, 0.9 + 0.2 * g, 0.35 * uIntensity);
  fragColor = vec4(c, 1.0);
}
```

- [ ] **Step 2: Register** (`watercolor: WATERCOLOR_FRAG`), **Step 3: build**, **Step 4: verify in lab**, **Step 5: commit** — per recipe.

### Task 9: Charcoal

**Files:** Create `shaders/stylize/charcoal.frag.ts`; Modify `index.ts`.

- [ ] **Step 1: Shader** — `CHARCOAL_FRAG` main:

```glsl
void main(){
  float t = uTime * 0.2;
  vec2 uv = warp(vUv, vec2(70.0, 90.0), 0.018 * uIntensity, t);
  vec3 c = texture(uTex, uv).rgb;
  float g = grain(vUv, floor(t * 10.0));
  c *= mix(1.0, 0.6 + 0.5 * g, 0.75 * uIntensity);
  fragColor = vec4(c, 1.0);
}
```

- [ ] **Steps 2–5** per recipe (`charcoal: CHARCOAL_FRAG`).

### Task 10: Pencil

**Files:** Create `shaders/stylize/pencil.frag.ts`; Modify `index.ts`.

- [ ] **Step 1: Shader** — `PENCIL_FRAG` main:

```glsl
void main(){
  float t = uTime * 0.15;
  vec2 uv = warp(vUv, vec2(80.0, 120.0), 0.01 * uIntensity, t);
  vec3 c = texture(uTex, uv).rgb;
  vec2 pp = vUv * uResolution;
  float hatch = 0.5 + 0.5 * sin((pp.x + pp.y) * 0.5 + fbm(vUv * 40.0 + t) * 3.0);
  hatch = smoothstep(0.3, 0.9, hatch);
  c *= mix(1.0, 0.55 + 0.5 * hatch, 0.6 * uIntensity);
  fragColor = vec4(c, 1.0);
}
```

- [ ] **Steps 2–5** per recipe (`pencil: PENCIL_FRAG`).

### Task 11: Brush

**Files:** Create `shaders/stylize/brush.frag.ts`; Modify `index.ts`.

- [ ] **Step 1: Shader** — `BRUSH_FRAG` main:

```glsl
void main(){
  float t = uTime * 0.2;
  vec2 uv = warp(vUv, vec2(25.0, 200.0), 0.012 * uIntensity, t);
  vec3 c = texture(uTex, uv).rgb;
  float streak = fbm(vec2(vUv.x * 30.0, vUv.y * 180.0) + t);
  c *= mix(1.0, 0.78 + 0.34 * streak, 0.45 * uIntensity);
  fragColor = vec4(c, 1.0);
}
```

- [ ] **Steps 2–5** per recipe (`brush: BRUSH_FRAG`).

### Task 12: Halftone

**Files:** Create `shaders/stylize/halftone.frag.ts`; Modify `index.ts`.

- [ ] **Step 1: Shader** — `HALFTONE_FRAG` main:

```glsl
void main(){
  float t = uTime * 0.1;
  vec3 src = texture(uTex, vUv).rgb;
  float l = luma(src);
  float cell = 9.0 * uDpr;
  vec2 gp = vUv * uResolution / cell;
  vec2 f = fract(gp) - 0.5;
  float d = length(f);
  float r = mix(0.05, 0.72, l) * (0.92 + 0.08 * sin(t * 6.2));
  float dotm = smoothstep(r, r - 0.12, d);
  vec3 outc = mix(vec3(0.04), src, dotm);
  fragColor = vec4(mix(src, outc, uIntensity), 1.0);
}
```

- [ ] **Steps 2–5** per recipe (`halftone: HALFTONE_FRAG`).

### Task 13: Risograph

**Files:** Create `shaders/stylize/risograph.frag.ts`; Modify `index.ts`.

- [ ] **Step 1: Shader** — `RISOGRAPH_FRAG` main:

```glsl
void main(){
  float t = uTime * 0.2;
  vec2 o = (vec2(2.5, 2.0) / uResolution) * (1.0 + 0.4 * sin(t * 3.0));
  vec2 uv1 = warp(vUv - o, vec2(60.0, 120.0), 0.01 * uIntensity, t);
  vec2 uv2 = warp(vUv + o, vec2(60.0, 120.0), 0.01 * uIntensity, t + 3.0);
  vec3 a = texture(uTex, uv1).rgb;
  vec3 b = texture(uTex, uv2).rgb;
  vec3 c = mix(a, a * b, 0.85);
  float g = grain(vUv, floor(t * 8.0));
  c *= mix(1.0, 0.85 + 0.3 * g, 0.3 * uIntensity);
  fragColor = vec4(mix(texture(uTex, vUv).rgb, c, uIntensity), 1.0);
}
```

- [ ] **Steps 2–5** per recipe (`risograph: RISOGRAPH_FRAG`).

### Task 14: Stained glass

**Files:** Create `shaders/stylize/stainedGlass.frag.ts`; Modify `index.ts`.

- [ ] **Step 1: Shader** — `STAINED_GLASS_FRAG` main:

```glsl
void main(){
  float t = uTime * 0.15;
  vec2 uv = warp(vUv, vec2(40.0, 40.0), 0.012 * uIntensity, t);
  vec3 c = texture(uTex, uv).rgb;
  vec2 gp = vUv * uResolution / (15.0 * uDpr);
  vec2 f = abs(fract(gp) - 0.5);
  float grout = smoothstep(0.5, 0.42, max(f.x, f.y));
  c *= mix(1.0, grout, 0.7 * uIntensity);
  fragColor = vec4(c, 1.0);
}
```

- [ ] **Steps 2–5** per recipe (`stainedGlass: STAINED_GLASS_FRAG`).

### Task 15: Paper cut-out

**Files:** Create `shaders/stylize/paperCutout.frag.ts`; Modify `index.ts`.

- [ ] **Step 1: Shader** — `PAPER_CUTOUT_FRAG` main:

```glsl
void main(){
  float t = uTime * 0.2;
  vec2 uv = warp(vUv, vec2(50.0, 80.0), 0.006 * uIntensity, t);
  vec3 c = texture(uTex, uv).rgb;
  vec2 so = vec2(-4.0, -4.0) / uResolution;
  vec3 over = texture(uTex, uv - so).rgb;
  float here = luma(c), there = luma(over);
  float shadow = smoothstep(0.15, 0.0, here) * smoothstep(0.2, 0.5, there);
  c = mix(c, c * 0.45, shadow * uIntensity);
  fragColor = vec4(c, 1.0);
}
```

- [ ] **Steps 2–5** per recipe (`paperCutout: PAPER_CUTOUT_FRAG`).

---

## Phase 3 — screen / digital

### Task 16: CRT

**Files:** Create `shaders/stylize/crt.frag.ts`; Modify `index.ts`.

- [ ] **Step 1: Shader** — `CRT_FRAG` main:

```glsl
void main(){
  float t = uTime;
  vec2 uv = vUv;
  float sp = (1.4 / uResolution.x) * uIntensity;
  vec3 c;
  c.r = texture(uTex, uv + vec2(sp, 0.0)).r;
  c.g = texture(uTex, uv).g;
  c.b = texture(uTex, uv - vec2(sp, 0.0)).b;
  float scan = 0.5 + 0.5 * sin((uv.y * uResolution.y + t * 30.0) * 3.14159);
  c *= mix(1.0, 0.6 + 0.4 * scan, 0.5 * uIntensity);
  fragColor = vec4(c, 1.0);
}
```

- [ ] **Steps 2–5** per recipe (`crt: CRT_FRAG`).

### Task 17: Glitch

**Files:** Create `shaders/stylize/glitch.frag.ts`; Modify `index.ts`.

- [ ] **Step 1: Shader** — `GLITCH_FRAG` main:

```glsl
void main(){
  float t = uTime;
  float band = floor(vUv.y * 18.0);
  float slip = (hash21(vec2(band, floor(t * 6.0))) - 0.5);
  slip *= step(0.7, hash21(vec2(band * 1.7, floor(t * 6.0) + 3.0)));
  vec2 uv = vUv + vec2(slip * 0.06 * uIntensity, 0.0);
  float sp = (3.5 / uResolution.x) * uIntensity;
  vec3 c;
  c.r = texture(uTex, uv + vec2(sp, 0.0)).r;
  c.g = texture(uTex, uv).g;
  c.b = texture(uTex, uv - vec2(sp, 0.0)).b;
  fragColor = vec4(c, 1.0);
}
```

- [ ] **Steps 2–5** per recipe (`glitch: GLITCH_FRAG`).

### Task 18: VHS

**Files:** Create `shaders/stylize/vhs.frag.ts`; Modify `index.ts`.

- [ ] **Step 1: Shader** — `VHS_FRAG` main:

```glsl
void main(){
  float t = uTime;
  float jitter = (fbm(vec2(vUv.y * 60.0, t * 2.0)) - 0.5) * 0.02 * uIntensity;
  vec2 uv = vUv + vec2(jitter, 0.0);
  float sp = (2.6 / uResolution.x) * uIntensity;
  vec3 c;
  c.r = texture(uTex, uv + vec2(sp, 0.0)).r;
  c.g = texture(uTex, uv).g;
  c.b = texture(uTex, uv - vec2(sp, 0.0)).b;
  float scan = 0.5 + 0.5 * sin(uv.y * uResolution.y * 0.5 - t * 20.0);
  c *= mix(1.0, 0.7 + 0.3 * scan, 0.4 * uIntensity);
  float n = grain(vUv, floor(t * 24.0));
  c += (n - 0.5) * 0.08 * uIntensity;
  fragColor = vec4(c, 1.0);
}
```

- [ ] **Steps 2–5** per recipe (`vhs: VHS_FRAG`).

### Task 19: Plasma

**Files:** Create `shaders/stylize/plasma.frag.ts`; Modify `index.ts`.

- [ ] **Step 1: Shader** — `PLASMA_FRAG` (helper + main):

```glsl
vec3 plasmaPal(float x){ return 0.5 + 0.5 * cos(6.2831 * (vec3(0.0, 0.33, 0.67) + x)); }
void main(){
  float t = uTime * 0.5;
  vec3 src = texture(uTex, vUv).rgb;
  float p = fbm(vUv * vec2(60.0, 60.0) + vec2(t, t * 0.7));
  vec3 pl = plasmaPal(p + t * 0.1);
  vec3 c = src * pl * 1.4;
  fragColor = vec4(mix(src, c, uIntensity), 1.0);
}
```

- [ ] **Steps 2–5** per recipe (`plasma: PLASMA_FRAG`).

### Task 20: Amber

**Files:** Create `shaders/stylize/amber.frag.ts`; Modify `index.ts`.

- [ ] **Step 1: Shader** — `AMBER_FRAG` main:

```glsl
void main(){
  float t = uTime;
  vec3 src = texture(uTex, vUv).rgb;
  float l = luma(src);
  vec3 amber = vec3(1.25, 0.72, 0.08) * l;
  float bl = 0.0;
  vec2 o = 2.5 / uResolution;
  for (int i = -2; i <= 2; i++){ bl += luma(texture(uTex, vUv + vec2(float(i) * o.x, 0.0)).rgb); }
  amber += vec3(1.2, 0.7, 0.1) * (bl / 5.0) * 0.5;
  float scan = 0.5 + 0.5 * sin((vUv.y * uResolution.y + t * 20.0) * 3.14159);
  amber *= mix(1.0, 0.65 + 0.35 * scan, 0.5 * uIntensity);
  fragColor = vec4(mix(src, amber, uIntensity), 1.0);
}
```

- [ ] **Steps 2–5** per recipe (`amber: AMBER_FRAG`).

---

## Phase 4 — sweets

### Task 21: Gummy

**Files:** Create `shaders/stylize/gummy.frag.ts`; Modify `index.ts`.

- [ ] **Step 1: Shader** — `GUMMY_FRAG` main:

```glsl
void main(){
  float t = uTime * 0.2;
  vec2 uv = warp(vUv, vec2(60.0, 60.0), 0.008 * uIntensity, t);
  vec3 c = texture(uTex, uv).rgb;
  float l = luma(c);
  c = mix(vec3(l), c, 1.4);
  vec2 gp = vUv * uResolution / (26.0 * uDpr);
  vec2 f = fract(gp) - 0.5;
  float cell = smoothstep(0.5, 0.46, max(abs(f.x), abs(f.y)));
  float gloss = smoothstep(0.4, 0.0, length(f - vec2(-0.18, -0.18)));
  c = c * mix(1.0, cell, 0.5 * uIntensity) + gloss * 0.5 * uIntensity * cell;
  fragColor = vec4(c, 1.0);
}
```

- [ ] **Steps 2–5** per recipe (`gummy: GUMMY_FRAG`).

### Task 22: Caramel

**Files:** Create `shaders/stylize/caramel.frag.ts`; Modify `index.ts`.

- [ ] **Step 1: Shader** — `CARAMEL_FRAG` main:

```glsl
void main(){
  float t = uTime * 0.25;
  vec2 uv = warp(vUv, vec2(50.0, 10.0), 0.012 * uIntensity, t);
  vec3 c = texture(uTex, uv).rgb;
  float l = luma(c);
  c = mix(c, vec3(1.0, 0.55, 0.12) * l * 1.4, 0.5 * uIntensity);
  vec3 hi = blurTex(uv - vec2(1.5, 2.5) / uResolution, 2.4 * uDpr);
  float sheen = smoothstep(0.4, 0.9, luma(hi));
  c += sheen * 0.4 * uIntensity;
  fragColor = vec4(c, 1.0);
}
```

- [ ] **Steps 2–5** per recipe (`caramel: CARAMEL_FRAG`).

---

## Final verification

- [ ] **Run the engine test suite**

Run: `cd packages/stripes-engine && pir test -- --run`
Expected: PASS (all existing + the new renderMode tests).

- [ ] **Build both packages**

Run: `cd packages/stripes-engine && pir build` then `cd apps/lab && pir build`
Expected: PASS.

- [ ] **Full visual sweep in the lab**

Cycle through all 17 modes. Each non-sharp mode reads like its brainstorming mockup and animates; `Intensity` dials each from sharp→full; `Sharp` is crisp and identical to the pre-feature output. No console errors when switching modes.

---

## Self-Review

**Spec coverage:**

- `renderMode` + `renderIntensity` config, default sharp, intensity clamp, unknown→sharp → Task 1. ✓
- Zero overhead on sharp (no pass, no RT) → Task 6 (stylize only built when `renderMode !== "sharp"`; `stripeOut` only allocated then). ✓
- Post-process stylize pass reading stripe output → Tasks 4–6. ✓
- Per-mode registry, lazy compile, only active mode compiled → Task 4. ✓
- Shared GLSL helper library → Task 2. ✓
- All-modes-animate via `uTime` → every mode main uses `uTime`. ✓
- Lab dropdown + intensity slider → Task 7. ✓
- All 16 modes → Tasks 3 (abstract) + 8–22. ✓
- Mockups are target, GLSL tuned in lab → recipe step 4 on every mode task. ✓

**Placeholder scan:** No TBD/TODO; every shader and wiring step contains complete code. Mode tasks 8–22 use the explicit recipe (steps 2–5 are the same five concrete actions, with the mode key and `<M>_FRAG` named per task — repeated by reference to a recipe defined inline above them, not omitted). ✓

**Type consistency:** `RenderMode` union identical in `types.ts`, `RENDER_MODES`, `STYLIZE_FRAGS` keys, lab dropdown values. `STYLIZE_FRAGS` is `Partial<Record<RenderMode, string>>` so phased addition typechecks; `createStylizePass` reads `STYLIZE_FRAGS[mode] ?? PASSTHROUGH_FRAG`. Stylize uniform names (`uTex`/`uTime`/`uIntensity`/`uResolution`/`uDpr`) match between `STYLIZE_COMMON` and `stylizePass.ts`. Stripe `render` `target` param matches the engine call site. ✓
