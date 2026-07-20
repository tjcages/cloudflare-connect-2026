# Vortex flame variants, config persistence restore, hadouken → vortex rename

Date: 2026-07-20
Status: approved

Three independent workstreams bundled because part 3 (the rename) is only safe once
part 2 (persistence) exists, and both touch `normalize.ts`.

---

## Part 1 — Vortex flame variants

### Current state

Background flames live at `config.flames` (root level, not under `background` — an
existing asymmetry with `background.stars`, left alone here). `flames/flamesSim.ts`
spawns axis-aligned rectangles off one edge and translates them linearly at
`baseSpeedPxPerSec`. No noise, no rotation, no curl. `passes/flamesPass.ts` renders
them as instanced quads (corners from `gl_VertexID`, no vertex buffer) into the
luminance field via `createParticleFieldPass`, before the reveal pass. The fragment
shader is a soft-edged bar: the gradient always runs across the short axis, selected
by the global `uVertical` uniform.

### Config

```ts
export type FlamesDirection = "up" | "down" | "left" | "right" | "upDown" | "leftRight" | "vortex" | "vortexBits";

export interface FlamesConfig {
  // ...existing fields unchanged...
  inward: boolean; // vortex only: false = center → edges, true = edges → center
  swirlRate: number; // rad/sec angular velocity
}
```

Defaults in `DEFAULT_FLAMES`: `inward: false`, `swirlRate: 1.2`.
Clamp: `swirlRate` to `[0, 6]`. `inward` via the existing boolean coercion helper.

Every existing knob keeps its meaning for both new variants:
`baseSpeedPxPerSec`, `speedVariation`, `spawnIntervalMs`, `spawnJitterMs`,
`maxActive`, `minWidthRatio`/`maxWidthRatio`, `minHeightRatio`/`maxHeightRatio`,
`opacityMin`/`opacityMax`, `edgeSharpness`.

### `vortex` motion

Archimedean spiral in polar space about the canvas center. Per particle, state adds
`pivotX`, `pivotY` (the center), `radius`, `angle`, and a per-particle
`angVel = swirlRate * (1 + (rnd - 0.5) * speedVariation)`.

Per step:

```
radialVel = radialSign * speedPxPerSec
radius += radialVel * dtSec
angle  += angVel * dtSec
x = pivotX + cos(angle) * radius
y = pivotY + sin(angle) * radius
rot = angle + atan2(radius * angVel, radialVel)
```

Constant radial speed with constant angular rate gives coils that are tight near the
core and open out toward the rim — the reference look. `rot` is the exact tangent of
the spiral: velocity decomposes into `radialVel` along the radial unit vector and
`radius * angVel` along the tangential one, so `atan2` of those two components is the
path angle relative to `angle`. Near the core the tangential term vanishes and bars
point radially; further out they lie increasingly along the orbit. The bar's long axis
follows travel and the soft gradient still runs across the short axis, reading as a
curved motion streak. `angVel` carries the per-particle sign for `inward` mode so the
tangent stays correct in both directions.

