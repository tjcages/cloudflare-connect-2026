# Reveal wave 3: natural turbulence settle, longer glitch, elliptic hadouken, ink/trace/pulse

Date: 2026-07-20
Status: approved
Iterates on: 2026-07-20-reveal-wave2-design.md (user: turbulence's second act bad + too
fast; glitch should glitch longer; hadouken explosion slower + elliptic sharp gather;
warptunnel/meteor/beam/plasma all rejected — replaced by ink/trace/pulse)

## Types

`RevealType = "wave" | "assembly" | "turbulence" | "glitch" | "hadouken" | "ink" | "trace" | "pulse"`
warptunnel/meteor/beam/plasma deleted everywhere; removed strings → `"assembly"` fallback.
energyWarp modes: 0 turbulence · 1 glitch · 2 ink · 3 trace · 4 pulse.

Defaults (speedMin/speedMax/stagger/intensity/detail/glow):
turbulence 400/**2600/1400** (slower overall) · glitch **150/900/2400** (glitches ~3.3s) ·
ink 400/2400/600/1/0.5/0.7 · trace 300/2200/1600/1/0.5/0.8 · pulse 300/3000/0/1/0.5/0.7.
hadouken block unchanged.

## 1. Turbulence: natural slow settle (mode 0)

Keep ignition exactly as-is. Settle phase reworked: per-pixel varied window
`sOff = (fbm2(vUv·5 + 21.7) − 0.5)·0.24`, `s = smoothstep(0.5 + sOff, 1, f)`,
`settle = s²(3 − 2s)` (double-smoothed — no cubic snap; patches settle in organic
disorder, not lockstep). Plus the slower defaults above.

## 2. Glitch

Shader unchanged; defaults above make the glitching phase ~3.3s.

## 3. Hadouken: slower detonation, elliptic sharp gather

- Burst window 0.26 → **0.42** (engine). Burst may complete past nominal progress 1 —
  fine, rawProgress is unbounded and the pass early-outs at burst ≥ 1.
- Core frag goes ELLIPTICAL: `ea = a / vec2(1.55, 1)`, all radius math (`r`, `edir`,
  `maxR = length(vec2(uAspect/1.55, 1))·0.5`) computed in the elliptical metric — orb,
  ring, and burst front are wide ellipses.
- SHARP gather edge: orb noise becomes ridged — `oraw = fbm2(edir·3 + vec2(p·1.1, 5.3))`,
  `orbN = (1 − |2·oraw − 1|) − 0.5` — with amplitude 0.35 → **0.55** (spiky, explosion-
  like edge instead of a soft wobble).
- Particle target spread becomes elliptical: `(hash − 0.5)·vec2(0.10, 0.05)`.

## 4. New modes

- **ink (2), n = 0.12:** fluid dye. Domain-warp coords by time-advected fbm vector
  (`wv·0.28·intensity`); dye concentration = smoothstep over warped distance to 3
  injection points with growth `ease·1.7`, textured by `0.55 + 0.45·fbm(wuv·7 + p·1.3)`,
  floored `smoothstep(0.93, 1, f)`. Image visibility = conc; image sampled displaced by
  the same flow `wv·0.1·intensity·(1 − conc)`; dye-edge glow `(conc(1−conc)·4)²·0.5·glow·fbm`.
  Black at f 0; exact field at f 1.
- **trace (3), content-aware:** arrival time from the field's OWN luminance —
  `n = clamp(0.1 + 0.75·(1 − field(vUv)) + (fbm2(vUv·6 + 1.3) − 0.5)·0.3, 0, 1)` — energy
  crawls along bright veins first. `emerge = smoothstep(0, 0.18, f)`; electric frontier:
  `rim = emerge(1−emerge)·4` with fast flicker `0.75 + 0.25·sin(p·40 + hash(cell)·2π)`;
  glow rides the content (`rim²·lum·glow·1.4·flick`). Exact field at f 1.
- **pulse (4), n = 0.12:** 4 sonar pings at f 0.1/0.3/0.5/0.7 with speeds
  `mix(0.9, 2.8, k/3)` (accelerating); noisy radius `rr = |vUv − 0.5|·(1 + (fbm − 0.5)·
0.25)`; each front permanently unlocks what it passes (`mask = max(...)`); ring glow
  per ping fading over `smoothstep(t_k, t_k + 0.28, f)`; mask floor `smoothstep(0.95, 1,
f)`. Black before the first ping; exact field at f 1.

## Process rule (standing)

After ANY shader change: live-load the lab, cycle every energy type, check window errors.
No GLSL ES reserved words. Coverage floors mandatory on every mask-based mode.

## Invariants (unchanged)

Black at p 0; exact field at rest (f ≥ 1 / burst ≥ 1 early-outs); cubic-out or
double-smoothstep only (no springs); no pow(negative); scatter/wave untouched.
