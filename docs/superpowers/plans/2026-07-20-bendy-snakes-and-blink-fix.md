# Bendy Snakes + Blink Fix

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task.

**Two user reports, both about `vortexBits`:**

1. _"its so weird bits sometimes kind of blink"_
2. _"I dont want this long fucking snakes. Instead do more curvy stuff so it looks like real bendy snake"_

**Blink — diagnosed, not guessed.** A probe stepped the real sim at 60fps for 15s with
shipped defaults and recorded population and total opacity:

- Head count hovered at **15–20 against `maxInstances: 26`** — the cap NEVER binds. At
  `intervalMinMs 70 / intervalMaxMs 200` and `lifeMinMs 1400 / lifeMaxMs 3200`, steady
  state is `life/interval ≈ 2300/135 ≈ 17`. The population is spawn-limited.
- **Up to 2 snakes appear/disappear in a single frame**, and total opacity swung
  **19.7 → 34.4 (a 74% range)**.
- `negRadius = 0` and max per-frame radius change was `0.74px`, so it is NOT a
  pivot-flip or teleport.

So the blink is aggregate-brightness oscillation: a small, spawn-limited population where
each snake spends only ~40% of its life at full opacity (fade-in 0→0.25, fade-out
0.65→1.0), with random spawn clustering. Fix by making the cap actually bind (population
pinned and stable) and by widening the full-brightness plateau.

**Bendy — root cause.** Each segment is a straight rectangle, so a snake is a polyline.
With `segArc = segLen / radius` and `segLen = scale * 0.5`, a snake at radius 300 with
`scale = 0.1 * 1600 = 160` gets `segLen = 80`, i.e. `segArc ≈ 0.27 rad ≈ 15°` per
segment — visible elbows, and 14 segments sweep 3.7 rad, which is very long. The user's
screenshot shows exactly that: long chains of straight sticks with sharp kinks.

Fix: many SHORT segments (small angular step ⇒ no visible kinks), a shorter default
total length, and a real serpentine undulation so the body actually bends rather than
tracing a clean arc.

## Global Constraints

- Package manager: `pi` / `pir`. Never npm/pnpm/yarn/npx.
- Gates: `pir test`, `pir typecheck`, `pir build`. Run the FULL suite — a filtered run
  undercounts (a previous agent reported 462/29 when the true suite is 47 files / 588).
- No code comments unless a step's code block already contains one.
- Never set a git identity. Commit only; never push.
- Work on `main`. Stage files EXPLICITLY BY PATH — never `git add -A`.
- Do not add `prefers-reduced-motion` handling.
- The six linear directions and `vortex` must behave IDENTICALLY.
- `vortexLines` keeps its LOCAL scattered pivots. It may share the new smoothing and
  undulation code, but its pivot model must not change.
- `Flame` has no optional fields — every field set on every construction path.
- Test timelines start at `nowMs = 1` (`stepFlames` treats `lastStepMs <= 0` as a
  "never stepped" sentinel).
- Do NOT write a test that seeds a pool to its cap then asserts new spawns — unsatisfiable.
- Screenshot-RMSE diffing does NOT discriminate config changes in this app (control
  measures higher than real changes). Never use it as evidence.

---

### Task 1: Bendy snakes — smooth curve + serpentine undulation

**Files:**

- Modify: `packages/stripes-engine/src/config/types.ts`, `config/normalize.ts`
- Modify: `packages/stripes-engine/src/flames/flamesSim.ts`
- Modify: `apps/lab/src/defaultLabConfig.ts`
- Test: `packages/stripes-engine/src/flames/flamesSim.test.ts`, `config/normalize.test.ts`

**Two new knobs** on `FlamesSnakeConfig` (so both snake variants get them):

```ts
waveAmp: number;
waveFreq: number;
```

