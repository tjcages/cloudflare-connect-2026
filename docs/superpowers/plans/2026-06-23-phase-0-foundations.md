# Phase 0 — Foundations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up the new clean-room GPU-first engine package + a dev harness app, a WebGL2 context with true-DPR output and a reduced-resolution field pass, and the perf + visual test harness that gates every later phase — rendering a clear grayscale field on screen.

**Architecture:** A new `@necatikcl/stripes-engine` package owns a raw-WebGL2 render core: an injectable-clock/seed engine that runs a multi-pass FBO graph. Phase 0 stands up two real passes — `field` (renders a deterministic grayscale gradient into an offscreen RT at `fieldScale × DPR`) and `present` (upscales the field to the full-DPR display-p3 canvas, the seat the stripe pass will later take). A new `apps/lab` React app mounts the engine and shows a live perf overlay. Playwright drives the engine deterministically (manual clock) for visual goldens and under a real rAF loop at 4K for the 60fps perf gate.

**Tech Stack:** TypeScript, raw WebGL2 (GLSL ES 3.00), in-house ~150-line GL helper module (no Pixi, no twgl), React 19 + Vite for the lab app, Vitest for pure-logic unit tests, Playwright (real-GPU Chromium) for perf + visual gates. pnpm workspace via `pi`/`pir`.

## Global Constraints

- **Package manager:** `pi` (install), `pi add <pkg> [-D]` (add dep), `pir <script>` (run script). NEVER npm/pnpm/yarn/npx directly. Copied verbatim from the user's environment rule.
- **GL floor:** WebGL2 / GLSL ES 3.00 ONLY. No WebGL1 fallback, no `texture2D`/`gl_FragColor`. Shaders begin `#version 300 es`.
- **Color:** display-p3 when supported — set `drawingBufferColorSpace` + `unpackColorSpace = "display-p3"`. All data textures are raw byte/float buffers, never `<canvas>` uploads.
- **Resolution:** output canvas backing store = `cssSize × devicePixelRatio`, clamped so neither dimension exceeds `gl.getParameter(MAX_TEXTURE_SIZE)`. No hardcoded `2×`. Field passes render at `fieldScale` (default `0.5`) of the output size; the present/stripe pass renders at full output size.
- **Determinism:** the engine takes an injectable `clock` (`now(): number`) and integer `seed`; with a fixed clock + seed + DPR, output is reproducible (basis for visual goldens). Tests drive frames via `renderFrame()`, never rAF.
- **No silent shader failures:** `createProgram` MUST check `COMPILE_STATUS`/`LINK_STATUS` and throw with the info log. A failed compile must never silently produce a blank canvas.
- **Scope guard:** Phase 0 does NOT touch `apps/studio` or `packages/stripes-shader` (the live product). It only adds the new package, the new app, test infra, and the docs/rules reset.
- **Commit style:** Conventional commits, scope `engine` or `lab` (e.g. `feat(engine): …`, `chore(lab): …`). Husky `precommit` runs oxfmt+oxlint on staged files; let it run.

## File Structure

```
packages/stripes-engine/
  package.json                       # @necatikcl/stripes-engine, private for now
  tsconfig.json
  vite.config.ts                     # lib build (esm) — minimal for Phase 0
  vitest.config.ts
  src/
    index.ts                         # curated public surface (createStripesEngine, types)
    engine.ts                        # createStripesEngine: pass graph, render loop, ctx-loss recovery
    core/
      clock.ts                       # createRealClock / createManualClock
      rng.ts                         # createSeededRng (mulberry32)
    gl/
      context.ts                     # createEngineContext (webgl2 + display-p3)
      program.ts                     # compileProgram (throws on failure), createFullscreenQuad
      renderTarget.ts                # createRenderTarget (RGBA8/float), resize, dispose
      pingPong.ts                    # createPingPong (Phase 6 needs it; helper + test now)
      resolution.ts                  # resolveOutputSize / resolveFieldSize / clampToMaxTexture (pure)
    passes/
      fieldPass.ts                   # PASS A stub: deterministic grayscale gradient → field RT
      presentPass.ts                 # present: field RT → canvas (full DPR)
    shaders/
      fullscreen.vert.ts             # shared fullscreen-triangle vertex shader
      field.frag.ts                  # gradient field fragment (Phase 1 replaces body)
      present.frag.ts                # sample field, output to canvas
    perf/
      percentiles.ts                 # pure percentile()
      gpuTimer.ts                    # EXT_disjoint_timer_query_webgl2 wrapper (no-op if absent)
      perfCollector.ts               # frame-time ring buffer → PerfSnapshot
apps/lab/
  package.json                       # private app "lab"
  index.html
  tsconfig.json
  vite.config.ts
  src/
    main.tsx
    LabApp.tsx                       # mount engine, rAF loop, perf overlay, URL-param test hooks
    PerfOverlay.tsx                  # live fps / p50-p95-p99 / per-pass GPU ms
tests/                               # root-level Playwright e2e (perf + visual gates)
  perf.spec.ts
  visual.spec.ts
playwright.config.ts                 # real-GPU chromium; webServer = lab preview
docs/
  engine-architecture.md             # NEW concise architecture doc for the new engine
  legacy/                            # old docs moved here (superseded)
.cursor/legacy/                      # old .cursor rules/skills/commands moved here
AGENTS.md                            # rewritten for the new engine + monorepo state
```

---

### Task 1: Scaffold the engine package + lab app in the workspace

**Files:**

- Create: `packages/stripes-engine/package.json`, `packages/stripes-engine/tsconfig.json`, `packages/stripes-engine/vite.config.ts`, `packages/stripes-engine/vitest.config.ts`, `packages/stripes-engine/src/index.ts`
- Create: `apps/lab/package.json`, `apps/lab/index.html`, `apps/lab/tsconfig.json`, `apps/lab/vite.config.ts`, `apps/lab/src/main.tsx`, `apps/lab/src/LabApp.tsx`
- Modify: `pnpm-workspace.yaml` (already globs `apps/*` + `packages/*` — verify), `vitest.workspace.ts` (add the new package)

**Interfaces:**

- Produces: workspace packages `@necatikcl/stripes-engine` and `lab`; `pir --filter lab dev` boots; `pir test` discovers the new package.

- [ ] **Step 1: Inspect the existing workspace + studio configs to copy patterns**

Run: `cat pnpm-workspace.yaml vitest.workspace.ts packages/stripes-shader/package.json packages/stripes-shader/tsconfig.json apps/studio/vite.config.ts apps/studio/package.json`
Expected: see how the studio app + shader package declare deps, scripts, React/Vite versions, the `@necatikcl/*` scope, and how `vitest.workspace.ts` lists projects. Match those versions exactly (React 19, Vite, etc.).

- [ ] **Step 2: Create `packages/stripes-engine/package.json`**

```json
{
  "name": "@necatikcl/stripes-engine",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "main": "./src/index.ts",
  "module": "./src/index.ts",
  "types": "./src/index.ts",
  "exports": { ".": "./src/index.ts" },
  "scripts": {
    "typecheck": "tsc --noEmit",
    "build": "vite build"
  },
  "devDependencies": {}
}
```

- [ ] **Step 3: Create `packages/stripes-engine/tsconfig.json`**

Mirror `packages/stripes-shader/tsconfig.json` (same compilerOptions — strict, ESNext, DOM + WebGL2 lib). Ensure `"lib"` includes `"DOM"` and `"ESNext"` (WebGL2 types ship with DOM lib). If the shader tsconfig extends a root, extend the same root.

- [ ] **Step 4: Create `packages/stripes-engine/vite.config.ts` and `vitest.config.ts`**

