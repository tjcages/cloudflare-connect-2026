# Rigid Bendy Snakes — no sling, no gaps, real bend

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development.

**User feedback, verbatim:** _"why tf they are slinging? They should solid move! i also
still see gaps between tail parts. They should be stick to each other, and bend better."_

Three defects, three causes:

1. **Slinging** — the serpentine undulation (`waveAmp`/`waveFreq`, added in `17f1462`)
   makes the body wobble. The user wants rigid motion. DELETE the feature outright,
   config knobs and lab controls included. A knob the user has rejected is worse than no
   knob.
2. **Gaps between tail parts** — the taper multiplies BOTH the segment's length
   (`width = headWidth * along`) and its thickness, while angular spacing stays a
   constant `segArc`. So spacing is fixed but segments shrink toward the tail, opening a
   gap that widens at every joint. A real snake tapers in THICKNESS, not in segment
   length.
3. **Doesn't bend** — a snake's curvature is currently its ORBIT radius
   (`segArc = segLen / radius`). A snake orbiting near the rim (radius ~800px) traces an
   almost-straight line. The bend must come from the snake's OWN curl radius, decoupled
   from where it orbits.

**The model after this plan.** A snake is a rigid curved shape with its own small curl
radius. For `vortexBits` that shape's PIVOT rides the global vortex (orbiting the canvas
centre, with the existing radial drift); for `vortexLines` the pivot stays put, exactly
as today. So `vortexBits` becomes "`vortexLines`' local curl, on a travelling pivot" —
which is precisely "solid move" along a vortex.

## Global Constraints

- Package manager: `pi` / `pir`. Never npm/pnpm/yarn/npx.
- Gates: `pir test`, `pir typecheck`, `pir build`. Run the FULL suite and report its real
  numbers — a filtered run undercounts (true suite ≈ 47 files / ~594 tests).
- No code comments unless a step's code block already contains one.
- Never set a git identity. Commit only; never push.
- Work on `main`. Stage files EXPLICITLY BY PATH — never `git add -A`.
- Do not add `prefers-reduced-motion` handling.
- The six linear directions and plain `vortex` must behave IDENTICALLY.
- `Flame` has no optional fields — set every field on every construction path.
- Test timelines start at `nowMs = 1` (`stepFlames` treats `lastStepMs <= 0` as a
  "never stepped" sentinel).
- Do NOT use a field that mutates every frame (`baseRadius`, `orbitAngle`, `pivotX/Y`)
  as a cross-time identity key in tests — use `bornMs`, set once at emit.
- Do NOT write a test that seeds a pool to its cap then asserts new spawns — unsatisfiable.
- Screenshot-RMSE diffing does NOT discriminate config changes in this app. Never use it.

---

### Task 1: Rip out the undulation

**Files:** `packages/stripes-engine/src/config/types.ts`, `config/normalize.ts`,
`flames/flamesSim.ts`, `apps/lab/src/defaultLabConfig.ts`,
`apps/lab/src/controls/levaSchema.ts`, plus the tests that cover it.

Remove `waveAmp` and `waveFreq` from `FlamesSnakeConfig`, from `DEFAULT_FLAMES_LINES`
and `DEFAULT_FLAMES_BITS`, from `normalizeFlamesSnake`, from the lab defaults, and remove
the four `flames{Bits,Lines}Wave{Amp,Freq}` leva controls and their output-block
mappings. Remove the `wavePhase` field from `Flame` and the wave term from `stepFlames`.

`baseRadius` STAYS — it is still the drift accumulator for `vortexBits`. After removing
the wave, the per-frame assignment simply becomes `flame.radius = flame.baseRadius`,
which the next task supersedes; keep the drift accumulating into `baseRadius`.

Delete the tests that assert undulation behaviour (`"undulates: …"`,
`"waveAmp 0 gives a constant-radius arc"`, `"the undulation animates over time"`, and the
normalize wave-knob test). Do NOT delete any other test.

- [ ] Full gates, then commit:

```bash
git add packages/stripes-engine/src apps/lab/src
git commit -m "revert(engine): drop snake undulation, motion is rigid again"
```

---

### Task 2: Segments must touch — taper thickness, not length

