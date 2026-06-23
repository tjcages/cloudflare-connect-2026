# Phase 1b — Stripes on top of the field Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Draw the duotone stripe grid on top of the Phase-1a field — downsample the field to a per-cell value, map each cell's value through a stripe LUT to a band color + width, and render rounded-box SDF bars over the background — for luminance + overlay modes, plus a deletable legacy-config migration.

**Architecture:** Insert two GPU passes between the existing `field` and `present` passes: a **downsample** pass (field → cols×rows cell grid, box-average) and a terminal **stripe** pass (per device pixel: find its cell → sample the cell value → LUT → rounded-box SDF bar over background). The stripe LUT + palette are baked CPU-side from the active stripe list into a **raw Uint8Array data texture** (never a canvas — the display-p3 unpack trap), rebuilt only when the stripe list or field mode changes. When `stripesEnabled` is false the terminal stays the `present` pass (field-first invariant).

**Tech Stack:** TypeScript, raw WebGL2 (GLSL ES 3.00), the Phase-0/1a engine, React 19 + Leva (lab), Vitest, Playwright. pnpm via `pi`/`pir`.

## Global Constraints

- **Package manager:** `pi` / `pi add` / `pir`. NEVER npm/pnpm/yarn/npx directly.
- **GL floor:** WebGL2 / GLSL ES 3.00 only (`#version 300 es`, in/out/texture()/finalColor). `compileProgram` throws on failure.
- **DATA-TEXTURE TRAP:** the stripe LUT and any future palette/index textures MUST be uploaded as raw `Uint8Array` buffers via `texImage2D(..., ArrayBufferView)`, NEVER from a `<canvas>`/image — the global `unpackColorSpace="display-p3"` color-manages DOM-source uploads and corrupts non-grayscale data textures (the documented 2026-06 gamma/band bug). Raw typed-array uploads are NOT color-managed, so they are safe.
- **Resolution:** output = CSS×DPR; field at fieldScale 0.5; downsample target = cols×rows; stripe pass = full DPR. Cell grid is computed from LOGICAL (css) size ÷ cell size, so cells are logical-px-sized regardless of DPR.
- **Config dirty signal:** rebuild the stripe LUT data texture ONLY when the active stripe list or `field.mode` changes (detected in `setConfig` via a compact signature — never per frame).
- **Legacy migration:** a quarantined `legacy/` module mapping old `StripesShaderConfig` → `Partial<EngineConfig>`; every file headed `@deprecated legacy-config shim — delete once old configs are gone`. Silent localStorage migrate-on-load + import-paste fallback in the lab.
- **Determinism:** fixed clock + seed + DPR + baked test image for goldens.
- **Scope guard:** do NOT touch `apps/studio` or `packages/stripes-shader`.
- **Commit style:** Conventional commits, scope `engine`/`lab`. Husky precommit runs — let it.
- **Verify:** `pir verify` + `pir test:e2e` stay green.

## File Structure

```
packages/stripes-engine/src/
  config/cellGrid.ts        resolveCellGrid(cssW,cssH,cellW,cellH) → {cols,rows} (pure)
  field/stripeLut.ts        buildStripeLut(stripes) → Uint8Array(256*4); lutSignature(stripes) (pure)
  gl/dataTexture.ts         createDataTexture/updateDataTexture (raw-buffer RGBA8, NEAREST/CLAMP)
  passes/downsamplePass.ts  field → cell-grid box average
  passes/stripePass.ts      terminal rounded-box SDF stripe render
  shaders/downsample.frag.ts
  shaders/stripe.frag.ts
  legacy/legacyTypes.ts     loose old-config shape (@deprecated)
  legacy/migrateLegacyConfig.ts  old StripesShaderConfig → Partial<EngineConfig> (@deprecated)
  engine.ts                 cellGrid + LUT texture + dirty signal + insert downsample/stripe; stripe-vs-present
  index.ts                  export migrateLegacyConfig + the sub-normalizers/types the lab needs
apps/lab/src/
  controls/levaSchema.ts    + grid (cell/gap/corner/orientation) + stripesEnabled controls
  persistence.ts            new-key save/load + silent legacy migrate-on-load + import/export
  LabApp.tsx                wire persistence + import/export UI
tests/
  visual.spec.ts            + stripe goldens (luminance + overlay)
```

---

### Task 1: Cell grid math (pure)

**Files:**

- Create: `packages/stripes-engine/src/config/cellGrid.ts`, `packages/stripes-engine/src/config/cellGrid.test.ts`

**Interfaces:**

- Produces: `type CellGrid = { cols: number; rows: number }`; `resolveCellGrid(cssWidth: number, cssHeight: number, cellWidth: number, cellHeight: number): CellGrid` = number of cells across the LOGICAL canvas, each axis `max(1, ceil(cssSize / cellSize))`.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from "vitest";
import { resolveCellGrid } from "./cellGrid";