`vite.config.ts` — minimal library build (lib entry `src/index.ts`, format `es`). Copy the shape from `packages/stripes-shader/vite.config.ts`, change entry/name. `vitest.config.ts` — copy `packages/stripes-shader/vitest.config.ts` (environment `happy-dom` or `node`; pure-logic tests don't need a DOM).

- [ ] **Step 5: Create `packages/stripes-engine/src/index.ts` placeholder**

```ts
export const ENGINE_PACKAGE = "@necatikcl/stripes-engine";
```

- [ ] **Step 6: Scaffold the lab app (`apps/lab/`)**

`package.json` (private, name `lab`, scripts `dev`/`build`/`preview` via Vite; deps: `react`, `react-dom`, `@necatikcl/stripes-engine: "workspace:*"`; devDeps match studio's Vite + @vitejs/plugin-react versions). `index.html` with `<div id="root">` + `<script type="module" src="/src/main.tsx">`. `tsconfig.json` mirroring studio. `vite.config.ts` with the React plugin and `server: { port: 5174 }` (the studio uses 5173; lab gets 5174 to avoid collision). `src/main.tsx` mounts `<LabApp/>`. `src/LabApp.tsx`:

```tsx
export function LabApp() {
  return <div style={{ font: "13px system-ui", padding: 16 }}>lab: engine harness (scaffold)</div>;
}
```

- [ ] **Step 7: Register the new package in `vitest.workspace.ts`**

Add `packages/stripes-engine` to the workspace project list (match the existing entry format for `packages/stripes-shader`).

- [ ] **Step 8: Install + verify both boot**

Run: `pi`
Expected: install succeeds, `@necatikcl/stripes-engine` + `lab` linked into the workspace.

Run: `pir --filter lab build`
Expected: lab builds (renders the scaffold text). (Don't start a long-running dev server in the plan; a `build` proves wiring.)

Run: `pir --filter @necatikcl/stripes-engine typecheck`
Expected: PASS (only the placeholder export exists).

- [ ] **Step 9: Commit**

```bash
git add packages/stripes-engine apps/lab pnpm-workspace.yaml vitest.workspace.ts pnpm-lock.yaml
git commit -m "chore(engine): scaffold stripes-engine package + lab harness app"
```

---

### Task 2: Resolution math (pure, unit-tested)

**Files:**

- Create: `packages/stripes-engine/src/gl/resolution.ts`
- Test: `packages/stripes-engine/src/gl/resolution.test.ts`

**Interfaces:**

- Produces:
  - `type Size = { width: number; height: number }`
  - `clampToMaxTexture(size: Size, maxTextureSize: number): Size` — uniform downscale (preserve aspect) so neither dim exceeds the cap; integer result ≥ 1.
  - `resolveOutputSize(cssWidth: number, cssHeight: number, dpr: number, maxTextureSize: number): Size` — `round(css × dpr)` then `clampToMaxTexture`.
  - `resolveFieldSize(output: Size, fieldScale: number): Size` — `max(1, floor(output × fieldScale))` per axis.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from "vitest";
import { clampToMaxTexture, resolveOutputSize, resolveFieldSize } from "./resolution";

describe("resolution", () => {
  it("rounds css × dpr for output size", () => {
    expect(resolveOutputSize(800, 600, 2, 8192)).toEqual({ width: 1600, height: 1200 });
    expect(resolveOutputSize(800, 600, 1.5, 8192)).toEqual({ width: 1200, height: 900 });
  });
  it("clamps to max texture size preserving aspect", () => {
    expect(clampToMaxTexture({ width: 16384, height: 8192 }, 8192)).toEqual({ width: 8192, height: 4096 });
    expect(clampToMaxTexture({ width: 4000, height: 4000 }, 8192)).toEqual({ width: 4000, height: 4000 });
  });
  it("output respects the max texture clamp", () => {
    // 3840 css × 3 dpr = 11520 > 8192 → scaled down, aspect preserved
    const out = resolveOutputSize(3840, 2160, 3, 8192);
    expect(Math.max(out.width, out.height)).toBeLessThanOrEqual(8192);
    expect(out.width / out.height).toBeCloseTo(3840 / 2160, 3);
  });
  it("field size is fieldScale of output, min 1", () => {
    expect(resolveFieldSize({ width: 1600, height: 1200 }, 0.5)).toEqual({ width: 800, height: 600 });
    expect(resolveFieldSize({ width: 1, height: 1 }, 0.1)).toEqual({ width: 1, height: 1 });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pir --filter @necatikcl/stripes-engine test -- run resolution`
Expected: FAIL — `resolution.ts` / exports not found.

- [ ] **Step 3: Write the implementation**

```ts
export type Size = { width: number; height: number };

export function clampToMaxTexture(size: Size, maxTextureSize: number): Size {
  const longest = Math.max(size.width, size.height);
  if (longest <= maxTextureSize) {
    return { width: Math.max(1, Math.round(size.width)), height: Math.max(1, Math.round(size.height)) };
  }
  const scale = maxTextureSize / longest;
  return {
    width: Math.max(1, Math.round(size.width * scale)),
    height: Math.max(1, Math.round(size.height * scale)),
  };
}

export function resolveOutputSize(cssWidth: number, cssHeight: number, dpr: number, maxTextureSize: number): Size {
  return clampToMaxTexture({ width: cssWidth * dpr, height: cssHeight * dpr }, maxTextureSize);
}

export function resolveFieldSize(output: Size, fieldScale: number): Size {
  return {
    width: Math.max(1, Math.floor(output.width * fieldScale)),
    height: Math.max(1, Math.floor(output.height * fieldScale)),
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pir --filter @necatikcl/stripes-engine test -- run resolution`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add packages/stripes-engine/src/gl/resolution.ts packages/stripes-engine/src/gl/resolution.test.ts
git commit -m "feat(engine): resolution math (DPR output, max-texture clamp, fieldScale)"
```

---

### Task 3: Deterministic clock + seeded RNG (pure, unit-tested)

**Files:**

- Create: `packages/stripes-engine/src/core/clock.ts`, `packages/stripes-engine/src/core/rng.ts`
- Test: `packages/stripes-engine/src/core/rng.test.ts`, `packages/stripes-engine/src/core/clock.test.ts`

**Interfaces:**

- Produces:
  - `type Clock = { now(): number }`
  - `createRealClock(): Clock` — wraps `performance.now()`.
  - `type ManualClock = Clock & { set(ms: number): void; advance(dtMs: number): void }`; `createManualClock(startMs?: number): ManualClock`.
  - `createSeededRng(seed: number): () => number` — mulberry32; returns floats in `[0, 1)`, deterministic per seed.

- [ ] **Step 1: Write the failing tests**

```ts
// rng.test.ts
import { describe, it, expect } from "vitest";
import { createSeededRng } from "./rng";
describe("createSeededRng", () => {
  it("is deterministic for a given seed", () => {
    const a = createSeededRng(42),
      b = createSeededRng(42);
    const seqA = [a(), a(), a()],
      seqB = [b(), b(), b()];
    expect(seqA).toEqual(seqB);
  });
  it("differs across seeds and stays in [0,1)", () => {
    const a = createSeededRng(1),
      b = createSeededRng(2);
    expect(a()).not.toEqual(b());
    const r = createSeededRng(7);
    for (let i = 0; i < 1000; i++) {
      const v = r();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
});
```

```ts
// clock.test.ts
import { describe, it, expect } from "vitest";
import { createManualClock } from "./clock";
describe("createManualClock", () => {
  it("set and advance move the clock", () => {
    const c = createManualClock(100);
    expect(c.now()).toBe(100);
    c.advance(16);
    expect(c.now()).toBe(116);
    c.set(0);
    expect(c.now()).toBe(0);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `pir --filter @necatikcl/stripes-engine test -- run core`
Expected: FAIL — modules not found.

- [ ] **Step 3: Implement `rng.ts`**

```ts
export function createSeededRng(seed: number): () => number {
  let a = seed >>> 0;
  return function next(): number {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
```

- [ ] **Step 4: Implement `clock.ts`**

```ts
export type Clock = { now(): number };
export function createRealClock(): Clock {
  return { now: () => performance.now() };
}
export type ManualClock = Clock & { set(ms: number): void; advance(dtMs: number): void };
export function createManualClock(startMs = 0): ManualClock {
  let t = startMs;
  return {
    now: () => t,
    set: (ms) => {
      t = ms;
    },
    advance: (dt) => {
      t += dt;
    },
  };
}
```

- [ ] **Step 5: Run to verify passes**

Run: `pir --filter @necatikcl/stripes-engine test -- run core`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/stripes-engine/src/core
git commit -m "feat(engine): injectable clock + seeded mulberry32 rng"
```

---

### Task 4: WebGL2 context + display-p3 (`gl/context.ts`)

**Files:**

- Create: `packages/stripes-engine/src/gl/context.ts`

**Interfaces:**

- Produces:
  - `type EngineContext = { gl: WebGL2RenderingContext; isP3: boolean; maxTextureSize: number }`
  - `createEngineContext(canvas: HTMLCanvasElement): EngineContext` — throws if WebGL2 is unavailable.

- [ ] **Step 1: Implement `context.ts`** (no unit test — verified by the Task 11 harness on a real GPU; happy-dom has no WebGL2)

```ts
type GlColorSpaceCtx = WebGL2RenderingContext & {
  drawingBufferColorSpace?: string;
  unpackColorSpace?: string;
};

const GL_ATTRIBUTES: WebGLContextAttributes = {
  alpha: true,
  premultipliedAlpha: true,
  antialias: false,
  depth: false,
  stencil: false,
  preserveDrawingBuffer: false,
  powerPreference: "high-performance",
};

function supportsDisplayP3(): boolean {
  if (typeof window === "undefined" || !("matchMedia" in window)) return false;
  return window.matchMedia("(color-gamut: p3)").matches;
}

export type EngineContext = { gl: WebGL2RenderingContext; isP3: boolean; maxTextureSize: number };

export function createEngineContext(canvas: HTMLCanvasElement): EngineContext {
  const gl = canvas.getContext("webgl2", GL_ATTRIBUTES);
  if (!gl) throw new Error("WebGL2 is required but not available");
  let isP3 = false;
  if (supportsDisplayP3()) {
    const ext = gl as GlColorSpaceCtx;
    if ("drawingBufferColorSpace" in gl) ext.drawingBufferColorSpace = "display-p3";
    if ("unpackColorSpace" in gl) ext.unpackColorSpace = "display-p3";
    isP3 = (ext.drawingBufferColorSpace ?? "srgb") === "display-p3";
  }
  const maxTextureSize = gl.getParameter(gl.MAX_TEXTURE_SIZE) as number;
  return { gl, isP3, maxTextureSize };
}
```

- [ ] **Step 2: Typecheck**

Run: `pir --filter @necatikcl/stripes-engine typecheck`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add packages/stripes-engine/src/gl/context.ts
git commit -m "feat(engine): webgl2 context with display-p3 buffer/unpack color space"
```

---

### Task 5: GL program + fullscreen quad helpers (`gl/program.ts`, shaders)

**Files:**

- Create: `packages/stripes-engine/src/gl/program.ts`
- Create: `packages/stripes-engine/src/shaders/fullscreen.vert.ts`

**Interfaces:**

- Produces:
  - `compileProgram(gl: WebGL2RenderingContext, vertSrc: string, fragSrc: string): WebGLProgram` — compiles both shaders, links, checks `COMPILE_STATUS`/`LINK_STATUS`, throws `Error` with the info log on any failure.
  - `createFullscreenQuad(gl: WebGL2RenderingContext): { draw(): void; dispose(): void }` — a VAO drawing one full-screen triangle (3 verts, no attributes needed beyond `gl_VertexID`).
  - `FULLSCREEN_VERT: string` — ES 3.00 vertex shader producing a fullscreen triangle from `gl_VertexID` and a `vUv` varying.

- [ ] **Step 1: Implement `shaders/fullscreen.vert.ts`**

```ts
export const FULLSCREEN_VERT = `#version 300 es
precision highp float;
out vec2 vUv;
void main() {
  // Fullscreen triangle from gl_VertexID (0,1,2)
  vec2 p = vec2((gl_VertexID == 2) ? 3.0 : -1.0, (gl_VertexID == 1) ? 3.0 : -1.0);
  vUv = (p + 1.0) * 0.5;
  gl_Position = vec4(p, 0.0, 1.0);
}
`;
```

- [ ] **Step 2: Implement `gl/program.ts`**

```ts
function compileShader(gl: WebGL2RenderingContext, type: number, src: string): WebGLShader {
  const shader = gl.createShader(type);
  if (!shader) throw new Error("Failed to create shader");
  gl.shaderSource(shader, src);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(shader);
    gl.deleteShader(shader);
    const kind = type === gl.VERTEX_SHADER ? "vertex" : "fragment";
    throw new Error(`Shader compile failed (${kind}):\n${log ?? "(no log)"}`);
  }
  return shader;
}

export function compileProgram(gl: WebGL2RenderingContext, vertSrc: string, fragSrc: string): WebGLProgram {
  const program = gl.createProgram();
  if (!program) throw new Error("Failed to create program");
  const vs = compileShader(gl, gl.VERTEX_SHADER, vertSrc);
  const fs = compileShader(gl, gl.FRAGMENT_SHADER, fragSrc);
  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  gl.linkProgram(program);
  gl.deleteShader(vs);
  gl.deleteShader(fs);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const log = gl.getProgramInfoLog(program);
    gl.deleteProgram(program);
    throw new Error(`Program link failed:\n${log ?? "(no log)"}`);
  }
  return program;
}

export function createFullscreenQuad(gl: WebGL2RenderingContext): { draw(): void; dispose(): void } {
  const vao = gl.createVertexArray();
  if (!vao) throw new Error("Failed to create VAO");
  return {
    draw() {
      gl.bindVertexArray(vao);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      gl.bindVertexArray(null);
    },
    dispose() {
      gl.deleteVertexArray(vao);
    },
  };
}
```

- [ ] **Step 3: Typecheck + commit**

Run: `pir --filter @necatikcl/stripes-engine typecheck`
Expected: PASS.

```bash
git add packages/stripes-engine/src/gl/program.ts packages/stripes-engine/src/shaders/fullscreen.vert.ts
git commit -m "feat(engine): program compile helper (throws on failure) + fullscreen quad"
```

---

### Task 6: Render targets + ping-pong (`gl/renderTarget.ts`, `gl/pingPong.ts`)

**Files:**

- Create: `packages/stripes-engine/src/gl/renderTarget.ts`, `packages/stripes-engine/src/gl/pingPong.ts`

**Interfaces:**

- Produces:
  - `type RenderTarget = { fbo: WebGLFramebuffer; texture: WebGLTexture; width: number; height: number; }`
  - `createRenderTarget(gl, width, height, opts?: { float?: boolean; linear?: boolean }): RenderTarget` — RGBA8 (or RGBA16F when `float`), `CLAMP_TO_EDGE`, `LINEAR` when `linear` else `NEAREST`.
  - `resizeRenderTarget(gl, rt, width, height): void` — reallocates the texture storage in place.
  - `disposeRenderTarget(gl, rt): void`
  - `bindRenderTarget(gl, rt | null): void` — binds FBO + sets viewport (null = default framebuffer / canvas; caller sets viewport for canvas).
  - `type PingPong = { read(): RenderTarget; write(): RenderTarget; swap(): void; resize(w, h): void; dispose(): void }`; `createPingPong(gl, width, height, opts?): PingPong`.

- [ ] **Step 1: Implement `renderTarget.ts`**

```ts
export type RenderTarget = { fbo: WebGLFramebuffer; texture: WebGLTexture; width: number; height: number };

function allocTexture(gl: WebGL2RenderingContext, tex: WebGLTexture, w: number, h: number, float: boolean) {
  gl.bindTexture(gl.TEXTURE_2D, tex);
  const internal = float ? gl.RGBA16F : gl.RGBA8;
  const type = float ? gl.HALF_FLOAT : gl.UNSIGNED_BYTE;
  gl.texImage2D(gl.TEXTURE_2D, 0, internal, w, h, 0, gl.RGBA, type, null);
}

export function createRenderTarget(
  gl: WebGL2RenderingContext,
  width: number,
  height: number,
  opts: { float?: boolean; linear?: boolean } = {},
): RenderTarget {
  const texture = gl.createTexture();
  const fbo = gl.createFramebuffer();
  if (!texture || !fbo) throw new Error("Failed to create render target");
  gl.bindTexture(gl.TEXTURE_2D, texture);
  const filter = opts.linear ? gl.LINEAR : gl.NEAREST;
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  allocTexture(gl, texture, width, height, !!opts.float);
  gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
  const status = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  if (status !== gl.FRAMEBUFFER_COMPLETE) throw new Error(`Framebuffer incomplete: 0x${status.toString(16)}`);
  return { fbo, texture, width, height, float: !!opts.float } as RenderTarget & { float: boolean };
}

export function resizeRenderTarget(gl: WebGL2RenderingContext, rt: RenderTarget, width: number, height: number): void {
  if (rt.width === width && rt.height === height) return;
  allocTexture(gl, rt.texture, width, height, (rt as RenderTarget & { float?: boolean }).float ?? false);
  rt.width = width;
  rt.height = height;
}

export function disposeRenderTarget(gl: WebGL2RenderingContext, rt: RenderTarget): void {
  gl.deleteFramebuffer(rt.fbo);
  gl.deleteTexture(rt.texture);
}

export function bindRenderTarget(gl: WebGL2RenderingContext, rt: RenderTarget | null): void {
  gl.bindFramebuffer(gl.FRAMEBUFFER, rt ? rt.fbo : null);
  if (rt) gl.viewport(0, 0, rt.width, rt.height);
}
```

Note: `RenderTarget` carries a hidden `float` flag for `resizeRenderTarget`; add `float?: boolean` to the type.

- [ ] **Step 2: Implement `pingPong.ts`**

```ts
import { type RenderTarget, createRenderTarget, resizeRenderTarget, disposeRenderTarget } from "./renderTarget";

export type PingPong = {
  read(): RenderTarget;
  write(): RenderTarget;
  swap(): void;
  resize(w: number, h: number): void;
  dispose(): void;
};

export function createPingPong(
  gl: WebGL2RenderingContext,
  width: number,
  height: number,
  opts: { float?: boolean; linear?: boolean } = {},
): PingPong {
  let a = createRenderTarget(gl, width, height, opts);
  let b = createRenderTarget(gl, width, height, opts);
  return {
    read: () => a,
    write: () => b,
    swap: () => {
      const t = a;
      a = b;
      b = t;
    },
    resize: (w, h) => {
      resizeRenderTarget(gl, a, w, h);
      resizeRenderTarget(gl, b, w, h);
    },
    dispose: () => {
      disposeRenderTarget(gl, a);
      disposeRenderTarget(gl, b);
    },
  };
}
```

- [ ] **Step 3: Typecheck + commit**

Run: `pir --filter @necatikcl/stripes-engine typecheck`
Expected: PASS.

```bash
git add packages/stripes-engine/src/gl/renderTarget.ts packages/stripes-engine/src/gl/pingPong.ts
git commit -m "feat(engine): render targets (RGBA8/16F) + ping-pong helper"
```

---

### Task 7: Field + present passes and shaders

**Files:**

- Create: `packages/stripes-engine/src/shaders/field.frag.ts`, `packages/stripes-engine/src/shaders/present.frag.ts`
- Create: `packages/stripes-engine/src/passes/fieldPass.ts`, `packages/stripes-engine/src/passes/presentPass.ts`

**Interfaces:**

- Consumes: `compileProgram`, `createFullscreenQuad`, `FULLSCREEN_VERT`, `RenderTarget`, `bindRenderTarget`.
- Produces:
  - `createFieldPass(gl, quad): { render(target: RenderTarget, timeMs: number): void; dispose(): void }` — draws a deterministic grayscale radial gradient (a stand-in source→field; Phase 1 swaps the fragment body for real adjustments+luma). Output is grayscale (white = draw).
  - `createPresentPass(gl, quad): { render(fieldTex: WebGLTexture, outWidth: number, outHeight: number): void; dispose(): void }` — samples the field texture and writes to the currently-bound framebuffer (the canvas), upscaling.

- [ ] **Step 1: Implement `shaders/field.frag.ts`** (Phase-0 stand-in — a clear, time-animated gradient so the harness has stable, non-trivial output)

```ts
export const FIELD_FRAG = `#version 300 es
precision highp float;
in vec2 vUv;
uniform float uTime;
out vec4 finalColor;
void main() {
  vec2 c = vUv - 0.5;
  float r = length(c);
  // Deterministic radial gradient with a slow time wobble; grayscale field (white = draw).
  float v = clamp(0.5 + 0.5 * cos(r * 9.0 - uTime * 0.001), 0.0, 1.0);
  finalColor = vec4(vec3(v), 1.0);
}
`;
```

- [ ] **Step 2: Implement `shaders/present.frag.ts`**

```ts
export const PRESENT_FRAG = `#version 300 es
precision highp float;
in vec2 vUv;
uniform sampler2D uField;
out vec4 finalColor;
void main() {
  finalColor = texture(uField, vUv);
}
`;
```

- [ ] **Step 3: Implement `passes/fieldPass.ts`**

```ts
import { compileProgram } from "../gl/program";
import { bindRenderTarget, type RenderTarget } from "../gl/renderTarget";
import { FULLSCREEN_VERT } from "../shaders/fullscreen.vert";
import { FIELD_FRAG } from "../shaders/field.frag";

export function createFieldPass(gl: WebGL2RenderingContext, quad: { draw(): void }) {
  const program = compileProgram(gl, FULLSCREEN_VERT, FIELD_FRAG);
  const uTime = gl.getUniformLocation(program, "uTime");
  return {
    render(target: RenderTarget, timeMs: number) {
      bindRenderTarget(gl, target);
      gl.useProgram(program);
      gl.uniform1f(uTime, timeMs);
      quad.draw();
    },
    dispose() {
      gl.deleteProgram(program);
    },
  };
}
```

- [ ] **Step 4: Implement `passes/presentPass.ts`**

```ts
import { compileProgram } from "../gl/program";
import { FULLSCREEN_VERT } from "../shaders/fullscreen.vert";
import { PRESENT_FRAG } from "../shaders/present.frag";

export function createPresentPass(gl: WebGL2RenderingContext, quad: { draw(): void }) {
  const program = compileProgram(gl, FULLSCREEN_VERT, PRESENT_FRAG);
  const uField = gl.getUniformLocation(program, "uField");
  return {
    render(fieldTex: WebGLTexture, outWidth: number, outHeight: number) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.viewport(0, 0, outWidth, outHeight);
      gl.useProgram(program);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, fieldTex);
      gl.uniform1i(uField, 0);
      quad.draw();
    },
    dispose() {
      gl.deleteProgram(program);
    },
  };
}
```

- [ ] **Step 5: Typecheck + commit**

Run: `pir --filter @necatikcl/stripes-engine typecheck`
Expected: PASS.

```bash
git add packages/stripes-engine/src/shaders/field.frag.ts packages/stripes-engine/src/shaders/present.frag.ts packages/stripes-engine/src/passes
git commit -m "feat(engine): phase-0 field (gradient) + present passes"
```

---

### Task 8: Perf instrumentation (percentiles unit-tested; GPU timer + collector)

**Files:**

- Create: `packages/stripes-engine/src/perf/percentiles.ts`, `packages/stripes-engine/src/perf/gpuTimer.ts`, `packages/stripes-engine/src/perf/perfCollector.ts`
- Test: `packages/stripes-engine/src/perf/percentiles.test.ts`, `packages/stripes-engine/src/perf/perfCollector.test.ts`

**Interfaces:**

- Produces:
  - `percentile(values: number[], p: number): number` — `p` in `[0,1]`; nearest-rank on a sorted copy; `0` for empty.
  - `type PerfSnapshot = { fps: number; frameMs: { p50: number; p95: number; p99: number }; passMs: Record<string, number>; sampleCount: number }`
  - `createPerfCollector(capacity?: number): { recordFrame(ms: number): void; recordPasses(map: Record<string, number>): void; snapshot(): PerfSnapshot; reset(): void }`
  - `type GpuTimer = { supported: boolean; begin(name: string): void; end(): void; poll(): void; latest(): Record<string, number> }`; `createGpuTimer(gl: WebGL2RenderingContext): GpuTimer` — uses `EXT_disjoint_timer_query_webgl2`; when absent, `supported=false` and all methods are no-ops returning `{}`.

- [ ] **Step 1: Write failing tests**

```ts
// percentiles.test.ts
import { describe, it, expect } from "vitest";
import { percentile } from "./percentiles";
describe("percentile", () => {
  it("nearest-rank percentiles", () => {
    const v = [10, 20, 30, 40, 50];
    expect(percentile(v, 0.5)).toBe(30);
    expect(percentile(v, 0.0)).toBe(10);
    expect(percentile(v, 1.0)).toBe(50);
  });
  it("empty → 0 and does not mutate input order", () => {
    expect(percentile([], 0.5)).toBe(0);
    const v = [3, 1, 2];
    percentile(v, 0.5);
    expect(v).toEqual([3, 1, 2]);
  });
});
```

```ts
// perfCollector.test.ts
import { describe, it, expect } from "vitest";
import { createPerfCollector } from "./perfCollector";
describe("createPerfCollector", () => {
  it("computes fps from p50 frame time and keeps pass ms", () => {
    const c = createPerfCollector(10);
    for (let i = 0; i < 10; i++) c.recordFrame(16);
    c.recordPasses({ field: 2, present: 1 });
    const s = c.snapshot();
    expect(s.frameMs.p50).toBe(16);
    expect(s.fps).toBeCloseTo(1000 / 16, 1);
    expect(s.passMs).toEqual({ field: 2, present: 1 });
    expect(s.sampleCount).toBe(10);
  });
  it("ring buffer caps samples at capacity", () => {
    const c = createPerfCollector(3);
    c.recordFrame(10);
    c.recordFrame(20);
    c.recordFrame(30);
    c.recordFrame(40);
    expect(c.snapshot().sampleCount).toBe(3);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `pir --filter @necatikcl/stripes-engine test -- run perf`
Expected: FAIL — modules not found.

- [ ] **Step 3: Implement `percentiles.ts`**

```ts
export function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const rank = Math.ceil(p * sorted.length);
  const idx = Math.min(sorted.length - 1, Math.max(0, rank - 1));
  return sorted[idx];
}
```

- [ ] **Step 4: Implement `perfCollector.ts`**

```ts
import { percentile } from "./percentiles";

export type PerfSnapshot = {
  fps: number;
  frameMs: { p50: number; p95: number; p99: number };
  passMs: Record<string, number>;
  sampleCount: number;
};

export function createPerfCollector(capacity = 240) {
  const frames: number[] = [];
  let passes: Record<string, number> = {};
  return {
    recordFrame(ms: number) {
      frames.push(ms);
      if (frames.length > capacity) frames.shift();
    },
    recordPasses(map: Record<string, number>) {
      passes = map;
    },
    reset() {
      frames.length = 0;
      passes = {};
    },
    snapshot(): PerfSnapshot {
      const p50 = percentile(frames, 0.5);
      return {
        fps: p50 > 0 ? 1000 / p50 : 0,
        frameMs: { p50, p95: percentile(frames, 0.95), p99: percentile(frames, 0.99) },
        passMs: { ...passes },
        sampleCount: frames.length,
      };
    },
  };
}
```

- [ ] **Step 5: Implement `gpuTimer.ts`** (no unit test — real-GPU only; verified in Task 11)

```ts
type TimerExt = { TIME_ELAPSED_EXT: number; GPU_DISJOINT_EXT: number };
type PendingQuery = { name: string; query: WebGLQuery };

export type GpuTimer = {
  supported: boolean;
  begin(name: string): void;
  end(): void;
  poll(): void;
  latest(): Record<string, number>;
};

export function createGpuTimer(gl: WebGL2RenderingContext): GpuTimer {
  const ext = gl.getExtension("EXT_disjoint_timer_query_webgl2") as TimerExt | null;
  if (!ext) {
    return { supported: false, begin() {}, end() {}, poll() {}, latest: () => ({}) };
  }
  const pending: PendingQuery[] = [];
  const results: Record<string, number> = {};
  let active: PendingQuery | null = null;
  return {
    supported: true,
    begin(name: string) {
      const query = gl.createQuery();
      if (!query) return;
      active = { name, query };
      gl.beginQuery(ext.TIME_ELAPSED_EXT, query);
    },
    end() {
      if (!active) return;
      gl.endQuery(ext.TIME_ELAPSED_EXT);
      pending.push(active);
      active = null;
    },
    poll() {
      const disjoint = gl.getParameter(ext.GPU_DISJOINT_EXT);
      for (let i = pending.length - 1; i >= 0; i--) {
        const q = pending[i];
        const available = gl.getQueryParameter(q.query, gl.QUERY_RESULT_AVAILABLE);
        if (available || disjoint) {
          if (available && !disjoint) {
            const ns = gl.getQueryParameter(q.query, gl.QUERY_RESULT) as number;
            results[q.name] = ns / 1e6; // ns → ms
          }
          gl.deleteQuery(q.query);
          pending.splice(i, 1);
        }
      }
    },
    latest: () => ({ ...results }),
  };
}
```

- [ ] **Step 6: Run to verify passes + commit**

Run: `pir --filter @necatikcl/stripes-engine test -- run perf`
Expected: PASS (percentiles + collector).

```bash
git add packages/stripes-engine/src/perf
git commit -m "feat(engine): perf collector (frame percentiles) + gpu timer wrapper"
```

---

### Task 9: The engine — pass graph, render loop, resize, context-loss recovery

**Files:**

- Create: `packages/stripes-engine/src/engine.ts`
- Modify: `packages/stripes-engine/src/index.ts` (export the public surface)

**Interfaces:**

- Consumes: everything from Tasks 2–8.
- Produces:
  - `type EngineOptions = { clock?: Clock; seed?: number; dpr?: number; fieldScale?: number }`
  - `type StripesEngine = { resize(cssWidth: number, cssHeight: number): void; renderFrame(): void; start(): void; stop(): void; setFieldScale(s: number): void; readOutputPixels(): Uint8Array; getPerf(): PerfSnapshot; dispose(): void; readonly isP3: boolean }`
  - `createStripesEngine(canvas: HTMLCanvasElement, opts?: EngineOptions): StripesEngine`
- `index.ts` re-exports `createStripesEngine`, the types, `createManualClock`, `createRealClock`, `createSeededRng`.

- [ ] **Step 1: Implement `engine.ts`**

```ts
import { type Clock, createRealClock } from "./core/clock";
import { createEngineContext } from "./gl/context";
import { createFullscreenQuad } from "./gl/program";
import { type RenderTarget, createRenderTarget, resizeRenderTarget, disposeRenderTarget } from "./gl/renderTarget";
import { resolveOutputSize, resolveFieldSize, type Size } from "./gl/resolution";
import { createFieldPass } from "./passes/fieldPass";
import { createPresentPass } from "./passes/presentPass";
import { createGpuTimer } from "./perf/gpuTimer";
import { createPerfCollector, type PerfSnapshot } from "./perf/perfCollector";

export type EngineOptions = { clock?: Clock; seed?: number; dpr?: number; fieldScale?: number };
export type StripesEngine = {
  resize(cssWidth: number, cssHeight: number): void;
  renderFrame(): void;
  start(): void;
  stop(): void;
  setFieldScale(s: number): void;
  readOutputPixels(): Uint8Array;
  getPerf(): PerfSnapshot;
  dispose(): void;
  readonly isP3: boolean;
};

export function createStripesEngine(canvas: HTMLCanvasElement, opts: EngineOptions = {}): StripesEngine {
  const clock = opts.clock ?? createRealClock();
  let fieldScale = opts.fieldScale ?? 0.5;
  let cssW = canvas.clientWidth || 800;
  let cssH = canvas.clientHeight || 600;

  let { gl, isP3, maxTextureSize } = createEngineContext(canvas);
  let output: Size = { width: 0, height: 0 };

  let quad = createFullscreenQuad(gl);
  let fieldPass = createFieldPass(gl, quad);
  let presentPass = createPresentPass(gl, quad);
  let fieldRT: RenderTarget = createRenderTarget(gl, 2, 2, { linear: true });
  let gpuTimer = createGpuTimer(gl);
  const perf = createPerfCollector();

  let rafId = 0;
  let lastFrameStart = clock.now();
  let lost = false;

  function applySizes() {
    const dpr = opts.dpr ?? (typeof window !== "undefined" ? window.devicePixelRatio : 1) ?? 1;
    output = resolveOutputSize(cssW, cssH, dpr, maxTextureSize);
    canvas.width = output.width;
    canvas.height = output.height;
    const field = resolveFieldSize(output, fieldScale);
    resizeRenderTarget(gl, fieldRT, field.width, field.height);
  }

  function rebuildGpuResources() {
    // Called after context restore: recreate everything tied to the GL context.
    const ctx = createEngineContext(canvas);
    gl = ctx.gl;
    isP3 = ctx.isP3;
    maxTextureSize = ctx.maxTextureSize;
    quad = createFullscreenQuad(gl);
    fieldPass = createFieldPass(gl, quad);
    presentPass = createPresentPass(gl, quad);
    fieldRT = createRenderTarget(gl, 2, 2, { linear: true });
    gpuTimer = createGpuTimer(gl);
    applySizes();
  }

  function onLost(e: Event) {
    e.preventDefault();
    lost = true;
  }
  function onRestored() {
    lost = false;
    rebuildGpuResources();
  }
  canvas.addEventListener("webglcontextlost", onLost as EventListener, false);
  canvas.addEventListener("webglcontextrestored", onRestored as EventListener, false);

  applySizes();

  function renderFrame() {
    if (lost) return;
    const t0 = clock.now();
    gpuTimer.poll();
    const time = clock.now();

    gpuTimer.begin("field");
    fieldPass.render(fieldRT, time);
    gpuTimer.end();

    gpuTimer.begin("present");
    presentPass.render(fieldRT.texture, output.width, output.height);
    gpuTimer.end();

    gl.flush();
    const frameMs = clock.now() - lastFrameStart;
    lastFrameStart = t0;
    perf.recordFrame(frameMs);
    perf.recordPasses(gpuTimer.latest());
  }

  function loop() {
    renderFrame();
    rafId = requestAnimationFrame(loop);
  }

  return {
    get isP3() {
      return isP3;
    },
    resize(w, h) {
      cssW = w;
      cssH = h;
      applySizes();
    },
    setFieldScale(s) {
      fieldScale = s;
      applySizes();
    },
    renderFrame,
    start() {
      if (!rafId) {
        lastFrameStart = clock.now();
        rafId = requestAnimationFrame(loop);
      }
    },
    stop() {
      if (rafId) {
        cancelAnimationFrame(rafId);
        rafId = 0;
      }
    },
    readOutputPixels() {
      const px = new Uint8Array(output.width * output.height * 4);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.readPixels(0, 0, output.width, output.height, gl.RGBA, gl.UNSIGNED_BYTE, px);
      return px;
    },
    getPerf() {
      return perf.snapshot();
    },
    dispose() {
      this.stop();
      canvas.removeEventListener("webglcontextlost", onLost as EventListener);
      canvas.removeEventListener("webglcontextrestored", onRestored as EventListener);
      fieldPass.dispose();
      presentPass.dispose();
      quad.dispose();
      disposeRenderTarget(gl, fieldRT);
    },
  };
}
```

- [ ] **Step 2: Update `index.ts`**

```ts
export const ENGINE_PACKAGE = "@necatikcl/stripes-engine";
export { createStripesEngine } from "./engine";
export type { StripesEngine, EngineOptions } from "./engine";
export type { PerfSnapshot } from "./perf/perfCollector";
export { createRealClock, createManualClock } from "./core/clock";
export type { Clock, ManualClock } from "./core/clock";
export { createSeededRng } from "./core/rng";
```

- [ ] **Step 3: Typecheck + commit**

Run: `pir --filter @necatikcl/stripes-engine typecheck`
Expected: PASS.

```bash
git add packages/stripes-engine/src/engine.ts packages/stripes-engine/src/index.ts
git commit -m "feat(engine): pass-graph engine — render loop, resize, context-loss recovery"
```

---

### Task 10: Lab app — mount the engine, rAF loop, perf overlay, test hooks

**Files:**

- Create: `apps/lab/src/PerfOverlay.tsx`
- Modify: `apps/lab/src/LabApp.tsx`

**Interfaces:**

- Consumes: `createStripesEngine`, `createManualClock`, `PerfSnapshot`.
- Produces: a page that mounts a full-window canvas, runs the engine, and renders `<PerfOverlay/>`. Reads URL params for deterministic test control and exposes `window.__lab` for Playwright:
  - `?manual=1` → use a `ManualClock`; do NOT auto-start the rAF loop.
  - `?seed=<int>`, `?dpr=<float>`, `?fieldScale=<float>`, `?w=<cssPx>`, `?h=<cssPx>`.
  - `window.__lab = { engine, clock, renderAt(ms): void, snapshot(): PerfSnapshot }`.

- [ ] **Step 1: Implement `PerfOverlay.tsx`**

```tsx
import type { PerfSnapshot } from "@necatikcl/stripes-engine";

export function PerfOverlay({ snap }: { snap: PerfSnapshot }) {
  return (
    <div
      style={{
        position: "fixed",
        top: 8,
        left: 8,
        padding: "8px 10px",
        borderRadius: 6,
        background: "rgba(0,0,0,0.6)",
        color: "#0f0",
        font: "12px ui-monospace, monospace",
        whiteSpace: "pre",
        pointerEvents: "none",
      }}
    >
      {`fps      ${snap.fps.toFixed(1)}
frame ms p50 ${snap.frameMs.p50.toFixed(2)}  p95 ${snap.frameMs.p95.toFixed(2)}  p99 ${snap.frameMs.p99.toFixed(2)}
gpu ms   ${
        Object.entries(snap.passMs)
          .map(([k, v]) => `${k} ${v.toFixed(2)}`)
          .join("  ") || "(timer unsupported)"
      }
samples  ${snap.sampleCount}`}
    </div>
  );
}
```

- [ ] **Step 2: Implement `LabApp.tsx`**

```tsx
import { useEffect, useRef, useState } from "react";
import {
  createStripesEngine,
  createManualClock,
  createRealClock,
  type StripesEngine,
  type PerfSnapshot,
} from "@necatikcl/stripes-engine";
import { PerfOverlay } from "./PerfOverlay";

function num(params: URLSearchParams, key: string, dflt: number): number {
  const v = params.get(key);
  return v == null ? dflt : Number(v);
}

export function LabApp() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [snap, setSnap] = useState<PerfSnapshot>({
    fps: 0,
    frameMs: { p50: 0, p95: 0, p99: 0 },
    passMs: {},
    sampleCount: 0,
  });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const params = new URLSearchParams(window.location.search);
    const manual = params.get("manual") === "1";
    const clock = manual ? createManualClock(0) : createRealClock();
    const cssW = num(params, "w", window.innerWidth);
    const cssH = num(params, "h", window.innerHeight);
    canvas.style.width = `${cssW}px`;
    canvas.style.height = `${cssH}px`;

    const engine: StripesEngine = createStripesEngine(canvas, {
      clock,
      seed: num(params, "seed", 1),
      dpr: params.has("dpr") ? num(params, "dpr", 1) : undefined,
      fieldScale: params.has("fieldScale") ? num(params, "fieldScale", 0.5) : undefined,
    });
    engine.resize(cssW, cssH);

    (window as unknown as { __lab: unknown }).__lab = {
      engine,
      clock,
      renderAt: (ms: number) => {
        if (manual && "set" in clock) (clock as { set(n: number): void }).set(ms);
        engine.renderFrame();
      },
      snapshot: () => engine.getPerf(),
    };

    let raf = 0;
    if (!manual) {
      engine.start();
      const tick = () => {
        setSnap(engine.getPerf());
        raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    } else {
      engine.renderFrame();
      setSnap(engine.getPerf());
    }
    return () => {
      if (raf) cancelAnimationFrame(raf);
      engine.dispose();
    };
  }, []);

  return (
    <>
      <canvas ref={canvasRef} style={{ display: "block" }} />
      <PerfOverlay snap={snap} />
    </>
  );
}
```

- [ ] **Step 3: Build the lab to verify it compiles + wires the engine**

Run: `pir --filter lab build`
Expected: build succeeds (engine imported, no type errors).

- [ ] **Step 4: Manual smoke (optional, requires the user's browser)**

The user runs `pir --filter lab dev` and opens `http://localhost:5174` → expect a grayscale radial gradient filling the window and the perf overlay showing ~60fps. (Per the workspace dev-server rule, do not auto-start a competing dev server; ask the user to run it, or rely on the Playwright gate in Task 11.)

- [ ] **Step 5: Commit**

```bash
git add apps/lab/src
git commit -m "feat(lab): mount engine on canvas with perf overlay + deterministic test hooks"
```

---

### Task 11: Playwright harness — 4K@60 perf gate + visual golden

**Files:**

- Create: `playwright.config.ts`, `tests/perf.spec.ts`, `tests/visual.spec.ts`
- Modify: root `package.json` (add `test:e2e` script + Playwright devDep)

**Interfaces:**

- Consumes: the lab app served at a Playwright-managed preview URL; `window.__lab` hooks.
- Produces: `pir test:e2e` runs both specs. Perf spec measures real rAF frames at 4K and asserts the 60fps budget when a GPU timer is available (skips the hard assertion on software renderers, still logging numbers). Visual spec drives the manual clock and snapshots the canvas.

- [ ] **Step 1: Add Playwright**

Run: `pi add -D @playwright/test -w`
Then: `pir exec playwright install chromium`
Expected: Playwright + Chromium installed at the workspace root.

- [ ] **Step 2: Add the root script** to `package.json`

```json
"test:e2e": "playwright test"
```

- [ ] **Step 3: Create `playwright.config.ts`**

```ts
import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  timeout: 60_000,
  webServer: {
    command: "pnpm --filter lab dev --port 5174 --strictPort",
    url: "http://localhost:5174",
    reuseExistingServer: true,
    timeout: 60_000,
  },
  use: {
    baseURL: "http://localhost:5174",
    launchOptions: {
      // Force a real GPU path in headless Chromium (ANGLE). On GPU-less CI this
      // falls back to SwiftShader; the perf spec detects that and soft-skips.
      args: ["--use-gl=angle", "--use-angle=default", "--ignore-gpu-blocklist", "--enable-gpu"],
    },
  },
});
```

Note: `webServer.command` uses `pnpm --filter` directly because Playwright spawns it; this is Playwright's own ephemeral preview server on port 5174 (not a competing dev server for the user's workflow — it is torn down after the run). `reuseExistingServer: true` attaches to the user's lab dev server if they already have one on 5174.

- [ ] **Step 4: Create `tests/visual.spec.ts`**

```ts
import { test, expect } from "@playwright/test";

test("field renders deterministically at a fixed seed/clock/dpr", async ({ page }) => {
  await page.goto("/?manual=1&seed=1&dpr=2&w=400&h=300");
  await page.waitForFunction(() => (window as any).__lab !== undefined);
  await page.evaluate(() => (window as any).__lab.renderAt(0));
  const canvas = page.locator("canvas");
  // Built-in screenshot comparison; first run writes the golden, later runs diff it.
  await expect(canvas).toHaveScreenshot("field-seed1-t0.png", { maxDiffPixelRatio: 0.01 });
});
```

- [ ] **Step 5: Create `tests/perf.spec.ts`**

```ts
import { test, expect } from "@playwright/test";

test("renders 4K within the 60fps budget", async ({ page }) => {
  // 3840×2160 css @ dpr 1 = true 4K backing store.
  await page.goto("/?seed=1&dpr=1&w=3840&h=2160");
  await page.waitForFunction(() => (window as any).__lab !== undefined);
  await page.bringToFront();
  // Warm up, then sample ~2s of real rAF frames.
  await page.waitForTimeout(2500);
  const snap = await page.evaluate(() => (window as any).__lab.snapshot());
  console.log("perf @4K:", JSON.stringify(snap));
  expect(snap.sampleCount).toBeGreaterThan(30);
  const gpuTimed = Object.keys(snap.passMs).length > 0;
  if (gpuTimed) {
    expect(snap.frameMs.p50).toBeLessThanOrEqual(16.6);
  } else {
    test
      .info()
      .annotations.push({ type: "warn", description: "No GPU timer (software renderer?) — perf budget not enforced" });
  }
});
```

- [ ] **Step 6: Run the e2e gate**

Run: `pir test:e2e`
Expected: visual spec writes/matches `field-seed1-t0.png`; perf spec logs the 4K snapshot and passes (asserts ≤16.6ms p50 on a real GPU, soft-skips on software). If the visual golden is the first run, Playwright creates it — review the PNG, then re-run to confirm it matches.

- [ ] **Step 7: Commit**

```bash
git add playwright.config.ts tests package.json pnpm-lock.yaml tests/**/*-snapshots/** 2>/dev/null || git add playwright.config.ts tests package.json pnpm-lock.yaml
git commit -m "test(engine): playwright 4K@60 perf gate + deterministic visual golden"
```

---

### Task 12: AI-rules / docs / memory reset

**Files:**

- Create: `docs/engine-architecture.md`, `docs/legacy/` (destination)
- Move: `docs/{ai-context,grid-rulebook,implementation-plan,pixi,icon-box-pixi-caching,render-pipeline-architecture}.md` → `docs/legacy/`
- Move: `.cursor/rules/*.mdc`, `.cursor/skills/`, `.cursor/commands/` → `.cursor/legacy/`
- Rewrite: `AGENTS.md`
- Modify (outside repo): the user's memory files (absolute paths below)

**Interfaces:** none (docs/rules only).

- [ ] **Step 1: Quarantine the old docs (they describe the dead Pixi/CPU engine)**

```bash
cd /Users/necatikcl/Documents/code/cloudflare/section-grid-generator
mkdir -p docs/legacy
git mv docs/ai-context.md docs/legacy/ai-context.md
git mv docs/grid-rulebook.md docs/legacy/grid-rulebook.md
git mv docs/implementation-plan.md docs/legacy/implementation-plan.md
git mv docs/pixi.md docs/legacy/pixi.md
git mv docs/icon-box-pixi-caching.md docs/legacy/icon-box-pixi-caching.md
git mv docs/render-pipeline-architecture.md docs/legacy/render-pipeline-architecture.md
```

- [ ] **Step 2: Quarantine the old `.cursor` rules/skills/commands**

```bash
mkdir -p .cursor/legacy
git mv .cursor/rules .cursor/legacy/rules
git mv .cursor/skills .cursor/legacy/skills
git mv .cursor/commands .cursor/legacy/commands
```

- [ ] **Step 3: Write `docs/engine-architecture.md`** (concise pointer to the spec + the live invariants)

```markdown
# Engine architecture (GPU-first rewrite)

The active engine is `packages/stripes-engine` (raw WebGL2, GLSL ES 3.00, no Pixi),
exercised by `apps/lab`. Design + phase roadmap: `docs/superpowers/specs/2026-06-22-gpu-engine-rewrite-design.md`.

## Invariants

- **Field-first.** One grayscale render field (white = draw a stripe). Every effect is a
  field→field GPU pass. Stripes are a pure terminal post-process; stripes-off shows the field.
- **GPU-first.** No CPU pixel sampling on the hot path. CPU only orchestrates + does one-shot
  export readbacks + glyph-atlas bake.
- **WebGL2 only.** ES 3.00 shaders; MRT / float RTs / instancing allowed. No WebGL1 path.
- **Resolution.** Output = CSS × DPR (clamped to MAX_TEXTURE_SIZE). Field passes at `fieldScale`
  (0.5×). Stripes + letters at full DPR.
- **Determinism.** Engine takes an injectable clock + seed; visual goldens depend on it.
- **No silent shader failures.** `compileProgram` throws with the info log.

## Legacy

The previous Pixi/CPU engine lives in `apps/studio` + `packages/stripes-shader` and remains the
shipping product until the Phase 9 cutover. Its docs are in `docs/legacy/`; its old agent rules in
`.cursor/legacy/`. Do not follow `docs/legacy/` for new-engine work.
```

- [ ] **Step 4: Rewrite `AGENTS.md`**

Replace contents with a short orientation: monorepo has TWO engines during the rewrite — the **live product** (`apps/studio` + `packages/stripes-shader`, Pixi/CPU, see `docs/legacy/`) and the **active build** (`packages/stripes-engine` + `apps/lab`, WebGL2/GPU-first, see `docs/engine-architecture.md` + the spec). State: package manager is `pi`/`pir`; verify with `pir --filter @necatikcl/stripes-engine typecheck`, `pir test`, and `pir test:e2e`; new-engine work follows `docs/engine-architecture.md`, NOT `docs/legacy/`.

- [ ] **Step 5: Correct the stale WebGL1 memory** (absolute path; the live shaders are ES 3.00 / WebGL2)

Overwrite `/Users/necatikcl/.claude/projects/-Users-necatikcl-Documents-code-cloudflare-section-grid-generator/memory/webgl1-shader-compat.md`:

```markdown
---
name: webgl1-shader-compat
description: Engine runtime floor is WebGL2 / GLSL ES 3.00 — NOT WebGL1
metadata:
  type: project
---

The stripes engine targets **WebGL2 / GLSL ES 3.00 only** (decided 2026-06-22 for the GPU-first
rewrite; the existing shaders were already ES 3.00 — `texture()`/`finalColor`/`in`/`out` — so the
old "WebGL1 fallback" could never have compiled and was dead). MRT, float/half-float render
targets, dynamic loops, and instancing are all available and used. Shaders begin `#version 300 es`.
`compileProgram` must check COMPILE/LINK status and throw — a failed compile must never silently
blank the canvas. See [[pipeline-field-first-gpu-first]] and the rewrite spec.
```

- [ ] **Step 6: Update the memory index line**

In `/Users/necatikcl/.claude/projects/-Users-necatikcl-Documents-code-cloudflare-section-grid-generator/memory/MEMORY.md`, replace the `webgl1-shader-compat` line with:

```markdown
- [WebGL2/ES 3.00 floor](webgl1-shader-compat.md) — engine runtime is WebGL2 only (not WebGL1); MRT/float RTs/instancing available; shaders #version 300 es; compile must throw on failure
```

- [ ] **Step 7: Verify nothing in the live build referenced the moved docs**

Run: `grep -rn "docs/ai-context\|docs/render-pipeline-architecture\|docs/grid-rulebook\|docs/pixi\b\|docs/implementation-plan\|\.cursor/rules" --include="*.ts" --include="*.tsx" --include="*.md" --include="*.json" apps packages AGENTS.md README.md | grep -v docs/legacy | grep -v docs/superpowers`
Expected: no stale references (or update any that appear — e.g. README/AGENTS links → `docs/legacy/...`).

- [ ] **Step 8: Commit**

```bash
git add -A docs .cursor AGENTS.md
git commit -m "docs(engine): reset AI rules — quarantine legacy docs/.cursor, add engine-architecture, rewrite AGENTS"
```

---

## Self-Review

**1. Spec coverage** (against `docs/superpowers/specs/2026-06-22-gpu-engine-rewrite-design.md`, Phase 0 row + foundations):

- New `packages/stripes-engine` + `apps/lab` scaffold → Task 1 ✓
- WebGL2 context (DPR + p3) → Task 4 ✓; DPR/clamp math → Task 2 ✓
- Resolution arch (output DPR, fieldScale, full-res present) → Tasks 2, 7, 9 ✓
- Pass-graph skeleton (field + present, named timed passes) → Tasks 7, 9 ✓
- Determinism (injectable clock + seed) → Tasks 3, 9, 10 ✓
- Perf harness (fps/p50-p95-p99 + per-pass GPU ms + overlay) → Tasks 8, 10 ✓
- Perf gate (4K@60, soft-skip on software) → Task 11 ✓
- Visual golden harness (fixed seed/clock/dpr) → Task 11 ✓
- Context-loss recovery designed in → Task 9 ✓
- AI-rules/docs/memory reset → Task 12 ✓
- `no silent shader failures` constraint → Task 5 (`compileProgram` throws) ✓
- Data textures as raw buffers (not canvases) → no data textures yet in Phase 0; constraint recorded for Phase 6+ ✓ (noted, no Phase 0 task needed)

**2. Placeholder scan:** No "TBD/TODO/handle edge cases" — every code step has complete code; every command has expected output. ✓

**3. Type consistency:** `Size`, `RenderTarget` (+ hidden `float`), `Clock`/`ManualClock`, `PerfSnapshot`, `StripesEngine`/`EngineOptions`, `GpuTimer`, the `window.__lab` shape, and pass factory signatures (`createFieldPass(gl, quad)`, `createPresentPass(gl, quad)`, `presentPass.render(tex, w, h)`) are consistent across Tasks 2–11. ✓

**Note for the executor:** Tasks 1, 4, 5, 6, 7, 9, 10 are GL/scaffolding and are gated by `typecheck` + the Task 11 Playwright harness rather than unit tests (happy-dom has no WebGL2). Tasks 2, 3, 8 are pure logic and use proper TDD. This ordering is deliberate: the harness (Task 11) is the real gate for the GPU code, which is the whole point of Phase 0.
