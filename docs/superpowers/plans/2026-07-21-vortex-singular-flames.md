# Vortex Singular Flames Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `vortexSingular` background-flames direction: snake-like tails wandering the viewport on individual smooth curvy paths, fading out and back in while they keep moving.

**Architecture:** CPU entity sim (like existing flames): each tail is a head integrated along a wandering-swirl heading plus a trail ring buffer; body segments are sampled from the trail at constant arc length and emitted as ordinary `Flame` instances through the untouched instanced `flamesPass`. No shader, pass, or engine.ts changes — the engine already resets `flamesState` on direction change without rebuilding the pipeline.

**Tech Stack:** TypeScript, vitest, existing `packages/stripes-engine` sim/config patterns, leva controls in `apps/lab`.

Spec: `docs/superpowers/specs/2026-07-21-vortex-singular-flames-design.md`

## Global Constraints

- All randomness through the injected `state.random()`; all time from the `nowMs` argument. Never `Date.now()`/`Math.random()`.
- No code comments (user rule) — except none of the files below use them today either.
- Tail thickness comes from `minWidthRatio`/`maxWidthRatio` × display width; `minHeightRatio`/`maxHeightRatio` are unused in this mode (spec updated in Task 1).
- Run installs with `pi`, scripts with `pir` (e.g. `pir test`).
- Commits: conventional style matching repo history (`feat(engine): …`, `feat(lab): …`).

---

### Task 1: Engine config plumbing (`vortexSingular` direction + sub-config)

**Files:**

- Modify: `packages/stripes-engine/src/config/types.ts` (FlamesDirection at line ~174, FlamesConfig at ~176)
- Modify: `packages/stripes-engine/src/config/normalize.ts` (DEFAULT_FLAMES ~453, FLAMES_DIRECTIONS ~472, normalizeFlames ~478)
- Modify: `packages/stripes-engine/src/config/normalize.test.ts`
- Modify: `docs/superpowers/specs/2026-07-21-vortex-singular-flames-design.md` (one line)

**Interfaces:**

- Produces: `VortexSingularConfig` interface, `"vortexSingular"` member of `FlamesDirection`, `FlamesConfig.vortexSingular: VortexSingularConfig`, `DEFAULT_VORTEX_SINGULAR` exported from normalize.ts. Task 2 and Task 3 rely on these exact names.

