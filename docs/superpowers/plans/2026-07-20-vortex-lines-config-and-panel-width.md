# Vortex Lines Dedicated Config + Wide-Screen Panel Width

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give `vortexLines` its own config block with knobs that actually drive it, hide
the generic flame knobs it ignores, and widen the right-hand lab panel on ≥1800px
screens so labels stop truncating.

**Why:** The user set "Base speed" to slow and nothing changed. Correct — `emitVortexSnake`
hardcodes `speedPxPerSec: 0` and drives rotation from `swirlRate` alone. Tail length
(`SNAKE_SEGMENTS = 7`), segment arc (`SNAKE_SEG_ARC = 0.16`) and lifetime (900–2200ms)
are also hardcoded constants with no knobs, and `maxActive` counts SEGMENTS, so "200"
is really ~28 snakes.

**Architecture:** A nested `flames.lines` block, matching the codebase's existing
per-variant pattern (`reveal.vortex`, `reveal.glitch`). The GL pass is unchanged.

## Global Constraints

- Package manager: `pi` for installs, `pir` for scripts. Never npm/pnpm/yarn/npx.
- Gates: `pir test`, `pir typecheck`, `pir build`.
- No code comments unless a step's code block already contains one.
- Never set a git identity. Commit only; never push.
- Work on `main`. Stage files EXPLICITLY BY PATH — never `git add -A`; another engineer
  is active in this repo.
- Do not add `prefers-reduced-motion` handling.
- The six linear directions, `vortex`, and `vortexBits` MOTION must be unchanged.
- Tests start timelines at `nowMs = 1` (`stepFlames` treats `lastStepMs <= 0` as a
  "never stepped" sentinel).
- A test that seeds the pool to exactly `maxActive` then asserts new spawns is
  unsatisfiable (spawn is gated on `length < maxActive`). Don't write one.

**Approved semantics (from the user):**

- **Tail length = literal segment count** (min/max). Length and density move together.
- **Scale resizes the whole snake proportionally** — stroke size AND curl radius
  together, so shape is preserved.

---

### Task 1: `flames.lines` config block

**Files:**

- Modify: `packages/stripes-engine/src/config/types.ts`
- Modify: `packages/stripes-engine/src/config/normalize.ts`
- Modify: `apps/lab/src/defaultLabConfig.ts`
- Test: `packages/stripes-engine/src/config/normalize.test.ts`

**Interfaces:**

- Produces: `FlamesLinesConfig` and `FlamesConfig.lines`.

- [ ] **Step 1: Write the failing tests**

Append to `packages/stripes-engine/src/config/normalize.test.ts`:

