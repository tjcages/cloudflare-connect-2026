# Comet Logo — Upstream the CTA Path Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move every behaviour the Cloudflare marketing CTA depends on out of a pnpm patch against built `dist` and into `packages/stripes-engine/src/cometLogo/` source, then release and delete the patch.

**Architecture:** The patch is the only copy of this work and it targets bundled output. Port it into the four source modules it actually belongs to (`points.ts`, `config.ts`, `animation.ts`, `shaders.ts`, `renderer.ts`), porting **only** the direct-flight formation path. A self-contained Playwright test renders identical field times through the old patched bundle and the new build in one page and compares pixels; that test is written first and gates the whole port.

**Tech Stack:** TypeScript, WebGL2 (GLSL ES 3.00), Vite (library build), Vitest (unit), Playwright (pixel parity), pnpm workspaces.

## Global Constraints

- **Source of truth for every ported behaviour** is `/Users/necatikcl/Documents/code/cloudflare/marketing/.claude/worktrees/cta-comet-logo/patches/@necatikcl__stripes-engine@0.18.0.patch`, applied over `@necatikcl/stripes-engine@0.18.0`. The applied result is readable at `node_modules/@necatikcl/stripes-engine/dist/index.js` in that worktree.
- **Port only the direct-flight path.** Do not port `formationMode`, `formationParamA`, `formationParamB`, `formationSpawnRadius`, or any of the 14 non-zero formation modes (scanline, shatter, columns, growth, inspiral, outflow, ignition, collapse, nova, flare, lightning, plasma, phasechange, fusion, aurora). They were never in source; not porting them _is_ the cleanup.
- Where the patch has `if (uFormationSpawnRadius <= 0.0) { A } else { B }`, port **only branch A** — the CTA runs with that setting at 0. Same for `uFormationMaxTravel <= 0.0`.
- GLSL in the patch uses template placeholders (`${Z.length}`, `${Rs}`, `${zs}`). In source these become interpolations of the `points.ts` constants.
- Do not delete anything from the marketing repo until Task 7's parity test passes.
- Commit after every task. Never use `--no-verify`.
- Run commands with `pnpm` (this file is committed; local shell aliases do not belong in it).

---

### Task 1: Pixel-parity harness

The safety net. Written first so every later task has a gate.

**Files:**

- Create: `tests/fixtures/comet-baseline.js` (copied bundle, ~180 KB)
- Create: `tests/fixtures/comet-parity.html`
- Create: `tests/comet-parity.spec.ts`

**Interfaces:**

- Consumes: nothing.
- Produces: `tests/comet-parity.spec.ts` — the acceptance gate for Tasks 2–6. It compares the baseline bundle's `createCometLogoTextureRenderer` against the freshly built one at fixed field times.

- [ ] **Step 1: Copy the patched bundle in as a baseline fixture**

```bash
cp /Users/necatikcl/Documents/code/cloudflare/marketing/.claude/worktrees/cta-comet-logo/node_modules/@necatikcl/stripes-engine/dist/index.js \
   tests/fixtures/comet-baseline.js
```

- [ ] **Step 2: Create the comparison page**

`tests/fixtures/comet-parity.html` — renders both renderers at identical field times and exposes the pixel buffers. `CTA_PRESET` is the shipping preset; keep it in one place so the spec and the page cannot disagree.

