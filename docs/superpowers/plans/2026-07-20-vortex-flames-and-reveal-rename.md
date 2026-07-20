# Vortex Flames, Persistence Restore, and Reveal Rename Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add two vortex motion variants to the background flames effect, restore
localStorage persistence of the lab's engine config, and rename the `hadouken` reveal
type to `vortex` with a migration alias.

**Architecture:** The flames effect is a CPU sim (`flamesSim.ts`) feeding an instanced
GL pass (`flamesPass.ts`) that rasterizes axis-aligned rects into the luminance field.
The new variants add polar-space motion to the sim and one per-instance rotation
attribute to the shader; no new pass, no new pipeline stage. Persistence is a straight
restore of code deleted in commit `29ea2c6`, minus the sticky-background channels that
caused cross-tab poisoning. The rename is mechanical plus one alias in `normalizeReveal`.

**Tech Stack:** TypeScript, WebGL2 / GLSL ES 3.00, Vitest, React + leva (lab app),
pnpm workspace driven by `pi` / `pir`.

## Global Constraints

- Package manager: `pi` for installs, `pir` for scripts. Never `npm`/`pnpm`/`yarn`/`npx`.
- Run tests with `pir test -- <filename-filter>`; full suite is `pir test`.
- No code comments unless a step's code block already contains one.
- Never set a git identity (`git config user.*`, `--author`, `GIT_AUTHOR_*`).
- Never push. Commit only.
- Do not add `prefers-reduced-motion` handling.
- GLSL ES reserved words that WILL fail at runtime only (tests never compile GLSL):
  `half`, `active`, `filter`, `input`, `output`, `fixed`. Do not use them as identifiers.
- No `pow()` with a possibly-negative base. No `clamp()` on an order/timing formula.
- The six existing flame directions (`up`/`down`/`left`/`right`/`upDown`/`leftRight`)
  must render bit-identically after every task in Part 1.
- Reveal invariants unchanged: black at progress 0, exact field at rest, no spring or
  overshoot easing, settled-state early-out.

---

## File Structure

**Part 1 — vortex flames**

| File                                                 | Responsibility                                                         |
| ---------------------------------------------------- | ---------------------------------------------------------------------- |
| `packages/stripes-engine/src/config/types.ts`        | `FlamesDirection` union + `FlamesConfig` fields                        |
| `packages/stripes-engine/src/config/normalize.ts`    | `DEFAULT_FLAMES`, `normalizeFlamesDirection`, `normalizeFlames` clamps |
| `packages/stripes-engine/src/flames/flamesSim.ts`    | all motion: linear (existing), vortex, vortexBits                      |
| `packages/stripes-engine/src/shaders/flames.vert.ts` | per-instance rotation about the rect center                            |
| `packages/stripes-engine/src/passes/flamesPass.ts`   | `aRot` attribute, stride 5→6 / 8→9                                     |
| `packages/stripes-engine/src/engine.ts`              | pass-rebuild trigger on direction/inward change                        |
| `apps/lab/src/controls/levaSchema.ts`                | dropdown entries + `flamesInward` / `flamesSwirlRate`                  |

**Part 2 — persistence**

| File                          | Responsibility                              |
| ----------------------------- | ------------------------------------------- |
| `apps/lab/src/persistence.ts` | restore config map / last-config read+write |
| `apps/lab/src/LabApp.tsx`     | call `saveConfig` on config change          |

**Part 3 — rename**

| File                                                                                           | Responsibility                                   |
| ---------------------------------------------------------------------------------------------- | ------------------------------------------------ |
| `packages/stripes-engine/src/config/types.ts`, `normalize.ts`, `legacy/migrateLegacyConfig.ts` | type, block key, alias                           |
| `packages/stripes-engine/src/passes/vortexPass.ts` + 3 shader files                            | renamed via `git mv`                             |
| `packages/stripes-engine/src/engine.ts`                                                        | import, stage name, branch checks                |
| `apps/lab/src/*`                                                                               | leva keys, defaults, factory JSON, underlayIntro |

---

# PART 1 — VORTEX FLAME VARIANTS

### Task 1: Flames config — new directions and knobs

**Files:**

- Modify: `packages/stripes-engine/src/config/types.ts` (the `FlamesDirection` type and `FlamesConfig` interface)
- Modify: `packages/stripes-engine/src/config/normalize.ts:423` (`DEFAULT_FLAMES`), `:442` (`normalizeFlamesDirection`), `:449` (`normalizeFlames`)
- Test: `packages/stripes-engine/src/config/normalize.test.ts`

**Interfaces:**

- Consumes: nothing.
- Produces: `FlamesDirection` now includes `"vortex" | "vortexBits"`; `FlamesConfig`
  gains `inward: boolean` and `swirlRate: number`. Every later task depends on these.

- [ ] **Step 1: Write the failing test**

Append to `packages/stripes-engine/src/config/normalize.test.ts`:

```ts
describe("normalizeFlames vortex", () => {
  it("accepts the vortex directions", () => {
    expect(normalizeFlames({ direction: "vortex" }).direction).toBe("vortex");
    expect(normalizeFlames({ direction: "vortexBits" }).direction).toBe("vortexBits");
  });

  it("falls back to up for an unknown direction", () => {
    expect(normalizeFlames({ direction: "sideways" as never }).direction).toBe("up");
  });

  it("defaults inward false and swirlRate 1.2", () => {
    const f = normalizeFlames({});
    expect(f.inward).toBe(false);
    expect(f.swirlRate).toBeCloseTo(1.2);
  });

  it("clamps swirlRate to 0..6 and coerces inward", () => {
    expect(normalizeFlames({ swirlRate: -3 }).swirlRate).toBe(0);
    expect(normalizeFlames({ swirlRate: 99 }).swirlRate).toBe(6);
    expect(normalizeFlames({ inward: 1 as never }).inward).toBe(true);
  });
});
```

If `normalizeFlames` is not already imported at the top of that file, add it to the
existing import from `"./normalize"`.

- [ ] **Step 2: Run test to verify it fails**

Run: `pir test -- normalize.test`
Expected: FAIL — `direction` is `"up"` for `"vortex"`, and `inward`/`swirlRate` are `undefined`.

- [ ] **Step 3: Extend the type**

In `packages/stripes-engine/src/config/types.ts`, replace the `FlamesDirection` type
and add two fields to `FlamesConfig`:

```ts
export type FlamesDirection = "up" | "down" | "left" | "right" | "upDown" | "leftRight" | "vortex" | "vortexBits";

export interface FlamesConfig {
  enabled: boolean;
  direction: FlamesDirection;
  inward: boolean;
  swirlRate: number;
  minWidthRatio: number;
  maxWidthRatio: number;
  minHeightRatio: number;
  maxHeightRatio: number;
  baseSpeedPxPerSec: number;
  speedVariation: number;
  spawnIntervalMs: number;
  spawnJitterMs: number;
  maxActive: number;
  edgeSharpness: number;
  opacityMin: number;
  opacityMax: number;
}
```

- [ ] **Step 4: Extend the normalizer**

In `packages/stripes-engine/src/config/normalize.ts`, add `inward: false` and
`swirlRate: 1.2` to `DEFAULT_FLAMES` (immediately after `direction: "up"`), then
replace `normalizeFlamesDirection` with a list-driven version:

