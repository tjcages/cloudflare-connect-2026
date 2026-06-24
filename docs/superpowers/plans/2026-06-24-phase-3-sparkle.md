# Phase 3 — Sparkle (Gaps + Width Shuffle) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Port the legacy stripe "sparkle" animations to the new GPU engine — (1) **sparkle gaps**: a fraction of stripe cells blink to background on randomized per-cell pulses; (2) **width shuffle**: a fraction of stripe cells pulse their bar width ±swing — both as pure per-cell, time-driven hash math evaluated in the terminal stripe fragment shader.

**Architecture:** These are **stripe-pass-only** effects (they animate the stripes themselves, not the field — consistent with the field-first mandate: the field/reveal are untouched; stripes render last and now self-animate). The stripe fragment already addresses its display cell as `cell = floor(vUv * uGridCount)` — the exact `(col,row)` the old algorithm keyed on, so visual parity is direct. We add a continuous time uniform (`uTimeSec = clock.now()/1000`) plus per-cell hash functions to `stripe.frag`. Gaps gate `barWidthPx → 0` (renders background, a hard on/off blink); width shuffle modulates `barWidthPx` via a 0→1→0 envelope toward a per-pulse target. A pure-TS reference module mirrors the GLSL for deterministic unit tests (same pattern as `reveal/revealMath.ts`). The engine's rAF loop already renders every frame, so no animation-loop changes are needed; goldens stay deterministic because manual mode renders at a fixed clock.

**Decisions locked:**

- **Scope:** BOTH sparkle gaps AND width shuffle (full Phase 3 per the master roadmap).
- **Gap style:** FAITHFUL HARD BLINK — coverage snaps to 0 for the pulse, then snaps back (1:1 with legacy `sparkleCellVisible`). No soft fade.
- **Defaults:** both disabled (`enabled:false`) → goldens/field/stripes stay byte-unchanged until explicitly turned on.
- **Cell key:** the display cell `floor(vUv*uGridCount)` (== legacy `colIndex,rowIndex`), NOT the source-content cell.
- **Speed model:** UI exposes `coverage` (active %) + `speed`; the engine derives `periodMinSec = 0.21/speed`, `periodMaxSec = 0.55/speed` (matches legacy `*OptionsFromSliders`). Width shuffle adds `swingPx`.

**Tech Stack:** raw WebGL2 / GLSL ES 3.00, in-house gl helpers (no Pixi); TypeScript; Vitest unit tests; Playwright real-GPU goldens.

## Global Constraints

- pi/pir ONLY for installs/scripts (never npm/pnpm/yarn/npx); prefix verify/e2e with `npm_config_store_dir="$HOME/Library/pnpm/store/v10"` if a store mismatch appears. ([[use-pir-for-dev-commands]])
- WebGL2 / `#version 300 es` only; compile must throw on failure. ([[webgl1-shader-compat]])
- No code comments unless explicitly requested. Object styles, not string styles.
- Work directly on `main`; commit per task; never push or ask git disposition. ([[work-directly-on-main]], [[no-push-offers-show-results]])
- Visual goldens use `?hud=0`; darwin-keyed; update with `node_modules/.bin/playwright test <spec> --update-snapshots` (pir does NOT forward the flag). Tolerance `maxDiffPixelRatio: 0.01`. ([[gpu-engine-rewrite-progress]])
- Field / existing stripe / reveal (wave + assembly) goldens MUST stay byte-unchanged (defaults disabled guarantees this).
- Verify the visual on the user's live lab (http://localhost:5174); never spawn a competing dev server. ([[studio-verify-needs-foreground-tab]], dev-server-reuse rule)

## Reference: legacy → new mapping

| Legacy (Pixi)                                                         | New (engine)                                           | Notes                                               |
| --------------------------------------------------------------------- | ------------------------------------------------------ | --------------------------------------------------- |
| `packages/stripes-shader/src/playgroundSparkle.ts`                    | `packages/stripes-engine/src/stripeFx/sparkleMath.ts`  | gap scheduling + hashes (pure-TS reference)         |
| `packages/stripes-shader/src/playgroundWidthShuffle.ts`               | `packages/stripes-engine/src/stripeFx/sparkleMath.ts`  | width-shuffle scheduling + envelope + target        |
| sparkle/shuffle GLSL in `stripeFilterShaders.ts` (l.156–183, 509–512) | `packages/stripes-engine/src/shaders/stripe.frag.ts`   | hashes + gap gate + width modulation in the bar SDF |
| studio Leva sparkle controls                                          | `apps/lab/src/controls/levaSchema.ts` "Sparkle" folder | active% + speed (+ swing)                           |

## Constants (verbatim from legacy)

