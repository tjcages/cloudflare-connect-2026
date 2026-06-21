# Texture pipeline rework — Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up the first GPU render-to-texture chain in the renderer — `source → [adjustments] → PROCESSED TEXTURE` — so "stripes off" shows the processed image, the CPU preview-bake is gone, and a debug stage-view can inspect intermediate textures; without changing how stripes or any effect are computed.

**Architecture:** Replace the single texture-swapping on-stage sprite with a **source sprite (offscreen, filtered by `sourceTextureFilter`) → `processedRT` (RenderTexture) → display sprite (on stage)** pipeline. The stripe filter stays on the display sprite and still reads the CPU block map, so stripe bars are byte-identical; only the overlay-mode underlay and the stripes-off image now come from the GPU processed texture instead of the CPU bake.

**Tech Stack:** TypeScript, PixiJS v8 (`Sprite`, `RenderTexture`, `renderer.render({ target })`, `Filter`), Vitest, Leva (studio controls).

**Spec:** `docs/superpowers/specs/2026-06-21-texture-pipeline-phase-1-design.md`

## Global Constraints

- Package manager: `pi` for installs, `pir` for scripts. Never npm/pnpm/npx. Tests from repo root: `pir test -- <substring>`. Typecheck: `pir typecheck`. Full gate: `pir verify` (tests + typecheck + studio client build).
- This is a behavior-preserving restructure for stripes-ON: the stripe bars must stay byte-identical (bands still come from the CPU `uBlockMap`). Only the overlay-mode underlay source and the stripes-OFF image change (both must match the old CPU bake).
- Phase 1 does NOT change band derivation, does NOT move any effect (reveal/flames/cursor/click/sparkle/width) out of the stripe shader, and does NOT touch colors mode, the letters layer, SVG export, or the assembly glow inputs. The CPU `computeBlockGrid`/`blockGridTexture` path stays.
- `debugStage` is a **studio-only** debug affordance carried on the internal `StripesSceneConfig`. Do NOT add it to the published config (`StripesShaderConfig` / `public.ts` stay untouched).
- `debugStage` values: exactly `"normal" | "source" | "processed"`, default `"normal"`.
- Rendering is not unit-testable; the pure display-plan helper (Task 1) is. Tasks 2–3 are verified by the automated gates plus a manual recording-diff checklist (the controller/user runs the visual gate — do not start a dev server).
- Comment density: match the surrounding file (render-core files are heavily, deliberately commented).

---

## File structure

New files:

- `packages/stripes-shader/src/playgroundDisplayPlan.ts` — pure `PlaygroundDebugStage` type, `normalizeDebugStage`, and `resolveDisplayPlan(debugStage, textureFilterMode)`.
- `packages/stripes-shader/src/playgroundDisplayPlan.test.ts` — unit tests for the resolver.

Modified files:

- `packages/stripes-shader/src/setupTextureShaderScene.ts` — the source/display sprite split, `processedRT` lifecycle, per-tick offscreen render, applying the display plan, removal of the CPU preview-bake machinery, `debugStage` on `StripesSceneConfig`.
- `apps/studio/src/playground/playgroundLevaSchema.ts` (+ `playgroundFieldHelp.ts`) — a `debugStage` selector.
- `apps/studio/src/playground/TexturePlayground.tsx` — thread `debugStage` through `getConfig` / the scene config builder.

---

## Task 1: Display-plan helper (pure, TDD)

**Files:**

- Create: `packages/stripes-shader/src/playgroundDisplayPlan.ts`
- Test: `packages/stripes-shader/src/playgroundDisplayPlan.test.ts`

**Interfaces:**

- Produces:
  - `type PlaygroundDebugStage = "normal" | "source" | "processed"`
  - `normalizeDebugStage(value: unknown): PlaygroundDebugStage`
  - `type DisplayPlan = { textureSource: "source" | "processed"; useStripeFilter: boolean; overlaysVisible: boolean }`
  - `resolveDisplayPlan(debugStage: PlaygroundDebugStage, textureFilterMode: "off" | "preview" | "stripes"): DisplayPlan`

- [ ] **Step 1: Write the failing tests**