```ts
const FLAMES_DIRECTIONS: readonly FlamesDirection[] = [
  "up",
  "down",
  "left",
  "right",
  "upDown",
  "leftRight",
  "vortex",
  "vortexBits",
];

function normalizeFlamesDirection(value: unknown): FlamesDirection {
  return FLAMES_DIRECTIONS.includes(value as FlamesDirection) ? (value as FlamesDirection) : "up";
}
```

In the object returned by `normalizeFlames`, add these two entries directly after the
`direction:` line:

```ts
    inward: i.inward !== undefined ? !!i.inward : DEFAULT_FLAMES.inward,
    swirlRate: clamp(num(i.swirlRate, DEFAULT_FLAMES.swirlRate), 0, 6),
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `pir test -- normalize.test`
Expected: PASS, including all pre-existing flames tests.

- [ ] **Step 6: Typecheck**

Run: `pir typecheck`
Expected: clean. If `defaultLabConfig.ts` or `factoryDefaults.json` typing complains
about the missing `inward`/`swirlRate`, leave it — those are optional in
`Partial<EngineConfig>` and normalize fills them.

- [ ] **Step 7: Commit**

```bash
git add packages/stripes-engine/src/config/types.ts packages/stripes-engine/src/config/normalize.ts packages/stripes-engine/src/config/normalize.test.ts
git commit -m "feat(engine): vortex flame directions + inward/swirlRate config"
```

---

### Task 2: Vortex spiral motion in the sim

**Files:**

- Modify: `packages/stripes-engine/src/flames/flamesSim.ts`
- Test: `packages/stripes-engine/src/flames/flamesSim.test.ts` (create if absent)

**Interfaces:**

- Consumes: `FlamesConfig.inward`, `FlamesConfig.swirlRate`, `FlamesDirection` values
  `"vortex"` / `"vortexBits"` from Task 1.
- Produces:
  - `Flame` gains `rot: number` (radians, 0 for linear directions), plus vortex state
    `pivotX`, `pivotY`, `radius`, `angle`, `angVel`, `radialSign`, `baseOpacity`,
    `bornMs`, `lifeMs`. All fields are required and set for every flame.
  - `export function isVortexFlamesDirection(d: FlamesDirection): boolean`
  - `isFlameVisible` signature becomes `(flame, display, nowMs)` — it is module-private,
    but `stepFlames` callers are unaffected.

- [ ] **Step 1: Write the failing test**

Create `packages/stripes-engine/src/flames/flamesSim.test.ts` (if the file exists,
append the `describe` block instead):

```ts
import { describe, it, expect } from "vitest";
import { createFlamesState, stepFlames, isVortexFlamesDirection } from "./flamesSim";
import { normalizeFlames } from "../config/normalize";

const DISPLAY = { width: 800, height: 600 };

function vortexConfig(overrides = {}) {
  return normalizeFlames({
    enabled: true,
    direction: "vortex",
    maxActive: 12,
    baseSpeedPxPerSec: 100,
    speedVariation: 0,
    swirlRate: 2,
    ...overrides,
  });
}