Clamps: `waveAmp` 0..1, `waveFreq` 0..8. Defaults: bits `waveAmp 0.35, waveFreq 2.2`;
lines `waveAmp 0.25, waveFreq 1.8`. `waveAmp: 0` must produce exactly the current
non-undulating arc, so the feature is fully disableable.

**Smoothness.** Change `SNAKE_SEG_LEN_RATIO` from `0.5` to `0.14`. Segments become ~3.5x
shorter, so the angular step per segment drops correspondingly and the polyline reads as
a curve instead of a chain of sticks. Because segment count is the length knob, shorten
the defaults so total length drops rather than staying long with more pieces: bits
`tailMin 6, tailMax 12` (was 3/7 — more segments but each far shorter, so NET shorter);
lines `tailMin 8, tailMax 16` (was 4/10).

**Undulation.** A snake's spine offsets perpendicular to its path — for a circular path
that is the radial direction. Add two `Flame` fields:

```ts
baseRadius: number;
wavePhase: number;
```

Set `baseRadius` to the orbit radius at emit time (and `wavePhase` to a per-snake random
`0..2π`), on EVERY construction path — non-snake flames get `baseRadius: 0, wavePhase: 0`
in the shared `base` literal in `createFlame`.

In `stepFlames`, for both snake directions, recompute the radius each frame BEFORE
`applyVortexTransform`:

```ts
const wave =
  snakeCfg.waveAmp * flame.height * 6 * Math.sin(flame.wavePhase + flame.segIndex * snakeCfg.waveFreq + nowMs * 0.004);
flame.radius = flame.baseRadius + wave;
```

`snakeCfg` is `config.bits` for `"vortexBits"` and `config.lines` for `"vortexLines"`.
Scaling the amplitude off `flame.height` (the stroke thickness) keeps the wiggle
proportional to the snake's own size at any scale. The `nowMs` term animates it, so the
body slithers rather than holding a frozen S.

The radial DRIFT must keep working: drift must accumulate into `baseRadius`, not into
`radius` (which is now derived each frame). Update the drift line for `vortexBits` to
`flame.baseRadius += flame.radialSign * flame.speedPxPerSec * dtSec;` and make sure
nothing else writes `flame.radius` directly for snake directions.

Note `applyVortexTransform` computes the tangent from `atan2(radius*angVel, radialVel)`;
leaving that reading the wave-modulated `radius` is correct and makes segments tilt with
the undulation, which helps it read as a bend.

- [ ] **Step 1: Failing tests**

`normalize.test.ts`:

```ts
it("defaults and clamps the wave knobs", () => {
  const f = normalizeFlames({});
  expect(f.bits.waveAmp).toBeCloseTo(0.35);
  expect(f.bits.waveFreq).toBeCloseTo(2.2);
  expect(normalizeFlames({ bits: { waveAmp: 9 } } as never).bits.waveAmp).toBe(1);
  expect(normalizeFlames({ bits: { waveAmp: -3 } } as never).bits.waveAmp).toBe(0);
  expect(normalizeFlames({ bits: { waveFreq: 99 } } as never).bits.waveFreq).toBe(8);
});
```

`flamesSim.test.ts`, in the vortexBits describe block:

```ts
it("undulates: segments deviate from a constant orbit radius", () => {
  const state = createFlamesState(seededRandom());
  const config = bitsConfig({ tailMin: 12, tailMax: 12, waveAmp: 0.6, waveFreq: 2 });
  stepFlames(state, config, DISPLAY, 1);
  stepFlames(state, config, DISPLAY, 40);
  const head = state.flames.find((f) => f.segIndex === 0);
  const mates = state.flames.filter((f) => f.baseRadius === head.baseRadius).sort((a, b) => a.segIndex - b.segIndex);
  const radii = mates.map((m) => m.radius);
  const spread = Math.max(...radii) - Math.min(...radii);
  expect(spread).toBeGreaterThan(1);
});

it("waveAmp 0 gives a constant-radius arc", () => {
  const state = createFlamesState(seededRandom());
  const config = bitsConfig({ tailMin: 10, tailMax: 10, waveAmp: 0 });
  stepFlames(state, config, DISPLAY, 1);
  stepFlames(state, config, DISPLAY, 40);
  const head = state.flames.find((f) => f.segIndex === 0);
  const mates = state.flames.filter((f) => f.baseRadius === head.baseRadius);
  const radii = mates.map((m) => m.radius);
  expect(Math.max(...radii) - Math.min(...radii)).toBeLessThan(0.001);
});

it("the undulation animates over time", () => {
  const state = createFlamesState(seededRandom());
  const config = bitsConfig({ tailMin: 10, tailMax: 10, waveAmp: 0.6, lifeMinMs: 20000, lifeMaxMs: 20000 });
  stepFlames(state, config, DISPLAY, 1);
  stepFlames(state, config, DISPLAY, 40);
  const head = state.flames.find((f) => f.segIndex === 0);
  const key = head.baseRadius;
  const before = state.flames.filter((f) => f.baseRadius === key).map((f) => f.radius);
  stepFlames(state, config, DISPLAY, 240);
  const after = state.flames.filter((f) => f.baseRadius === key).map((f) => f.radius);
  expect(after.some((v, i) => Math.abs(v - before[i]) > 0.5)).toBe(true);
});

it("keeps the angular step per segment small enough to read as a curve", () => {
  const state = createFlamesState(seededRandom());
  const config = bitsConfig({ tailMin: 10, tailMax: 10, scaleMin: 0.06, scaleMax: 0.06 });
  stepFlames(state, config, DISPLAY, 1);
  const head = state.flames.find((f) => f.segIndex === 0);
  const mates = state.flames.filter((f) => f.baseRadius === head.baseRadius).sort((a, b) => a.segIndex - b.segIndex);
  for (let i = 1; i < mates.length; i++) {
    expect(Math.abs(mates[i].angle - mates[i - 1].angle)).toBeLessThan(0.12);
  }
});
```

The last test is the anti-kink guard: 0.12 rad ≈ 7° per joint. Confirm it FAILS at the
old `SNAKE_SEG_LEN_RATIO = 0.5` and say how you confirmed.

- [ ] **Step 2:** Run, verify red. `pir test -- "flamesSim|normalize"`
- [ ] **Step 3:** Implement the config knobs, the `SNAKE_SEG_LEN_RATIO` change, the shortened tail defaults, the two `Flame` fields, and the undulation + drift changes described above.
- [ ] **Step 4:** Run, verify green, then FULL `pir test && pir typecheck && pir build`.
- [ ] **Step 5:** Commit

```bash
git add packages/stripes-engine/src apps/lab/src/defaultLabConfig.ts
git commit -m "feat(engine): bendy serpentine snakes with smooth short segments"
```

---

### Task 2: Fix the blink

**Files:**

- Modify: `packages/stripes-engine/src/config/normalize.ts`
- Modify: `packages/stripes-engine/src/flames/flamesSim.ts`
- Modify: `apps/lab/src/defaultLabConfig.ts`
- Test: `packages/stripes-engine/src/flames/flamesSim.test.ts`

Two independent causes, fix both.

**(a) Make the cap bind.** Defaults `intervalMinMs 70 / intervalMaxMs 200` against life
`1400–3200` sustain only ~17 snakes for a cap of 26, so the population drifts and dips.
Change the bits defaults to `intervalMinMs 25, intervalMaxMs 70`, which sustains
`2300/47 ≈ 49 > 26`, pinning the population at the cap. Apply the same reasoning to
lines: set `intervalMinMs 40, intervalMaxMs 110` against its `900–2200` life and
`maxInstances 18` (sustains ~20 > 18). Mirror both in `defaultLabConfig.ts`.