Create `packages/stripes-shader/src/playgroundDisplayPlan.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { normalizeDebugStage, resolveDisplayPlan } from "./playgroundDisplayPlan";

describe("normalizeDebugStage", () => {
  it("passes through valid stages", () => {
    expect(normalizeDebugStage("normal")).toBe("normal");
    expect(normalizeDebugStage("source")).toBe("source");
    expect(normalizeDebugStage("processed")).toBe("processed");
  });
  it("falls back to normal for anything else", () => {
    expect(normalizeDebugStage(undefined)).toBe("normal");
    expect(normalizeDebugStage("stripes")).toBe("normal");
    expect(normalizeDebugStage(42)).toBe("normal");
  });
});

describe("resolveDisplayPlan", () => {
  it("normal + stripes → processed texture, stripe filter on, overlays visible", () => {
    expect(resolveDisplayPlan("normal", "stripes")).toEqual({
      textureSource: "processed",
      useStripeFilter: true,
      overlaysVisible: true,
    });
  });
  it("normal + preview (stripes off) → processed texture, no stripe filter, overlays visible", () => {
    expect(resolveDisplayPlan("normal", "preview")).toEqual({
      textureSource: "processed",
      useStripeFilter: false,
      overlaysVisible: true,
    });
  });
  it("normal + off → processed texture, no stripe filter, overlays visible", () => {
    expect(resolveDisplayPlan("normal", "off")).toEqual({
      textureSource: "processed",
      useStripeFilter: false,
      overlaysVisible: true,
    });
  });
  it("source stage → raw source, no stripe filter, overlays hidden (any mode)", () => {
    for (const mode of ["off", "preview", "stripes"] as const) {
      expect(resolveDisplayPlan("source", mode)).toEqual({
        textureSource: "source",
        useStripeFilter: false,
        overlaysVisible: false,
      });
    }
  });
  it("processed stage → processed texture, no stripe filter, overlays hidden (any mode)", () => {
    for (const mode of ["off", "preview", "stripes"] as const) {
      expect(resolveDisplayPlan("processed", mode)).toEqual({
        textureSource: "processed",
        useStripeFilter: false,
        overlaysVisible: false,
      });
    }
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pir test -- playgroundDisplayPlan`
Expected: FAIL (module does not exist).

- [ ] **Step 3: Implement the helper**

Create `packages/stripes-shader/src/playgroundDisplayPlan.ts`:

```ts
/** Which texture the on-stage display sprite shows, and how, for a given debug stage + filter mode. */
export type PlaygroundDebugStage = "normal" | "source" | "processed";

export type DisplayPlan = {
  /** Which texture the display sprite reads. */
  textureSource: "source" | "processed";
  /** Whether the stripe post-process filter is applied to the display sprite. */
  useStripeFilter: boolean;
  /** Whether the letter + glow overlays are shown (hidden in inspection stages). */
  overlaysVisible: boolean;
};

const DEBUG_STAGES = new Set<PlaygroundDebugStage>(["normal", "source", "processed"]);

export function normalizeDebugStage(value: unknown): PlaygroundDebugStage {
  return DEBUG_STAGES.has(value as PlaygroundDebugStage) ? (value as PlaygroundDebugStage) : "normal";
}

/**
 * Decide what the on-stage display sprite shows. `normal` reproduces the live behavior
 * (stripes when the mode says so, otherwise the processed image), always over the
 * processed texture. `source`/`processed` are unobstructed inspection views.
 */
export function resolveDisplayPlan(
  debugStage: PlaygroundDebugStage,
  textureFilterMode: "off" | "preview" | "stripes",
): DisplayPlan {
  if (debugStage === "source") {
    return { textureSource: "source", useStripeFilter: false, overlaysVisible: false };
  }
  if (debugStage === "processed") {
    return { textureSource: "processed", useStripeFilter: false, overlaysVisible: false };
  }
  return {
    textureSource: "processed",
    useStripeFilter: textureFilterMode === "stripes",
    overlaysVisible: true,
  };
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pir test -- playgroundDisplayPlan`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/stripes-shader/src/playgroundDisplayPlan.ts packages/stripes-shader/src/playgroundDisplayPlan.test.ts
git commit -m "feat(pipeline): add pure display-plan resolver for the texture pipeline"
```

---

## Task 2: Render restructure — source/display sprite split + processed render target

**Files:**

- Modify: `packages/stripes-shader/src/setupTextureShaderScene.ts`

**Interfaces:**

- Consumes: `resolveDisplayPlan` (Task 1); existing `createSourceTextureFilter`, `createStripeDuotoneFilter`, `syncStripeSpriteFilters`, `resolveTextureFilterMode`, `PLAYGROUND_PIXI_RESOLUTION`.
- Produces: a `createProcessedDisplay(...)` setup helper used by both scene constructors; `runDuotoneTick` renders the source into `processedRT` each tick and drives the display sprite via the plan.

This is an integration restructure verified by the automated gates + a manual recording diff. **Before editing, read the whole `runDuotoneTick` (≈ lines 381–1050), both scene constructors (`createImageSceneTicker` ≈ 1219–1316, `createVideoSceneTicker` ≈ 1340–1450), and the bake machinery (≈ 483–539, 600–609).** debugStage is hardcoded to `"normal"` in this task; Task 3 wires the real value.

- [ ] **Step 1: Add imports + the shared setup helper**

In `setupTextureShaderScene.ts`, add to the `pixi.js` import: `RenderTexture`. Add:

```ts
import { resolveDisplayPlan, type PlaygroundDebugStage } from "./playgroundDisplayPlan";
```

Add this helper near the other module-scope helpers (e.g. after `syncStripeSpriteFilters`). It builds the offscreen→RT→display trio for one scene:

```ts
type ProcessedDisplay = {
  /** Display-sized GPU render target holding the processed (adjusted) texture. */
  processedRT: RenderTexture;
  /** On-stage sprite that shows the processed texture (optionally stripe-filtered). */
  displaySprite: Sprite;
  /** Render the offscreen source sprite (with adjustments) into processedRT. Call once per tick. */
  renderProcessed: () => void;
  destroy: () => void;
};

