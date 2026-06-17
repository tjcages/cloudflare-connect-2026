# Phase 2c — Generalize the Scene + Build `<StripesShader>` — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Refactor the scene to a getter-based core — `createStripesShaderScene({ getConfig, getSource, getDisplaySize, … })` — and build the render-only `<StripesShader src config>` component on top of it, so the studio and the package share ONE render path. The studio must render **pixel-identically**.

**Architecture:** `createTextureSceneTicker` reads 23 positional refs, all pull-based (`.current` every frame). 2c factors the render logic into `createStripesShaderScene`, which reads one `getConfig(): StripesSceneConfig` per frame. **`createTextureSceneTicker` stays as a thin ADAPTER** that builds `getConfig` from its 23 refs and delegates — so the studio's call site is byte-for-byte unchanged and renders identically by construction (the fidelity guarantee + how we verify). The new `<StripesShader>` calls `createStripesShaderScene` directly, resolving its `StripesShaderConfig` prop into a `StripesSceneConfig`. Pointer handlers live inside the scene, so the component gets cursor-trail/click-wave for free.

**Tech Stack:** TypeScript 6, pixi.js 8, React 19, Vitest 4 (real-WebGL/happy-dom).

## Global Constraints

- **Work on `main`, locally. NEVER push.** Commit locally per task.
- **`pi`/`pir` only.** Do not start a dev server.
- **Per-task gate: `pir verify` AND `pir code-check` both green.**
- **Pixel-identical studio render.** `createTextureSceneTicker`'s signature, the studio's call site, and the per-frame render behavior must be UNCHANGED. The adapter is the mechanism; the existing scene + studio tests are the guard; a human visual check in the dev server is the final confirmation (note it in the report — the controller will request it).
- **No config-meaning change.** The `getConfig()` bundle must carry exactly the `.current` values the 23 refs carry today; the adapter reads the same refs.
- **Package stays dependency-clean** (pixi.js + react only). `<StripesShader>` is the package's first React component beyond the `<Pixi>` mount.
- **Out of scope:** deleting the export tree + portable twin + "Copy config" (2d); the lib build/publish (Phase 3). Do NOT touch `apps/studio/src/lib/export/**` here (the old `portable/AsciiVideo.tsx` twin stays until 2d — `<StripesShader>` is built NEW in the package, not by editing the twin).

## Current scene contract (packages/stripes-shader/src/setupTextureShaderScene.ts)

`createTextureSceneTicker(source, display, stripeColorsRef, preferP3Ref, duotoneEnabledRef, stripesEnabledRef, textureGammaRef, sparkleOptionsRef, widthShuffleOptionsRef, autoplayRef, exportStateRef?, gridConfigRef, textureAdjustmentsRef, textureLuminanceSettingsRef, sourceTransformRef, flamesStateRef, flamesConfigRef, revealConfigRef, revealStateRef, revealPlaybackRef, cursorTrailConfigRef, clickWaveConfigRef, onTextureLuminanceSettingsDetected?): Ticker`

Types (all in the package): `PlaygroundTextureSource` (`{kind:"video"|"image", element}`), `PlaygroundDisplaySize` (`{width,height}`), `StripeColors`, `PlaygroundSparkleOptions`, `PlaygroundWidthShuffleOptions`, `PlaygroundGridConfig`, `PlaygroundTextureAdjustments`, `TextureLuminanceSettings`, `PlaygroundSourceTransform`, `PlaygroundFlamesState`, `PlaygroundFlamesConfig`, `PlaygroundRevealConfig`, `PlaygroundRevealState` (output), `PlaygroundRevealPlayback` (replay timing), `PlaygroundCursorTrailConfig`, `PlaygroundClickWaveConfig`, `PlaygroundSceneExportState` (output). Pointer handlers: `attachPlaygroundPointerEvents` (internal). The Ticker is `(props:{app, cleanup})=>void` from `pixiMount`.