```html
<!doctype html>
<meta charset="utf-8" />
<body>
  <script type="module">
    import { createCometLogoTextureRenderer as baseline } from "./comet-baseline.js";
    import { createCometLogoTextureRenderer as candidate } from "/packages/stripes-engine/dist/index.js";

    // MUST be a COMPLETE settings object, not a partial preset. Each build fills
    // omissions from its own COMET_LOGO_DEFAULTS; any default that differs between
    // the baseline bundle and the candidate would then diverge for reasons that have
    // nothing to do with this port, and read as a false parity failure. Every setting
    // both builds accept is listed explicitly below.
    const CTA_PRESET = {
      // explicitly pinned so neither build falls back to its own defaults
      fieldSpread: 2.18,
      logoMotion: 1,
      centerPreference: 0.78,
      sparkFrequency: 1,
      sparkSize: 1,
      sparkTrailLength: 1,
      waveProbability: 0.28,
      fireScale: 1,
      fireSpeed: 1,
      fireTurbulence: 1,
      flameHeight: 1,
      weatherSpeed: 1,
      weatherVariation: 1,
      curlingWisps: 1,
      eruptionScale: 1,
      eruptionParticles: 1,
      eruptionCycleSpeed: 1,
      // the CTA's own tuned values
      fieldSpeed: 0.9,
      fieldDepth: 1.6,
      fieldAlign: 1,
      formationDirectness: 0.8,
      formationMaxTravel: 0,
      fieldParticleSize: 0.55,
      fieldTrailLength: 0.12,
      centerClearRadius: 175,
      centerClearAspect: 2.4,
      centerClearSquareness: 2,
      centerClearLeak: 0.012,
      centerClearFalloff: 5,
      logoScale: 1.2,
      logoParticleSize: 0.85,
      logoTrailLength: 0.24,
      logoDensity: 2.25,
      formationEase: 0,
      formationWiggle: 1,
      formationDuration: 1.55,
      rejoinDuration: 1.08,
      formationInterrupt: 2,
      formationStagger: 0.3,
      burstProbability: 0.32,
      eruptionFrequency: 0.065,
      sparkBrightness: 0.46,
      eruptionIntensity: 0.4,
      fireIntensity: 0.4,
      hotRim: 0.38,
      surfaceEffects: 0.36,
      coronaMist: 0.46,
    };

    // Deterministic script: [fieldTimeSec, hovered]. Covers idle, the formation
    // ramp, the formed hold, the deform burst, and the refill.
    const SCRIPT = [];
    for (let t = 0; t <= 1.0; t += 0.1) SCRIPT.push([t, false]); // idle
    for (let t = 1.1; t <= 3.0; t += 0.1) SCRIPT.push([t, true]); // form + hold
    for (let t = 3.1; t <= 5.0; t += 0.1) SCRIPT.push([t, false]); // deform + refill

    function run(factory) {
      const r = factory(1680, 720);
      const gl = r.canvas.getContext("webgl2");
      const frames = [];
      for (const [t, hovered] of SCRIPT) {
        r.render(t, { x: r.width / 2, y: r.height / 2, hovered }, CTA_PRESET);
        const buf = new Uint8Array(r.width * r.height * 4);
        gl.readPixels(0, 0, r.width, r.height, gl.RGBA, gl.UNSIGNED_BYTE, buf);
        frames.push(buf);
      }
      r.dispose();
      return frames;
    }

    window.__parity = () => {
      const a = run(baseline);
      const b = run(candidate);
      return a.map((frame, i) => {
        let diff = 0;
        for (let p = 0; p < frame.length; p++) if (frame[p] !== b[i][p]) diff++;
        return { frame: i, time: SCRIPT[i][0], hovered: SCRIPT[i][1], diff };
      });
    };
  </script>
</body>
```

- [ ] **Step 3: Write the failing parity spec**

```typescript
import { expect, test } from "@playwright/test";

test("comet logo renders identically to the patched baseline", async ({ page }) => {
  await page.goto("/tests/fixtures/comet-parity.html");
  const results = await page.evaluate(() => (window as never as { __parity: () => unknown[] }).__parity());
  const mismatched = (results as { frame: number; time: number; hovered: boolean; diff: number }[]).filter(
    (r) => r.diff > 0,
  );
  expect(mismatched, `frames differing from baseline: ${JSON.stringify(mismatched)}`).toEqual([]);
});
```

- [ ] **Step 4: Build the engine and run the spec to watch it fail**

```bash
pnpm --filter @necatikcl/stripes-engine build
pnpm exec playwright test tests/comet-parity.spec.ts
```

Expected: FAIL. The candidate build has none of the ported behaviour, so nearly every frame differs. Record the failing frame count — it should drop to zero by Task 6.

- [ ] **Step 5: Commit**

```bash
git add tests/fixtures/comet-baseline.js tests/fixtures/comet-parity.html tests/comet-parity.spec.ts
git commit -m "test(comet): add pixel-parity harness against the patched 0.18.0 bundle"
```

---

### Task 2: Point counts and the dedicated logo pool

**Files:**

- Modify: `packages/stripes-engine/src/cometLogo/points.ts:136-145`
- Test: `packages/stripes-engine/src/cometLogo/points.test.ts` (create)

**Interfaces:**

- Consumes: nothing.
- Produces: `COMET_LOGO_IDLE_BACKGROUND_POINT_COUNT = 160`, `COMET_LOGO_TRAIL_SEGMENT_COUNT = 8`, and `cometLogoPoolPointCount(logoDensity: number): number`. Task 6 calls the last one for the draw count; Task 5 interpolates the first two into GLSL.

Background: the CTA rearchitecture made the logo a **dedicated pool**. No base-index comet is ever borrowed by the logo, so the field never drains when the logo forms. Field mode therefore draws `POINT_COUNT + 160` comets, all background; logo mode adds 96 sparks plus `round(logoDensity × POINT_COUNT)` pool particles.

- [ ] **Step 1: Write the failing test**