function seededRandom() {
  let s = 1;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

describe("isVortexFlamesDirection", () => {
  it("is true only for the vortex family", () => {
    expect(isVortexFlamesDirection("vortex")).toBe(true);
    expect(isVortexFlamesDirection("vortexBits")).toBe(true);
    expect(isVortexFlamesDirection("up")).toBe(false);
    expect(isVortexFlamesDirection("leftRight")).toBe(false);
  });
});

describe("vortex motion", () => {
  it("seeds particles and grows their radius outward", () => {
    const state = createFlamesState(seededRandom());
    const config = vortexConfig();
    stepFlames(state, config, DISPLAY, 0);
    expect(state.flames.length).toBe(12);
    const before = state.flames.map((f) => f.radius);
    stepFlames(state, config, DISPLAY, 100);
    state.flames.forEach((f, i) => {
      expect(f.radius).toBeGreaterThan(before[i]);
    });
  });

  it("shrinks radius when inward", () => {
    const state = createFlamesState(seededRandom());
    const config = vortexConfig({ inward: true });
    stepFlames(state, config, DISPLAY, 0);
    const before = state.flames.map((f) => f.radius);
    stepFlames(state, config, DISPLAY, 100);
    state.flames.forEach((f, i) => {
      expect(f.radius).toBeLessThan(before[i]);
    });
  });

  it("advances the angle so the path curves", () => {
    const state = createFlamesState(seededRandom());
    const config = vortexConfig();
    stepFlames(state, config, DISPLAY, 0);
    const before = state.flames[0].angle;
    stepFlames(state, config, DISPLAY, 500);
    expect(state.flames[0].angle).not.toBeCloseTo(before);
  });

  it("keeps rot at zero for linear directions", () => {
    const state = createFlamesState(seededRandom());
    const config = normalizeFlames({ enabled: true, direction: "up", maxActive: 5 });
    stepFlames(state, config, DISPLAY, 0);
    state.flames.forEach((f) => expect(f.rot).toBe(0));
  });

  it("culls outward particles once past the rim", () => {
    const state = createFlamesState(seededRandom());
    const config = vortexConfig({ baseSpeedPxPerSec: 500, spawnIntervalMs: 5000 });
    stepFlames(state, config, DISPLAY, 0);
    stepFlames(state, config, DISPLAY, 10000);
    expect(state.flames.length).toBe(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pir test -- flamesSim`
Expected: FAIL — `isVortexFlamesDirection` is not exported.

- [ ] **Step 3: Extend the Flame shape and add the vortex helpers**

In `packages/stripes-engine/src/flames/flamesSim.ts`, replace the `Flame` interface:

```ts
export interface Flame {
  x: number;
  y: number;
  width: number;
  height: number;
  speedPxPerSec: number;
  opacity: number;
  colorSeed: number;
  direction: FlamesDirection;
  rot: number;
  pivotX: number;
  pivotY: number;
  radius: number;
  angle: number;
  angVel: number;
  radialSign: number;
  baseOpacity: number;
  bornMs: number;
  lifeMs: number;
}
```

Add next to `isVerticalFlamesDirection`:

```ts
export function isVortexFlamesDirection(d: FlamesDirection): boolean {
  return d === "vortex" || d === "vortexBits";
}

function vortexMaxRadius(displayWidth: number, displayHeight: number): number {
  return 0.5 * Math.hypot(displayWidth, displayHeight);
}

function applyVortexTransform(flame: Flame): void {
  const cx = flame.pivotX + Math.cos(flame.angle) * flame.radius;
  const cy = flame.pivotY + Math.sin(flame.angle) * flame.radius;
  flame.x = cx - flame.width * 0.5;
  flame.y = cy - flame.height * 0.5;
  const radialVel = flame.radialSign * flame.speedPxPerSec;
  const tangentialVel = flame.radius * flame.angVel;
  flame.rot = flame.angle + Math.atan2(tangentialVel, radialVel);
}
```

In `createFlame`, give every returned object the new fields. The cleanest way is to
build a common base and spread it — replace the two `return { ... }` blocks with:

```ts
const base = {
  width,
  height,
  speedPxPerSec,
  opacity,
  colorSeed,
  direction,
  rot: 0,
  pivotX: 0,
  pivotY: 0,
  radius: 0,
  angle: 0,
  angVel: 0,
  radialSign: 1,
  baseOpacity: opacity,
  bornMs: 0,
  lifeMs: 0,
};

if (isVortexFlamesDirection(direction)) {
  return { ...base, x: 0, y: 0 };
}

if (isVerticalFlamesDirection(direction)) {
  return {
    ...base,
    x: randomFlameCrossAxisPosition(state.random, displayWidth, width),
    y: 0,
  };
}

return {
  ...base,
  x: 0,
  y: randomFlameCrossAxisPosition(state.random, displayHeight, height),
};
```

- [ ] **Step 4: Add vortex placement**

Add below `placeSeededFlame`:

```ts
function placeVortexFlame(
  flame: Flame,
  config: FlamesConfig,
  displayWidth: number,
  displayHeight: number,
  random: () => number,
  seeded: boolean,
): void {
  flame.pivotX = displayWidth * 0.5;
  flame.pivotY = displayHeight * 0.5;
  flame.angle = random() * Math.PI * 2;
  flame.angVel = config.swirlRate * (1 + (random() - 0.5) * config.speedVariation);
  flame.radialSign = config.inward ? -1 : 1;

  const rMax = vortexMaxRadius(displayWidth, displayHeight);
  if (seeded) {
    flame.radius = randomBetween(random, 2, rMax);
  } else if (config.inward) {
    flame.radius = rMax * randomBetween(random, 1, 1.08);
  } else {
    flame.radius = randomBetween(random, 2, 8);
  }
  applyVortexTransform(flame);
}
```

- [ ] **Step 5: Route spawn and seed through it**

In `spawnFlame`, replace the `placeSpawnedFlame(...)` call with:

```ts
if (isVortexFlamesDirection(flame.direction)) {
  placeVortexFlame(flame, config, displayWidth, displayHeight, state.random, false);
} else {
  placeSpawnedFlame(flame, flame.direction, displayWidth, displayHeight);
}
```

In `seedFlames`, replace the `placeSeededFlame(...)` call with:

```ts
if (isVortexFlamesDirection(flame.direction)) {
  placeVortexFlame(flame, config, displayWidth, displayHeight, state.random, true);
} else {
  placeSeededFlame(flame, flame.direction, displayWidth, displayHeight, state.random);
}
```

- [ ] **Step 6: Integrate motion and culling**

Replace `isFlameVisible` with the three-argument version:

```ts
function isFlameVisible(flame: Flame, display: { width: number; height: number }, nowMs: number): boolean {
  switch (flame.direction) {
    case "up":
      return flame.y + flame.height >= 0;
    case "down":
      return flame.y <= display.height;
    case "left":
      return flame.x + flame.width >= 0;
    case "right":
      return flame.x <= display.width;
    case "vortex": {
      if (flame.radialSign < 0) return flame.radius > 4;
      const cull = 0.5 * Math.hypot(flame.width, flame.height);
      return flame.radius <= vortexMaxRadius(display.width, display.height) + cull;
    }
    case "vortexBits":
      return nowMs - flame.bornMs < flame.lifeMs;
    default:
      return false;
  }
}
```

In `stepFlames`, add a `vortex` case to the per-flame `switch`:

```ts
      case "vortex":
        flame.radius += flame.radialSign * flame.speedPxPerSec * dtSec;
        flame.angle += flame.angVel * dtSec;
        applyVortexTransform(flame);
        break;
```

and update the filter call:

```ts
state.flames = state.flames.filter((flame) => isFlameVisible(flame, display, nowMs));
```

- [ ] **Step 7: Run tests to verify they pass**

Run: `pir test -- flamesSim`
Expected: PASS. The `vortexBits` case in `isFlameVisible` is dead until Task 3 — that
is expected.

- [ ] **Step 8: Run the full suite and typecheck**

Run: `pir test && pir typecheck`
Expected: PASS. Existing flames tests must be untouched — if any fail, the linear
paths regressed.

- [ ] **Step 9: Commit**

```bash
git add packages/stripes-engine/src/flames/flamesSim.ts packages/stripes-engine/src/flames/flamesSim.test.ts
git commit -m "feat(engine): vortex spiral flame motion (outward/inward)"
```

---

### Task 3: Vortex bits motion

**Files:**

- Modify: `packages/stripes-engine/src/flames/flamesSim.ts`
- Test: `packages/stripes-engine/src/flames/flamesSim.test.ts`

**Interfaces:**

- Consumes: `Flame.bornMs`, `Flame.lifeMs`, `Flame.baseOpacity`, `applyVortexTransform`,
  `isVortexFlamesDirection` from Task 2.
- Produces: nothing new for later tasks.

- [ ] **Step 1: Write the failing test**

Append to `packages/stripes-engine/src/flames/flamesSim.test.ts`:

```ts
describe("vortex bits", () => {
  const bitsConfig = () =>
    normalizeFlames({
      enabled: true,
      direction: "vortexBits",
      maxActive: 20,
      swirlRate: 3,
      speedVariation: 0,
      opacityMin: 1,
      opacityMax: 1,
    });

  it("scatters pivots across the canvas instead of the center", () => {
    const state = createFlamesState(seededRandom());
    stepFlames(state, bitsConfig(), DISPLAY, 0);
    const pivots = new Set(state.flames.map((f) => `${Math.round(f.pivotX)},${Math.round(f.pivotY)}`));
    expect(pivots.size).toBeGreaterThan(5);
  });

  it("keeps each bit at a constant orbit radius", () => {
    const state = createFlamesState(seededRandom());
    const config = bitsConfig();
    stepFlames(state, config, DISPLAY, 0);
    const before = state.flames[0].radius;
    stepFlames(state, config, DISPLAY, 200);
    expect(state.flames[0].radius).toBeCloseTo(before);
  });

  it("fades in from zero and expires after its lifetime", () => {
    const state = createFlamesState(seededRandom());
    const config = bitsConfig();
    stepFlames(state, config, DISPLAY, 0);
    const bit = state.flames[0];
    bit.bornMs = 0;
    bit.lifeMs = 1000;
    stepFlames(state, config, DISPLAY, 1);
    expect(state.flames[0].opacity).toBeLessThan(state.flames[0].baseOpacity);

    stepFlames(state, config, DISPLAY, 5000);
    expect(state.flames.every((f) => f.lifeMs > 0)).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pir test -- flamesSim`
Expected: FAIL — pivots all sit at the canvas center and radius is 0.

- [ ] **Step 3: Add bit placement**

In `packages/stripes-engine/src/flames/flamesSim.ts`, add below `placeVortexFlame`:

```ts
function placeVortexBit(
  flame: Flame,
  config: FlamesConfig,
  displayWidth: number,
  displayHeight: number,
  random: () => number,
  nowMs: number,
  seeded: boolean,
): void {
  flame.pivotX = random() * displayWidth;
  flame.pivotY = random() * displayHeight;
  flame.angle = random() * Math.PI * 2;
  flame.radius = flame.width;
  flame.radialSign = 0;
  flame.angVel = config.swirlRate * (random() < 0.5 ? -1 : 1) * (1 + (random() - 0.5) * config.speedVariation);
  flame.lifeMs = randomBetween(random, 600, 1800);
  flame.bornMs = seeded ? nowMs - random() * flame.lifeMs : nowMs;
  applyVortexTransform(flame);
}

function vortexBitEnvelope(t: number): number {
  const fadeIn = smoothstep01(t / 0.25);
  const fadeOut = 1 - smoothstep01((t - 0.65) / 0.35);
  return Math.max(0, fadeIn * fadeOut);
}

function smoothstep01(x: number): number {
  const c = Math.min(1, Math.max(0, x));
  return c * c * (3 - 2 * c);
}
```

`radialSign: 0` makes `applyVortexTransform` compute `atan2(tangential, 0)`, i.e. a
pure tangent — exactly right for a circular orbit, and `Math.atan2` is well-defined at
a zero second argument.

- [ ] **Step 4: Route spawn and seed through it**

In `spawnFlame`, change the vortex branch to distinguish the two variants. Note
`spawnFlame` needs `nowMs`, so change its signature and its one call site in
`stepFlames` to pass `nowMs`:

```ts
function spawnFlame(
  state: FlamesState,
  config: FlamesConfig,
  displayWidth: number,
  displayHeight: number,
  nowMs: number,
): Flame {
  const direction = pickFlameDirection(state, config.direction);
  const flame = createFlame(state, config, displayWidth, displayHeight, direction);
  if (flame.direction === "vortexBits") {
    placeVortexBit(flame, config, displayWidth, displayHeight, state.random, nowMs, false);
  } else if (flame.direction === "vortex") {
    placeVortexFlame(flame, config, displayWidth, displayHeight, state.random, false);
  } else {
    placeSpawnedFlame(flame, flame.direction, displayWidth, displayHeight);
  }
  return flame;
}
```

Call site in `stepFlames`:

```ts
state.flames.push(spawnFlame(state, config, display.width, display.height, nowMs));
```

`seedFlames` likewise needs `nowMs` — change its signature to
`(state, config, displayWidth, displayHeight, nowMs)`, update its call in `stepFlames`
to `seedFlames(state, config, display.width, display.height, nowMs)`, and change its
placement branch to:

```ts
if (flame.direction === "vortexBits") {
  placeVortexBit(flame, config, displayWidth, displayHeight, state.random, nowMs, true);
} else if (flame.direction === "vortex") {
  placeVortexFlame(flame, config, displayWidth, displayHeight, state.random, true);
} else {
  placeSeededFlame(flame, flame.direction, displayWidth, displayHeight, state.random);
}
```

- [ ] **Step 5: Add the motion case**

Add to the per-flame `switch` in `stepFlames`, next to the `vortex` case:

```ts
      case "vortexBits": {
        flame.angle += flame.angVel * dtSec;
        applyVortexTransform(flame);
        const t = flame.lifeMs > 0 ? (nowMs - flame.bornMs) / flame.lifeMs : 1;
        flame.opacity = flame.baseOpacity * vortexBitEnvelope(t);
        break;
      }
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `pir test -- flamesSim`
Expected: PASS.

- [ ] **Step 7: Run the full suite and typecheck**

Run: `pir test && pir typecheck`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add packages/stripes-engine/src/flames/flamesSim.ts packages/stripes-engine/src/flames/flamesSim.test.ts
git commit -m "feat(engine): vortex bits — scattered micro-swirls with lifecycle fade"
```

---

### Task 4: Per-instance rotation in the shader and pass

**Files:**

- Modify: `packages/stripes-engine/src/shaders/flames.vert.ts`
- Modify: `packages/stripes-engine/src/passes/flamesPass.ts`

**Interfaces:**

- Consumes: `Flame.rot` from Task 2.
- Produces: nothing new — the pass API (`render`, `renderColors`, `dispose`) and
  `FlamesOpts` are unchanged.

There is no unit test for this task: the repo never compiles GLSL under Vitest. It is
verified in the browser in Task 11. The correctness argument is that at `aRot == 0` the
new expression is algebraically identical to the old one:
`aRect.xy + halfSize + (corner - 0.5) * aRect.zw === aRect.xy + corner * aRect.zw`.

- [ ] **Step 1: Rewrite both vertex shaders**

Replace the entire contents of `packages/stripes-engine/src/shaders/flames.vert.ts`:

```ts
export const FLAMES_VERT = `#version 300 es
precision highp float;
in vec4 aRect;
in float aOpacity;
in float aRot;
uniform vec2 uCanvas;
uniform float uVertical;
out float vCross;
out float vOpacity;
void main() {
  vec2 corner = vec2(float(gl_VertexID == 1 || gl_VertexID == 4 || gl_VertexID == 5), float(gl_VertexID == 2 || gl_VertexID == 3 || gl_VertexID == 5));
  vec2 halfSize = aRect.zw * 0.5;
  vec2 local = (corner - 0.5) * aRect.zw;
  float cs = cos(aRot);
  float sn = sin(aRot);
  vec2 rotated = vec2(local.x * cs - local.y * sn, local.x * sn + local.y * cs);
  vec2 worldPx = aRect.xy + halfSize + rotated;
  vec2 uv = worldPx / uCanvas;
  gl_Position = vec4(uv.x * 2.0 - 1.0, 1.0 - uv.y * 2.0, 0.0, 1.0);
  vCross = (uVertical > 0.5) ? corner.x : corner.y;
  vOpacity = aOpacity;
}
`;

export const FLAMES_COLOR_VERT = `#version 300 es
precision highp float;
in vec4 aRect;
in float aOpacity;
in float aRot;
in vec3 aColor;
uniform vec2 uCanvas;
uniform float uVertical;
out float vCross;
out float vOpacity;
out vec3 vColor;
void main() {
  vec2 corner = vec2(float(gl_VertexID == 1 || gl_VertexID == 4 || gl_VertexID == 5), float(gl_VertexID == 2 || gl_VertexID == 3 || gl_VertexID == 5));
  vec2 halfSize = aRect.zw * 0.5;
  vec2 local = (corner - 0.5) * aRect.zw;
  float cs = cos(aRot);
  float sn = sin(aRot);
  vec2 rotated = vec2(local.x * cs - local.y * sn, local.x * sn + local.y * cs);
  vec2 worldPx = aRect.xy + halfSize + rotated;
  vec2 uv = worldPx / uCanvas;
  gl_Position = vec4(uv.x * 2.0 - 1.0, 1.0 - uv.y * 2.0, 0.0, 1.0);
  vCross = (uVertical > 0.5) ? corner.x : corner.y;
  vOpacity = aOpacity;
  vColor = aColor;
}
`;
```

`halfSize` — not `half`, which is reserved in GLSL ES and fails to compile at runtime
while every unit test still passes.

- [ ] **Step 2: Widen the strides**

In `packages/stripes-engine/src/passes/flamesPass.ts`, change the two constants at the
top of the file:

```ts
const LUM_FLOATS_PER_INSTANCE = 6;
const LUM_STRIDE_BYTES = LUM_FLOATS_PER_INSTANCE * 4;
const COLOR_FLOATS_PER_INSTANCE = 9;
const COLOR_STRIDE_BYTES = COLOR_FLOATS_PER_INSTANCE * 4;
```

- [ ] **Step 3: Bind the new attribute in both VAOs**

In the lum VAO block, after the `aOpacity` lines, add:

```ts
const aRot = gl.getAttribLocation(lumProgram, "aRot");
gl.enableVertexAttribArray(aRot);
gl.vertexAttribPointer(aRot, 1, gl.FLOAT, false, lumStride, 20);
gl.vertexAttribDivisor(aRot, 1);
```

In the color VAO block, add the same for `colorProgram` and shift `aColor` to offset
24:

```ts
const aRot = gl.getAttribLocation(colorProgram, "aRot");
gl.enableVertexAttribArray(aRot);
gl.vertexAttribPointer(aRot, 1, gl.FLOAT, false, colorStride, 20);
gl.vertexAttribDivisor(aRot, 1);
gl.enableVertexAttribArray(aColor);
gl.vertexAttribPointer(aColor, 3, gl.FLOAT, false, colorStride, 24);
gl.vertexAttribDivisor(aColor, 1);
```

(The existing `aColor` two lines are replaced by the two above; keep the single
`const aColor = gl.getAttribLocation(colorProgram, "aColor");` declaration where it is.)

- [ ] **Step 4: Pack the new float**

In `packLum`, add after the `opacity` write:

```ts
lumData[base + 5] = f.rot;
```

In the color packing loop inside `renderColors`, replace the writes from index 5
onward:

```ts
colorData[base + 5] = f.rot;
colorData[base + 6] = pick.r / 255;
colorData[base + 7] = pick.g / 255;
colorData[base + 8] = pick.b / 255;
```

- [ ] **Step 5: Run the full suite and typecheck**

Run: `pir test && pir typecheck`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/stripes-engine/src/shaders/flames.vert.ts packages/stripes-engine/src/passes/flamesPass.ts
git commit -m "feat(engine): per-instance rotation for flame quads"
```

---

### Task 5: Engine rebuild trigger

**Files:**

- Modify: `packages/stripes-engine/src/engine.ts` (the `setConfig` rebuild condition around line 1171, and the sibling `last*` declarations)
- Test: `packages/stripes-engine/src/engine.topology.test.ts`

**Interfaces:**

- Consumes: `FlamesConfig.direction`, `FlamesConfig.inward` from Task 1.
- Produces: nothing.

Switching between the linear and vortex families changes what a pooled particle means,
so the pool must be recreated. `inward` is included alongside `direction` because
flipping it changes where particles spawn; without a reset, in-flight particles keep
their old `radialSign` until they die.

- [ ] **Step 1: Declare the tracking variables**

Find where `lastFlamesEnabled` is declared in `packages/stripes-engine/src/engine.ts`
and add two siblings immediately after it:

```ts
let lastFlamesDirection = config.flames.direction;
let lastFlamesInward = config.flames.inward;
```

- [ ] **Step 2: Extend the rebuild condition**

In the `if (...)` chain inside `setConfig`, add two clauses directly after the
`config.flames.enabled !== lastFlamesEnabled ||` line:

```ts
        config.flames.direction !== lastFlamesDirection ||
        config.flames.inward !== lastFlamesInward ||
```

- [ ] **Step 3: Reset the flames pool when they change**

Inside that `if` block, replace the existing flames-state guard with one that also
fires on a family or direction change:

```ts
if (
  config.flames.enabled &&
  (!lastFlamesEnabled || config.flames.direction !== lastFlamesDirection || config.flames.inward !== lastFlamesInward)
) {
  flamesState = createFlamesState(mulberry32(flamesSeed));
}
```

- [ ] **Step 4: Record the new values**

Alongside the other `lastX = ...` assignments at the end of that block (next to
`lastStripesEnabled = config.stripesEnabled;`), add:

```ts
lastFlamesDirection = config.flames.direction;
lastFlamesInward = config.flames.inward;
```

- [ ] **Step 5: Add a topology test**

Append to `packages/stripes-engine/src/engine.topology.test.ts`, following the shape of
the existing tests in that file (reuse whatever harness the neighbouring tests use to
construct an engine and read its pass kinds):

```ts
it("keeps the flames field pass across a vortex direction change", () => {
  const harness = createTopologyHarness({ flames: { enabled: true, direction: "up" } });
  expect(harness.passKinds()).toContain("flamesField");
  harness.setConfig({ flames: { enabled: true, direction: "vortex" } });
  expect(harness.passKinds()).toContain("flamesField");
});
```

If the existing tests in that file use a different helper name than
`createTopologyHarness`, use theirs — read the top of the file first and match it
exactly rather than introducing a new harness.

- [ ] **Step 6: Run tests and typecheck**

Run: `pir test && pir typecheck`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add packages/stripes-engine/src/engine.ts packages/stripes-engine/src/engine.topology.test.ts
git commit -m "feat(engine): rebuild flames pool on direction/inward change"
```

---

### Task 6: Lab controls for the vortex variants

**Files:**

- Modify: `apps/lab/src/controls/levaSchema.ts` (the `"Background Flames"` folder around line 1128, and the `flames:` output block around line 2276)
- Modify: `apps/lab/src/defaultLabConfig.ts` (the `flames:` block around line 215)

**Interfaces:**

- Consumes: `FlamesConfig.inward` / `.swirlRate` from Task 1.
- Produces: leva keys `flamesInward`, `flamesSwirlRate`.

- [ ] **Step 1: Add the dropdown entries**

In the `flamesDirection` control's `options` object, add two entries after
`"Left - Right": "leftRight",`:

```ts
              Vortex: "vortex",
              "Vortex Bits": "vortexBits",
```

- [ ] **Step 2: Add the two controls**

Immediately after the `flamesDirection` control block, insert:

```ts
          flamesInward: {
            value: d.flames.inward,
            label: "Inward",
            render: (get) =>
              get("Background Flames.flamesEnabled") === true &&
              get("Background Flames.flamesDirection") === "vortex",
          },
          flamesSwirlRate: {
            value: d.flames.swirlRate,
            min: 0,
            max: 6,
            step: 0.05,
            label: "Swirl",
            render: (get) => {
              if (get("Background Flames.flamesEnabled") !== true) return false;
              const dir = get("Background Flames.flamesDirection");
              return dir === "vortex" || dir === "vortexBits";
            },
          },
```

- [ ] **Step 3: Map them into the config**

In the `flames:` output block, add two entries after the `direction:` line:

```ts
      inward: values.flamesInward,
      swirlRate: values.flamesSwirlRate,
```

- [ ] **Step 4: Add the lab defaults**

In `apps/lab/src/defaultLabConfig.ts`, add to the `flames:` block after `direction`:

```ts
    inward: false,
    swirlRate: 1.2,
```

- [ ] **Step 5: Run tests, typecheck, and build**

Run: `pir test && pir typecheck && pir build`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/lab/src/controls/levaSchema.ts apps/lab/src/defaultLabConfig.ts
git commit -m "feat(lab): vortex + vortex bits flame directions with Inward/Swirl controls"
```

---

# PART 2 — RESTORE CONFIG PERSISTENCE

### Task 7: Restore read/write of the engine config

**Files:**

- Modify: `apps/lab/src/persistence.ts`
- Test: `apps/lab/src/persistence.test.ts`

**Interfaces:**

- Consumes: `DEFAULT_LAB_ENGINE_CONFIG` (already imported in the file).
- Produces:
  - `export function saveConfig(textureId: string, c: EngineConfig): void`
  - `export function deleteConfig(textureId: string): void`
  - `loadInitialConfig` signature changes from `()` to `(textureId: string)`.

The sticky-background subsystem stays deleted. `loadStickyBackgroundColor` /
`saveStickyBackgroundColor` / `clearStickyBackgroundColor` remain no-op stubs, and the
cookie / `window.name` / `?bg=` scrubbing helpers keep running — those channels are
shared across every localhost port and let a stale tab re-poison other sessions.
Background color persists only as an ordinary field inside the config blob.

- [ ] **Step 1: Write the failing test**

Append to `apps/lab/src/persistence.test.ts` (match the file's existing import list and
its `beforeEach` storage-clearing pattern):

```ts
describe("engine config persistence", () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    resumePersistenceWritesForTests();
  });

  it("returns the lab defaults when nothing is stored", () => {
    expect(loadInitialConfig("tex-a")).toEqual(DEFAULT_LAB_ENGINE_CONFIG);
  });

  it("round-trips a per-texture config", () => {
    const config = { ...DEFAULT_LAB_ENGINE_CONFIG, fieldScale: 0.42 } as EngineConfig;
    saveConfig("tex-a", config);
    expect(loadInitialConfig("tex-a").fieldScale).toBe(0.42);
  });

  it("falls back to the last saved config for an unknown texture", () => {
    const config = { ...DEFAULT_LAB_ENGINE_CONFIG, fieldScale: 0.31 } as EngineConfig;
    saveConfig("tex-a", config);
    expect(loadInitialConfig("tex-b").fieldScale).toBe(0.31);
  });

  it("prefers a staged pending config over stored state", () => {
    saveConfig("tex-a", { ...DEFAULT_LAB_ENGINE_CONFIG, fieldScale: 0.31 } as EngineConfig);
    stagePendingConfig({ fieldScale: 0.77 });
    expect(loadInitialConfig("tex-a").fieldScale).toBe(0.77);
  });

  it("consumes the pending config exactly once", () => {
    saveConfig("tex-a", { ...DEFAULT_LAB_ENGINE_CONFIG, fieldScale: 0.31 } as EngineConfig);
    stagePendingConfig({ fieldScale: 0.77 });
    loadInitialConfig("tex-a");
    expect(loadInitialConfig("tex-a").fieldScale).toBe(0.31);
  });

  it("does not write after a factory reset until reload", () => {
    factoryResetSettings();
    saveConfig("tex-a", { ...DEFAULT_LAB_ENGINE_CONFIG, fieldScale: 0.42 } as EngineConfig);
    expect(localStorage.getItem("stripes-engine-lab-by-texture")).toBeNull();
  });

  it("deletes a stored per-texture config", () => {
    saveConfig("tex-a", DEFAULT_LAB_ENGINE_CONFIG as EngineConfig);
    deleteConfig("tex-a");
    const raw = localStorage.getItem("stripes-engine-lab-by-texture");
    expect(raw === null || JSON.parse(raw)["tex-a"] === undefined).toBe(true);
  });
});
```

Add `saveConfig`, `deleteConfig`, and `stagePendingConfig` to the file's existing
import from `"./persistence"`, and `DEFAULT_LAB_ENGINE_CONFIG` from
`"./defaultLabConfig"` if not already present.

- [ ] **Step 2: Run test to verify it fails**

Run: `pir test -- persistence.test`
Expected: FAIL — `saveConfig` and `deleteConfig` are not exported, and
`loadInitialConfig` takes no argument.

- [ ] **Step 3: Restore the storage helpers**

In `apps/lab/src/persistence.ts`, add above `normalizeColor`:

```ts
function loadConfigMap(): Record<string, Partial<EngineConfig>> {
  try {
    const raw = localStorage.getItem(MAP_KEY);
    if (raw) return JSON.parse(raw) as Record<string, Partial<EngineConfig>>;
  } catch {
    /* ignore corrupt storage */
  }
  return {};
}

function loadLastConfig(): Partial<EngineConfig> | null {
  try {
    const raw = localStorage.getItem(LAST_KEY);
    return raw ? (JSON.parse(raw) as Partial<EngineConfig>) : null;
  } catch {
    return null;
  }
}

function saveLastConfig(c: Partial<EngineConfig>): void {
  try {
    localStorage.setItem(LAST_KEY, JSON.stringify(c));
  } catch {
    /* ignore quota errors */
  }
}
```

- [ ] **Step 4: Replace loadInitialConfig and add the writers**

Replace the existing `clearPersistedEngineConfig` + `loadInitialConfig` pair with:

```ts
export function loadInitialConfig(textureId: string): Partial<EngineConfig> {
  const pending = readPendingConfig();
  if (pending) return pending;
  try {
    const map = loadConfigMap();
    if (textureId in map) return map[textureId] ?? DEFAULT_LAB_ENGINE_CONFIG;
    const last = loadLastConfig();
    if (last) return last;
  } catch {
    /* ignore corrupt storage */
  }
  return DEFAULT_LAB_ENGINE_CONFIG;
}

export function saveConfig(textureId: string, c: EngineConfig): void {
  if (!persistenceWritesEnabled) return;
  try {
    const map = loadConfigMap();
    map[textureId] = c;
    localStorage.setItem(MAP_KEY, JSON.stringify(map));
    saveLastConfig(c);
  } catch {
    /* ignore quota errors */
  }
}

export function deleteConfig(textureId: string): void {
  if (!persistenceWritesEnabled) return;
  try {
    const map = loadConfigMap();
    if (textureId in map) {
      delete map[textureId];
      localStorage.setItem(MAP_KEY, JSON.stringify(map));
    }
  } catch {
    /* ignore */
  }
}
```

`clearPersistedEngineConfig` is deleted entirely — `factoryResetSettings` already
removes `MAP_KEY`, `LAST_KEY`, and `LAST_BACKGROUND_COLOR_KEY` directly, plus the
cookie / `window.name` / URL scrubbing, so nothing is lost.

- [ ] **Step 5: Fix the boot call site**

In `apps/lab/src/controls/levaSchema.ts` line ~391, pass the texture id that the
enclosing `useMemo` is already keyed on:

```ts
const loaded = normalizeEngineConfig(loadInitialConfig(initialTextureId));
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `pir test -- persistence.test`
Expected: PASS.

- [ ] **Step 7: Run the full suite, typecheck, and build**

Run: `pir test && pir typecheck && pir build`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add apps/lab/src/persistence.ts apps/lab/src/persistence.test.ts apps/lab/src/controls/levaSchema.ts
git commit -m "feat(lab): restore localStorage persistence of the engine config"
```

---

### Task 8: Write the config on change

**Files:**

- Modify: `apps/lab/src/LabApp.tsx` (import block at line 25-38; new effect beside the `saveTextureId` effect at line 1587)

**Interfaces:**

- Consumes: `saveConfig` from Task 7.
- Produces: nothing.

- [ ] **Step 1: Import saveConfig**

Add `saveConfig,` to the existing import from `"./persistence"` in
`apps/lab/src/LabApp.tsx`.

- [ ] **Step 2: Add the persistence effect**

Insert directly above the existing `useEffect` at line 1587 (the one calling
`saveTextureId(textureId)`):

```tsx
useEffect(() => {
  saveConfig(textureId, config);
}, [config, textureId]);
```

If the engine config in scope is named something other than `config` (read the
component's local bindings — `controls` is the leva snapshot and `controlsRef.current`
is used at the `stagePendingConfig` call sites), use whichever value is the normalized
`EngineConfig` handed to the engine, and match its identity in the dependency array.

- [ ] **Step 3: Verify the write path manually**

Run: `pir dev --host` in a background shell if no dev server is already on port 5174
(probe first: `curl -s -o /dev/null -w "%{http_code}" http://localhost:5174`). Open the
lab, change any slider, then in DevTools:

```js
JSON.parse(localStorage.getItem("stripes-engine-lab-last-config")).fieldScale;
```

Expected: reflects the current UI value. Reload — the change survives.

- [ ] **Step 4: Run the full suite, typecheck, and build**

Run: `pir test && pir typecheck && pir build`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/lab/src/LabApp.tsx
git commit -m "feat(lab): persist engine config on change"
```

---

# PART 3 — `hadouken` → `vortex` REVEAL RENAME

### Task 9: Engine-side rename and migration alias

**Files:**

- Rename: `packages/stripes-engine/src/passes/hadoukenPass.ts` → `vortexPass.ts`
- Rename: `packages/stripes-engine/src/shaders/hadoukenCore.frag.ts` → `vortexCore.frag.ts`
- Rename: `packages/stripes-engine/src/shaders/hadoukenParticles.vert.ts` → `vortexParticles.vert.ts`
- Rename: `packages/stripes-engine/src/shaders/hadoukenParticles.frag.ts` → `vortexParticles.frag.ts`
- Modify: `packages/stripes-engine/src/config/types.ts:14,25,50`
- Modify: `packages/stripes-engine/src/config/normalize.ts:26,240,257,268,274,284,320,336,353,740`
- Modify: `packages/stripes-engine/src/engine.ts:15,195,199,571,572,574,578,588,601`
- Modify: `packages/stripes-engine/src/legacy/migrateLegacyConfig.ts:46`
- Test: `packages/stripes-engine/src/config/normalize.test.ts`, `engine.topology.test.ts`, `reveal/revealMath.test.ts`, `legacy/migrateLegacyConfig.test.ts`

**Interfaces:**

- Consumes: nothing.
- Produces: `RevealType` includes `"vortex"` and no longer includes `"hadouken"`;
  `reveal.vortex` block; `VortexRevealConfig`; `createVortexPass`; `VortexUniforms`;
  shader constants `VORTEX_CORE_FRAG`, `VORTEX_PARTICLES_VERT`, `VORTEX_PARTICLES_FRAG`.

The alias must land in the same commit as the rename. Without it, Task 7's restored
persistence reads a stored `reveal.type: "hadouken"`, fails the `REVEAL_TYPES` check,
and silently degrades the reveal to `"assembly"`.

- [ ] **Step 1: Write the failing migration test**

Append to `packages/stripes-engine/src/config/normalize.test.ts`:

```ts
describe("hadouken -> vortex migration", () => {
  it("maps the legacy reveal type", () => {
    expect(normalizeEngineConfig({ reveal: { type: "hadouken" } as never }).reveal.type).toBe("vortex");
  });

  it("carries the legacy block across", () => {
    const c = normalizeEngineConfig({
      reveal: { type: "hadouken", hadouken: { swirl: 2.5, detail: 0.8 } } as never,
    });
    expect(c.reveal.vortex.swirl).toBeCloseTo(2.5);
    expect(c.reveal.vortex.detail).toBeCloseTo(0.8);
  });

  it("prefers a new-name block over the legacy one", () => {
    const c = normalizeEngineConfig({
      reveal: { type: "vortex", vortex: { swirl: 1 }, hadouken: { swirl: 3 } } as never,
    });
    expect(c.reveal.vortex.swirl).toBeCloseTo(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pir test -- normalize.test`
Expected: FAIL — `reveal.type` is `"assembly"` and `reveal.vortex` is undefined.

- [ ] **Step 3: Rename the files**

```bash
git mv packages/stripes-engine/src/passes/hadoukenPass.ts packages/stripes-engine/src/passes/vortexPass.ts
git mv packages/stripes-engine/src/shaders/hadoukenCore.frag.ts packages/stripes-engine/src/shaders/vortexCore.frag.ts
git mv packages/stripes-engine/src/shaders/hadoukenParticles.vert.ts packages/stripes-engine/src/shaders/vortexParticles.vert.ts
git mv packages/stripes-engine/src/shaders/hadoukenParticles.frag.ts packages/stripes-engine/src/shaders/vortexParticles.frag.ts
```

- [ ] **Step 4: Rename the identifiers**

Apply this mapping across `packages/stripes-engine/src` (source and tests). Rename
identifiers only — do not touch the GLSL template-literal bodies, whose local variable
names are internal and unaffected.

| From                                                                 | To                                        |
| -------------------------------------------------------------------- | ----------------------------------------- |
| `"hadouken"` (in `RevealType`, `REVEAL_TYPES`, engine branch checks) | `"vortex"`                                |
| `HadoukenRevealConfig`                                               | `VortexRevealConfig`                      |
| `reveal.hadouken` / `DEFAULT_REVEAL.hadouken`                        | `reveal.vortex` / `DEFAULT_REVEAL.vortex` |
| `normalizeHadoukenBlock`                                             | `normalizeVortexBlock`                    |
| `createHadoukenPass`                                                 | `createVortexPass`                        |
| `HadoukenUniforms`                                                   | `VortexUniforms`                          |
| `HADOUKEN_CORE_FRAG`                                                 | `VORTEX_CORE_FRAG`                        |
| `HADOUKEN_PARTICLES_VERT`                                            | `VORTEX_PARTICLES_VERT`                   |
| `HADOUKEN_PARTICLES_FRAG`                                            | `VORTEX_PARTICLES_FRAG`                   |
| `"hadoukenField"` (stage name)                                       | `"vortexField"`                           |

Update the import paths in `engine.ts:15` and in `vortexPass.ts:4-6` to the renamed
files.

Keep the legacy shim keys in `LegacyAssemblyBlock` / `PartialReveal`
(`normalize.ts:274,284`) as `hadouken?:` — they describe stored data, not current
config. Add `vortex?:` alongside them.

- [ ] **Step 5: Add the alias**

In `normalizeReveal` in `packages/stripes-engine/src/config/normalize.ts`, immediately
before the `resolvedType` computation at line ~336:

```ts
if (type === "hadouken") type = "vortex";
```

(If `type` is declared `const`, change it to `let`.)

And in the returned object, resolve the block from either name:

```ts
    vortex: normalizeVortexBlock(i.vortex ?? i.hadouken ?? a.vortex ?? a.hadouken, DEFAULT_REVEAL.vortex),
```

The R5/R6 legacy-style branch at line ~336 that maps `assembly` + `style: "hadouken"`
must now produce `"vortex"` too.

In `packages/stripes-engine/src/legacy/migrateLegacyConfig.ts:46`, change the key to
`vortex: { ...DEFAULT_REVEAL.vortex }`.

- [ ] **Step 6: Run tests to verify they pass**

Run: `pir test`
Expected: PASS. Update the `"hadouken"` string literals in
`engine.topology.test.ts:12,13,100-104`, `normalize.test.ts:757,807,830,870,880`,
`reveal/revealMath.test.ts:92-93`, and `legacy/migrateLegacyConfig.test.ts:53` to
`"vortex"` — except the new migration tests from Step 1, which must keep the legacy
name as input.

- [ ] **Step 7: Typecheck**

Run: `pir typecheck`
Expected: clean.

- [ ] **Step 8: Commit**

```bash
git add packages/stripes-engine/src
git commit -m "refactor(engine): rename hadouken reveal to vortex with legacy alias"
```

---

### Task 10: Lab-side rename

**Files:**

- Modify: `apps/lab/src/defaultLabConfig.ts:174`
- Modify: `apps/lab/src/factoryDefaults.json:157`
- Modify: `apps/lab/src/connectShader/underlayIntro.ts:6,15` and `underlayIntro.test.ts:8`
- Modify: `apps/lab/src/controls/levaSchema.ts:1464,1653-1706,2219-2226`

**Interfaces:**

- Consumes: `reveal.vortex` and `RevealType` `"vortex"` from Task 9.
- Produces: leva keys `revealVorSpeedMinMs`, `revealVorSpeedMaxMs`, `revealVorStaggerMs`,
  `revealVorIntensity`, `revealVorDetail`, `revealVorGlow`, `revealVorSwirl`.

- [ ] **Step 1: Rekey the factory defaults**

In `apps/lab/src/factoryDefaults.json`, rename the `"hadouken"` key under `reveal` to
`"vortex"` and add the missing `"swirl": 1` to that block so it matches
`defaultLabConfig.ts`. The block becomes:

```json
      "vortex": {
        "speedMinMs": 300,
        "speedMaxMs": 1400,
        "staggerMs": 2600,
        "intensity": 1,
        "detail": 0.5,
        "glow": 0.7,
        "swirl": 1
      }
```

- [ ] **Step 2: Rename the lab default block**

In `apps/lab/src/defaultLabConfig.ts:174`, change the `hadouken:` key to `vortex:`.

- [ ] **Step 3: Rename in underlayIntro**

In `apps/lab/src/connectShader/underlayIntro.ts`, change `"hadouken"` in the local
`RevealTypeLike` union (line 6) to `"vortex"`, and the `hadouken: WarpStyleLike`
property (line 15) to `vortex: WarpStyleLike`. Update the fixture key in
`underlayIntro.test.ts:8` to match.

- [ ] **Step 4: Rename the leva controls**

In `apps/lab/src/controls/levaSchema.ts`:

- Line 1464: change the dropdown option `Hadouken: "hadouken"` to `Vortex: "vortex"`.
- Lines 1653-1706: rename the seven control keys `revealHadSpeedMinMs`,
  `revealHadSpeedMaxMs`, `revealHadStaggerMs`, `revealHadIntensity`, `revealHadDetail`,
  `revealHadGlow`, `revealHadSwirl` to their `revealVor…` equivalents, change each
  `value:` source from `d.reveal.hadouken.*` to `d.reveal.vortex.*`, and change each
  `render` predicate to `get("Reveal.revealType") === "vortex"`.
- Lines 2219-2226: rename the output block key `hadouken:` to `vortex:` and update the
  seven `values.revealHad*` reads to `values.revealVor*`.

- [ ] **Step 5: Run tests, typecheck, and build**

Run: `pir test && pir typecheck && pir build`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/lab/src
git commit -m "refactor(lab): rename hadouken reveal controls and defaults to vortex"
```

---

### Task 11: Live browser verification

**Files:** none — verification only.

**Interfaces:**

- Consumes: everything.
- Produces: nothing.

Unit tests never compile GLSL, so a shader that fails to compile passes the entire
suite and only breaks in the browser. This task is mandatory, not optional.

- [ ] **Step 1: Reuse the running dev server**

Run: `curl -s -o /dev/null -w "%{http_code}" http://localhost:5174`
If it returns `200`, reuse it. If not, start it once with `pir dev --host` in a
background shell. Never start a second dev server on another port.

- [ ] **Step 2: Open the lab on the remote Chrome pool**

Run: `agent-browser --session vortex open http://localhost:5174`
Confirm stderr shows `[ab-open] remote chrome <ip>:<port>`. On
`[ab-open] BLOCKED: …` (exit 3), STOP and ask the user before falling back to
`--local`.

Leva registers newly-added keys only on a full page load — a hot reload will not show
`flamesInward`, `flamesSwirlRate`, or the renamed `revealVor*` controls. Load the page
fresh.

- [ ] **Step 3: Check for shader compile errors**

In the browser console:

```js
window.__errs;
```

Expected: empty. A non-empty array here means a shader failed to compile — read the log
and fix before continuing.

- [ ] **Step 4: Cycle every flame direction**

Enable Background Flames, then step the Direction dropdown through all eight values:
`Up`, `Down`, `Left`, `Right`, `Up - Down`, `Left - Right`, `Vortex`, `Vortex Bits`.

Expected for each:

- The six linear directions look exactly as before this plan — that is the `aRot == 0`
  identity check.
- `Vortex` — bars emit from the canvas center and spiral outward to the edges, tight
  coils near the core opening out toward the rim, each bar lying along its own curved
  path. Toggling `Inward` reverses it: bars enter at the rim and spiral into the core.
- `Vortex Bits` — many small independent swirls scattered across the canvas, each
  fading in, sweeping a partial turn, and fading out. No convergence, no drift.
- The `Swirl` slider at `0` makes vortex paths radial (straight out/in) and freezes the
  bits; raising it tightens the coils.

- [ ] **Step 5: Cycle every reveal type**

Step the Reveal Type dropdown through `wave`, `assembly`, `turbulence`, `glitch`,
`vortex`, triggering a reveal on each. Confirm no console errors, that each starts from
black, and that `vortex` behaves exactly as `hadouken` did before the rename.

- [ ] **Step 6: Verify persistence and migration**

- Change a slider, reload, confirm the value survives.
- In DevTools, seed a legacy value and reload:

```js
const c = JSON.parse(localStorage.getItem("stripes-engine-lab-last-config"));
c.reveal.type = "hadouken";
localStorage.setItem("stripes-engine-lab-last-config", JSON.stringify(c));
location.reload();
```

Expected after reload: the Reveal Type dropdown reads `Vortex`, not `Assembly`.

- [ ] **Step 7: Close the browser session**

Run: `agent-browser --session vortex close`

- [ ] **Step 8: Report results to the user**

Show what was verified. Do not offer to push.

---

## Self-Review Notes

**Spec coverage.** Part 1 config → Task 1. `vortex` motion → Task 2. `vortexBits`
motion → Task 3. Shader `aRot` → Task 4. Engine rebuild trigger → Task 5. Leva
controls → Task 6. Part 2 persistence restore → Tasks 7-8, with the sticky-background
subsystem deliberately left dead and `factoryDefaults.json` still the fallback. Part 3
rename → Tasks 9-10, migration alias in Task 9. Live-load invariant → Task 11.

**Deviation from the spec, flagged.** The spec says `direction` joins the pass-rebuild
condition; Task 5 also includes `inward`, because a live `inward` flip otherwise leaves
in-flight particles carrying a stale `radialSign` until they die.

**Deviation from the spec, flagged.** The spec derives the `vortexBits` orbit radius
from the width-ratio pair; Task 3 sets `radius = flame.width` directly, which is the
same quantity by a shorter path (`width` is already `lerp(minWidthRatio,
maxWidthRatio, rnd) * displayWidth`) and keeps the size knobs as the single control.
