# Trail-Following Snakes — the body follows the head's path

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development.

**User feedback, verbatim:** _"still the same its shit as fuck. they dont smoothly bend,
they just bended at initial load, and just rotate?"_

They are exactly right, and the cause is architectural, not a tuning value.

**Current model (wrong).** `emitVortexSnake` bakes the whole shape at spawn: `bendRadius`
and `segArc` are fixed, and segment `i` sits at `pivot + polar(shapePhase + orbitAngle +
i*segArc, bendRadius)`. The relative offsets never change, so the body is a RIGID ARC
that only translates and rotates. Its bend is frozen at birth — precisely what the user
describes.

**New model.** A real snake's body follows where its head has been. Segment `i` is placed
at the position the HEAD occupied `i * lag` seconds ago. The bend is then a property of
the PATH, and it flexes continuously as the head travels. No baked arc.

For the trail to actually curve (rather than trace a near-straight orbit at large radius)
the head's path must meander: a slow sinusoidal drift in its orbit radius. Because each
segment samples a DIFFERENT point in time, those curves propagate down the body — which
is what makes a snake read as alive. Critically this is NOT the rejected "slinging": that
was a per-segment offset applied to a rigid body. Here the wobble lives in the path only,
and the body simply follows it.

**No history buffer needed.** The head's path is analytic, so a lagged sample is a closed
form:

```
A(t) = orbitAngle0 + orbitAngVel * t
R(t) = orbitRadius0 + drift * t + meanderAmp * sin(meanderFreq * t + meanderPhase)
head(t) = centre + polar(A(t), R(t))
segment i at time t  ->  head(t - i * lag)
```

## Global Constraints

- Package manager: `pi` / `pir`. Never npm/pnpm/yarn/npx.
- Gates: `pir test`, `pir typecheck`, `pir build`. Run the FULL suite and report real
  numbers (true suite ≈ 47 files / ~596 tests). A filtered run undercounts.
- No code comments unless a step's code block already contains one.
- Never set a git identity. Commit only; never push.
- Work on `main`. Stage files EXPLICITLY BY PATH — never `git add -A`.
- Do not add `prefers-reduced-motion` handling.
- The six linear directions and plain `vortex` must behave IDENTICALLY.
- `Flame` has no optional fields — set every field on every construction path.
- Test timelines start at `nowMs = 1` (`stepFlames` treats `lastStepMs <= 0` as a sentinel).
- Do NOT use a per-frame-mutating field as a cross-time identity key in tests — use `bornMs`.
- Do NOT write a test that seeds a pool to its cap then asserts new spawns — unsatisfiable.
- A commit added catch-up spawn logic to the snake branch of `stepFlames`; do not break it.
- Preserve the area-uniform annulus draw `sqrt(rMin² + u(rMax² − rMin²))` for the initial
  orbit radius — it prevents a clot at the canvas centre, a bug already fixed once here.

---

### Task 0: Fix the `vortexLines` blink (regression from the bits blink fix)

**Files:** `packages/stripes-engine/src/flames/flamesSim.ts`, its test file.

**User:** _"and also the blinks of vortex lines still exist"_.

**Cause — self-inflicted.** The earlier blink fix widened `vortexBitEnvelope`'s
full-brightness plateau from 40% to 74% of a snake's life by narrowing the ramps to
`t 0..0.12` and `t 0.86..1.0`. Those ramps are FRACTIONS OF LIFE, so shortening them in
proportional terms shortens them in absolute terms too. `vortexBits` has long lives
(1400–3200ms) and benefited. `vortexLines` has SHORT lives (900–2200ms), so its fade-out
went from ~35% of life (~315ms) to ~14% (~126ms) — fast enough to read as a pop. The fix
that helped one variant regressed the other.

**Fix.** Make the fade duration ABSOLUTE rather than proportional, so a short-lived snake
still fades gently and a long-lived one still gets a long plateau. Replace the
`t`-fraction envelope with one taking the elapsed and total time:

```ts
const SNAKE_FADE_MS = 260;

function snakeEnvelope(ageMs: number, lifeMs: number): number {
  if (lifeMs <= 0) return 0;
  const fade = Math.min(SNAKE_FADE_MS, lifeMs * 0.45);
  const inAmt = smoothstep01(ageMs / fade);
  const outAmt = smoothstep01((lifeMs - ageMs) / fade);
  return Math.max(0, Math.min(inAmt, outAmt));
}
```

The `Math.min(SNAKE_FADE_MS, lifeMs * 0.45)` cap keeps the in and out ramps from
overlapping when a life is shorter than two fades. Update both snake directions to call
it with `(nowMs - flame.bornMs, flame.lifeMs)`. Keep `vortexBitEnvelope` only if
something still needs the fraction form — otherwise delete it and say so.

- [ ] **Failing tests:**

