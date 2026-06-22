# Phase 1a — Source → field (b/w field visible) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upload an image/video to a GPU texture and derive the black/white render field from it (source transform + the full adjustment chain + rec709 luminance + overlay invert), shown on screen — establishing the fresh engine config and a managed pass pipeline along the way.

**Architecture:** First refactor the Phase-0 engine's hardcoded `field→present` into an ordered **pass pipeline** + a **managed RT pool** (behavior-preserving). Then add a fresh `EngineConfig` (pure, normalized), a source loader/uploader (image once, video per-frame, Y-flipped), and a `sourceField` GPU pass that maps the source through transform + adjustments + luma + overlay into the grayscale field. The lab gets Leva controls + a baked test image; visual goldens capture the field for luminance + overlay.

**Tech Stack:** TypeScript, raw WebGL2 (GLSL ES 3.00), the Phase-0 `gl/` + `perf/` + `core/` modules, React 19 + Leva (lab), Vitest (pure logic), Playwright (perf + visual goldens). pnpm via `pi`/`pir`.

## Global Constraints

- **Package manager:** `pi` (install), `pi add <pkg> [-D]` (dep), `pir <script>` (run). NEVER npm/pnpm/yarn/npx directly.
- **GL floor:** WebGL2 / GLSL ES 3.00 only. Shaders begin `#version 300 es`; `in/out/texture()/finalColor`; no `texture2D`/`gl_FragColor`. `compileProgram` throws on failure (never silent-blank).
- **Resolution:** output = CSS×DPR (clamped to MAX_TEXTURE_SIZE); field passes at `fieldScale` (default 0.5); present at full DPR. (Unchanged from Phase 0.)
- **Orientation:** upload source textures with `UNPACK_FLIP_Y_WEBGL = true` so the field/screen/readback share one top-down convention.
- **Color:** display-p3 context; data textures (none yet in 1a) are raw buffers, not canvases.
- **Config:** fresh `EngineConfig` (Phase-1 subset). Numeric `0xRRGGBB` colors. Each sub-config has a pure `normalize*` + `DEFAULT_*`. The media source is passed to the engine separately, NOT in config.
- **Adjustment chain order (in the field shader):** blur/sharpen → levels (black/white point) → gamma → exposure → contrast → brightness+thresholdBias → invert → posterize → noise → rec709 luma → overlay-invert.
- **Determinism:** engine takes an injectable clock + seed; goldens use a fixed clock + seed + DPR + the baked test image.
- **Scope guard:** do NOT touch `apps/studio` or `packages/stripes-shader`. Stripes/grid CONFIG is defined here but only RENDERED in Phase 1b.
- **Commit style:** Conventional commits, scope `engine`/`lab`. Husky precommit runs oxfmt/oxlint on staged files — let it.
- **Verify:** `pir verify` (typecheck all 3 packages + 393+ unit tests + studio build) and `pir test:e2e` (perf gate + visual goldens) must stay green.

## File Structure

```
packages/stripes-engine/src/
  config/
    types.ts        EngineConfig + sub-config types (Fit, FieldMode, Stripe, Transform, Adjustments, FieldConfig, Background, Grid)
    normalize.ts    DEFAULT_* + normalize* for every sub-config + normalizeEngineConfig + DEFAULT_ENGINE_CONFIG
    serialize.ts    serializeEngineConfig / parseEngineConfig (JSON round-trip)
  pipeline/
    rtPool.ts       createRtPool(gl): keyed allocate/resize/reuse of RenderTargets
    pipeline.ts     Pass type + runPipeline(passes, gpuTimer)
  source/
    sourceTexture.ts  createSourceTexture(gl, media): upload (image once / video per-frame), Y-flip, dispose
    fit.ts            resolveSourceRect(...) pure fit/zoom/pan → source UV sub-rect
  passes/
    sourceFieldPass.ts  the source→field pass (consumes config uniforms + source texture)
    (fieldPass.ts removed — replaced by sourceFieldPass; presentPass.ts kept)
  shaders/
    sourceField.frag.ts  ES 3.00 adjustment-chain + luma + overlay shader
  engine.ts         extended: setSource(media), setConfig(EngineConfig); pipeline-driven
  index.ts          export config + engine surface additions
apps/lab/src/
  testImage.ts      baked deterministic source (procedural canvas → ImageBitmap/HTMLCanvas)
  controls/levaSchema.ts  Leva controls → EngineConfig (transform/adjustments/field/background)
  LabApp.tsx        wire Leva + source picker (baked image default + file upload) + engine.setConfig/setSource
tests/
  visual.spec.ts    replace gradient golden with field goldens (luminance + overlay) on the baked image
  perf.spec.ts      unchanged params; now renders the real source→field chain
```

---

### Task 1: Config — types + simple normalizers (transform, field, background, grid)

**Files:**

- Create: `packages/stripes-engine/src/config/types.ts`, `packages/stripes-engine/src/config/normalize.ts`
- Test: `packages/stripes-engine/src/config/normalize.test.ts`

**Interfaces:**

- Produces (types): `Fit = "stretch"|"contain"|"cover"`; `FieldMode = "luminance"|"overlay"`; `Stripe = { color: number; startFrom: number; width: number }`; `Transform = { fit: Fit; zoom: number; panX: number; panY: number }`; `Adjustments = { brightness; exposure; contrast; blackPoint; whitePoint; gamma: number; invert: boolean; posterizeLevels; thresholdBias; noiseAmount; blurRadius; sharpenAmount: number }`; `FieldConfig = { mode: FieldMode }`; `Background = { color: number }`; `Grid = { cellWidth; cellHeight; gapX; gapY; cornerRadius: number; orientation: "vertical"|"horizontal" }`; `EngineConfig = { transform: Transform; adjustments: Adjustments; field: FieldConfig; background: Background; grid: Grid; stripes: Stripe[]; overlayStripes: Stripe[]; stripesEnabled: boolean }`.
- Produces (normalizers in normalize.ts): `DEFAULT_TRANSFORM`, `normalizeTransform(i?: Partial<Transform>): Transform`; `DEFAULT_FIELD`, `normalizeField`; `DEFAULT_BACKGROUND`, `normalizeBackground`; `DEFAULT_GRID`, `normalizeGrid`. Clamp helper `clamp(v,min,max)`.

- [ ] **Step 1: Write `config/types.ts`** (all types listed above; no logic). Then write the failing test:

