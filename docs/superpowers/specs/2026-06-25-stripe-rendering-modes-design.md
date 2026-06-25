# Stripe rendering modes — design

Date: 2026-06-25
Status: approved (pending spec review)
Scope: `packages/stripes-engine` + `apps/lab` controls

## Summary

Add a configurable **render mode** that restyles the final stripes. `sharp` is
the default and is exactly today's output. Every other mode is a stylized,
hand-drawn / material / screen / etc. treatment of the rendered stripes.

The feature is implemented as a single **screen-space post-process pass** ("stylize")
that runs after the existing stripe pass, reads the rendered stripe image as a
texture, and rewrites it. The field/grid/stripe pipeline is untouched — this is
strictly a terminal post-process on the stripe output ("affects stripes only").

All modes animate by default (subtle, driven by `uTime`).

## Goals

- One config field selects the active look; `sharp` is the default.
- A single global `renderIntensity` (0–1) dials any mode's strength.
- Zero added cost when `renderMode === "sharp"` (pipeline unchanged).
- Modes are individually small, composable, and easy to add to later.
- All modes get motion via a time uniform.
- Lab app can flip through every mode live.

## Non-goals

- No change to how the black/white field, grid, or stripe bands are computed.
- No per-mode config UI beyond the single intensity dial (v1). Per-mode knobs
  can come later — each mode ships with tuned constants.
- Not aiming for pixel-identical reproduction of the SVG mockups; the mockups
  are the visual target and each GLSL mode is tuned against its mockup.

## The modes (17)

`sharp` (default, passthrough) plus 16 stylized modes, grouped by the primitives
they share. The SVG mockups produced during brainstorming are the reference for
each.

- **Painterly / drawn** — `abstract`, `watercolor`, `charcoal`, `pencil`, `brush`
- **Print / repro** — `halftone`, `risograph`, `stainedGlass`, `paperCutout`
- **Screen / digital** — `crt`, `glitch`, `vhs`, `plasma`, `amber`
- **Material / sweets** — `gummy`, `caramel`

Reference look notes (from mockups):

| Mode           | Primitives                                            |
| -------------- | ----------------------------------------------------- |
| `abstract`     | domain-warp (fbm) + soft edge + grain                 |
| `watercolor`   | large warp + heavier blur + light grain               |
| `charcoal`     | rough warp + heavy grain                              |
| `pencil`       | warp + directional hatch + multiply                   |
| `brush`        | directional (stretched) warp + streak grain           |
| `halftone`     | screen-space dot mask over color                      |
| `risograph`    | 2 offset, multiplied, warped color layers             |
| `stainedGlass` | warp + procedural grout grid                          |
| `paperCutout`  | small rough warp + hard offset drop-shadow            |
| `crt`          | scanlines + R/B channel split + slight blur           |
| `glitch`       | blocky horizontal slip + channel split                |
| `vhs`          | horizontal tracking jitter + chroma bleed + scanlines |
| `plasma`       | fbm → rainbow LUT, multiplied with stripe luma        |
| `amber`        | luminance → amber phosphor + bloom + scanlines        |
| `gummy`        | rounded-cell mask + gloss highlight + saturate        |
| `caramel`      | vertical smear warp + glossy amber sheen              |

## Config

Add to `EngineConfig` (`packages/stripes-engine/src/config/types.ts`):

```ts
export type RenderMode =
  | "sharp"
  | "abstract"
  | "watercolor"
  | "charcoal"
  | "pencil"
  | "brush"
  | "halftone"
  | "risograph"
  | "stainedGlass"
  | "paperCutout"
  | "crt"
  | "glitch"
  | "vhs"
  | "plasma"
  | "amber"
  | "gummy"
  | "caramel";

// new fields on EngineConfig:
renderMode: RenderMode; // default "sharp"
renderIntensity: number; // 0..1, default 1
```

`normalize.ts` clamps `renderIntensity` to `[0,1]` and falls back to `"sharp"`
for an unknown `renderMode`. `index.ts` exports `RenderMode`.

## Pipeline integration

Files: `packages/stripes-engine/src/engine.ts`,
`packages/stripes-engine/src/passes/stripePass.ts` (small change),
`packages/stripes-engine/src/passes/stylizePass.ts` (new),
`packages/stripes-engine/src/shaders/stylize/*` (new).

Current state: the stripe pass binds the canvas (`framebuffer = null`) and draws
directly. We make the stripe target configurable.

