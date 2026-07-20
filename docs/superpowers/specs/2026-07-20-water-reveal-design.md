# Water Reveal — Design

Date: 2026-07-20
Status: approved (user), pre-implementation

## Idea

A new reveal type `"water"`: an invisible "ghost cursor" strokes across the canvas in a
serpentine sweep, laying down real water ripples using the same wave-equation simulation
as the cursor trail's wave mode (`waterSim.ts`). Wherever ripple energy has passed, the
image becomes permanently revealed — the picture builds up in the wake of the strokes,
while the live wavefront refracts and shimmers the freshly revealed pixels.

Chosen fill carrier: **wake accumulation** (canvas starts empty; coverage is monotonic).
Chosen choreography: **serpentine sweep** (bounded duration, reads as deliberate drawing).
Chosen implementation: **dedicated reveal sim** — independent of the real cursor's water
sim, so the reveal works regardless of the trail mode and never fights live cursor input.

## Config

`reveal.type` gains `"water"` with block:

| Knob         | Meaning                                                               |
| ------------ | --------------------------------------------------------------------- |
| `durationMs` | total sweep time (ghost cursor start → canvas fully covered)          |
| `rows`       | serpentine row count (more rows = finer stroke lattice)               |
| `intensity`  | splat amplitude of the ghost strokes                                  |
| `wobble`     | organic vertical wiggle on the stroke path                            |
| `refraction` | gain of live wave height into the existing `uWater` displacement path |
| `softness`   | energy→coverage smoothstep width (edge softness of the fill)          |

## Components

1. **`waterRevealSim.ts`** — forked from `cursorTrail/waterSim.ts`. Half-resolution
   (long edge capped at 420) ping-pong float RG sim reusing `WATER_SIM_FRAG`, plus a
   second single-channel accumulation ping-pong updated by a new tiny shader:
   `cover = max(prevCover, smoothstep(lo, hi, |height|))`. Monotonic by construction.
2. **Serpentine driver** — pure function in `reveal/revealMath.ts`:
   `serpentinePoint(progress, rows, wobble) → {x, y}` in normalized 0..1 coords; the
   cursor sweeps left↔right, descending row by row. The sim substeps the segment between
   successive frame points exactly like `waterSim` so fast sweeps lay continuous wakes.
3. **Pipeline hookup** — while the reveal runs: field × cover texture (reveal mask), and
   the sim's height texture feeds the `uWater` refraction input of `sourceField.frag`
   with a reveal-scoped gain.
4. **Completion** — at progress ≥ 1 coverage is forced full; residual waves ring down
   over a short tail; then the sim drops out of the pipeline and disposes. Steady state
   must be byte-identical to no-reveal (same discipline as `waterSim`'s idle freeze).

## Error handling

If `EXT_color_buffer_float` is unavailable, disable the sim `waterSim`-style: mask
snaps to 1 (image simply appears), one console warn.

## Testing

- Unit: serpentine driver (starts top, ends bottom, x alternates per row, full
  coverage), normalize/serialize round-trip for the new config block, duration
  resolution for `type: "water"`.
- Visual: live verification in the running lab (reveal dropdown gains "water" + knobs).