```typescript
import { describe, expect, it } from "vitest";
import {
  COMET_LOGO_IDLE_BACKGROUND_POINT_COUNT,
  COMET_LOGO_POINT_COUNT,
  COMET_LOGO_TRAIL_SEGMENT_COUNT,
  cometLogoPoolPointCount,
} from "./points";

describe("comet logo point counts", () => {
  it("carries a 160-particle background field", () => {
    expect(COMET_LOGO_IDLE_BACKGROUND_POINT_COUNT).toBe(160);
  });

  it("uses eight trail segments", () => {
    expect(COMET_LOGO_TRAIL_SEGMENT_COUNT).toBe(8);
  });

  it("sizes the logo pool from a fractional density", () => {
    expect(cometLogoPoolPointCount(1)).toBe(COMET_LOGO_POINT_COUNT);
    expect(cometLogoPoolPointCount(2.25)).toBe(Math.round(2.25 * COMET_LOGO_POINT_COUNT));
  });

  it("never returns an empty pool", () => {
    expect(cometLogoPoolPointCount(0)).toBe(1);
  });
});
```

- [ ] **Step 2: Run it to confirm it fails**

```bash
pnpm --filter @necatikcl/stripes-engine test -- points
```

Expected: FAIL — `cometLogoPoolPointCount` is not exported, and the two constants hold 64 and 3.

- [ ] **Step 3: Implement**

In `points.ts`, change the two constants and append the helper:

```typescript
export const COMET_LOGO_IDLE_BACKGROUND_POINT_COUNT = 160;
export const COMET_LOGO_TRAIL_SEGMENT_COUNT = 8;

export function cometLogoPoolPointCount(logoDensity: number): number {
  return Math.max(1, Math.round(logoDensity * COMET_LOGO_POINT_COUNT));
}
```

- [ ] **Step 4: Run tests**

```bash
pnpm --filter @necatikcl/stripes-engine test -- points
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/stripes-engine/src/cometLogo/points.ts packages/stripes-engine/src/cometLogo/points.test.ts
git commit -m "feat(comet): widen the background field and size the logo pool by density"
```

---

### Task 3: New settings

**Files:**

- Modify: `packages/stripes-engine/src/cometLogo/config.ts`
- Test: `packages/stripes-engine/src/cometLogo/config.test.ts`

**Interfaces:**

- Consumes: nothing.
- Produces: twelve settings on `CometLogoSettings`, each with a default and a clamp range. Task 5 reads them as uniforms; Task 6 uploads them.

- [ ] **Step 1: Confirm the exact set to add**

```bash
diff <(grep -oE "^    [a-zA-Z]+" /Users/necatikcl/Documents/code/cloudflare/marketing/.claude/worktrees/cta-comet-logo/node_modules/@necatikcl/stripes-engine/dist/cometLogo/config.d.ts | tr -d ' ' | sort) \
     <(grep -oE "^  [a-zA-Z]+:" packages/stripes-engine/src/cometLogo/config.ts | tr -d ' :' | sort)
```

Everything only on the left is a candidate. Exclude the mode-only settings named in Global Constraints. The remainder must equal exactly these **eleven**:
`fieldAlign`, `formationDirectness`, `formationMaxTravel`, `centerClearAspect`, `centerClearSquareness`, `centerClearLeak`, `centerClearFalloff`, `logoDensity`, `formationEase`, `formationWiggle`, `formationInterrupt`.

A **twelfth**, `formationRejoinScale`, is added by this port and will _not_ appear in the diff — it does not exist in the patch. See Task 4 for why the rejoin window has to become a setting rather than a constant.

- [ ] **Step 2: Write the failing test**

```typescript
it("defaults and clamps the ported settings", () => {
  const d = normalizeCometLogoSettings({});
  expect(d.fieldAlign).toBe(0);
  expect(d.logoDensity).toBe(1);
  expect(d.formationWiggle).toBe(0);
  expect(d.formationInterrupt).toBe(0);

  expect(normalizeCometLogoSettings({ logoDensity: 99 }).logoDensity).toBe(5);
  expect(normalizeCometLogoSettings({ logoDensity: 2.25 }).logoDensity).toBe(2.25);
  expect(normalizeCometLogoSettings({ centerClearAspect: 0 }).centerClearAspect).toBe(0.2);
  expect(normalizeCometLogoSettings({ formationEase: 9 }).formationEase).toBe(4);
});
```

- [ ] **Step 3: Run it to confirm it fails**

```bash
pnpm --filter @necatikcl/stripes-engine test -- config
```

Expected: FAIL — the properties do not exist.

- [ ] **Step 4: Implement**

Add to the `CometLogoSettings` type, to `COMET_LOGO_DEFAULTS`, and to the returned object in `normalizeCometLogoSettings`. Defaults are chosen so an existing consumer that passes none of them renders exactly as it does today.

