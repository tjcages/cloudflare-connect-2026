# Assembly reveal (fly-in) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a second reveal type, `assembly`, where the stripe texture materializes as a swarm of white glowing circles that fly in from off-canvas and crystallize into each cell's stripe on arrival.

**Architecture:** Two cooperating pieces driven by the same reveal progress — (1) a per-cell GPU reveal mask (`uRevealMode = 2`) whose timing comes from an `order`/`spread`/`flight` field, with a CPU mirror for the letters layer; and (2) a new additive Pixi overlay (`AssemblyGlowOverlay`) that draws the flying circles, modeled on the existing `PlaygroundFlamesOverlay`. The GPU mask and the overlay share one timing formula (`emitterStart = orderNorm * (1 - flight) * spread`, `arrival = emitterStart + flight`).

**Tech Stack:** TypeScript, PixiJS v8 (filters, `Texture`, `Sprite`, `Container`), GLSL (stripe duotone fragment shader), Vitest, Leva (studio controls).

**Spec:** `docs/superpowers/specs/2026-06-20-assembly-reveal-design.md`

## Global Constraints

- Package manager: use `pi` for installs and `pir` for scripts. Never `npm`/`pnpm`/`npx`. (No new deps are needed for this plan.)
- Run tests from the repo root: `pir test -- <substring>` (vitest path-substring filter). Typecheck: `pir typecheck`.
- Comment density: match the surrounding file. The render-core and shader files in `packages/stripes-shader/src` are deliberately commented to explain non-obvious GPU behavior — keep new comments minimal and explanatory; no decorative comments and none in trivial code.
- Legacy compatibility is mandatory: a reveal config with no `type` field must normalize to `"wave"`, and a missing `assembly` block must fill in defaults. Existing saved configs and the published API must keep working unchanged.
- Glow is plain **white** additive light (no palette tint, no glow-color config). No `prefers-reduced-motion` special-casing (assembly behaves like wave).
- Shared constants (must be identical everywhere): `ASSEMBLY_SETTLE = 0.12`; order enum indices `center=0, edges=1, sweep=2, random=3`; `maxCenterDist = 0.70710678` (≈ `hypot(0.5, 0.5)`).
- Defaults: `order: "center"`, `from: "scatter"`, `durationMs: 2600`, `spread: 0.85`, `glowSize: 34`, `flight: 0.22`, `overshoot: false`.

---

## File structure

New files:

- `packages/stripes-shader/src/assemblyGlowOverlay.ts` — glow-particle overlay + pure timing/spawn helpers.
- `packages/stripes-shader/src/assemblyGlowOverlay.test.ts` — unit tests for the pure helpers.

Modified files:

- `packages/stripes-shader/src/playgroundRevealConfig.ts` — `type` discriminator + `assembly` sub-config, normalization, duration/order-index helpers.
- `packages/stripes-shader/src/playgroundRevealConfig.test.ts` — normalization/legacy/clamp tests.
- `packages/stripes-shader/src/playgroundReveal.ts` — `assemblyOrderNorm`, `assemblyRevealAmountAtCell`, `resolveAssemblyRevealOvershoot`.
- `packages/stripes-shader/src/playgroundReveal.test.ts` — CPU reveal-math tests.
- `packages/stripes-shader/src/stripeFilterShaders.ts` — assembly branch in the fragment shader.
- `packages/stripes-shader/src/stripeDuotoneFilter.ts` — new uniforms + `syncReveal` type branch.
- `packages/stripes-shader/src/setupTextureShaderScene.ts` — construct/attach/teardown/resize the overlay; type-branch the reveal mask + letters mirror; sync the overlay each frame.
- `packages/stripes-shader/src/public.ts` — export the new public types.
- `apps/studio/src/playground/playgroundControlRanges.ts` — ranges for the assembly controls.
- `apps/studio/src/playground/playgroundFieldHelp.ts` — help text for the assembly controls.
- `apps/studio/src/playground/playgroundLevaSchema.ts` — reveal-type selector + assembly controls + handlers + value mapping.
- `apps/studio/src/playground/TexturePlayground.tsx` — implement the new assembly live/commit handlers (mirror the wave handlers).

---

## Task 1: Config schema + normalization

**Files:**

- Modify: `packages/stripes-shader/src/playgroundRevealConfig.ts`
- Test: `packages/stripes-shader/src/playgroundRevealConfig.test.ts`

**Interfaces:**

- Produces:
  - `type PlaygroundRevealType = "wave" | "assembly"`
  - `type PlaygroundAssemblyRevealOrder = "center" | "edges" | "sweep" | "random"`
  - `type PlaygroundAssemblyRevealFrom = "scatter" | "radial" | "edge"`
  - `type PlaygroundAssemblyRevealConfig = { order; from; durationMs; spread; glowSize; flight; overshoot }`
  - `PlaygroundRevealConfig` gains `type: PlaygroundRevealType` and `assembly: PlaygroundAssemblyRevealConfig`
  - `DEFAULT_PLAYGROUND_REVEAL_CONFIG` (updated), `normalizePlaygroundRevealConfig` (updated), `resolvePlaygroundRevealDurationMs` (updated), `isDefaultPlaygroundRevealConfig` (updated)
  - `const ASSEMBLY_ORDER_TO_INDEX: Record<PlaygroundAssemblyRevealOrder, number>`

- [ ] **Step 1: Write the failing tests**

Append to `packages/stripes-shader/src/playgroundRevealConfig.test.ts` (add the import for `DEFAULT_PLAYGROUND_REVEAL_CONFIG` / `ASSEMBLY_ORDER_TO_INDEX` to the existing import block if not present):

```ts
import { describe, expect, it } from "vitest";
import {
  ASSEMBLY_ORDER_TO_INDEX,
  DEFAULT_PLAYGROUND_REVEAL_CONFIG,
  isDefaultPlaygroundRevealConfig,
  normalizePlaygroundRevealConfig,
  resolvePlaygroundRevealDurationMs,
} from "./playgroundRevealConfig";

describe("assembly reveal config", () => {
  it("defaults type to wave and provides assembly defaults", () => {
    const normalized = normalizePlaygroundRevealConfig(undefined);
    expect(normalized.type).toBe("wave");
    expect(normalized.assembly).toEqual(DEFAULT_PLAYGROUND_REVEAL_CONFIG.assembly);
  });

  it("treats a type-less legacy payload as wave (back-compat)", () => {
    const legacy = { enabled: true, wave: { position: "center" } } as never;
    expect(normalizePlaygroundRevealConfig(legacy).type).toBe("wave");
  });

  it("keeps a valid assembly type and clamps its fields", () => {
    const normalized = normalizePlaygroundRevealConfig({
      enabled: true,
      type: "assembly",
      assembly: { order: "sweep", from: "edge", durationMs: 999, spread: 5, glowSize: 1, flight: 9, overshoot: true },
    } as never);
    expect(normalized.type).toBe("assembly");
    expect(normalized.assembly.order).toBe("sweep");
    expect(normalized.assembly.from).toBe("edge");
    expect(normalized.assembly.durationMs).toBe(999);
    expect(normalized.assembly.spread).toBe(1); // clamped 0..1
    expect(normalized.assembly.glowSize).toBe(4); // clamped to min
    expect(normalized.assembly.flight).toBe(0.6); // clamped to max
    expect(normalized.assembly.overshoot).toBe(true);
  });

  it("falls back to defaults for unknown order/from", () => {
    const normalized = normalizePlaygroundRevealConfig({
      type: "assembly",
      assembly: { order: "nope", from: "bogus" },
    } as never);
    expect(normalized.assembly.order).toBe("center");
    expect(normalized.assembly.from).toBe("scatter");
  });

  it("rejects an unknown reveal type", () => {
    expect(normalizePlaygroundRevealConfig({ type: "spiral" } as never).type).toBe("wave");
  });

  it("resolves duration from the active type", () => {
    const wave = normalizePlaygroundRevealConfig({ type: "wave", wave: { durationMs: 1200 } } as never);
    const assembly = normalizePlaygroundRevealConfig({ type: "assembly", assembly: { durationMs: 3400 } } as never);
    expect(resolvePlaygroundRevealDurationMs(wave)).toBe(1200);
    expect(resolvePlaygroundRevealDurationMs(assembly)).toBe(3400);
  });

  it("treats an assembly config as non-default", () => {
    const assembly = normalizePlaygroundRevealConfig({ type: "assembly" } as never);
    expect(isDefaultPlaygroundRevealConfig(assembly)).toBe(false);
  });

  it("maps order names to stable shader indices", () => {
    expect(ASSEMBLY_ORDER_TO_INDEX).toEqual({ center: 0, edges: 1, sweep: 2, random: 3 });
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pir test -- playgroundRevealConfig`
Expected: FAIL (e.g. `ASSEMBLY_ORDER_TO_INDEX` is not exported / `type` is undefined).