```ts
describe("normalizeFlames lines block", () => {
  it("defaults the lines block", () => {
    const l = normalizeFlames({}).lines;
    expect(l.tailMin).toBe(4);
    expect(l.tailMax).toBe(10);
    expect(l.speedMin).toBeCloseTo(0.6);
    expect(l.speedMax).toBeCloseTo(2.4);
    expect(l.maxInstances).toBe(18);
  });

  it("orders every min/max pair", () => {
    const l = normalizeFlames({
      lines: {
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
    } as never).lines;
    expect(l.tailMax).toBeGreaterThanOrEqual(l.tailMin);
    expect(l.scaleMax).toBeGreaterThanOrEqual(l.scaleMin);
    expect(l.speedMax).toBeGreaterThanOrEqual(l.speedMin);
    expect(l.intervalMaxMs).toBeGreaterThanOrEqual(l.intervalMinMs);
    expect(l.lifeMaxMs).toBeGreaterThanOrEqual(l.lifeMinMs);
  });

  it("rounds and clamps segment counts and instances", () => {
    const l = normalizeFlames({
      lines: { tailMin: 0.2, tailMax: 999, maxInstances: 0 },
    } as never).lines;
    expect(Number.isInteger(l.tailMin)).toBe(true);
    expect(Number.isInteger(l.tailMax)).toBe(true);
    expect(l.tailMin).toBeGreaterThanOrEqual(2);
    expect(l.tailMax).toBeLessThanOrEqual(40);
    expect(l.maxInstances).toBeGreaterThanOrEqual(1);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `pir test -- normalize.test`
Expected: FAIL — `lines` is undefined.

- [ ] **Step 3: Add the type**

In `packages/stripes-engine/src/config/types.ts`, above `FlamesConfig`:

```ts
export interface FlamesLinesConfig {
  tailMin: number;
  tailMax: number;
  scaleMin: number;
  scaleMax: number;
  thickness: number;
  speedMin: number;
  speedMax: number;
  intervalMinMs: number;
  intervalMaxMs: number;
  lifeMinMs: number;
  lifeMaxMs: number;
  maxInstances: number;
}
```

and add `lines: FlamesLinesConfig;` as the last field of `FlamesConfig`.

- [ ] **Step 4: Add defaults and normalizer**

In `packages/stripes-engine/src/config/normalize.ts`, add before `DEFAULT_FLAMES`:

```ts
export const DEFAULT_FLAMES_LINES: FlamesLinesConfig = {
  tailMin: 4,
  tailMax: 10,
  scaleMin: 0.04,
  scaleMax: 0.11,
  thickness: 0.16,
  speedMin: 0.6,
  speedMax: 2.4,
  intervalMinMs: 90,
  intervalMaxMs: 260,
  lifeMinMs: 900,
  lifeMaxMs: 2200,
  maxInstances: 18,
};
```

Add `lines: DEFAULT_FLAMES_LINES,` as the last entry of `DEFAULT_FLAMES`, then add this
helper next to `normalizeFlames`:

```ts
function normalizeFlamesLines(i: Partial<FlamesLinesConfig> = {}): FlamesLinesConfig {
  const tailMin = clamp(Math.round(num(i.tailMin, DEFAULT_FLAMES_LINES.tailMin)), 2, 40);
  const tailMax = clamp(Math.round(num(i.tailMax, DEFAULT_FLAMES_LINES.tailMax)), tailMin, 40);
  const scaleMin = clamp(num(i.scaleMin, DEFAULT_FLAMES_LINES.scaleMin), 0.005, 0.5);
  const scaleMax = clamp(num(i.scaleMax, DEFAULT_FLAMES_LINES.scaleMax), scaleMin, 0.5);
  const speedMin = clamp(num(i.speedMin, DEFAULT_FLAMES_LINES.speedMin), 0, 12);
  const speedMax = clamp(num(i.speedMax, DEFAULT_FLAMES_LINES.speedMax), speedMin, 12);
  const intervalMinMs = clamp(Math.round(num(i.intervalMinMs, DEFAULT_FLAMES_LINES.intervalMinMs)), 10, 5000);
  const intervalMaxMs = clamp(
    Math.round(num(i.intervalMaxMs, DEFAULT_FLAMES_LINES.intervalMaxMs)),
    intervalMinMs,
    5000,
  );
  const lifeMinMs = clamp(Math.round(num(i.lifeMinMs, DEFAULT_FLAMES_LINES.lifeMinMs)), 100, 20000);
  const lifeMaxMs = clamp(Math.round(num(i.lifeMaxMs, DEFAULT_FLAMES_LINES.lifeMaxMs)), lifeMinMs, 20000);
  return {
    tailMin,
    tailMax,
    scaleMin,
    scaleMax,
    thickness: clamp(num(i.thickness, DEFAULT_FLAMES_LINES.thickness), 0.02, 1),
    speedMin,
    speedMax,
    intervalMinMs,
    intervalMaxMs,
    lifeMinMs,
    lifeMaxMs,
    maxInstances: clamp(Math.round(num(i.maxInstances, DEFAULT_FLAMES_LINES.maxInstances)), 1, 120),
  };
}
```

Add `lines: normalizeFlamesLines(i.lines),` to the object returned by `normalizeFlames`.
Import `FlamesLinesConfig` as a type alongside the existing `FlamesConfig` import.

- [ ] **Step 5: Mirror the defaults in the lab**

In `apps/lab/src/defaultLabConfig.ts`, add a `lines` block to `flames` with the same
twelve values as `DEFAULT_FLAMES_LINES` above.

- [ ] **Step 6: Gates**

Run: `pir test && pir typecheck && pir build`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add packages/stripes-engine/src/config/types.ts packages/stripes-engine/src/config/normalize.ts packages/stripes-engine/src/config/normalize.test.ts apps/lab/src/defaultLabConfig.ts
git commit -m "feat(engine): dedicated flames.lines config block"
```