```ts
it("fades over a fixed duration regardless of lifetime", () => {
  const shortLife = snakeEnvelope(60, 900);
  const longLife = snakeEnvelope(60, 6000);
  expect(shortLife).toBeCloseTo(longLife, 3);
});

it("still reaches full brightness and returns to zero", () => {
  expect(snakeEnvelope(3000, 6000)).toBeCloseTo(1, 5);
  expect(snakeEnvelope(0, 6000)).toBeCloseTo(0, 5);
  expect(snakeEnvelope(6000, 6000)).toBeCloseTo(0, 5);
});

it("never pops for a very short-lived snake", () => {
  const life = 400;
  expect(snakeEnvelope(0, life)).toBeCloseTo(0, 5);
  expect(snakeEnvelope(life, life)).toBeCloseTo(0, 5);
  expect(snakeEnvelope(life * 0.5, life)).toBeGreaterThan(0.5);
});
```

Export `snakeEnvelope` for the tests. Confirm the first test FAILS against the current
fraction-based envelope (the two values differ substantially) and report the numbers.

Also verify the `vortexLines` population is not dipping — if its
`intervalMinMs 40 / intervalMaxMs 110` against life `900–2200` and `maxInstances 18` does
not pin the count, tighten the interval the way the bits fix did, and say what you found.

- [ ] Full gates, then commit:

```bash
git add packages/stripes-engine/src/flames
git commit -m "fix(engine): absolute-duration snake fades so short lives stop popping"
```

---

### Task 1: `vortexBits` body follows the head's trail

**Files:** `packages/stripes-engine/src/flames/flamesSim.ts`, its test file,
`packages/stripes-engine/src/config/types.ts`, `config/normalize.ts`,
`apps/lab/src/defaultLabConfig.ts`.

**Config.** Two new `FlamesSnakeConfig` knobs driving the head's meander:

```ts
meanderAmp: number; // 0..1, fraction of orbit radius
meanderFreq: number; // 0..4, rad/sec
```

Clamps: `meanderAmp` 0..1, `meanderFreq` 0..4. Defaults bits `meanderAmp 0.18,
meanderFreq 0.9`; lines `meanderAmp 0.12, meanderFreq 0.7`. `meanderAmp: 0` must give a
clean unmeandering path, so it is fully disableable.

