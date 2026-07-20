# Vortex Bits → Global Smooth Snakes

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the `vortexBits` background-flames variant. Today it is single bars
each orbiting its own scattered local pivot. It becomes smooth snakes (trailing tail,
continuous stroke) all riding ONE shared vortex around the canvas centre.

**User's words:** "They should be smooth snakes, but moving on a vortex shape globally,
not locally."

**Explicitly NOT in scope:** `vortexLines` keeps its local scattered pivots. When offered
"both should ride the global vortex" the user chose Bits only. Do not touch Lines'
pivot model.

**Architecture:** `emitVortexSnake` already builds a trailing-tail snake as N segment
`Flame` records. Bits reuses that machinery with a different pivot model (canvas centre,
per-snake orbit radius, slow radial drift so the population reads as a spiral rather
than concentric circles). The GL pass is unchanged.

## Global Constraints

- Package manager: `pi` / `pir`. Never npm/pnpm/yarn/npx.
- Gates: `pir test`, `pir typecheck`, `pir build`.
- No code comments unless a step's code block already contains one.
- Never set a git identity. Commit only; never push.
- Work on `main`. Stage files EXPLICITLY BY PATH — never `git add -A`; another engineer
  is active in this repo.
- Do not add `prefers-reduced-motion` handling.
- The six linear directions, `vortex`, and `vortexLines` must behave IDENTICALLY. Only
  `vortexBits` changes.
- `Flame` has no optional fields; `emitVortexSnake` builds `Flame` objects directly, so
  every field must be set on that path.
- Test timelines start at `nowMs = 1` (`stepFlames` treats `lastStepMs <= 0` as a
  "never stepped" sentinel).
- Do NOT write a test that seeds a pool to its cap then asserts new spawns — spawning is
  gated on being under the cap, so it can never pass.
- Screenshot-RMSE diffing does NOT discriminate config changes in this app: a control
  (same config re-applied) measures ~0.0088, higher than real knob changes. Do not use
  it as evidence. Verify via unit tests and by reading values back.

---

### Task 1: Share the snake config shape; add `flames.bits`

**Files:**

- Modify: `packages/stripes-engine/src/config/types.ts`
- Modify: `packages/stripes-engine/src/config/normalize.ts`
- Modify: `apps/lab/src/defaultLabConfig.ts`
- Test: `packages/stripes-engine/src/config/normalize.test.ts`

**Interfaces:**

- Produces: `FlamesSnakeConfig` (the existing `FlamesLinesConfig` shape, renamed), plus
  `FlamesConfig.bits` of that type. `FlamesConfig.lines` keeps its key and its type.

Both snake variants need the same twelve knobs. Give them ONE shared type and TWO
independent instances so tuning one never silently changes the other.

- [ ] **Step 1: Write the failing tests**

Append to `packages/stripes-engine/src/config/normalize.test.ts`:

```ts
describe("normalizeFlames bits block", () => {
  it("defaults the bits block independently of lines", () => {
    const f = normalizeFlames({});
    expect(f.bits.tailMin).toBe(3);
    expect(f.bits.tailMax).toBe(7);
    expect(f.bits.maxInstances).toBe(26);
    expect(f.lines.tailMin).toBe(4);
  });

  it("keeps bits and lines independent", () => {
    const f = normalizeFlames({ bits: { tailMin: 9, tailMax: 9 } } as never);
    expect(f.bits.tailMin).toBe(9);
    expect(f.lines.tailMin).toBe(4);
  });

  it("orders every bits min/max pair", () => {
    const b = normalizeFlames({
      bits: {
        tailMin: 20,
        tailMax: 3,
        scaleMin: 0.4,
        scaleMax: 0.01,
        speedMin: 9,
        speedMax: 0.1,
        intervalMinMs: 5000,
        intervalMaxMs: 10,
        lifeMinMs: 9000,
        lifeMaxMs: 100,
      },
    } as never).bits;
    expect(b.tailMax).toBeGreaterThanOrEqual(b.tailMin);
    expect(b.scaleMax).toBeGreaterThanOrEqual(b.scaleMin);
    expect(b.speedMax).toBeGreaterThanOrEqual(b.speedMin);
    expect(b.intervalMaxMs).toBeGreaterThanOrEqual(b.intervalMinMs);
    expect(b.lifeMaxMs).toBeGreaterThanOrEqual(b.lifeMinMs);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `pir test -- normalize.test`
Expected: FAIL — `bits` is undefined.

- [ ] **Step 3: Rename the type, add the field**

In `packages/stripes-engine/src/config/types.ts`, rename `FlamesLinesConfig` to
`FlamesSnakeConfig` (same twelve fields, unchanged). Keep a deprecated alias so any
external consumer keeps compiling:

```ts
export type FlamesLinesConfig = FlamesSnakeConfig;
```

In `FlamesConfig`, keep `lines: FlamesSnakeConfig;` and add `bits: FlamesSnakeConfig;`
directly after it.

- [ ] **Step 4: Defaults and normalizer**

In `packages/stripes-engine/src/config/normalize.ts`, rename the existing
`DEFAULT_FLAMES_LINES` type annotation to `FlamesSnakeConfig` (values unchanged) and add:

```ts
export const DEFAULT_FLAMES_BITS: FlamesSnakeConfig = {
  tailMin: 3,
  tailMax: 7,
  scaleMin: 0.02,
  scaleMax: 0.06,
  thickness: 0.14,
  speedMin: 0.25,
  speedMax: 0.9,
  intervalMinMs: 70,
  intervalMaxMs: 200,
  lifeMinMs: 1400,
  lifeMaxMs: 3200,
  maxInstances: 26,
};
```

Bits are shorter, smaller, slower and more numerous than Lines — they read as a swirl of
many small strokes rather than a few big ones.

Rename the existing `normalizeFlamesLines` helper to `normalizeFlamesSnake(i, fallback)`
taking the defaults as a second parameter (the clamp bounds stay exactly as they are),
then wire both blocks in `normalizeFlames`:

```ts
    lines: normalizeFlamesSnake(i.lines, DEFAULT_FLAMES_LINES),
    bits: normalizeFlamesSnake(i.bits, DEFAULT_FLAMES_BITS),