describe("resolveCellGrid", () => {
  it("counts logical cells, rounding up", () => {
    expect(resolveCellGrid(700, 300, 7, 7)).toEqual({ cols: 100, rows: 43 }); // 300/7 = 42.86 → 43
    expect(resolveCellGrid(100, 100, 10, 10)).toEqual({ cols: 10, rows: 10 });
  });
  it("never returns 0 (min 1 cell)", () => {
    expect(resolveCellGrid(5, 5, 64, 64)).toEqual({ cols: 1, rows: 1 });
    expect(resolveCellGrid(0, 0, 7, 7)).toEqual({ cols: 1, rows: 1 });
  });
});
```

- [ ] **Step 2: Run to verify fail** — `pir test -- run config/cellGrid` → FAIL (module missing).

- [ ] **Step 3: Implement `config/cellGrid.ts`**

```ts
export type CellGrid = { cols: number; rows: number };

export function resolveCellGrid(cssWidth: number, cssHeight: number, cellWidth: number, cellHeight: number): CellGrid {
  return {
    cols: Math.max(1, Math.ceil(cssWidth / cellWidth)),
    rows: Math.max(1, Math.ceil(cssHeight / cellHeight)),
  };
}
```

- [ ] **Step 4: Run to verify pass** — `pir test -- run config/cellGrid` → PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/stripes-engine/src/config/cellGrid.ts packages/stripes-engine/src/config/cellGrid.test.ts
git commit -m "feat(engine): cell-grid math (logical cols×rows)"
```

---

### Task 2: Stripe LUT builder (pure)

**Files:**

- Create: `packages/stripes-engine/src/field/stripeLut.ts`, `packages/stripes-engine/src/field/stripeLut.test.ts`

**Interfaces:**

- Consumes: `Stripe` (config/types).
- Produces:
  - `buildStripeLut(stripes: Stripe[]): Uint8Array` — length `256*4` (RGBA per field value 0..255). For value `v`, the band is the LAST stripe whose `startFrom ≤ v/255` (or stripe 0 if none); LUT entry = `[R, G, B, width]` of that band (width as a 0..64 byte). Empty stripes → all-zero black width-0.
  - `lutSignature(stripes: Stripe[]): string` — compact signature (`color:startFrom:width|…`) for change detection.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from "vitest";
import { buildStripeLut, lutSignature } from "./stripeLut";

const STRIPES = [
  { color: 0x000000, startFrom: 0.0, width: 4 },
  { color: 0xff8833, startFrom: 0.5, width: 8 },
];

describe("buildStripeLut", () => {
  it("is 256 RGBA entries", () => {
    expect(buildStripeLut(STRIPES).length).toBe(256 * 4);
  });
  it("maps a low value to band 0, a high value to band 1", () => {
    const lut = buildStripeLut(STRIPES);
    // v=0 → band 0 (black, width 4)
    expect([lut[0], lut[1], lut[2], lut[3]]).toEqual([0, 0, 0, 4]);
    // v=255 (t=1.0) → band 1 (ff8833, width 8)
    const i = 255 * 4;
    expect([lut[i], lut[i + 1], lut[i + 2], lut[i + 3]]).toEqual([0xff, 0x88, 0x33, 8]);
  });
  it("the boundary value picks the upper band", () => {
    const lut = buildStripeLut(STRIPES);
    const i = 128 * 4; // 128/255 ≈ 0.502 ≥ 0.5 → band 1
    expect([lut[i], lut[i + 1], lut[i + 2]]).toEqual([0xff, 0x88, 0x33]);
  });
  it("signature changes with the list, stable for equal lists", () => {
    expect(lutSignature(STRIPES)).toBe(lutSignature([...STRIPES]));
    expect(lutSignature(STRIPES)).not.toBe(lutSignature([STRIPES[0]]));
  });
});
```

- [ ] **Step 2: Run to verify fail** — `pir test -- run field/stripeLut` → FAIL.

- [ ] **Step 3: Implement `field/stripeLut.ts`**

```ts
import type { Stripe } from "../config/types";

export function buildStripeLut(stripes: Stripe[]): Uint8Array {
  const lut = new Uint8Array(256 * 4);
  if (stripes.length === 0) return lut;
  // assume the list is in ascending startFrom order (normalizer preserves input order; defaults are ascending)
  for (let v = 0; v < 256; v++) {
    const t = v / 255;
    let band = 0;
    for (let i = 0; i < stripes.length; i++) {
      if (stripes[i].startFrom <= t) band = i;
    }
    const s = stripes[band];
    const o = v * 4;
    lut[o] = (s.color >> 16) & 255;
    lut[o + 1] = (s.color >> 8) & 255;
    lut[o + 2] = s.color & 255;
    lut[o + 3] = Math.max(0, Math.min(255, Math.round(s.width)));
  }
  return lut;
}

export function lutSignature(stripes: Stripe[]): string {
  return stripes.map((s) => `${s.color}:${s.startFrom}:${s.width}`).join("|");
}
```

- [ ] **Step 4: Run to verify pass** — `pir test -- run field/stripeLut` → PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/stripes-engine/src/field/stripeLut.ts packages/stripes-engine/src/field/stripeLut.test.ts
git commit -m "feat(engine): stripe LUT builder (value→band color+width) + signature"
```