```ts
// normalize.test.ts
import { describe, it, expect } from "vitest";
import {
  normalizeTransform,
  normalizeField,
  normalizeBackground,
  normalizeGrid,
  DEFAULT_TRANSFORM,
  DEFAULT_GRID,
} from "./normalize";

describe("simple normalizers", () => {
  it("transform clamps zoom and defaults missing fields", () => {
    expect(normalizeTransform({})).toEqual(DEFAULT_TRANSFORM);
    expect(normalizeTransform({ zoom: 0 }).zoom).toBe(0.1); // min 0.1
    expect(normalizeTransform({ zoom: 99 }).zoom).toBe(8); // max 8
    expect(normalizeTransform({ panX: -5 }).panX).toBe(-1); // min -1
    expect(normalizeTransform({ fit: "cover" }).fit).toBe("cover");
    expect(normalizeTransform({ fit: "bogus" as any }).fit).toBe("stretch"); // invalid → default
  });
  it("field defaults to luminance and rejects invalid mode", () => {
    expect(normalizeField({}).mode).toBe("luminance");
    expect(normalizeField({ mode: "overlay" }).mode).toBe("overlay");
    expect(normalizeField({ mode: "colors" as any }).mode).toBe("luminance");
  });
  it("background coerces to a 24-bit int", () => {
    expect(normalizeBackground({ color: 0xff8833 }).color).toBe(0xff8833);
    expect(normalizeBackground({}).color).toBe(0x000000);
    expect(normalizeBackground({ color: -1 }).color).toBe(0x000000); // clamp ≥ 0
    expect(normalizeBackground({ color: 0x1ffffff }).color).toBe(0xffffff); // clamp ≤ 0xffffff
  });
  it("grid clamps sizes and gaps", () => {
    expect(normalizeGrid({})).toEqual(DEFAULT_GRID);
    expect(normalizeGrid({ cellWidth: 0 }).cellWidth).toBe(1); // min 1
    expect(normalizeGrid({ cellWidth: 999 }).cellWidth).toBe(64); // max 64
    expect(normalizeGrid({ cellWidth: 10, gapX: 20 }).gapX).toBe(10); // gap ≤ cellWidth
    expect(normalizeGrid({ orientation: "horizontal" }).orientation).toBe("horizontal");
  });
});
```

- [ ] **Step 2: Run to verify fail**

Run: `pir test -- run config/normalize`
Expected: FAIL — `normalize.ts` not found.

- [ ] **Step 3: Implement `config/normalize.ts`** (the four simple normalizers)

```ts
import type { Transform, FieldConfig, Background, Grid } from "./types";

export function clamp(v: number, min: number, max: number): number {
  return v < min ? min : v > max ? max : v;
}
const num = (v: unknown, dflt: number): number => (typeof v === "number" && Number.isFinite(v) ? v : dflt);

export const DEFAULT_TRANSFORM: Transform = { fit: "stretch", zoom: 1, panX: 0, panY: 0 };
export function normalizeTransform(i: Partial<Transform> = {}): Transform {
  const fit = i.fit === "contain" || i.fit === "cover" || i.fit === "stretch" ? i.fit : "stretch";
  return {
    fit,
    zoom: clamp(num(i.zoom, 1), 0.1, 8),
    panX: clamp(num(i.panX, 0), -1, 1),
    panY: clamp(num(i.panY, 0), -1, 1),
  };
}

export const DEFAULT_FIELD: FieldConfig = { mode: "luminance" };
export function normalizeField(i: Partial<FieldConfig> = {}): FieldConfig {
  return { mode: i.mode === "overlay" ? "overlay" : "luminance" };
}

export const DEFAULT_BACKGROUND: Background = { color: 0x000000 };
export function normalizeBackground(i: Partial<Background> = {}): Background {
  return { color: Math.round(clamp(num(i.color, 0), 0, 0xffffff)) };
}

export const DEFAULT_GRID: Grid = {
  cellWidth: 7,
  cellHeight: 7,
  gapX: 0,
  gapY: 0,
  cornerRadius: 0,
  orientation: "vertical",
};
export function normalizeGrid(i: Partial<Grid> = {}): Grid {
  const cellWidth = clamp(Math.round(num(i.cellWidth, 7)), 1, 64);
  const cellHeight = clamp(Math.round(num(i.cellHeight, 7)), 1, 64);
  return {
    cellWidth,
    cellHeight,
    gapX: clamp(num(i.gapX, 0), 0, cellWidth),
    gapY: clamp(num(i.gapY, 0), 0, cellHeight),
    cornerRadius: clamp(num(i.cornerRadius, 0), 0, Math.max(cellWidth, cellHeight)),
    orientation: i.orientation === "horizontal" ? "horizontal" : "vertical",
  };
}
```

- [ ] **Step 4: Run to verify pass**

Run: `pir test -- run config/normalize`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/stripes-engine/src/config/types.ts packages/stripes-engine/src/config/normalize.ts packages/stripes-engine/src/config/normalize.test.ts
git commit -m "feat(engine): config types + transform/field/background/grid normalizers"
```

---

### Task 2: Config — adjustments + stripes normalizers

**Files:**

- Modify: `packages/stripes-engine/src/config/normalize.ts`
- Modify: `packages/stripes-engine/src/config/normalize.test.ts`

**Interfaces:**

- Consumes: `clamp`, `num`, types from Task 1.
- Produces: `DEFAULT_ADJUSTMENTS`, `normalizeAdjustments(i?: Partial<Adjustments>): Adjustments`; `DEFAULT_STRIPES: Stripe[]`, `DEFAULT_OVERLAY_STRIPES: Stripe[]`, `normalizeStripe(i: Partial<Stripe>): Stripe`, `normalizeStripes(i: Partial<Stripe>[] | undefined, fallback: Stripe[]): Stripe[]`.

- [ ] **Step 1: Add failing tests**

```ts
import {
  normalizeAdjustments,
  DEFAULT_ADJUSTMENTS,
  normalizeStripe,
  normalizeStripes,
  DEFAULT_STRIPES,
} from "./normalize";

describe("adjustments normalizer", () => {
  it("defaults to identity adjustments", () => {
    expect(normalizeAdjustments({})).toEqual(DEFAULT_ADJUSTMENTS);
    expect(DEFAULT_ADJUSTMENTS).toMatchObject({ contrast: 1, gamma: 1, whitePoint: 1, blackPoint: 0, invert: false });
  });
  it("clamps to documented ranges", () => {
    expect(normalizeAdjustments({ contrast: -5 }).contrast).toBe(0); // 0..4
    expect(normalizeAdjustments({ contrast: 99 }).contrast).toBe(4);
    expect(normalizeAdjustments({ gamma: 0 }).gamma).toBe(0.05); // min 0.05, no upper clamp
    expect(normalizeAdjustments({ gamma: 100 }).gamma).toBe(100);
    expect(normalizeAdjustments({ blurRadius: 9 }).blurRadius).toBe(4); // 0..4
    expect(normalizeAdjustments({ posterizeLevels: 99 }).posterizeLevels).toBe(16); // 0..16, int
    expect(normalizeAdjustments({ whitePoint: 0, blackPoint: 0.5 }).whitePoint).toBeCloseTo(0.51); // wp ≥ bp+0.01
    expect(normalizeAdjustments({ invert: 1 as any }).invert).toBe(true);
  });
});
describe("stripes normalizer", () => {
  it("normalizes a stripe, clamping startFrom and width", () => {
    expect(normalizeStripe({ color: 0xff8833, startFrom: 2, width: 0 })).toEqual({
      color: 0xff8833,
      startFrom: 1,
      width: 1,
    });
  });
  it("empty/absent stripe list falls back to the provided defaults", () => {
    expect(normalizeStripes(undefined, DEFAULT_STRIPES)).toEqual(DEFAULT_STRIPES);
    expect(normalizeStripes([], DEFAULT_STRIPES)).toEqual(DEFAULT_STRIPES);
    expect(normalizeStripes([{ color: 0x010203, startFrom: 0.5, width: 3 }], DEFAULT_STRIPES)).toEqual([
      { color: 0x010203, startFrom: 0.5, width: 3 },
    ]);
  });
});
```

- [ ] **Step 2: Run to verify fail**

Run: `pir test -- run config/normalize`
Expected: FAIL — new exports missing.

- [ ] **Step 3: Implement (append to `normalize.ts`)**

```ts
import type { Adjustments, Stripe } from "./types";

