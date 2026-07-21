# Blackhole reveal — design

New vortex-family reveal type `blackhole`. Requested as "starting from center, in a
vortex shape a blackhole appears and starts to paint" — creative, in-depth, detailed.

## What carries the image

Matter ejected from the singularity. The blackhole forms at center, then flings the
image outward: per-cell ejecta streaks launch from the photon ring along outward
log-spiral paths and land on their grid cells; a spiral-armed paint frontier
(block-fill → refine, as in the vortex reveal) backs the particles so coverage is
continuous. The hole itself never carries image content — it is pure black with a
bright photon ring.

## Timeline (three phases)

Total duration = `formMs + staggerMs + speedMaxMs + collapseMs`
(`resolveRevealDurationMs` gets a `blackhole` branch).

1. **Formation** (`formMs`, default 650 ms) — event horizon grows 0 → resting radius
   with slight overshoot; photon ring ignites; accretion-disk streak particles spin
   up on Keplerian orbits (ω ∝ r^-1.5). Field is still black; only ring + disk glow.
2. **Eruption / paint** (`staggerMs` spread + `speedMinMs..speedMaxMs` flight) —
   cells ordered by aspect-corrected radius with hash jitter plus a rotating
   spiral-arm phase (`arms` arms), so ejections sweep around the hole in vortex arms
   rather than as a plain expanding ring. Each cell's ejecta streak flies
   ring → cell along a log spiral (`swirl` sets total winding), stretched along its
   velocity, brightness = target block value. Arrived blocks fill then refine to
   full-res with a brief arrival flash (`glow`). Painted pixels near the hole sample
   the field through gravitational lensing (`lensing`, bend ∝ (h/(r+h))²) and carry
   a residual angular twist that relaxes after arrival.
3. **Evaporation** (`collapseMs`, default 700 ms) — horizon shrinks to nothing with a
   final flash ring, lensing and twist relax to identity, disk particles fade.
   End state is exactly the unmodified field.

## Config

`BlackholeRevealConfig` = WarpStyleConfig (speedMinMs 300, speedMaxMs 1300,
staggerMs 2400, intensity 1, detail 0.5, glow 0.7) plus:

- `formMs` 650, `collapseMs` 700 — phase durations
- `swirl` 1.2 (0..3) — ejecta winding + painted-region twist
- `arms` 3 (1..8) — spiral arm count for ejection phasing and frontier shape
- `lensing` 1 (0..2) — UV bending strength near the horizon
- `horizon` 0.12 (0.02..0.3) — resting horizon radius, aspect-normalized

`detail` maps to the paint grid exactly like vortex: `gridX = 280 + 280·detail`.

## Architecture

Mirrors `vortexPass`: `passes/blackholePass.ts` with two programs sharing one
render call into `revealedField`:

- **Core frag** (`shaders/blackholeCore.frag.ts`, fullscreen): per-pixel paint mask
  (cell-quantized 3-lane fill → refine, vortexCore style), twist + lensing UV warp of
  painted content, horizon disc, photon ring, arrival/final flashes. Skips all work
  and passes the field through once progress ≥ 1.
- **Particles** (`shaders/blackholeParticles.vert/.frag.ts`, instanced quads,
  MAX blend): one draw, roles split by instance id — first `DISK_COUNT` instances
  are accretion-disk orbiters, the rest are 1-per-cell ejecta streaks. Ejecta reuse
  the vortex stretch-along-velocity treatment.

Engine dispatch: new `config.reveal.type === "blackhole"` branch beside the vortex
branch; `revealPassKind` gains `"blackhole"`.

## Plumbing checklist

- `config/types.ts` — RevealType union, `BlackholeRevealConfig`, `RevealConfig.blackhole`
- `config/normalize.ts` — REVEAL_TYPES, DEFAULT_REVEAL.blackhole, PartialReveal,
  normalize block (clamped like the vortex block)
- `reveal/revealMath.ts` — duration branch
- `engine.ts` — pass branch + revealPassKind
- lab `levaSchema.ts` — Blackhole select option, per-knob controls
  (`render:` gated on type === "blackhole"), values → config mapping
- lab `defaultLabConfig.ts` if it enumerates reveal blocks

## Stretch (only after blackhole is verified in-browser)

`whirlpool`: image appears fully wound into a spiral smear (twist ∝ (1-p)² with
1/(r+h) falloff, arc-tap motion blur) and unwinds into place. Single fullscreen frag,
`durationMs`-only timing. Skipped if blackhole iteration consumes the session.
