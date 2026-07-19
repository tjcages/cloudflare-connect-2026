# Energetic merge styles for assembly reveal

Date: 2026-07-19
Status: approved

## Problem

The current assembly reveal (`reveal.type: "assembly"`) chops the field into ~29px
blocks and flies each one in from its nearest screen edge, staggered center-outward
over ~6.5s with a soft ease-out (`assemblyScatter.vert.ts`). It reads as thousands
of pieces trickling in one at a time — no mass, no climax. The user wants an
"energetic merge": few big masses, heavy overlap, overshoot, and one impact moment.

## Solution overview

Add four new switchable styles under the existing assembly reveal, selected by a new
`reveal.assembly.style` field. The current behavior is preserved verbatim as
`"scatter"` (the normalize default, so every existing preset is untouched).

| Style       | Motion                                                                                                                                  |
| ----------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `streaks`   | 6–10 full-height column masses slam in vertically (alternating direction) with directional smear, near-simultaneous arrival, snap sharp |
| `implosion` | ~24 coarse blocks rush inward from all edges at once (near-zero effective stagger), back-out overshoot, radial ripple at convergence    |
| `chargeup`  | No flying pieces: the whole field sits on screen fully blurred, contracts slightly (UV scale 1.04 → 1.0), then snaps sharp with a flash |
| `shards`    | 4–8 voronoi cells (fixed hashed seeds) slam together from their outward directions with overshoot + impact wobble                       |

## Config (`packages/stripes-engine/src/config/types.ts`, `normalize.ts`)

Extend `RevealConfig["assembly"]`:

```ts
style: "scatter" | "streaks" | "implosion" | "chargeup" | "shards"; // default "scatter"
massCount: number; // default 8,   clamp 2–24 (streaks/implosion/shards; each style may clamp further internally)
overshoot: number; // default 0.15, clamp 0–0.3 (back-out ease strength; streaks/implosion/shards)
impact: number; // default 0.6,  clamp 0–1 (convergence flash/ripple strength; all new styles)
```

All new fields optional on input; `normalizeReveal` fills defaults and clamps.
Invalid `style` values fall back to `"scatter"`. Versioned lab presets need no
migration — missing fields normalize to defaults.

