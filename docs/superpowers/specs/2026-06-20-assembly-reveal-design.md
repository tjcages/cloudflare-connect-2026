# Assembly reveal (fly-in) — design

Date: 2026-06-20

## Summary

Add a second reveal type, `assembly`, alongside the existing `wave`. When enabled,
the stripe texture materializes as a swarm of glowing circles that fly in from
off-canvas; each circle arrives at one grid cell and that cell's stripe crystallizes
out of the landed glow ("energy assembly"). Only the **fly-in per cell** model from
the prototype is shipped (one circle ↔ one cell; circles travel straight to their
target and crystallize on arrival — no mid-air pooling, no region seeding).

The visual was prototyped and approved in an interactive widget. This spec ports that
look into the real render pipeline.

## Mental model

The effect is two cooperating pieces — the same split confirmed during brainstorming:

1. **Per-cell reveal timing field** — for every grid cell, _when_ its stripe ramps
   in. This rides the existing GPU reveal mask (the grid is built once; only uniforms
   animate). Fly-in's defining property: a cell's reveal start time **equals** its
   circle's arrival time.
2. **Glow-particle overlay** — the flying circles themselves: a separate additive
   Pixi layer composited above the filtered stripe sprite, driven by the same reveal
   progress. The shader cannot draw this because the energy is in transit _off_ the
   cell's grid position; an overlay can.

## Decisions (locked during brainstorming)

- **Merge model:** fly-in per cell only.
- **Render approach:** existing per-cell reveal mask (for the stripes) + a new
  glow-particle overlay (for the circles), mirroring how `flames` / `cursor-trail`
  overlays already compose on `app.stage`.
- **Glow color:** plain **white** additive light. The stripe materializing underneath
  supplies the color — no palette tinting, no glow-color config.
- **Reduced motion:** no special-casing. Assembly behaves like `wave`, which is opt-in
  and not gated on `prefers-reduced-motion`.

## Defaults

From the values that read well in the prototype:

| Field        | Default   |
| ------------ | --------- |
| `order`      | `center`  |
| `from`       | `scatter` |
| `durationMs` | `2600`    |
| `spread`     | `0.85`    |
| `glowSize`   | `34`      |
| `flight`     | `0.22`    |
| `overshoot`  | `false`   |

## Components

### 1. Config — `playgroundRevealConfig.ts`

Add a discriminator and the assembly sub-config:

```ts
export type PlaygroundRevealType = "wave" | "assembly";

export type PlaygroundAssemblyRevealOrder = "center" | "edges" | "sweep" | "random";
export type PlaygroundAssemblyRevealFrom = "scatter" | "radial" | "edge";

export type PlaygroundAssemblyRevealConfig = {
  order: PlaygroundAssemblyRevealOrder;
  from: PlaygroundAssemblyRevealFrom;
  durationMs: number;
  spread: number; // 0..1 stagger
  glowSize: number; // glow sprite radius scale (display px-ish)
  flight: number; // 0..1: each circle's travel as a fraction of the timeline
  overshoot: boolean;
};

export type PlaygroundRevealConfig = {
  enabled: boolean;
  type: PlaygroundRevealType;
  wave: PlaygroundWaveRevealConfig;
  assembly: PlaygroundAssemblyRevealConfig;
};
```

- `DEFAULT_PLAYGROUND_REVEAL_CONFIG` gains `type: "wave"` and a default `assembly`.
- `normalizePlaygroundRevealConfig`:
  - Legacy compat: input with no `type` → `"wave"`. Input with no `assembly` →
    defaults. (Existing saved configs and the published API keep working unchanged.)
  - Clamp/validate every assembly field (`spread` 0..1, `flight` ~0.05..0.6,
    `glowSize` bounded, `durationMs` reuses the 100..30000 range, `order`/`from`
    validated against allow-sets, `overshoot` strict bool).
- `resolvePlaygroundRevealDurationMs` branches: `assembly` → `assembly.durationMs`,
  else `wave.durationMs`.
- Overshoot helper (`resolveRevealOvershoot`) gains an assembly branch. Fly-in finishes
  by progress 1 by construction; the small band-ramp tail is the only overshoot, so the
  assembly overshoot is just the band ramp (no waviness term).
- `isDefaultPlaygroundRevealConfig` extended to compare `type` + assembly fields.

### 2. Per-cell timing — GPU (`stripeFilterShaders.ts`, `stripeDuotoneFilter.ts`)

- Add `uRevealMode = 2` branch in the fragment shader's reveal block.
- Compute each cell's `orderNorm` (0..1) from `uRevealOrder`:
  - `center` (0): normalized distance from cell to grid center.
  - `edges` (1): `1 - center` distance.
  - `sweep` (2): cell column fraction (x along grid).
  - `random` (3): `revealCellNoise(col, row, scale)` (hash already in the shader).
  - Shared timing (identical to the overlay, §4): `emitterStart = orderNorm * (1 - flight) * spread`;
    the circle arrives at `arrival = emitterStart + flight`, which is exactly when the
    cell's stripe begins to materialize. So
    `revealMask = smoothstep(arrival, arrival + uRevealBandRamp, uRevealProgress)`.
  - With `orderNorm` max = 1 and `spread` = 1 the last cell finishes at `1 + bandRamp`,
    matching the small band-ramp overshoot tail (component 1).
- New uniforms: `uRevealOrder` (f32 enum), `uRevealSpread` (f32), `uRevealFlight` (f32).
  Declared in `stripeDuotoneFilter.ts` uniform block with safe defaults.
