# Phase 2b — Unify the Config as `StripesShaderConfig` — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Make `StripesShaderConfig` (owned by `packages/stripes-shader/`) the single serializable config type, with a top-level `normalizeStripesShaderConfig(partial)` that fills defaults via the existing per-field normalizers. Rewire the studio's `PlaygroundPersistedConfig` to be that type, keeping the 3 deprecated fields handled only at the studio's wire-read/migration layer.

**Architecture:** The per-feature sub-config types + their `DEFAULT_*`/`normalize*`/`isDefault*` helpers already live in the package (moved in 2a). 2b adds the *aggregate*: `StripesShaderConfig` = today's `PlaygroundPersistedConfig` **minus** the 3 deprecated fields (`textureGamma`, `sparkleRate`, `sparkleEnabled`), plus `DEFAULT_STRIPES_SHADER_CONFIG` and `normalizeStripesShaderConfig`. The studio's persistence envelope, compact wire format, IndexedDB, and catalog stay studio-only and now wrap the core type; the deprecated-field migration (`textureGamma`→`textureAdjustments.gamma`, `sparkleRate`/`sparkleEnabled`→`sparkleGaps*`) lives only in the studio's parse path, reading a `LegacyConfigInput` superset so it still type-checks.

**Tech Stack:** TypeScript 6, pnpm workspace, Vitest 4.

## Global Constraints