---

### Task 3: Raw-buffer data texture helper

**Files:**

- Create: `packages/stripes-engine/src/gl/dataTexture.ts`

**Interfaces:**

- Produces:
  - `createDataTexture(gl: WebGL2RenderingContext, bytes: Uint8Array, width: number, height: number): WebGLTexture` — RGBA8/UNSIGNED_BYTE, `NEAREST` filter, `CLAMP_TO_EDGE`, uploaded from the RAW `Uint8Array` (no canvas → not color-managed). Width×height×4 must equal `bytes.length`.
  - `updateDataTexture(gl, tex: WebGLTexture, bytes: Uint8Array, width: number, height: number): void` — re-upload via `texImage2D`.

- [ ] **Step 1: Implement `gl/dataTexture.ts`** (no unit test — GL; verified by the harness)

```ts
function uploadBytes(gl: WebGL2RenderingContext, tex: WebGLTexture, bytes: Uint8Array, width: number, height: number) {
  gl.bindTexture(gl.TEXTURE_2D, tex);
  // Raw ArrayBufferView upload is NOT subject to unpackColorSpace conversion — safe for data textures.
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, bytes);
}

export function createDataTexture(
  gl: WebGL2RenderingContext,
  bytes: Uint8Array,
  width: number,
  height: number,
): WebGLTexture {
  const tex = gl.createTexture();
  if (!tex) throw new Error("Failed to create data texture");
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  uploadBytes(gl, tex, bytes, width, height);
  return tex;
}

export function updateDataTexture(
  gl: WebGL2RenderingContext,
  tex: WebGLTexture,
  bytes: Uint8Array,
  width: number,
  height: number,
): void {
  uploadBytes(gl, tex, bytes, width, height);
}
```

- [ ] **Step 2: Typecheck + commit**

Run: `pir --filter @necatikcl/stripes-engine typecheck` → PASS.

```bash
git add packages/stripes-engine/src/gl/dataTexture.ts
git commit -m "feat(engine): raw-buffer data texture helper (color-space-safe)"
```

---

### Task 4: Downsample pass + shader

**Files:**

- Create: `packages/stripes-engine/src/shaders/downsample.frag.ts`, `packages/stripes-engine/src/passes/downsamplePass.ts`

**Interfaces:**

- Consumes: `compileProgram`, `FULLSCREEN_VERT`, `bindRenderTarget`, `RenderTarget`.
- Produces: `createDownsamplePass(gl, quad): { render(target: RenderTarget, fieldTex: WebGLTexture, cols: number, rows: number): void; dispose(): void }` — renders to `target` (cols×rows); each texel = box-average of the field over that cell's UV span (4×4 taps).

- [ ] **Step 1: Implement `shaders/downsample.frag.ts`**

```ts
export const DOWNSAMPLE_FRAG = `#version 300 es
precision highp float;
in vec2 vUv;
uniform sampler2D uField;
uniform vec2 uGridCount;   // cols, rows
out vec4 finalColor;
const int TAPS = 4;
void main() {
  vec2 cell = floor(vUv * uGridCount);
  vec2 cellUv0 = cell / uGridCount;
  vec2 cellSpan = 1.0 / uGridCount;
  float sum = 0.0;
  for (int y = 0; y < TAPS; y++) {
    for (int x = 0; x < TAPS; x++) {
      vec2 t = (vec2(float(x), float(y)) + 0.5) / float(TAPS);
      sum += texture(uField, cellUv0 + t * cellSpan).r;
    }
  }
  finalColor = vec4(vec3(sum / float(TAPS * TAPS)), 1.0);
}
`;
```

- [ ] **Step 2: Implement `passes/downsamplePass.ts`**

```ts
import { compileProgram } from "../gl/program";
import { bindRenderTarget, type RenderTarget } from "../gl/renderTarget";
import { FULLSCREEN_VERT } from "../shaders/fullscreen.vert";
import { DOWNSAMPLE_FRAG } from "../shaders/downsample.frag";

export function createDownsamplePass(gl: WebGL2RenderingContext, quad: { draw(): void }) {
  const program = compileProgram(gl, FULLSCREEN_VERT, DOWNSAMPLE_FRAG);
  const uField = gl.getUniformLocation(program, "uField");
  const uGrid = gl.getUniformLocation(program, "uGridCount");
  return {
    render(target: RenderTarget, fieldTex: WebGLTexture, cols: number, rows: number) {
      bindRenderTarget(gl, target);
      gl.useProgram(program);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, fieldTex);
      gl.uniform1i(uField, 0);
      gl.uniform2f(uGrid, cols, rows);
      quad.draw();
    },
    dispose() {
      gl.deleteProgram(program);
    },
  };
}
```

- [ ] **Step 3: Typecheck + commit**

Run: `pir --filter @necatikcl/stripes-engine typecheck` → PASS.

```bash
git add packages/stripes-engine/src/shaders/downsample.frag.ts packages/stripes-engine/src/passes/downsamplePass.ts
git commit -m "feat(engine): field→cell-grid downsample pass (box average)"
```

---

