# Hadouken pixel formation (kills the detonation)

Date: 2026-07-20
Status: approved (user + designer: "patlamaya gerek yok" / "pixellerle oluşması çok
güzel olur direkt" — no explosion; the image should form directly with pixels)

## Timeline

1. Particle gather unchanged, with the lean early-peak arc (triangular distribution
   mode c = 0.3: vert `o = u < 0.3 ? sqrt(u·0.3) : 1 − sqrt((1−u)·0.7)`; engine
   `charge = lin < 0.3 ? lin²/0.3 : 1 − (1−lin)²/0.7`). Defaults 1800/900 (already
   shipped).
2. NO orb ring, NO burst, NO radial wipe — `uBurst`, `chargeEnd`, and all burst math
   deleted from frag/pass/engine.
3. The image forms as PIXELS driven by charge: screen-space cell grid
   (`cells = mix(24, 64, detail)` across width, square cells via
   `grid = vec2(cells, cells/uAspect)`); per-cell threshold
   `hc = (hash(cid)·0.65 + ellipticalCellDist·0.35)·0.75` (mostly random order, mild
   bias outward from the merge point); cell turns on over `smoothstep(hc, hc+0.06,
charge)`, popping BLOCKY (field sampled at the cell center) with a brief flash
   `(on(1−on)·4)²·0.35·glow`, then refines to the true per-pixel field over
   `smoothstep(hc+0.05, hc+0.2, charge)`. All thresholds ≤ 0.75 → everything on and
   refined by charge 0.95.
4. A soft central glow `exp(−r²/0.012)·0.5·glow·(1−charge)` (elliptical metric, gated
   by charge > 0) marks the merge point and fades out — the only remaining "energy"
   accent.
5. `charge ≥ 1` → plain-field early-out (bit-exact).

## Fluid deferral

The `fluid` type from wave 4 is REMOVED again (config/leva/kind/tests; `revealEnabled`
carve-out reverted) — no dropdown entry without an implementation. The fluid-sim spec
(wave 4 §4) stays on file for a future round. Types:
`wave | assembly | turbulence | glitch | hadouken | storm | detonation`.

## Invariants

Black at charge 0; exact field at rest; no springs; no pow(negative); live-load rule
applies.