- Base period min = `0.21` s, base period max = `0.55` s (both `SPARKLE_GAPS_BASE_PERIOD_*` and `WIDTH_SHUFFLE_BASE_PERIOD_*`).
- Gaps default coverage `0.22`; width default coverage `0.30`; default speed `1`; width default swing `1.25` px; width min width `1` px.
- Hash offsets: `phaseHash = hash(col+53, row+71)`, `periodHash = hash(col+89, row+113)`, `cellSeed = hash(col+17, row+31)`, `altHash(pulseIndex) = hash(col+53+pulseIndex*61, row+71+pulseIndex*101)`.
- Base hash `hash(x,y)`: `p3 = fract(vec3(x,y,x) * vec3(0.1031, 0.1030, 0.0973)); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x+p3.y)*p3.z)`.

## Per-cell scheduling (shared by gaps + width)

```
period      = periodMinSec + periodHash(col,row) * (periodMaxSec - periodMinSec)
cyclePeriod = period / max(coverage, 0.001)
phaseOffset = phaseHash(col,row) * cyclePeriod
scheduled   = timeSec + phaseOffset
cycleIndex  = floor(scheduled / cyclePeriod)
localTime   = scheduled - cycleIndex * cyclePeriod        // 0..cyclePeriod
```

- **Gaps:** cell is GAPPED (hidden) when `localTime < period`, else visible. (Average gapped fraction = coverage.)
- **Width:** participant when `cellSeed(col,row) < coverage` (stable). If participant AND `localTime < period`: `localT = localTime/period`; `envelope = smoothstep(0.5 - 0.5*cos(2π·localT))`; `target = clamp(defaultWidth + (altHash(col,row,cycleIndex)*2-1)*swingPx, 1, maxWidth)`; `width = defaultWidth + (target-defaultWidth)*envelope`. Else `width = defaultWidth`.

## File Structure

**New:**

- `packages/stripes-engine/src/stripeFx/sparkleMath.ts` — pure-TS reference: hashes, gap visibility, width-shuffle width. Source of truth the GLSL mirrors.
- `packages/stripes-engine/src/stripeFx/sparkleMath.test.ts` — unit tests.
- `tests/sparkle.spec.ts` — Playwright goldens (gaps + width).

**Modified:**

- `packages/stripes-engine/src/config/types.ts` — add `sparkle` to `EngineConfig`.
- `packages/stripes-engine/src/config/normalize.ts` — `DEFAULT_SPARKLE` + `normalizeSparkle` + wire into `normalizeEngineConfig`.
- `packages/stripes-engine/src/config/normalize.test.ts` — clamp/default tests.
- `packages/stripes-engine/src/legacy/migrateLegacyConfig.ts` — map old sparkle fields (best-effort) or default.
- `packages/stripes-engine/src/shaders/stripe.frag.ts` — uniforms + hashes + gap gate + width modulation.
- `packages/stripes-engine/src/passes/stripePass.ts` — new uniform locations + setters; extend `StripeUniforms`.
- `packages/stripes-engine/src/engine.ts` — build sparkle uniform block from config + `clock.now()/1000`; pass to `stripePass.render`.
- `apps/lab/src/controls/levaSchema.ts` — "Sparkle" folder + config mapping.

---

### Task 1: Config — `sparkle` section (gaps + width)

**Files:**

- Modify: `packages/stripes-engine/src/config/types.ts`
- Modify: `packages/stripes-engine/src/config/normalize.ts`
- Modify: `packages/stripes-engine/src/config/normalize.test.ts`
- Modify: `packages/stripes-engine/src/legacy/migrateLegacyConfig.ts`

**Interfaces — Produces:**

```ts
interface SparkleConfig {
  gaps: { enabled: boolean; coverage: number; speed: number };
  width: { enabled: boolean; coverage: number; speed: number; swingPx: number };
}
// EngineConfig gains: sparkle: SparkleConfig
// DEFAULT_SPARKLE = { gaps: {enabled:false, coverage:0.22, speed:1}, width: {enabled:false, coverage:0.3, speed:1, swingPx:1.25} }
// normalizeSparkle(partial): clamp coverage 0..1, speed 0.05..100, swingPx 0..40; enabled => !!; defaults via DEFAULT_SPARKLE
```

- [ ] **Step 1:** Add `SparkleConfig` to `types.ts` and `sparkle: SparkleConfig` to `EngineConfig`.
- [ ] **Step 2:** Write failing tests in `normalize.test.ts`:

```ts
it("defaults sparkle when omitted", () => {
  const c = normalizeEngineConfig({});
  expect(c.sparkle.gaps).toEqual({ enabled: false, coverage: 0.22, speed: 1 });
  expect(c.sparkle.width).toEqual({ enabled: false, coverage: 0.3, speed: 1, swingPx: 1.25 });
});
it("clamps sparkle.gaps.coverage to 0..1 and speed to >=0.05", () => {
  expect(normalizeEngineConfig({ sparkle: { gaps: { coverage: 9 } } }).sparkle.gaps.coverage).toBe(1);
  expect(normalizeEngineConfig({ sparkle: { gaps: { speed: 0 } } }).sparkle.gaps.speed).toBe(0.05);
});
it("clamps sparkle.width.swingPx to 0..40", () => {
  expect(normalizeEngineConfig({ sparkle: { width: { swingPx: 999 } } }).sparkle.width.swingPx).toBe(40);
});
```

- [ ] **Step 3:** Run `pir verify` → tests FAIL (sparkle undefined).
- [ ] **Step 4:** Add `DEFAULT_SPARKLE`, `normalizeSparkle`, and wire `sparkle: normalizeSparkle(i.sparkle)` into `normalizeEngineConfig` + add to `DEFAULT_ENGINE_CONFIG`. Add `sparkle: { gaps: {...}, width: {...} }` to `migrateLegacyConfig` output (default values; legacy persisted fields like `sparkleGapsActivePercent`/`sparkleWidthActivePercent`/speeds may be mapped best-effort, else defaults).
- [ ] **Step 5:** Run `pir verify` → PASS.
- [ ] **Step 6:** Commit `feat(engine): sparkle config (gaps + width shuffle), default off`.

### Task 2: Pure-TS reference math `sparkleMath.ts`

**Files:**

- Create: `packages/stripes-engine/src/stripeFx/sparkleMath.ts`
- Create: `packages/stripes-engine/src/stripeFx/sparkleMath.test.ts`

**Interfaces — Produces:**

```ts
export function sparkleHash(px: number, py: number): number; // Dave-Hoskins hash11 (matches legacy hashFromCoords)
export function phaseHash(col: number, row: number): number; // hash(col+53,row+71)
export function periodHash(col: number, row: number): number; // hash(col+89,row+113)
export function cellSeed(col: number, row: number): number; // hash(col+17,row+31)
export function altHash(col: number, row: number, pulseIndex: number): number;
export const SPARKLE_BASE_PERIOD_MIN_SEC = 0.21;
export const SPARKLE_BASE_PERIOD_MAX_SEC = 0.55;
// timing helper returns { localTime, period, cycleIndex }
export function cellPulse(
  col,
  row,
  timeSec,
  coverage,
  periodMinSec,
  periodMaxSec,
): { localTime: number; period: number; cycleIndex: number };
export function isGapped(col, row, timeSec, coverage, periodMinSec, periodMaxSec): boolean; // localTime < period
export function shuffledWidth(
  col,
  row,
  defaultWidth,
  timeSec,
  coverage,
  periodMinSec,
  periodMaxSec,
  swingPx,
  maxWidth,
): number;
```

- [ ] **Step 1:** Write failing tests `sparkleMath.test.ts` asserting: `sparkleHash` returns the same value as legacy `hashFromCoords` for sample coords (copy 2-3 expected values by running the legacy fn mentally is unsafe — instead assert determinism + range 0..1 + that `phaseHash(0,0) !== periodHash(0,0)`); `isGapped` is a pure function of inputs and returns false when `coverage` is 0 at most times but true for some `(col,row,t)`; `shuffledWidth` equals `defaultWidth` for a non-participant cell and deviates within `±swingPx` for a participant mid-pulse; envelope is 0 at `localT=0` and `localT=1` and peaks near `localT=0.5`.
- [ ] **Step 2:** Run `pir verify` → FAIL.
- [ ] **Step 3:** Implement `sparkleMath.ts` porting `playgroundSparkle.ts` (gap path) and `playgroundWidthShuffle.ts` (envelope/target path) exactly. Keep the scheduling block identical to the spec above.
- [ ] **Step 4:** Run `pir verify` → PASS.
- [ ] **Step 5:** Commit `feat(engine): sparkleMath pure-TS reference (gap + width-shuffle schedule)`.

### Task 3: Stripe shader + pass + engine wiring

**Files:**

- Modify: `packages/stripes-engine/src/shaders/stripe.frag.ts`
- Modify: `packages/stripes-engine/src/passes/stripePass.ts`
- Modify: `packages/stripes-engine/src/engine.ts`

**Interfaces — Consumes:** `SparkleConfig` (Task 1). **Produces:** extended `StripeUniforms` with `timeSec` + sparkle fields.