---

### Task 2: Drive the snakes from the new block

**Files:**

- Modify: `packages/stripes-engine/src/flames/flamesSim.ts`
- Test: `packages/stripes-engine/src/flames/flamesSim.test.ts`

**Interfaces:**

- Consumes: `FlamesConfig.lines` from Task 1.
- Produces: `emitVortexSnake` now returns a variable-length segment run.

Replace ALL the hardcoded snake behavior. `SNAKE_SEGMENTS` and `SNAKE_SEG_ARC` are
deleted — segment count comes from `tailMin/tailMax`, and the arc gap is derived so a
snake's stroke stays continuous regardless of segment count.

- [ ] **Step 1: Write the failing tests**

Append to the existing `describe("vortex lines", …)` block in
`packages/stripes-engine/src/flames/flamesSim.test.ts`:

```ts
it("honours the configured segment-count range", () => {
  const state = createFlamesState(seededRandom());
  const config = normalizeFlames({
    enabled: true,
    direction: "vortexLines",
    maxActive: 200,
    lines: { tailMin: 3, tailMax: 3, maxInstances: 6 },
  } as never);
  stepFlames(state, config, DISPLAY, 1);
  state.flames.forEach((f) => expect(f.segCount).toBe(3));
});

it("caps by snake instances, not segments", () => {
  const state = createFlamesState(seededRandom());
  const config = normalizeFlames({
    enabled: true,
    direction: "vortexLines",
    maxActive: 200,
    lines: { tailMin: 5, tailMax: 5, maxInstances: 4 },
  } as never);
  stepFlames(state, config, DISPLAY, 1);
  const pivots = new Set(state.flames.map((f) => `${f.pivotX},${f.pivotY}`));
  expect(pivots.size).toBe(4);
  expect(state.flames.length).toBe(20);
});

it("draws rotation speed from the configured range", () => {
  const state = createFlamesState(seededRandom());
  const config = normalizeFlames({
    enabled: true,
    direction: "vortexLines",
    lines: { speedMin: 3, speedMax: 3, maxInstances: 8 },
  } as never);
  stepFlames(state, config, DISPLAY, 1);
  state.flames.forEach((f) => expect(Math.abs(f.angVel)).toBeCloseTo(3, 5));
});

it("draws lifetime from the configured range", () => {
  const state = createFlamesState(seededRandom());
  const config = normalizeFlames({
    enabled: true,
    direction: "vortexLines",
    lines: { lifeMinMs: 1500, lifeMaxMs: 1500, maxInstances: 6 },
  } as never);
  stepFlames(state, config, DISPLAY, 1);
  state.flames.forEach((f) => expect(f.lifeMs).toBe(1500));
});

it("scales stroke and curl radius together", () => {
  const small = createFlamesState(seededRandom());
  const big = createFlamesState(seededRandom());
  const mk = (s: number) =>
    normalizeFlames({
      enabled: true,
      direction: "vortexLines",
      lines: { scaleMin: s, scaleMax: s, maxInstances: 6, tailMin: 5, tailMax: 5 },
    } as never);
  stepFlames(small, mk(0.03), DISPLAY, 1);
  stepFlames(big, mk(0.12), DISPLAY, 1);
  const sHead = small.flames.find((f) => f.segIndex === 0);
  const bHead = big.flames.find((f) => f.segIndex === 0);
  const ratioWidth = bHead.width / sHead.width;
  const ratioRadius = bHead.radius / sHead.radius;
  expect(ratioWidth).toBeGreaterThan(3);
  expect(ratioRadius).toBeCloseTo(ratioWidth, 1);
});

it("spawns on the configured interval range", () => {
  const state = createFlamesState(seededRandom());
  const config = normalizeFlames({
    enabled: true,
    direction: "vortexLines",
    lines: { intervalMinMs: 1000, intervalMaxMs: 1000, maxInstances: 40, tailMin: 3, tailMax: 3 },
  } as never);
  stepFlames(state, config, DISPLAY, 1);
  const seeded = state.flames.length;
  stepFlames(state, config, DISPLAY, 100);
  expect(state.flames.length).toBe(seeded);
});
```