export const DEFAULT_ADJUSTMENTS: Adjustments = {
  brightness: 0,
  exposure: 0,
  contrast: 1,
  blackPoint: 0,
  whitePoint: 1,
  gamma: 1,
  invert: false,
  posterizeLevels: 0,
  thresholdBias: 0,
  noiseAmount: 0,
  blurRadius: 0,
  sharpenAmount: 0,
};
export function normalizeAdjustments(i: Partial<Adjustments> = {}): Adjustments {
  const blackPoint = clamp(num(i.blackPoint, 0), 0, 1);
  return {
    brightness: clamp(num(i.brightness, 0), -1, 1),
    exposure: clamp(num(i.exposure, 0), -5, 5),
    contrast: clamp(num(i.contrast, 1), 0, 4),
    blackPoint,
    whitePoint: clamp(num(i.whitePoint, 1), blackPoint + 0.01, 1),
    gamma: Math.max(0.05, num(i.gamma, 1)),
    invert: !!i.invert,
    posterizeLevels: clamp(Math.round(num(i.posterizeLevels, 0)), 0, 16),
    thresholdBias: clamp(num(i.thresholdBias, 0), -1, 1),
    noiseAmount: clamp(num(i.noiseAmount, 0), 0, 1),
    blurRadius: clamp(num(i.blurRadius, 0), 0, 4),
    sharpenAmount: clamp(num(i.sharpenAmount, 0), 0, 4),
  };
}

export const DEFAULT_STRIPES: Stripe[] = [
  { color: 0x111111, startFrom: 0.0, width: 6 },
  { color: 0x333333, startFrom: 0.2, width: 6 },
  { color: 0x666666, startFrom: 0.4, width: 6 },
  { color: 0x999999, startFrom: 0.6, width: 6 },
  { color: 0xcc6622, startFrom: 0.8, width: 6 },
  { color: 0xff8833, startFrom: 0.95, width: 6 },
];
export const DEFAULT_OVERLAY_STRIPES: Stripe[] = [
  { color: 0x000000, startFrom: 0.0, width: 6 },
  { color: 0x888888, startFrom: 0.5, width: 6 },
  { color: 0xffffff, startFrom: 0.85, width: 6 },
];
export function normalizeStripe(i: Partial<Stripe>): Stripe {
  return {
    color: Math.round(clamp(num(i.color, 0), 0, 0xffffff)),
    startFrom: clamp(num(i.startFrom, 0), 0, 1),
    width: clamp(Math.round(num(i.width, 1)), 1, 64),
  };
}
export function normalizeStripes(i: Partial<Stripe>[] | undefined, fallback: Stripe[]): Stripe[] {
  if (!i || i.length === 0) return fallback.map((s) => ({ ...s }));
  return i.map(normalizeStripe);
}
```

- [ ] **Step 4: Run to verify pass**

Run: `pir test -- run config/normalize`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/stripes-engine/src/config/normalize.ts packages/stripes-engine/src/config/normalize.test.ts
git commit -m "feat(engine): config adjustments + stripes normalizers"
```

---

### Task 3: Config — top-level normalize + defaults + serialize

**Files:**

- Modify: `packages/stripes-engine/src/config/normalize.ts`
- Create: `packages/stripes-engine/src/config/serialize.ts`, `packages/stripes-engine/src/config/serialize.test.ts`

**Interfaces:**

- Consumes: all sub-normalizers + defaults.
- Produces: `DEFAULT_ENGINE_CONFIG: EngineConfig`; `normalizeEngineConfig(i?: Partial<EngineConfig>): EngineConfig`; `serializeEngineConfig(c: EngineConfig): string`; `parseEngineConfig(json: string): EngineConfig` (parse + normalize; throws on non-JSON).

- [ ] **Step 1: Add failing tests**

```ts
// normalize.test.ts addition
import { normalizeEngineConfig, DEFAULT_ENGINE_CONFIG } from "./normalize";
describe("normalizeEngineConfig", () => {
  it("fills a complete config from {}", () => {
    expect(normalizeEngineConfig({})).toEqual(DEFAULT_ENGINE_CONFIG);
    expect(DEFAULT_ENGINE_CONFIG.stripesEnabled).toBe(true);
  });
  it("merges partials through sub-normalizers", () => {
    const c = normalizeEngineConfig({ field: { mode: "overlay" }, adjustments: { contrast: 2 } });
    expect(c.field.mode).toBe("overlay");
    expect(c.adjustments.contrast).toBe(2);
    expect(c.transform).toEqual(DEFAULT_ENGINE_CONFIG.transform);
  });
});
```

```ts
// serialize.test.ts
import { describe, it, expect } from "vitest";
import { serializeEngineConfig, parseEngineConfig } from "./serialize";
import { normalizeEngineConfig } from "./normalize";
describe("serialize round-trip", () => {
  it("serialize→parse yields an equal normalized config", () => {
    const c = normalizeEngineConfig({ field: { mode: "overlay" }, transform: { zoom: 2 } });
    expect(parseEngineConfig(serializeEngineConfig(c))).toEqual(c);
  });
  it("parse normalizes a partial json and throws on garbage", () => {
    expect(parseEngineConfig('{"field":{"mode":"overlay"}}').field.mode).toBe("overlay");
    expect(() => parseEngineConfig("not json")).toThrow();
  });
});
```

- [ ] **Step 2: Run to verify fail**

Run: `pir test -- run config/`
Expected: FAIL — `normalizeEngineConfig` / `serialize` missing.

- [ ] **Step 3: Implement (append to `normalize.ts`)**