/**
 * Build the texture pipeline display trio: the source sprite stays offscreen and is rendered
 * (through sourceTextureFilter) into processedRT each tick; the display sprite shows processedRT.
 * The display sprite is the one added to the stage (below letters + glow).
 */
function createProcessedDisplay(
  app: Parameters<Ticker>[0]["app"],
  sourceSprite: Sprite,
  display: PlaygroundDisplaySize,
): ProcessedDisplay {
  const processedRT = RenderTexture.create({
    width: display.width,
    height: display.height,
    resolution: PLAYGROUND_PIXI_RESOLUTION,
  });
  const displaySprite = new Sprite(processedRT);
  displaySprite.width = display.width;
  displaySprite.height = display.height;
  return {
    processedRT,
    displaySprite,
    renderProcessed: () => {
      app.renderer.render({ container: sourceSprite, target: processedRT, clear: true });
    },
    destroy: () => {
      displaySprite.destroy();
      processedRT.destroy(true);
    },
  };
}
```

- [ ] **Step 2: Rewire both scene constructors to the split**

In **`createImageSceneTicker`** (and identically in **`createVideoSceneTicker`**), the current tail creates `sprite`, applies `syncStripeSpriteFilters`, `app.stage.addChild(sprite)`, then `createPlaygroundLetterLayer`, then `runDuotoneTick({... sprite ...})`. Change it so the existing sprite becomes the offscreen **source** sprite and a **display** sprite goes on the stage instead:

Replace the block around `syncStripeSpriteFilters(sprite, ...)` + `app.stage.addChild(sprite)` (image ≈ 1282–1283, video ≈ 1426) with:

```ts
// Source sprite stays offscreen; sourceTextureFilter produces the processed texture.
sprite.filters = [sourceTextureFilter];
const processed = createProcessedDisplay(app, sprite, display);
app.stage.addChild(processed.displaySprite);
```

Remove the now-unused `syncStripeSpriteFilters(sprite, textureFilterMode, ...)` call here and the `app.stage.addChild(sprite)` line (the source sprite must NOT be on the stage). `createPlaygroundLetterLayer(...)` stays immediately after (so letters sit above the display sprite). Then pass the new objects into `runDuotoneTick`:

```ts
const { tick: renderTick, dispose } = runDuotoneTick({
  app,
  sourceSprite: sprite,
  processedDisplay: processed,
  stripeFilter,
  sourceTextureFilter,
  // …all the existing params unchanged…
});
```

(Keep every other existing param to `runDuotoneTick` as-is. The `sprite` param is renamed to `sourceSprite`; add `processedDisplay`.)

- [ ] **Step 3: Update `runDuotoneTick`'s signature**

In the `params` type and destructure of `runDuotoneTick`, replace `sprite: Sprite;` with:

```ts
sourceSprite: Sprite;
processedDisplay: ProcessedDisplay;
```

and in the destructure replace `sprite,` with `sourceSprite,` and add `processedDisplay,`. Within `runDuotoneTick`, introduce locals for convenience right after the destructure:

```ts
const { processedRT, displaySprite, renderProcessed } = processedDisplay;
```

`sourceSprite` is used only for layout (the `syncSpriteToDisplay` calls that previously targeted `sprite`) — repoint those to `sourceSprite`. The stripe filter is applied to `displaySprite` (see Step 5), so anywhere the old code did `sprite.filters` / `syncStripeSpriteFilters(sprite, …)` now targets `displaySprite`.

- [ ] **Step 4: Delete the CPU preview-bake machinery**

Remove all of the following from `runDuotoneTick` (they are replaced by the GPU processed texture):

- `originalSpriteTexture`, `previewCanvas`, `previewCtx`, `previewImageData`, `previewTexture` locals (≈ 483–503).
- `restoreOriginalSpriteTexture` (≈ 505–509) and `bakeAdjustedPreviewTexture` (≈ 511–539).
- The `renderAdjustedPreviewPixels` import if it becomes unused (check `samplePlaygroundFrame`/others still need it; if only the scene used it, drop the import here — the function may remain in its module for tests).
- In `dispose` (≈ 600–609): drop `restoreOriginalSpriteTexture();` and `previewTexture.destroy(true);`, and add `processedDisplay.destroy();`.

- [ ] **Step 5: Replace the mode-switch / bake branches with the display plan + offscreen render**

The mode-switch block (≈ 644–688) currently swaps `sprite.texture` (restore/bake) and calls `syncStripeSpriteFilters(sprite, …)`. Replace its texture-swapping with display-plan application. Concretely:

- Keep computing `textureFilterMode` and `luminanceMode` as today, and keep the colors-mode auto-detect frame sample (≈ 690–705) and the stripe-mode grid build — those are unchanged.
- Delete every `restoreOriginalSpriteTexture()` / `bakeAdjustedPreviewTexture()` call (≈ 647, 673, 675, 684, 686) and the `syncVisual()` call paired with the off-mode restore (≈ 687) — the display sprite always shows `processedRT`, so there is no texture to restore. (Keep `syncVisual` itself if it is still used for source-sprite layout elsewhere; otherwise remove its now-dead call sites.)
- Each tick, after `sourceTextureFilter` uniforms are synced (the existing `sourceTextureFilter.syncAdjustments/syncLuminanceSettings/syncTexelSize` calls ≈ 624–628 — keep them, and add `sourceTextureFilter.syncTexelSize(display.width, display.height)` if not already present), render the processed texture and apply the plan:

```ts
renderProcessed();