Ensure `normalizeFlames` is imported in this test file (it already is, used by the
existing helpers).

- [ ] **Step 2: Run to verify failure**

Run: `pir test -- flamesSim`
Expected: FAIL — segment count is fixed at 7, `angVel` comes from `swirlRate`, lifetime
is hardcoded.

- [ ] **Step 3: Rewrite the emitter**

In `packages/stripes-engine/src/flames/flamesSim.ts`, delete the `SNAKE_SEGMENTS` and
`SNAKE_SEG_ARC` constants and replace `emitVortexSnake` with:

```ts
const SNAKE_ARC_PER_SEGMENT = 0.9;

function emitVortexSnake(
  state: FlamesState,
  config: FlamesConfig,
  displayWidth: number,
  displayHeight: number,
  nowMs: number,
  seeded: boolean,
): Flame[] {
  const lines = config.lines;
  const segCount = Math.round(randomBetween(state.random, lines.tailMin, lines.tailMax));
  const scale = randomBetween(state.random, lines.scaleMin, lines.scaleMax) * displayWidth;
  const radius = scale;
  const headWidth = scale * SNAKE_ARC_PER_SEGMENT * (1 / Math.max(2, segCount)) * 2;
  const thickness = Math.max(1, scale * lines.thickness);
  const segArc = SNAKE_ARC_PER_SEGMENT / Math.max(2, segCount);
  const pivotX = state.random() * displayWidth;
  const pivotY = state.random() * displayHeight;
  const headAngle = state.random() * Math.PI * 2;
  const spin = state.random() < 0.5 ? -1 : 1;
  const angVel = spin * randomBetween(state.random, lines.speedMin, lines.speedMax);
  const lifeMs = randomBetween(state.random, lines.lifeMinMs, lines.lifeMaxMs);
  const bornMs = seeded ? nowMs - state.random() * lifeMs : nowMs;
  const baseOpacity = randomBetween(state.random, config.opacityMin, config.opacityMax);
  const colorSeed = flameColorSeed(headWidth, thickness, Math.abs(angVel), baseOpacity);

  const segments: Flame[] = [];
  for (let i = 0; i < segCount; i++) {
    const along = 1 - i / segCount;
    const flame: Flame = {
      x: 0,
      y: 0,
      width: Math.max(1, headWidth * along),
      height: Math.max(1, thickness * along),
      speedPxPerSec: 0,
      opacity: baseOpacity * along,
      colorSeed,
      direction: "vortexLines",
      rot: 0,
      pivotX,
      pivotY,
      radius,
      angle: headAngle - spin * i * segArc,
      angVel,
      radialSign: 0,
      baseOpacity: baseOpacity * along,
      bornMs,
      lifeMs,
      segIndex: i,
      segCount,
    };
    applyVortexTransform(flame);
    segments.push(flame);
  }
  return segments;
}
```