- [ ] **Step 3: Implement the schema + normalization**

In `packages/stripes-shader/src/playgroundRevealConfig.ts`:

Add the new types and the order-index map near the top (after the existing `PlaygroundWaveRevealConfig` type):

```ts
export type PlaygroundRevealType = "wave" | "assembly";

export type PlaygroundAssemblyRevealOrder = "center" | "edges" | "sweep" | "random";
export type PlaygroundAssemblyRevealFrom = "scatter" | "radial" | "edge";

export type PlaygroundAssemblyRevealConfig = {
  order: PlaygroundAssemblyRevealOrder;
  from: PlaygroundAssemblyRevealFrom;
  durationMs: number;
  spread: number;
  glowSize: number;
  flight: number;
  overshoot: boolean;
};

export const ASSEMBLY_ORDER_TO_INDEX: Record<PlaygroundAssemblyRevealOrder, number> = {
  center: 0,
  edges: 1,
  sweep: 2,
  random: 3,
};

const ASSEMBLY_REVEAL_ORDERS = new Set<PlaygroundAssemblyRevealOrder>(["center", "edges", "sweep", "random"]);
const ASSEMBLY_REVEAL_FROMS = new Set<PlaygroundAssemblyRevealFrom>(["scatter", "radial", "edge"]);
```

Extend `PlaygroundRevealConfig`:

```ts
export type PlaygroundRevealConfig = {
  enabled: boolean;
  type: PlaygroundRevealType;
  wave: PlaygroundWaveRevealConfig;
  assembly: PlaygroundAssemblyRevealConfig;
};
```

Extend `DEFAULT_PLAYGROUND_REVEAL_CONFIG`:

```ts
export const DEFAULT_PLAYGROUND_REVEAL_CONFIG: PlaygroundRevealConfig = {
  enabled: false,
  type: "wave",
  wave: {
    position: "center",
    durationMs: 1100,
    softness: 0.08,
    waviness: 0.35,
    noiseScale: 0.5,
  },
  assembly: {
    order: "center",
    from: "scatter",
    durationMs: 2600,
    spread: 0.85,
    glowSize: 34,
    flight: 0.22,
    overshoot: false,
  },
};
```

Add normalizers (place beside `normalizePlaygroundWaveRevealPosition`):

```ts
function normalizeRevealType(value: unknown): PlaygroundRevealType {
  return value === "assembly" ? "assembly" : "wave";
}

function normalizeAssemblyOrder(value: unknown): PlaygroundAssemblyRevealOrder {
  return ASSEMBLY_REVEAL_ORDERS.has(value as PlaygroundAssemblyRevealOrder)
    ? (value as PlaygroundAssemblyRevealOrder)
    : DEFAULT_PLAYGROUND_REVEAL_CONFIG.assembly.order;
}

function normalizeAssemblyFrom(value: unknown): PlaygroundAssemblyRevealFrom {
  return ASSEMBLY_REVEAL_FROMS.has(value as PlaygroundAssemblyRevealFrom)
    ? (value as PlaygroundAssemblyRevealFrom)
    : DEFAULT_PLAYGROUND_REVEAL_CONFIG.assembly.from;
}

function normalizeAssemblyRevealConfig(
  input: Partial<PlaygroundAssemblyRevealConfig> | undefined,
): PlaygroundAssemblyRevealConfig {
  const base = DEFAULT_PLAYGROUND_REVEAL_CONFIG.assembly;
  const a = input ?? {};
  return {
    order: normalizeAssemblyOrder(a.order),
    from: normalizeAssemblyFrom(a.from),
    durationMs: clampInt(a.durationMs ?? base.durationMs, 100, 30_000, base.durationMs),
    spread: clampNumber(a.spread ?? base.spread, 0, 1, base.spread),
    glowSize: clampNumber(a.glowSize ?? base.glowSize, 4, 200, base.glowSize),
    flight: clampNumber(a.flight ?? base.flight, 0.05, 0.6, base.flight),
    overshoot: a.overshoot === true,
  };
}
```

Update the body of `normalizePlaygroundRevealConfig`. The function currently returns `{ enabled, wave }`; change both return sites to include `type` and `assembly`:

```ts
if (!input) {
  return {
    enabled: base.enabled,
    type: base.type,
    wave: { ...base.wave },
    assembly: { ...base.assembly },
  };
}

const wave = input.wave ?? {};
return {
  enabled: input.enabled === true,
  type: normalizeRevealType((input as { type?: unknown }).type),
  wave: {
    position: normalizePlaygroundWaveRevealPosition(wave.position),
    durationMs: clampInt(wave.durationMs ?? base.wave.durationMs, 100, 30_000, base.wave.durationMs),
    softness: clampNumber(wave.softness ?? base.wave.softness, 0, 1, base.wave.softness),
    waviness: clampNumber(wave.waviness ?? base.wave.waviness, 0, 1, base.wave.waviness),
    noiseScale: clampNumber(wave.noiseScale ?? base.wave.noiseScale, 0.1, 50, base.wave.noiseScale),
  },
  assembly: normalizeAssemblyRevealConfig((input as { assembly?: Partial<PlaygroundAssemblyRevealConfig> }).assembly),
};
```

Also widen the `input` parameter type so `type`/`assembly` are accepted (replace the existing param type):

```ts
export function normalizePlaygroundRevealConfig(
  input:
    | (Partial<Omit<PlaygroundRevealConfig, "wave" | "assembly">> & {
        wave?: Partial<PlaygroundWaveRevealConfig>;
        assembly?: Partial<PlaygroundAssemblyRevealConfig>;
      })
    | undefined,
): PlaygroundRevealConfig {
```

Update `resolvePlaygroundRevealDurationMs`:

```ts
export function resolvePlaygroundRevealDurationMs(config: PlaygroundRevealConfig): number {
  const normalized = normalizePlaygroundRevealConfig(config);
  return normalized.type === "assembly" ? normalized.assembly.durationMs : normalized.wave.durationMs;
}
```

Update `isDefaultPlaygroundRevealConfig` to also compare `type` and assembly fields:

```ts
export function isDefaultPlaygroundRevealConfig(input: PlaygroundRevealConfig): boolean {
  const normalized = normalizePlaygroundRevealConfig(input);
  const base = DEFAULT_PLAYGROUND_REVEAL_CONFIG;
  return (
    normalized.enabled === base.enabled &&
    normalized.type === base.type &&
    normalized.wave.position === base.wave.position &&
    normalized.wave.durationMs === base.wave.durationMs &&
    normalized.wave.softness === base.wave.softness &&
    normalized.wave.waviness === base.wave.waviness &&
    normalized.wave.noiseScale === base.wave.noiseScale &&
    normalized.assembly.order === base.assembly.order &&
    normalized.assembly.from === base.assembly.from &&
    normalized.assembly.durationMs === base.assembly.durationMs &&
    normalized.assembly.spread === base.assembly.spread &&
    normalized.assembly.glowSize === base.assembly.glowSize &&
    normalized.assembly.flight === base.assembly.flight &&
    normalized.assembly.overshoot === base.assembly.overshoot
  );
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pir test -- playgroundRevealConfig`
Expected: PASS (new + existing reveal-config tests).

- [ ] **Step 5: Commit**

```bash
git add packages/stripes-shader/src/playgroundRevealConfig.ts packages/stripes-shader/src/playgroundRevealConfig.test.ts
git commit -m "feat(reveal): add assembly reveal type to config schema + normalization"
```

---

## Task 2: CPU reveal math (per-cell timing + order field)

**Files:**