const plan = resolveDisplayPlan("normal", textureFilterMode);
displaySprite.texture = plan.textureSource === "source" ? sourceSprite.texture : processedRT;
if (plan.useStripeFilter) {
  syncStripeSpriteFilters(displaySprite, "stripes", luminanceMode, stripeFilter);
} else {
  displaySprite.filters = [];
}
letterLayer.setVisible(plan.overlaysVisible && textureFilterMode === "stripes");
```

Notes:

- `syncStripeSpriteFilters(displaySprite, "stripes", luminanceMode, stripeFilter)` sets `displaySprite.filters = [stripeFilter]` and `stripeFilter.syncTextureUnderlay(overlay)`. Because `displaySprite.texture === processedRT`, the stripe filter's `uTexture` underlay is the processed image — the overlay-mode underlay now comes from the GPU pass (the parity-critical change to verify).
- Keep the existing logic that, on entering stripes mode, sets `lastColorsKey = ""` / `hasBuiltGrid = false` so the grid rebuilds. The block-grid build, reveal block, cursor/letters passes downstream are all unchanged.
- The assembly glow overlay visibility is already gated by the reveal block; in Task 3 it also respects `plan.overlaysVisible`. For this task leave the glow logic as-is.

- [ ] **Step 6: Typecheck + run the suite**

Run: `pir typecheck`
Expected: PASS (no type errors; `sprite`→`sourceSprite`/`displaySprite` fully repointed).

Run: `pir test -- packages/stripes-shader`
Expected: PASS — existing tests unchanged and green (this is a behavior-preserving restructure for the tested code paths).

- [ ] **Step 7: Build the studio client**

Run: `pir verify`
Expected: PASS (tests + typecheck + studio client build).

- [ ] **Step 8: Commit**

```bash
git add packages/stripes-shader/src/setupTextureShaderScene.ts
git commit -m "feat(pipeline): render source through processed RenderTexture; drop CPU preview bake"
```

- [ ] **Step 9: Manual recording-diff verification (controller/user gate — do NOT start a dev server)**

In the user's running studio, capture and frame-diff against a pre-Phase-1 build:

1. static image, stripes ON, **luminance** mode → diff ~0 (bars unchanged).
2. static image, stripes ON, **overlay** mode → diff ~0 (processed underlay == old CPU bake).
3. **stripes OFF** → shows the processed image; matches the old baked preview within tone-map rounding.
4. a **video** clip, stripes ON → no new shimmer.

Flag this step to the human; it is the visual gate for the parity-critical underlay/processed-image change.

---

## Task 3: Debug stage-view — config field + studio control

**Files:**

- Modify: `packages/stripes-shader/src/setupTextureShaderScene.ts` (add `debugStage` to `StripesSceneConfig`, read it in the tick)
- Modify: `apps/studio/src/playground/playgroundLevaSchema.ts`, `apps/studio/src/playground/playgroundFieldHelp.ts`, `apps/studio/src/playground/TexturePlayground.tsx`

**Interfaces:**

- Consumes: `resolveDisplayPlan`, `normalizeDebugStage`, `PlaygroundDebugStage` (Task 1); the Task 2 display wiring.
- Produces: a live `debugStage` selector (Normal / Source / Processed) that drives the display plan, including hiding the letter + glow overlays in the inspection stages.

- [ ] **Step 1: Add `debugStage` to the scene config + an internal ref**

In `setupTextureShaderScene.ts`:

- Add to `StripesSceneConfig` (after `clickWaveConfig`): `debugStage: PlaygroundDebugStage;`
- In `createStripesShaderScene`, seed an internal ref from `initial.debugStage` (mirroring the other refs) and copy it in `syncInternalRefs`:

```ts
const debugStageRef: RefObject<PlaygroundDebugStage> = { current: normalizeDebugStage(initial.debugStage) };
// …in syncInternalRefs():
debugStageRef.current = normalizeDebugStage(config.debugStage);
```

- Pass `debugStageRef` through both ticker constructors into `runDuotoneTick`'s params (add `debugStageRef: RefObject<PlaygroundDebugStage>;`).
- Import `normalizeDebugStage` from `./playgroundDisplayPlan`.

- [ ] **Step 2: Use the real `debugStage` in the tick**

In `runDuotoneTick`, replace the hardcoded `resolveDisplayPlan("normal", textureFilterMode)` (Task 2, Step 5) with `resolveDisplayPlan(debugStageRef.current, textureFilterMode)`, and apply overlay visibility from the plan to BOTH the letters and the glow overlay:

```ts
const plan = resolveDisplayPlan(debugStageRef.current, textureFilterMode);
displaySprite.texture = plan.textureSource === "source" ? sourceSprite.texture : processedRT;
if (plan.useStripeFilter) {
  syncStripeSpriteFilters(displaySprite, "stripes", luminanceMode, stripeFilter);
} else {
  displaySprite.filters = [];
}
letterLayer.setVisible(plan.overlaysVisible && textureFilterMode === "stripes");
if (!plan.overlaysVisible) {
  assemblyGlowOverlay.setVisible(false);
}
```

(The reveal block later in the tick may set the glow visible; guard it so the inspection stages win — e.g. gate the existing `assemblyGlowOverlay.setVisible(true)` branch with `&& resolveDisplayPlan(debugStageRef.current, textureFilterMode).overlaysVisible`, or compute `plan` once above the reveal block and reuse it. Keep a single `plan` per tick.)

- [ ] **Step 3: Default `debugStage` in the studio scene-config builder**

In `apps/studio/src/playground/TexturePlayground.tsx`, find where the `StripesSceneConfig` is assembled for `getConfig` (the object with `stripeColors`, `revealConfig`, `clickWaveConfig`, …). Add `debugStage: <studio debug stage state>` (default `"normal"`). Wire it to a studio state value updated by the Leva control (Step 4). If the studio keeps a settings object, store `debugStage` there with default `"normal"`.

- [ ] **Step 4: Add the Leva selector**

In `apps/studio/src/playground/playgroundFieldHelp.ts` add:

```ts
  debugStage: "Debug view: Normal renders the app; Source shows the raw texture; Processed shows the adjusted texture (overlays hidden).",
