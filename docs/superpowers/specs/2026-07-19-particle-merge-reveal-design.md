# Particle merge reveal (supersedes energetic-merge styles)

Date: 2026-07-19
Status: approved
Supersedes: 2026-07-19-energetic-merge-reveal-design.md (streaks/implosion/chargeup/shards
all rejected by the user and are removed by this design)

## Problem

The four block/mass-based merge styles read as mechanical and spring-like. The user wants
particles coming together and merging to BECOME the texture, with natural motion — smooth
deceleration, organic curved paths, staggered arrivals; no overshoot, no spring damping.

## Solution overview

One new style replaces the four: `reveal.assembly.style: "scatter" | "particles"`.
`"scatter"` remains the untouched default. `"particles"` is a nebula condense: thousands
of tiny glowing instanced quads start scattered across and slightly beyond the canvas,
drift inward on gently curved paths, shrink/sharpen as they land on their destination
texel, and crossfade into the true field at the end.

The image emerges from the swarm because each particle's brightness IS the field value at
its destination (sampled in the vertex shader — GPU lookup, fully procedural from
gl_InstanceID, no CPU sim, no readback). Particles with dark destinations are culled, so
only content-forming particles are visible.

## Config

`RevealConfig["assembly"]` changes:

- `style: "scatter" | "particles"` (default `"scatter"`; any invalid/legacy value —
  including old `"streaks"`/`"implosion"`/`"chargeup"`/`"shards"` presets — falls back to
  `"scatter"`).
- REMOVE `massCount`, `overshoot`, `impact` everywhere (types, normalize, defaults,
  legacy migration, lab).
- ADD:
  - `particleCount: number` — default 9000, clamp 500–20000
  - `particleSizePx: number` — default 5, clamp 1–20
  - `swirl: number` — default 0.5, clamp 0–1 (curved-path amount)

Timing model unchanged: duration = `staggerMs + speedMaxMs`; `spread = staggerMs/dur`,
`flight = avg(speedMin, speedMax)/dur`, `moveEnd = min(1, spread + flight)` — same derived
math as scatter. `blurPx`/`blurStart` are unused by particles (no blur pyramid needed);
scatter keeps them.

## Motion design (the "natural" contract)

- Ease: cubic-out `1 - (1-f)³` — monotonic, smooth decel, zero overshoot.
- Path: `pos = mix(start, target, ease) + perp · sin(ease·π) · amp` where `perp` is the
  unit perpendicular of the travel direction and `amp = swirl · dist · 0.35 · signed
hash`. The arc is zero at both endpoints, so arrival is tangential and calm.
- Stagger: per-particle start jitter `hash(i) · spread` — arrivals scatter like settling
  dust, never synchronized.
- Appearance: fade in over the first 20% of flight; size eases 1.6× → 1.0× with ±40%
  per-particle size variance; soft radial falloff dot.
- Merge: particle layer renders with MAX blending (no additive blowout; settled particle
  centers equal the true field value). Once `p ≥ moveEnd`, crossfade the true field over
  the particle layer during `settle = smoothstep(moveEnd, min(1, moveEnd+0.12), p)` via
  constant-alpha blending. At `settle = 1` the pass draws the plain field only.

## Engine

- DELETE `passes/energeticMergePass.ts`, `shaders/energeticMerge.frag.ts` and the
  engine's merge branch including its blur-pyramid duplicate.
- NEW `shaders/particleMerge.vert.ts`, `shaders/particleMerge.frag.ts`,
  `shaders/particleSettle.frag.ts` (fullscreen field blend), `passes/particleMergePass.ts`
  (two programs: instanced particles + settle quad; owns both, disposes both).
- Engine branch: `style === "particles"` renders `particleMergeField` into `revealedField`
  (clear black → instanced draw with `gl.MAX` blend while `settle < 1` → fullscreen field
  quad with `blendColor(0,0,0,settle)` + `CONSTANT_ALPHA/ONE_MINUS_CONSTANT_ALPHA` when
  `settle > 0`; plain unblended fullscreen field draw once `settle >= 1`).
- Topology: `assemblyPassKind` values become `"none" | "scatter" | "particles"`; the
  topology test mirrors the rename.

## Lab

- Style dropdown: Scatter | Particles.
- New controls (render when style === "particles"): `Particle count` (500–20000, step
  100), `Particle size (px)` (1–20, step 0.5), `Swirl` (0–1, step 0.05).
- Remove Mass count / Overshoot / Impact controls and their mapping entries.
- Scatter-only controls keep their existing narrowing; speed/stagger stay assembly-wide.

## Testing

- normalize tests: new defaults/clamps; legacy style strings fall back to scatter.
- topology test: scatter↔particles rebuilds; particles param changes don't.
- Visual: verify in lab via remote pool; the FEEL verdict belongs to the user live.

## Out of scope

- No changes to scatter or wave. No CPU particle simulation. No physics/collision.
