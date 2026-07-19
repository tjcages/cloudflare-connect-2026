# Hadouken detonation timeline (iterates on reveal-polish)

Date: 2026-07-20
Status: approved
Iterates on: 2026-07-20-reveal-polish-design.md (user: no reveal during charging — the
image must appear ONLY via the explosion; orb grows then compresses; last particle batch
triggers a spiky detonation that wipes the field in)

## Timeline (single progress axis)

- `charge` unchanged: `clamp((rawProgress − flight)/max(spread, 0.2), 0, 1)`.
- NEW `burst`: `clamp((rawProgress − chargeEnd)/0.15, 0, 1)` with
  `chargeEnd = flight + max(spread, 0.2)` — a 15%-of-duration blast right after the last
  particles merge (particle draw already stops at charge 1 = detonation instant).

## Phases (hadoukenCore.frag rewrite)

1. **Charge (burst = 0):** field mask = 0 everywhere — NOTHING of the image shows. A
   center orb: radius grows with `smoothstep(0, 0.55, charge)` to ~0.145 then compresses
   by `smoothstep(0.55, 1, charge)` down to ~0.065 while its brightness density rises
   (0.9 → 2.5×). Mystic shape: radius modulated by animated fbm on the unit direction
   (±35%) plus a subtle pulse `1 + 0.05·sin(p·11)`. Two-lobe glow (tight nucleus at
   0.25× variance + halo at 2.5×).
2. **Detonation (0 < burst < 1):** orb fades over the first 30% of burst. Burst front
   `Rb = orbR + easeOut(burst)·(maxR + 0.28 − orbR)` (cubic-out). Spiky edge: ridged
   noise `1 − |2·fbm − 1|` at frequency `mix(4, 9, detail)` modulates the front ±27.5%,
   spikes strongest early (`·(1 − ease)`) and smoothing to zero as the front completes.
   Field revealed behind the front (`smoothstep(Rl, Rl − 0.1, r)`, plus a
   `smoothstep(0.97, 1, burst)` mask floor for guaranteed closure); bright ring rides
   the front (`·(1 − ease)`); center-weighted release flash `exp(−burst·5)`.
3. **Rest (burst ≥ 1):** early-out to the plain field (bit-exact).

Invariants: black at charge 0; exact field at burst 1; cubic-out only; pow bases
non-negative; suction/done logic from the previous design is REMOVED (superseded).

## Plumbing

- `HadoukenUniforms` gains `burst: number`; pass sets `uBurst` on the core program;
  engine computes charge/burst per above. Particle vert/frag untouched.
- No config changes; `detail` = spike frequency, `glow` = orb/ring/flash intensity.