- **Work on `main`, locally. NEVER push.** Commit locally per task.
- **`pi`/`pir` only** (script bodies may contain pnpm).
- **Do not start a dev server.**
- **Per-task gate: `pir verify` AND `pir code-check` both green.**
- **Behavior-preserving.** Persistence round-trips, default-omission, and deprecated-field migration must behave EXACTLY as today (the studio's existing `resolvePersisted*` functions + `applyPersistedConfig` + `parsePlaygroundStateInput` are the authoritative semantics — `normalizeStripesShaderConfig` must match them field-for-field).
- **`StripesShaderConfig` is the CLEAN type** — it must NOT contain `textureGamma`, `sparkleRate`, or `sparkleEnabled`. Those exist only transiently in the studio's parse input.
- **Out of scope:** the `getConfig`/scene refactor + `<StripesShader>` (2c), the export deletion + Copy-config (2d). Do not touch the scene ticker or the export tree here.

## Reference — current `PlaygroundPersistedConfig` (apps/studio/src/playground/playgroundPersistence.ts:74)

Fields (keep all EXCEPT the 3 `@deprecated`): `duotoneEnabled` (req), `stripesEnabled?`, `backgroundCss?`, `backgroundColor?`, ~~`textureGamma?` @deprecated~~, `textureAdjustments?`, `textureLuminanceMode?`, `textureLuminanceBackgroundColor?`, `sourceTransform?`, `sparkleGapsActivePercent?`, `sparkleGapsSpeed?`, ~~`sparkleRate?` @deprecated~~, ~~`sparkleEnabled?` @deprecated~~, `sparkleWidthActivePercent?`, `sparkleWidthSpeed?`, `displayWidth?`, `displayHeight?`, `grid?`, `flames?`, `reveal?`, `cursorTrail?`, `clickWave?`, `stripes` (req), `overlayStripes?`.

Sub-config helper modules in the package (exact export names): `playgroundTextureAdjustments` (`DEFAULT_PLAYGROUND_TEXTURE_ADJUSTMENTS`, `normalizePlaygroundTextureAdjustments`), `colorWhiteness` (`DEFAULT_TEXTURE_LUMINANCE_MODE`, `normalizeTextureLuminanceMode`, `DEFAULT_TEXTURE_LUMINANCE_BACKGROUND_COLOR`, `normalizeTextureLuminanceBackgroundColor`, `DEFAULT_TEXTURE_GAMMA`, `normalizeTextureGamma`), `playgroundSourceTransform` (`DEFAULT_PLAYGROUND_SOURCE_TRANSFORM`, `normalizePlaygroundSourceTransform`), `playgroundGridConfig` (`DEFAULT_PLAYGROUND_GRID_CONFIG`, `normalizePlaygroundGridConfig`), `playgroundFlamesConfig` (`DEFAULT_PLAYGROUND_FLAMES_CONFIG`, `normalizePlaygroundFlamesConfig`), `playgroundRevealConfig` (`DEFAULT_PLAYGROUND_REVEAL_CONFIG`, `normalizePlaygroundRevealConfig`), `playgroundCursorTrailConfig` (`DEFAULT_PLAYGROUND_CURSOR_TRAIL_CONFIG`, `normalizePlaygroundCursorTrailConfig`), `playgroundClickWaveConfig` (`DEFAULT_PLAYGROUND_CLICK_WAVE_CONFIG`, `normalizePlaygroundClickWaveConfig`), `stripeColors` (`cloneDefaultStripes`, `cloneDefaultOverlayStripes`, `normalizeStripe`, `Stripe`), `playgroundSparkle` (`DEFAULT_PLAYGROUND_SPARKLE_GAPS_ACTIVE_PERCENT`, `DEFAULT_PLAYGROUND_SPARKLE_GAPS_SPEED`, `normalizeSparkleGapsActivePercent`, `normalizeSparkleGapsSpeed`), `playgroundWidthShuffle` (`DEFAULT_PLAYGROUND_SPARKLE_WIDTH_ACTIVE_PERCENT`, `DEFAULT_PLAYGROUND_SPARKLE_WIDTH_SPEED`, `normalizeSparkleWidthActivePercent`, `normalizeSparkleWidthSpeed`), and `canvasBackgroundCss`'s `DEFAULT_PLAYGROUND_BACKGROUND_COLOR` (currently studio — its value default; confirm location).

---

### Task 1: Define `StripesShaderConfig` + defaults + normalizer in the package

**Files:**
- Create: `packages/stripes-shader/src/StripesShaderConfig.ts`, `packages/stripes-shader/src/StripesShaderConfig.test.ts`
- Modify: `packages/stripes-shader/src/index.ts` (export the new type/fns)

- [ ] **Step 1: Verify the exact export names you'll import**

Run (confirm every helper the type/normalizer needs is exported from the package, with these names):
```bash
cd /Users/necatikcl/Documents/code/cloudflare/section-grid-generator/packages/stripes-shader/src
rg -n "export (const|function|type) (DEFAULT_PLAYGROUND_TEXTURE_ADJUSTMENTS|normalizePlaygroundTextureAdjustments|DEFAULT_TEXTURE_LUMINANCE_MODE|normalizeTextureLuminanceMode|DEFAULT_TEXTURE_LUMINANCE_BACKGROUND_COLOR|normalizeTextureLuminanceBackgroundColor|DEFAULT_PLAYGROUND_SOURCE_TRANSFORM|normalizePlaygroundSourceTransform|DEFAULT_PLAYGROUND_GRID_CONFIG|normalizePlaygroundGridConfig|DEFAULT_PLAYGROUND_FLAMES_CONFIG|normalizePlaygroundFlamesConfig|DEFAULT_PLAYGROUND_REVEAL_CONFIG|normalizePlaygroundRevealConfig|DEFAULT_PLAYGROUND_CURSOR_TRAIL_CONFIG|normalizePlaygroundCursorTrailConfig|DEFAULT_PLAYGROUND_CLICK_WAVE_CONFIG|normalizePlaygroundClickWaveConfig|cloneDefaultStripes|cloneDefaultOverlayStripes|normalizeStripe|DEFAULT_PLAYGROUND_SPARKLE_GAPS_ACTIVE_PERCENT|normalizeSparkleGapsActivePercent|DEFAULT_PLAYGROUND_SPARKLE_GAPS_SPEED|normalizeSparkleGapsSpeed|DEFAULT_PLAYGROUND_SPARKLE_WIDTH_ACTIVE_PERCENT|normalizeSparkleWidthActivePercent|DEFAULT_PLAYGROUND_SPARKLE_WIDTH_SPEED|normalizeSparkleWidthSpeed)" *.ts
```
Adjust the imports in Step 3 to the actual exported names if any differ. Also locate `DEFAULT_PLAYGROUND_BACKGROUND_COLOR`: `rg -n "DEFAULT_PLAYGROUND_BACKGROUND_COLOR" ../../apps/studio/src packages 2>/dev/null` — note where it lives (likely still studio `canvasBackgroundCss.ts`); if the normalizer needs the background default and it's studio-only, default `backgroundColor` to `0xffffff` inline with a comment rather than importing studio code.

- [ ] **Step 2: Write the failing test** (`packages/stripes-shader/src/StripesShaderConfig.test.ts`)

```ts
import { describe, expect, it } from "vitest";
import { DEFAULT_STRIPES_SHADER_CONFIG, normalizeStripesShaderConfig } from "./StripesShaderConfig";

describe("StripesShaderConfig", () => {
  it("the clean type/default carries no deprecated fields", () => {
    const c = DEFAULT_STRIPES_SHADER_CONFIG as Record<string, unknown>;
    expect("textureGamma" in c).toBe(false);
    expect("sparkleRate" in c).toBe(false);
    expect("sparkleEnabled" in c).toBe(false);
    expect(c.duotoneEnabled).toBe(true);
    expect(Array.isArray(c.stripes)).toBe(true);
    expect((c.stripes as unknown[]).length).toBeGreaterThan(0);
  });

  it("normalizes an empty partial into a complete config with defaults", () => {
    const n = normalizeStripesShaderConfig({});
    expect(n.duotoneEnabled).toBe(true);
    expect(n.stripes.length).toBeGreaterThan(0);
    // sub-configs are filled by their own normalizers
    expect(n.grid).toBeDefined();
    expect(n.reveal).toBeDefined();
    expect(n.cursorTrail).toBeDefined();
    expect(n.clickWave).toBeDefined();
  });

  it("passes provided sub-config values through their normalizers (clamping)", () => {
    const n = normalizeStripesShaderConfig({ sparkleGapsActivePercent: 5 });
    expect(n.sparkleGapsActivePercent).toBeLessThanOrEqual(1); // clamp 0..1
  });
});
```

- [ ] **Step 3: Run it — expect FAIL** (`StripesShaderConfig` not found)

Run: `pir --filter @necatikcl/stripes-shader exec vitest run src/StripesShaderConfig.test.ts`
Expected: FAIL (module/exports missing).

- [ ] **Step 4: Write `packages/stripes-shader/src/StripesShaderConfig.ts`**

Define the clean aggregate type (sub-config types imported by relative path), `DEFAULT_STRIPES_SHADER_CONFIG`, and `normalizeStripesShaderConfig`. The type:

```ts
import { type PlaygroundTextureAdjustments, normalizePlaygroundTextureAdjustments, DEFAULT_PLAYGROUND_TEXTURE_ADJUSTMENTS } from "./playgroundTextureAdjustments";
import { type TextureLuminanceMode, normalizeTextureLuminanceMode, DEFAULT_TEXTURE_LUMINANCE_MODE, normalizeTextureLuminanceBackgroundColor, DEFAULT_TEXTURE_LUMINANCE_BACKGROUND_COLOR } from "./colorWhiteness";
import { type PlaygroundSourceTransform, normalizePlaygroundSourceTransform, DEFAULT_PLAYGROUND_SOURCE_TRANSFORM } from "./playgroundSourceTransform";
import { type PlaygroundGridConfig, normalizePlaygroundGridConfig, DEFAULT_PLAYGROUND_GRID_CONFIG } from "./playgroundGridConfig";
import { type PlaygroundFlamesConfig, normalizePlaygroundFlamesConfig, DEFAULT_PLAYGROUND_FLAMES_CONFIG } from "./playgroundFlamesConfig";
import { type PlaygroundRevealConfig, normalizePlaygroundRevealConfig, DEFAULT_PLAYGROUND_REVEAL_CONFIG } from "./playgroundRevealConfig";
import { type PlaygroundCursorTrailConfig, normalizePlaygroundCursorTrailConfig, DEFAULT_PLAYGROUND_CURSOR_TRAIL_CONFIG } from "./playgroundCursorTrailConfig";
import { type PlaygroundClickWaveConfig, normalizePlaygroundClickWaveConfig, DEFAULT_PLAYGROUND_CLICK_WAVE_CONFIG } from "./playgroundClickWaveConfig";
import { type Stripe, cloneDefaultStripes, cloneDefaultOverlayStripes, normalizeStripe } from "./stripeColors";
import { normalizeSparkleGapsActivePercent, DEFAULT_PLAYGROUND_SPARKLE_GAPS_ACTIVE_PERCENT, normalizeSparkleGapsSpeed, DEFAULT_PLAYGROUND_SPARKLE_GAPS_SPEED } from "./playgroundSparkle";
import { normalizeSparkleWidthActivePercent, DEFAULT_PLAYGROUND_SPARKLE_WIDTH_ACTIVE_PERCENT, normalizeSparkleWidthSpeed, DEFAULT_PLAYGROUND_SPARKLE_WIDTH_SPEED } from "./playgroundWidthShuffle";

export type StripesShaderConfig = {
  duotoneEnabled: boolean;
  stripesEnabled?: boolean;
  backgroundCss?: string;
  backgroundColor?: number;
  textureAdjustments?: PlaygroundTextureAdjustments; // includes gamma (the deprecated top-level textureGamma is gone)
  textureLuminanceMode?: TextureLuminanceMode;
  textureLuminanceBackgroundColor?: number;
  sourceTransform?: PlaygroundSourceTransform;
  sparkleGapsActivePercent?: number;
  sparkleGapsSpeed?: number;
  sparkleWidthActivePercent?: number;
  sparkleWidthSpeed?: number;
  displayWidth?: number;
  displayHeight?: number;
  grid?: PlaygroundGridConfig;
  flames?: PlaygroundFlamesConfig;
  reveal?: PlaygroundRevealConfig;
  cursorTrail?: PlaygroundCursorTrailConfig;
  clickWave?: PlaygroundClickWaveConfig;
  stripes: Stripe[];
  overlayStripes?: Stripe[];
};
```

`DEFAULT_STRIPES_SHADER_CONFIG` = an object with `duotoneEnabled: true`, `stripes: cloneDefaultStripes()`, and each sub-config set to its `DEFAULT_*` (and the sparkle scalars to their defaults). Keep optional presentation fields (`backgroundCss`, `displayWidth/Height`) omitted (undefined) to mirror default-omission.

`normalizeStripesShaderConfig(input: Partial<StripesShaderConfig>): StripesShaderConfig` — for each field, call the matching `normalize*` on the provided value (falling back to the default when absent), e.g. `grid: normalizePlaygroundGridConfig(input.grid)`, `reveal: normalizePlaygroundRevealConfig(input.reveal)`, `stripes: (input.stripes ?? cloneDefaultStripes()).map(normalizeStripe)`, `sparkleGapsActivePercent: normalizeSparkleGapsActivePercent(input.sparkleGapsActivePercent ?? DEFAULT_PLAYGROUND_SPARKLE_GAPS_ACTIVE_PERCENT)`, etc. **Cross-check each field against the studio's `resolvePersisted*` in `playgroundPersistence.ts`** so the normalizer's fill/clamp semantics match exactly (these resolvers are the authority). Leave `duotoneEnabled` defaulting to `true`, `stripesEnabled`/`backgroundCss`/`displayWidth`/`displayHeight` passed through as-is when present.

- [ ] **Step 5: Run the test — expect PASS**

Run: `pir --filter @necatikcl/stripes-shader exec vitest run src/StripesShaderConfig.test.ts`
Expected: PASS.

- [ ] **Step 6: Export from the barrel**

In `packages/stripes-shader/src/index.ts`, add an explicit (not `export *`) re-export so the new public type is curated:
```ts
export { type StripesShaderConfig, DEFAULT_STRIPES_SHADER_CONFIG, normalizeStripesShaderConfig } from "./StripesShaderConfig";
```

- [ ] **Step 7: Gate + commit**

Run: `pir verify && pir code-check`
Expected: both green.
```bash
git add -A
git commit -m "Phase 2b: add StripesShaderConfig (aggregate type + defaults + normalizer) to the core

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 2: Rewire the studio's `PlaygroundPersistedConfig` onto `StripesShaderConfig`

Make the studio's in-memory/stored config type be the core `StripesShaderConfig`, and keep the deprecated-field migration only at the parse-input boundary via a `LegacyConfigInput` superset.

**Files:**
- Modify: `apps/studio/src/playground/playgroundPersistence.ts` (the type + parse/migration path), `apps/studio/src/playground/TexturePlayground.tsx`, `apps/studio/src/lib/export/playgroundSnapshot.ts` (the 3 referrers)

- [ ] **Step 1: Replace the `PlaygroundPersistedConfig` definition with a core alias + legacy input**

In `playgroundPersistence.ts`, delete the local `export type PlaygroundPersistedConfig = {...}` block and replace with:
```ts
import type { StripesShaderConfig } from "@necatikcl/stripes-shader";

/** The studio's stored config is the core type. */
export type PlaygroundPersistedConfig = StripesShaderConfig;

/** Parse-time input that still tolerates the 3 deprecated fields for migration. */
export type LegacyPlaygroundConfigInput = StripesShaderConfig & {
  /** @deprecated → textureAdjustments.gamma */
  textureGamma?: number;
  /** @deprecated → sparkleGapsActivePercent/Speed */
  sparkleRate?: number;
  /** @deprecated → sparkleGapsActivePercent */
  sparkleEnabled?: boolean;
};
```

- [ ] **Step 2: Point the deprecated-field readers at `LegacyPlaygroundConfigInput`**

Anywhere a function reads `config.textureGamma`, `config.sparkleRate`, or `config.sparkleEnabled` (the migration shims: `resolvePersistedTextureGamma`, `resolvePersistedTextureAdjustments`, the sparkle `legacySparkleGaps*` migration, `parsePlaygroundStateInput`/`wireTo*`), change that parameter/local's type from `PlaygroundPersistedConfig` to `LegacyPlaygroundConfigInput` (or read from the raw parsed JSON object typed as `LegacyPlaygroundConfigInput`). The OUTPUT of parse/resolve remains a clean `PlaygroundPersistedConfig` (= `StripesShaderConfig`). Find them:
```bash
rg -n "textureGamma|sparkleRate|sparkleEnabled" apps/studio/src/playground/playgroundPersistence.ts
```
Adjust each reader's input type so it compiles without the deprecated fields living on the clean type.

- [ ] **Step 3: Fix the other two referrers**

`TexturePlayground.tsx` and `lib/export/playgroundSnapshot.ts` import/reference `PlaygroundPersistedConfig` — with the alias they keep working, but if either constructs a config object that sets `textureGamma`/`sparkleRate`/`sparkleEnabled`, move that to the appropriate clean field or drop it. Run `pir --filter studio exec tsc -b` and fix any resulting type errors minimally (they pinpoint exactly where a deprecated field was being set/read on the now-clean type).

- [ ] **Step 4: Gate — behavior preserved**

Run: `pir verify && pir code-check`
Expected: both green — the persistence tests (`playgroundPersistence.test.ts`) still pass, proving round-trip + default-omission + deprecated-field migration are unchanged. If a persistence test fails, the migration wiring regressed — fix so old wire blobs (with `tgm`/`textureGamma`/`sparkleRate`) still migrate into the clean fields.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "Phase 2b: make the studio's persisted config the core StripesShaderConfig (legacy fields migrate at parse)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 3: Fold in the trivial carry-forward Minors

Cheap fidelity/cleanup items deferred from 2a, done now while the config surface is fresh.

**Files:**
- Modify: `packages/stripes-shader/vitest.config.ts`, `apps/studio/src/styles/global.css`

- [ ] **Step 1: Restore `colorSpace.test` node-env fidelity**

In `packages/stripes-shader/vitest.config.ts`, add to the `test` config:
```ts
// @ts-expect-error Vitest-only option valid at runtime.
environmentMatchGlobs: [["src/colorSpace.test.ts", "node"]],
```
(It ran under `node` pre-2a; this restores that. Keep happy-dom as the default for the other tests.)

- [ ] **Step 2: Fix the stale font comment**

In `apps/studio/src/styles/global.css` (~line 74), the `@font-face` comment references `src/fonts/codeSnippet.ts` / `src/playground/stripeLetterFont.ts`, both relocated to the package. Update it to: `/* Berkeley Mono — the stripe-letter font. Family matches STRIPES font constants in @necatikcl/stripes-shader (codeSnippet.ts / stripeLetterFont.ts). */`. Do NOT change the `@font-face` rule body.

- [ ] **Step 3: Gate + commit**

Run: `pir verify && pir code-check`
Expected: both green; confirm `colorSpace.test` now runs in node (check the vitest output env label or that the count is unchanged + green).
```bash
git add -A
git commit -m "Phase 2b: restore colorSpace.test node env + fix stale font comment

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Phase 2b Done — Definition

- `packages/stripes-shader` exports `StripesShaderConfig` (no deprecated fields), `DEFAULT_STRIPES_SHADER_CONFIG`, `normalizeStripesShaderConfig`, with a focused test.
- The studio's `PlaygroundPersistedConfig` is `StripesShaderConfig`; deprecated-field migration lives only in the studio parse path via `LegacyPlaygroundConfigInput`.
- Persistence round-trip / default-omission / migration behavior is unchanged (existing tests green).
- `pir verify` + `pir code-check` green; committed locally; nothing pushed.

## Risks & Watch-Items

1. **Normalizer/resolver divergence** — `normalizeStripesShaderConfig` must match the studio's `resolvePersisted*` fill/clamp semantics field-for-field, else the package interprets a config differently than the studio authored it. Cross-check each field (Task 1 Step 4). This is the core correctness risk.
2. **Deprecated-field migration regressions** — old persisted/wire data carries `textureGamma`/`sparkleRate`/`sparkleEnabled`; the studio must still migrate them. `playgroundPersistence.test.ts` is the guard — if it fails, the `LegacyPlaygroundConfigInput` wiring is incomplete.
3. **`DEFAULT_PLAYGROUND_BACKGROUND_COLOR` location** — if the normalizer needs the background default and it's studio-only (`canvasBackgroundCss.ts`), inline `0xffffff` in the package rather than importing studio code (the package must not depend on the studio).
4. **`export *` vs explicit** — add the new type via an EXPLICIT re-export (Task 1 Step 6), starting the public-surface curation the 2a review flagged. Do not blanket-`export *` the new file.

## Self-Review (done while writing)

- **Spec coverage:** implements the spec's "unified config — kills the type drift". 2c/2d explicitly out of scope.
- **Authority-anchored:** the normalizer is defined against the existing studio resolvers as the semantic source of truth, with the persistence test suite as the regression guard — so "behavior-preserving" is verifiable.
- **No placeholders:** the type is given in full; the normalizer body is specified per-field with the existing helpers + the cross-check instruction (its exact arithmetic lives in the resolvers it must match, so reproducing it verbatim here would risk drift from the authority).
- **Folds the cheap 2a Minors** (env glob, font comment) without expanding into the larger `export *` curation (deferred to 2c/3 when the full public API is set).