`segArc` shrinks as `segCount` grows, so a longer tail is denser over the same total
arc rather than wrapping further — and `headWidth` shrinks with it so segments stay
touching. Both `radius` and the stroke sizes derive from the single `scale` draw, which
is what makes scaling proportional.

- [ ] **Step 4: Use the instance cap and interval range**

In `seedFlames`, replace the `vortexLines` early-return branch with one that counts
SNAKES:

```ts
if (config.direction === "vortexLines") {
  for (let i = 0; i < config.lines.maxInstances; i++) {
    state.flames.push(...emitVortexSnake(state, config, displayWidth, displayHeight, nowMs, true));
  }
  return;
}
```

In `stepFlames`, the spawn gate must also count snakes and use the lines interval.
Replace the spawn block with:

```ts
const isLines = config.direction === "vortexLines";
const spawnInterval = isLines
  ? randomBetween(state.random, config.lines.intervalMinMs, config.lines.intervalMaxMs)
  : config.spawnIntervalMs + randomBetween(state.random, -config.spawnJitterMs, config.spawnJitterMs);
const atCapacity = isLines
  ? new Set(state.flames.map((f) => `${f.pivotX},${f.pivotY}`)).size >= config.lines.maxInstances
  : state.flames.length >= config.maxActive;
if (!atCapacity && nowMs - state.lastSpawnMs >= spawnInterval) {
  if (isLines) {
    state.flames.push(...emitVortexSnake(state, config, display.width, display.height, nowMs, false));
  } else {
    state.flames.push(spawnFlame(state, config, display.width, display.height, nowMs));
  }
  state.lastSpawnMs = nowMs;
}
```

The existing `maxActive` truncation must NOT apply to lines — it would cut snakes mid-run
and fight the instance cap. Guard it:

```ts
if (!isLines && state.flames.length > config.maxActive) {
  state.flames.length = config.maxActive;
}
```

Note this means `isLines` must be computed before that truncation; declare it once near
the top of the post-filter section and reuse it.

- [ ] **Step 5: Run to verify pass**

Run: `pir test -- flamesSim`
Expected: PASS, including every pre-existing vortex/vortexBits/linear test.

- [ ] **Step 6: Gates**