```ts
import type { EngineConfig } from "./types";

export const DEFAULT_ENGINE_CONFIG: EngineConfig = {
  transform: DEFAULT_TRANSFORM,
  adjustments: DEFAULT_ADJUSTMENTS,
  field: DEFAULT_FIELD,
  background: DEFAULT_BACKGROUND,
  grid: DEFAULT_GRID,
  stripes: DEFAULT_STRIPES.map((s) => ({ ...s })),
  overlayStripes: DEFAULT_OVERLAY_STRIPES.map((s) => ({ ...s })),
  stripesEnabled: true,
};
export function normalizeEngineConfig(i: Partial<EngineConfig> = {}): EngineConfig {
  return {
    transform: normalizeTransform(i.transform),
    adjustments: normalizeAdjustments(i.adjustments),
    field: normalizeField(i.field),
    background: normalizeBackground(i.background),
    grid: normalizeGrid(i.grid),
    stripes: normalizeStripes(i.stripes, DEFAULT_STRIPES),
    overlayStripes: normalizeStripes(i.overlayStripes, DEFAULT_OVERLAY_STRIPES),
    stripesEnabled: i.stripesEnabled !== undefined ? !!i.stripesEnabled : true,
  };
}
```

- [ ] **Step 4: Implement `config/serialize.ts`**

```ts
import type { EngineConfig } from "./types";
import { normalizeEngineConfig } from "./normalize";

export function serializeEngineConfig(c: EngineConfig): string {
  return JSON.stringify(c);
}
export function parseEngineConfig(json: string): EngineConfig {
  return normalizeEngineConfig(JSON.parse(json) as Partial<EngineConfig>);
}
```

- [ ] **Step 5: Run to verify pass**

Run: `pir test -- run config/`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/stripes-engine/src/config
git commit -m "feat(engine): normalizeEngineConfig + defaults + serialize round-trip"
```

---

### Task 4: Pass pipeline + RT pool

**Files:**

- Create: `packages/stripes-engine/src/pipeline/rtPool.ts`, `packages/stripes-engine/src/pipeline/pipeline.ts`

**Interfaces:**

- Consumes: `RenderTarget`, `createRenderTarget`, `resizeRenderTarget`, `disposeRenderTarget` (Phase 0); `GpuTimer` (Phase 0).
- Produces:
  - `type RtPool = { get(key: string, width: number, height: number, opts?: { float?: boolean; linear?: boolean }): RenderTarget; dispose(): void }`; `createRtPool(gl: WebGL2RenderingContext): RtPool` — `get` creates the target on first use, resizes it on later calls with a new size, and returns the same object for a key.
  - `type Pass = { name: string; render(): void; dispose(): void }`; `runPipeline(passes: Pass[], gpuTimer: GpuTimer): void` — runs each pass wrapped in `gpuTimer.begin(name)`/`end()`.

- [ ] **Step 1: Implement `pipeline/rtPool.ts`** (no unit test — GL; verified by the harness)

```ts
import { type RenderTarget, createRenderTarget, resizeRenderTarget, disposeRenderTarget } from "../gl/renderTarget";

export type RtPool = {
  get(key: string, width: number, height: number, opts?: { float?: boolean; linear?: boolean }): RenderTarget;
  dispose(): void;
};

export function createRtPool(gl: WebGL2RenderingContext): RtPool {
  const map = new Map<string, RenderTarget>();
  return {
    get(key, width, height, opts) {
      const existing = map.get(key);
      if (existing) {
        resizeRenderTarget(gl, existing, width, height);
        return existing;
      }
      const rt = createRenderTarget(gl, width, height, opts);
      map.set(key, rt);
      return rt;
    },
    dispose() {
      for (const rt of map.values()) disposeRenderTarget(gl, rt);
      map.clear();
    },
  };
}
```

- [ ] **Step 2: Implement `pipeline/pipeline.ts`**

```ts
import type { GpuTimer } from "../perf/gpuTimer";

export type Pass = { name: string; render(): void; dispose(): void };

export function runPipeline(passes: Pass[], gpuTimer: GpuTimer): void {
  for (const pass of passes) {
    gpuTimer.begin(pass.name);
    pass.render();
    gpuTimer.end();
  }
}
```

- [ ] **Step 3: Typecheck + commit**

Run: `pir --filter @necatikcl/stripes-engine typecheck`
Expected: PASS.

```bash
git add packages/stripes-engine/src/pipeline
git commit -m "feat(engine): pass pipeline + keyed render-target pool"
```

---

### Task 5: Refactor engine onto the pipeline (behavior-preserving)

**Files:**

- Modify: `packages/stripes-engine/src/engine.ts`

**Interfaces:**

- Consumes: `createRtPool`, `runPipeline`, `Pass` (Task 4); existing field+present passes.
- Produces: engine renders the SAME Phase-0 output (gradient field at fieldScale → present at full DPR) but drives it through `runPipeline([fieldPass', presentPass'], gpuTimer)` with `fieldRT` obtained from the RT pool. Public `StripesEngine` surface unchanged.

- [ ] **Step 1: Refactor `engine.ts`**

Replace the inline two-pass body of `renderFrame` and the `fieldRT` field with the pool + pipeline. Keep `createFieldPass`/`createPresentPass` for now (Task 9 swaps the field pass). Build a stable `Pass[]` whose closures capture the pool target + the time, rebuilt only in `applySizes`/`rebuildGpuResources`:

```ts
import { createRtPool, type RtPool } from "./pipeline/rtPool";
import { runPipeline, type Pass } from "./pipeline/pipeline";
// ...
let pool: RtPool = createRtPool(gl);
let passes: Pass[] = [];