```typescript
// type
fieldAlign: number;
formationDirectness: number;
formationMaxTravel: number;
centerClearAspect: number;
centerClearSquareness: number;
centerClearLeak: number;
centerClearFalloff: number;
logoDensity: number;
formationEase: number;
formationWiggle: number;
formationInterrupt: number;
formationRejoinScale: number;

// defaults
fieldAlign: 0,
formationDirectness: 0,
formationMaxTravel: 0,
centerClearAspect: 1,
centerClearSquareness: 2,
centerClearLeak: 0,
centerClearFalloff: 1,
logoDensity: 1,
formationEase: 0,
formationWiggle: 0,
formationInterrupt: 0,
formationRejoinScale: 1.18,

// normalize
fieldAlign: clamp(input.fieldAlign, COMET_LOGO_DEFAULTS.fieldAlign, 0, 1),
formationDirectness: clamp(input.formationDirectness, COMET_LOGO_DEFAULTS.formationDirectness, 0, 1),
formationMaxTravel: clamp(input.formationMaxTravel, COMET_LOGO_DEFAULTS.formationMaxTravel, 0, 4),
centerClearAspect: clamp(input.centerClearAspect, COMET_LOGO_DEFAULTS.centerClearAspect, 0.2, 6),
centerClearSquareness: clamp(input.centerClearSquareness, COMET_LOGO_DEFAULTS.centerClearSquareness, 1, 8),
centerClearLeak: clamp(input.centerClearLeak, COMET_LOGO_DEFAULTS.centerClearLeak, 0, 1),
centerClearFalloff: clamp(input.centerClearFalloff, COMET_LOGO_DEFAULTS.centerClearFalloff, 0.2, 8),
logoDensity: clamp(input.logoDensity, COMET_LOGO_DEFAULTS.logoDensity, 1, 5),
formationEase: clamp(input.formationEase, COMET_LOGO_DEFAULTS.formationEase, 0, 4),
formationWiggle: clamp(input.formationWiggle, COMET_LOGO_DEFAULTS.formationWiggle, 0, 3),
formationInterrupt: clamp(input.formationInterrupt, COMET_LOGO_DEFAULTS.formationInterrupt, 0, 2),
formationRejoinScale: clamp(input.formationRejoinScale, COMET_LOGO_DEFAULTS.formationRejoinScale, 0.2, 2),
```

Bump `COMET_LOGO_CONFIG_VERSION` to `3`.

- [ ] **Step 5: Run tests**

```bash
pnpm --filter @necatikcl/stripes-engine test -- config
```

Expected: PASS, including the pre-existing config tests.

- [ ] **Step 6: Commit**

```bash
git add packages/stripes-engine/src/cometLogo/config.ts packages/stripes-engine/src/cometLogo/config.test.ts
git commit -m "feat(comet): add the settings the CTA path needs"
```

---

### Task 4: Animation state machine

**Files:**

- Modify: `packages/stripes-engine/src/cometLogo/animation.ts`
- Test: `packages/stripes-engine/src/cometLogo/animation.test.ts`

**Interfaces:**

- Consumes: `formationRejoinScale` and `formationInterrupt` from Task 3.
- Produces: `advanceCometLogoAnimation(state, timeSec, hovered, formationDurationSec?, rejoinDurationSec?, rejoinScale?, interrupt?)` and `cometLogoRejoinWindowSec(rejoinDurationSec, rejoinScale)`.

Three changes, each fixing something the CTA relies on:

1. **The rejoin window formula differs.** Source is `d * 1.18 + 0.45`; the patch is `d * 0.85`. Every deform timing value was tuned against the patch's formula, so this must be expressible. **SUPERSEDED — read this, not the paragraph it replaces.** The original plan dropped the `+ 0.45` trail margin outright. Review showed that retimes the rejoin for _every_ default caller (1.748s → 1.298s at `d = 1.1`), including `apps/lab`, which violates this plan's own neutrality constraint. The user ruled: keep the margin and make it configurable. So **both** ends are settings — `formationRejoinScale` (default `1.18`) and `formationRejoinMargin` (default `0.45`) — giving `window = d * scale + margin`. Defaults reproduce today's behaviour exactly; the CTA sets `0.85` / `0` to get the patch's bare `d * 0.85`.
2. **`formationInterrupt`** controls whether a re-hover during a rejoin cuts over (`0`), rewinds (`1`), or is ignored so the deform completes (`2`, the CTA's setting).
3. **The formation origin must reset whenever a formation starts from zero**, not only when the previous mode was `"field"`. A second hover enters `"forming"` from `"rejoining"`; leaving the origin stale makes `historicalFormation` return the current formation for every past time, so the trail measures zero travel and vanishes. This is the "no trail on the second hover" bug.

- [ ] **Step 1: Write the failing tests**

```typescript
it("scales the rejoin window without a trail margin", () => {
  expect(cometLogoRejoinWindowSec(1.08, 0.85)).toBeCloseTo(0.918, 5);
});

it("lets the deform finish when interrupt is 2", () => {
  let s = createCometLogoAnimationState(0);
  s = advanceCometLogoAnimation(s, 0, true, 1.55, 1.08, 0.85, 2);
  for (let t = 0.1; t <= 2.0; t += 0.1) s = advanceCometLogoAnimation(s, t, true, 1.55, 1.08, 0.85, 2);
  expect(s.mode).toBe("logo");

  s = advanceCometLogoAnimation(s, 2.1, false, 1.55, 1.08, 0.85, 2);
  expect(s.mode).toBe("rejoining");
  // re-hover immediately: the rejoin must continue rather than cut back
  s = advanceCometLogoAnimation(s, 2.2, true, 1.55, 1.08, 0.85, 2);
  expect(s.mode).toBe("rejoining");
});

it("reports a formation that restarts from zero", () => {
  let s = createCometLogoAnimationState(0);
  s = advanceCometLogoAnimation(s, 0, true, 1.55, 1.08, 0.85, 2);
  for (let t = 0.1; t <= 2.0; t += 0.1) s = advanceCometLogoAnimation(s, t, true, 1.55, 1.08, 0.85, 2);
  s = advanceCometLogoAnimation(s, 2.1, false, 1.55, 1.08, 0.85, 2);
  for (let t = 2.2; t <= 3.4; t += 0.1) s = advanceCometLogoAnimation(s, t, true, 1.55, 1.08, 0.85, 2);
  expect(s.mode).toBe("forming");
  expect(s.formation).toBeLessThanOrEqual(0.001);
});
```

- [ ] **Step 2: Run to confirm failure**

```bash
pnpm --filter @necatikcl/stripes-engine test -- animation
```

Expected: FAIL — the extra parameters do not exist and the window formula still adds `0.45`.

- [ ] **Step 3: Implement**

Replace `cometLogoRejoinWindowSec` and extend the signature. Port the `"rejoining"` branch from the patch (`Ms` in `dist/index.js`), which reads:

```typescript
export function cometLogoRejoinWindowSec(rejoinDurationSec: number, rejoinScale = 1.18): number {
  return rejoinDurationSec * rejoinScale;
}
```

and in the `"rejoining"` branch, honour `interrupt`:

```typescript
} else if (mode === "rejoining") {
  const window = cometLogoRejoinWindowSec(Math.max(rejoinDurationSec, 0.001), rejoinScale);
  if (hovered && interrupt === 0) {
    mode = "forming";
    formation = 0;
    formationVelocity = 0;
    rejoinProgress = 0;
  } else if (hovered && interrupt === 1) {
    rejoinStartFieldTimeSec += 5 * deltaSec;
    const elapsed = timeSec - rejoinStartFieldTimeSec;
    if (elapsed <= 0) {
      mode = "forming";
      formation = Math.max(0, Math.min(1, rejoinStartFormation));
      formationVelocity = 0;
      rejoinProgress = 0;
      rejoinStartFieldTimeSec = timeSec;
    } else {
      rejoinProgress = Math.min(1, elapsed / window);
    }
  } else {
    rejoinProgress = Math.min(1, Math.max(0, timeSec - rejoinStartFieldTimeSec) / window);
    if (rejoinProgress > 1 - 0.000001) rejoinProgress = 1;
    if (rejoinProgress === 1) {
      formation = 0;
      formationVelocity = 0;
      rejoinProgress = 0;
      mode = hovered ? "forming" : "field";
    }
  }
}
```

- [ ] **Step 4: Run tests**

```bash
pnpm --filter @necatikcl/stripes-engine test -- animation
```

Expected: PASS, including the pre-existing animation tests.

- [ ] **Step 5: Commit**

```bash
git add packages/stripes-engine/src/cometLogo/animation.ts packages/stripes-engine/src/cometLogo/animation.test.ts
git commit -m "feat(comet): configurable rejoin window and interrupt policy"
```

---

### Task 5: Shader port

The largest task, and atomic — the shader will not behave correctly until every piece is in, so it has one gate rather than five. Work through the sub-steps in order; each names the function to lift from the patch.

**Files:**

- Modify: `packages/stripes-engine/src/cometLogo/shaders.ts`

**Interfaces:**

- Consumes: constants from Task 2, settings from Task 3.
- Produces: uniforms `uFieldAlign`, `uFormationDirectness`, `uFormationMaxTravel`, `uCenterClearAspect`, `uCenterClearSquareness`, `uCenterClearLeak`, `uCenterClearFalloff`, `uLogoDensity`, `uFormationEase`, `uFormationWiggle`. Task 6 uploads exactly these names.

- [ ] **Step 1: Declare the new uniforms**

Add one `uniform float u<Name>;` per setting from Task 3 (excluding `formationInterrupt` and `formationRejoinScale`, which are CPU-side only) to the vertex shader's uniform block.

- [ ] **Step 2: Port the centre-clear shape**

This work is being done on `main`, which is 2 commits behind `comet-center-clear-shape`.
That branch holds a partial source version of this step (+26 lines across `config.ts`,
`renderer.ts`, `shaders.ts`); it is **not** available here, so port the centre-clear
shape in full from the patch. `git show comet-center-clear-shape -- packages/stripes-engine/src/cometLogo/shaders.ts`
is a useful reference for how it was expressed in source, but is not a substitute for
the patch, which is the source of truth.

Lift `centerClearWorld` from the patch. It turns the circular clear region into a superellipse via `uCenterClearAspect` and `uCenterClearSquareness`, with `uCenterClearLeak` letting a hashed fraction of comets inside and `uCenterClearFalloff` shaping how far.

**Seed the leak hash from `hash11(id * 2.71)` and re-hash, not from a large multiplier.** With ids near 985,000 a float32 hash collapses to 0, which makes `step(0, leak)` return 1 for many particles and spawns them at the exact centre regardless of the settings.

- [ ] **Step 3: Port the field/pool split**

- `bool logoParticle = extraLogo;` — only the dedicated pool forms the logo.
- `bool pairedLogoCandidate = false;` — this mechanism swapped background comets' identities into logo roles; the compiler drops the dead block.
- `float sourceParticleOpacity = logoParticle || sparkParticle || index < POINT_COUNT ? 1.0 : 0.72;` — preserves the idle field's exact appearance across the split.
- Port `fieldAlign` and `formationDirectness` into `fieldPoint` / `trajectoryBow` as in the patch.

- [ ] **Step 4: Port the formation**

`formationOrder` — additive jitter and a power curve:

```glsl
  float evenOrder = mix(starterAdjustedOrder, hash11(id * 7.71), 0.4);
  evenOrder = pow(clamp(evenOrder, 0.0, 1.0), 1.7);
  return clamp(evenOrder + mix(-0.05, 0.05, hash11(id * 19.31)), 0.0, 1.0);
```

The original floored a whole band to exactly 0 and used _multiplicative_ jitter, which is a no-op on zero — so an eighth of the comets departed on one frame. The uniform blend removes the clump; the power curve keeps the start prompt.

`formationSettleWiggle` — new, place it directly above `trajectoryBow`:

```glsl
vec2 formationSettleWiggle(float id, float local, vec2 direction, float span) {
  if (uFormationWiggle <= 0.0) return vec2(0.0);
  vec2 normal = vec2(-direction.y, direction.x);
  float frequency = mix(2.1, 3.6, hash11(id * 53.71));
  float phase = hash11(id * 17.93) * TAU;
  float ring = sin(local * frequency * TAU + phase) * exp(-4.2 * local);
  float onset = smoothstep(0.0, 0.22, local);
  return normal * ring * onset * span * 0.05 * uFormationWiggle;
}
```

and add it to the direct-flight return alongside `trajectoryBow`.

`formationTravelEase` — port the `uFormationEase` selector. `formationLifeFade` returns `smoothstep(0.0, 0.32, local) * formationCrossFade(index, id, local)`, so pool comets fade in from nothing as they fly.

In the `lifeFade` chain, add `else if (logoParticle) { lifeFade = 0.0; }` before the field fallback. Without it an un-engaged pool comet renders at its _virtual_ field life — visible and stationary the instant the pool starts drawing.

- [ ] **Step 5: Port the deform**

```glsl
float rejoinPopEase(float t, float id) {
  float progress = clamp(t, 0.0, 1.0);
  float decay = mix(3.2, 9.5, hash11(id * 27.91));
  return (1.0 - exp(-decay * progress)) / (1.0 - exp(-decay));
}
```

A drag curve: initial velocity 3.2–9.5× average and hashed per comet, which is what reads as an explosion rather than a tween. Use it for the throw distance.

`rejoinStagger` delay factor is `0.14` (not `0.5`), so the launch is one burst.

```glsl
float rejoinCrossFade(int index, float id, float progress) {
  return 1.0 - smoothstep(0.0, 0.5, rejoinStagger(id, progress));
}
```

Opacity spans local 0→0.5 while movement spans 0→1 — the throw keeps travelling after the comet is invisible.

- [ ] **Step 6: Port the trails**

```glsl
  float logoTrailBlend = 0.0;
  if (logoParticle) {
    logoTrailBlend = uRejoining > 0.5 ? 1.0 : 1.0 - smoothstep(0.92, 1.0, uFormation);
  }
```

Key off **global** `uFormation`, never per-comet local progress: on a re-hover the formation resumes mid-way and every comet's local value is already near 1, which kills the trail.

Clamp the window so a trail can never reach into pre-departure history:

```glsl
  if (logoParticle) {
    trailTime = min(
      trailTime,
      uRejoining > 0.5
        ? max(uRejoinElapsed, 0.0)
        : max(uFieldTime - formationDepartTime(id), 0.0)
    );
  }
```

That history is a pool comet's _virtual_ field path; whether it recycled inside the window is unrelated to real motion, and it made trails appear inconsistently between hovers.

Replace the single-shot cap with a converging one:

```glsl
    float maxTrailWorld = logoParticle
      ? LOGO_MAX_TRAIL_WORLD
      : MAX_TRAIL_WORLD * uFieldTrailLength;
    if (!probeRecycled) {
      for (int pass = 0; pass < 5; pass++) {
        float drawnTrailWorld = distance(probeNow, probeThen);
        if (drawnTrailWorld <= maxTrailWorld) break;
        trailTime *= 0.85 * maxTrailWorld / drawnTrailWorld;
        probeThen = sampleParticlePath(
          index, id, sparkId, logoParticle, sparkParticle, trailTime, probeRadiusThen, probeFreeThen
        );
      }
    }
```

with `const float LOGO_MAX_TRAIL_WORLD = 0.2;`. One linear correction badly undershoots because a drag path covers most of its distance early — that produced canvas-spanning streaks. Decoupling the ceiling from `uLogoTrailLength` is what lets speed express itself, since length is `speed × window` and the cap only binds at the extreme.

- [ ] **Step 7: Fix the fragment taper**

The fragment shader hardcodes the segment count in a string that never sees the constant:

```glsl
float trailProgress = vTrailProgressStart + segmentProgress / float(3);
```

Interpolate `COMET_LOGO_TRAIL_SEGMENT_COUNT` instead. Left at `3` with eight segments, `trailProgress` overshoots to 1.21 and the width taper stops working, so every trail renders at full width — lasers rather than comet tails.

Then add the brightness taper, which never existed:

```glsl
  float cometTaper = trailProgress * trailProgress;
  float cometLight = (headCore + headHalo * 0.36) * vIsHead
    + trailCore * 0.68 * cometTaper
    + trailHalo * 0.12 * cometTaper;
```

Quadratic so the tail drops off hard behind the head. Previously only _width_ tapered, which is why long tails lingered.

- [ ] **Step 8: Typecheck and build**

```bash
pnpm --filter @necatikcl/stripes-engine typecheck
pnpm --filter @necatikcl/stripes-engine build
```

Expected: both clean. A GLSL error surfaces at runtime, not here — Task 6's parity run is the real check.

- [ ] **Step 9: Commit**

```bash
git add packages/stripes-engine/src/cometLogo/shaders.ts
git commit -m "feat(comet): port the CTA direct-flight path into the shader"
```

---

### Task 6: Renderer plumbing, and parity goes green

**Files:**

- Modify: `packages/stripes-engine/src/cometLogo/renderer.ts`

**Interfaces:**

- Consumes: everything from Tasks 2–5.
- Produces: a build that matches the baseline pixel-for-pixel.

- [ ] **Step 1: Add the uniform names**

Append to the `configUniforms` array in `renderer.ts:90-128`: `"FieldAlign"`, `"FormationDirectness"`, `"FormationMaxTravel"`, `"CenterClearAspect"`, `"CenterClearSquareness"`, `"CenterClearLeak"`, `"CenterClearFalloff"`, `"LogoDensity"`, `"FormationEase"`, `"FormationWiggle"`.

- [ ] **Step 2: Add the values**

Append the matching entries to `uniformValues` in `renderer.ts:184-220`, reading from `settings`. Follow the existing convention — note `CenterClearRadius` is multiplied by `COMET_LOGO_RENDER_SCALE`; the new centre-clear settings are unitless and are not.

- [ ] **Step 3: Pass the new animation arguments**

```typescript
animation = advanceCometLogoAnimation(
  animation,
  timeSec,
  pointer.hovered,
  settings.formationDuration,
  settings.rejoinDuration,
  settings.formationRejoinScale,
  settings.formationInterrupt,
);
```

- [ ] **Step 4: Reset the formation origin on any fresh formation**

```typescript
      if (animation.mode === "forming" && previousMode !== "forming" &&
          (previousMode === "field" || animation.formation <= 0.001)) {
```

- [ ] **Step 5: Size the draw call for the pool**

```typescript
const renderPointCount =
  animation.mode === "field"
    ? COMET_LOGO_IDLE_RENDER_POINT_COUNT
    : COMET_LOGO_ACTIVE_RENDER_POINT_COUNT + cometLogoPoolPointCount(settings.logoDensity);
gl.drawArraysInstanced(gl.TRIANGLES, 0, COMET_LOGO_TRAIL_SEGMENT_COUNT * 6, renderPointCount);
```

Import `cometLogoPoolPointCount` from `./points`.

- [ ] **Step 6: Build and run parity**

```bash
pnpm --filter @necatikcl/stripes-engine build
pnpm exec playwright test tests/comet-parity.spec.ts
```

Expected: PASS with zero differing frames. If frames differ, the reported `time` and `hovered` localise the phase: times ≤ 1.0 are the idle field, 1.1–3.0 the formation and hold, 3.1+ the deform and refill.

- [ ] **Step 7: Full verification**

```bash
pnpm run verify
```

Expected: unit tests, typecheck and the lab build all pass.

- [ ] **Step 8: Commit**

```bash
git add packages/stripes-engine/src/cometLogo/renderer.ts
git commit -m "feat(comet): plumb the CTA settings and pool draw count"
```

---

### Task 7: Release

**Files:**

- Modify: `packages/stripes-engine/package.json`

- [ ] **Step 1: Bump the version**

`0.18.0` → `0.20.0`. Minor, not patch: `COMET_LOGO_CONFIG_VERSION` changed and the rejoin window formula changed shape. `0.19.0` is taken by `comet-center-clear-shape`.

- [ ] **Step 2: Confirm the tree is clean and verified**

```bash
pnpm run verify
git status --short
```

- [ ] **Step 3: Commit and tag**

```bash
git add packages/stripes-engine/package.json
git commit -m "chore(engine): release v0.20.0"
git tag v0.20.0-engine
git push && git push --tags
```

Tag format is `vX.Y.Z-engine`, matching `v0.18.0-engine` — not a bare `vX.Y.Z`.
`0.19.0` is untagged but is claimed by the unmerged `comet-center-clear-shape`
branch, so `0.20.0` avoids a collision if that branch ever lands.

CI publishes. A local publish returns 403 — that is expected and is not a failure.

---

### Task 8: Drop the patch from marketing

Runs in `/Users/necatikcl/Documents/code/cloudflare/marketing/.claude/worktrees/cta-comet-logo`, **not** in this repository.

**Files:**

- Delete: `patches/@necatikcl__stripes-engine@0.18.0.patch`
- Modify: `pnpm-workspace.yaml`, `package.json`, `src/components/cta/texture-config.ts`

- [ ] **Step 1: Wait for the published version to be installable**

```bash
pnpm view @necatikcl/stripes-engine@0.20.0 version
```

Do not start this task until that resolves.

- [ ] **Step 2: Remove the patch**

Delete the patch file and the `patchedDependencies` entry from `pnpm-workspace.yaml`, then move the dependency to `^0.20.0`.

- [ ] **Step 3: Reinstall and add the rejoin scale**

```bash
pnpm install
```

Add **both** `formationRejoinScale: 0.85` **and** `formationRejoinMargin: 0` to
`CTA_COMET_LOGO_SETTINGS`.

This is the single most dangerous step in the plan, because the pixel-parity gate
**cannot** catch a mistake here — `apps/lab/comet-parity.html` pins both values, so
the harness is structurally blind to what the CTA config actually sets.

The patch has no scale or margin settings at all: its rejoin window is
unconditionally `rejoinDuration * 0.85`. The ported engine defaults to
`1.18` / `0.45` so that existing consumers are unaffected. Every CTA deform timing
was tuned against the patch's formula, so the CTA must opt out of both:

| set        | window at `rejoinDuration: 1.08` | vs tuned 0.918s |
| ---------- | -------------------------------- | --------------- |
| neither    | `1.08 × 1.18 + 0.45` = 1.724s    | +88%            |
| scale only | `1.08 × 0.85 + 0.45` = 1.368s    | +49%            |
| **both**   | `1.08 × 0.85 + 0` = **0.918s**   | correct         |

Verify the arithmetic against `cometLogoRejoinWindowSec` in the released engine
rather than trusting this table.

- [ ] **Step 4: Verify against the running CTA**

```bash
pnpm run typecheck && pnpm run build
```

Then load `/cta-shader`, and confirm by eye: idle field has no trails; hover forms promptly with trails; the formed logo is clean; leaving pops and clears; an immediate re-hover still shows trails.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "chore(cta): consume the published comet logo engine, drop the patch"
```

---

## Self-Review

**Spec coverage.** Every Part 1 item in the design maps to a task: behaviour inventory → Tasks 2–6; dropped surface → Global Constraints; CTA preset → Task 1 fixture and Task 8; acceptance test → Tasks 1 and 6; rollout → Tasks 7 and 8. Parts 2 and 3 of the spec are deliberately out of scope for this plan.

**Two things this plan adds that the spec did not name**, both discovered while reading source:

- `cometLogoRejoinWindowSec` differs between source (`d * 1.18 + 0.45`) and patch (`d * 0.85`). Handled by promoting **both** ends to settings — `formationRejoinScale` and `formationRejoinMargin` — so defaults stay neutral for existing consumers while the CTA sets `0.85` / `0`. Without this the deform is 49–88% too long and no shader change would reveal why; the parity harness pins both values, so it is structurally blind to the error.
- The parity test cannot be a golden snapshot: canvases do not paint headless and this repo's e2e goldens are known to fail on a clean tree. Task 1 uses a self-contained in-page comparison instead.

**Type consistency.** `cometLogoPoolPointCount` (Task 2) is used with that exact name in Task 6. `formationRejoinScale` and `formationInterrupt` (Task 3) match their use in Tasks 4 and 8. Uniform names in Task 5 Step 1 match the strings in Task 6 Step 1.