- Modify: `packages/stripes-shader/src/playgroundReveal.ts`
- Test: `packages/stripes-shader/src/playgroundReveal.test.ts`

**Interfaces:**

- Consumes: `PlaygroundAssemblyRevealConfig`, `PlaygroundAssemblyRevealOrder` (Task 1).
- Produces:
  - `assemblyOrderNorm(col: number, row: number, cols: number, rows: number, order: PlaygroundAssemblyRevealOrder): number` — 0..1 ordering key (0 = first to assemble).
  - `assemblyRevealAmountAtCell(col, row, cols, rows, progress, assembly: PlaygroundAssemblyRevealConfig, bandRamp?: number): number` — per-cell stripe reveal mask, mirrors the GPU `uRevealMode = 2` math.
  - `resolveAssemblyRevealOvershoot(bandRamp: number): number` — extra progress past 1 so glow settle + band ramp finish.
  - `const ASSEMBLY_SETTLE = 0.12`

- [ ] **Step 1: Write the failing tests**

Append to `packages/stripes-shader/src/playgroundReveal.test.ts`:

```ts
import {
  ASSEMBLY_SETTLE,
  assemblyOrderNorm,
  assemblyRevealAmountAtCell,
  resolveAssemblyRevealOvershoot,
} from "./playgroundReveal";
import type { PlaygroundAssemblyRevealConfig } from "./playgroundRevealConfig";

const ASSEMBLY: PlaygroundAssemblyRevealConfig = {
  order: "center",
  from: "scatter",
  durationMs: 2600,
  spread: 0.85,
  glowSize: 34,
  flight: 0.22,
  overshoot: false,
};

describe("assemblyOrderNorm", () => {
  it("orders center cells before corner cells for center order", () => {
    const center = assemblyOrderNorm(5, 5, 11, 11, "center");
    const corner = assemblyOrderNorm(0, 0, 11, 11, "center");
    expect(center).toBeLessThan(corner);
    expect(center).toBeCloseTo(0, 1);
    expect(corner).toBeCloseTo(1, 1);
  });

  it("inverts the center field for edges order", () => {
    const center = assemblyOrderNorm(5, 5, 11, 11, "edges");
    const corner = assemblyOrderNorm(0, 0, 11, 11, "edges");
    expect(center).toBeGreaterThan(corner);
  });

  it("orders left-to-right for sweep order", () => {
    expect(assemblyOrderNorm(0, 3, 11, 11, "sweep")).toBeLessThan(assemblyOrderNorm(10, 3, 11, 11, "sweep"));
  });

  it("is deterministic and within 0..1 for random order", () => {
    const a = assemblyOrderNorm(4, 7, 20, 20, "random");
    const b = assemblyOrderNorm(4, 7, 20, 20, "random");
    expect(a).toBe(b);
    expect(a).toBeGreaterThanOrEqual(0);
    expect(a).toBeLessThanOrEqual(1);
  });
});

describe("assemblyRevealAmountAtCell", () => {
  it("is monotonic non-decreasing in progress", () => {
    let prev = -1;
    for (let p = 0; p <= 1.4; p += 0.1) {
      const v = assemblyRevealAmountAtCell(2, 2, 11, 11, p, ASSEMBLY, 0.1);
      expect(v).toBeGreaterThanOrEqual(prev - 1e-9);
      prev = v;
    }
  });

  it("reveals the center cell before a corner cell at mid progress (center order)", () => {
    const center = assemblyRevealAmountAtCell(5, 5, 11, 11, 0.4, ASSEMBLY, 0.1);
    const corner = assemblyRevealAmountAtCell(0, 0, 11, 11, 0.4, ASSEMBLY, 0.1);
    expect(center).toBeGreaterThan(corner);
  });

  it("fully reveals every cell by progress 1 + bandRamp", () => {
    const bandRamp = 0.1;
    const done = 1 + bandRamp + 1e-3;
    for (const [c, r] of [
      [0, 0],
      [5, 5],
      [10, 10],
      [10, 0],
    ] as const) {
      expect(assemblyRevealAmountAtCell(c, r, 11, 11, done, ASSEMBLY, bandRamp)).toBeCloseTo(1, 5);
    }
  });
});

describe("resolveAssemblyRevealOvershoot", () => {
  it("covers at least the settle window and the band ramp", () => {
    expect(resolveAssemblyRevealOvershoot(0.04)).toBe(ASSEMBLY_SETTLE);
    expect(resolveAssemblyRevealOvershoot(0.3)).toBe(0.3);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pir test -- playgroundReveal`
Expected: FAIL (`assemblyOrderNorm` is not exported).

- [ ] **Step 3: Implement the CPU math**

In `packages/stripes-shader/src/playgroundReveal.ts`, add the import for the assembly type at the top:

```ts
import type {
  PlaygroundAssemblyRevealConfig,
  PlaygroundAssemblyRevealOrder,
  PlaygroundWaveRevealConfig,
  PlaygroundWaveRevealPosition,
} from "./playgroundRevealConfig";
```

(The file already imports the wave types — merge the assembly types into that existing import rather than duplicating it.)

Append at the end of the file:

```ts
export const ASSEMBLY_SETTLE = 0.12;
const ASSEMBLY_MAX_CENTER_DIST = 0.70710678; // hypot(0.5, 0.5)

/** 0..1 ordering key for a cell: 0 assembles first, 1 last. Mirrors the GPU assembly branch. */
export function assemblyOrderNorm(
  col: number,
  row: number,
  cols: number,
  rows: number,
  order: PlaygroundAssemblyRevealOrder,
): number {
  if (order === "sweep") {
    return cols <= 1 ? 0 : clamp01(col / (cols - 1));
  }
  if (order === "random") {
    return cellNoise(col, row, 1);
  }
  const cx = cols <= 1 ? 0.5 : (col + 0.5) / cols;
  const cy = rows <= 1 ? 0.5 : (row + 0.5) / rows;
  const centerNorm = clamp01(Math.hypot(cx - 0.5, cy - 0.5) / ASSEMBLY_MAX_CENTER_DIST);
  return order === "edges" ? 1 - centerNorm : centerNorm;
}

/**
 * Per-cell stripe reveal mask for the assembly (fly-in) reveal — the stripe materializes
 * when its circle lands (arrival = emitterStart + flight). Kept in sync with the
 * uRevealMode == 2 branch in stripeFilterShaders.ts and the overlay timing in
 * assemblyGlowOverlay.ts.
 */
export function assemblyRevealAmountAtCell(
  col: number,
  row: number,
  cols: number,
  rows: number,
  progress: number,
  assembly: PlaygroundAssemblyRevealConfig,
  bandRamp = 0,
): number {
  const o = assemblyOrderNorm(col, row, cols, rows, assembly.order);
  const flight = Math.max(0, assembly.flight);
  const spread = Math.max(0, assembly.spread);
  const arrival = o * (1 - flight) * spread + flight;
  return smoothstep(arrival, arrival + Math.max(0, bandRamp), Math.max(0, progress));
}

/** Extra progress past 1 the assembly reveal needs so glow settle + band climbs finish. */
export function resolveAssemblyRevealOvershoot(bandRamp: number): number {
  return Math.max(ASSEMBLY_SETTLE, Math.max(0, bandRamp));
}
```