Run: `pir test && pir typecheck && pir build`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add packages/stripes-engine/src/flames/flamesSim.ts packages/stripes-engine/src/flames/flamesSim.test.ts
git commit -m "feat(engine): drive vortexLines from its own config block"
```

---

### Task 3: Lab controls — add the lines knobs, hide the dead ones

**Files:**

- Modify: `apps/lab/src/controls/levaSchema.ts`

**Interfaces:**

- Consumes: `flames.lines` from Task 1.

The user's actual complaint was a dead slider: "Base speed" is visible for
`vortexLines` but ignored. Fix both halves — add the real knobs, and stop rendering the
ones that do nothing for the selected direction.

- [ ] **Step 1: Add the twelve lines controls**

In the `"Background Flames"` folder, after `flamesSwirlRate`, add controls mapped to
`d.flames.lines.*`, every one gated on
`get("Background Flames.flamesDirection") === "vortexLines"` (AND enabled === true,
matching the folder's strict-equality idiom):

| leva key                   | label             | min  | max   | step |
| -------------------------- | ----------------- | ---- | ----- | ---- |
| `flamesLinesTailMin`       | Tail min          | 2    | 40    | 1    |
| `flamesLinesTailMax`       | Tail max          | 2    | 40    | 1    |
| `flamesLinesScaleMinPct`   | Scale min %       | 0.5  | 50    | 0.1  |
| `flamesLinesScaleMaxPct`   | Scale max %       | 0.5  | 50    | 0.1  |
| `flamesLinesThickness`     | Thickness         | 0.02 | 1     | 0.01 |
| `flamesLinesSpeedMin`      | Speed min         | 0    | 12    | 0.05 |
| `flamesLinesSpeedMax`      | Speed max         | 0    | 12    | 0.05 |
| `flamesLinesIntervalMinMs` | Interval min (ms) | 10   | 5000  | 10   |
| `flamesLinesIntervalMaxMs` | Interval max (ms) | 10   | 5000  | 10   |
| `flamesLinesLifeMinMs`     | Life min (ms)     | 100  | 20000 | 50   |
| `flamesLinesLifeMaxMs`     | Life max (ms)     | 100  | 20000 | 50   |
| `flamesLinesMaxInstances`  | Max snakes        | 1    | 120   | 1    |

The two scale controls are PERCENTAGES in the UI over a ratio in config — follow the
existing `flamesMinWidthPct` precedent (`value: d.flames.lines.scaleMin * 100`, and
divide by 100 in the output block).

- [ ] **Step 2: Map them into the config**

In the `flames:` output block add a nested `lines:` object reading the twelve values,
converting the two percentages back to ratios.

- [ ] **Step 3: Hide the controls that do nothing**

Update the render predicates of the generic flame controls so they do not appear for
directions that ignore them:

- `flamesMinWidthPct`, `flamesMaxWidthPct`, `flamesMinHeightPct`, `flamesMaxHeightPct`,
  `flamesSpawnInterval`, `flamesSpawnJitter`, `flamesMaxActive`: hide when direction is
  `"vortexLines"` (the lines block supplies its own equivalents).
- `flamesBaseSpeed` and `flamesSpeedVariation`: hide when direction is `"vortexLines"`
  OR `"vortexBits"`. Neither reads them — both are purely angular. This is the same
  class of dead-slider bug the user reported, one variant over.
- `flamesSwirlRate`: hide for `"vortexLines"` (superseded by Speed min/max); keep for
  `"vortex"` and `"vortexBits"`.
- Leave `flamesEnabled`, `flamesDirection`, `flamesEdgeSharpness`, `flamesOpacityMin`,
  `flamesOpacityMax` visible for all directions — all are still read.

Write these predicates so the six linear directions see EXACTLY the controls they see
today. Verify that by reading each predicate back after editing.

- [ ] **Step 4: Gates**

Run: `pir test && pir typecheck && pir build`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/lab/src/controls/levaSchema.ts
git commit -m "feat(lab): Vortex Lines controls; hide knobs that variant ignores"
```

---

### Task 4: Wider right panel on ≥1800px screens

**Files:**

- Modify: `apps/lab/src/LabApp.tsx`
- Modify: `apps/lab/src/playground.css`

**The constraint that makes this non-trivial:** the shader sidebar width is an inline
style driven by `labSettings.shaderSidebarWidth` (`LabApp.tsx` ~2449 on the `<aside>`
and ~2460 on the inner scroll container — BOTH must move together), and it is PERSISTED
to localStorage. So raising the default in `defaultLabConfig.ts` alone will not reach an
existing user, whose stored value is already `272`. A pure CSS media query would also
lose to the inline style and would fight the drag-resize handle.

Also note the truncation's real cause: `playground.css:95-99` hardcodes the value column
at `155px` with `!important`, leaving the label column ~90px at a 272px panel.

- [ ] **Step 1: Add the wide-screen default**

In `apps/lab/src/LabApp.tsx`, near the existing `SIDEBAR_WIDTH_MIN`/`SIDEBAR_WIDTH_MAX`
constants (~line 99):

```tsx
const WIDE_SCREEN_MIN_PX = 1800;
const DEFAULT_SIDEBAR_WIDTH = 272;
const WIDE_SHADER_SIDEBAR_WIDTH = 372;
```

- [ ] **Step 2: Apply it once on boot when the user has not customised the width**