```

Add `bits: DEFAULT_FLAMES_BITS,` to `DEFAULT_FLAMES`.

- [ ] **Step 5: Mirror in the lab defaults**

Add the same twelve `bits` values to the `flames` block in
`apps/lab/src/defaultLabConfig.ts`.

- [ ] **Step 6: Gates**

Run: `pir test && pir typecheck && pir build`

- [ ] **Step 7: Commit**

```bash
git add packages/stripes-engine/src/config/types.ts packages/stripes-engine/src/config/normalize.ts packages/stripes-engine/src/config/normalize.test.ts apps/lab/src/defaultLabConfig.ts
git commit -m "feat(engine): shared snake config shape, dedicated flames.bits block"
```

---

### Task 2: Bits become global-vortex snakes

**Files:**

- Modify: `packages/stripes-engine/src/flames/flamesSim.ts`
- Test: `packages/stripes-engine/src/flames/flamesSim.test.ts`

**Interfaces:**

- Consumes: `FlamesConfig.bits`.
- Produces: `placeVortexBit` is DELETED. `emitVortexSnake` gains a pivot mode.

**What changes.** Today `placeVortexBit` gives each bit its own random pivot and emits
ONE bar. After this task a bit is a SNAKE emitted by `emitVortexSnake`, and every snake
shares the canvas-centre pivot, differing by its own orbit radius and phase. A slow
radial drift makes the population read as a spiral rather than concentric rings.

- [ ] **Step 1: Write the failing tests**

Replace the existing `describe("vortex bits", …)` block in
`packages/stripes-engine/src/flames/flamesSim.test.ts` with:

```ts
describe("vortex bits (global snakes)", () => {
  const bitsConfig = (o = {}) =>
    normalizeFlames({
      enabled: true,
      direction: "vortexBits",
      opacityMin: 1,
      opacityMax: 1,
      bits: { maxInstances: 10, tailMin: 5, tailMax: 5, ...o },
    } as never);

  it("emits snakes, not single bars", () => {
    const state = createFlamesState(seededRandom());
    stepFlames(state, bitsConfig(), DISPLAY, 1);
    expect(state.flames.length).toBeGreaterThan(0);
    state.flames.forEach((f) => expect(f.segCount).toBe(5));
  });

  it("shares one global pivot at the canvas centre", () => {
    const state = createFlamesState(seededRandom());
    stepFlames(state, bitsConfig(), DISPLAY, 1);
    const cx = DISPLAY.width / 2;
    const cy = DISPLAY.height / 2;
    state.flames.forEach((f) => {
      expect(f.pivotX).toBeCloseTo(cx, 5);
      expect(f.pivotY).toBeCloseTo(cy, 5);
    });
  });

  it("spreads snakes across distinct orbit radii", () => {
    const state = createFlamesState(seededRandom());
    stepFlames(state, bitsConfig(), DISPLAY, 1);
    const radii = new Set(state.flames.map((f) => Math.round(f.radius)));
    expect(radii.size).toBeGreaterThan(3);
  });

  it("caps by snake instances", () => {
    const state = createFlamesState(seededRandom());
    stepFlames(state, bitsConfig({ maxInstances: 4, tailMin: 6, tailMax: 6 }), DISPLAY, 1);
    expect(state.flames.length).toBe(24);
  });

  it("tapers head to tail", () => {
    const state = createFlamesState(seededRandom());
    stepFlames(state, bitsConfig(), DISPLAY, 1);
    const head = state.flames.find((f) => f.segIndex === 0);
    const mates = state.flames.filter((f) => f.radius === head.radius).sort((a, b) => a.segIndex - b.segIndex);
    expect(mates[mates.length - 1].width).toBeLessThan(head.width);
  });

  it("drifts radially so the population reads as a spiral", () => {
    const state = createFlamesState(seededRandom());
    const config = bitsConfig({ lifeMinMs: 9000, lifeMaxMs: 9000 });
    stepFlames(state, config, DISPLAY, 1);
    const before = state.flames[0].radius;
    stepFlames(state, config, DISPLAY, 600);
    expect(state.flames[0].radius).not.toBeCloseTo(before, 3);
  });

  it("expires a whole snake together", () => {
    const state = createFlamesState(seededRandom());
    const config = bitsConfig({ lifeMinMs: 300, lifeMaxMs: 300, intervalMinMs: 5000, intervalMaxMs: 5000 });
    stepFlames(state, config, DISPLAY, 1);
    expect(state.flames.length).toBeGreaterThan(0);
    stepFlames(state, config, DISPLAY, 4000);
    expect(state.flames.length).toBe(0);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `pir test -- flamesSim`
Expected: FAIL — bits are single bars with scattered pivots.

- [ ] **Step 3: Give the emitter a pivot mode**

Change `emitVortexSnake`'s signature to take the snake params and a mode:

```ts
function emitVortexSnake(
  state: FlamesState,
  config: FlamesConfig,
  snake: FlamesSnakeConfig,
  global: boolean,
  displayWidth: number,
  displayHeight: number,
  nowMs: number,
  seeded: boolean,
): Flame[];
```

Inside, replace the pivot/radius selection. Everything else (segment loop, taper, sign of
the per-segment offset, life envelope) stays exactly as it is:

```ts
const segCount = Math.round(randomBetween(state.random, snake.tailMin, snake.tailMax));
const scale = randomBetween(state.random, snake.scaleMin, snake.scaleMax) * displayWidth;
const thickness = Math.max(1, scale * snake.thickness);
const lifeMs = randomBetween(state.random, snake.lifeMinMs, snake.lifeMaxMs);
const spin = state.random() < 0.5 ? -1 : 1;

let pivotX: number;
let pivotY: number;
let radius: number;
let radialSign: number;
let angVel: number;
if (global) {
  const rMax = vortexMaxRadius(displayWidth, displayHeight);
  const rMin = rMax * VORTEX_CORE_RATIO;
  const u = state.random();
  pivotX = displayWidth * 0.5;
  pivotY = displayHeight * 0.5;
  radius = Math.sqrt(rMin * rMin + u * (rMax * rMax - rMin * rMin));
  radialSign = config.inward ? -1 : 1;
  angVel = randomBetween(state.random, snake.speedMin, snake.speedMax) * (config.inward ? -1 : 1);
} else {
  pivotX = state.random() * displayWidth;
  pivotY = state.random() * displayHeight;
  radius = scale;
  radialSign = 0;
  angVel = spin * randomBetween(state.random, snake.speedMin, snake.speedMax);
}

const segArc = SNAKE_SEG_ARC;
const headWidth = Math.max(1, radius * segArc * SNAKE_SEG_OVERLAP);
const headAngle = state.random() * Math.PI * 2;
const bornMs = seeded ? nowMs - state.random() * lifeMs : nowMs;
const baseOpacity = randomBetween(state.random, config.opacityMin, config.opacityMax);
const colorSeed = flameColorSeed(headWidth, thickness, Math.abs(angVel), baseOpacity);
```

Two things to note. The global branch reuses the SAME area-uniform annulus draw as the
`vortex` direction (`sqrt(rMin² + u(rMax² − rMin²))`), which is what prevents a dense
clot at the centre — do not substitute a plain `random() * rMax`. And in the global
branch the direction of travel is set by `angVel`'s sign alone, so the per-segment offset
`angle: headAngle - Math.sign(angVel) * i * segArc` must use `Math.sign(angVel)`, not the
local `spin`, or the tail will lead the head. Update that line in the segment loop
accordingly and keep the existing trailing-direction test green.

`headWidth` deriving from `radius` is what makes the stroke continuous: a segment is
sized to the arc length it spans (`radius * segArc`) with 15% overlap, so segments touch
at any orbit radius.

Each segment must carry `speedPxPerSec` for the radial drift. Set it in the segment
literal to a small fraction of the orbit speed in the global branch and `0` otherwise —
use `global ? Math.abs(angVel) * radius * 0.06 : 0`, and set `radialSign` on each segment
to the value computed above.

- [ ] **Step 4: Step the radial drift**

In `stepFlames`'s `case "vortexBits":`, add the radial term before the transform so global
bits spiral:

```ts
      case "vortexBits": {
        flame.radius += flame.radialSign * flame.speedPxPerSec * dtSec;
        flame.angle += flame.angVel * dtSec;
        applyVortexTransform(flame);
        const t = flame.lifeMs > 0 ? (nowMs - flame.bornMs) / flame.lifeMs : 1;
        flame.opacity = flame.baseOpacity * vortexBitEnvelope(t);
        break;
      }
```

With `radialSign = 0` this reduces to the previous behaviour, so `vortexLines` (which
shares no code path here) and any non-global bit are unaffected.

- [ ] **Step 5: Route spawn, seed and capacity**

Delete `placeVortexBit` entirely. Everywhere `vortexBits` previously called it, call
`emitVortexSnake(state, config, config.bits, true, …)`; `vortexLines` calls
`emitVortexSnake(state, config, config.lines, false, …)`.

Both snake directions must now use the instance-cap path, not the `maxActive`
truncation. Generalise the existing `isLines` flag to cover both — e.g. an
`isSnakeDirection(config.direction)` helper returning true for `"vortexBits"` and
`"vortexLines"` — and use it for the spawn gate, the interval source (`config.bits` vs
`config.lines`), and to skip the `maxActive` truncation. Make sure it is in scope before
the truncation line.

- [ ] **Step 6: Run to verify pass**

Run: `pir test -- flamesSim`
Expected: PASS, including the existing `vortexLines` and `vortex` tests.

- [ ] **Step 7: Gates**

Run: `pir test && pir typecheck && pir build`

- [ ] **Step 8: Commit**

```bash
git add packages/stripes-engine/src/flames/flamesSim.ts packages/stripes-engine/src/flames/flamesSim.test.ts
git commit -m "feat(engine): vortexBits are global-vortex snakes"
```

---

### Task 3: Lab controls for the bits block

**Files:**

- Modify: `apps/lab/src/controls/levaSchema.ts`

Bits now needs the same twelve knobs Lines has, reading `d.flames.bits.*` and writing
`values.flamesBits*` into a nested `bits:` object.

- [ ] **Step 1: Add twelve `flamesBits*` controls**

Mirror the existing `flamesLines*` controls exactly — same labels, same ranges, same
percentage convention for the two scale controls (`* 100` in, `/ 100` out) — but sourced
from `d.flames.bits.*` and gated on
`get("Background Flames.flamesDirection") === "vortexBits"`.

Ranges (matching the engine clamps): tail 2..40 step 1; scale 0.5..50 % step 0.1;
thickness 0.02..1 step 0.01; speed 0..12 step 0.05; interval 10..5000 ms step 10;
life 100..20000 ms step 50; max snakes 1..120 step 1.

- [ ] **Step 2: Map them into the config**

Add a nested `bits:` object to the `flames:` output block reading the twelve live
`values.flamesBits*` controls. Read from `values.*`, never from `d.*` — a `d.`-sourced
field is frozen at mount and the sliders would do nothing.

- [ ] **Step 3: Update the hiding rules**

`vortexBits` is now a snake variant, so it must hide the same generic controls
`vortexLines` hides. Update the predicates so that for `"vortexBits"` these are HIDDEN:
`flamesMinWidthPct`, `flamesMaxWidthPct`, `flamesMinHeightPct`, `flamesMaxHeightPct`,
`flamesSpawnInterval`, `flamesSpawnJitter`, `flamesMaxActive`, `flamesSwirlRate`
(superseded by Speed min/max), plus `flamesBaseSpeed`/`flamesSpeedVariation` which are
already hidden for it.

`flamesInward` must now ALSO show for `"vortexBits"` — global bits spiral outward or
inward like the `vortex` direction. Its predicate becomes `"vortex"` OR `"vortexBits"`.

The six linear directions must still see EXACTLY the controls they see today. Read each
predicate back after editing.

- [ ] **Step 4: Gates**

Run: `pir test && pir typecheck && pir build`

- [ ] **Step 5: Commit**

```bash
git add apps/lab/src/controls/levaSchema.ts
git commit -m "feat(lab): Vortex Bits snake controls"
```

---

### Task 4: Live verification

- [ ] **Step 1:** Probe `curl -s -o /dev/null -w "%{http_code}" http://localhost:5174`; reuse if 200, never start a second dev server.
- [ ] **Step 2:** `agent-browser --session bits open http://localhost:5174`. On `[ab-open] BLOCKED` STOP and ask the user. Reload fully — leva only registers new keys on a full load.
- [ ] **Step 3:** `window.__errs` must be empty.
- [ ] **Step 4:** Select Vortex Bits. Confirm visually that snakes now sweep around ONE shared centre — concentric/spiralling strokes, not scattered local curls — and that each stroke is continuous rather than a row of separate chunks. Screenshot it. Toggle Inward and confirm the spiral reverses.
- [ ] **Step 5:** Confirm the panel shows the twelve Bits knobs and hides Base speed / Speed variation / Swirl / Width / Height / Spawn / Max active, and that Inward is present.
- [ ] **Step 6:** Verify a knob reaches the config end-to-end the way that actually works here: tag the input via `eval`, drive it with `agent-browser fill` + `press Enter` (REAL keystrokes — synthetic events do not drive leva's controlled inputs), then read the value back out of `localStorage`. Do NOT use screenshot-RMSE diffing; it does not discriminate in this app.
- [ ] **Step 7:** Confirm `vortexLines` still uses local scattered pivots and is unchanged.
- [ ] **Step 8:** Cycle all nine directions; `window.__errs` stays empty.
- [ ] **Step 9:** Restore the lab's persisted flames config to defaults, close the session, screenshots to the scratchpad only.
- [ ] **Step 10:** Report with evidence. Do not offer to push.