(`clamp01`, `smoothstep`, and `cellNoise` already exist in this file.)

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pir test -- playgroundReveal`
Expected: PASS (new + existing wave reveal tests).

- [ ] **Step 5: Commit**

```bash
git add packages/stripes-shader/src/playgroundReveal.ts packages/stripes-shader/src/playgroundReveal.test.ts
git commit -m "feat(reveal): add CPU assembly reveal timing + order field"
```

---

## Task 3: GPU shader assembly branch

**Files:**

- Modify: `packages/stripes-shader/src/stripeFilterShaders.ts` (fragment shader)
- Modify: `packages/stripes-shader/src/stripeDuotoneFilter.ts` (uniform declarations + `syncReveal` branch)

**Interfaces:**

- Consumes: `ASSEMBLY_ORDER_TO_INDEX` (Task 1); the existing `syncReveal(config, progress)` contract.
- Produces: GPU mask for `uRevealMode = 2`, driven by new uniforms `uRevealOrder`, `uRevealSpread`, `uRevealFlight`.

This task changes GLSL + uniform wiring, which is not unit-testable; it is verified by typecheck/build here and visually in Task 7. The CPU mirror (Task 2) pins the intended math — the GLSL must match it exactly.

- [ ] **Step 1: Declare the new uniforms in the fragment shader**

In `packages/stripes-shader/src/stripeFilterShaders.ts`, in `STRIPE_FILTER_FRAGMENT`, add three uniform declarations next to the existing reveal uniforms (after `uniform float uRevealBandRamp;`):

```glsl
uniform float uRevealOrder;
uniform float uRevealSpread;
uniform float uRevealFlight;
```

- [ ] **Step 2: Branch the reveal block (wave vs assembly)**

In the same file, replace the existing reveal block in `main()`:

```glsl
    float revealMask = 1.0;
    bool revealing = uRevealMode > 0.5;
    if (revealing) {
        vec2 cellUvPos = vec2((colIndex + 0.5) / uGridSize.x, (rowIndex + 0.5) / uGridSize.y);
        float normalizedDistance = length(cellUvPos - uRevealOrigin) / uRevealMaxDistance;
        float edgeNoise = (revealCellNoise(colIndex, rowIndex, uRevealNoiseScale) - 0.5) * uRevealWaviness;
        float softness = max(uRevealSoftness, 0.0001);
        revealMask = smoothstep(
            normalizedDistance - softness,
            normalizedDistance + softness + uRevealBandRamp,
            uRevealProgress + edgeNoise
        );
    }
```

with the type-branched version:

```glsl
    float revealMask = 1.0;
    bool revealing = uRevealMode > 0.5;
    if (revealing) {
        if (uRevealMode > 1.5) {
            // Assembly fly-in: per-cell arrival time from the order field. The stripe
            // materializes when its circle lands; the glow overlay draws the circle itself.
            float cols = max(uGridSize.x, 1.0);
            float rows = max(uGridSize.y, 1.0);
            float o;
            if (uRevealOrder > 2.5) {
                o = revealCellNoise(colIndex, rowIndex, 1.0);
            } else if (uRevealOrder > 1.5) {
                o = cols <= 1.0 ? 0.0 : colIndex / (cols - 1.0);
            } else {
                float cx = cols <= 1.0 ? 0.5 : (colIndex + 0.5) / cols;
                float cy = rows <= 1.0 ? 0.5 : (rowIndex + 0.5) / rows;
                float centerNorm = clamp(length(vec2(cx - 0.5, cy - 0.5)) / 0.70710678, 0.0, 1.0);
                o = uRevealOrder > 0.5 ? 1.0 - centerNorm : centerNorm;
            }
            float arrival = o * (1.0 - uRevealFlight) * uRevealSpread + uRevealFlight;
            revealMask = smoothstep(arrival, arrival + uRevealBandRamp, uRevealProgress);
        } else {
            vec2 cellUvPos = vec2((colIndex + 0.5) / uGridSize.x, (rowIndex + 0.5) / uGridSize.y);
            float normalizedDistance = length(cellUvPos - uRevealOrigin) / uRevealMaxDistance;
            float edgeNoise = (revealCellNoise(colIndex, rowIndex, uRevealNoiseScale) - 0.5) * uRevealWaviness;
            float softness = max(uRevealSoftness, 0.0001);
            revealMask = smoothstep(
                normalizedDistance - softness,
                normalizedDistance + softness + uRevealBandRamp,
                uRevealProgress + edgeNoise
            );
        }
    }
```

- [ ] **Step 3: Declare the new uniforms in the filter**

In `packages/stripes-shader/src/stripeDuotoneFilter.ts`, in the `stripeUniforms` object, add after `uRevealBandRamp: { value: 0.18, type: "f32" },`:

```ts
    uRevealOrder: { value: 0, type: "f32" },
    uRevealSpread: { value: 0.85, type: "f32" },
    uRevealFlight: { value: 0.22, type: "f32" },
```

- [ ] **Step 4: Branch `syncReveal` by reveal type**

In the same file, add the import:

```ts
import {
  ASSEMBLY_ORDER_TO_INDEX,
  resolvePlaygroundRevealDurationMs,
  type PlaygroundRevealConfig,
} from "./playgroundRevealConfig";
```

(Merge with the existing `playgroundRevealConfig` import — do not add a second import statement. `resolveWaveRevealGeometry` continues to come from `playgroundReveal`.)

Replace the body of `filter.syncReveal` (the assignment at the top of the function that types `uniforms` must include the new fields). The shared progress/band-ramp lines stay; branch the mode-specific lines:

```ts
filter.syncReveal = (config, progress) => {
  const uniforms = stripeUniforms.uniforms as {
    uRevealMode: number;
    uRevealProgress: number;
    uRevealOrigin: number[];
    uRevealMaxDistance: number;
    uRevealSoftness: number;
    uRevealWaviness: number;
    uRevealNoiseScale: number;
    uRevealBandRamp: number;
    uRevealOrder: number;
    uRevealSpread: number;
    uRevealFlight: number;
  };
  if (!config) {
    uniforms.uRevealMode = 0;
    uniforms.uRevealProgress = 1;
    stripeUniforms.update();
    return;
  }
  uniforms.uRevealProgress = progress;
  // Trailing band-climb window: ~5 of the old 66ms smoothing rebuilds, in progress units.
  uniforms.uRevealBandRamp = Math.min(
    0.4,
    Math.max(0.04, 330 / Math.max(1, resolvePlaygroundRevealDurationMs(config))),
  );
  if (config.type === "assembly") {
    uniforms.uRevealMode = 2;
    uniforms.uRevealOrder = ASSEMBLY_ORDER_TO_INDEX[config.assembly.order];
    uniforms.uRevealSpread = Math.max(0, config.assembly.spread);
    uniforms.uRevealFlight = Math.max(0, config.assembly.flight);
    stripeUniforms.update();
    return;
  }
  uniforms.uRevealMode = 1;
  const geometry = resolveWaveRevealGeometry(config.wave.position);
  uniforms.uRevealOrigin[0] = geometry.x;
  uniforms.uRevealOrigin[1] = geometry.y;
  uniforms.uRevealMaxDistance = geometry.maxDistance;
  uniforms.uRevealSoftness = Math.max(0, config.wave.softness);
  uniforms.uRevealWaviness = config.wave.waviness;
  uniforms.uRevealNoiseScale = config.wave.noiseScale;
  stripeUniforms.update();
};
```

- [ ] **Step 5: Typecheck**

Run: `pir typecheck`
Expected: PASS (no type errors).

- [ ] **Step 6: Commit**

```bash
git add packages/stripes-shader/src/stripeFilterShaders.ts packages/stripes-shader/src/stripeDuotoneFilter.ts
git commit -m "feat(reveal): add GPU assembly reveal mask (uRevealMode 2)"
```

---

## Task 4: Glow overlay (pure helpers + Pixi layer)

**Files:**

- Create: `packages/stripes-shader/src/assemblyGlowOverlay.ts`
- Test: `packages/stripes-shader/src/assemblyGlowOverlay.test.ts`

**Interfaces:**

- Consumes: `assemblyOrderNorm` (Task 2); `PlaygroundAssemblyRevealConfig` (Task 1); PixiJS `Container`, `Sprite`, `Texture`.
- Produces:
  - `assemblySpawnPoint(seed, cellX, cellY, w, h, from): [number, number]`
  - `assemblyEmitterAt(o, spawnX, spawnY, cellX, cellY, progress, opts): { x; y; alpha; radius; visible }` where `opts = { flight; spread; glowSize; overshoot }`
  - `class AssemblyGlowOverlay` with `readonly container: Container`, `resize(w, h)`, `ensure(cols, rows, indices, w, h, assembly)`, `sync(progress, assembly)`, `setVisible(v)`, `destroy()`.
  - `const ASSEMBLY_GLOW_CAP = 800`

The pure helpers are unit-tested here. The Pixi class is verified by build (Task 5/6) and visually in Task 7.

- [ ] **Step 1: Write the failing tests for the pure helpers**

Create `packages/stripes-shader/src/assemblyGlowOverlay.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { assemblyEmitterAt, assemblySpawnPoint } from "./assemblyGlowOverlay";