Add an effect that runs once on mount. If the viewport is at least
`WIDE_SCREEN_MIN_PX` AND the persisted `shaderSidebarWidth` is still exactly
`DEFAULT_SIDEBAR_WIDTH`, widen it to `WIDE_SHADER_SIDEBAR_WIDTH` through the same
setter the drag handle uses, so it persists normally:

```tsx
useEffect(() => {
  if (typeof window === "undefined") return;
  if (!window.matchMedia(`(min-width: ${WIDE_SCREEN_MIN_PX}px)`).matches) return;
  setLabSettings((prev) => {
    if (prev.shaderSidebarWidth !== DEFAULT_SIDEBAR_WIDTH) return prev;
    const next = { ...prev, shaderSidebarWidth: WIDE_SHADER_SIDEBAR_WIDTH };
    saveLabSettings(next);
    return next;
  });
}, []);
```

Read the surrounding code first and match how other effects in this component update
and persist `labSettings` — use the component's real setter and persistence idiom rather
than this snippet verbatim if they differ. The guard on the exact default value is what
keeps a user's deliberate resize from being overridden; do not widen unconditionally.

- [ ] **Step 3: Give the extra space to the labels**

The value column is pinned at `155px !important` in `playground.css:95-99`, so a wider
panel currently gives 100% of the gain to the label column — which is what we want.
Confirm by reading that rule that no change is needed there, and leave it alone if so.
If the labels still truncate at 372px, widen the label column by reducing the value
column to `140px` in that rule and note the change; do not exceed that.

- [ ] **Step 4: Verify the left sidebar is untouched**

`textureSidebarWidth` must keep its `272` default at every viewport size. Only the
shader (right) sidebar widens.

- [ ] **Step 5: Gates**

Run: `pir test && pir typecheck && pir build`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/lab/src/LabApp.tsx apps/lab/src/playground.css
git commit -m "feat(lab): wider shader panel on 1800px+ screens"
```

---

### Task 5: Live verification

**Files:** none.

- [ ] **Step 1: Reuse the running dev server**

`curl -s -o /dev/null -w "%{http_code}" http://localhost:5174` — if `200`, reuse. Never
start a second dev server.

- [ ] **Step 2: Open on the remote Chrome pool**

`agent-browser --session lcfg open http://localhost:5174`. On `[ab-open] BLOCKED`
(exit 3), STOP and ask the user before falling back to `--local`.

Leva registers newly-added keys only on a full page load — reload, do not rely on HMR.

- [ ] **Step 3: `window.__errs` must be empty.**

- [ ] **Step 4: Prove each new knob actually does something**

For `direction: "vortexLines"`, drive `window.__lab.setConfig({flames:{lines:{…}}})` and
confirm a VISIBLE difference for each of: tail length (3 vs 20), scale (0.03 vs 0.12),
speed (0.3 vs 6), max snakes (3 vs 40), life (400ms vs 4000ms). Capture a screenshot for
at least the tail-length and scale extremes. This is the whole point of the task — the
previous config was ignored, so verify empirically rather than trusting the wiring.

- [ ] **Step 5: Confirm the dead sliders are gone**

With `vortexLines` selected, the panel must NOT show Base speed, Speed variation, Swirl,
Width/Height min-max, Spawn interval/jitter, or Max active. With `up` selected, the panel
must show exactly what it showed before this plan.

- [ ] **Step 6: Check the panel width**

Confirm the browser viewport is ≥1800px wide (report the actual width). The right panel
should come up at 372px with untruncated labels ("Width min %" not "Width m..."). Confirm
dragging the resize handle still works and that the left sidebar is unchanged.

- [ ] **Step 7: No regressions**

Cycle all nine directions plus vortex inward; `window.__errs` stays empty.

- [ ] **Step 8: Restore and clean up**

Leave the lab on a sane config. Close the browser session. Screenshots go to the
scratchpad, never the repo.

- [ ] **Step 9: Report with evidence.** Do not offer to push.