**Flame fields.** Replace the baked-shape fields with trail parameters. Each segment of a
snake shares all of these (they describe the HEAD's path) and differs only by `segIndex`:

```ts
ageSec: number; // seconds since this snake was emitted, advanced each frame
lagSec: number; // time offset between consecutive segments
meanderPhase: number; // per-snake random 0..2π
```

`shapePhase` and `bendRadius`-derived `radius` are no longer the shape source. Keep
`radius` on the Flame (the renderer path and `applyVortexTransform` still use polar
placement) but DERIVE it per frame from the lagged sample rather than from a baked
constant. Remove any field that becomes dead and say which.

**Per-frame placement** for `vortexBits`, replacing the current rigid-arc case:

```ts
flame.ageSec += dtSec;
const ts = flame.ageSec - flame.segIndex * flame.lagSec;
const a = flame.orbitAngle + flame.orbitAngVel * ts;
const rBase = flame.orbitRadius + flame.radialSign * flame.speedPxPerSec * ts;
const meander = snakeCfg.meanderAmp * rBase * Math.sin(snakeCfg.meanderFreq * ts + flame.meanderPhase);
flame.pivotX = display.width * 0.5;
flame.pivotY = display.height * 0.5;
flame.radius = Math.max(1, rBase + meander);
flame.angle = a;
applyVortexTransform(flame);
```

`orbitAngle`/`orbitRadius` become the snake's values AT BIRTH (constants after emit) —
all time evolution goes through `ts`. That is what makes every segment a genuine sample
of one shared path.

**Segment spacing.** `lagSec` must place consecutive segments one segment-length apart
along the path, or the body will gap or bunch. Path speed at radius `r` is
`|orbitAngVel| * r`, so:

```ts
const pathSpeed = Math.max(1, Math.abs(orbitAngVel) * orbitRadius);
const lagSec = segLen / pathSpeed;
```

with `segLen` as today (`scale`-derived, constant per snake) and `headWidth = segLen *
SNAKE_SEG_OVERLAP` so consecutive segments still overlap. Keep segment length CONSTANT
and keep tapering thickness/opacity only — the no-gap fix must survive.

**Trailing direction.** Segment `i` samples the PAST (`ts` decreases with `i`), so the
tail automatically trails the head with no sign juggling. Existing tests asserting the
tail trails must still pass; if one encoded the old angle-offset representation, update
it to assert the trailing relationship in the new terms and say so.

**`vortexLines`** keeps its stationary local pivot and its existing rigid-arc placement —
do NOT convert it in this task. Its tests must stay green untouched.

- [ ] **Step 1: Failing tests** (vortexBits describe block):

```ts
it("bends differently as it travels rather than holding a frozen shape", () => {
  const state = createFlamesState(seededRandom());
  const config = bitsConfig({ tailMin: 14, tailMax: 14, lifeMinMs: 30000, lifeMaxMs: 30000 });
  stepFlames(state, config, DISPLAY, 1);
  const head = state.flames.find((f) => f.segIndex === 0);
  const shapeAt = () => {
    const mates = state.flames.filter((f) => f.bornMs === head.bornMs).sort((a, b) => a.segIndex - b.segIndex);
    const cx = mates.map((m) => m.x + m.width * 0.5);
    const cy = mates.map((m) => m.y + m.height * 0.5);
    const out: number[] = [];
    for (let i = 2; i < mates.length; i++) {
      const a1 = Math.atan2(cy[i - 1] - cy[i - 2], cx[i - 1] - cx[i - 2]);
      const a2 = Math.atan2(cy[i] - cy[i - 1], cx[i] - cx[i - 1]);
      out.push(Math.atan2(Math.sin(a2 - a1), Math.cos(a2 - a1)));
    }
    return out;
  };
  const before = shapeAt();
  stepFlames(state, config, DISPLAY, 2500);
  const after = shapeAt();
  const maxDelta = Math.max(...after.map((v, i) => Math.abs(v - before[i])));
  expect(maxDelta).toBeGreaterThan(0.02);
});

it("keeps consecutive segments overlapping along the trail", () => {
  const state = createFlamesState(seededRandom());
  const config = bitsConfig({ tailMin: 14, tailMax: 14 });
  stepFlames(state, config, DISPLAY, 1);
  stepFlames(state, config, DISPLAY, 200);
  const head = state.flames.find((f) => f.segIndex === 0);
  const mates = state.flames.filter((f) => f.bornMs === head.bornMs).sort((a, b) => a.segIndex - b.segIndex);
  for (let i = 1; i < mates.length; i++) {
    const d = Math.hypot(
      mates[i].x + mates[i].width * 0.5 - (mates[i - 1].x + mates[i - 1].width * 0.5),
      mates[i].y + mates[i].height * 0.5 - (mates[i - 1].y + mates[i - 1].height * 0.5),
    );
    expect(d).toBeLessThan(mates[i].width * 1.35);
  }
});

it("meanderAmp 0 gives a clean unmeandering path", () => {
  const state = createFlamesState(seededRandom());
  const config = bitsConfig({ tailMin: 10, tailMax: 10, meanderAmp: 0, speedMin: 0.5, speedMax: 0.5 });
  stepFlames(state, config, DISPLAY, 1);
  const head = state.flames.find((f) => f.segIndex === 0);
  const mates = state.flames.filter((f) => f.bornMs === head.bornMs);
  const radii = mates.map((m) => m.radius);
  expect(Math.max(...radii) - Math.min(...radii)).toBeLessThan(1);
});
```

The first test is the whole point: it measures the per-joint turn angles of the body and
asserts they CHANGE over time. Confirm it FAILS against the current rigid-arc build
(the shape is frozen, so every delta is ~0) and report the observed number.

- [ ] **Step 2:** Run, verify red.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run green, then FULL `pir test && pir typecheck && pir build`.
- [ ] **Step 5:** Commit

```bash
git add packages/stripes-engine/src apps/lab/src/defaultLabConfig.ts
git commit -m "feat(engine): vortexBits body follows the head's trail and flexes"
```

---

### Task 2: Lab controls

**Files:** `apps/lab/src/controls/levaSchema.ts`

Add `flamesBitsMeanderAmp` / `flamesBitsMeanderFreq` (labels "Meander amount" / "Meander
freq", ranges `0..1 step 0.01` and `0..4 step 0.05`), gated on `"vortexBits"`, and the
matching `flamesLines*` pair gated on `"vortexLines"`. Map all four into the nested
`bits:` / `lines:` output objects reading LIVE `values.*` — never a `d.`-sourced
mount-time constant, or the sliders will do nothing.

Task 1 may have added a pass-through for the new required fields to satisfy typecheck; if
so, REPLACE it rather than adding alongside. Grep the output path afterwards to confirm
no meander field reads from a frozen source.

Linear directions must see exactly the controls they see today.

- [ ] Gates, then commit:

```bash
git add apps/lab/src/controls/levaSchema.ts
git commit -m "feat(lab): meander controls for snake variants"
```

---

### Task 3: Live verification

- [ ] Reuse the dev server on 5174. `agent-browser --session trail open http://localhost:5174`; on BLOCKED stop and ask.
- [ ] `window.__errs` empty.
- [ ] Vortex Bits: confirm the body VISIBLY FLEXES as it travels — the bend must change shape over time, not merely rotate. Capture two screenshots several seconds apart and compare the body curvature, not just position.
- [ ] Confirm no gaps between segments and no per-segment wobble/slinging.
- [ ] Set Meander amount to 0 and confirm the path goes clean, then back up — proves the knob is live.
- [ ] Confirm `vortexLines` is unchanged.
- [ ] Cycle all directions; `window.__errs` stays empty.
- [ ] Restore the lab config to defaults, close the session, screenshots to scratchpad only.
- [ ] Report honestly, including if it still looks wrong. Do not offer to push.