function buildPasses() {
  for (const p of passes) p.dispose();
  const fieldPass = createFieldPass(gl, quad);
  const presentPass = createPresentPass(gl, quad);
  passes = [
    {
      name: "field",
      render: () =>
        fieldPass.render(pool.get("field", fieldSize.width, fieldSize.height, { linear: true }), clock.now()),
      dispose: () => fieldPass.dispose(),
    },
    {
      name: "present",
      render: () =>
        presentPass.render(
          pool.get("field", fieldSize.width, fieldSize.height, { linear: true }).texture,
          output.width,
          output.height,
        ),
      dispose: () => presentPass.dispose(),
    },
  ];
}
```

Track `fieldSize` (computed in `applySizes` via `resolveFieldSize`). `applySizes` calls `pool.get("field", …)` to size it and `buildPasses()` is called after passes' GL deps exist (in setup + `rebuildGpuResources`). `renderFrame` becomes:

```ts
function renderFrame() {
  if (lost) return;
  const t0 = clock.now();
  gpuTimer.poll();
  runPipeline(passes, gpuTimer);
  gl.flush();
  const frameMs = clock.now() - lastFrameStart;
  lastFrameStart = t0;
  perf.recordFrame(frameMs);
  perf.recordPasses(gpuTimer.latest());
}
```

`dispose()` now also calls `pool.dispose()` and disposes each pass; `rebuildGpuResources()` recreates `pool` + calls `buildPasses()`. Remove the standalone `fieldRT` creation/resize/dispose (the pool owns it). Keep `readOutputPixels`, `getPerf`, `resize`, `setFieldScale`, `start/stop`, context-loss as-is.

- [ ] **Step 2: Typecheck**

Run: `pir --filter @necatikcl/stripes-engine typecheck`
Expected: PASS.

- [ ] **Step 3: Verify the refactor preserved behavior (the gate that matters)**

Run: `pir test:e2e`
Expected: PASS — the existing `field-seed1-t0` visual golden STILL MATCHES (output is byte-identical: same gradient, same sizes) and the 4K perf gate still passes. If the golden mismatches, the refactor changed rendering — investigate; do NOT update the golden.

- [ ] **Step 4: Commit**

```bash
git add packages/stripes-engine/src/engine.ts
git commit -m "refactor(engine): drive render through pass pipeline + rt pool (no behavior change)"
```

---

### Task 6: Source loader + GPU uploader

**Files:**

- Create: `packages/stripes-engine/src/source/sourceTexture.ts`

**Interfaces:**

- Produces:
  - `type EngineSource = HTMLImageElement | HTMLVideoElement | ImageBitmap | HTMLCanvasElement`
  - `type SourceTexture = { texture: WebGLTexture; width: number; height: number; isVideo: boolean; update(): void; dispose(): void }`
  - `createSourceTexture(gl: WebGL2RenderingContext, media: EngineSource): SourceTexture` — uploads with `UNPACK_FLIP_Y_WEBGL = true`, `CLAMP_TO_EDGE`, `LINEAR`. For a video, `update()` re-uploads the current frame (`texImage2D`); for static sources `update()` is a no-op after the initial upload. `width`/`height` are the media's intrinsic size.

- [ ] **Step 1: Implement `source/sourceTexture.ts`** (no unit test — GL; verified by the harness)

```ts
export type EngineSource = HTMLImageElement | HTMLVideoElement | ImageBitmap | HTMLCanvasElement;

function mediaSize(media: EngineSource): { width: number; height: number } {
  if (media instanceof HTMLVideoElement) return { width: media.videoWidth || 1, height: media.videoHeight || 1 };
  if (media instanceof HTMLImageElement) return { width: media.naturalWidth || 1, height: media.naturalHeight || 1 };
  return {
    width: (media as ImageBitmap | HTMLCanvasElement).width || 1,
    height: (media as ImageBitmap | HTMLCanvasElement).height || 1,
  };
}

export type SourceTexture = {
  texture: WebGLTexture;
  width: number;
  height: number;
  isVideo: boolean;
  update(): void;
  dispose(): void;
};

export function createSourceTexture(gl: WebGL2RenderingContext, media: EngineSource): SourceTexture {
  const texture = gl.createTexture();
  if (!texture) throw new Error("Failed to create source texture");
  const isVideo = media instanceof HTMLVideoElement;
  let { width, height } = mediaSize(media);

  function upload() {
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, media as TexImageSource);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
  }

  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  upload();

  return {
    texture,
    get width() {
      return width;
    },
    get height() {
      return height;
    },
    isVideo,
    update() {
      if (!isVideo) return;
      const v = media as HTMLVideoElement;
      if (v.readyState < 2) return; // HAVE_CURRENT_DATA
      width = v.videoWidth || width;
      height = v.videoHeight || height;
      upload();
    },
    dispose() {
      gl.deleteTexture(texture);
    },
  } as SourceTexture;
}
```

- [ ] **Step 2: Typecheck + commit**

Run: `pir --filter @necatikcl/stripes-engine typecheck`
Expected: PASS.

```bash
git add packages/stripes-engine/src/source/sourceTexture.ts
git commit -m "feat(engine): source texture loader/uploader (image once, video per-frame, y-flip)"
```

---

### Task 7: Source-fit UV math (pure)

**Files:**

- Create: `packages/stripes-engine/src/source/fit.ts`, `packages/stripes-engine/src/source/fit.test.ts`

**Interfaces:**

- Produces: `type SourceRect = { u0: number; v0: number; u1: number; v1: number }`; `resolveSourceRect(srcW: number, srcH: number, dstW: number, dstH: number, fit: "stretch"|"contain"|"cover", zoom: number, panX: number, panY: number): SourceRect` — returns the source UV sub-rectangle the field samples. `stretch` = full `[0,1]` (ignores aspect). `cover` crops the source to fill dst aspect. `contain` insets so the whole source fits (UV may exceed `[0,1]`; the field shader paints out-of-range as background). `zoom` scales the sampled rect about its center (zoom>1 = closer crop); `panX/panY` shift the rect in source UV (−1..1 → ±0.5 of the rect span).

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from "vitest";
import { resolveSourceRect } from "./fit";

describe("resolveSourceRect", () => {
  it("stretch ignores aspect → full source", () => {
    expect(resolveSourceRect(100, 100, 200, 50, "stretch", 1, 0, 0)).toEqual({ u0: 0, v0: 0, u1: 1, v1: 1 });
  });
  it("cover crops the long axis to match dst aspect (square src, wide dst → crop vertically)", () => {
    const r = resolveSourceRect(100, 100, 200, 100, "cover", 1, 0, 0);
    expect(r.u0).toBeCloseTo(0);
    expect(r.u1).toBeCloseTo(1); // full width
    expect(r.v0).toBeCloseTo(0.25);
    expect(r.v1).toBeCloseTo(0.75); // cropped height
  });
  it("contain fits the whole source (square src, wide dst → letterbox in U)", () => {
    const r = resolveSourceRect(100, 100, 200, 100, "contain", 1, 0, 0);
    expect(r.v0).toBeCloseTo(0);
    expect(r.v1).toBeCloseTo(1); // full height
    expect(r.u0).toBeCloseTo(-0.5);
    expect(r.u1).toBeCloseTo(1.5); // source narrower than dst → UV overflows
  });
  it("zoom>1 tightens the rect about center", () => {
    const r = resolveSourceRect(100, 100, 100, 100, "stretch", 2, 0, 0);
    expect(r.u0).toBeCloseTo(0.25);
    expect(r.u1).toBeCloseTo(0.75);
  });
  it("pan shifts the rect", () => {
    const r = resolveSourceRect(100, 100, 100, 100, "stretch", 2, 1, 0);
    expect(r.u0).toBeCloseTo(0.5);
    expect(r.u1).toBeCloseTo(1.0); // panned +0.5 span
  });
});
```

- [ ] **Step 2: Run to verify fail**

Run: `pir test -- run source/fit`
Expected: FAIL — `fit.ts` not found.

- [ ] **Step 3: Implement `source/fit.ts`**