```

In `apps/studio/src/playground/playgroundLevaSchema.ts`, add an option map near the others and a control in an appropriate folder (e.g. a "Debug" folder, or alongside the texture controls):

```ts
const DEBUG_STAGE_OPTIONS: Record<string, PlaygroundDebugStage> = {
  Normal: "normal",
  Source: "source",
  Processed: "processed",
};
```

```ts
        debugStage: selectControl<PlaygroundDebugStage>(snapshot.debugStage, DEBUG_STAGE_OPTIONS, {
          label: "Debug view",
          hint: PLAYGROUND_FIELD_HELP.debugStage,
          onChange: (value) => handlers.onDebugStageChange(value),
        }),
```

Add `onDebugStageChange: (value: PlaygroundDebugStage) => void;` to the handlers interface, `snapshot.debugStage` to the schema snapshot type (default `"normal"`), and implement `onDebugStageChange` in `TexturePlayground.tsx` to set the studio state that feeds `getConfig` (Step 3). Import `PlaygroundDebugStage` from `@necatikcl/stripes-shader` (export it from `public.ts` is NOT required — import the type from the package's internal path the studio already uses for scene types, mirroring how `StripesSceneConfig` types are imported). Match the exact `selectControl`/handler patterns already used by the reveal/flames controls.

- [ ] **Step 5: Typecheck + verify**

Run: `pir typecheck`
Expected: PASS (studio + package).

Run: `pir verify`
Expected: PASS.

- [ ] **Step 6: Manual verification (controller/user gate — do NOT start a dev server)**

In the running studio: the **Debug view** selector — `Source` shows the raw frame (overlays hidden); `Processed` shows the adjusted image (overlays hidden); `Normal` behaves as the app. Confirm switching back to `Normal` restores stripes + overlays.

- [ ] **Step 7: Commit**

```bash
git add packages/stripes-shader/src/setupTextureShaderScene.ts apps/studio/src/playground/playgroundLevaSchema.ts apps/studio/src/playground/playgroundFieldHelp.ts apps/studio/src/playground/TexturePlayground.tsx
git commit -m "feat(pipeline): add Normal/Source/Processed debug stage-view to the studio"
```

---

## Self-review (completed during planning)

- **Spec coverage:** Pass A / processed RT + offscreen render → Task 2 (helper + `runDuotoneTick`). "Stripes off shows processed texture" → Task 2 Step 5 (plan, `preview`/`off` → no stripe filter over processedRT). Overlay-underlay from processed texture → Task 2 Step 5 note. Remove CPU bake → Task 2 Step 4. Stage-view (Normal/Source/Processed) + studio control → Tasks 1 + 3. `debugStage` studio-only on `StripesSceneConfig` → Task 3 Step 1 + Global Constraints. CPU block grid / stripe shader / colors / letters / export / glow untouched → Global Constraints + nothing in the tasks edits them. Verification (recording diff + gates) → Task 2 Step 9, Task 3 Step 6, and the gate steps. ✓
- **Type consistency:** `resolveDisplayPlan`/`normalizeDebugStage`/`PlaygroundDebugStage`/`DisplayPlan` (Task 1) are consumed with matching signatures in Tasks 2–3. `ProcessedDisplay` (Task 2) fields (`processedRT`, `displaySprite`, `renderProcessed`, `destroy`) are used consistently. `sprite`→`sourceSprite` rename is applied in the signature, destructure, and call sites. ✓
- **Placeholders:** none — new units have complete code; integration edits cite exact anchors and the current code to replace, and explicitly require reading `runDuotoneTick`/the constructors first (integration work the line refs alone can't fully capture). The one judgement point (single `plan` per tick vs gating the reveal branch) is spelled out with both acceptable implementations.