**(b) Widen the full-brightness plateau.** `vortexBitEnvelope` currently ramps in over
`t 0..0.25` and out over `t 0.65..1.0`, so a snake is at full opacity only 40% of its
life — with a small population that makes aggregate brightness swing hard. Narrow the
ramps to `t 0..0.12` in and `t 0.86..1.0` out, giving a 74% plateau. Keep it a pure
function of `t` with the same smoothstep shape; do not change its signature (it is shared
with `vortexLines`).

- [ ] **Step 1: Failing tests**

```ts
it("holds full brightness across most of a snake's life", () => {
  expect(vortexBitEnvelope(0.5)).toBeCloseTo(1, 5);
  expect(vortexBitEnvelope(0.2)).toBeCloseTo(1, 5);
  expect(vortexBitEnvelope(0.8)).toBeCloseTo(1, 5);
  expect(vortexBitEnvelope(0)).toBeCloseTo(0, 5);
  expect(vortexBitEnvelope(1)).toBeCloseTo(0, 5);
});

it("sustains a full population so the count does not dip", () => {
  const state = createFlamesState(seededRandom());
  const config = normalizeFlames({ enabled: true, direction: "vortexBits" } as never);
  let t = 1;
  stepFlames(state, config, DISPLAY, t);
  let min = Infinity;
  for (let i = 0; i < 600; i++) {
    t += 16.67;
    stepFlames(state, config, DISPLAY, t);
    if (i > 120) min = Math.min(min, state.flames.filter((f) => f.segIndex === 0).length);
  }
  expect(min).toBeGreaterThanOrEqual(config.bits.maxInstances - 1);
});
```

`vortexBitEnvelope` is currently module-private — export it for the test, or assert the
plateau indirectly through opacity if you prefer not to widen the module's API. State
which you chose.

- [ ] **Step 2:** Run, verify red.
- [ ] **Step 3:** Implement (a) and (b).
- [ ] **Step 4:** Run, verify green, then FULL `pir test && pir typecheck && pir build`.
- [ ] **Step 5:** Commit

```bash
git add packages/stripes-engine/src apps/lab/src/defaultLabConfig.ts
git commit -m "fix(engine): stop vortexBits population dipping and brightness pulsing"
```

---

### Task 3: Lab controls for the wave knobs

**Files:** `apps/lab/src/controls/levaSchema.ts`

Add `flamesBitsWaveAmp` / `flamesBitsWaveFreq` and `flamesLinesWaveAmp` /
`flamesLinesWaveFreq`, labels "Wave amount" / "Wave freq", ranges `0..1 step 0.01` and
`0..8 step 0.05`, gated on the matching direction, and map all four into the nested
`bits:` / `lines:` output objects reading LIVE `values.*` (never `d.*` — a `d.`-sourced
field is frozen at mount and the slider would do nothing).

Linear directions must see exactly the controls they see today.

- [ ] Gates, then commit:

```bash
git add apps/lab/src/controls/levaSchema.ts
git commit -m "feat(lab): wave controls for snake variants"
```

---

### Task 4: Live verification

- [ ] Reuse the dev server on 5174 (probe first; never start a second).
- [ ] `agent-browser --session bendy open http://localhost:5174`; on BLOCKED stop and ask. Full reload (leva registers new keys only on load).
- [ ] `window.__errs` empty.
- [ ] Select Vortex Bits. Confirm snakes now read as CURVED and BENDY — no visible straight-stick elbows — and are noticeably SHORTER than before. Screenshot.
- [ ] Set `waveAmp` to 0 and confirm the undulation disappears (clean arc), then back up — proves the knob is live.
- [ ] Watch for ~20s and confirm no blink: no visible population dips or brightness pulsing.
- [ ] Confirm `vortexLines` still uses local pivots and also benefits from the smoothing.
- [ ] Cycle all directions; `window.__errs` stays empty.
- [ ] Restore the lab config to defaults, close the session, screenshots to scratchpad only.
- [ ] Report with evidence. Do not offer to push.