```ts
export type SourceRect = { u0: number; v0: number; u1: number; v1: number };

export function resolveSourceRect(
  srcW: number,
  srcH: number,
  dstW: number,
  dstH: number,
  fit: "stretch" | "contain" | "cover",
  zoom: number,
  panX: number,
  panY: number,
): SourceRect {
  // base span in source UV (1 = whole source) per axis
  let spanU = 1,
    spanV = 1;
  if (fit !== "stretch") {
    const srcAspect = srcW / srcH;
    const dstAspect = dstW / dstH;
    if (fit === "cover") {
      if (srcAspect > dstAspect) spanU = dstAspect / srcAspect;
      else spanV = srcAspect / dstAspect;
    } else {
      // contain — span may exceed 1 (letterbox), UV overflows [0,1]
      if (srcAspect > dstAspect) spanV = srcAspect / dstAspect;
      else spanU = dstAspect / srcAspect;
    }
  }
  spanU /= zoom;
  spanV /= zoom;
  // pan shifts the rect center by half the rect span per ±1 (so zoom=2,panX=1 ⟹ center 0.75, rect [0.5,1.0])
  const cu = 0.5 + panX * spanU * 0.5;
  const cv = 0.5 + panY * spanV * 0.5;
  return { u0: cu - spanU / 2, v0: cv - spanV / 2, u1: cu + spanU / 2, v1: cv + spanV / 2 };
}
```

- [ ] **Step 4: Run to verify pass**

Run: `pir test -- run source/fit`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add packages/stripes-engine/src/source/fit.ts packages/stripes-engine/src/source/fit.test.ts
git commit -m "feat(engine): source fit/zoom/pan → sample-rect math"
```

---

### Task 8: Source→field shader + pass

**Files:**

- Create: `packages/stripes-engine/src/shaders/sourceField.frag.ts`, `packages/stripes-engine/src/passes/sourceFieldPass.ts`
- Delete: `packages/stripes-engine/src/shaders/field.frag.ts`, `packages/stripes-engine/src/passes/fieldPass.ts` (replaced)

**Interfaces:**

- Consumes: `compileProgram`, `FULLSCREEN_VERT`, `RenderTarget`, `bindRenderTarget`; `Adjustments`, `SourceRect`.
- Produces:
  - `SOURCE_FIELD_FRAG: string` (ES 3.00).
  - `type SourceFieldUniforms = { srcRect: SourceRect; adjustments: Adjustments; overlay: boolean; background: number; sourceTexelW: number; sourceTexelH: number }`
  - `createSourceFieldPass(gl, quad): { render(target: RenderTarget, sourceTex: WebGLTexture, u: SourceFieldUniforms): void; dispose(): void }`

- [ ] **Step 1: Implement `shaders/sourceField.frag.ts`** (adjustment chain in the spec's order)

```ts
export const SOURCE_FIELD_FRAG = `#version 300 es
precision highp float;
in vec2 vUv;
uniform sampler2D uSource;
uniform vec4 uSrcRect;        // u0,v0,u1,v1
uniform vec2 uTexel;          // 1/sourceW, 1/sourceH
uniform vec3 uBg;             // background rgb 0..1
uniform float uBlur, uSharpen;
uniform float uBlack, uWhite, uGamma, uExposure, uContrast, uBrightThresh;
uniform float uInvert, uPosterize, uNoise, uOverlay;
out vec4 finalColor;

vec3 sampleBox(vec2 uv, float radius) {
  int r = int(radius + 0.5);
  if (r <= 0) return texture(uSource, uv).rgb;
  vec3 sum = vec3(0.0); float n = 0.0;
  for (int y = -4; y <= 4; y++) {
    if (y < -r || y > r) continue;
    for (int x = -4; x <= 4; x++) {
      if (x < -r || x > r) continue;
      sum += texture(uSource, uv + vec2(float(x), float(y)) * uTexel).rgb; n += 1.0;
    }
  }
  return sum / max(1.0, n);
}
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }

void main() {
  vec2 uv = mix(uSrcRect.xy, uSrcRect.zw, vUv);
  vec3 col;
  if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) {
    col = uBg;
  } else {
    col = sampleBox(uv, uBlur);
    if (uSharpen > 0.0) col = col + (col - sampleBox(uv, max(1.0, uBlur))) * uSharpen;
  }
  // levels
  col = clamp((col - uBlack) / max(1e-4, uWhite - uBlack), 0.0, 1.0);
  col = pow(col, vec3(uGamma));
  col *= exp2(uExposure);
  col = (col - 0.5) * uContrast + 0.5;
  col += vec3(uBrightThresh);
  if (uInvert > 0.5) col = 1.0 - col;
  if (uPosterize >= 2.0) col = floor(col * uPosterize) / max(1.0, uPosterize - 1.0);
  if (uNoise > 0.0) col += vec3((hash(vUv * 4096.0) - 0.5) * uNoise);
  col = clamp(col, 0.0, 1.0);
  float luma = dot(col, vec3(0.2126, 0.7152, 0.0722));
  if (uOverlay > 0.5) luma = 1.0 - luma;
  finalColor = vec4(vec3(luma), 1.0);
}
`;
```

- [ ] **Step 2: Implement `passes/sourceFieldPass.ts`**

```ts
import { compileProgram } from "../gl/program";
import { bindRenderTarget, type RenderTarget } from "../gl/renderTarget";
import { FULLSCREEN_VERT } from "../shaders/fullscreen.vert";
import { SOURCE_FIELD_FRAG } from "../shaders/sourceField.frag";
import type { Adjustments } from "../config/types";
import type { SourceRect } from "../source/fit";

export type SourceFieldUniforms = {
  srcRect: SourceRect;
  adjustments: Adjustments;
  overlay: boolean;
  background: number;
  sourceTexelW: number;
  sourceTexelH: number;
};