Classification of the 23 params:
- **Per-frame config** (→ `getConfig()`): stripeColors, preferP3, duotoneEnabled, stripesEnabled, textureGamma, sparkleOptions, widthShuffleOptions, gridConfig, textureAdjustments, textureLuminanceSettings, sourceTransform, flamesConfig, revealConfig, revealPlayback, cursorTrailConfig, clickWaveConfig.
- **Static** (→ getSource/getDisplaySize, captured once; changing them remounts via sceneKey): source, display.
- **Outputs / runtime state** (→ explicit option fields): exportStateRef (studio export), revealStateRef (studio reveal-progress readout), flamesStateRef (runtime sim — scene may own it; keep as optional passthrough for studio parity), autoplayRef (playback), onTextureLuminanceSettingsDetected (colors-mode auto-detect callback; the scene must NOT mutate the caller's settings ref directly — it calls the callback and the owner updates).

---

### Task 1: Generalize `createTextureSceneTicker` → `createStripesShaderScene` (adapter keeps the studio identical)

**Files:**
- Modify: `packages/stripes-shader/src/setupTextureShaderScene.ts`
- Modify: `packages/stripes-shader/src/index.ts` (export the new API)
- Create/extend: `packages/stripes-shader/src/setupTextureShaderScene.test.ts` (adapter-equivalence + getConfig tests)

- [ ] **Step 1: Define the `getConfig` bundle + options types**

In `setupTextureShaderScene.ts`, add:
```ts
export type StripesSceneConfig = {
  stripeColors: StripeColors;
  preferP3: boolean;
  duotoneEnabled: boolean;
  stripesEnabled: boolean;
  textureGamma: number;
  sparkle: PlaygroundSparkleOptions;
  widthShuffle: PlaygroundWidthShuffleOptions;
  gridConfig: PlaygroundGridConfig;
  textureAdjustments: PlaygroundTextureAdjustments;
  textureLuminanceSettings: TextureLuminanceSettings;
  sourceTransform: PlaygroundSourceTransform;
  flamesConfig: PlaygroundFlamesConfig;
  revealConfig: PlaygroundRevealConfig;
  revealPlayback: PlaygroundRevealPlayback;
  cursorTrailConfig: PlaygroundCursorTrailConfig;
  clickWaveConfig: PlaygroundClickWaveConfig;
};

export type StripesShaderSceneOptions = {
  getConfig: () => StripesSceneConfig;
  getSource: () => PlaygroundTextureSource;
  getDisplaySize: () => PlaygroundDisplaySize;
  autoplay?: boolean;
  flamesStateRef?: RefObject<PlaygroundFlamesState | null>;
  revealStateRef?: RefObject<PlaygroundRevealState>;
  exportStateRef?: RefObject<PlaygroundSceneExportState | null>;
  onTextureLuminanceSettingsDetected?: (settings: TextureLuminanceSettings) => void;
};
```

- [ ] **Step 2: Refactor the render core to read `getConfig()` and expose `createStripesShaderScene`**

Introduce `createStripesShaderScene(options: StripesShaderSceneOptions): Ticker`. The cleanest faithful refactor: `createStripesShaderScene` holds an INTERNAL ref-set (the same refs the tick already reads), creates the scene exactly as `createTextureSceneTicker` does today, and **syncs the internal refs from `options.getConfig()` at the top of each per-frame tick** (before the existing `runDuotoneTick` logic reads them). `getSource()`/`getDisplaySize()` are captured at setup (display/source are structural — sceneKey remounts on change). `revealStateRef`/`exportStateRef`/`flamesStateRef`/`autoplay`/`onTextureLuminanceSettingsDetected` map straight to the existing internal refs/params. The reveal time-based progress keeps using `revealPlayback.startedAtMs` from the synced config. Do NOT change any render math, uniform sync, pointer wiring, or sceneKey logic — only the SOURCE of the per-frame values (a getter instead of externally-owned refs).

Keep `attachPlaygroundPointerEvents` exactly as-is (it reads the synced `cursorTrailConfig`/`clickWaveConfig` each frame and keys off `app.canvas`).

- [ ] **Step 3: Rewrite `createTextureSceneTicker` as a thin adapter**

```ts
export function createTextureSceneTicker(
  source, display, stripeColorsRef, preferP3Ref, duotoneEnabledRef, stripesEnabledRef,
  textureGammaRef, sparkleOptionsRef, widthShuffleOptionsRef, autoplayRef, exportStateRef?,
  gridConfigRef = DEFAULT_GRID_CONFIG_REF, textureAdjustmentsRef = …, textureLuminanceSettingsRef = …,
  sourceTransformRef = …, flamesStateRef = …, flamesConfigRef = …, revealConfigRef = …,
  revealStateRef = …, revealPlaybackRef = …, cursorTrailConfigRef = …, clickWaveConfigRef = …,
  onTextureLuminanceSettingsDetected?,
): Ticker {
  return createStripesShaderScene({
    getConfig: () => ({
      stripeColors: stripeColorsRef.current,
      preferP3: preferP3Ref.current,
      duotoneEnabled: duotoneEnabledRef.current,
      stripesEnabled: stripesEnabledRef.current,
      textureGamma: textureGammaRef.current,
      sparkle: sparkleOptionsRef.current,
      widthShuffle: widthShuffleOptionsRef.current,
      gridConfig: gridConfigRef.current,
      textureAdjustments: textureAdjustmentsRef.current,
      textureLuminanceSettings: textureLuminanceSettingsRef.current,
      sourceTransform: sourceTransformRef.current,
      flamesConfig: flamesConfigRef.current,
      revealConfig: revealConfigRef.current,
      revealPlayback: revealPlaybackRef.current,
      cursorTrailConfig: cursorTrailConfigRef.current,
      clickWaveConfig: clickWaveConfigRef.current,
    }),
    getSource: () => source,
    getDisplaySize: () => display,
    autoplay: autoplayRef.current,
    flamesStateRef,
    revealStateRef,
    exportStateRef,
    onTextureLuminanceSettingsDetected,
  });
}
```
The signature, defaults, and the studio's call site are UNCHANGED — only the body delegates. (If `autoplay` must stay live per-frame rather than captured, pass `autoplayRef` through as an optional option and read it where the existing code reads `autoplayRef.current`; keep behavior identical to today.)

- [ ] **Step 4: Export the new API from the barrel**

In `index.ts`, add explicit re-exports: `export { createStripesShaderScene, type StripesSceneConfig, type StripesShaderSceneOptions } from "./setupTextureShaderScene";` (the `export *` already covers them, but the new public symbols are worth an explicit line for curation — confirm no duplicate-export error).

- [ ] **Step 5: Tests — adapter equivalence + getConfig contract**

Extend `setupTextureShaderScene.test.ts`: a test that `createStripesShaderScene` builds a Ticker and that the existing scene behaviors covered today still hold. Since the render path is GPU/real-WebGL, keep to the existing test style in that file (don't invent hollow Canvas2D mocks per the repo convention). At minimum assert: the adapter `createTextureSceneTicker(...)` and a direct `createStripesShaderScene({getConfig: () => <same values>, ...})` produce equivalent setup (e.g. both return a function; a frame tick reads the latest getConfig). Run: `pir --filter @necatikcl/stripes-shader exec vitest run src/setupTextureShaderScene.test.ts`.

- [ ] **Step 6: Gate — studio renders identically**

Run: `pir verify && pir code-check`
Expected: BOTH green. The studio is unchanged (calls `createTextureSceneTicker`, now an adapter) → all existing scene + studio tests pass, proving render-equivalence at the test level. Note in the report that a human visual check of `pir dev` is recommended (the controller will request it before declaring 2c done).

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "Phase 2c: factor the scene into getConfig-based createStripesShaderScene (createTextureSceneTicker now a thin adapter)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 2: Build the render-only `<StripesShader>` component

**Files:**
- Create: `packages/stripes-shader/src/StripesShader.tsx`, `packages/stripes-shader/src/buildSceneConfig.ts` (config→scene-config resolver), `packages/stripes-shader/src/StripesShader.test.tsx`
- Modify: `packages/stripes-shader/src/index.ts` (export `StripesShader`)

- [ ] **Step 1: Write `buildSceneConfig.ts` — resolve `StripesShaderConfig` → `StripesSceneConfig`**

A pure function `resolveStripesSceneConfig(config: StripesShaderConfig, opts: { preferP3: boolean }): StripesSceneConfig` that mirrors how `TexturePlayground` populates its refs: normalize the config (`normalizeStripesShaderConfig`), resolve `stripes`/`overlayStripes` + luminance mode into `StripeColors` (use `resolveStripesForLuminanceMode` + `buildStripeColors`/`resolveStripePalette` — the same helpers the studio uses, all in the package), map the sparkle/width scalars into `PlaygroundSparkleOptions`/`PlaygroundWidthShuffleOptions`, pass through the sub-configs (grid/flames/reveal/cursorTrail/clickWave/textureAdjustments/sourceTransform/luminance), and supply `revealPlayback` from a caller-provided playback ref. Cross-check each resolution against `TexturePlayground.tsx`'s ref-population so the component interprets a config identically to the studio. Unit-test it (pure, node env): a representative config resolves to the expected `StripesSceneConfig` shape.

- [ ] **Step 2: Write `StripesShader.tsx`**

Model the structure on the OLD `apps/studio/src/lib/export/portable/AsciiVideo.tsx` (media load state machine, prop→ref mirrors, displaySize memo, `<Pixi>` mount, reveal-replay effect, sceneKey) but: (a) use the package's real `createStripesShaderScene` (full feature set) not the trimmed portable scene; (b) resolve the FULL config via `resolveStripesSceneConfig`; (c) register the font on preload; (d) support `autoPlay`/`loop`/`muted`/`paused` on the `<video>`.

```tsx
export type StripesShaderProps = {
  src: string;
  mediaKind?: "video" | "image";          // default "video"
  config?: Partial<StripesShaderConfig>;
  width?: number; height?: number;        // default config.displayWidth/Height, else native
  autoPlay?: boolean; loop?: boolean; muted?: boolean; paused?: boolean;
  className?: string; style?: React.CSSProperties;
};
export function StripesShader(props: StripesShaderProps): JSX.Element;
```
Internals: `"use client"` directive at top; SSR guard (bail to a placeholder if `typeof window === "undefined"`); load media (crossOrigin="anonymous"); a `revealPlaybackRef` bumped on `config.reveal` change + media load; `displaySize` from props/config/native; `<Pixi>` with `onPreload={preloadStripeLetterFont}` + a `resolveInitOptions` that creates the WebGL context (mirror the studio's `createPlaygroundWebGLContext`/p3 setup — copy the minimal init the studio uses, or expose a package helper); `tickers={[createStripesShaderScene({ getConfig: () => resolveStripesSceneConfig(config, {preferP3}), getSource: () => loadState.source, getDisplaySize: () => displaySize, autoplay: autoPlay })]}`; sceneKey = `${src}:${mediaKind}:${displaySize.width}x${displaySize.height}`. Pointer trail/click come for free (scene-internal).

NOTE on WebGL color-space init: the studio's p3 setup lives in studio-only `playgroundColorSpace.ts`. If the component needs it, add a minimal package-side init (the package already has `colorSpace.ts`); do NOT import studio code. If full p3 parity needs more, add a small `packages/stripes-shader/src/webglInit.ts` and have BOTH the studio and component use it (note any studio change as a follow-up — but prefer leaving the studio's init untouched in 2c and giving the component its own minimal-but-equivalent init).

- [ ] **Step 3: Test the component renders without throwing**

`StripesShader.test.tsx` (happy-dom): render `<StripesShader src="test.mp4" config={{}} />` and assert it mounts a `<canvas>` without throwing (GPU work is async/guarded; mirror the existing component test style). Keep it a smoke test — deep pixel verification is the human visual check.

- [ ] **Step 4: Export + gate + commit**

Add `export { StripesShader, type StripesShaderProps } from "./StripesShader";` and `export { resolveStripesSceneConfig } from "./buildSceneConfig";` to the barrel.
Run: `pir verify && pir code-check` (both green).
```bash
git add -A
git commit -m "Phase 2c: add the render-only <StripesShader> component + config→scene resolver

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 3 (optional, deferrable to a cleanup): route the studio directly through `createStripesShaderScene`

Replace the studio's `createTextureSceneTicker(...23 refs)` call with `createStripesShaderScene({ getConfig: buildConfigFromRefs, … })` and delete the adapter — finalizing a single call path. ONLY do this if Task 1+2 are green and time allows; the adapter is a perfectly good long-term boundary, so this is cosmetic. If done: add `buildConfigFromRefs` in `TexturePlayground.tsx` (reads the same refs the adapter read), swap the `tickers` useMemo call, remove `createTextureSceneTicker`, verify the studio renders identically, commit. If skipped, note it as a deferred cleanup.

---

## Phase 2c Done — Definition

- `createStripesShaderScene({ getConfig, … })` is the render core; `createTextureSceneTicker` delegates to it (studio call site unchanged).
- `<StripesShader src config>` renders the full scene from a `StripesShaderConfig`, with interactive trail/click, font auto-load, SSR guard.
- `pir verify` + `pir code-check` green; the studio renders identically at the test level; a human visual check in `pir dev` confirms the live GPU output.
- Committed locally; nothing pushed.

## Risks & Watch-Items

1. **Render fidelity (THE risk).** The adapter guarantees the studio's call path is unchanged, so any divergence is purely in the internal "sync refs from getConfig each frame" refactor. Keep that sync a pure copy; change NO render math/uniforms/order. The existing scene tests + studio tests + the human visual check are the guard. If anything looks off live, the refactor introduced an ordering/timing change — diff against the pre-2c tick.
2. **`onTextureLuminanceSettingsDetected` two-way path.** Today the tick mutates `textureLuminanceSettingsRef.current` in place for colors-mode auto-detect AND calls the callback. With getConfig, the scene must call the callback and let the owner update (the studio already wires it; the component can update its own ref). Preserve the exact detect behavior.
3. **`revealPlayback` timing.** Reveal progress is time-based (`now - startedAtMs`). `getConfig().revealPlayback` must surface live `startedAtMs`/`replayKey`; the component's reveal-replay effect bumps them on config/media change (mirror AsciiVideo).
4. **WebGL p3 init for the component.** The studio's p3/context setup is studio-only; give the component an equivalent package-side init without importing studio code (watch-item in Task 2 Step 2). Mismatched color-space init is a known source of scene-vs-output divergence in this repo (see memory) — get it right.
5. **`flamesState` ownership.** Today it's an external ref defaulting to `{current:null}`. Keep it an optional passthrough; the component can create its own via `createPlaygroundFlamesState()`. Ensure flames init/reset matches the studio.
6. **`"use client"` + SSR.** The component touches `document`/`window`/`performance`/`document.fonts` — guard for Next/Astro consumers.

## Self-Review (done while writing)

- **Spec coverage:** implements "generalize the scene to getConfig + build `<StripesShader>`". 2d (export deletion + Copy config) and Phase 3 (lib build) are out of scope.
- **Lowest-risk shape:** the adapter makes "studio renders identically" true by construction and testable, isolating all risk to a pure per-frame value-source swap. The component is purely additive.
- **No placeholders for the novel code:** the new types, the adapter body, the component API/props, and the resolver contract are specified; the 1445-line scene internals are refactored in place (not reproduced) under the "change only the value source" constraint, with the adapter + tests as the equivalence guard.
- **Authority-anchored resolver:** `resolveStripesSceneConfig` is defined against `TexturePlayground`'s ref-population as the source of truth, so the component interprets a config identically to the studio.