const OPTS = { flight: 0.22, spread: 0.85, glowSize: 34, overshoot: false };

describe("assemblySpawnPoint", () => {
  it("scatter spawns outside the canvas", () => {
    const [x, y] = assemblySpawnPoint(3, 200, 150, 400, 300, "scatter");
    const outside = x < 0 || x > 400 || y < 0 || y > 300;
    expect(outside).toBe(true);
  });

  it("edge spawns just past the nearest border", () => {
    const [x] = assemblySpawnPoint(1, 380, 150, 400, 300, "edge"); // near right edge
    expect(x).toBeGreaterThan(400);
  });

  it("radial spawns along the center->cell ray, beyond the cell", () => {
    const cx = 320;
    const cy = 150;
    const [x, y] = assemblySpawnPoint(2, cx, cy, 400, 300, "radial"); // cell right of center
    expect(x).toBeGreaterThan(cx);
    expect(Math.abs(y - 150)).toBeLessThan(1); // same horizontal ray as center (200,150)
  });
});

describe("assemblyEmitterAt", () => {
  const o = 0;
  const spawn: [number, number] = [-50, -50];
  const cell: [number, number] = [100, 80];

  it("is invisible before its start", () => {
    const before = assemblyEmitterAt(0.5, spawn[0], spawn[1], cell[0], cell[1], 0, OPTS);
    expect(before.visible).toBe(false);
  });

  it("travels from spawn toward the cell during flight", () => {
    const mid = assemblyEmitterAt(o, spawn[0], spawn[1], cell[0], cell[1], 0.11, OPTS);
    expect(mid.visible).toBe(true);
    expect(mid.alpha).toBeGreaterThan(0);
    expect(mid.x).toBeGreaterThan(spawn[0]);
    expect(mid.x).toBeLessThanOrEqual(cell[0] + 1);
  });

  it("sits on the cell while settling, then disappears", () => {
    const arrival = o * (1 - OPTS.flight) * OPTS.spread + OPTS.flight; // = flight here
    const settling = assemblyEmitterAt(o, spawn[0], spawn[1], cell[0], cell[1], arrival + 0.01, OPTS);
    expect(settling.visible).toBe(true);
    expect(settling.x).toBeCloseTo(cell[0], 5);
    const gone = assemblyEmitterAt(o, spawn[0], spawn[1], cell[0], cell[1], arrival + 0.2, OPTS);
    expect(gone.visible).toBe(false);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pir test -- assemblyGlowOverlay`
Expected: FAIL (module does not exist).

- [ ] **Step 3: Implement the overlay module**

Create `packages/stripes-shader/src/assemblyGlowOverlay.ts`:

```ts
import { Container, Sprite, Texture } from "pixi.js";
import { ASSEMBLY_SETTLE, assemblyOrderNorm } from "./playgroundReveal";
import type { PlaygroundAssemblyRevealConfig } from "./playgroundRevealConfig";

export const ASSEMBLY_GLOW_CAP = 800;
const GLOW_TEXEL = 128;

function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}
function smoothstep(edge0: number, edge1: number, value: number): number {
  if (edge0 === edge1) {
    return value >= edge1 ? 1 : 0;
  }
  const t = clamp01((value - edge0) / (edge1 - edge0));
  return t * t * (3 - 2 * t);
}
function easeOutCubic(t: number): number {
  const u = 1 - t;
  return 1 - u * u * u;
}
function easeOutBack(t: number): number {
  const c = 1.70158;
  const u = t - 1;
  return 1 + (c + 1) * u * u * u + c * u * u;
}
function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}
function hash(n: number): number {
  const x = Math.sin(n * 127.1 + 0.123) * 43758.5453;
  return x - Math.floor(x);
}
function hash2(n: number): number {
  const x = Math.sin(n * 269.5 + 78.233) * 43758.5453;
  return x - Math.floor(x);
}

/** Off-canvas launch point for an emitter, deterministic per seed. */
export function assemblySpawnPoint(
  seed: number,
  cellX: number,
  cellY: number,
  w: number,
  h: number,
  from: PlaygroundAssemblyRevealConfig["from"],
): [number, number] {
  const cx0 = w / 2;
  const cy0 = h / 2;
  const diag = Math.hypot(w, h);
  if (from === "radial") {
    let vx = cellX - cx0;
    let vy = cellY - cy0;
    const l = Math.hypot(vx, vy) || 1;
    vx /= l;
    vy /= l;
    return [cx0 + vx * diag * 0.7, cy0 + vy * diag * 0.7];
  }
  if (from === "edge") {
    const adx = Math.abs(cellX - cx0) / Math.max(w, 1);
    const ady = Math.abs(cellY - cy0) / Math.max(h, 1);
    const m = diag * 0.16;
    return adx > ady ? [cellX > cx0 ? w + m : -m, cellY] : [cellX, cellY > cy0 ? h + m : -m];
  }
  const angle = hash2(seed) * Math.PI * 2;
  const rr = diag * (0.62 + 0.32 * hash(seed * 3.3));
  return [cx0 + Math.cos(angle) * rr, cy0 + Math.sin(angle) * rr];
}

export type AssemblyEmitterState = { x: number; y: number; alpha: number; radius: number; visible: boolean };
export type AssemblyEmitterOpts = { flight: number; spread: number; glowSize: number; overshoot: boolean };

/** Glow position/alpha/radius at a progress value. Mirrors the prototype fly-in math. */
export function assemblyEmitterAt(
  o: number,
  spawnX: number,
  spawnY: number,
  cellX: number,
  cellY: number,
  progress: number,
  opts: AssemblyEmitterOpts,
): AssemblyEmitterState {
  const flight = Math.max(0, opts.flight);
  const spread = Math.max(0, opts.spread);
  const start = o * (1 - flight) * spread;
  const arrival = start + flight;
  if (progress < start) {
    return { x: cellX, y: cellY, alpha: 0, radius: 0, visible: false };
  }
  if (progress < arrival) {
    const lt = flight <= 0 ? 1 : clamp01((progress - start) / flight);
    const e = opts.overshoot ? easeOutBack(lt) : easeOutCubic(lt);
    return {
      x: lerp(spawnX, cellX, e),
      y: lerp(spawnY, cellY, e),
      alpha: smoothstep(0, 0.18, lt) * 0.85,
      radius: opts.glowSize * (0.55 + 0.45 * e),
      visible: true,
    };
  }
  const st = clamp01((progress - arrival) / ASSEMBLY_SETTLE);
  const alpha = 1 - st;
  if (alpha <= 0.001) {
    return { x: cellX, y: cellY, alpha: 0, radius: 0, visible: false };
  }
  return { x: cellX, y: cellY, alpha, radius: opts.glowSize * (0.9 + 0.45 * st), visible: true };
}

type Emitter = { cx: number; cy: number; sx: number; sy: number; o: number };

function buildGlowTexel(): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = GLOW_TEXEL;
  canvas.height = GLOW_TEXEL;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("2D canvas context unavailable for assembly glow sprite.");
  }
  const g = ctx.createRadialGradient(GLOW_TEXEL / 2, GLOW_TEXEL / 2, 0, GLOW_TEXEL / 2, GLOW_TEXEL / 2, GLOW_TEXEL / 2);
  g.addColorStop(0, "rgba(255, 255, 255, 0.95)");
  g.addColorStop(0.4, "rgba(255, 255, 255, 0.32)");
  g.addColorStop(1, "rgba(255, 255, 255, 0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, GLOW_TEXEL, GLOW_TEXEL);
  return canvas;
}

/**
 * Additive overlay drawing the flying glow circles for the assembly reveal. The circles
 * are pre-rendered white glow sprites blitted into a display-sized canvas with "lighter"
 * compositing; the resulting texture is shown by an additive Sprite above the stripes.
 */
export class AssemblyGlowOverlay {
  readonly container: Container;
  private readonly sprite: Sprite;
  private readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private readonly texture: Texture;
  private readonly glow: HTMLCanvasElement;
  private emitters: Emitter[] = [];
  private key = "";

  constructor(width: number, height: number) {
    this.canvas = document.createElement("canvas");
    this.canvas.width = Math.max(1, Math.round(width));
    this.canvas.height = Math.max(1, Math.round(height));
    const ctx = this.canvas.getContext("2d");
    if (!ctx) {
      throw new Error("2D canvas context unavailable for assembly glow overlay.");
    }
    this.ctx = ctx;
    this.glow = buildGlowTexel();
    this.texture = Texture.from(this.canvas);
    this.texture.source.scaleMode = "linear";
    this.sprite = new Sprite(this.texture);
    this.sprite.blendMode = "add";
    this.sprite.width = this.canvas.width;
    this.sprite.height = this.canvas.height;
    this.container = new Container();
    this.container.addChild(this.sprite);
    this.container.visible = false;
  }

  resize(width: number, height: number): void {
    const w = Math.max(1, Math.round(width));
    const h = Math.max(1, Math.round(height));
    if (this.canvas.width === w && this.canvas.height === h) {
      return;
    }
    this.canvas.width = w;
    this.canvas.height = h;
    this.sprite.width = w;
    this.sprite.height = h;
    this.texture.source.update();
    this.key = ""; // force emitter rebuild against the new dimensions
  }

  /** (Re)build emitters when the grid/dimensions/order/from change. Cheap no-op otherwise. */
  ensure(
    cols: number,
    rows: number,
    indices: Uint8Array | Uint8ClampedArray | Int32Array,
    width: number,
    height: number,
    assembly: PlaygroundAssemblyRevealConfig,
  ): void {
    const nextKey = `${cols}x${rows}:${width}x${height}:${assembly.order}:${assembly.from}`;
    if (nextKey === this.key) {
      return;
    }
    this.key = nextKey;
    const cellW = cols > 0 ? width / cols : width;
    const cellH = rows > 0 ? height / rows : height;
    const content: number[] = [];
    for (let i = 0; i < cols * rows; i++) {
      if ((indices[i] ?? 0) > 0) {
        content.push(i);
      }
    }
    const stride = content.length > ASSEMBLY_GLOW_CAP ? Math.ceil(content.length / ASSEMBLY_GLOW_CAP) : 1;
    this.emitters = [];
    for (let k = 0; k < content.length; k += stride) {
      const i = content[k]!;
      const col = i % cols;
      const row = (i - col) / cols;
      const cx = (col + 0.5) * cellW;
      const cy = (row + 0.5) * cellH;
      const [sx, sy] = assemblySpawnPoint(i, cx, cy, width, height, assembly.from);
      this.emitters.push({ cx, cy, sx, sy, o: assemblyOrderNorm(col, row, cols, rows, assembly.order) });
    }
  }

  sync(progress: number, assembly: PlaygroundAssemblyRevealConfig): void {
    const { width, height } = this.canvas;
    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.ctx.clearRect(0, 0, width, height);
    const previousComposite = this.ctx.globalCompositeOperation;
    this.ctx.globalCompositeOperation = "lighter";
    const opts: AssemblyEmitterOpts = {
      flight: assembly.flight,
      spread: assembly.spread,
      glowSize: assembly.glowSize,
      overshoot: assembly.overshoot,
    };
    for (const e of this.emitters) {
      const s = assemblyEmitterAt(e.o, e.sx, e.sy, e.cx, e.cy, progress, opts);
      if (!s.visible || s.alpha <= 0.001 || s.radius <= 0) {
        continue;
      }
      this.ctx.globalAlpha = clamp01(s.alpha);
      this.ctx.drawImage(this.glow, s.x - s.radius, s.y - s.radius, s.radius * 2, s.radius * 2);
    }
    this.ctx.globalAlpha = 1;
    this.ctx.globalCompositeOperation = previousComposite;
    this.texture.source.update();
  }

  setVisible(visible: boolean): void {
    this.container.visible = visible;
  }

  destroy(): void {
    this.texture.destroy(true);
    this.container.destroy({ children: true });
  }
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pir test -- assemblyGlowOverlay`
Expected: PASS.

- [ ] **Step 5: Typecheck**

Run: `pir typecheck`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/stripes-shader/src/assemblyGlowOverlay.ts packages/stripes-shader/src/assemblyGlowOverlay.test.ts
git commit -m "feat(reveal): add assembly glow-particle overlay"
```

---

## Task 5: Wire the overlay + reveal branching into the scene

**Files:**

- Modify: `packages/stripes-shader/src/setupTextureShaderScene.ts`

**Interfaces:**

- Consumes: `AssemblyGlowOverlay` (Task 4); `assemblyRevealAmountAtCell`, `resolveAssemblyRevealOvershoot` (Task 2).
- Produces: assembly reveal rendered end-to-end in the live scene.

Verified by typecheck + build here and visually in Task 7. Use the existing wave wiring (already in this file) as the reference for each edit site.

- [ ] **Step 1: Add imports**

In the import that pulls from `./playgroundReveal`, add the two new functions:

```ts
import {
  assemblyRevealAmountAtCell,
  resolveAssemblyRevealOvershoot,
  resolveRevealOvershoot,
  waveRevealAmountAtCell,
  type PlaygroundRevealState,
} from "./playgroundReveal";
```

Add a new import for the overlay (next to the other overlay imports near the top of the file):

```ts
import { AssemblyGlowOverlay } from "./assemblyGlowOverlay";
```

- [ ] **Step 2: Construct the overlay and attach it to the stage**

Find where `cursorTrailOverlay` is constructed (`const cursorTrailOverlay = new CursorTrailOverlay(...)`, ~line 471). Immediately after it, add:

```ts
const assemblyGlowOverlay = new AssemblyGlowOverlay(display.width, display.height);
app.stage.addChild(assemblyGlowOverlay.container);
```

(Adding after the sprite + letter layer were added means the glow draws on top.)

- [ ] **Step 3: Resize the overlay with the display**

Find the resize site where the block grid is resized on dimension change (`const dimensionsChanged = blockGridTexture.resize(display.width, display.height, eff.width, eff.height);`, ~line 539). Inside that `if (dimensionsChanged) { ... }` block (or right after the resize call), add:

```ts
assemblyGlowOverlay.resize(display.width, display.height);
```

- [ ] **Step 4: Destroy the overlay on teardown**

Find the teardown where `cursorTrailOverlay.destroy();` is called (~line 595). After it, add:

```ts
assemblyGlowOverlay.destroy();
```

- [ ] **Step 5: Branch the reveal overshoot + sync the overlay**

Find the reveal block (~lines 738-756). Replace it so the overshoot is type-aware and the overlay is driven each frame. The persisted grid-build state used by the letters pass is referenced here as `gridState.stableIndices` (the same variable the letters pass reads); guard on `hasBuiltGrid`:

```ts
const revealConfig = revealConfigRef.current;
const revealEnabled = revealConfig.enabled;
const revealPlayback = revealPlaybackRef.current;
const revealProgressRaw = revealEnabled
  ? Math.max(0, (now - revealPlayback.startedAtMs) / Math.max(1, resolvePlaygroundRevealDurationMs(revealConfig)))
  : 1;
const revealProgress = Math.min(1, revealProgressRaw);
revealStateRef.current = { progress: revealProgress };
const revealActive = revealEnabled && revealProgress < 1;
const revealDurationMs = Math.max(1, resolvePlaygroundRevealDurationMs(revealConfig));
const revealBandRamp = Math.min(0.4, Math.max(0.04, 330 / revealDurationMs));
const revealOvershoot =
  revealConfig.type === "assembly"
    ? resolveAssemblyRevealOvershoot(revealBandRamp)
    : resolveRevealOvershoot(revealConfig.wave, revealBandRamp);
const revealAnimating = revealEnabled && revealProgressRaw < 1 + revealOvershoot;

// The reveal is a GPU mask: the grid stays fully built and only uniforms animate.
stripeFilter.syncReveal(revealAnimating ? revealConfig : null, revealProgressRaw);

if (revealConfig.type === "assembly" && revealAnimating && hasBuiltGrid && gridState.stableIndices) {
  assemblyGlowOverlay.ensure(
    blockGridTexture.cols,
    blockGridTexture.rows,
    gridState.stableIndices,
    display.width,
    display.height,
    revealConfig.assembly,
  );
  assemblyGlowOverlay.sync(revealProgressRaw, revealConfig.assembly);
  assemblyGlowOverlay.setVisible(true);
} else {
  assemblyGlowOverlay.setVisible(false);
}
```

Notes for the implementer:

- `revealActive` (kept above) is still consumed later in the frame (`const clickWaveSamplingEnabled = clickWaveConfig.enabled && !revealActive;`) — do not drop it. The original code computed `revealOvershoot` via `resolveRevealOvershoot(revealConfig.wave, revealBandRamp)`; this replacement makes it type-aware. Keep any other uses of `revealProgressRaw`/`revealBandRamp`/`revealActive` later in the frame unchanged.
- `gridState` is declared `let gridState: PlaygroundGridBuildState = {}` and `gridState.stableIndices` is `Uint8Array | undefined`; the `&& gridState.stableIndices` guard both narrows the type and skips the first frame before the grid is built. At this point in the frame `gridState` holds the previous frame's indices, which is correct — content is stable during a reveal. The letters pass reads the same `gridState.stableIndices`.

- [ ] **Step 6: Branch the letters CPU mirror by reveal type**

Find the letters reveal-mask call (~lines 972-984): `revealMask = waveRevealAmountAtCell(col, row, cols, rows, revealProgressRaw, revealConfig.wave, revealBandRamp);`. Replace with:

```ts
revealMask =
  revealConfig.type === "assembly"
    ? assemblyRevealAmountAtCell(col, row, cols, rows, revealProgressRaw, revealConfig.assembly, revealBandRamp)
    : waveRevealAmountAtCell(col, row, cols, rows, revealProgressRaw, revealConfig.wave, revealBandRamp);
```

- [ ] **Step 7: Typecheck + run the package tests**

Run: `pir typecheck`
Expected: PASS.

Run: `pir test -- packages/stripes-shader`
Expected: PASS (all package tests stay green).

- [ ] **Step 8: Commit**

```bash
git add packages/stripes-shader/src/setupTextureShaderScene.ts
git commit -m "feat(reveal): wire assembly glow overlay + reveal branching into the scene"
```

---

## Task 6: Export the new public types

**Files:**

- Modify: `packages/stripes-shader/src/public.ts`

**Interfaces:**

- Produces: public exports of `PlaygroundRevealType`, `PlaygroundAssemblyRevealConfig`, `PlaygroundAssemblyRevealOrder`, `PlaygroundAssemblyRevealFrom`.

`StripesShaderConfig`/`StripesShader` already accept and normalize the whole `reveal` object via `normalizePlaygroundRevealConfig`, so no passthrough wiring changes are needed — only the new type names need to be exported for consumers.

- [ ] **Step 1: Add the type exports**

In `packages/stripes-shader/src/public.ts`, replace the existing reveal type export line:

```ts
export type { PlaygroundRevealConfig } from "./playgroundRevealConfig";
```

with:

```ts
export type {
  PlaygroundAssemblyRevealConfig,
  PlaygroundAssemblyRevealFrom,
  PlaygroundAssemblyRevealOrder,
  PlaygroundRevealConfig,
  PlaygroundRevealType,
} from "./playgroundRevealConfig";
```

- [ ] **Step 2: Build the package (verifies dts bundling)**

Run from the package directory: `cd packages/stripes-shader && pir build`
Expected: PASS (vite build + api-extractor dts bundling succeed; the new types appear in `dist/index.d.ts`).

- [ ] **Step 3: Commit**

```bash
git add packages/stripes-shader/src/public.ts
git commit -m "feat(reveal): export assembly reveal public types"
```

---

## Task 7: Studio Leva controls

**Files:**

- Modify: `apps/studio/src/playground/playgroundControlRanges.ts`
- Modify: `apps/studio/src/playground/playgroundFieldHelp.ts`
- Modify: `apps/studio/src/playground/playgroundLevaSchema.ts`
- Modify: `apps/studio/src/playground/TexturePlayground.tsx`

**Interfaces:**

- Consumes: the config + handlers contract; mirrors the existing `onRevealWaveLive`/`onRevealWaveCommit` pattern.
- Produces: a `revealType` selector plus assembly controls (order, from, duration, spread, glow size, overshoot) in the Reveal folder, persisted via the existing reveal config flow.

This task is integration UI; verify by running the studio and exercising the controls (final visual check of the whole feature).

- [ ] **Step 1: Add control ranges**

In `apps/studio/src/playground/playgroundControlRanges.ts`, add to the `PLAYGROUND_CONTROL_RANGES` object (alongside the existing `reveal*` ranges):

```ts
  revealSpread: { min: 0, max: 1, step: 0.01 },
  revealGlowSize: { min: 4, max: 120, step: 1 },
  revealFlight: { min: 0.05, max: 0.6, step: 0.01 },
```

(`revealDurationMs` already exists and is reused for the assembly duration.)

- [ ] **Step 2: Add field-help text**

In `apps/studio/src/playground/playgroundFieldHelp.ts`, add to `PLAYGROUND_FIELD_HELP`:

```ts
  revealType: "Reveal style: Wave expands a feathered front; Assembly flies glowing circles in to build the texture.",
  revealAssemblyOrder: "Order cells assemble in: from the center out, the edges in, a left-to-right sweep, or random.",
  revealAssemblyFrom: "Where the circles enter from: scattered all around, straight in along each cell's ray, or the nearest edge.",
  revealSpread: "How staggered the arrivals are. Low = all circles land together; high = a long progressive wave.",
  revealGlowSize: "Radius of each flying glow circle.",
  revealFlight: "How long each circle is in flight, as a fraction of the whole reveal.",
  revealOvershoot: "Circles overshoot slightly and pop into place on landing.",
```

- [ ] **Step 3: Add the controls + handlers to the Leva schema**

In `apps/studio/src/playground/playgroundLevaSchema.ts`:

(a) Extend the assembly type imports (merge into the existing `playgroundRevealConfig` import):

```ts
import {
  type PlaygroundAssemblyRevealConfig,
  type PlaygroundAssemblyRevealFrom,
  type PlaygroundAssemblyRevealOrder,
  type PlaygroundRevealConfig,
  type PlaygroundRevealType,
  type PlaygroundWaveRevealConfig,
  type PlaygroundWaveRevealPosition,
} from "...";
```

(b) Add option maps next to `WAVE_POSITION_OPTIONS`:

```ts
const REVEAL_TYPE_OPTIONS: Record<string, PlaygroundRevealType> = { Wave: "wave", Assembly: "assembly" };
const ASSEMBLY_ORDER_OPTIONS: Record<string, PlaygroundAssemblyRevealOrder> = {
  "Center → out": "center",
  "Edges → in": "edges",
  "Sweep L → R": "sweep",
  Random: "random",
};
const ASSEMBLY_FROM_OPTIONS: Record<string, PlaygroundAssemblyRevealFrom> = {
  "All around": "scatter",
  "Straight in": "radial",
  "Nearest edge": "edge",
};
```

(c) Add to the handlers interface (next to `onRevealWaveLive`/`onRevealWaveCommit`):

```ts
  onRevealAssemblyLive: (patch: Partial<PlaygroundAssemblyRevealConfig>) => void;
  onRevealAssemblyCommit: (patch: Partial<PlaygroundAssemblyRevealConfig>) => void;
```

(d) In the Reveal folder definition (the `levaFolder({ ... })` near line 371), after `revealEnabled` add the type selector, and gate wave vs assembly fields by deriving disabled flags from the current type. Add these near the top of the folder builder where `revealDisabled` is computed:

```ts
const waveDisabled = revealDisabled || reveal.type !== "wave";
const assemblyDisabled = revealDisabled || reveal.type !== "assembly";
```

Add the type control:

```ts
        revealType: selectControl<PlaygroundRevealType>(reveal.type, REVEAL_TYPE_OPTIONS, {
          label: "Reveal type",
          hint: PLAYGROUND_FIELD_HELP.revealType,
          disabled: revealDisabled,
          onChange: (type) => handlers.onRevealCommit({ type }),
        }),
```

Change the existing wave fields (`revealPosition`, `revealWaveDuration`, `revealSoftness`, `revealWaviness`, `revealNoiseScale`) to use `disabled: waveDisabled` instead of `disabled: revealDisabled`.

Add the assembly controls after the wave fields:

```ts
        revealAssemblyOrder: selectControl<PlaygroundAssemblyRevealOrder>(reveal.assembly.order, ASSEMBLY_ORDER_OPTIONS, {
          label: "Order",
          hint: PLAYGROUND_FIELD_HELP.revealAssemblyOrder,
          disabled: assemblyDisabled,
          onChange: (order) => handlers.onRevealAssemblyCommit({ order }),
        }),
        revealAssemblyFrom: selectControl<PlaygroundAssemblyRevealFrom>(reveal.assembly.from, ASSEMBLY_FROM_OPTIONS, {
          label: "Come from",
          hint: PLAYGROUND_FIELD_HELP.revealAssemblyFrom,
          disabled: assemblyDisabled,
          onChange: (from) => handlers.onRevealAssemblyCommit({ from }),
        }),
        revealAssemblyDuration: numControl(
          reveal.assembly.durationMs,
          PLAYGROUND_CONTROL_RANGES.revealDurationMs.min,
          PLAYGROUND_CONTROL_RANGES.revealDurationMs.max,
          PLAYGROUND_CONTROL_RANGES.revealDurationMs.step,
          {
            label: "Duration (ms)",
            hint: PLAYGROUND_FIELD_HELP.revealDuration,
            disabled: assemblyDisabled,
            onLive: (value) => handlers.onRevealAssemblyLive({ durationMs: value }),
            onCommit: (value) => handlers.onRevealAssemblyCommit({ durationMs: value }),
          },
        ),
        revealAssemblySpread: numControl(
          reveal.assembly.spread,
          PLAYGROUND_CONTROL_RANGES.revealSpread.min,
          PLAYGROUND_CONTROL_RANGES.revealSpread.max,
          PLAYGROUND_CONTROL_RANGES.revealSpread.step,
          {
            label: "Stagger spread",
            hint: PLAYGROUND_FIELD_HELP.revealSpread,
            disabled: assemblyDisabled,
            onLive: (value) => handlers.onRevealAssemblyLive({ spread: value }),
            onCommit: (value) => handlers.onRevealAssemblyCommit({ spread: value }),
          },
        ),
        revealAssemblyGlowSize: numControl(
          reveal.assembly.glowSize,
          PLAYGROUND_CONTROL_RANGES.revealGlowSize.min,
          PLAYGROUND_CONTROL_RANGES.revealGlowSize.max,
          PLAYGROUND_CONTROL_RANGES.revealGlowSize.step,
          {
            label: "Glow size",
            hint: PLAYGROUND_FIELD_HELP.revealGlowSize,
            disabled: assemblyDisabled,
            onLive: (value) => handlers.onRevealAssemblyLive({ glowSize: value }),
            onCommit: (value) => handlers.onRevealAssemblyCommit({ glowSize: value }),
          },
        ),
        revealAssemblyFlight: numControl(
          reveal.assembly.flight,
          PLAYGROUND_CONTROL_RANGES.revealFlight.min,
          PLAYGROUND_CONTROL_RANGES.revealFlight.max,
          PLAYGROUND_CONTROL_RANGES.revealFlight.step,
          {
            label: "Flight length",
            hint: PLAYGROUND_FIELD_HELP.revealFlight,
            disabled: assemblyDisabled,
            onLive: (value) => handlers.onRevealAssemblyLive({ flight: value }),
            onCommit: (value) => handlers.onRevealAssemblyCommit({ flight: value }),
          },
        ),
        revealAssemblyOvershoot: boolControl(reveal.assembly.overshoot, {
          label: "Overshoot landing",
          hint: PLAYGROUND_FIELD_HELP.revealOvershoot,
          disabled: assemblyDisabled,
          onChange: (value) => handlers.onRevealAssemblyCommit({ overshoot: value }),
        }),
```

(e) In the values-sync block (near lines 1554-1558, where `values.revealPosition = ...` etc. are set), add:

```ts
values.revealType = reveal.type;
values.revealAssemblyOrder = reveal.assembly.order;
values.revealAssemblyFrom = reveal.assembly.from;
values.revealAssemblyDuration = reveal.assembly.durationMs;
values.revealAssemblySpread = reveal.assembly.spread;
values.revealAssemblyGlowSize = reveal.assembly.glowSize;
values.revealAssemblyFlight = reveal.assembly.flight;
values.revealAssemblyOvershoot = reveal.assembly.overshoot;
```

- [ ] **Step 4: Implement the assembly handlers in the playground**

In `apps/studio/src/playground/TexturePlayground.tsx`, find where `onRevealWaveLive` and `onRevealWaveCommit` are passed to the schema/handlers. Add `onRevealAssemblyLive`/`onRevealAssemblyCommit` that mirror them exactly, but patch `reveal.assembly` instead of `reveal.wave`. Use the existing wave handlers as the template — the live handler updates the live config ref/state, the commit handler also persists. Example shape (match the existing wave handler implementation in this file):

```tsx
    onRevealAssemblyLive: (patch) =>
      updateRevealLive((reveal) => ({ ...reveal, assembly: { ...reveal.assembly, ...patch } })),
    onRevealAssemblyCommit: (patch) =>
      updateRevealCommit((reveal) => ({ ...reveal, assembly: { ...reveal.assembly, ...patch } })),
```

If the existing wave handlers are written inline against specific setters rather than an `updateRevealLive/Commit` helper, replicate that exact structure for `assembly`. The goal: changing an assembly control updates `revealConfigRef.current.assembly` (live) and the persisted snapshot (commit), identical to how wave controls behave.

- [ ] **Step 5: Typecheck**

Run: `pir typecheck`
Expected: PASS (studio + package).

- [ ] **Step 6: Verify in the studio (manual)**

Confirm the user's dev server is running on the canonical port first (per the dev-server-reuse rule): `curl -s -o /dev/null -w "%{http_code}" http://localhost:4321`. If it is not `200`, ask the user to start it (`pir dev`) — do not start a competing server.

Then in the running studio:

1. Open the Reveal folder, enable reveal, set Reveal type = Assembly.
2. Click Replay — confirm white glowing circles fly in from off-canvas and each cell's stripe crystallizes on arrival.
3. Change Order (center/edges/sweep/random), Come from (scatter/radial/edge), Stagger spread, Glow size, Flight length, and Overshoot — confirm each visibly affects the animation and matches the prototype behavior.
4. Switch Reveal type back to Wave — confirm the wave reveal still works unchanged and the glow overlay is hidden.
5. Reload the page — confirm the assembly settings persisted.

- [ ] **Step 7: Full verification + commit**

Run: `pir verify`
Expected: PASS (tests + typecheck + studio client build).

```bash
git add apps/studio/src/playground/playgroundControlRanges.ts apps/studio/src/playground/playgroundFieldHelp.ts apps/studio/src/playground/playgroundLevaSchema.ts apps/studio/src/playground/TexturePlayground.tsx
git commit -m "feat(reveal): add assembly reveal controls to the studio"
```

---

## Self-review (completed during planning)

- **Spec coverage:** Config + discriminator + legacy compat → Task 1. GPU per-cell timing → Task 3. CPU mirror → Task 2. Glow overlay → Task 4. Scene wiring (construct/attach/resize/teardown/sync/letters branch) → Task 5. Public package → Task 6. Studio UI → Task 7. Tests → Tasks 1, 2, 4 (unit) + Task 7 (manual visual). White glow, no reduced-motion, defaults, out-of-scope items all reflected in Global Constraints. ✓
- **Type consistency:** `assemblyOrderNorm`, `assemblyRevealAmountAtCell`, `resolveAssemblyRevealOvershoot`, `ASSEMBLY_SETTLE` (Task 2) are imported by Tasks 4/5 with matching signatures. `AssemblyGlowOverlay` methods (`resize`, `ensure`, `sync`, `setVisible`, `destroy`, `container`) used in Task 5 match Task 4's definitions. `ASSEMBLY_ORDER_TO_INDEX` (Task 1) consumed in Task 3. The shared timing formula `arrival = o*(1-flight)*spread + flight` is identical across the GLSL (Task 3), CPU mirror (Task 2), and overlay (Task 4). ✓
- **Placeholders:** none — every code step contains complete code; the only "match the existing pattern" note (Task 7 Step 4) points at concrete sibling handlers in the same file and supplies a concrete shape. ✓
