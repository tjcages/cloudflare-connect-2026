# Experiments Agent Guide

Onboarding for agents building one self-contained visual experiment against the stripes engine.
Everything here was verified against the code in this worktree on 2026-07-21. Paths are relative
to the repo root. Companion doc: `docs/experiments-roster.md` (what to build),
`docs/engine-architecture.md` (engine invariants + pass tables).

Disambiguation: "R1–R7" in the roster's intro refers to the render-field invariants (now the
"Invariants" section of `docs/engine-architecture.md` — the old numbered doc was replaced).
"R1/R2/R3" headings in the roster are reveal _experiment names_. Unrelated numbering.

---

## 1. Repo map

pnpm monorepo (`pnpm-workspace.yaml`: `apps/*`, `packages/*`). Two workspaces only:

### apps/lab — authoring app (Vite 8 + React 19 + Tailwind v4 + leva)

- `apps/lab/index.html` — single entry page; loads `/src/main.tsx`.
- `apps/lab/src/main.tsx` — `createRoot(...).render(<StrictMode><LabApp /></StrictMode>)`.
- `apps/lab/src/LabApp.tsx` — one ~2500-line component that owns everything:
  - Engine mount: `createStripesEngine(canvas, { clock, seed, dpr, fieldScale })` at
    `LabApp.tsx:1127`, inside a `useEffect` (`:1120-1384`), disposed on unmount.
  - Canvas pointer wiring at `:1521-1577` (see §6).
  - Debug handle `window.__lab` at `:1268-1284` (`setConfig`, `cursorTo`, `clickAt`,
    `triggerReveal`, `renderAt`, `exportSvg`) — the e2e tests drive this.
- `apps/lab/src/controls/levaSchema.ts` — the leva control panel schema (`useEngineControls`);
  maps panel values → `Partial<EngineConfig>`. Other `controls/*` files: palette table, drawer
  state, easing pickers.
- `apps/lab/src/textures.ts` — built-in texture list `LAB_TEXTURES` (one entry: id `cf-base`,
  url `${BASE_URL}textures/cf-base.png`), `loadTextureSource`, `loadFileSource`.
- `apps/lab/public/textures/cf-base.png` — the default texture (served at `/textures/cf-base.png`).
- `apps/lab/src/shaderTextureSource.ts` — `createShaderTextureRenderer(width, height)`: a
  ShaderToy-style `mainImage` renderer on its own WebGL2 canvas; the lab feeds that canvas to the
  engine as its source. `defaultShaderTextureSource.ts` holds the default GLSL.
- `apps/lab/src/connectShader/` — a three.js "Connect" renderer (same feed-a-canvas pattern).
- `apps/lab/src/persistence.ts` — localStorage/sessionStorage persistence (see §6).
- `apps/lab/src/export/` — SVG + video (ffmpeg.wasm) export.
- `apps/lab/src/shaderLibrary/` — saved shader presets (JSON).
- `apps/lab/shared-demo/` + `vite.shared-demo.config.ts` — separate Vite root demoing
  `<StripesShader>` (many canvases, one worker GL context).
- `apps/lab/wrangler.jsonc` — Cloudflare Worker serving `dist` (SPA fallback).

The lab does NOT use `<StripesShader>`; it drives the engine imperatively on its own canvas.

### packages/stripes-engine — raw WebGL2 render core

Consumed by the lab as raw source (see §2). `src/` layout:

- `engine.ts` — the engine core: `createStripesEngine` / `createStripesEngineShared`, config
  application, topology gating, `buildPasses()` (the whole pass graph is assembled here), rAF loop.
- `index.ts` — the public export surface (see §3).
- `config/types.ts` — `EngineConfig` and every sub-config interface.
- `config/normalize.ts` — `DEFAULT_*` constants, per-field clamping, `normalizeEngineConfig`.
- `config/serialize.ts` — `serializeEngineConfig` / `parseEngineConfig` (JSON round-trip).
- `config/cellGrid.ts` — CSS size + cell size → `{cols, rows}`.
- `core/clock.ts` — `createRealClock` / `createManualClock` (injectable time).
- `core/frameCap.ts` — `maxFps` paint-rate gating. `core/rng.ts` — `mulberry32`, seeded RNG.
  `core/math.ts` — lerp/smooth.
- `gl/context.ts` — WebGL2 context creation, display-p3 setup, throws without WebGL2.
- `gl/program.ts` — `compileProgram` (throws with info log), `createFullscreenQuad` (big-triangle VAO).
- `gl/renderTarget.ts` — FBO+texture render targets, `bindRenderTarget`, MRT helpers.
- `gl/pingPong.ts` — double-buffered render-target pair for sims.
- `gl/dataTexture.ts` — raw `Uint8Array` → RGBA8 texture (the only safe data-texture path).
- `gl/renderSurface.ts` — canvas vs shared-context surface abstraction (DPR, context-loss listeners).
- `gl/resolution.ts` — output/field size resolution, MAX_TEXTURE_SIZE clamp.
- `pipeline/pipeline.ts` — `type Pass = { name; render(); dispose() }`, `runPipeline`.
- `pipeline/rtPool.ts` — named render-target pool (`pool.get(key, w, h, {float?, linear?})`),
  auto-resizes; keys like `"field"`, `"revealedField"`, `"cell"` identify RTs across passes.
- `field/stripeLut.ts` — stripes[] → 256×1 LUT bytes. `field/cellBand.ts` — value → band index.
  `field/imageColorDensity.ts` — `effectiveStripes(config)` (colors-mode density rewrite).
- `source/sourceTexture.ts` — `EngineSource` (image | video | ImageBitmap | canvas | VideoFrame)
  → GL texture with per-frame `update()`/`uploadFrame()`. `source/fit.ts` — fit/zoom/pan rect.
