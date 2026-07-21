# Vortex Singular flames mode — design

Date: 2026-07-21
Status: approved

## Summary

A new background-flames direction, `vortexSingular`: a population of snake-like
tails, each wandering the viewport along its own smooth, curvy, never-closing
path, each fading out and back in at random moments while it keeps moving.
Unlike the removed `vortex`/`vortexBits` modes there is no shared center and no
orbit — every tail is singular, carrying its own path.

## Mode selection

- `FlamesDirection` gains `"vortexSingular"`.
- Selected via the existing `flames.direction` control in the lab.
- Tunables live in a new `flames.vortexSingular` sub-config with its own leva
  folder, normalized like every other flames field.

## Entities

Each tail is one head plus `segCount` body segments rendered as ordinary
`Flame` instances through the existing instanced `flamesPass` (both luminance
and color branches, unchanged — no shader or pass work).

### Head motion — wandering swirls

- State: position, heading angle, per-tail speed (base speed × the usual
  `speedVariation` spread).
- The head always turns; it never travels straight and never closes a circle.
  Turn rate is `turnRate × dir × (a + b·sin(t·f1 + p1) + c·sin(t·f2 + p2))`
  with per-tail random phases and an irrational frequency ratio, so loops
  tighten, open, and occasionally unwind into the opposite curl. All randomness
  comes from the injected `random()`; all time from the `nowMs` passed to
  `stepFlames` (deterministic, testable).
- Heads spawn scattered uniformly across the viewport.
- Soft boundary steering: within an edge margin, a turn bias proportional to
  how far outside/near the edge the head is steers it back inside. Heads are
  never culled for leaving the screen.

### Body — trail-following segments

- Head positions accumulate in a per-tail ring buffer of trail points.
- Segments sit on the trail at constant arc-length spacing (`segSpacingPx`),
  interpolated between trail samples so bodies never gap (same technique as
  the removed vortexBits snakes, prior art at c9dbd46).
- Each segment's `rot` is the local trail tangent; width and opacity taper
  linearly toward the tail end.

### Fades — noise-driven, motion never stops

- Per-tail visibility multiplier: a smooth per-tail sum-of-sines curve shaped
  through a smoothstep window so it genuinely reaches 0 sometimes, holds, and
  recovers. The tail keeps simulating while invisible and re-emerges further
  along its path. `fadeCycleRate` scales the curve speed, `fadeDepth` how deep
  the dips bite (at 0 the tail never fully vanishes, at 1 dips hit 0).
- Lifetime: each tail lives `lifeMinMs..lifeMaxMs`, with a fade-in at spawn and
  fade-out at death, then respawns at a fresh random position/heading so the
  population stays at `maxActive`.
- Final segment opacity = base flame opacity × taper × lifetime envelope ×
  fade-cycle multiplier.

## Config (`flames.vortexSingular`)

| Field                     | Meaning                                        |
| ------------------------- | ---------------------------------------------- |
| `segCount`                | body segments per tail                         |
| `segSpacingPx`            | arc-length between segments                    |
| `turnRate`                | base turning rate, rad/s                       |
| `turnVariation`           | 0..1, how wildly the turn rate swings          |
| `fadeCycleRate`           | speed of the fade in/out noise                 |
| `fadeDepth`               | 0..1, how fully dips fade out                  |
| `lifeMinMs` / `lifeMaxMs` | lifetime range                                 |
| `edgeMarginRatio`         | viewport ratio where boundary steering engages |

Thickness reuses `minWidthRatio`/`maxWidthRatio` (× display width);
`minHeightRatio`/`maxHeightRatio` are unused in this mode; speed reuses
`baseSpeedPxPerSec`/`speedVariation`; population
reuses `maxActive`; opacity reuses `opacityMin`/`opacityMax`. `spawnIntervalMs`
/`spawnJitterMs` are ignored in this mode (population is respawn-driven).

## Engine wiring

- `vortexSingular` tails are just extra `Flame` instances, so `engine.ts` keeps
  calling the same sim + pass. `vertical` uniform is false for this mode;
  orientation is carried entirely by per-instance `rot`.

## Testing

Vitest on the sim with injected `random` and fixed timestamps:

- heading changes every step (never straight) and turn rate varies over time
  (never a fixed-radius circle);
- segments hold constant arc-length spacing along the trail;
- fade multiplier reaches 0 and recovers while position keeps advancing;
- population holds at `maxActive` across lifetimes (death → respawn);
- boundary steering turns heads back within the margin;
- normalize round-trips the new config (defaults, clamps, unknown-direction
  fallback).

Live verification in the lab afterwards.