- `filter.syncReveal(config, progress)` branches on `config.type`: existing wave path
  unchanged; assembly path sets `uRevealMode = 2` + the new uniforms.

### 3. Per-cell timing — CPU mirror (`playgroundReveal.ts`)

- `assemblyRevealAmountAtCell(col, row, cols, rows, progress, assembly, bandRamp)`
  mirroring the GPU `startTime`/`smoothstep` math exactly (same hash recipe as
  `cellNoise`), so the CPU letters mask agrees with the GPU stripe mask.
- The letters branch in `setupTextureShaderScene.ts` picks `waveRevealAmountAtCell`
  vs `assemblyRevealAmountAtCell` by `revealConfig.type`.

### 4. Glow overlay — new `assemblyGlowOverlay.ts`

Modeled on `PlaygroundFlamesOverlay` (constructor, `sync`, `resize`, `destroy`,
exposes a Pixi display object).

- A `Container` of additive-blend (`"add"`) `Sprite`s, each drawing a shared
  pre-rendered **white** radial-gradient glow texture.
- `sync(progress, assembly, grid, display)` positions/scales/fades each emitter:
  - One emitter per content cell (cell whose stored band > 0). **Capped at ~800**
    emitters; if the content-cell count exceeds the cap, subsample deterministically
    and `log`/comment the cap so coverage isn't silently dropped.
  - Per emitter, deterministic spawn point from cell index + `from` mode (scatter =
    random angle/radius off-canvas; radial = along the cell's outward ray; edge =
    nearest border). Same hash recipe as the prototype.
  - Timeline per emitter: `start = orderNorm * (1 - flight) * spread`; in flight
    (`progress` in `[start, start+flight]`) the sprite lerps spawn→cell with
    ease-out (ease-out-back if `overshoot`), alpha ramps up; after arrival it flashes
    then fades over a short settle window. Hidden outside its active window.
  - Sprite **pool reused** across frames (no per-frame allocation).
- Rebuilt when grid dimensions / `from` / `order` / cap change; per-frame work is just
  transform + alpha updates.
- Added to `app.stage` **above** the filtered sprite. Container `visible = false`
  when the reveal is disabled or finished (`progress >= 1 + overshoot`).

### 5. Scene wiring (`setupTextureShaderScene.ts`)

- Construct `assemblyGlowOverlay`; add its container to the stage; `destroy()` on
  teardown; `resize()` alongside the other overlays.
- In the render loop where `syncReveal` is called:
  - `type === "assembly"` && reveal animating → assembly `syncReveal` branch +
    `assemblyGlowOverlay.sync(revealProgressRaw, ...)` + container visible.
  - otherwise → container hidden; wave path unchanged.
- Letters CPU mirror branches on `type` (component 3).

### 6. Studio UI (`playgroundLevaSchema.ts`, `playgroundControlRanges.ts`, `playgroundFieldHelp.ts`)

- Add a `revealType` select (Wave / Assembly) in the Reveal folder.
- Show wave fields when `type === "wave"`, assembly fields when `type === "assembly"`
  (order, from, duration, spread, glow size, overshoot) via the existing
  disabled/visibility mechanism.
- New control ranges + field-help entries for the assembly fields.
- Live/commit handlers: `onRevealAssemblyLive` / `onRevealAssemblyCommit` mirroring the
  existing `onRevealWaveLive/Commit`.
- Persistence is automatic via `normalizePlaygroundRevealConfig`.

### 7. Public package (`StripesShaderConfig.ts`, `public.ts`, `StripesShader.tsx`)

- Surface `reveal.type` + `reveal.assembly` in the public config type and pass them
  through to the scene exactly like `reveal.wave`. The installable `<StripesShader>`
  then ships the assembly reveal too. Public defaults match the table above; omitting
  `type`/`assembly` yields wave (back-compat).

### 8. Tests

- `playgroundRevealConfig.test.ts`: assembly normalization, **legacy `type`-less input
  → wave**, missing-`assembly` → defaults, per-field clamps, `isDefault` with the new
  fields, `resolvePlaygroundRevealDurationMs` branching.
- `playgroundReveal.test.ts`: `assemblyRevealAmountAtCell` is monotonic non-decreasing
  in progress, respects each `order` (e.g. center cell reveals before an edge cell for
  `order: "center"`), and every cell reaches mask 1 by progress 1 (+ band-ramp tail).
- Keep existing wave reveal tests green.
- (Optional, if cheap) a focused overlay-timing unit check: an emitter's alpha is ~0
  before its `start`, peaks near arrival, and is hidden after settle.

## Out of scope (YAGNI)

- The "pool then crystallize" and "few big motes seed regions" models (prototype only).
- Glow color tinting / configurable glow color.
- Reduced-motion variants.
- Per-cell flight trails/streaks.

## File touch list

Package (`packages/stripes-shader/src`): `playgroundRevealConfig.ts`,
`playgroundReveal.ts`, `stripeFilterShaders.ts`, `stripeDuotoneFilter.ts`,
`setupTextureShaderScene.ts`, new `assemblyGlowOverlay.ts`, `StripesShaderConfig.ts`,
`public.ts`, `StripesShader.tsx`, plus the two test files.

Studio (`apps/studio/src/playground`): `playgroundLevaSchema.ts`,
`playgroundControlRanges.ts`, `playgroundFieldHelp.ts` (and persistence flows pick up
new fields automatically).