- **Outward** (`inward: false`, `radialSign = +1`): spawn at the center with a random
  `angle` and a small seed radius (`~2–8px`, randomized so births don't stack on one
  point). Death is the existing `isFlameVisible` off-screen filter, which already
  handles arbitrary positions — but it must be extended to account for the rotated
  bounding box (a rotated bar's screen extent is larger than `w × h`); use the
  circumscribed radius `0.5 * hypot(w, h)` as the cull margin.
- **Inward** (`inward: true`, `radialSign = -1`): spawn at a random angle with
  `radius = rMax * (1 + small jitter)` where `rMax = 0.5 * hypot(canvasW, canvasH)`,
  i.e. just off the rim. Death when `radius < 4`.

Rect geometry: `w = length` (from the width-ratio pair), `h = thickness` (from the
height-ratio pair), and the pass reports `vertical: false` so the shader's `vCross`
picks `corner.y` — the short axis. `seedFlames` pre-populates `maxActive` particles at
random radii along the spiral so there is no empty ramp-in, matching current behavior.

### `vortexBits` motion

Independent micro-swirls scattered across the canvas. No convergence, no drift.

Per particle: a random `pivotX`/`pivotY` anywhere in the canvas, a random start
`angle`, a random spin sign, and `bornMs`/`lifeMs` (lifetime `lerp(600, 1800, rnd)`,
mirroring the `starsSim` lifecycle pattern).

The bar's own `w`/`h` come from the width- and height-ratio pairs exactly as in the
linear directions. The orbit `radius` is then derived from the bar itself —
`radius = w` — so the swirl scale tracks particle size and the size knobs stay the
single control for how big a bit reads. A bit therefore traces a circle roughly twice
its own length across.

Per step: `angle += spinSign * angVel * dtSec`, position from pivot + polar offset,
`rot` = tangent as above. Opacity is the configured opacity multiplied by an envelope
`smoothstep(0, 0.25, t) * (1 - smoothstep(0.65, 1, t))` where `t = age / lifeMs`, so
each bit fades in, sweeps a partial turn, and vanishes. Death when `t >= 1`.

`baseSpeedPxPerSec` is unused by this variant (motion is purely angular); `swirlRate`
alone controls how far each bit sweeps in its life. First-step backfill randomizes
`bornMs` across the lifetime range so the population is desynced from frame one, as
`starsSim` does.

### Shader change

One new instance attribute `aRot` (float, `vertexAttribDivisor(attr, 1)`) added to
both the luminance and color programs in `flamesPass.ts`, extending the packed
`Float32Array` stride from 5 to 6 floats (lum) and 8 to 9 (color). In the vertex
shader the `gl_VertexID`-derived corner offset is rotated by `aRot` before being added
to the rect center.

The six linear directions pass `rot = 0` and keep `uVertical` semantics unchanged, so
their output is bit-identical to today. This is the only GPU-side change; the fragment
shader, `particleFieldPass`, and pass ordering are untouched.

### Engine wiring

`config.flames.direction` joins the `setConfig` pass-rebuild condition list alongside
the existing `cursorTrail.type` precedent, because switching between the linear and
vortex families changes what the particle pool means and requires a state reset. All
other flame parameters continue to be read live inside `step()` with no rebuild.

`expandFlamesDirection` returns `["vortex"]` / `["vortexBits"]` unchanged for the new
values (they are not multi-axis like `upDown`).

### Lab controls

`levaSchema.ts`, `Background Flames` folder. The direction dropdown gains
`Vortex: "vortex"` and `"Vortex Bits": "vortexBits"`. Two new controls:

- `flamesInward` — boolean, label "Inward", renders when
  `get("Background Flames.flamesDirection") === "vortex"`
- `flamesSwirlRate` — `{min: 0, max: 6, step: 0.05}`, label "Swirl", renders when
  direction is `"vortex"` or `"vortexBits"`

Both follow the folder's existing strict-equality render-predicate style. Adding new
leva keys requires a full page reload to register (HMR will not add them) — a known
gotcha, not a bug.

---

## Part 2 — Restore engine-config persistence

Commit `29ea2c6` disabled config persistence entirely: `loadInitialConfig()` calls
`clearPersistedEngineConfig()` on every boot, actively deleting
`stripes-engine-lab-last-config`, `-by-texture`, and `-last-background-color`. Nothing
in `LabApp` writes engine config to `localStorage` at all.

Restore:

- Reinstate `loadConfigMap()`, `loadLastConfig()`, `saveLastConfig()`,
  `saveConfig(textureId, config)`, and `deleteConfig(textureId)` in
  `apps/lab/src/persistence.ts`.
- Drop the `clearPersistedEngineConfig()` call from `loadInitialConfig()`. Resolution
  order becomes: `readPendingConfig()` (one-shot sessionStorage stage, highest
  priority — preset apply, import, texture upload) → per-texture map → `LAST_KEY` →
  `DEFAULT_LAB_ENGINE_CONFIG`.
- Add a `saveConfig` call from `LabApp`'s config-change effect.
- `persistenceWritesEnabled` still gates all writes, so `factoryResetSettings()`
  continues to latch writes off until reload.

Two deliberate deviations from the pre-`29ea2c6` behavior, because they caused the
original problems:

1. **Sticky background stays dead.** `loadStickyBackgroundColor` /
   `saveStickyBackgroundColor` / `clearStickyBackgroundColor` remain no-op stubs, and
   the cookie / `window.name` / `?bg=` channels stay neutered. Those channels are
   shared across every localhost tab _and port_, which let a stale tab re-poison
   resets every frame. Background color persists as an ordinary field inside the
   config blob written to `localStorage`, nothing more.
2. **`factoryDefaults.json` remains the fallback**, so a cleared or absent store still
   boots the user's tuned grade rather than the near-white untuned defaults.

`persistence.test.ts` regains coverage for the restored read/write paths, including
the precedence order above and the `persistenceWritesEnabled` latch.

---

## Part 3 — `hadouken` → `vortex` reveal rename

### Migration (must land with the rename, not after)

`normalizeReveal` currently resolves the type as
`REVEAL_TYPES.includes(type) ? type : DEFAULT_REVEAL.type`. There is no legacy-name
alias, so the moment `"hadouken"` leaves `REVEAL_TYPES` any stored config carrying it
silently degrades to `"assembly"` — and Part 2 makes the lab read exactly such a
stored config on the next boot. Required:

```ts
if (type === "hadouken") type = "vortex";
// block resolution:
vortex: normalizeVortexBlock(i.vortex ?? i.hadouken ?? a.vortex ?? a.hadouken, DEFAULT_REVEAL.vortex);
```

The same alias goes into `legacy/migrateLegacyConfig.ts`. Exported preset `.json`
files and `stripes-engine-lab-presets` flow through `normalizeReveal`, so they are
covered by it too.

### Rename surface

| Kind              | From                                                                       | To                     |
| ----------------- | -------------------------------------------------------------------------- | ---------------------- |
| Type union member | `"hadouken"`                                                               | `"vortex"`             |
| Interface         | `HadoukenRevealConfig`                                                     | `VortexRevealConfig`   |
| Config key        | `reveal.hadouken`                                                          | `reveal.vortex`        |
| Normalizer        | `normalizeHadoukenBlock`                                                   | `normalizeVortexBlock` |
| Pass factory      | `createHadoukenPass`                                                       | `createVortexPass`     |
| Uniforms type     | `HadoukenUniforms`                                                         | `VortexUniforms`       |
| Shader consts     | `HADOUKEN_CORE_FRAG`, `HADOUKEN_PARTICLES_VERT`, `HADOUKEN_PARTICLES_FRAG` | `VORTEX_*`             |
| Stage name        | `"hadoukenField"`                                                          | `"vortexField"`        |
| Leva keys         | `revealHad*`                                                               | `revealVor*`           |
| Leva option       | `Hadouken: "hadouken"`                                                     | `Vortex: "vortex"`     |

File renames (`git mv`, so history follows):

- `passes/hadoukenPass.ts` → `passes/vortexPass.ts`
- `shaders/hadoukenCore.frag.ts` → `shaders/vortexCore.frag.ts`
- `shaders/hadoukenParticles.vert.ts` → `shaders/vortexParticles.vert.ts`
- `shaders/hadoukenParticles.frag.ts` → `shaders/vortexParticles.frag.ts`

Also updated: `apps/lab/src/defaultLabConfig.ts`, `apps/lab/src/factoryDefaults.json`
(rekey the block **and** add the missing `swirl: 1` so it matches
`defaultLabConfig.ts`), `apps/lab/src/connectShader/underlayIntro.ts` and its test,
and the engine/lab test suites.

Docs under `docs/superpowers/` keep the historical name — they are a record of what
happened, not live configuration.

### Naming collision

The result is `Reveal → Vortex` and `Background Flames → Vortex` as unrelated options
in different folders. Different namespaces, no technical conflict; accepted.

---

## Invariants

- The six existing flame directions render bit-identically after the `aRot` change.
- Reveal invariants unchanged: black at progress 0, exact field at rest, no spring or
  overshoot easing, settled-state early-out.
- No `pow()` with a possibly-negative base; no `clamp()` on an order/timing formula.
- Unit tests never compile GLSL. After any shader change, live-load the lab and cycle
  every reveal type and every flame direction in the browser before calling it done.