### Task 5: Stripe pass + shader (terminal)

**Files:**

- Create: `packages/stripes-engine/src/shaders/stripe.frag.ts`, `packages/stripes-engine/src/passes/stripePass.ts`

**Interfaces:**

- Consumes: `compileProgram`, `FULLSCREEN_VERT`.
- Produces:
  - `type StripeUniforms = { cellW: number; cellH: number; gapX: number; gapY: number; cornerRadius: number; orientation: 0 | 1; cols: number; rows: number; dpr: number; background: number }`
  - `createStripePass(gl, quad): { render(cellTex: WebGLTexture, lutTex: WebGLTexture, u: StripeUniforms, outWidth: number, outHeight: number): void; dispose(): void }` — renders to the canvas (full res): per pixel, find its cell, sample the cell value, LUT → band color+width, draw a rounded-box SDF bar over the background.

- [ ] **Step 1: Implement `shaders/stripe.frag.ts`**

```ts
export const STRIPE_FRAG = `#version 300 es
precision highp float;
in vec2 vUv;
uniform sampler2D uCell;     // cols×rows grayscale cell value
uniform sampler2D uLut;      // 256×1 RGBA: value → (color.rgb, width byte)
uniform vec2 uGridCount;     // cols, rows
uniform vec2 uCellPx;        // cellW, cellH (logical px)
uniform vec2 uGapPx;         // gapX, gapY
uniform float uCorner;       // corner radius (logical px)
uniform float uOrient;       // 0 vertical, 1 horizontal
uniform float uDpr;
uniform vec3 uBg;
out vec4 finalColor;

float sdRoundBox(vec2 p, vec2 b, float r) {
  vec2 q = abs(p) - b + r;
  return min(max(q.x, q.y), 0.0) + length(max(q, 0.0)) - r;
}

void main() {
  vec2 cellF = vUv * uGridCount;
  vec2 cell = floor(cellF);
  vec2 local = fract(cellF);
  float v = texture(uCell, (cell + 0.5) / uGridCount).r;
  vec4 lut = texture(uLut, vec2((v * 255.0 + 0.5) / 256.0, 0.5));
  vec3 barColor = lut.rgb;
  float barWidthPx = lut.a * 255.0;

  vec2 p = (local - 0.5) * uCellPx;
  vec2 halfExt;
  if (uOrient < 0.5) {
    halfExt = vec2(min(barWidthPx, uCellPx.x - uGapPx.x) * 0.5, (uCellPx.y - uGapPx.y) * 0.5);
  } else {
    halfExt = vec2((uCellPx.x - uGapPx.x) * 0.5, min(barWidthPx, uCellPx.y - uGapPx.y) * 0.5);
  }
  halfExt = max(halfExt, vec2(0.0));
  float r = min(uCorner, min(halfExt.x, halfExt.y));
  float d = sdRoundBox(p, halfExt, r);
  float w = max(fwidth(d), 1e-4);
  float alpha = clamp(0.5 - d / w, 0.0, 1.0);
  finalColor = vec4(mix(uBg, barColor, alpha), 1.0);
}
`;
```

- [ ] **Step 2: Implement `passes/stripePass.ts`**

```ts
import { compileProgram } from "../gl/program";
import { FULLSCREEN_VERT } from "../shaders/fullscreen.vert";
import { STRIPE_FRAG } from "../shaders/stripe.frag";

export type StripeUniforms = {
  cellW: number;
  cellH: number;
  gapX: number;
  gapY: number;
  cornerRadius: number;
  orientation: 0 | 1;
  cols: number;
  rows: number;
  dpr: number;
  background: number;
};

export function createStripePass(gl: WebGL2RenderingContext, quad: { draw(): void }) {
  const program = compileProgram(gl, FULLSCREEN_VERT, STRIPE_FRAG);
  const u = (n: string) => gl.getUniformLocation(program, n);
  const L = {
    cell: u("uCell"),
    lut: u("uLut"),
    grid: u("uGridCount"),
    cellPx: u("uCellPx"),
    gap: u("uGapPx"),
    corner: u("uCorner"),
    orient: u("uOrient"),
    dpr: u("uDpr"),
    bg: u("uBg"),
  };
  return {
    render(cellTex: WebGLTexture, lutTex: WebGLTexture, p: StripeUniforms, outWidth: number, outHeight: number) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.viewport(0, 0, outWidth, outHeight);
      gl.useProgram(program);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, cellTex);
      gl.uniform1i(L.cell, 0);
      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, lutTex);
      gl.uniform1i(L.lut, 1);
      gl.uniform2f(L.grid, p.cols, p.rows);
      gl.uniform2f(L.cellPx, p.cellW, p.cellH);
      gl.uniform2f(L.gap, p.gapX, p.gapY);
      gl.uniform1f(L.corner, p.cornerRadius);
      gl.uniform1f(L.orient, p.orientation);
      gl.uniform1f(L.dpr, p.dpr);
      gl.uniform3f(
        L.bg,
        ((p.background >> 16) & 255) / 255,
        ((p.background >> 8) & 255) / 255,
        (p.background & 255) / 255,
      );
      quad.draw();
    },
    dispose() {
      gl.deleteProgram(program);
    },
  };
}
```