- [ ] **Step 1:** Extend `STRIPE_FRAG`: add uniforms `uTimeSec`, `uGapEnabled`, `uGapCoverage`, `uGapPeriodMin`, `uGapPeriodMax`, `uShuffleEnabled`, `uShuffleCoverage`, `uShufflePeriodMin`, `uShufflePeriodMax`, `uShuffleSwingPx`. Add GLSL `hash`, `phaseHash`, `periodHash`, `cellSeed`, `altHash`, a `cellPulse`-equivalent, `isGapped(col,row)`, and `shuffledWidth(col,row,defaultWidth)` mirroring `sparkleMath.ts`. After computing `barWidthPx` from the LUT: if `uShuffleEnabled > 0.5` apply `barWidthPx = shuffledWidth(cell.x, cell.y, barWidthPx)`; then the existing `if (barWidthPx < 0.5) background`; then if `uGapEnabled > 0.5 && isGapped(cell.x, cell.y)` set `finalColor = vec4(uBg,1.0); return;` (hard blink). Clamp shuffled target to `[1.0, min(255.0, (uOrient<0.5?uCellPx.x:uCellPx.y))]`.
- [ ] **Step 2:** Extend `StripeUniforms` + add uniform locations + setters in `stripePass.ts` (`uniform1f` each; booleans as 0/1 floats).
- [ ] **Step 3:** In `engine.ts` stripe branch, before `stripePass.render`, build the values: `timeSec = clock.now()/1000`; `gapPeriodMin = 0.21 / max(0.05, sparkle.gaps.speed)`, `gapPeriodMax = 0.55 / max(0.05, sparkle.gaps.speed)` (same for width with `sparkle.width.speed`); pass `gaps.enabled`, `gaps.coverage`, width fields + `width.swingPx`. Thread these through the `StripeUniforms` object.
- [ ] **Step 4:** Run `pir verify` (typecheck + unit + studio build) → PASS. Then `pir test:e2e` → existing 9 goldens still PASS (defaults off ⇒ no change).
- [ ] **Step 5:** Commit `feat(engine): stripe sparkle gaps + width shuffle in the terminal pass`.

### Task 4: Lab UI — "Sparkle" folder

**Files:**

- Modify: `apps/lab/src/controls/levaSchema.ts`

- [ ] **Step 1:** Add a `Sparkle` folder (sibling of `Reveal`/`Stripes`) with controls: `sparkleGapsEnabled` (boolean), `sparkleGapsCoverage` (0..1 step .01, label "Gap active %"), `sparkleGapsSpeed` (0.05..3 step .05), `sparkleWidthEnabled` (boolean), `sparkleWidthCoverage` (0..1, "Width active %"), `sparkleWidthSpeed` (0.05..3), `sparkleWidthSwingPx` (0..40 step .25). Use conditional `render` so coverage/speed show only when their `enabled` is on (mirror the reveal conditional pattern).
- [ ] **Step 2:** Map controls into the engine config: `sparkle: { gaps: { enabled, coverage, speed }, width: { enabled, coverage, speed, swingPx } }`.
- [ ] **Step 3:** `pir verify` (lab typecheck included) → PASS. Manually toggle in the live lab at http://localhost:5174 and confirm gaps blink + width pulses; capture a temp screenshot to confirm; delete temps.
- [ ] **Step 4:** Commit `feat(lab): Sparkle controls (gaps + width shuffle)`.

### Task 5: Deterministic goldens

**Files:**

- Create: `tests/sparkle.spec.ts`

- [ ] **Step 1:** Add two tests at `/?manual=1&seed=1&dpr=2&w=400&h=300&hud=0`, `stripesEnabled:true`, fixed `renderAt` (e.g. 1000): one with `sparkle.gaps {enabled:true, coverage:0.5}` (so a clear set of cells is gapped), one with `sparkle.width {enabled:true, coverage:0.6, swingPx:6}` (visible width pulse). `toHaveScreenshot` `maxDiffPixelRatio: 0.01`.
- [ ] **Step 2:** Capture goldens: `node_modules/.bin/playwright test sparkle --update-snapshots`. Visually Read the generated PNGs to confirm the effect is real (gaps show background cells; width shows fatter/thinner bars).
- [ ] **Step 3:** Run full `pir test:e2e` → all green (now 11), field/stripes/reveal byte-unchanged, perf gate green.
- [ ] **Step 4:** Commit `test(engine): sparkle gaps + width-shuffle goldens`.

## Self-Review

- **Spec coverage:** gaps (Task 2/3/5), width shuffle (Task 2/3/5), config (Task 1), UI (Task 4), determinism/goldens (Task 5), defaults-off invariant (Task 1, verified Task 3/5). ✓
- **Type consistency:** `SparkleConfig.gaps/{enabled,coverage,speed}` and `.width/{enabled,coverage,speed,swingPx}` used identically across types/normalize/engine/lab. `StripeUniforms` gains `timeSec` + the gap/shuffle floats; setter names match `stripe.frag` uniform names. `sparkleMath.ts` exports consumed only by tests (GLSL is a hand-mirrored copy — Task 3 Step 1 must keep names/offsets identical). ✓
- **Placeholders:** none — algorithm, constants, hash offsets, defaults, and clamps are all concrete above. ✓