- `colors/` — background detect, vibrant palette extraction, color math.
- `letters/` — glyph atlas bake (canvas 2D, one-shot), charset, text glyph maps.
- `reveal/revealMath.ts` — wave origins, durations, `serpentinePoint` (water reveal's ghost cursor).
- `reveal/waterRevealSim.ts` — GPU heightfield sim for the water reveal (ping-pong, serpentine
  splat driver, cover accumulation).
- `cursorTrail/cursorTrailSim.ts` — CPU particle sim for the trail (emit/advance/expire samples).
- `cursorTrail/clickWaveSim.ts` — CPU expanding-ring sim for clicks.
- `cursorTrail/constellationSim.ts` — CPU star/link/pulse graph for the
  `cursorTrail.type: "constellation"` trail (paired with `passes/constellationPass.ts`).
- `cursorTrail/waterSim.ts` — GPU heightfield sim for the `cursorTrail.type: "wave"` trail
  (stepped outside the pass graph, sampled by the field pass).
- `flames/flamesSim.ts` — CPU flame particle sim (spawn/advance per direction).
- `stars/starsSim.ts` — CPU star sim (spawn/twinkle/expire).
- `stripeFx/sparkleMath.ts` — sparkle timing math used by the stripe shader uniforms.
- `edgeMask/edgeMaskMath.ts` — edge fade math.
- `perf/` — GPU timer (EXT_disjoint_timer_query), frame percentiles, `PerfSnapshot`.
- `legacy/` — old-config migration (`migrateLegacyConfig`).
- `react/StripesShader.tsx` — the React drop-in canvas (see §3). `react/index.ts` re-exports it.
- `shared/` — shared-context mode: `coordinator.ts` (main thread: one Worker, per-canvas 2D
  display contexts, IntersectionObserver gating), `sharedWorker.ts` (worker: one GL context,
  N engines via `createStripesEngineShared`), `protocol.ts`, `media.ts` (video frame pump).

#### Pass files (`src/passes/`) — each exports `createXxxPass(gl[, quad])` → `{ render(...), dispose() }`

| File                                    | Purpose                                                                                            |
| --------------------------------------- | -------------------------------------------------------------------------------------------------- |
| `sourceFieldPass.ts`                    | source texture → grayscale field (adjustments, fit, water-heightfield refraction)                  |
| `sourceFieldColorPass.ts`               | colors-mode MRT variant: writes field + fieldColor                                                 |
| `particleFieldPass.ts`                  | generic wrapper: steps a CPU sim, draws its particles into the field RT (used by stars + flames)   |
| `starsPass.ts`                          | instanced star quads                                                                               |
| `flamesPass.ts`                         | instanced flame quads (`drawArraysInstanced`)                                                      |
| `revealPass.ts`                         | wave reveal mask (field → revealedField)                                                           |
| `assemblyScatterPass.ts`                | instanced flying-block assembly reveal                                                             |
| `energyWarpPass.ts`                     | turbulence/glitch warp reveal (mode uniform)                                                       |
| `vortexPass.ts`                         | vortex reveal (spiral particles + core)                                                            |
| `waterSimPass.ts`                       | one heightfield sim step (shared by both water sims)                                               |
| `waterRevealPass.ts`                    | composites field through the water reveal heightfield (refraction)                                 |
| `blurPass.ts`                           | separable gaussian blur (assembly blur pyramid)                                                    |
| `edgeMaskPass.ts`                       | edge fade on the field                                                                             |
| `cursorSplatPass.ts`                    | instanced trail-particle splats → cursorAccum (float RT at cell res)                               |
| `clickSplatPass.ts`                     | instanced click-ring splats → cursorAccum                                                          |
| `cursorTearPass.ts`                     | accum → tear/push cap map                                                                          |
| `cursorWarpPass.ts`                     | warps field (and color field) by the push map                                                      |
| `downsamplePass.ts`                     | field → cell grid values                                                                           |
| `downsampleColorPass.ts`                | color field → cell grid colors                                                                     |
| `letterDataPass.ts`                     | per-cell glyph index/coverage data                                                                 |
| `stripePass.ts`                         | THE terminal pass: cells → stripes at output resolution (letters, gradients, sparkle, blend modes) |
| `logoFillPass.ts`                       | solid-fill prep for stylize modes                                                                  |
| `stylizePass.ts`                        | renderMode post styles (13 variants)                                                               |
| `presentPass.ts`                        | stripes-off branch: blit field straight to canvas                                                  |
| `colorDistPass.ts` / `maxReducePass.ts` | colors-mode max color distance (one-shot reduction)                                                |

#### Shader files (`src/shaders/`) — TS modules exporting `#version 300 es` GLSL strings (UPPER_SNAKE consts)

`fullscreen.vert.ts` (shared big-triangle vert, `vUv` out) · `sourceField.frag.ts` /
`sourceFieldColor.frag.ts` (image→field) · `colorAdjust.glsl.ts` (shared adjust chunk) ·
`downsample.frag.ts` / `downsampleColor.frag.ts` · `reveal.frag.ts` (wave mask) ·
`assemblyScatter.vert/.frag.ts` · `energyWarp.frag.ts` (turbulence+glitch) ·
`vortexCore.frag.ts` + `vortexParticles.vert/.frag.ts` · `waterSim.frag.ts` (heightfield step) ·
`waterRevealAccum.frag.ts` (cover accumulation) · `waterReveal.frag.ts` (refraction composite) ·
`blur.frag.ts` · `edgeMask.frag.ts` · `cursorSplat.vert/.frag.ts` · `clickSplat.vert/.frag.ts` ·
`cursorTear.frag.ts` · `cursorWarp.frag.ts` · `flames.vert/.frag.ts` · `stars.vert/.frag.ts` ·
`letterData.frag.ts` · `stripe.frag.ts` (terminal stripes) · `logoFill.frag.ts` ·
`present.frag.ts` · `maxReduce.frag.ts` · `colorDist.frag.ts` ·
`stylize/*.frag.ts` + `stylize/common.ts` + `stylize/index.ts` (`STYLIZE_FRAGS` map, `PASSTHROUGH_FRAG`).

---

## 2. Dev workflow

This machine uses `pi` (installs) and `pir` (script runner). Never npm/pnpm/yarn/npx directly.

```bash
pi                                  # install (repo root)
pir dev                             # root script → vite dev for apps/lab on port 5174
pir typecheck                       # engine tsc --noEmit, then lab tsc --noEmit
pir test                            # vitest unit tests
pir test:e2e                        # playwright visual goldens (starts/reuses :5174)
pir build                           # lab production build
pir lint && pir format:check        # oxlint / oxfmt (120-col)
```

- Dev port: **5174** (`apps/lab/vite.config.ts:12`). The user usually already has it running —
  probe `http://localhost:5174` before starting anything; never spawn a competing server on the
  same project. To run a second instance safely: `pir dev --port 5175 --strictPort`.
  **Never** `pir dev -- --port ...` — `pir` passes the `--` literally to vite and it breaks.
- **Engine is consumed as raw source; editing engine `.ts` hot-reloads the lab. No build/watch
  step exists or is needed.** Mechanism: `apps/lab/vite.config.ts:15-20` aliases
  `@necatikcl/stripes-engine` → `../../packages/stripes-engine/src/index.ts` and
  `.../react` → `src/react/index.ts`, with `optimizeDeps.exclude` for the package (line 21).
  The package.json `main`/`exports` also point at `./src/index.ts` in dev (`packages/stripes-engine/package.json:13-19`);
  `dist/` is only built by CI for publishing — never build or publish it yourself.
- Only the two subpaths `@necatikcl/stripes-engine` and `@necatikcl/stripes-engine/react`
  resolve. Deeper subpaths break under the alias; if you need an internal module from lab code,
  import it by relative path (`../../packages/stripes-engine/src/...`) — TS typechecks it fine.

---

## 3. Engine public API

### Imports

```ts
import {
  createStripesEngine,
  createStripesEngineShared,
  normalizeEngineConfig,
  DEFAULT_ENGINE_CONFIG,
  serializeEngineConfig,
  parseEngineConfig,
  migrateLegacyConfig,
  effectiveStripes,
  applyImageColorDensity,
  bandIndexForValue,
  createRealClock,
  createManualClock,
  createSeededRng,
  type StripesEngine,
  type EngineOptions,
  type EngineConfig,
  type EngineSource,
  type Stripe,
  type Fit,
  type RenderMode,
  type CellGridReadback,
  type PerfSnapshot,
  type SharedStripesEngine,
  type SharedEngineOptions,
  type EngineContext,
  type Clock,
  type ManualClock,
  type Adjustments,
  type Grid,
  type Transform,
  type Background,
} from "@necatikcl/stripes-engine";
import { StripesShader, type StripesShaderProps } from "@necatikcl/stripes-engine/react";
```

Beyond that list, `packages/stripes-engine/src/index.ts` also exports the GL toolkit and the
engine hook types (added for the experiments lab): `compileProgram`, `createFullscreenQuad`,
`createRenderTarget` / `resizeRenderTarget` / `disposeRenderTarget` / `bindRenderTarget`,
`createPingPong`, `createDataTexture` / `updateDataTexture`, `FULLSCREEN_VERT`, and the types
`FullscreenQuad`, `RenderTarget`, `PingPong`, `RtPool`, `Size`, `CursorTrailPoint`,
`EngineHooks`, `EngineHookContext`, `FieldHookFrame`, `FieldHookPass`, `PostHookFrame`,
`PostHookPass`, `CustomRevealFrame`, `CustomRevealPass`. Pass factories and sim functions
remain internal. See §5 for the hooks and toolkit reference.

### Lifecycle

```ts
const engine = createStripesEngine(canvas, {
  clock?: Clock,          // default createRealClock(); createManualClock for deterministic frames
  seed?: number,          // default 1; seeds flames + stars RNG
  dpr?: number,           // default window.devicePixelRatio × canvas.currentCSSZoom
  fieldScale?: number,    // shorthand for config.fieldScale
  hooks?: EngineHooks,    // custom pass hooks, see §5 (standalone engines only)
  onWaterActivity?: (a: number) => void,  // 0..1, only for cursorTrail.type "wave"
});
engine.resize(cssW, cssH);   // CSS px; engine sets canvas.width/height = css × dpr itself
engine.setSource(imgOrVideoOrCanvas);   // EngineSource | null; null = black field
engine.setConfig(partial);   // deep-partial; runs normalizeEngineConfig({...current, ...partial})
engine.start();              // self-running requestAnimationFrame loop
// or: engine.renderFrame() per tick if you drive your own loop (manual clock, capture, tests)
engine.setCursor(x, y);      // CSS px in canvas space; setCursor(null) = pointer left
engine.click(x, y);
engine.triggerReveal();      // (re)starts the reveal timeline at clock.now()
engine.stop(); engine.dispose();
```

Other members: `updateSourceFrame(frame)` (per-frame upload for canvas/VideoFrame feeding),
`setFieldScale(s)`, `readOutputPixels()`, `readCellGrid()` → `{cols, rows, values, colors}`,
`getPerf()`, `getWaterActivity()`, `isP3`, `maxFps`.

Notes:

- `setConfig` merges shallowly at the top level, but each section is re-normalized from partials,
  so `engine.setConfig({ reveal: { enabled: true, type: "wave" } })` works — unspecified reveal
  fields fall back to defaults, NOT to your previous values within that section. To tweak one
  nested knob while keeping the rest, spread your own config object and pass the whole section.
  (The lab keeps a full `EngineConfig` in state and passes it whole.)
- Reveals are time-based from an internal `revealStartMs` (engine.ts:224, 1286-1288). A freshly
  created engine has `revealStartMs = 0`, so with a real clock an enabled reveal reads as already
  finished — call `triggerReveal()` after the source loads (the lab does: LabApp.tsx:914-925, 989).
- Config changes never rebuild the GL pipeline unless a topology signal flips
  (engine.ts:1238-1274); param tweaks are free every frame.
- Context loss is handled: the engine rebuilds GPU resources on restore but drops the source
  (engine.ts:1112-1144) — re-call `setSource` after a restore if you keep engines alive.

### Full config schema (`EngineConfig`, defaults from `config/normalize.ts`)

All colors are `0xRRGGBB` numbers. `[a..b]` = clamped range. Defaults shown after `=`.

```
transform:        fit: "stretch"|"contain"|"cover"|"width"|"height" = "width"
                  zoom = 1 [0.1..8] · panX = 0 [-1..1] · panY = 0 [-1..1]
adjustments:      brightness 0 [-1..1] · exposure 0 [-5..5] · contrast 1 [0..4]
                  blackPoint 0 [0..1] · whitePoint 1 [bp+0.01..1] · gamma 1 [>=0.05]
                  invert false · posterizeLevels 0 [0..16] · thresholdBias 0 [-1..1]
                  noiseAmount 0 [0..1] · blurRadius 0 [0..4] · sharpenAmount 0 [0..4]
background:       color 0xffffff · transparent true
                  gradient: { enabled false, direction "topToBottom"|"leftToRight"|"rightToLeft"|"bottomToTop",
                              stopCount 2 [2..4], stops [0xffffff,0,0,0], hueDriftDeg 0 [-180..180],
                              saturationBoost 0 [0..1] }
                  grid: { enabled false, cellWidth 96 [4..512], cellHeight 96, gapX 8, gapY 8,
                          cornerRadius 0, color 0xf3f3f3, opacity 1 }   (decorative bg grid)
                  stars: { enabled false, density 50 [0..100], sizePx 8 [0.25..64],
                           sizeRandomness 0.65 [0..1], tiltAngleDeg 0 [-89..89],
                           twinkleSpeed 1 [0..10], twinkleAmount 0.7 [0..1],
                           opacity 0.8 [0..1], color 0xffffff }
grid:             cellWidth 7 [1..64] · cellHeight 7 · gapX 0 · gapY 0 · cornerRadius 0
                  orientation "vertical"|"horizontal" = "vertical" · angleDeg 0 [-180..180]
                  rotationMode "cell"|"overlap" = "cell" · overlapAmount 1 [0..4]
stripes:          Stripe[] = 6-stripe orange ramp; Stripe = { color, startFrom [0..1],
                  width [0.5..64], opacity [0..1] }  (startFrom = luminance band threshold)
stripesEnabled:   true   (false = present the raw field, skip stripes entirely)
fieldScale:       1 [0.25..2]  (field passes run at output × fieldScale)
maxFps:           0 (uncapped; >0 caps paint rate without changing animation speed)
reveal:           enabled false · type "wave"|"assembly"|"turbulence"|"glitch"|"vortex"|"water"|"custom" = "assembly"
                  wave:    { position "center"|"left top"|...9 anchors, durationMs 1200 [100..30000],
                             softness 0.22 [0..1], waviness 0.11 [0..1] }
                  assembly:{ sliceSizePx 29 [8..200], speedMinMs 300, speedMaxMs 1600 [100..30000],
                             staggerMs 6550 [0..30000], scatterPx 90 [0..300],
                             angleJitterDeg 35 [0..90], blurPx 17.5 [0..50], blurStart 0.45 [0..0.95] }
                  turbulence / glitch (WarpStyleConfig):
                           { speedMinMs, speedMaxMs [50..30000], staggerMs [0..30000],
                             intensity 1 [0..2], detail 0.5 [0..1], glow [0..1] }
                             (turbulence: 400/2600/1400/1/0.5/0.6 · glitch: 200/1400/1200/1/0.5/0.8)
                  vortex:  WarpStyleConfig + swirl 1 [0..3]  (300/1400/2600/1/0.5/0.7)
                             ("hadouken" is a legacy alias, normalized to "vortex")
                  water:   { durationMs 2600 [1..60000], settleMs 900 [0..20000], rows 5 [1..24],
                             intensity 0.85 [0..3], wobble 0.5 [0..1], refraction 1 [0..4],
                             softness 0.35 [0..1] }
                  custom:  no config block; delegates to EngineOptions.hooks.customReveal (§5);
                           duration = wave.durationMs; without the hook it falls back to the wave pass
sparkle:          gaps:   { enabled false, coverage 0.22 [0..1], speed 1 [0.05..100] }
                  width:  { enabled false, coverage 0.3, swingPx 1.25 [0..40],
                            swingPeriodMin 0.21, swingPeriodMax 0.55 [0.02..5] }
                  stripe: { enabled false, coverage 0.35, maxBrightness 0.65 [0..1], speed 1,
                            thickestCount 3 [1..64], hueDriftDeg 0, saturationBoost 0 }
                  motion: { enabled false, amplitudePx 4 [0..64], staggerPx 24 [1..512],
                            maxOffsetPx 12 [0..128], speed 1 [>=0.05],
                            direction "leftToRight"|"rightToLeft"|"topToBottom"|"bottomToTop" }
flames:           enabled false · direction "up"|"down"|"left"|"right"|"upDown"|"leftRight" = "up"
                  minWidthRatio 0.0223 · maxWidthRatio 0.0453 [0.001..0.5]
                  minHeightRatio 0.0245 · maxHeightRatio 0.08 [0.001..0.5]
                  baseSpeedPxPerSec 40 [1..500] · speedVariation 1 [0..1]
                  spawnIntervalMs 50 [20..5000] · spawnJitterMs 80 [0..2000]
                  maxActive 48 [1..200] · edgeSharpness 1 [0..1]
                  opacityMin 0.3 · opacityMax 1 [0..1]
                  (NOTE: vortex / vortexBits / snake flame variants were REVERTED in commit
                   be5c943 and do not exist; recover the old sim for reference via
                   `git show be5c943^:packages/stripes-engine/src/flames/flamesSim.ts`)
edgeMask:         enabled false · start 0 [0..0.5] · end 0.1 [start+0.001..0.5] · power 1 [0.1..4]
cursorTrail:      enabled false · type "default"|"wave"|"constellation" = "default"
                  ("default" = particle splats + push warp; "wave" = GPU water heightfield that
                   the source-field pass refracts through — replaces the particle path entirely;
                   "constellation" = cursor-linked star graph drawn INTO the field by
                   passes/constellationPass.ts — also replaces the particle path)
                  particleRadius 40 [0.5..80] · particleAlpha 0.07 [0..1]
                  particleLifeMs 960 [50..10000] · particleLifeJitterMs 100
                  emitterVelocitySmoothing 0.7 [0..0.98] · particleVelocityScale 0.01 [0..2]
                  particleTangentVelocity 1.65 [0..20] · particleDamping 0.96 [0..1]
                  particleSpacingPx 3 [0.5..80] · maxEmitPerTick 10 [1..200]
                  spreadMinPx 1.5 [0..80] · spreadMaxPx 21 [min..120] · spinStrength 0.04 [0..0.2]
                  densityRadiusMinScale 0.2 · densityRadiusLifeScale 1 [0..3]
                  pushRadiusScale 0.9 [0..8] · pushStrengthPx 48 [0..120]
                  pushLagPx 0 · pushWobblePx 8 [0..80] · pushLeadBlackAlpha 0 [0..1]
                  constellation: { radiusScale 0.31 [0.02..2] · starDensity 1 [0.05..4]
                    (× 44 base stars) · starSizePx 2.2 [0.2..20] · starSizeRandomness 0.77 [0..1]
                    · starGrowScale 1.35 [0..6] · starPushPx 1.9 [0..40]
                    · twinkleAmount 0.18 [0..1] · twinkleSpeed 1 [0..10]
                    · linkThicknessPx 2.9 [0.2..20] · linkBrightness 1 [0..4]
                    · linkGrooveDepth 1 [0..4] · linkShearPx 13.5 [0..80]
                    · linkMaxDistScale 0.2184 [0.02..1] (graph topology — decoupled from
                      radiusScale on purpose) · linkFormMs 210 · linkHoldMs 0 · linkDissolveMs 540
                    · maxLinks 48 [4..80] · maxStars 64 [4..160] (caps bake the shader array
                      sizes — changing either rebuilds the pass)
                    · pulseEnabled true · pulseDurationMs 700 [60..10000]
                    · pulseCoreLenPx 3.4 · pulseTailLenPx 27 · pulseBrightness 1 [0..4]
                    · pulseRelayHops 2 [0..6] · pulseCooldownMs 900 [0..20000]
                    · flareMs 460 · flareScale 0.85 [0..6]
                    · polygonFlashEnabled true · polygonFlashStrength 1 [0..4] }
clickWave:        enabled false · lifeMs 630 [80..10000] · startRadiusPx 6 [1..120]
                  maxRadiusPx 120 [4..600] · startStrokeWidthPx 24 [0.5..80]
                  endStrokeWidthPx 12 [0.25..40] · maxWaves 12 [1..32]
                  pushStrengthPx 38 [0..200] · pushBandScale 3.2 [1..8] · stripeWhiteAlpha 0.5 [0..1]
letters:          enabled false · mode "random"|"text" · colorMode "white"|"colorful"
                  color 0xffffff · coverage 0.1 [0..1] · positionX/Y 0.5 [0..1]
                  areaWidth/Height 1 [0.01..1] · text "CF" (≤512 chars) · textCopies 1 [1..100]
                  fontFamily "Geist Mono Medium" (allowlist in normalize.ts:634) ·
                  sizeScale 0.9 [0.1..1] · shuffleSpeed 1 [0.05..10]
colors:           mode "luminance"|"colors" = "luminance"
                  stripeBlendMode "normal"|"multiply"|"screen"|"overlay"|"darken"|"lighten"|
                                  "difference"|"exclusion" = "normal"
                  imageColorLightness 0.2 [-1..1] · imageColorDensity 1 [0..1]
                  imageColorRemoveThin 0 [0..0.95] · imageColorBoostThick 0 [0..2]
                  autoDetectBackground true · backgroundColor 0x000000
                  gradient: BackgroundGradient (same shape as background.gradient, enabled false)
renderMode:       "sharp" | "abstract"|"charcoal"|"pencil"|"brush"|"halftone"|"risograph"|
                  "stainedGlass"|"paperCutout"|"crt"|"glitch"|"vhs"|"amber"|"gummy" = "sharp"
renderIntensity:  1 [0..1] · renderParams [0.5,0.5,0.5,0.5] [0..1] each
renderColorA:     0x222222 · renderColorB: 0xffffff
```

The lab overrides some of these on load with `DEFAULT_LAB_ENGINE_CONFIG`
(`apps/lab/src/defaultLabConfig.ts`, merged with `src/factoryDefaults.json`) — the designer-tuned
starting point. Experiments comparing against the lab look should start from that, not from
`DEFAULT_ENGINE_CONFIG`.

### `<StripesShader>` (React) — `packages/stripes-engine/src/react/StripesShader.tsx`

`<StripesShader src="/textures/cf-base.png" config={partial} />` renders a `<canvas>`.
**The component is shared-only** (the `sharedContext` prop was removed in 0.10.0): the instance
registers with `shared/coordinator.ts`, where ONE Worker owns one OffscreenCanvas WebGL context
running N `createStripesEngineShared` engines; each page canvas is a plain 2D canvas receiving
ImageBitmap frames. This beats the browser context cap, and it forwards cursor/click and
`onWaterActivity` per instance; it runs the fixed pipeline only (no `EngineHooks`).

The coordinator is reached through a dynamic `import()` only, so the main-thread GL engine is not
in the `/react` entry's static graph (~70 KB gz consumers no longer download). Needing the engine
on the main thread — imperative control or `EngineHooks` — means calling `createStripesEngine`
from the package root yourself. There is no automatic fallback: shared mode requires
OffscreenCanvas + Worker (Safari 16.4+).

Rendering is gated on an IntersectionObserver honoring `rootMargin` (default `"200% 0px"`,
`core/visibility.ts`), plus a separate `preloadRootMargin` gate for the source fetch. Outside the
render gate the instance PAUSES by being skipped in `renderTick`. Nothing is disposed: the
context, the source and the
reveal timeline survive, so scrolling away and back neither recompiles programs nor replays the
reveal. Do NOT wrap the component in `{inView && …}` — that unmounts and destroys the context.
A paused instance also `settle()`s (reports `onWaterActivity(0)`) so a hover value cannot freeze
offscreen.

### The lab's "shader" texture source mode

`textureSourceMode: "texture" | "shader"` is a LAB setting (`apps/lab/src/persistence.ts:35`),
not an engine key. "shader" means: the lab runs its own GLSL renderer
(`createShaderTextureRenderer`) or the three.js Connect renderer on a separate canvas and feeds
it every frame: `engine.setSource(renderer.canvas)` once, then
`engine.updateSourceFrame(renderer.canvas)` per tick (LabApp.tsx:1300-1343). This
canvas-as-source pattern is available to experiments unchanged.

---

## 4. Render pipeline walkthrough

Full tables in `docs/engine-architecture.md`. One frame (`renderFrame`, engine.ts:1163-1174):
poll GPU timers → step the water trail sim if active (outside the pass graph) → `runPipeline(passes)`.

Pass order with stripes enabled (each is present only when its feature is on):

```
field → backgroundStarsField → flamesField → [reveal variant] → edgeMaskField → cursorField
      → downsample → downsampleColor → letterData → stripe → logoFill → stylize → canvas
```

Everything before `downsample` reads/writes field-resolution RTs from the pool
(`pool.get("field" | "revealedField" | "maskedField" | "cursorField", fieldSize…)`); passes chain
by RT key — each stage updates `activeFieldRT` so the next stage reads the right texture
(engine.ts:592-911). `downsample` is the only field→cell step; `stripe` renders cells → output
resolution. With `stripesEnabled: false` the chain ends in a `present` blit of the active field
RT instead (engine.ts:1062-1084). Stripes are strictly terminal: nothing after `stripe` modifies
stripe geometry (`logoFill`/`stylize` only post-process its output image).

Where sims live:

- CPU sims (trail, click, flames, stars) are stepped inside their pass's `render()` each frame:
  `updateCursorTrail`/`updateClickWave` in the cursorField pass (engine.ts:852, 865),
  `stepFlames`/`stepStars` via `createParticleFieldPass`'s `step()` (engine.ts:556, 575).
- GPU water trail sim (`cursorTrail.type: "wave"`): `stepWaterSim()` before the pipeline
  (engine.ts:253-273); the source-field pass samples its heightfield (engine.ts:530).
- GPU water reveal sim: ticked inside the `waterRevealField` pass (engine.ts:728-764), driven by
  a serpentine ghost cursor (`serpentinePoint`, reveal/revealMath.ts:113).

### One reveal type end-to-end (template — "wave")

1. Config: `reveal: { enabled: true, type: "wave", wave: {...} }` → validated in
   `normalizeReveal` (config/normalize.ts:352; type list `REVEAL_TYPES` at :241).
2. Topology: `revealPassKind()` (engine.ts:206-213) maps type → pass kind; a change flips the
   gate in `setConfig` (engine.ts:1238-1250) → `buildPasses()`.
3. Pass selection: `buildPasses` picks the branch at engine.ts:765-796 → `createRevealPass`
   (passes/revealPass.ts) reads the `"field"` RT, writes `"revealedField"`, with progress
   `(clock.now() - revealStartMs) / durationMs` and wave uniforms (origin, softness, waviness).
4. Shader: `REVEAL_FRAG` (shaders/reveal.frag.ts) — radial distance front + per-cell noise mask.
5. Downstream passes read `"revealedField"` because `activeFieldRT` was set at engine.ts:593.

The other variants swap only step 3-4: assembly = instanced quads (assemblyScatterPass),
turbulence/glitch = energyWarpPass with a mode uniform (engine.ts:74-77), vortex = vortexPass,
water = waterRevealSim + waterRevealPass. Adding a look = adding one such branch.

### One flame variant end-to-end

`flames.direction: "up"` → `normalizeFlames` (config/normalize.ts:472-476, closed list) →
direction change resets sim state (engine.ts:1234-1236) → `stepFlames`
(flames/flamesSim.ts:198) spawns/advances CPU particles per direction →
`createParticleFieldPass` uploads them as instance attributes → `createFlamesPass` draws
instanced soft-gradient quads (passes/flamesPass.ts:116) additively INTO the `"field"` RT —
flames are field content, so stripes automatically render them.

### Stars

Same wrapper: `createStarsState(mulberry32(seed ^ STARS_SEED_XOR))` (engine.ts:236-237),
`stepStars` (stars/starsSim.ts:80) handles spawn/twinkle/expire in CSS-px space,
`createStarsPass` draws instanced tilted-cross quads into the field before flames.

### Invariants (the "R1-R7" render-field rules, now `docs/engine-architecture.md:6-16`)

1. **Field-first** — one grayscale field (white = stripe here); every effect is a field→field GPU
   pass; stripes are a pure terminal post-process; stripes-off shows the raw field.
2. **GPU-first** — no CPU pixel sampling on the hot path (CPU = orchestration, one-shot
   readbacks, glyph atlas bake).
3. **WebGL2 only** — ES 3.00 shaders; MRT/float RTs/instancing allowed; no WebGL1 path.
4. **Resolution** — output = CSS × DPR (clamped to MAX_TEXTURE_SIZE); field passes at
   `fieldScale`; stripes/letters at full output resolution.
5. **Determinism** — injectable clock + seed; visual goldens depend on both.
6. **No silent shader failures** — compile/link must throw with the info log.

Also: never relight/project stripe output — 3D or fancy content gets rendered INTO the field,
stripes stay a 2D terminal pass.

---

## 5. Extension points

### Available today, from outside the engine (no engine edits)

- **Own engine per canvas** — `createStripesEngine` has no module-level state; N instances on
  one page are independent (separate contexts, pools, sims, seeds). Costs one WebGL context each.
- **Canvas-as-source** — render your effect on your own canvas (2D or GL) and feed it via
  `setSource(canvas)` + `updateSourceFrame(canvas)` per frame; the engine stripe-ifies whatever
  you drew. This is the lab's shader-mode pattern and needs nothing new. Good for source-level
  looks; can't touch the engine's field passes (cursor warp etc. still apply on top).
- **Programmatic driving** — `setCursor`/`click`/`triggerReveal` + `createManualClock` for
  scripted, deterministic sequences (ghost cursors, demo loops, capture).
- **Readbacks** — `readCellGrid()` (cell values + colors) and `readOutputPixels()` for one-shot
  CPU logic (SVG export style), not per-frame.
- **Exported helpers** — `normalizeEngineConfig`, `DEFAULT_ENGINE_CONFIG`, `effectiveStripes`,
  `bandIndexForValue`, clocks, `createSeededRng`, serialize/parse, plus the GL toolkit below.

### Exported GL toolkit (build your own sim passes outside the engine)

All named exports of `@necatikcl/stripes-engine`:

- `compileProgram(gl, vertSrc, fragSrc)` → `WebGLProgram` — throws with the info log on
  compile/link failure (never swallow it).
- `createFullscreenQuad(gl)` → `FullscreenQuad = { draw(): void; dispose(): void }` — the
  big-triangle VAO; pair with `FULLSCREEN_VERT` (shared `#version 300 es` vertex shader,
  provides `out vec2 vUv`).
- `createRenderTarget(gl, w, h, { float?, linear? })` → `RenderTarget = { fbo, texture, width,
height, float? }` · `resizeRenderTarget(gl, rt, w, h)` · `disposeRenderTarget(gl, rt)` ·
  `bindRenderTarget(gl, rt | null)` (binds the fbo and sets the viewport; `null` binds the
  canvas backbuffer WITHOUT setting a viewport — set it yourself).
- `createPingPong(gl, w, h, { float?, linear? })` → `PingPong = { read(), write(), swap(),
resize(w, h), dispose() }` — double-buffered RT pair for sims.
- `createDataTexture(gl, bytes: Uint8Array, w, h)` / `updateDataTexture(...)` — the ONLY safe
  data-texture path (raw buffer upload, exempt from display-p3 conversion; §6).
- Types: `FullscreenQuad`, `RenderTarget`, `PingPong`, `RtPool`, `Size`, `CursorTrailPoint`,
  and the hook types below.

### Engine hooks (as built)

`createStripesEngine(canvas, { hooks })` takes one optional `hooks: EngineHooks` object
(standalone engines only; the shared-context worker path takes no hooks). Every hook factory is
invoked inside `buildPasses()` with

```ts
type EngineHookContext = { gl: WebGL2RenderingContext; quad: FullscreenQuad; pool: RtPool };

type EngineHooks = {
  fieldPass?: (ctx: EngineHookContext) => FieldHookPass;
  postPass?: (ctx: EngineHookContext) => PostHookPass;
  customReveal?: (ctx: EngineHookContext) => CustomRevealPass;
};
```

and re-invoked whenever the pipeline rebuilds (topology config flips, context restore) — the
previous hook pass's `dispose()` runs first. Factories must therefore be re-entrant, create all
their GL resources from `ctx.gl` inside the factory (never at outer scope), and release
everything in `dispose()`. Hooks default to `undefined` and add zero cost when absent. All hook
types are exported from `@necatikcl/stripes-engine`.

**`hooks.fieldPass`** — the workhorse: a field→field pass spliced between the reveal stage and
the edgeMask stage (pass name `hookField`, engine.ts). Ambience/trail/click experiments draw
their black/white content INTO the field here; stripes then render it automatically. Per frame:

```ts
type FieldHookPass = { render(frame: FieldHookFrame): void; dispose(): void };
type FieldHookFrame = {
  input: RenderTarget; // current active field RT (post-reveal) — sample input.texture
  output: RenderTarget; // pool RT "hookField" at field resolution — render here
  fieldSize: Size; // { width, height } of both RTs (output px × fieldScale)
  cssW: number; // canvas CSS size (sim math should run in CSS px like all engine sims)
  cssH: number;
  now: number; // engine clock.now() in ms
  elapsed: number; // ms since engine creation
  cursor: () => CursorTrailPoint | null; // latest setCursor point in CSS px; null = pointer left
};
```

The engine unconditionally advances the field chain to `output`: every frame you MUST cover
`output` fully (sample `input` in your shader and composite your content over it — a stale or
partial `output` corrupts everything downstream). Downstream stages (edgeMask → cursor warp →
downsample → stripe) read `output`. Field convention: grayscale, white = stripe here. In
colors mode the hook only affects the luminance field; the parallel `fieldColor` chain passes
through untouched — run luminance mode for hook experiments.

**`hooks.postPass`** — final screen-space pass over the composed output, i.e. the exact image
that was about to hit the canvas (pass name `hookPost`). With stripes on, `src` is the stripe
(or stylize, when `renderMode !== "sharp"`) output at output resolution; with stripes off,
`src` is the active field texture (field resolution) that the present blit would have shown.
For lens/refraction-style FX. It renders LAST:

```ts
type PostHookPass = {
  render(src: WebGLTexture, dst: RenderTarget | null, frame: PostHookFrame): void;
  dispose(): void;
};
type PostHookFrame = {
  outputWidth: number; // canvas backbuffer size in device px
  outputHeight: number;
  cssW: number;
  cssH: number;
  now: number;
  elapsed: number;
  cursor: () => CursorTrailPoint | null;
};
```

`dst` is currently always `null` (the canvas backbuffer): bind with
`gl.bindFramebuffer(gl.FRAMEBUFFER, null)` and `gl.viewport(0, 0, frame.outputWidth,
frame.outputHeight)`, then draw. This is image-space FX over the finished composite in the
spirit of logoFill/stylize — it must never re-derive, reposition, or relight stripes (§4).

**`hooks.customReveal`** — a reveal variant that inherits the engine's reveal timing. Set
`reveal: { enabled: true, type: "custom" }` (`"custom"` is a real `RevealType`, accepted by
`REVEAL_TYPES`/normalize); the reveal stage (pass name `customRevealField`) then delegates to
your pass, and `engine.triggerReveal()` restarts it for free:

```ts
type CustomRevealPass = { render(frame: CustomRevealFrame): void; dispose(): void };
type CustomRevealFrame = {
  field: RenderTarget; // the source field ("field" pool RT) — read field.texture
  revealed: RenderTarget; // write your masked/warped result here ("revealedField")
  progress: number; // (clock.now() - revealStartMs) / durationMs — UNCLAMPED, exceeds 1
  fieldSize: Size;
  cssW: number;
  cssH: number;
  now: number;
};
```

Duration comes from `reveal.wave.durationMs` — type `"custom"` has no config block of its own
(`resolveRevealDurationMs` maps it to the wave block), so set
`reveal: { ..., type: "custom", wave: { ...wave, durationMs: N } }`. The stage always runs
(no auto-bypass): at `progress >= 1` keep writing the plain field into `revealed`. If
`type: "custom"` is set without a `customReveal` hook, the engine falls back to the wave pass.

### Pool-key namespace

`pool.get(key, w, h, opts)` auto-creates/resizes one RT per key. Engine-owned keys: `field`,
`fieldColor`, `revealedField`, `maskedField`, `hookField`, `cursorField`, `cursorFieldColor`,
`cursorAccum`, `cursorTear`, `cell`, `cellColor`, `glyphData`, `stripeOut`, `solidOut`,
`postSrc`, `colorDistFull`, `colorMaxReduce<N>`, `assemblyBlur{Quarter,Half,Full,Temp}`. Read
them; never render into them except the RTs a hook frame hands you. For your own sim targets
either create them directly (`createRenderTarget`/`createPingPong`, dispose them in your hook's
`dispose()`) or use pool keys prefixed with your experiment id.

---

## 6. Gotchas (verified, with citations)

- **WebGL2 only, throws otherwise** — `gl/context.ts:24-25`
  (`canvas.getContext("webgl2")`, `throw new Error("WebGL2 is required...")`). All shaders are
  `#version 300 es` (first line of every `src/shaders/*.ts` string, e.g. `reveal.frag.ts:1`).
- **Shader compile/link must throw** — `gl/program.ts:10` (compile) and `:28` (link) throw with
  the full info log. Never swallow these; goldens rely on loud failure.
- **Data textures must be raw typed arrays, never canvas/image uploads** — the context opts into
  `unpackColorSpace = "display-p3"` (`gl/context.ts:31`), which color-converts (corrupts)
  DOM-source uploads used as data. `gl/dataTexture.ts:3` documents the safe path: raw
  `Uint8Array` via `texImage2D(..., bytes)` is exempt from color-space conversion. Index maps,
  LUTs, push maps: always raw buffers. (Image/video sources are color and go through
  `source/sourceTexture.ts` — that's fine.)
- **Stripes are strictly terminal** — `docs/engine-architecture.md:8-9, 31-33`. Draw INTO the
  field; never post-process, relight, or project the stripe pass's output (only the existing
  logoFill/stylize image-space passes sit after it).
- **Browser WebGL context cap (~8-16 live contexts per page; oldest silently lost)** — browser
  fact, not repo code. For a multi-canvas harness: mount an engine when its tile is visible and
  `dispose()` when not (the roster mandates this), or use `<StripesShader>` (shared-only: one
  worker context for all tiles, fixed pipeline). The engine
  survives context loss (`engine.ts:1146-1154` + `rebuildGpuResources` at `:1112`) but drops its
  source (`:1124`) — re-`setSource` after restore.
- **Sticky background cookie: dead, but localStorage is the new sticky state** — the old
  cookie-based sticky background was removed; `loadStickyBackgroundColor` /
  `saveStickyBackgroundColor` / `clearStickyBackgroundColor` are no-op stubs
  (`apps/lab/src/persistence.ts:337-343`). The only remaining cookie touch is
  `factoryResetSettings` deleting the legacy `stripes-engine-lab-last-background-color` cookie
  (`persistence.ts:500`, helper at `:261-264`). However the lab still persists config per texture
  in localStorage (keys at `persistence.ts:16-25`), shared across ALL tabs on the same
  origin:port — a stale lab tab can rewrite them under you. A new experiments page avoids the
  entire mechanism by simply not importing `apps/lab/src/persistence.ts` (the engine itself
  touches no storage).
- **Pointer/cursor wiring is YOUR job** — the engine registers zero input listeners. Replicate
  the lab's canvas-scoped wiring (`LabApp.tsx:1521-1577`): `pointermove` → `setCursor(x, y)`,
  `pointerleave` → `setCursor(null)`, `pointerdown` → `click(x, y)` (+
  `setPointerCapture`/release). Coordinates must be CSS px in the canvas's own coordinate space —
  use `pointerToEnginePoint` (`LabApp.tsx:261-269`), which rescales client coords by
  `styleWidth / rect.width` so a CSS-scaled canvas still maps correctly. DPR is NOT your problem
  (engine handles it). The shared coordinator shows the window-level alternative including a
  scroll re-hit-test (`shared/coordinator.ts`).
- **React StrictMode double-mount** — `apps/lab/src/main.tsx` wraps in `<StrictMode>`; dev
  effects run create→dispose→create. Engine creation in an effect with a proper dispose cleanup
  handles this; don't cache engines outside refs.
- **Reveal appears pre-finished until `triggerReveal()`** — see §3 notes (engine.ts:224, :1286).
- **`pir` arg forwarding** — `pir dev -- --port 5175` passes the `--` literally to vite; write
  `pir dev --port 5175 --strictPort`.
- **Occluded tabs lie about perf** — background/occluded windows throttle rAF (~10Hz); measure
  perf only in a foregrounded tab.
- **Roster's "snake/vortexBits body tech" no longer exists in the tree** — reverted in commit
  `be5c943` (removed vortex/vortexBits directions, meander/snake controls, ~1600 lines). The
  reference implementation is recoverable read-only:
  `git show be5c943^:packages/stripes-engine/src/flames/flamesSim.ts`.

---

## 7. Code conventions

- **TypeScript strict** in both packages (`tsconfig.json`: `"strict": true`, `noEmit`, ES2022,
  `moduleResolution: "Bundler"`, `isolatedModules`). Keep `pir typecheck` green.
- **No code comments** (user rule). Existing code carries rare "why"-only comments; new
  experiment code: none unless explicitly asked.
- **Named exports only** — no default exports anywhere in the repo.
- **Naming**: camelCase module files (`cursorTrailSim.ts`); PascalCase only for React component
  files (`StripesShader.tsx`, `LabApp.tsx`); shader modules `name.frag.ts` / `name.vert.ts`
  exporting UPPER_SNAKE string consts (`REVEAL_FRAG`); factories `createXxx(...)` returning plain
  object interfaces with `dispose()`; pass factories `createXxxPass(gl, quad)` →
  `{ render(...), dispose() }`; config sections follow the `DEFAULT_X` const +
  `normalizeX(partial)` pair pattern in `config/normalize.ts`.
- **File organization**: one concern per module, grouped by domain directory
  (`passes/`, `shaders/`, `cursorTrail/`, …); CPU sim math lives beside its domain, separate from
  its GL pass; tests colocated as `*.test.ts` (vitest, node or happy-dom env).
- **Formatting/linting**: oxfmt (120-col print width, trailing commas — `.oxfmtrc.json`) and
  oxlint correctness rules (`.oxlintrc.json`); pre-commit runs both via lint-staged. Run
  `pir format` before finishing.
- **Determinism**: take a `Clock` and a seeded RNG (`mulberry32`) instead of `performance.now()`
  / `Math.random()` inside sims, matching `flamesSim`/`starsSim` — goldens depend on it.
- **Never** commit `dist/`, publish, or bump versions (release is CI-automated).

---

## 8. Writing an experiment

The experiments harness lives at `/experiments.html` (`apps/lab/experiments.html` →
`apps/lab/src/experiments-main.tsx` → `apps/lab/src/ExperimentsApp.tsx`). It auto-discovers
experiments with `import.meta.glob("./experiments/*.experiment.{ts,tsx}", { eager: true })` and
renders one tile per definition: a 16:10 canvas plus a label bar (title, category chip, blurb,
live/paused state, Replay button when the instance exposes `replay`), with category filter
chips in the header.

### Files and naming

- Your experiment is ONE new file: `apps/lab/src/experiments/<id>.experiment.ts` (or `.tsx`).
- Optional helper files beside it, named `<id>.*.ts` (e.g. `aurora.shaders.ts`,
  `comet.sim.ts`) — anything NOT matching `*.experiment.{ts,tsx}` is ignored by the registry.
- The experiment file must **`export default`** exactly one `ExperimentDefinition`. This is the
  single sanctioned exception to the repo's named-exports-only convention — the registry reads
  `module.default`.

### The contract (`apps/lab/src/experiments/types.ts` — frozen, do not edit)

```ts
export type ExperimentCategory = "trail" | "click" | "reveal" | "ambience" | "stars";

export interface ExperimentContext {
  canvas: HTMLCanvasElement; // fresh canvas, CSS-sized by the harness before create()
  container: HTMLElement; // the tile's media box (the canvas parent)
  textureUrl: string; // always "/textures/cf-base.png" — use it, never hardcode assets
}

export interface ExperimentInstance {
  engine?: StripesEngine; // return it to get harness pointer wiring + resize handling
  replay?: () => void; // exposes a Replay button on the tile
  destroy: () => void; // MUST release everything (see hard rules)
}

export interface ExperimentDefinition {
  id: string; // kebab-case, matches the file name
  title: string;
  category: ExperimentCategory;
  blurb: string; // one sentence, shown on the tile
  pointer?: "default" | "custom"; // omit for "default"
  create: (ctx: ExperimentContext) => ExperimentInstance;
}
```

### What the harness does for you

- **Visibility lifecycle**: `create()` runs only when the tile is near the viewport
  (IntersectionObserver, 320px margin, 500ms leave-linger) and `destroy()` when it leaves; at
  most 8 instances are live at once (least-recently-visible evicted). Expect create/destroy to
  cycle many times per page visit; each `create()` receives a FRESH canvas (the harness loses
  the old canvas's GL context after `destroy()`). React StrictMode double-invokes
  create→destroy→create in dev — both must be clean.
- **Sizing**: before `create()` the harness sets `canvas.style.width/height` in CSS px from the
  container and keeps them in sync (ResizeObserver). If you returned `engine`, it also calls
  `engine.resize(cssW, cssH)` for you (the engine handles DPR itself). If you run your own GL
  instead of an engine, size your backing store yourself:
  `canvas.width = cssW * devicePixelRatio` etc.
- **Pointer wiring** (when `pointer` is not `"custom"` and you returned `engine`):
  canvas-scoped `pointermove` → `engine.setCursor(x, y)`, `pointerleave` →
  `engine.setCursor(null)`, `pointerdown` → `engine.click(x, y)`, with correct canvas-local CSS
  coordinates. With `pointer: "custom"` the harness wires nothing — add your own listeners on
  `ctx.canvas` and remove every one of them in `destroy()`.

### Skeleton 1 — ambience via `hooks.fieldPass` (F-row, and most trail/click looks)

`apps/lab/src/experiments/aurora.experiment.ts` (+ `aurora.shaders.ts` for the GLSL):

```ts
import {
  compileProgram,
  createStripesEngine,
  FULLSCREEN_VERT,
  type EngineHookContext,
  type FieldHookPass,
} from "@necatikcl/stripes-engine";
import type { ExperimentDefinition } from "./types";
import { AURORA_FRAG } from "./aurora.shaders";

function createAuroraPass({ gl, quad }: EngineHookContext): FieldHookPass {
  const program = compileProgram(gl, FULLSCREEN_VERT, AURORA_FRAG);
  const uField = gl.getUniformLocation(program, "uField");
  const uTime = gl.getUniformLocation(program, "uTime");
  const uAspect = gl.getUniformLocation(program, "uAspect");
  return {
    render(frame) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, frame.output.fbo);
      gl.viewport(0, 0, frame.output.width, frame.output.height);
      gl.useProgram(program);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, frame.input.texture);
      gl.uniform1i(uField, 0);
      gl.uniform1f(uTime, frame.elapsed / 1000);
      gl.uniform1f(uAspect, frame.cssW / Math.max(1, frame.cssH));
      quad.draw();
    },
    dispose: () => gl.deleteProgram(program),
  };
}

const definition: ExperimentDefinition = {
  id: "aurora",
  title: "Aurora Curtains",
  category: "ambience",
  blurb: "Layered vertical curtains undulating at different phases.",
  create: (ctx) => {
    const engine = createStripesEngine(ctx.canvas, { hooks: { fieldPass: createAuroraPass } });
    let disposed = false;
    const image = new Image();
    image.onload = () => {
      if (!disposed) engine.setSource(image);
    };
    image.src = ctx.textureUrl;
    engine.start();
    return {
      engine,
      destroy: () => {
        disposed = true;
        engine.dispose();
      },
    };
  },
};

export default definition;
```

The fragment shader MUST composite over the incoming field, e.g.
`float base = texture(uField, vUv).r; outColor = vec4(vec3(max(base, aurora)), 1.0);` —
`output` fully replaces the field for everything downstream.

### Skeleton 2 — custom reveal via `hooks.customReveal` + `triggerReveal`

```ts
import {
  compileProgram,
  createStripesEngine,
  DEFAULT_ENGINE_CONFIG,
  FULLSCREEN_VERT,
  type CustomRevealPass,
  type EngineHookContext,
} from "@necatikcl/stripes-engine";
import type { ExperimentDefinition } from "./types";
import { BURN_FRAG } from "./burn.shaders";

function createBurnPass({ gl, quad }: EngineHookContext): CustomRevealPass {
  const program = compileProgram(gl, FULLSCREEN_VERT, BURN_FRAG);
  const uField = gl.getUniformLocation(program, "uField");
  const uProgress = gl.getUniformLocation(program, "uProgress");
  return {
    render(frame) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, frame.revealed.fbo);
      gl.viewport(0, 0, frame.revealed.width, frame.revealed.height);
      gl.useProgram(program);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, frame.field.texture);
      gl.uniform1i(uField, 0);
      gl.uniform1f(uProgress, Math.min(1, Math.max(0, frame.progress)));
      quad.draw();
    },
    dispose: () => gl.deleteProgram(program),
  };
}

const definition: ExperimentDefinition = {
  id: "burn-away",
  title: "Burn Away",
  category: "reveal",
  blurb: "An ember front eats across the noise field, leaving the image.",
  create: (ctx) => {
    const engine = createStripesEngine(ctx.canvas, { hooks: { customReveal: createBurnPass } });
    engine.setConfig({
      reveal: {
        ...DEFAULT_ENGINE_CONFIG.reveal,
        enabled: true,
        type: "custom",
        wave: { ...DEFAULT_ENGINE_CONFIG.reveal.wave, durationMs: 2200 },
      },
    });
    let disposed = false;
    const image = new Image();
    image.onload = () => {
      if (disposed) return;
      engine.setSource(image);
      engine.triggerReveal();
    };
    image.src = ctx.textureUrl;
    engine.start();
    return {
      engine,
      replay: () => engine.triggerReveal(),
      destroy: () => {
        disposed = true;
        engine.dispose();
      },
    };
  },
};

export default definition;
```

`triggerReveal()` after the source loads is mandatory (§6: a fresh engine reads the reveal as
already finished) — and it is exactly what the Replay button re-fires.

### Skeleton 3 — trail/click via `pointer: "custom"` + own ping-pong sim

Own listeners feed shared state; a `fieldPass` steps a GPU sim built from the exported helpers:

```ts
import {
  compileProgram,
  createPingPong,
  createStripesEngine,
  FULLSCREEN_VERT,
  type EngineHookContext,
  type FieldHookPass,
  type PingPong,
} from "@necatikcl/stripes-engine";
import type { ExperimentDefinition } from "./types";
import { RIPPLE_COMPOSITE_FRAG, RIPPLE_STEP_FRAG } from "./ripple.shaders";

const SIM_SIZE = 256;

const definition: ExperimentDefinition = {
  id: "ripple-wake",
  title: "Ripple Wake",
  category: "trail",
  blurb: "The field behaves like still water disturbed by the cursor.",
  pointer: "custom",
  create: (ctx) => {
    const pointer = { x: -1, y: -1, down: false };
    const toLocal = (e: PointerEvent) => {
      const rect = ctx.canvas.getBoundingClientRect();
      pointer.x = (e.clientX - rect.left) / Math.max(1, rect.width);
      pointer.y = (e.clientY - rect.top) / Math.max(1, rect.height);
    };
    const onMove = (e: PointerEvent) => toLocal(e);
    const onDown = (e: PointerEvent) => {
      toLocal(e);
      pointer.down = true;
    };
    const onUp = () => {
      pointer.down = false;
    };
    const onLeave = () => {
      pointer.x = -1;
      pointer.y = -1;
    };
    ctx.canvas.addEventListener("pointermove", onMove);
    ctx.canvas.addEventListener("pointerdown", onDown);
    ctx.canvas.addEventListener("pointerup", onUp);
    ctx.canvas.addEventListener("pointerleave", onLeave);

    const fieldPass = ({ gl, quad }: EngineHookContext): FieldHookPass => {
      const sim: PingPong = createPingPong(gl, SIM_SIZE, SIM_SIZE, { float: true, linear: true });
      const step = compileProgram(gl, FULLSCREEN_VERT, RIPPLE_STEP_FRAG);
      const composite = compileProgram(gl, FULLSCREEN_VERT, RIPPLE_COMPOSITE_FRAG);
      const uPrev = gl.getUniformLocation(step, "uPrev");
      const uPointer = gl.getUniformLocation(step, "uPointer");
      const uField = gl.getUniformLocation(composite, "uField");
      const uSim = gl.getUniformLocation(composite, "uSim");
      return {
        render(frame) {
          gl.bindFramebuffer(gl.FRAMEBUFFER, sim.write().fbo);
          gl.viewport(0, 0, SIM_SIZE, SIM_SIZE);
          gl.useProgram(step);
          gl.activeTexture(gl.TEXTURE0);
          gl.bindTexture(gl.TEXTURE_2D, sim.read().texture);
          gl.uniform1i(uPrev, 0);
          gl.uniform3f(uPointer, pointer.x, pointer.y, pointer.down ? 1 : 0);
          quad.draw();
          sim.swap();

          gl.bindFramebuffer(gl.FRAMEBUFFER, frame.output.fbo);
          gl.viewport(0, 0, frame.output.width, frame.output.height);
          gl.useProgram(composite);
          gl.activeTexture(gl.TEXTURE0);
          gl.bindTexture(gl.TEXTURE_2D, frame.input.texture);
          gl.uniform1i(uField, 0);
          gl.activeTexture(gl.TEXTURE1);
          gl.bindTexture(gl.TEXTURE_2D, sim.read().texture);
          gl.uniform1i(uSim, 1);
          quad.draw();
        },
        dispose() {
          sim.dispose();
          gl.deleteProgram(step);
          gl.deleteProgram(composite);
        },
      };
    };

    const engine = createStripesEngine(ctx.canvas, { hooks: { fieldPass } });
    let disposed = false;
    const image = new Image();
    image.onload = () => {
      if (!disposed) engine.setSource(image);
    };
    image.src = ctx.textureUrl;
    engine.start();
    return {
      engine,
      destroy: () => {
        disposed = true;
        ctx.canvas.removeEventListener("pointermove", onMove);
        ctx.canvas.removeEventListener("pointerdown", onDown);
        ctx.canvas.removeEventListener("pointerup", onUp);
        ctx.canvas.removeEventListener("pointerleave", onLeave);
        engine.dispose();
      },
    };
  },
};

export default definition;
```

GL resources are created inside the `fieldPass` factory (NOT in `create()`), because the engine
re-invokes the factory after topology rebuilds and context restores; `engine.dispose()` reaches
your hook pass's `dispose()` through the pipeline. Only non-GL things (listeners, timers, rAFs,
image loads) belong at `create()` scope, paired with removal in `destroy()`.

### Hard rules

1. **Touch ONLY your own new files** — `src/experiments/<id>.experiment.ts` plus optional
   `<id>.*.ts` helpers. Never edit the engine, the harness (`ExperimentsApp.tsx`,
   `experiments-main.tsx`, `experiments.css`, `experiments.html`, `vite.config.ts`), the frozen
   `experiments/types.ts`, `baseline.experiment.ts`, or any other agent's files.
2. **Import only** from `@necatikcl/stripes-engine` and `./types` (and your own helpers). Never
   import `../persistence` or any other lab module — this page must stay storage-free.
3. **`destroy()` must fully dispose**: `engine.dispose()`, every listener you added, every rAF
   (`cancelAnimationFrame`), every timer, and a `disposed` guard on async loads. GL resources
   created inside hook factories are disposed via the hook's `dispose()` (reached by
   `engine.dispose()`); GL resources created OUTSIDE hook factories are a bug — see skeleton 3.
4. **Reveal experiments must call `engine.triggerReveal()` after the source loads** (§6), and
   expose `replay: () => engine.triggerReveal()` (or your equivalent restart).
5. **Keep sim resolutions modest** — tiles are ~400-600 CSS px wide; 256² float ping-pongs are
   plenty, and `fieldScale` (engine option) can drop field-pass cost further. Target 60fps for a
   single visible tile.
6. **Engine invariants hold** (§4): field-first (draw black/white content INTO the field via
   `hooks.fieldPass`), stripes stay the terminal look (`hooks.postPass` is screen-space FX over
   the composed output, never re-derived stripes), data textures from raw `Uint8Array` only,
   shader compile failures throw.
7. **Quality bar** (roster): deliberate easing — standard ease `cubicBezier(0.6, 0.6, 0, 1)`
   for discrete moves, organic noise for continuous motion — no popping, readable at tile size.
8. No code comments; no console noise; named exports everywhere except the required
   `export default definition`.