export function createSourceFieldPass(gl: WebGL2RenderingContext, quad: { draw(): void }) {
  const program = compileProgram(gl, FULLSCREEN_VERT, SOURCE_FIELD_FRAG);
  const u = (n: string) => gl.getUniformLocation(program, n);
  const L = {
    src: u("uSource"),
    rect: u("uSrcRect"),
    texel: u("uTexel"),
    bg: u("uBg"),
    blur: u("uBlur"),
    sharpen: u("uSharpen"),
    black: u("uBlack"),
    white: u("uWhite"),
    gamma: u("uGamma"),
    exposure: u("uExposure"),
    contrast: u("uContrast"),
    brightThresh: u("uBrightThresh"),
    invert: u("uInvert"),
    posterize: u("uPosterize"),
    noise: u("uNoise"),
    overlay: u("uOverlay"),
  };
  return {
    render(target: RenderTarget, sourceTex: WebGLTexture, p: SourceFieldUniforms) {
      bindRenderTarget(gl, target);
      gl.useProgram(program);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, sourceTex);
      gl.uniform1i(L.src, 0);
      gl.uniform4f(L.rect, p.srcRect.u0, p.srcRect.v0, p.srcRect.u1, p.srcRect.v1);
      gl.uniform2f(L.texel, p.sourceTexelW, p.sourceTexelH);
      const a = p.adjustments;
      gl.uniform3f(
        L.bg,
        ((p.background >> 16) & 255) / 255,
        ((p.background >> 8) & 255) / 255,
        (p.background & 255) / 255,
      );
      gl.uniform1f(L.blur, a.blurRadius);
      gl.uniform1f(L.sharpen, a.sharpenAmount);
      gl.uniform1f(L.black, a.blackPoint);
      gl.uniform1f(L.white, a.whitePoint);
      gl.uniform1f(L.gamma, a.gamma);
      gl.uniform1f(L.exposure, a.exposure);
      gl.uniform1f(L.contrast, a.contrast);
      gl.uniform1f(L.brightThresh, a.brightness + a.thresholdBias);
      gl.uniform1f(L.invert, a.invert ? 1 : 0);
      gl.uniform1f(L.posterize, a.posterizeLevels);
      gl.uniform1f(L.noise, a.noiseAmount);
      gl.uniform1f(L.overlay, p.overlay ? 1 : 0);
      quad.draw();
    },
    dispose() {
      gl.deleteProgram(program);
    },
  };
}
```

- [ ] **Step 3: Delete the Phase-0 gradient field pass + shader**

```bash
git rm packages/stripes-engine/src/passes/fieldPass.ts packages/stripes-engine/src/shaders/field.frag.ts
```

(Task 9 removes the last imports of them from `engine.ts`; if typecheck flags a dangling import before Task 9, leave the files and delete them in Task 9 instead — note which you did in the report.)

- [ ] **Step 4: Typecheck + commit**

Run: `pir --filter @necatikcl/stripes-engine typecheck`
Expected: PASS (or a known dangling-import error from engine.ts to be resolved in Task 9 — if so, restore the deleted files and defer the delete to Task 9).

```bash
git add packages/stripes-engine/src/shaders/sourceField.frag.ts packages/stripes-engine/src/passes/sourceFieldPass.ts
git commit -m "feat(engine): source→field pass (adjustment chain + luma + overlay)"
```

---

### Task 9: Engine — setSource + setConfig, drive the source→field pass

**Files:**

- Modify: `packages/stripes-engine/src/engine.ts`, `packages/stripes-engine/src/index.ts`

**Interfaces:**

- Consumes: `createSourceTexture`/`EngineSource` (Task 6), `resolveSourceRect` (Task 7), `createSourceFieldPass` (Task 8), `normalizeEngineConfig`/`DEFAULT_ENGINE_CONFIG` (Task 3), `createPresentPass` (Phase 0).
- Produces: `StripesEngine` gains `setSource(media: EngineSource | null): void` and `setConfig(config: Partial<EngineConfig>): void`. The pipeline becomes `[sourceField → present]`: the `sourceField` pass renders the configured field at fieldScale; `present` shows it (Phase 1b inserts downsample+stripe before present). With no source set, the field pass is skipped and the canvas is cleared to black. `index.ts` re-exports the config surface (`EngineConfig`, `normalizeEngineConfig`, `DEFAULT_ENGINE_CONFIG`, `serializeEngineConfig`, `parseEngineConfig`, `EngineSource`).

- [ ] **Step 1: Wire source + config into `engine.ts`**

- Add state: `let source: SourceTexture | null = null; let config = normalizeEngineConfig({});`.
- `setSource(media)`: dispose the old `source`; if `media`, `source = createSourceTexture(gl, media)`, else null.
- `setConfig(partial)`: `config = normalizeEngineConfig({ ...config, ...partial })` (shallow-merge top level; sub-objects replaced — callers pass whole sub-objects).
- Replace the `field` pass in `buildPasses()` with the source→field pass; before rendering it each frame, `source?.update()`, compute `srcRect = resolveSourceRect(source.width, source.height, output.width, output.height, config.transform.fit, zoom, panX, panY)`, and call `sourceFieldPass.render(fieldTarget, source.texture, { srcRect, adjustments: config.adjustments, overlay: config.field.mode === "overlay", background: config.background.color, sourceTexelW: 1/source.width, sourceTexelH: 1/source.height })`. If `source` is null, the field pass clears `fieldTarget` to black (bind + `gl.clearColor(0,0,0,1); gl.clear(COLOR_BUFFER_BIT)`).
- `present` pass unchanged (shows the field). Remove the gradient `createFieldPass` import; delete `fieldPass.ts`/`field.frag.ts` here if Task 8 deferred it.
- `dispose()` also disposes `source`.

- [ ] **Step 2: Update `index.ts`** — add:

```ts
export type { EngineConfig, Stripe, Fit, FieldMode } from "./config/types";
export { normalizeEngineConfig, DEFAULT_ENGINE_CONFIG } from "./config/normalize";
export { serializeEngineConfig, parseEngineConfig } from "./config/serialize";
export type { EngineSource } from "./source/sourceTexture";
```

- [ ] **Step 3: Typecheck**

Run: `pir --filter @necatikcl/stripes-engine typecheck`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add packages/stripes-engine/src/engine.ts packages/stripes-engine/src/index.ts
git commit -m "feat(engine): setSource + setConfig drive the source→field pipeline"
```

---

### Task 10: Lab — baked test image, Leva controls, source picker, show the field

**Files:**

- Create: `apps/lab/src/testImage.ts`, `apps/lab/src/controls/levaSchema.ts`
- Modify: `apps/lab/src/LabApp.tsx`
- Add dep: `leva`

**Interfaces:**

- Consumes: `createStripesEngine`, `normalizeEngineConfig`, `DEFAULT_ENGINE_CONFIG`, `EngineConfig`, `EngineSource`.
- Produces: the lab renders a default **baked deterministic test image** (drawn procedurally to an offscreen canvas — gradients + shapes so adjustments are visible), exposes Leva controls for `transform` (fit/zoom/pan), `adjustments` (all 12), `field.mode`, and `background`, applies them via `engine.setConfig`, and offers a file picker to load an image/video instead. `stripesEnabled` defaults true but Phase 1a's pipeline shows the field regardless (stripes land in 1b) — add a `stripesEnabled` toggle stub for parity. Still exposes `window.__lab` with `renderAt`, `snapshot`, plus `setConfig`.

- [ ] **Step 1: Install Leva**

Run: `pi add leva --filter lab`
Expected: `leva` added to `apps/lab` deps.

- [ ] **Step 2: Implement `apps/lab/src/testImage.ts`** (deterministic procedural source)