**Files:** `packages/stripes-engine/src/flames/flamesSim.ts`, its test file.

In `emitVortexSnake`'s segment loop, `along = 1 - i / segCount` currently scales width,
height AND opacity. Split them:

```ts
      width: headWidth,
      height: Math.max(1, thickness * (0.35 + 0.65 * along)),
      opacity: baseOpacity * (0.45 + 0.55 * along),
```

`width` (the along-path length) becomes CONSTANT so consecutive segments always overlap
by the `SNAKE_SEG_OVERLAP` factor and no gap can open. Thickness and opacity still taper
head→tail, but to a floor rather than to zero, so the tail stays a visible stroke instead
of vanishing into nothing.

- [ ] **Failing test** (add to the vortexBits describe block):

```ts
it("keeps every segment the same length so the body has no gaps", () => {
  const state = createFlamesState(seededRandom());
  const config = bitsConfig({ tailMin: 12, tailMax: 12 });
  stepFlames(state, config, DISPLAY, 1);
  const head = state.flames.find((f) => f.segIndex === 0);
  const mates = state.flames.filter((f) => f.bornMs === head.bornMs);
  const widths = mates.map((m) => m.width);
  expect(Math.max(...widths) - Math.min(...widths)).toBeLessThan(0.001);
});

it("still tapers thickness from head to tail", () => {
  const state = createFlamesState(seededRandom());
  const config = bitsConfig({ tailMin: 12, tailMax: 12 });
  stepFlames(state, config, DISPLAY, 1);
  const head = state.flames.find((f) => f.segIndex === 0);
  const mates = state.flames.filter((f) => f.bornMs === head.bornMs).sort((a, b) => a.segIndex - b.segIndex);
  expect(mates[mates.length - 1].height).toBeLessThan(mates[0].height);
  expect(mates[mates.length - 1].height).toBeGreaterThan(0);
});
```

Confirm the first test FAILS before the change (widths currently taper) and say so.

- [ ] Full gates, then commit:

```bash
git add packages/stripes-engine/src/flames
git commit -m "fix(engine): constant segment length so snake bodies have no gaps"
```

---

### Task 3: Own curl radius, riding the vortex

**Files:** `packages/stripes-engine/src/flames/flamesSim.ts`, its test file.

Today a `vortexBits` snake's segments sit on the SAME circle it orbits, so its curvature
equals its orbit curvature and rim snakes look straight. Decouple them.

