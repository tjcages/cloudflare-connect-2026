# Reveal polish: curl turbulence, per-style configs, natural hadouken

Date: 2026-07-20
Status: approved
Iterates on: 2026-07-19-hadouken-reveal-design.md (user: turbulence needs real vorticity
"like PavelDoGreat fluid simulation"; glitch should be much faster by default and every
style needs its OWN config; hadouken loved but "too unnatural" — polish)

## 1. Per-style configs (structural)

`reveal.assembly` becomes per-style blocks — no shared timing/knobs:

```ts
assembly: {
  style: AssemblyStyle;
  scatter: { sliceSizePx; speedMinMs; speedMaxMs; staggerMs; scatterPx; angleJitterDeg; blurPx?; blurStart? };
  turbulence: { speedMinMs; speedMaxMs; staggerMs; intensity; detail; glow };
  glitch:     { speedMinMs; speedMaxMs; staggerMs; intensity; detail; glow };
  hadouken:   { speedMinMs; speedMaxMs; staggerMs; intensity; detail; glow; particleCount };
}
```

Defaults (engine `DEFAULT_REVEAL`):

| param         | scatter | turbulence | glitch (FAST) | hadouken |
| ------------- | ------- | ---------- | ------------- | -------- |
| speedMinMs    | 300     | 400        | 80            | 500      |
| speedMaxMs    | 1600    | 1800       | 350           | 1800     |
| staggerMs     | 6550    | 800        | 220           | 1400     |
| intensity     | —       | 1          | 1             | 1        |
| detail        | —       | 0.5        | 0.5           | 0.5      |
| glow          | —       | 0.6        | 0.7           | 0.7      |
| particleCount | —       | —          | —             | 4000     |

(scatter keeps its existing extra fields/defaults; `defaultLabConfig` keeps its own
scatter values, e.g. staggerMs 900.)

- `resolveRevealDurationMs` becomes style-aware: assembly duration = the ACTIVE style
  block's `staggerMs + speedMaxMs`. Same exported signature.
- Normalize accepts both shapes: legacy FLAT assembly fields (`speedMinMs` etc. at the
  assembly top level) seed the `scatter` block only; per-style blocks are read nested.
  Unknown/legacy `style` strings still fall back to `"scatter"`.
- Lab: per-style leva controls (each style's Speed min/max, Stagger; knobs per style),
  rendered only when that style is selected; each maps to its own block. `underlayIntro`
  duration sync must be checked — if it re-implements the duration math it must become
  style-aware; if it imports `resolveRevealDurationMs` it is free.

## 2. Turbulence: curl-noise flow ("PavelDoGreat" vorticity)

Replace the fbm-angle direction field with true curl noise (divergence-free, vortex-rich,
the visual language of fluid sims): `v = (∂ψ/∂y, −∂ψ/∂x)` with ψ = fbm, computed by
central differences (ε = 0.09 in noise space), TWO octave layers (large slow vortices +
small fast ones, weights 0.75/0.35, second layer at 2.6× frequency and 1.8× flow speed).
Slow time advection (`flow = vec2(p·0.9, −p·0.6)`). Vorticity boost at start:
displacement scaled by `0.55 + 0.9·decay` so the flow is most violent early and calms
into the settle. Ignition `emerge` unchanged. All still multiplied by `intensity · decay`
so rest = exact field.

## 3. Glitch

Shader unchanged; speed comes from its own config block (total ~570 ms by default).

## 4. Hadouken naturalness polish

Particles (`hadoukenParticles.vert.ts`):

- **Spiral in-fall** (accretion, not straight lines): work in aspect-corrected space;
  radius shrinks with the cubic-out ease while the angle advances
  `ang = baseAng + spin·ease`, spin per-particle signed, magnitude 1.2–2.6 rad.
- **Radial wobble**: `sin(f·(7 + 6·hash) + phase)·0.015·(1 − ease)` added to the radius.
- **Velocity-true streaks**: motion direction from a numerical tangent (position at
  `f + 0.03` minus position at `f`), so streaks follow the curved path; stretch
  `1 + min(6, |vel|·55)`. Quad built with a scalar size in aspect space then divided
  back into UV — kills the earlier aspect-anisotropy of the streaks.
- **Orb particles**: ~12% of particles (hash-gated) are 2.6× larger, un-stretched,
  half-spin, +30% brightness — reads as heavier motes among the sparks.

Core (`hadoukenCore.frag.ts`):

- **Two-lobe core**: bright nucleus (0.16× variance) + soft halo, with a subtle pulse
  `coreSize · (1 + 0.06·sin(p·9 + charge·5))`.
- **Richer edge**: second noise octave on the blob boundary (2.3× frequency, faster
  animation), total amplitude 0.22.
- **Suction warp**: field near the boundary is sampled displaced outward along the ring
  gaussian (`+ edir_uv · ring · 0.02 · (1 − done)`) so the revealed image is visibly
  dragged by the energy edge. Zero at rest (done = 1) — exact-field invariant intact.

## Invariants (unchanged)

Black at p = 0 for all non-scatter styles; exact field at rest; cubic-out only; no
pow(negative); PCG hash for per-instance data; scatter/wave untouched.

## Testing

- normalize: per-style defaults (incl. fast glitch), nested overrides, flat-legacy →
  scatter seeding; revealMath: style-aware duration.
- topology unchanged semantically (kinds unchanged).
- Visual: turbulence shows distinct rotating vortices early; glitch completes fast;
  hadouken particles visibly curve/spiral with varied sizes.
