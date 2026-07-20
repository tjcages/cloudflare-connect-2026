# Vortex Center Density Fix + Vortex Lines Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the dense particle clot at the vortex center, and add a third variant
`vortexLines` — snakes that grow, rotate around their own local pivot, and fade.

**Architecture:** Both changes live in the CPU sim
(`packages/stripes-engine/src/flames/flamesSim.ts`). The GL pass already supports
per-instance rotation (`aRot`), so a snake is rendered as N ordered segment quads,
each rotated to its local tangent — no shader or pass change is needed.

**Tech Stack:** TypeScript, WebGL2, Vitest, React + leva, pnpm via `pi`/`pir`.

## Global Constraints

- Package manager: `pi` for installs, `pir` for scripts. Never npm/pnpm/yarn/npx.
- Tests `pir test`, typecheck `pir typecheck`, build `pir build`.
- No code comments unless a step's code block already contains one.
- Never set a git identity. Commit only; never push.
- Work directly on `main`. Stage files explicitly by path (a second engineer is active
  in this repo) — never `git add -A`.
- Do not add `prefers-reduced-motion` handling.
- The six linear directions (`up`/`down`/`left`/`right`/`upDown`/`leftRight`) must keep
  behaving identically. `vortexBits` must also keep behaving identically.
- Test timelines must start at `nowMs = 1`: `stepFlames` treats `lastStepMs <= 0` as a
  "never stepped" sentinel and `createFlamesState` inits it to `0`, so a first call at
  `nowMs = 0` silently no-ops the second call.

---

### Task 1: Fix the vortex center clot

**Files:**

- Modify: `packages/stripes-engine/src/flames/flamesSim.ts` (`placeVortexFlame`, and the `vortex` case in `stepFlames`)
- Test: `packages/stripes-engine/src/flames/flamesSim.test.ts`

**Interfaces:**

- Consumes: existing `Flame` fields, `vortexMaxRadius`, `applyVortexTransform`.
- Produces: no API change. `Flame.baseOpacity` becomes meaningful for `vortex` too
  (it is already set for every flame and already used by `vortexBits`).

**Root cause being fixed.** `placeVortexFlame` seeds with
`randomBetween(random, 2, rMax)` — uniform in RADIUS. Because area grows as r², a
radius-uniform draw concentrates particles near the center (areal density ∝ 1/r). On
reload the whole pool is seeded at once, so with a small `maxActive` (the lab default
is 15) some reloads land several particles almost on the origin, producing a visible
clot that takes tens of seconds to disperse at the default ~15–45px/s. Continuous
spawning at `radius = randomBetween(2, 8)` — effectively a point — keeps refilling it.

- [ ] **Step 1: Write the failing tests**

Append to `packages/stripes-engine/src/flames/flamesSim.test.ts`:

```ts
describe("vortex center density", () => {
  it("seeds area-uniformly rather than radius-uniformly", () => {
    const state = createFlamesState(seededRandom());
    const config = vortexConfig({ maxActive: 400, spawnIntervalMs: 5000 });
    stepFlames(state, config, DISPLAY, 1);
    const rMax = 0.5 * Math.hypot(DISPLAY.width, DISPLAY.height);
    const inner = state.flames.filter((f) => f.radius < rMax * 0.5).length;
    const ratio = inner / state.flames.length;
    expect(ratio).toBeGreaterThan(0.15);
    expect(ratio).toBeLessThan(0.35);
  });

  it("never seeds a particle on top of the center", () => {
    const state = createFlamesState(seededRandom());
    const config = vortexConfig({ maxActive: 300, spawnIntervalMs: 5000 });
    stepFlames(state, config, DISPLAY, 1);
    const rMax = 0.5 * Math.hypot(DISPLAY.width, DISPLAY.height);
    state.flames.forEach((f) => expect(f.radius).toBeGreaterThan(rMax * 0.02));
  });

  it("spawns onto a ring, not a point", () => {
    const state = createFlamesState(seededRandom());
    const config = vortexConfig({ maxActive: 60, spawnIntervalMs: 20, spawnJitterMs: 0 });
    stepFlames(state, config, DISPLAY, 1);
    const before = state.flames.length;
    stepFlames(state, config, DISPLAY, 400);
    const spawned = state.flames.slice(before);
    const rMax = 0.5 * Math.hypot(DISPLAY.width, DISPLAY.height);
    expect(spawned.length).toBeGreaterThan(0);
    spawned.forEach((f) => expect(f.radius).toBeGreaterThan(rMax * 0.02));
  });

  it("fades a vortex particle in near the core", () => {
    const state = createFlamesState(seededRandom());
    const config = vortexConfig({ maxActive: 40, opacityMin: 1, opacityMax: 1 });
    stepFlames(state, config, DISPLAY, 1);
    stepFlames(state, config, DISPLAY, 40);
    const rMax = 0.5 * Math.hypot(DISPLAY.width, DISPLAY.height);
    const nearest = state.flames.reduce((a, b) => (a.radius < b.radius ? a : b));
    if (nearest.radius < rMax * 0.25) {
      expect(nearest.opacity).toBeLessThan(nearest.baseOpacity);
    }
    const far = state.flames.filter((f) => f.radius > rMax * 0.6);
    far.forEach((f) => expect(f.opacity).toBeCloseTo(f.baseOpacity, 5));
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pir test -- flamesSim`
Expected: FAIL — seeding is radius-uniform, radii reach ~2px, and opacity never varies
with radius.

- [ ] **Step 3: Add the ring constants and area-uniform seeding**

In `packages/stripes-engine/src/flames/flamesSim.ts`, add next to `vortexMaxRadius`:

```ts
const VORTEX_CORE_RATIO = 0.06;
const VORTEX_SPAWN_BAND = 0.04;
const VORTEX_FADE_RATIO = 0.22;
```

In `placeVortexFlame`, replace the whole radius-selection block with:

```ts
const rMax = vortexMaxRadius(displayWidth, displayHeight);
const rMin = rMax * VORTEX_CORE_RATIO;
if (seeded) {
  const u = random();
  flame.radius = Math.sqrt(rMin * rMin + u * (rMax * rMax - rMin * rMin));
} else if (config.inward) {
  flame.radius = rMax * randomBetween(random, 1, 1.08);
} else {
  flame.radius = rMin + rMax * VORTEX_SPAWN_BAND * random();
}
```

`sqrt(rMin² + u(rMax² − rMin²))` is the inverse CDF of a uniform distribution over the
annulus, so seeded particles are evenly spread by AREA instead of piling up near the
origin, and no particle is ever seeded inside the core radius.

- [ ] **Step 4: Fade vortex particles in as they leave the core**

In `stepFlames`, replace the `case "vortex":` body with:

```ts
      case "vortex": {
        flame.radius += flame.radialSign * flame.speedPxPerSec * dtSec;
        flame.angle += flame.angVel * dtSec;
        applyVortexTransform(flame);
        const rMaxV = vortexMaxRadius(display.width, display.height);
        const t = rMaxV > 0 ? flame.radius / (rMaxV * VORTEX_FADE_RATIO) : 1;
        flame.opacity = flame.baseOpacity * smoothstep01(t);
        break;
      }
```

`smoothstep01` already exists in this file (added for `vortexBits`) — reuse it, do not
redefine it. This makes anything still near the core dim rather than a hard bright
clot, and reaches full opacity by 22% of the radius. For `inward` it doubles as a
graceful fade-out as particles converge and die.

- [ ] **Step 5: Run tests to verify they pass**

Run: `pir test -- flamesSim`
Expected: PASS, including all pre-existing vortex and vortexBits tests.

- [ ] **Step 6: Full gates**