Add three `Flame` fields (`0` for every non-snake flame in `createFlame`'s shared `base`):

```ts
orbitAngle: number;
orbitRadius: number;
orbitAngVel: number;
```

**Geometry.** Derive the snake's own curl from `scale`, and fix the angular step so the
curve is always smooth regardless of size:

```ts
const SNAKE_BEND_RATIO = 0.6;
const SNAKE_SEG_ARC = 0.08;
```

- `bendRadius = Math.max(2, scale * SNAKE_BEND_RATIO)` — the snake's own curl radius.
- `segLen = bendRadius * SNAKE_SEG_ARC` — arc length of one segment on that curl.
- `headWidth = Math.max(1, segLen * SNAKE_SEG_OVERLAP)` — constant, per Task 2.
- `radius = bendRadius` for BOTH variants; `segArc = SNAKE_SEG_ARC` (constant, so the
  joint angle is always ~4.6° and the body always reads as a curve).
- Total sweep is `segCount * 0.08` rad, so tail length still controls length: 12 segments
  ≈ 55°, 24 ≈ 110°.

**For `vortexBits`** the pivot travels: at emit, set `orbitRadius` from the SAME
area-uniform annulus draw used today (`sqrt(rMin² + u(rMax² − rMin²))` — do not replace
it, it is what prevents a clot at the centre), `orbitAngle` to a random `0..2π`, and
`orbitAngVel` to the snake's travel speed. Then each frame, BEFORE the existing local
placement:

```ts
flame.orbitAngle += flame.orbitAngVel * dtSec;
flame.orbitRadius += flame.radialSign * flame.speedPxPerSec * dtSec;
flame.pivotX = display.width * 0.5 + Math.cos(flame.orbitAngle) * flame.orbitRadius;
flame.pivotY = display.height * 0.5 + Math.sin(flame.orbitAngle) * flame.orbitRadius;
flame.angle += flame.angVel * dtSec;
applyVortexTransform(flame);
```

All segments of one snake share `orbitAngle`/`orbitRadius`/`orbitAngVel`, so the whole
shape translates rigidly along the vortex — "solid move". `baseRadius` is no longer the
drift accumulator (`orbitRadius` is); keep `baseRadius` set equal to `bendRadius` at emit
and stop mutating it, or remove it if nothing else reads it — state which you chose.

**For `vortexLines`** nothing travels: `orbitAngVel = 0`, pivot stays where it was drawn,
and its per-frame case keeps only `angle += angVel * dtSec` then the transform. Its local
scattered pivot model must not change.

- [ ] **Failing tests:**

```ts
it("curls at its own radius, not its orbit radius", () => {
  const state = createFlamesState(seededRandom());
  const config = bitsConfig({ tailMin: 10, tailMax: 10, scaleMin: 0.05, scaleMax: 0.05 });
  stepFlames(state, config, DISPLAY, 1);
  const heads = state.flames.filter((f) => f.segIndex === 0);
  const radii = heads.map((h) => h.radius);
  expect(Math.max(...radii) - Math.min(...radii)).toBeLessThan(0.001);
  const orbits = heads.map((h) => h.orbitRadius);
  expect(Math.max(...orbits) - Math.min(...orbits)).toBeGreaterThan(20);
});

it("moves the whole snake rigidly along the vortex", () => {
  const state = createFlamesState(seededRandom());
  const config = bitsConfig({ tailMin: 8, tailMax: 8, lifeMinMs: 20000, lifeMaxMs: 20000 });
  stepFlames(state, config, DISPLAY, 1);
  const head = state.flames.find((f) => f.segIndex === 0);
  const key = head.bornMs;
  const before = state.flames.filter((f) => f.bornMs === key).map((f) => f.orbitAngle);
  stepFlames(state, config, DISPLAY, 400);
  const after = state.flames.filter((f) => f.bornMs === key).map((f) => f.orbitAngle);
  expect(after[0]).not.toBeCloseTo(before[0], 4);
  after.forEach((a) => expect(a).toBeCloseTo(after[0], 6));
});

it("keeps the joint angle small at any scale", () => {
  const state = createFlamesState(seededRandom());
  for (const s of [0.02, 0.2]) {
    const st = createFlamesState(seededRandom());
    const config = bitsConfig({ tailMin: 10, tailMax: 10, scaleMin: s, scaleMax: s });
    stepFlames(st, config, DISPLAY, 1);
    const head = st.flames.find((f) => f.segIndex === 0);
    const mates = st.flames.filter((f) => f.bornMs === head.bornMs).sort((a, b) => a.segIndex - b.segIndex);
    for (let i = 1; i < mates.length; i++) {
      expect(Math.abs(mates[i].angle - mates[i - 1].angle)).toBeLessThan(0.1);
    }
  }
  expect(state.flames.length).toBe(0);
});
```

Drop the stray `state` assertion at the end if it does not fit the file's idiom — the
loop is the substance.

- [ ] Full gates, then commit:

```bash
git add packages/stripes-engine/src/flames
git commit -m "feat(engine): snakes curl at their own radius and ride the vortex rigidly"
```

---

### Task 4: Live verification

- [ ] Reuse the dev server on 5174 (probe first; never start a second).
- [ ] `agent-browser --session rigid open http://localhost:5174`; on BLOCKED stop and ask. Full reload.
- [ ] `window.__errs` empty.
- [ ] Vortex Bits: confirm NO slinging/wobble — each snake holds its shape while travelling. Confirm NO gaps between segments. Confirm a visible, smooth BEND (not a straight stick). Screenshot at a large scale so the shape is unambiguous, and say plainly if it still looks wrong.
- [ ] Confirm the Wave controls are GONE from the panel.
- [ ] Confirm Vortex Lines still curls in place on scattered pivots.
- [ ] Cycle all directions; `window.__errs` stays empty.
- [ ] Restore the lab config to defaults, close the session, screenshots to scratchpad only.
- [ ] Report with evidence. Do not offer to push.