```ts
export function createTestImage(size = 512): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = size;
  c.height = size;
  const ctx = c.getContext("2d")!;
  const g = ctx.createLinearGradient(0, 0, size, size);
  g.addColorStop(0, "#101820");
  g.addColorStop(0.5, "#8899aa");
  g.addColorStop(1, "#f0e8d8");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  ctx.fillStyle = "#ff8833";
  ctx.beginPath();
  ctx.arc(size * 0.66, size * 0.33, size * 0.16, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#1b3b6f";
  ctx.fillRect(size * 0.12, size * 0.55, size * 0.4, size * 0.3);
  return c;
}
```

- [ ] **Step 3: Implement `apps/lab/src/controls/levaSchema.ts`**

A function `useEngineControls(): EngineConfig` using Leva's `useControls` with folders for Transform / Adjustments / Field / Background, returning a `normalizeEngineConfig`-shaped object. (Use `{ value, min, max, step }` specs matching the config ranges; map a hex color string for background via Leva's color input → `parseInt(hex.slice(1),16)`.) Return `normalizeEngineConfig({ transform, adjustments, field: { mode }, background: { color } })`.

- [ ] **Step 4: Wire `LabApp.tsx`**

In the engine effect: build the engine as before; create the test image (`createTestImage()`), call `engine.setSource(testImage)`. Render `<LevaPanel/>` (or the default Leva panel) and on every controls change call `engine.setConfig(...)` then (manual mode) `engine.renderFrame()`. A file `<input type="file">` loads an image (`new Image()` → onload → `engine.setSource(img)`) or video (`<video>` element, autoplay+loop+muted → `engine.setSource(video)`). Keep `window.__lab` and the perf overlay. Default source = the baked test image so perf + visual specs render the real chain.

- [ ] **Step 5: Build the lab**

Run: `pir --filter lab build`
Expected: success (Leva imported, engine.setSource/setConfig used, no type errors).

- [ ] **Step 6: Commit**

```bash
git add apps/lab/src/testImage.ts apps/lab/src/controls/levaSchema.ts apps/lab/src/LabApp.tsx apps/lab/package.json pnpm-lock.yaml
git commit -m "feat(lab): leva controls + baked test image + source picker; render the field"
```

---

### Task 11: Visual goldens for the field + perf gate

**Files:**

- Modify: `tests/visual.spec.ts`
- Delete: `tests/visual.spec.ts-snapshots/field-seed1-t0-darwin.png` (obsolete gradient golden)

**Interfaces:**

- Consumes: the lab rendering the baked test image field; `window.__lab.setConfig` + `renderAt`.
- Produces: two visual goldens — the b/w field in **luminance** and in **overlay** mode — captured deterministically (fixed seed/clock/dpr + baked image), plus the perf gate unchanged.

- [ ] **Step 1: Replace `tests/visual.spec.ts`**

```ts
import { test, expect } from "@playwright/test";

async function boot(page: import("@playwright/test").Page, mode: "luminance" | "overlay") {
  await page.goto("/?manual=1&seed=1&dpr=2&w=400&h=300");
  await page.waitForFunction(() => (window as any).__lab !== undefined);
  await page.evaluate((m) => {
    (window as any).__lab.setConfig({ field: { mode: m }, stripesEnabled: false });
    (window as any).__lab.renderAt(0);
  }, mode);
}

test("field — luminance", async ({ page }) => {
  await boot(page, "luminance");
  await expect(page.locator("canvas")).toHaveScreenshot("field-luminance.png", { maxDiffPixelRatio: 0.01 });
});

test("field — overlay", async ({ page }) => {
  await boot(page, "overlay");
  await expect(page.locator("canvas")).toHaveScreenshot("field-overlay.png", { maxDiffPixelRatio: 0.01 });
});
```

(Requires `window.__lab.setConfig` exposed in Task 10 — confirm it is. The old gradient golden is removed; the perf spec is unchanged and now renders the test-image field chain.)

- [ ] **Step 2: Generate the goldens + run the full e2e**

Run: `pir test:e2e -- --update-snapshots`
Then: `pir test:e2e`
Expected: first run writes `field-luminance-*.png` + `field-overlay-*.png`; second run matches them; the perf spec passes (≤16.6ms p50 on real GPU or soft-skip). **Review the two PNGs** — they must show a sensible black/white field (white where the test image is light in luminance mode; inverted in overlay), not blank/garbage.

- [ ] **Step 3: Verify the whole gate**

Run: `pir verify`
Expected: PASS (all typechecks + unit suite + studio build).

- [ ] **Step 4: Commit**

```bash
git rm tests/visual.spec.ts-snapshots/field-seed1-t0-darwin.png
git add tests/visual.spec.ts tests/visual.spec.ts-snapshots
git commit -m "test(engine): field visual goldens (luminance + overlay) on baked test image"
```

---

## Self-Review

**1. Spec coverage** (vs `2026-06-23-phase-1-source-field-stripes-design.md`, the 1a half):

- Fresh `EngineConfig` + normalizers + serialize → Tasks 1–3 ✓
- Pass-pipeline refactor + RT pool → Tasks 4–5 ✓
- Source upload (image/video, Y-flip) → Task 6 ✓
- Source transform (fit/zoom/pan) → Tasks 7 (math) + 9 (wired) ✓
- Adjustment chain → luma → overlay (correct order) → Task 8 ✓
- Background (in the field shader's out-of-source paint) → Task 8/9 ✓ (the stripe-pass background composite is 1b)
- Field-first: stripes-off shows the field → present pass shows the field (Task 9) ✓
- Leva lab + baked test image → Task 10 ✓
- Field visual goldens (luminance + overlay) + perf gate → Task 11 ✓
- Legacy migration + import-paste → **deferred to Phase 1b** (needs the full config incl. stripes; noted in the spec). The config foundation it builds on lands here.
- Grid + stripes config defined here (Tasks 1–3) but RENDERED in 1b ✓ (per scope guard).

**2. Placeholder scan:** No TBD/TODO; every code step has complete code; commands have expected output. The Task 7 note re-derives the pan term to the exact `cu = 0.5 + panX * spanU * 0.5` form the tests assert. ✓

**3. Type consistency:** `EngineConfig`/sub-types, `normalize*`, `SourceTexture`/`EngineSource`, `SourceRect`/`resolveSourceRect`, `SourceFieldUniforms`/`createSourceFieldPass`, `Pass`/`runPipeline`/`RtPool`, and the engine's new `setSource`/`setConfig` are consistent across Tasks 1–11. The engine pipeline order (sourceField → present in 1a; downsample + stripe inserted in 1b) is stated. ✓

**Note for the executor:** Tasks 1–3, 7 are pure-logic TDD. Tasks 4, 6, 8 are GL (typecheck-gated; runtime-verified by the harness). Task 5 is a behavior-preserving refactor gated by the UNCHANGED Phase-0 golden. Tasks 9–11 change rendering; Task 11 recaptures goldens. Legacy migration + studio cutover are out of 1a scope.