1. **stripePass.render** gains a `target: RenderTarget | null` parameter (null =
   canvas, today's behavior). No other change to its uniforms/logic.

2. **buildPasses()** in engine.ts:
   - `renderMode === "sharp"` → unchanged. Stripe draws to canvas (`null`).
   - otherwise → stripe draws into `pool.get("stripeOut", output.width,
output.height, { linear: true })`, then a stylize pass reads `stripeOut`
     and draws to canvas.

3. **Toggle plumbing** (mirror the `edgeMask` pattern):
   - `let lastRenderMode = config.renderMode;`
   - In `setConfig`, rebuild passes when `config.renderMode !== lastRenderMode`
     crosses the sharp/non-sharp boundary **or** changes between two non-sharp
     modes (the stylize pass swaps program by mode — see below — so a rebuild is
     not strictly required for mode-to-mode, but rebuilding keeps the wiring
     simple and is cheap). `renderIntensity` changes do **not** rebuild — they
     flow as a uniform each frame.
   - `applySizes()` allocates `pool.get("stripeOut", output.width,
output.height, { linear: true })` when `renderMode !== "sharp"`.

4. The stylize pass appears in the pass array right after `stripe`, so it shows
   up in GPU-timer snapshots automatically.

## Stylize pass + mode registry

`createStylizePass(gl, quad)` mirrors `createEdgeMaskPass` but holds a **registry**
of mode → lazily-compiled program:

- A shared GLSL **helper library** (string fragments) provides: `hash`,
  `valueNoise`, `fbm`, `domainWarp`, `grain`, `blur5` (small tap blur),
  `halftoneDot`, `edgeDetect`, `channelSplit`, `colorMatrix`, `scanlines`, and
  pattern helpers (grout, hatch, rounded-cell mask). Built on the existing
  `hash` already in the codebase (`colorAdjust.glsl.ts`, `stripe.frag.ts`).
- Each mode is a small fragment shader file that includes the helpers and
  implements `main()` reading `uTex` (the `stripeOut` texture), `uTime`,
  `uIntensity`, `uResolution`, `uDpr`.
- `render(target, srcTex, { mode, time, intensity, resolution, dpr })`:
  - Look up / lazily `compileProgram` the active mode's program; cache it in a
    `Map<RenderMode, Program>`. Only the active mode is ever compiled.
  - Bind program, set uniforms, bind `srcTex` to unit 0, `quad.draw()`.
- `dispose()` deletes all cached programs.

Rationale for a registry over one uber-shader: 16 modes in one `switch` is a
large, hard-to-maintain shader with every branch always compiled. Per-mode
programs keep each look small and isolated, compile only what's used, and make
"add another mode" a one-file change. Program switches on mode change are cheap
and lazy.

### Uniforms (all modes)

| uniform       | meaning                                              |
| ------------- | ---------------------------------------------------- |
| `uTex`        | rendered stripe image (`stripeOut`)                  |
| `uTime`       | seconds, for animation                               |
| `uIntensity`  | `renderIntensity`, scales the effect (0 = ~sharp)    |
| `uResolution` | output px size, for pixel-space patterns/grain       |
| `uDpr`        | device pixel ratio, to keep pattern scale DPI-stable |

### Animation

Every mode animates subtly via `uTime`:

- warp-based modes (`abstract`, `watercolor`, `charcoal`, `brush`, `stainedGlass`,
  `caramel`, `gummy`, `plasma`) drift their noise sample over time;
- `vhs`/`glitch` jitter tracking/slip;
- `crt`/`amber` roll scanlines slowly;
- `halftone`/`pencil`/`risograph`/`paperCutout` get a gentle low-amplitude
  shimmer so they're alive but not distracting.

`uIntensity` scales animation amplitude along with the static effect, so
`renderIntensity = 0` collapses any mode back toward the sharp image.

## Lab UI

`apps/lab/src/controls/levaSchema.ts`:

- `renderMode` — a Leva dropdown listing all 17 modes (labels in friendly case).
- `renderIntensity` — a 0–1 slider (step 0.01), default 1.

Wire both into the existing config-update path the lab already uses for engine
config so changes apply live.

## Build phases

Each phase ends with an in-browser check in the lab (the user's running dev
server on the canonical port) before starting the next.

- **P1 — Framework + Sharp + Abstract.** Config fields + normalize/export;
  stripe→RT redirect; stylize pass + helper lib + registry; `abstract` mode;
  Leva dropdown + intensity. Verifies the entire spine end-to-end.
- **P2 — Painterly/print.** `watercolor`, `charcoal`, `pencil`, `brush`,
  `halftone`, `risograph`, `stainedGlass`, `paperCutout`.
- **P3 — Screen/digital.** `crt`, `glitch`, `vhs`, `plasma`, `amber`.
- **P4 — Sweets.** `gummy`, `caramel`.

## Testing & verification

- `normalize.test.ts`: add cases for `renderMode` default/fallback and
  `renderIntensity` clamping.
- Build gate: `pir build` / typecheck for the engine package must pass (the repo
  already typechecks before deploy).
- Visual verification per phase in the lab: select each new mode, confirm it
  reads like its mockup and that `renderIntensity` dials it from sharp→full.
  Sharp must be byte-for-byte the current pipeline (no stylize pass present).

## Risks / notes

- **Blur fidelity.** SVG `feGaussianBlur` becomes a small multi-tap blur in GLSL;
  watercolor/frost-like softness will be approximate. Acceptable; tune in lab.
- **Mask/pattern alignment.** Halftone/gummy/grout patterns are pixel-space; use
  `uResolution`/`uDpr` so they stay stable across resize and DPR.
- **Edge-detect modes** (none in the final 17 except implicitly) — not required;
  noted only because the helper lib includes `edgeDetect` for future modes.
- **Mode-to-mode rebuild.** Rebuilding passes on every mode change is simple but
  slightly heavier than swapping the program in-place; if it ever matters, the
  stylize pass already caches programs and could be switched without a rebuild.

```

```