Timing model is unchanged: total duration remains `staggerMs + speedMaxMs`
(`resolveRevealDurationMs` untouched, so the lab's `underlayIntro` sync stays
valid). New styles reuse the same derived quantities the engine already computes:
`spread = staggerMs / dur`, `flight = avg(speedMin, speedMax) / dur`. `blurPx`
keeps driving the blur mip pyramid; `blurStart` keeps its meaning (unblur point
along each mass's flight). `sliceSizePx`, `scatterPx`, `angleJitterDeg` are
scatter-only and ignored by the new styles.

## Engine (`packages/stripes-engine/src`)

New full-screen fragment pass: `passes/energeticMergePass.ts` +
`shaders/energeticMerge.frag.ts` (shared fullscreen quad vert, like blur/reveal
passes). One shader, `uMode` int selects style (0 streaks, 1 implosion,
2 chargeup, 3 shards).

Uniforms: field texture + the existing 3 blur mips (quarter/half/full),
`uProgress` (raw, unclamped), `uSpread`, `uFlight`, `uMassCount`, `uOvershoot`,
`uImpact`, `uSigmaUv`, `uBlurStart`, `uAspect`.

Per-pixel approach (no instancing): loop over ≤24 procedurally defined masses,
test membership of the pixel in the mass's current (offset) footprint, sample the
field/blur mips at the displaced UV, take max. Pixels covered by no mass are
black. Cheap at these counts.

Mass definitions (all procedural from hash of mass index, no CPU buffers):

- **Streaks (0):** N = massCount columns; column i spans x ∈ [i/N, (i+1)/N], full
  height. Direction alternates top/bottom by parity. Spawn offset y =
  ±(1 + 0.3·hash(i)); per-column start jitter = hash(i) · spread. While moving,
  sample with a 5-tap directional smear along the motion axis with tap spread
  proportional to instantaneous speed (ease derivative), plus a low mip-blur
  contribution. Arrival snaps sharp.
- **Implosion (1):** coarse grid sized from massCount (gridCols =
  round(sqrt(massCount·aspect)), gridRows = ceil(massCount/gridCols)). Each block
  spawns displaced radially outward from screen center by 0.6 + 0.5·hash; start
  jitter = hash · spread (spread expected near 0 for this style). Back-out
  overshoot ease. Membership: `uv - offset_i` inside block rect.
- **Chargeup (2):** no masses, single sample. Blur amount eases from 1.0 down to
  ~0.3 over the first 70% of flight, then snaps to 0. UV contraction toward
  center: scale 1.04 → 1.0. Brightness gain 1 + 0.3·impact during charge, flash
  spike at the snap.
- **Shards (3):** K = min(massCount, 8) seeds at fixed hashed positions.
  `dir_i = normalize(seed_i - center)`; `offset_i = dir_i · (0.7 + 0.4·hash) ·
(1 - ease)`. Membership: pixel belongs to shard i if the nearest seed to
  `uv - offset_i` is seed i (voronoi test in displaced space). Back-out
  overshoot ease.

Easing: back-out `ease(f) = 1 + (1+s)·(f-1)³ + s·(f-1)²` with `s = overshoot ·
17` (overshoot 0.1 ≈ classic 1.70158); overshoot 0 degrades to cubic-out.

Impact pulse (in the same shader, no extra pass): once every mass has arrived
(`p ≥ moveEnd`), `tImpact = clamp((p - moveEnd) / 0.25, 0, 1)`. Implosion/shards:
expanding radial ring from screen center — brightness boost and a small UV wobble
along the ring gradient, both scaled by `uImpact` and fading with
`(1 - tImpact)`. Streaks: brief uniform brightness snap only. Chargeup: flash at
the snap (its impact moment is the snap itself).

Engine wiring (`engine.ts`, inside the existing `assemblyTopology` branch):
`style === "scatter"` keeps the current instanced scatter pass verbatim; any
other style creates `energeticMergePass` instead. The blur-pyramid build code is
shared between both branches (chargeup always builds it while `p < moveEnd`,
regardless of the `blurPx > 0` gate — it needs the mips; use blurPx default
17.5). Topology invalidation: the rebuild check around `lastAssemblyTopo`
(engine.ts ~1061) must also track scatter-vs-merge pass choice so switching style
in the lab rebuilds passes.

## Lab (`apps/lab/src`)

Leva Reveal folder (`controls/levaSchema.ts`):

- `Style` dropdown — Scatter / Streaks / Implosion / Charge-up / Shards; rendered
  when `revealType === "assembly"`.
- `Mass count` (2–24, step 1) — rendered for streaks/implosion/shards.
- `Overshoot` (0–0.3, step 0.01) — rendered for streaks/implosion/shards.
- `Impact` (0–1, step 0.05) — rendered for all four new styles.
- Existing scatter-specific controls (slice size, scatter px, angle jitter, blur
  start) render only when style is `scatter`; speed/stagger/blur stay for all.

Wire the new values through the lab's leva→config mapping and preset
serialization (fields are optional; normalize covers old presets).

## Testing

- `normalize.test.ts`: style default/fallback, clamps for massCount/overshoot/impact.
- `engine.topology.test.ts`: switching style scatter↔streaks triggers pass rebuild.
- Existing `tests/reveal-assembly.spec.ts` and unit suite must stay green.
- Visual: verify each style live in the lab (user's dev server, port 5174) via
  the remote browser pool; capture each style for review.

## Out of scope

- No changes to wave reveal, scatter behavior, timing model, or CPU-side
  `revealMath` functions.
- No auto-retuning of staggerMs/speed defaults when switching style (user tunes
  in lab).