- [ ] **Step 3: Typecheck + commit**

Run: `pir --filter @necatikcl/stripes-engine typecheck` → PASS.

```bash
git add packages/stripes-engine/src/shaders/stripe.frag.ts packages/stripes-engine/src/passes/stripePass.ts
git commit -m "feat(engine): terminal stripe pass (rounded-box SDF bars over background)"
```

---

### Task 6: Engine wiring — cell grid, LUT texture, dirty signal, stripe-vs-present

**Files:**

- Modify: `packages/stripes-engine/src/engine.ts`

**Interfaces:**

- Consumes: `resolveCellGrid`, `buildStripeLut`/`lutSignature`, `createDataTexture`/`updateDataTexture`, `createDownsamplePass`, `createStripePass`, existing `createSourceFieldPass`/`createPresentPass`.
- Produces: the engine now renders `[field → downsample → stripe]` when `config.stripesEnabled`, else `[field → present]`. State: `cellGrid` (computed in `applySizes` from css size + cell size), a `stripeLutTex` data texture rebuilt when the active stripe signature changes, and `cssW/cssH` already tracked. `setConfig` rebuilds the LUT on stripe/mode change and rebuilds the pass list on `stripesEnabled` change.

- [ ] **Step 1: Wire `engine.ts`**

- Track `let cellGrid = { cols: 1, rows: 1 }`. In `applySizes`, after computing `output`, also `cellGrid = resolveCellGrid(cssW, cssH, config.grid.cellWidth, config.grid.cellHeight)`, and size the cell RT: `pool.get("cell", cellGrid.cols, cellGrid.rows, {})` (NEAREST default is wrong for the cell map read by the stripe shader — use default NEAREST? the stripe shader samples cell centers, so NEAREST is fine; do not pass `linear`).
- Add `let stripeLutTex: WebGLTexture | null = null; let lutSig = ""`. Helper `ensureLut()`: `const active = config.field.mode === "overlay" ? config.overlayStripes : config.stripes; const sig = lutSignature(active); if (sig !== lutSig) { const bytes = buildStripeLut(active); if (stripeLutTex) updateDataTexture(gl, stripeLutTex, bytes, 256, 1); else stripeLutTex = createDataTexture(gl, bytes, 256, 1); lutSig = sig; }`.
- In `buildPasses`: create `sourceFieldPass`, `presentPass`, `downsamplePass`, `stripePass`. Build the array conditionally on `config.stripesEnabled`:
  - field pass (as in 1a) → renders the field RT.
  - if `stripesEnabled`: downsample pass `render(pool.get("cell", cols, rows), fieldRT.texture, cols, rows)`, then stripe pass `render(cellRT.texture, stripeLutTex!, { cellW: config.grid.cellWidth, cellH: config.grid.cellHeight, gapX, gapY, cornerRadius, orientation: config.grid.orientation === "horizontal" ? 1 : 0, cols, rows, dpr, background: config.background.color }, output.width, output.height)`.
  - else: present pass (shows field).
- `setConfig(partial)`: normalize-merge as in 1a; then `ensureLut()`; if `config.stripesEnabled` changed OR `config.grid.cellWidth/cellHeight` changed (affects cellGrid/pass sizing), call `applySizes()` + `buildPasses()`. (Simplest correct rule: always call `applySizes()` then `buildPasses()` on setConfig — cheap, rebuilds the tiny pass list + resizes pooled RTs; the LUT is only re-uploaded when the signature changes. Document this choice.)
- `ensureLut()` must be called once at setup (after gl + before first buildPasses) so `stripeLutTex` exists before the stripe pass renders.
- `rebuildGpuResources` (context loss): recreate pool/passes, reset `lutSig = ""` and `stripeLutTex = null` so `ensureLut()` rebuilds it; call `ensureLut()` + `buildPasses()`.
- `dispose()`: also `gl.deleteTexture(stripeLutTex)` if set; dispose downsample + stripe passes (via the pass list dispose).

- [ ] **Step 2: Typecheck**

Run: `pir --filter @necatikcl/stripes-engine typecheck` → PASS.

- [ ] **Step 3: Commit**

```bash
git add packages/stripes-engine/src/engine.ts
git commit -m "feat(engine): downsample + stripe passes; LUT data texture w/ dirty signal; stripe-vs-present"
```

---

### Task 7: Legacy config migration (pure)

**Files:**

- Create: `packages/stripes-engine/src/legacy/legacyTypes.ts`, `packages/stripes-engine/src/legacy/migrateLegacyConfig.ts`, `packages/stripes-engine/src/legacy/migrateLegacyConfig.test.ts`
- Modify: `packages/stripes-engine/src/index.ts`

**Interfaces:**