- [ ] **Step 1: Write failing tests** — append to `normalize.test.ts` (follow the file's existing describe style):

```ts
describe("normalizeFlames vortexSingular", () => {
  it("accepts the vortexSingular direction", () => {
    expect(normalizeFlames({ direction: "vortexSingular" }).direction).toBe("vortexSingular");
  });

  it("fills vortexSingular defaults when absent", () => {
    expect(normalizeFlames({}).vortexSingular).toEqual(DEFAULT_VORTEX_SINGULAR);
  });

  it("clamps vortexSingular fields", () => {
    const v = normalizeFlames({
      vortexSingular: {
        segCount: 0,
        segSpacingPx: 500,
        turnRate: -2,
        turnVariation: 3,
        fadeCycleRate: 0,
        fadeDepth: 9,
        lifeMinMs: 10,
        lifeMaxMs: 5,
        edgeMarginRatio: 2,
      },
    }).vortexSingular;
    expect(v.segCount).toBe(2);
    expect(v.segSpacingPx).toBe(60);
    expect(v.turnRate).toBe(0.05);
    expect(v.turnVariation).toBe(1);
    expect(v.fadeCycleRate).toBe(0.02);
    expect(v.fadeDepth).toBe(1);
    expect(v.lifeMinMs).toBe(500);
    expect(v.lifeMaxMs).toBe(500);
    expect(v.edgeMarginRatio).toBe(0.4);
  });

  it("raises lifeMaxMs to lifeMinMs", () => {
    const v = normalizeFlames({ vortexSingular: { lifeMinMs: 8000, lifeMaxMs: 1000 } }).vortexSingular;
    expect(v.lifeMaxMs).toBe(8000);
  });
});
```

Import `DEFAULT_VORTEX_SINGULAR` alongside the existing normalize imports in that test file.

- [ ] **Step 2: Run to verify failure** — `pir test -- normalize` → FAIL (unknown export / type errors).

- [ ] **Step 3: Implement types** — in `types.ts`:

```ts
export type FlamesDirection = "up" | "down" | "left" | "right" | "upDown" | "leftRight" | "vortexSingular";

export interface VortexSingularConfig {
  segCount: number;
  segSpacingPx: number;
  turnRate: number;
  turnVariation: number;
  fadeCycleRate: number;
  fadeDepth: number;
  lifeMinMs: number;
  lifeMaxMs: number;
  edgeMarginRatio: number;
}
```

and add `vortexSingular: VortexSingularConfig;` as the last field of `FlamesConfig`.

- [ ] **Step 4: Implement normalize** — in `normalize.ts` (import `VortexSingularConfig` in the existing type-import block):

```ts
export const DEFAULT_VORTEX_SINGULAR: VortexSingularConfig = {
  segCount: 22,
  segSpacingPx: 10,
  turnRate: 0.9,
  turnVariation: 0.8,
  fadeCycleRate: 0.5,
  fadeDepth: 1,
  lifeMinMs: 6000,
  lifeMaxMs: 14000,
  edgeMarginRatio: 0.12,
};
```

`DEFAULT_FLAMES` gains `vortexSingular: { ...DEFAULT_VORTEX_SINGULAR },`. Add `"vortexSingular"` to `FLAMES_DIRECTIONS`. Change `PartialFlames` to:

```ts
type PartialFlames = Partial<Omit<FlamesConfig, "vortexSingular">> & {
  vortexSingular?: Partial<VortexSingularConfig>;
};
```

Add normalizer + wire into `normalizeFlames` return as `vortexSingular: normalizeVortexSingular(i.vortexSingular),`:

```ts
function normalizeVortexSingular(i: Partial<VortexSingularConfig> = {}): VortexSingularConfig {
  const lifeMinMs = clamp(Math.round(num(i.lifeMinMs, DEFAULT_VORTEX_SINGULAR.lifeMinMs)), 500, 60000);
  return {
    segCount: clamp(Math.round(num(i.segCount, DEFAULT_VORTEX_SINGULAR.segCount)), 2, 80),
    segSpacingPx: clamp(num(i.segSpacingPx, DEFAULT_VORTEX_SINGULAR.segSpacingPx), 2, 60),
    turnRate: clamp(num(i.turnRate, DEFAULT_VORTEX_SINGULAR.turnRate), 0.05, 6),
    turnVariation: clamp(num(i.turnVariation, DEFAULT_VORTEX_SINGULAR.turnVariation), 0, 1),
    fadeCycleRate: clamp(num(i.fadeCycleRate, DEFAULT_VORTEX_SINGULAR.fadeCycleRate), 0.02, 4),
    fadeDepth: clamp(num(i.fadeDepth, DEFAULT_VORTEX_SINGULAR.fadeDepth), 0, 1),
    lifeMinMs,
    lifeMaxMs: clamp(Math.round(num(i.lifeMaxMs, DEFAULT_VORTEX_SINGULAR.lifeMaxMs)), lifeMinMs, 120000),
    edgeMarginRatio: clamp(num(i.edgeMarginRatio, DEFAULT_VORTEX_SINGULAR.edgeMarginRatio), 0, 0.4),
  };
}
```

- [ ] **Step 5: Update spec line** — in the spec's Config section, replace the sentence claiming segment size reuses all four ratio fields with: thickness reuses `minWidthRatio`/`maxWidthRatio` (× display width); `minHeightRatio`/`maxHeightRatio` are unused in this mode.

- [ ] **Step 6: Run tests** — `pir test -- normalize` → PASS; then full `pir test` → all pass. Also `pir typecheck` if the script exists (it does; it's allowlisted).

- [ ] **Step 7: Commit** — `git add -A && git commit -m "feat(engine): vortexSingular flames config plumbing"`.

---

### Task 2: Wandering-tail sim (`vortexSingular.ts` + dispatch)

**Files:**

- Create: `packages/stripes-engine/src/flames/vortexSingular.ts`
- Create: `packages/stripes-engine/src/flames/vortexSingular.test.ts`
- Modify: `packages/stripes-engine/src/flames/flamesSim.ts` (Flame/FlamesState interfaces, `createFlamesState`, `stepFlames` dispatch)

**Interfaces:**

- Consumes: `VortexSingularConfig`, `FlamesConfig` from Task 1; `Flame`, `FlamesState` types from flamesSim; `lerp` from `../core/math`; `mulberry32` from `../core/rng` (tests only).
- Produces: `stepVortexSingular(state, config, display, nowMs): void`, `vortexSingularFade(tail, tSec, cfg): number`, `vortexSingularLifeEnvelope(ageMs, lifeMs): number`, `VortexTail` interface, `FlamesState.tails: VortexTail[]`.
- Import direction: `flamesSim.ts` imports the `stepVortexSingular` function from `vortexSingular.ts`; `vortexSingular.ts` imports ONLY types from `flamesSim.ts` (`import type`) so there is no runtime cycle.

- [ ] **Step 1: flamesSim.ts state changes** (needed for tests to compile):

`FlamesState` gains `tails: VortexTail[];` (`import type { VortexTail } from "./vortexSingular";`), `createFlamesState` returns `tails: [],` too. `isVerticalFlamesDirection` is untouched (returns false for the new value already). At the top of `stepFlames`, right after the enabled/size guard:

```ts
if (config.direction === "vortexSingular") {
  stepVortexSingular(state, config, display, nowMs);
  return;
}
```

(`import { stepVortexSingular } from "./vortexSingular";` — a value import, allowed in this direction only.)

- [ ] **Step 2: Write failing tests** — `vortexSingular.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { createFlamesState, stepFlames } from "./flamesSim";
import { vortexSingularFade, vortexSingularLifeEnvelope, type VortexTail } from "./vortexSingular";
import { mulberry32 } from "../core/rng";
import { DEFAULT_VORTEX_SINGULAR } from "../config/normalize";
import type { FlamesConfig } from "../config/types";

const DISPLAY = { width: 1000, height: 800 };

function makeConfig(overrides: Partial<FlamesConfig["vortexSingular"]> = {}): FlamesConfig {
  return {
    enabled: true,
    direction: "vortexSingular",
    minWidthRatio: 0.02,
    maxWidthRatio: 0.05,
    minHeightRatio: 0.02,
    maxHeightRatio: 0.08,
    baseSpeedPxPerSec: 60,
    speedVariation: 0.5,
    spawnIntervalMs: 50,
    spawnJitterMs: 80,
    maxActive: 6,
    edgeSharpness: 1,
    opacityMin: 0.3,
    opacityMax: 1,
    vortexSingular: { ...DEFAULT_VORTEX_SINGULAR, ...overrides },
  };
}

function run(config: FlamesConfig, seconds: number, state = createFlamesState(mulberry32(7)), startMs = 1000) {
  stepFlames(state, config, DISPLAY, startMs);
  const steps = Math.round(seconds / 0.016);
  for (let i = 1; i <= steps; i++) {
    stepFlames(state, config, DISPLAY, startMs + i * 16);
  }
  return state;
}

describe("stepVortexSingular", () => {
  it("seeds maxActive tails on first step", () => {
    const state = run(makeConfig(), 0);
    expect(state.tails).toHaveLength(6);
  });

  it("emits up to segCount segments per tail once trails are long enough", () => {
    const state = run(makeConfig(), 20);
    expect(state.flames.length).toBeGreaterThan(0);
    expect(state.flames.length).toBeLessThanOrEqual(6 * DEFAULT_VORTEX_SINGULAR.segCount);
    const perTail = new Map<number, number>();
    for (const f of state.flames) {
      perTail.set(f.colorSeed, (perTail.get(f.colorSeed) ?? 0) + 1);
    }
    for (const count of perTail.values()) {
      expect(count).toBeLessThanOrEqual(DEFAULT_VORTEX_SINGULAR.segCount);
    }
  });

  it("always turns and never settles into a fixed-rate circle", () => {
    const config = makeConfig({ fadeDepth: 0, lifeMinMs: 60000, lifeMaxMs: 60000 });
    const state = createFlamesState(mulberry32(7));
    stepFlames(state, config, DISPLAY, 1000);
    const tail = state.tails[0];
    const deltas: number[] = [];
    let prev = tail.heading;
    for (let i = 1; i <= 200; i++) {
      stepFlames(state, config, DISPLAY, 1000 + i * 16);
      deltas.push(tail.heading - prev);
      prev = tail.heading;
    }
    for (const d of deltas) expect(d).not.toBe(0);
    const mean = deltas.reduce((a, b) => a + b, 0) / deltas.length;
    const variance = deltas.reduce((a, b) => a + (b - mean) * (b - mean), 0) / deltas.length;
    expect(Math.sqrt(variance)).toBeGreaterThan(1e-5);
  });

  it("keeps segments at constant arc-length spacing", () => {
    const cfg = makeConfig({ fadeDepth: 0 });
    const state = run(cfg, 20);
    const first = state.flames.filter((f) => f.colorSeed === state.flames[0].colorSeed);
    expect(first.length).toBeGreaterThan(3);
    for (let i = 1; i < first.length; i++) {
      const a = first[i - 1];
      const b = first[i];
      const d = Math.hypot(a.x + a.width * 0.5 - (b.x + b.width * 0.5), a.y + a.height * 0.5 - (b.y + b.height * 0.5));
      expect(d).toBeGreaterThan(cfg.vortexSingular.segSpacingPx * 0.5);
      expect(d).toBeLessThan(cfg.vortexSingular.segSpacingPx * 1.5);
    }
  });

  it("keeps moving while fully faded", () => {
    const state = run(makeConfig(), 5);
    const tail = state.tails[0];
    const { x, y } = tail;
    for (let i = 0; i < 30; i++) {
      stepFlames(state, makeConfig(), DISPLAY, 1000 + Math.round(5 / 0.016) * 16 + (i + 1) * 16);
    }
    expect(Math.hypot(tail.x - x, tail.y - y)).toBeGreaterThan(1);
  });

  it("respawns dead tails so the population holds", () => {
    const config = makeConfig({ lifeMinMs: 1000, lifeMaxMs: 1000 });
    const state = run(config, 3);
    expect(state.tails).toHaveLength(6);
    for (const tail of state.tails) {
      expect(state.lastStepMs - tail.bornMs).toBeLessThan(1100);
    }
  });

  it("steers heads back inside the viewport", () => {
    const state = run(makeConfig({ fadeDepth: 0 }), 60);
    const margin = DEFAULT_VORTEX_SINGULAR.edgeMarginRatio * Math.min(DISPLAY.width, DISPLAY.height);
    for (const tail of state.tails) {
      expect(tail.x).toBeGreaterThan(-2 * margin);
      expect(tail.x).toBeLessThan(DISPLAY.width + 2 * margin);
      expect(tail.y).toBeGreaterThan(-2 * margin);
      expect(tail.y).toBeLessThan(DISPLAY.height + 2 * margin);
    }
  });
});

describe("vortexSingularFade", () => {
  const tail = {
    fadeSeed1: 1,
    fadeSeed2: 1.7,
    fadePhase1: 0.4,
    fadePhase2: 2.1,
  } as VortexTail;

  it("reaches zero and recovers at full depth", () => {
    const cfg = { ...DEFAULT_VORTEX_SINGULAR, fadeDepth: 1 };
    let sawZero = false;
    let sawRecovered = false;
    for (let t = 0; t < 120; t += 0.05) {
      const v = vortexSingularFade(tail, t, cfg);
      if (v <= 0.001) sawZero = true;
      if (sawZero && v > 0.5) sawRecovered = true;
    }
    expect(sawZero).toBe(true);
    expect(sawRecovered).toBe(true);
  });

  it("never fully vanishes at zero depth", () => {
    const cfg = { ...DEFAULT_VORTEX_SINGULAR, fadeDepth: 0 };
    for (let t = 0; t < 30; t += 0.05) {
      expect(vortexSingularFade(tail, t, cfg)).toBe(1);
    }
  });
});

describe("vortexSingularLifeEnvelope", () => {
  it("fades in, holds, fades out", () => {
    expect(vortexSingularLifeEnvelope(0, 10000)).toBe(0);
    expect(vortexSingularLifeEnvelope(600, 10000)).toBe(1);
    expect(vortexSingularLifeEnvelope(5000, 10000)).toBe(1);
    expect(vortexSingularLifeEnvelope(10000, 10000)).toBe(0);
  });
});
```

If the spacing test proves sensitive to a freshly respawned (short-trail) tail, add `lifeMinMs: 60000, lifeMaxMs: 60000` to its config overrides — spacing must still hold for whatever segments are emitted.

- [ ] **Step 3: Run to verify failure** — `pir test -- vortexSingular` → FAIL (module not found).

- [ ] **Step 4: Implement** `packages/stripes-engine/src/flames/vortexSingular.ts`:

```ts
import type { FlamesConfig, VortexSingularConfig } from "../config/types";
import { lerp } from "../core/math";
import type { Flame, FlamesState } from "./flamesSim";

export interface VortexTail {
  x: number;
  y: number;
  heading: number;
  speedPxPerSec: number;
  thickness: number;
  turnDir: number;
  turnFreq1: number;
  turnFreq2: number;
  turnPhase1: number;
  turnPhase2: number;
  fadeSeed1: number;
  fadeSeed2: number;
  fadePhase1: number;
  fadePhase2: number;
  bornMs: number;
  lifeMs: number;
  baseOpacity: number;
  colorSeed: number;
  trailX: number[];
  trailY: number[];
}

const SEG_OVERLAP = 1.35;
const TAIL_MIN_SIZE = 0.35;
const HEAD_MIN_OPACITY = 0.45;
const LIFE_FADE_MS = 600;
const STEER_GAIN = 3;
const MIN_TRAIL_STEP_PX = 0.2;
const GOLDEN = 1.618;

function smoothstep01(x: number): number {
  const c = Math.min(1, Math.max(0, x));
  return c * c * (3 - 2 * c);
}

export function vortexSingularLifeEnvelope(ageMs: number, lifeMs: number): number {
  if (lifeMs <= 0) return 0;
  const fade = Math.min(LIFE_FADE_MS, lifeMs * 0.25);
  return Math.max(0, Math.min(smoothstep01(ageMs / fade), smoothstep01((lifeMs - ageMs) / fade)));
}

export function vortexSingularFade(tail: VortexTail, tSec: number, cfg: VortexSingularConfig): number {
  const w = Math.PI * 2 * cfg.fadeCycleRate;
  const n =
    0.5 +
    0.25 * Math.sin(tSec * w * tail.fadeSeed1 + tail.fadePhase1) +
    0.25 * Math.sin(tSec * w * tail.fadeSeed2 + tail.fadePhase2);
  const raw = smoothstep01((n - 0.35) / 0.3);
  return 1 - cfg.fadeDepth * (1 - raw);
}

function turnRateAt(tail: VortexTail, tSec: number, cfg: VortexSingularConfig): number {
  const wave =
    Math.sin(tSec * tail.turnFreq1 + tail.turnPhase1) + 0.6 * Math.sin(tSec * tail.turnFreq2 + tail.turnPhase2);
  return cfg.turnRate * tail.turnDir * (1 + cfg.turnVariation * wave);
}

function boundarySteer(tail: VortexTail, width: number, height: number, margin: number): number {
  if (margin <= 0) return 0;
  const distEdge = Math.min(tail.x, tail.y, width - tail.x, height - tail.y);
  if (distEdge >= margin) return 0;
  const p = Math.min(1, (margin - distEdge) / margin);
  const toCenter = Math.atan2(height * 0.5 - tail.y, width * 0.5 - tail.x);
  const diff = Math.atan2(Math.sin(toCenter - tail.heading), Math.cos(toCenter - tail.heading));
  return p * p * STEER_GAIN * diff;
}

function spawnTail(
  random: () => number,
  config: FlamesConfig,
  display: { width: number; height: number },
  nowMs: number,
  seeded: boolean,
): VortexTail {
  const cfg = config.vortexSingular;
  const spread = config.baseSpeedPxPerSec * 0.5 * config.speedVariation;
  const speedPxPerSec = lerp(
    Math.max(1, config.baseSpeedPxPerSec - spread),
    config.baseSpeedPxPerSec + spread,
    random(),
  );
  const lifeMs = lerp(cfg.lifeMinMs, cfg.lifeMaxMs, random());
  const x = random() * display.width;
  const y = random() * display.height;
  return {
    x,
    y,
    heading: random() * Math.PI * 2,
    speedPxPerSec,
    thickness: Math.max(1, lerp(config.minWidthRatio, config.maxWidthRatio, random()) * display.width),
    turnDir: random() < 0.5 ? -1 : 1,
    turnFreq1: lerp(0.15, 0.4, random()),
    turnFreq2: lerp(0.15, 0.4, random()) * GOLDEN,
    turnPhase1: random() * Math.PI * 2,
    turnPhase2: random() * Math.PI * 2,
    fadeSeed1: lerp(0.7, 1.3, random()),
    fadeSeed2: lerp(0.7, 1.3, random()) * 1.7,
    fadePhase1: random() * Math.PI * 2,
    fadePhase2: random() * Math.PI * 2,
    bornMs: seeded ? nowMs - random() * lifeMs * 0.8 : nowMs,
    lifeMs,
    baseOpacity: lerp(config.opacityMin, config.opacityMax, random()),
    colorSeed: random(),
    trailX: [x],
    trailY: [y],
  };
}

function trimTrail(tail: VortexTail, cfg: VortexSingularConfig): void {
  const needed = cfg.segCount * cfg.segSpacingPx * 1.25 + 40;
  const xs = tail.trailX;
  const ys = tail.trailY;
  let acc = 0;
  for (let i = xs.length - 1; i > 0; i--) {
    acc += Math.hypot(xs[i] - xs[i - 1], ys[i] - ys[i - 1]);
    if (acc > needed) {
      if (i > 1) {
        xs.splice(0, i - 1);
        ys.splice(0, i - 1);
      }
      return;
    }
  }
}

function appendSegments(out: Flame[], tail: VortexTail, cfg: VortexSingularConfig, visibility: number): void {
  const xs = tail.trailX;
  const ys = tail.trailY;
  const segW = cfg.segSpacingPx * SEG_OVERLAP;
  let seg = 0;
  let acc = 0;
  for (let i = xs.length - 1; i > 0 && seg < cfg.segCount; i--) {
    const ax = xs[i];
    const ay = ys[i];
    const bx = xs[i - 1];
    const by = ys[i - 1];
    const d = Math.hypot(bx - ax, by - ay);
    if (d <= 0) continue;
    const angle = Math.atan2(ay - by, ax - bx);
    while (seg < cfg.segCount && seg * cfg.segSpacingPx <= acc + d) {
      const t = (seg * cfg.segSpacingPx - acc) / d;
      const along = 1 - seg / cfg.segCount;
      const height = Math.max(1, tail.thickness * (TAIL_MIN_SIZE + (1 - TAIL_MIN_SIZE) * along));
      out.push({
        x: lerp(ax, bx, t) - segW * 0.5,
        y: lerp(ay, by, t) - height * 0.5,
        width: segW,
        height,
        speedPxPerSec: tail.speedPxPerSec,
        opacity: tail.baseOpacity * (HEAD_MIN_OPACITY + (1 - HEAD_MIN_OPACITY) * along) * visibility,
        colorSeed: tail.colorSeed,
        direction: "vortexSingular",
        rot: angle,
      });
      seg++;
    }
    acc += d;
  }
}

function rebuildFlames(state: FlamesState, config: FlamesConfig, nowMs: number): void {
  const cfg = config.vortexSingular;
  const flames: Flame[] = [];
  for (const tail of state.tails) {
    trimTrail(tail, cfg);
    const ageMs = nowMs - tail.bornMs;
    const visibility = vortexSingularLifeEnvelope(ageMs, tail.lifeMs) * vortexSingularFade(tail, ageMs / 1000, cfg);
    if (visibility <= 0.001) continue;
    appendSegments(flames, tail, cfg, visibility);
  }
  state.flames = flames;
}

export function stepVortexSingular(
  state: FlamesState,
  config: FlamesConfig,
  display: { width: number; height: number },
  nowMs: number,
): void {
  const cfg = config.vortexSingular;

  if (state.lastStepMs <= 0) {
    state.lastStepMs = nowMs;
    state.lastSpawnMs = nowMs;
    state.tails = [];
    for (let i = 0; i < config.maxActive; i++) {
      state.tails.push(spawnTail(state.random, config, display, nowMs, true));
    }
    rebuildFlames(state, config, nowMs);
    return;
  }

  const dtSec = Math.min(0.1, Math.max(0, (nowMs - state.lastStepMs) / 1000));
  state.lastStepMs = nowMs;

  while (state.tails.length < config.maxActive) {
    state.tails.push(spawnTail(state.random, config, display, nowMs, false));
  }
  if (state.tails.length > config.maxActive) state.tails.length = config.maxActive;

  const margin = cfg.edgeMarginRatio * Math.min(display.width, display.height);
  for (let i = 0; i < state.tails.length; i++) {
    let tail = state.tails[i];
    if (nowMs - tail.bornMs >= tail.lifeMs) {
      tail = spawnTail(state.random, config, display, nowMs, false);
      state.tails[i] = tail;
    }
    const tSec = (nowMs - tail.bornMs) / 1000;
    const omega = turnRateAt(tail, tSec, cfg) + boundarySteer(tail, display.width, display.height, margin);
    tail.heading += omega * dtSec;
    tail.x += Math.cos(tail.heading) * tail.speedPxPerSec * dtSec;
    tail.y += Math.sin(tail.heading) * tail.speedPxPerSec * dtSec;
    const lastIdx = tail.trailX.length - 1;
    if (Math.hypot(tail.x - tail.trailX[lastIdx], tail.y - tail.trailY[lastIdx]) >= MIN_TRAIL_STEP_PX) {
      tail.trailX.push(tail.x);
      tail.trailY.push(tail.y);
    }
  }

  rebuildFlames(state, config, nowMs);
}
```

- [ ] **Step 5: flamesSim.ts final shape check** — `Flame` interface is unchanged; `FlamesState` has `tails`; dispatch is in place from Step 1.

- [ ] **Step 6: Run tests** — `pir test -- vortexSingular` → PASS, then `pir test` (all 550+ new ones) → PASS, `pir typecheck` → clean.

- [ ] **Step 7: Commit** — `git add -A && git commit -m "feat(engine): vortexSingular wandering-tail flames sim"`.

---

### Task 3: Lab wiring (defaults + leva controls)

**Files:**

- Modify: `apps/lab/src/defaultLabConfig.ts` (flames block at ~224)
- Modify: `apps/lab/src/controls/levaSchema.ts` (direction options ~1130, Background Flames folder ~1128-1240, values→config mapping ~2342)

**Interfaces:**

- Consumes: `FlamesConfig.vortexSingular` shape from Task 1. Control keys produced: `flamesVsSegCount`, `flamesVsSegSpacing`, `flamesVsTurnRate`, `flamesVsTurnVariation`, `flamesVsFadeCycleRate`, `flamesVsFadeDepth`, `flamesVsLifeMinSec`, `flamesVsLifeMaxSec`, `flamesVsEdgeMargin`.

- [ ] **Step 1: defaultLabConfig.ts** — inside the `flames: { … }` block append:

```ts
    vortexSingular: {
      segCount: 22,
      segSpacingPx: 10,
      turnRate: 0.9,
      turnVariation: 0.8,
      fadeCycleRate: 0.5,
      fadeDepth: 1,
      lifeMinMs: 6000,
      lifeMaxMs: 14000,
      edgeMarginRatio: 0.12,
    },
```

- [ ] **Step 2: Direction option** — in the `flamesDirection` options object add `"Vortex Singular": "vortexSingular",` after `"Left - Right"`.

- [ ] **Step 3: Controls** — after the `flamesDirection` entry in the Background Flames folder, add (matching the folder's existing entry style; `vsRender` gate defined inline on each entry):

```ts
          flamesVsSegCount: {
            value: d.flames.vortexSingular.segCount,
            min: 2,
            max: 80,
            step: 1,
            label: "VS Segments",
            render: (get) =>
              get("Background Flames.flamesEnabled") === true &&
              get("Background Flames.flamesDirection") === "vortexSingular",
          },
          flamesVsSegSpacing: {
            value: d.flames.vortexSingular.segSpacingPx,
            min: 2,
            max: 60,
            step: 1,
            label: "VS Spacing (px)",
            render: (get) =>
              get("Background Flames.flamesEnabled") === true &&
              get("Background Flames.flamesDirection") === "vortexSingular",
          },
          flamesVsTurnRate: {
            value: d.flames.vortexSingular.turnRate,
            min: 0.05,
            max: 6,
            step: 0.05,
            label: "VS Turn Rate",
            render: (get) =>
              get("Background Flames.flamesEnabled") === true &&
              get("Background Flames.flamesDirection") === "vortexSingular",
          },
          flamesVsTurnVariation: {
            value: d.flames.vortexSingular.turnVariation,
            min: 0,
            max: 1,
            step: 0.01,
            label: "VS Turn Variation",
            render: (get) =>
              get("Background Flames.flamesEnabled") === true &&
              get("Background Flames.flamesDirection") === "vortexSingular",
          },
          flamesVsFadeCycleRate: {
            value: d.flames.vortexSingular.fadeCycleRate,
            min: 0.02,
            max: 4,
            step: 0.02,
            label: "VS Fade Rate",
            render: (get) =>
              get("Background Flames.flamesEnabled") === true &&
              get("Background Flames.flamesDirection") === "vortexSingular",
          },
          flamesVsFadeDepth: {
            value: d.flames.vortexSingular.fadeDepth,
            min: 0,
            max: 1,
            step: 0.01,
            label: "VS Fade Depth",
            render: (get) =>
              get("Background Flames.flamesEnabled") === true &&
              get("Background Flames.flamesDirection") === "vortexSingular",
          },
          flamesVsLifeMinSec: {
            value: d.flames.vortexSingular.lifeMinMs / 1000,
            min: 0.5,
            max: 60,
            step: 0.5,
            label: "VS Life Min (s)",
            render: (get) =>
              get("Background Flames.flamesEnabled") === true &&
              get("Background Flames.flamesDirection") === "vortexSingular",
          },
          flamesVsLifeMaxSec: {
            value: d.flames.vortexSingular.lifeMaxMs / 1000,
            min: 0.5,
            max: 120,
            step: 0.5,
            label: "VS Life Max (s)",
            render: (get) =>
              get("Background Flames.flamesEnabled") === true &&
              get("Background Flames.flamesDirection") === "vortexSingular",
          },
          flamesVsEdgeMargin: {
            value: d.flames.vortexSingular.edgeMarginRatio,
            min: 0,
            max: 0.4,
            step: 0.01,
            label: "VS Edge Margin",
            render: (get) =>
              get("Background Flames.flamesEnabled") === true &&
              get("Background Flames.flamesDirection") === "vortexSingular",
          },
```

- [ ] **Step 4: values→config mapping** — in the `flames:` block of the mapping (~2342) append:

```ts
      vortexSingular: {
        segCount: values.flamesVsSegCount,
        segSpacingPx: values.flamesVsSegSpacing,
        turnRate: values.flamesVsTurnRate,
        turnVariation: values.flamesVsTurnVariation,
        fadeCycleRate: values.flamesVsFadeCycleRate,
        fadeDepth: values.flamesVsFadeDepth,
        lifeMinMs: values.flamesVsLifeMinSec * 1000,
        lifeMaxMs: values.flamesVsLifeMaxSec * 1000,
        edgeMarginRatio: values.flamesVsEdgeMargin,
      },
```

- [ ] **Step 5: Verify** — `pir typecheck` → clean, `pir test` → all pass, `pir build` → succeeds.

- [ ] **Step 6: Commit** — `git add -A && git commit -m "feat(lab): vortex singular flames controls"`.

---

### Task 4: Live visual verification (main session, not delegated)

- [ ] Start the lab dev server in the worktree in background (`pir dev` in `apps/lab`, note the port — the user's own server on 5174 serves the MAIN checkout, not this worktree; a second Vite on a different project root is a different project instance, but per dev-server rules confirm the worktree server uses a distinct port and stop it when done).
- [ ] Open with `agent-browser open <url>` (remote pool; on `[ab-open] BLOCKED` stop and ask). Enable Background Flames, set Direction = Vortex Singular.
- [ ] Verify: tails wander on curvy non-circular paths; bodies are continuous (no gaps/stacking); tails fade fully out and re-emerge elsewhere while paths continue; no tails permanently stuck off-screen; direction switch up ↔ vortexSingular does not error or rebuild artifacts.
- [ ] Screenshot(s) for the user; iterate on default tuning (turnRate/segSpacing/thickness) if the look is off.