Run: `pir test && pir typecheck && pir build`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add packages/stripes-engine/src/flames/flamesSim.ts packages/stripes-engine/src/flames/flamesSim.test.ts
git commit -m "fix(engine): even out vortex spawn density, no clot at the center"
```

---

### Task 2: `vortexLines` — snakes

**Files:**

- Modify: `packages/stripes-engine/src/config/types.ts` (`FlamesDirection`)
- Modify: `packages/stripes-engine/src/config/normalize.ts` (`FLAMES_DIRECTIONS`)
- Modify: `packages/stripes-engine/src/flames/flamesSim.ts`
- Test: `packages/stripes-engine/src/flames/flamesSim.test.ts`, `packages/stripes-engine/src/config/normalize.test.ts`

**Interfaces:**

- Consumes: `Flame`, `applyVortexTransform`, `smoothstep01`, `vortexBitEnvelope`.
- Produces: `FlamesDirection` gains `"vortexLines"`. `Flame` gains
  `segIndex: number` and `segCount: number` (0 and 1 for every non-snake flame).

**Design (approved).** Each snake is a **trailing tail behind a moving head**: the head
advances along a circular path around the snake's own **local random pivot** (same
pivot model as `vortexBits`, not the shared canvas center), and the tail follows a
fixed angular length behind, so the snake keeps a roughly constant length as it
travels. It tapers head → tail in both width and opacity, and fades out at end of life.

**Representation.** The GL pass draws one quad per `Flame`, so a snake is emitted as
`SNAKE_SEGMENTS` consecutive `Flame` records sharing a pivot, radius, angular velocity,
`bornMs` and `lifeMs`, differing only in `segIndex`. Segment `i` sits at
`angle - i * SNAKE_SEG_ARC` (behind the head), is rotated to its local tangent, and is
scaled/dimmed by its position along the snake. `maxActive` therefore counts SEGMENTS,
not snakes — document this in the report but do not change the knob's meaning.

- [ ] **Step 1: Write the failing tests**

Append to `packages/stripes-engine/src/config/normalize.test.ts`:

```ts
it("accepts the vortexLines direction", () => {
  expect(normalizeFlames({ direction: "vortexLines" }).direction).toBe("vortexLines");
});
```

Append to `packages/stripes-engine/src/flames/flamesSim.test.ts`:

```ts
describe("vortex lines", () => {
  const linesConfig = (o = {}) =>
    normalizeFlames({
      enabled: true,
      direction: "vortexLines",
      maxActive: 48,
      swirlRate: 2,
      speedVariation: 0,
      opacityMin: 1,
      opacityMax: 1,
      ...o,
    });

  it("emits snakes as ordered segment runs", () => {
    const state = createFlamesState(seededRandom());
    stepFlames(state, linesConfig(), DISPLAY, 1);
    expect(state.flames.length).toBeGreaterThan(0);
    state.flames.forEach((f) => {
      expect(f.segCount).toBeGreaterThan(1);
      expect(f.segIndex).toBeLessThan(f.segCount);
    });
    const heads = state.flames.filter((f) => f.segIndex === 0);
    expect(heads.length).toBeGreaterThan(0);
  });

  it("groups each snake's segments on one shared pivot", () => {
    const state = createFlamesState(seededRandom());
    stepFlames(state, linesConfig(), DISPLAY, 1);
    const head = state.flames.find((f) => f.segIndex === 0);
    const mates = state.flames.filter((f) => f.pivotX === head.pivotX && f.pivotY === head.pivotY);
    expect(mates.length).toBe(head.segCount);
  });

  it("tapers width and opacity from head to tail", () => {
    const state = createFlamesState(seededRandom());
    stepFlames(state, linesConfig(), DISPLAY, 1);
    stepFlames(state, linesConfig(), DISPLAY, 60);
    const head = state.flames.find((f) => f.segIndex === 0);
    const mates = state.flames
      .filter((f) => f.pivotX === head.pivotX && f.pivotY === head.pivotY)
      .sort((a, b) => a.segIndex - b.segIndex);
    const tail = mates[mates.length - 1];
    expect(tail.width).toBeLessThan(head.width);
    expect(tail.opacity).toBeLessThan(head.opacity);
  });

  it("trails the tail behind the head at a constant arc", () => {
    const state = createFlamesState(seededRandom());
    const config = linesConfig();
    stepFlames(state, config, DISPLAY, 1);
    stepFlames(state, config, DISPLAY, 200);
    const head = state.flames.find((f) => f.segIndex === 0);
    const mates = state.flames
      .filter((f) => f.pivotX === head.pivotX && f.pivotY === head.pivotY)
      .sort((a, b) => a.segIndex - b.segIndex);
    for (let i = 1; i < mates.length; i++) {
      const gap = Math.abs(mates[i - 1].angle - mates[i].angle);
      expect(gap).toBeGreaterThan(0);
      expect(gap).toBeLessThan(1);
    }
  });

  it("expires a whole snake together", () => {
    const state = createFlamesState(seededRandom());
    const config = linesConfig({ spawnIntervalMs: 5000 });
    stepFlames(state, config, DISPLAY, 1);
    const head = state.flames.find((f) => f.segIndex === 0);
    const pivotX = head.pivotX;
    stepFlames(state, config, DISPLAY, 9000);
    expect(state.flames.filter((f) => f.pivotX === pivotX).length).toBe(0);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pir test -- "flamesSim|normalize"`
Expected: FAIL — `"vortexLines"` normalizes to `"up"` and `segCount` is undefined.

- [ ] **Step 3: Widen the direction union**

In `packages/stripes-engine/src/config/types.ts` add `| "vortexLines"` to
`FlamesDirection`. In `packages/stripes-engine/src/config/normalize.ts` add
`"vortexLines"` to the `FLAMES_DIRECTIONS` array.

- [ ] **Step 4: Add the segment fields**

In `flamesSim.ts`, add to the `Flame` interface:

```ts
segIndex: number;
segCount: number;
```

and to the shared `base` object inside `createFlame`:

```ts
    segIndex: 0,
    segCount: 1,
```

Extend `isVortexFlamesDirection` to include the new value:

```ts
export function isVortexFlamesDirection(d: FlamesDirection): boolean {
  return d === "vortex" || d === "vortexBits" || d === "vortexLines";
}
```

- [ ] **Step 5: Add snake emission**

Add below `placeVortexBit`:

```ts
const SNAKE_SEGMENTS = 7;
const SNAKE_SEG_ARC = 0.16;

function emitVortexSnake(
  state: FlamesState,
  config: FlamesConfig,
  displayWidth: number,
  displayHeight: number,
  nowMs: number,
  seeded: boolean,
): Flame[] {
  const pivotX = state.random() * displayWidth;
  const pivotY = state.random() * displayHeight;
  const headAngle = state.random() * Math.PI * 2;
  const spin = state.random() < 0.5 ? -1 : 1;
  const angVel = config.swirlRate * spin * (1 + (state.random() - 0.5) * config.speedVariation);
  const lifeMs = randomBetween(state.random, 900, 2200);
  const bornMs = seeded ? nowMs - state.random() * lifeMs : nowMs;
  const headWidth = randomFlameSpan(state.random, displayWidth, config.minWidthRatio, config.maxWidthRatio);
  const thickness = randomFlameSpan(state.random, displayHeight, config.minHeightRatio, config.maxHeightRatio);
  const radius = headWidth * 2.2;
  const baseOpacity = randomBetween(state.random, config.opacityMin, config.opacityMax);
  const colorSeed = flameColorSeed(headWidth, thickness, Math.abs(angVel), baseOpacity);

  const segments: Flame[] = [];
  for (let i = 0; i < SNAKE_SEGMENTS; i++) {
    const along = 1 - i / SNAKE_SEGMENTS;
    const flame: Flame = {
      x: 0,
      y: 0,
      width: Math.max(1, headWidth * 0.55 * along),
      height: Math.max(1, thickness * along),
      speedPxPerSec: 0,
      opacity: baseOpacity * along,
      colorSeed,
      direction: "vortexLines",
      rot: 0,
      pivotX,
      pivotY,
      radius,
      angle: headAngle - spin * i * SNAKE_SEG_ARC,
      angVel,
      radialSign: 0,
      baseOpacity: baseOpacity * along,
      bornMs,
      lifeMs,
      segIndex: i,
      segCount: SNAKE_SEGMENTS,
    };
    applyVortexTransform(flame);
    segments.push(flame);
  }
  return segments;
}
```

Each segment's own `width`/`height`/`baseOpacity` already carry the head→tail taper, so
per-frame stepping only has to advance `angle` and apply the life envelope. The whole
snake shares `bornMs`/`lifeMs`, so it expires together.

- [ ] **Step 6: Route spawn and seed**

In `spawnFlame`, snakes emit MULTIPLE flames, so it cannot return a single `Flame` for
this direction. Change `stepFlames`'s spawn site to handle both shapes — replace the
spawn block at the end of `stepFlames` with:

```ts
const spawnInterval = config.spawnIntervalMs + randomBetween(state.random, -config.spawnJitterMs, config.spawnJitterMs);
if (state.flames.length < config.maxActive && nowMs - state.lastSpawnMs >= spawnInterval) {
  if (config.direction === "vortexLines") {
    state.flames.push(...emitVortexSnake(state, config, display.width, display.height, nowMs, false));
  } else {
    state.flames.push(spawnFlame(state, config, display.width, display.height, nowMs));
  }
  state.lastSpawnMs = nowMs;
}
```

In `seedFlames`, replace the per-particle loop body for this direction — emit whole
snakes until the pool reaches `maxActive`:

```ts
if (config.direction === "vortexLines") {
  while (state.flames.length < config.maxActive) {
    state.flames.push(...emitVortexSnake(state, config, displayWidth, displayHeight, nowMs, true));
  }
  return;
}
```

Place this guard at the top of `seedFlames`, immediately after the existing early-return
check. Because a snake adds `SNAKE_SEGMENTS` at a time, the pool may overshoot
`maxActive` slightly; the existing truncation in `stepFlames`
(`state.flames.length = config.maxActive`) would cut a snake mid-run, which is
acceptable visually (the tail end is the faintest part) — do not add special handling.

- [ ] **Step 7: Add the motion case**

Add to the `switch` in `stepFlames`, beside the other vortex cases:

```ts
      case "vortexLines": {
        flame.angle += flame.angVel * dtSec;
        applyVortexTransform(flame);
        const t = flame.lifeMs > 0 ? (nowMs - flame.bornMs) / flame.lifeMs : 1;
        flame.opacity = flame.baseOpacity * vortexBitEnvelope(t);
        break;
      }
```

Add a `"vortexLines"` case to `isFlameVisible` alongside `"vortexBits"`:

```ts
    case "vortexLines":
      return nowMs - flame.bornMs < flame.lifeMs;
```

- [ ] **Step 8: Run tests to verify they pass**

Run: `pir test -- "flamesSim|normalize"`
Expected: PASS.

- [ ] **Step 9: Full gates**

Run: `pir test && pir typecheck && pir build`
Expected: PASS.

- [ ] **Step 10: Commit**

```bash
git add packages/stripes-engine/src/config/types.ts packages/stripes-engine/src/config/normalize.ts packages/stripes-engine/src/flames/flamesSim.ts packages/stripes-engine/src/flames/flamesSim.test.ts packages/stripes-engine/src/config/normalize.test.ts
git commit -m "feat(engine): vortexLines — trailing snakes that swirl and fade"
```

---

### Task 3: Lab control for `vortexLines`

**Files:**

- Modify: `apps/lab/src/controls/levaSchema.ts` (the `flamesDirection` dropdown options, and the `flamesSwirlRate` render predicate)

**Interfaces:**

- Consumes: `FlamesDirection` value `"vortexLines"`.
- Produces: nothing.

- [ ] **Step 1: Add the dropdown entry**

In the `flamesDirection` control's `options` object, after `"Vortex Bits": "vortexBits",` add:

```ts
              "Vortex Lines": "vortexLines",
```

- [ ] **Step 2: Show Swirl for the new variant**

The `flamesSwirlRate` control's `render` predicate currently matches `"vortex"` and
`"vortexBits"`. Add `"vortexLines"` so the Swirl slider appears for snakes too — it is
what drives their rotation. Leave the `flamesInward` predicate alone: inward is
meaningful only for `"vortex"`.

- [ ] **Step 3: Full gates**

Run: `pir test && pir typecheck && pir build`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add apps/lab/src/controls/levaSchema.ts
git commit -m "feat(lab): Vortex Lines flame direction"
```

---

### Task 4: Live browser verification

**Files:** none — verification only.

Unit tests never compile GLSL and never exercise real motion, so this is mandatory.

- [ ] **Step 1: Reuse the running dev server**

Run: `curl -s -o /dev/null -w "%{http_code}" http://localhost:5174`. If `200`, reuse it.
If not, start once with `pir dev --host`. Never start a second dev server.

- [ ] **Step 2: Open on the remote Chrome pool**

Run: `agent-browser --session lines open http://localhost:5174`. Confirm stderr shows
`[ab-open] remote chrome`. On `[ab-open] BLOCKED` (exit 3), STOP and ask the user
before falling back to `--local`.

- [ ] **Step 3: Check for shader errors**

In the console: `window.__errs` — must be empty.

- [ ] **Step 4: Verify the center fix**

Drive the engine directly with `window.__lab.setConfig({flames:{...}})` using
`direction: "vortex"`, `maxActive: 15`, `baseSpeedPxPerSec: 30` (the lab defaults that
made the clot worst). Reload several times. Capture screenshots and confirm the center
no longer shows a dense stationary knot — particles should be spread evenly by area,
with the innermost ones dim rather than bright.

Quantify it the same way the bug was diagnosed: two screenshots ~700ms apart, then
`magick compare -metric RMSE -crop 200x200+740+340` for the center against
`-crop 220x220+400+250` for an outer patch. Before the fix the center read ~3× the
outer. After, the gap should be markedly smaller. Report the actual numbers.

- [ ] **Step 5: Verify `vortexLines`**

Set `direction: "vortexLines"` with `swirlRate` around 2–3 and `maxActive` ~120.
Confirm: distinct snakes, each curling around its own pivot, tapering from a bright
head to a faint tail, growing/rotating and then fading — NOT squares, and not one
shared whirlpool. Screenshot it.

- [ ] **Step 6: Confirm no regressions**

Cycle every direction: the six linear ones, `vortex` (both Inward states), `vortexBits`,
`vortexLines`. `window.__errs` stays empty throughout.

- [ ] **Step 7: Restore and clean up**

Restore the lab's persisted flames config to the lab defaults (`direction: "up"`,
`maxActive: 15`, `baseSpeedPxPerSec: 30`, `opacityMin: 0.3`, `opacityMax: 0.6`,
`minWidthRatio: 0.01`, `maxWidthRatio: 0.03`, `minHeightRatio: 0.01`,
`maxHeightRatio: 0.06`, `spawnIntervalMs: 80`, `spawnJitterMs: 80`, `edgeSharpness: 1`,
`inward: false`, `swirlRate: 1.2`, `enabled: true`) so the user's lab is not left on a
test configuration. Close the browser session. Write screenshots to the scratchpad
directory, never into the repo.

- [ ] **Step 8: Report results with the measured numbers**

Do not offer to push.