- Produces: `migrateLegacyConfig(old: unknown): Partial<EngineConfig>` — defensively maps the old `StripesShaderConfig` shape onto the fresh config. Mappings: `textureAdjustments` → `adjustments` (same field names); `sourceTransform` → `transform`; `textureLuminanceMode` (`"luminance"|"overlay"|"colors"`) → `field.mode` (`colors` → `luminance` until Phase 8); `grid.{cellWidth,cellHeight,gapX,gapY,cornerRadius,orientation}` → `grid`; `backgroundColor` → `background.color`; `stripes`/`overlayStripes` (`{hex|color, startFrom, width}`) → stripes (hex string or numeric → numeric `color`); `stripesEnabled` passthrough. Unknown/missing fields are omitted (the engine's normalizer fills them). Index exports `migrateLegacyConfig`.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from "vitest";
import { migrateLegacyConfig } from "./migrateLegacyConfig";

describe("migrateLegacyConfig", () => {
  it("maps adjustments/transform/mode/grid/background", () => {
    const out = migrateLegacyConfig({
      textureAdjustments: { contrast: 2, gamma: 1.5 },
      sourceTransform: { fit: "cover", zoom: 1.5, panX: 0.2, panY: 0 },
      textureLuminanceMode: "overlay",
      grid: { cellWidth: 9, cellHeight: 9, gapX: 1, gapY: 1, cornerRadius: 2, orientation: "horizontal" },
      backgroundColor: 0x222222,
    });
    expect(out.adjustments).toMatchObject({ contrast: 2, gamma: 1.5 });
    expect(out.transform).toMatchObject({ fit: "cover", zoom: 1.5, panX: 0.2 });
    expect(out.field).toEqual({ mode: "overlay" });
    expect(out.grid).toMatchObject({ cellWidth: 9, orientation: "horizontal" });
    expect(out.background).toEqual({ color: 0x222222 });
  });
  it("maps colors mode to luminance (until Phase 8)", () => {
    expect(migrateLegacyConfig({ textureLuminanceMode: "colors" }).field).toEqual({ mode: "luminance" });
  });
  it("converts hex-string stripe colors to numeric", () => {
    const out = migrateLegacyConfig({ stripes: [{ hex: "#ff8833", startFrom: 0.5, width: 6 }] });
    expect(out.stripes).toEqual([{ color: 0xff8833, startFrom: 0.5, width: 6 }]);
  });
  it("ignores unknown / missing input safely", () => {
    expect(migrateLegacyConfig({})).toEqual({});
    expect(migrateLegacyConfig(null)).toEqual({});
    expect(migrateLegacyConfig("garbage")).toEqual({});
  });
});
```

- [ ] **Step 2: Run to verify fail** — `pir test -- run legacy/` → FAIL.

- [ ] **Step 3: Implement `legacy/legacyTypes.ts`**

```ts
/** @deprecated legacy-config shim — delete once old configs are gone */
export type LegacyStripe = { hex?: string; color?: number; startFrom?: number; width?: number };
/** @deprecated legacy-config shim — delete once old configs are gone */
export type LegacyConfig = Record<string, unknown>;
```

- [ ] **Step 4: Implement `legacy/migrateLegacyConfig.ts`**

```ts
/** @deprecated legacy-config shim — delete once old configs are gone */
import type { EngineConfig, Stripe } from "../config/types";
import type { LegacyStripe } from "./legacyTypes";

function asRecord(v: unknown): Record<string, unknown> | null {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
}
function hexToNum(hex: string): number {
  return parseInt(hex.replace(/^#/, ""), 16) || 0;
}
function migrateStripe(s: LegacyStripe): Stripe {
  const color = typeof s.color === "number" ? s.color : typeof s.hex === "string" ? hexToNum(s.hex) : 0;
  return {
    color,
    startFrom: typeof s.startFrom === "number" ? s.startFrom : 0,
    width: typeof s.width === "number" ? s.width : 1,
  };
}

export function migrateLegacyConfig(old: unknown): Partial<EngineConfig> {
  const o = asRecord(old);
  if (!o) return {};
  const out: Partial<EngineConfig> = {};
  if (asRecord(o.textureAdjustments)) out.adjustments = o.textureAdjustments as EngineConfig["adjustments"];
  if (asRecord(o.sourceTransform)) out.transform = o.sourceTransform as EngineConfig["transform"];
  if (typeof o.textureLuminanceMode === "string") {
    out.field = { mode: o.textureLuminanceMode === "overlay" ? "overlay" : "luminance" };
  }
  if (asRecord(o.grid)) out.grid = o.grid as EngineConfig["grid"];
  if (typeof o.backgroundColor === "number") out.background = { color: o.backgroundColor };
  if (Array.isArray(o.stripes)) out.stripes = (o.stripes as LegacyStripe[]).map(migrateStripe);
  if (Array.isArray(o.overlayStripes)) out.overlayStripes = (o.overlayStripes as LegacyStripe[]).map(migrateStripe);
  if (typeof o.stripesEnabled === "boolean") out.stripesEnabled = o.stripesEnabled;
  return out;
}
```

(The mapped sub-objects are passed straight through; `normalizeEngineConfig` clamps/validates them when the lab applies the result, so partial/loose old values are safe.)

- [ ] **Step 5: Update `index.ts`** — add:

```ts
export { migrateLegacyConfig } from "./legacy/migrateLegacyConfig";
export type { Adjustments, Grid, Transform, Background } from "./config/types";
```

- [ ] **Step 6: Run to verify pass** — `pir test -- run legacy/` → PASS.

- [ ] **Step 7: Commit**

```bash
git add packages/stripes-engine/src/legacy packages/stripes-engine/src/index.ts
git commit -m "feat(engine): deprecatable legacy-config migration (old StripesShaderConfig → EngineConfig)"
```

---

### Task 8: Lab — grid + stripe controls, render stripes

**Files:**

- Modify: `apps/lab/src/controls/levaSchema.ts`, `apps/lab/src/LabApp.tsx`

**Interfaces:**

- Consumes: the engine now renders stripes when `stripesEnabled`.
- Produces: the lab Leva schema gains a **Grid** folder (cellWidth 1–64, cellHeight 1–64, gapX 0–64, gapY 0–64, cornerRadius 0–64, orientation select vertical/horizontal) and the top-level `stripesEnabled` toggle now visibly switches between stripes and the raw field. The returned config includes `grid` + `stripesEnabled`. (Stripe-list editing stays via import-paste — Task 9; the default stripes render.)

- [ ] **Step 1: Extend `controls/levaSchema.ts`** — add a `Grid` folder to the `useControls` schema with the 6 grid fields (values from `DEFAULT_ENGINE_CONFIG.grid`), and ensure the returned object passes `grid: { cellWidth, cellHeight, gapX, gapY, cornerRadius, orientation }` and `stripesEnabled` into `normalizeEngineConfig`. Orientation is a Leva `{ options: ["vertical", "horizontal"] }` select; numeric fields use `{ value, min, max, step: 1 }` (step 0.5 for cornerRadius).

- [ ] **Step 2: Verify `LabApp` already forwards the full config** — `LabApp` calls `engine.setConfig(controls)` on change (Task-1a wiring). Confirm `controls` now includes `grid` + `stripesEnabled`; no LabApp change needed beyond confirming. If `stripesEnabled` wasn't previously forwarded, add it.

- [ ] **Step 3: Build the lab**

Run: `pir --filter lab build` → success.

- [ ] **Step 4: Commit**

```bash
git add apps/lab/src/controls/levaSchema.ts apps/lab/src/LabApp.tsx
git commit -m "feat(lab): grid controls + stripesEnabled toggle (render stripes)"
```

---

### Task 9: Lab — persistence + silent legacy migrate + import/export

**Files:**

- Create: `apps/lab/src/persistence.ts`
- Modify: `apps/lab/src/LabApp.tsx`

**Interfaces:**

- Consumes: `normalizeEngineConfig`, `serializeEngineConfig`, `parseEngineConfig`, `migrateLegacyConfig`, `EngineConfig`.
- Produces: `persistence.ts` with `loadInitialConfig(): Partial<EngineConfig>` (reads the new key `stripes-engine-lab`; if absent, reads the old `section-grid-playground` key and `migrateLegacyConfig`s it **silently**), `saveConfig(c: EngineConfig): void` (writes the new key), and `importConfig(text: string): Partial<EngineConfig>` (tries `parseEngineConfig`; if the JSON looks legacy — has `textureAdjustments`/`sourceTransform` — runs `migrateLegacyConfig`). `LabApp` seeds the Leva controls from `loadInitialConfig()`, `saveConfig` on change, and exposes an export-to-clipboard + import-from-paste UI.

- [ ] **Step 1: Implement `apps/lab/src/persistence.ts`**

```ts
import { migrateLegacyConfig } from "@necatikcl/stripes-engine";
import type { EngineConfig } from "@necatikcl/stripes-engine";

const NEW_KEY = "stripes-engine-lab";
const OLD_KEY = "section-grid-playground";

export function loadInitialConfig(): Partial<EngineConfig> {
  try {
    const fresh = localStorage.getItem(NEW_KEY);
    if (fresh) return JSON.parse(fresh) as Partial<EngineConfig>;
    const legacy = localStorage.getItem(OLD_KEY);
    if (legacy) return migrateLegacyConfig(JSON.parse(legacy)); // silent migration
  } catch {
    /* ignore corrupt storage */
  }
  return {};
}

export function saveConfig(c: EngineConfig): void {
  try {
    localStorage.setItem(NEW_KEY, JSON.stringify(c));
  } catch {
    /* ignore quota errors */
  }
}

export function importConfig(text: string): Partial<EngineConfig> {
  const parsed = JSON.parse(text) as Record<string, unknown>;
  const looksLegacy = "textureAdjustments" in parsed || "sourceTransform" in parsed || "textureLuminanceMode" in parsed;
  return looksLegacy ? migrateLegacyConfig(parsed) : (parsed as Partial<EngineConfig>);
}
```

- [ ] **Step 2: Wire `LabApp.tsx`** — call `loadInitialConfig()` once at mount and use it to seed the Leva control defaults (Leva `useControls` initial values, or apply via `engine.setConfig` after mount). On controls change, call `saveConfig(controls)` alongside `engine.setConfig`. Add an "Export config" button (writes `serializeEngineConfig(controls)` to the clipboard via `navigator.clipboard.writeText`) and an "Import config" button (prompts for pasted JSON, runs `importConfig`, applies via `engine.setConfig` + reseeds controls). Keep it minimal — a fixed-position button row beside the file picker.

- [ ] **Step 3: Build the lab**

Run: `pir --filter lab build` → success.

- [ ] **Step 4: Commit**

```bash
git add apps/lab/src/persistence.ts apps/lab/src/LabApp.tsx
git commit -m "feat(lab): config persistence + silent legacy migrate-on-load + import/export"
```

---

### Task 10: Stripe visual goldens + perf gate

**Files:**

- Modify: `tests/visual.spec.ts`

**Interfaces:**

- Consumes: the lab rendering stripes (default stripes) on the baked test image; `window.__lab.setConfig` + `renderAt`.
- Produces: two new goldens — stripes in **luminance** and **overlay** mode — captured deterministically; the existing field goldens (stripesEnabled:false) stay; perf gate unchanged.

- [ ] **Step 1: Add stripe tests to `tests/visual.spec.ts`** (keep the two field tests; add two stripe tests)

```ts
async function bootStripes(page: import("@playwright/test").Page, mode: "luminance" | "overlay") {
  await page.goto("/?manual=1&seed=1&dpr=2&w=400&h=300");
  await page.waitForFunction(() => (window as any).__lab !== undefined);
  await page.evaluate((m) => {
    (window as any).__lab.setConfig({ field: { mode: m }, stripesEnabled: true });
    (window as any).__lab.renderAt(0);
  }, mode);
}

test("stripes — luminance", async ({ page }) => {
  await bootStripes(page, "luminance");
  await expect(page.locator("canvas")).toHaveScreenshot("stripes-luminance.png", { maxDiffPixelRatio: 0.01 });
});

test("stripes — overlay", async ({ page }) => {
  await bootStripes(page, "overlay");
  await expect(page.locator("canvas")).toHaveScreenshot("stripes-overlay.png", { maxDiffPixelRatio: 0.01 });
});
```

- [ ] **Step 2: Generate + verify**

Run: `pir test:e2e -- --update-snapshots`
Then: `pir test:e2e`
Expected: writes `stripes-luminance-*.png` + `stripes-overlay-*.png`; second run matches; field goldens still match; perf gate passes. **Inspect the two stripe PNGs**: they must show recognizable rounded-box stripe bars (a duotone grid), wider/colored bars where the field is bright, narrow/dark bars where dark — NOT blank, NOT a solid fill, NOT the raw field. If wrong, STOP and report (don't commit a broken golden).

- [ ] **Step 3: Verify the whole gate**

Run: `pir verify` → PASS.

- [ ] **Step 4: Commit**

```bash
git add tests/visual.spec.ts tests/visual.spec.ts-snapshots
git commit -m "test(engine): stripe visual goldens (luminance + overlay)"
```

---

## Self-Review

**1. Spec coverage** (vs `2026-06-23-phase-1-source-field-stripes-design.md`, the 1b half):

- Downsample field → cols×rows cell grid → Tasks 1 (grid math) + 4 (pass) ✓
- Band LUT + palette from stripe list, raw byte-buffer texture → Tasks 2 (builder) + 3 (data texture) ✓
- Terminal stripe pass, rounded-box SDF bars, cell/gap/corner/orientation, over background → Task 5 ✓
- Stripe-vs-present on `stripesEnabled` (field-first) → Task 6 ✓
- Rebuild LUT only on stripe/mode change (dirty signal) → Task 6 (`ensureLut` + `lutSignature`) ✓
- Grid geometry config rendered → Tasks 6 + 8 ✓
- Deprecatable legacy migration → Task 7; silent localStorage migrate-on-load + import-paste → Task 9 ✓
- Stripe visual goldens (luminance + overlay) + perf gate → Task 10 ✓

**2. Placeholder scan:** No TBD/TODO; every code step has complete code; commands have expected output. ✓

**3. Type consistency:** `CellGrid`/`resolveCellGrid`, `buildStripeLut`/`lutSignature`, `createDataTexture`/`updateDataTexture`, `createDownsamplePass`, `StripeUniforms`/`createStripePass`, `migrateLegacyConfig`, and the engine's new `cellGrid`/`stripeLutTex`/`ensureLut` are consistent across tasks. The LUT is a 256×1 RGBA byte texture in both the builder (Task 2), the upload (Task 3/6), and the shader sample (Task 5). ✓

**Note for the executor:** Tasks 1, 2, 7 are pure-logic TDD. Tasks 3, 4, 5 are GL (typecheck-gated, runtime-verified by the harness). Task 6 is the integration (typecheck-gated; the stripe rendering is verified by Task 10's goldens). Tasks 8–9 are lab UI (build-gated). Task 10 captures the stripe goldens + holds the perf gate. The DATA-TEXTURE TRAP (raw buffers, never canvas) is the single most important correctness constraint — Task 3 enforces it.
