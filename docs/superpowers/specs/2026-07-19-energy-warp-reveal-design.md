# Energy warp reveal family (supersedes particle merge)

Date: 2026-07-19
Status: approved
Supersedes: 2026-07-19-particle-merge-reveal-design.md ("particles then reveal" rejected —
the particle swarm and the texture read as two substances with a crossfade seam)

## Problem

Every attempt so far staged a proxy (blocks, then particles) that later hands off to the
texture. The user wants a UNIFIED, energetic approach: one substance throughout.

## Principle

Always render the actual field, sampled through a displacement field that decays to zero:

```
revealed(uv) = field(uv + D(uv) · intensity · decay(uv))
```

The texture exists from frame one as stirred streams of energy and settles into itself.
No proxies, no crossfade, no phase change — at decay 0 the output is exactly the field.
Glow rides local motion (fast regions burn brighter, calming as they lock). Arrival is
noise-jittered per pixel so regions lock organically. Ease is cubic-out only.

## Variants (one shader, uMode selects the displacement field)

| Mode | Style        | Displacement field                                                           |
| ---- | ------------ | ---------------------------------------------------------------------------- |
| 0    | `turbulence` | fbm-angle flow — the image is stirred by turbulent swirls that calm          |
| 1    | `vortex`     | rotation around center + inward pull — the image spirals in and unwinds      |
| 2    | `streams`    | vertical pour in noise channels — columns of energy rain into place          |
| 3    | `pull`       | 4 hashed wells — the image stretches out of energy wells and relaxes         |
| 4    | `ripple`     | expanding radial wavefront — the image surfs the shockwave into stillness    |
| 5    | `glitch`     | time-quantized horizontal slice offsets + flicker — electric snap into place |

## Config

- `style: "scatter" | "turbulence" | "vortex" | "streams" | "pull" | "ripple" | "glitch"`
  (default `"scatter"`; invalid/legacy values — incl. `"particles"` — fall back to scatter).
- REMOVE `particleCount`, `particleSizePx`, `swirl` everywhere.
- ADD: `intensity` (default 1, clamp 0–2), `detail` (default 0.5, clamp 0–1, noise
  frequency / structural scale), `glow` (default 0.6, clamp 0–1).
- Timing unchanged: `spread = staggerMs/dur`, `flight = avg(speedMin,speedMax)/dur`.
  `blurPx`/`blurStart` remain scatter-only.

## Shared shading

- Per-pixel arrival: `f = clamp((p − spread·n)/flight, 0, 1)` with n from variant-chosen
  noise (fbm for turbulence/vortex/pull, column noise for streams, small constant for
  ripple, row hash for glitch); `ease = 1 − (1−f)³`; `decay = 1 − ease`.
- Motion smear: 5 taps averaged along the remaining displacement vector.
- Glow: gain `1 + glow·1.2·min(1, |D|·8)·decay` applied to the smeared sample.
- Global fade-in `smoothstep(0, 0.08, p)` to avoid a hard pop at replay.
- sin-hash noise is acceptable here (lattice coords are small — no large-argument sin).

## Engine

- DELETE `passes/particleMergePass.ts`, `shaders/particleMerge.vert.ts`,
  `shaders/particleMerge.frag.ts`, `shaders/particleSettle.frag.ts` and the
  `particleMergeField` branch.
- NEW `shaders/energyWarp.frag.ts` + `passes/energyWarpPass.ts` (fullscreen, one
  program). Uniforms: field, mode, progress (raw), spread, flight, intensity, detail,
  glow, aspect.
- Branch: `style !== "scatter"` renders `energyWarpField` into `revealedField`.
- Topology: `assemblyPassKind` → `"none" | "scatter" | "warp"`; warp↔warp style changes
  are per-frame uniform switches (no rebuild).

## Lab

- Style dropdown: Scatter | Turbulence | Vortex | Streams | Pull | Ripple | Glitch.
- Controls for style ≠ scatter: `Intensity` (0–2, step 0.05), `Detail` (0–1, step 0.05),
  `Glow` (0–1, step 0.05). Particle controls removed.

## Testing

- normalize: new defaults/clamps; `"particles"`/legacy strings → scatter.
- topology: scatter↔warp rebuilds; warp-style/param changes don't.
- Visual per variant in lab; feel verdict is the user's, live.

## Out of scope

- No spring/overshoot easing anywhere. No changes to scatter or wave.
