# Reveal wave 2: random turbulence, long glitch, natural hadouken, 4 new modes

Date: 2026-07-20
Status: approved
Iterates on: 2026-07-20-reveal-types-design.md (user: turbulence reveal order too smooth;
glitch too short/uniform; hadouken needs a natural spawn arc, LONG streaks, NO rotation;
burn/portal/lightning all rejected — replaced by warptunnel/meteor/beam/plasma)

## Types

`RevealType = "wave" | "assembly" | "turbulence" | "glitch" | "hadouken" | "warptunnel" | "meteor" | "beam" | "plasma"`
burn/portal/lightning deleted everywhere (config blocks, leva groups, shader modes);
legacy strings fall back to `"assembly"` via the existing invalid-type rule.

energyWarp modes: 0 turbulence · 1 glitch · 2 warptunnel · 3 meteor · 4 beam · 5 plasma.
`WARP_MODES` updated accordingly. New config blocks (WarpStyleConfig) with defaults
(speedMin/speedMax/stagger/intensity/detail/glow):
warptunnel 300/1800/400/1/0.5/0.8 · meteor 400/2600/0/1/0.5/0.8 · beam 300/2200/0/1/0.5/0.8 · plasma 400/2000/900/1/0.5/0.8.
Glitch defaults change: speedMaxMs 350 → 600, staggerMs 220 → 1100 (longer by default).

## 1. Turbulence: random reveal order (mode 0)

Arrival noise becomes high-contrast and patchy — blend coherent fbm with a per-cell hash:
`n = clamp(mix(fbm2(vUv·mix(4,14,detail) + 7.3), vhash(floor(vUv·mix(8,26,detail))·0.173 + 3.7), 0.55), 0, 1)`.
Everything else (hold, curl, settle) unchanged.

## 2. Glitch: longer, more slices, more variation (mode 1)

Two row scales — coarse `mix(8,24,detail)` and fine `mix(40,120,detail)` — each with its
own per-tick activity gate (coarse 40% duty, fine 28%) and offset (coarse ±0.4·spike,
fine ±0.18); per-tick global magnitude variation `0.4 + 0.6·hash(step)`; spikes 7% at
3.6×; vertical jitter ±0.08 on coarse rows; arrival n mixes both row hashes. Flicker and
row-boost terms use the coarse gate. Gain floored at 0.

## 3. Hadouken: natural arc, long streaks, no rotation

- Spawn-rate arc: per-particle start offset drawn from a TRIANGULAR distribution peaked
  at mid-charge (inverse-CDF: `o = u < 0.5 ? sqrt(0.5u) : 1 − sqrt(0.5(1−u))`) — density
  starts at 0, climaxes mid, decays to 0.
- CPU charge matches the real arrival fraction: `lin = clamp((raw − flight)/max(spread,
0.2))`, `charge = lin < 0.5 ? 2·lin² : 1 − 2·(1−lin)²` — orb growth follows the arc.
- Straight dives: spiral/spin and wobble REMOVED; particles travel the straight line to
  center in aspect-corrected space (streak rotation aligned to the true direction).
- Long comet streaks: stretch `1 + min(14, speed·34)` (up to ~15× vs the old 7×); orbs
  (12%, unstretched, bigger) stay.

## 4. New modes

- **warptunnel (2):** hyperspace. Per-pixel arrival `n = 0.1 + 0.45·|vUv−0.5|·1.2`
  (center locks first, edges stream longest). 7 taps averaged along the ray toward
  center between zoom `mix(3.5, 1, ease)` and 1 — the field IS the radial streaks —
  sharpening to exact field at f 1; streak glow ∝ (zoom−1); `emerge = smoothstep(0,
0.15, f)` for black start.
- **meteor (3):** n = 0.1 uniform. Five impacts at f 0.12 + 0.15k: before each hit a
  comet streak (segment glow along the approach ray) dives at its target; on impact a
  flash + a growing fbm-wobbled pool that reveals the field inside; pools sized to cover
  the screen by f 1 (`R_k = 1.6·eased((f − t_k)/(1 − t_k))`), union mask + floor
  `smoothstep(0.96, 1, f)`.
- **beam (4):** n = 0.1 uniform. Charge (f < 0.25): thin vertical beam at x 0.06 pulsing,
  screen black. Sweep (0.25→0.9): beam slides to x 1.02 (cubic-out); behind it the field
  is revealed with a turbulent wake (`exp(−(bx − x)·9)` envelope × noise displacement ×
  intensity) that boils right behind the beam and settles further back; ahead black; beam
  core + glow at |x − bx|. 0.9→1: wake fully damps (extra `1 − smoothstep(0.85, 1, f)`).
- **plasma (5):** arrival from energy seeds: `n = clamp(0.12 + 0.88·(dmin·1.35 +
(fbm2(vUv·5 + 3.3) − 0.5)·0.4), 0, 1)` with dmin = distance to nearest of 4 hashed
  seeds — pools grow organically from seeds. Per-pixel `emerge = smoothstep(0.02, 0.45,
f)`; boiling rim: displacement `(fbm-vec − 0.5)·0.12·intensity·rim` with `rim =
emerge·(1−emerge)·4`; plasma glow `rim²·(0.6 + 0.4·fbm)·glow·1.6`. Exact field at f 1.

## Process rule (new, from the reserved-word incident)

After ANY shader change, the implementing task MUST load the lab in a real browser and
cycle through every affected reveal type before claiming done — unit tests do not
compile GLSL. Forbidden identifiers include GLSL ES reserved words (active, filter,
input, output, half, fixed, long, short, union, ...).

## Invariants (unchanged)

Black at p 0; exact field at rest (shared f ≥ 1 early-out); cubic-out only; no
pow(negative); scatter/wave untouched.
