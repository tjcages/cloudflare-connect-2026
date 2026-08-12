# CF-16 — parallel Cloud Agent prompts (Twizzler variants)

Base branch / tip: continue from **`cursor/cf-16-twizzler-match-c78b`** (cubic stroke + B lock already shipped).

**Do not** mark CF-16 Done. **Do not** force-push. Prefer unique branches `cursor/cf-16-<axis>-c78b`. Show stills under `/opt/cursor/artifacts/`. Keep rain OFF. Keep SVG-exportable paths.

## Shared rules (paste into every agent)

```
CF-16 Twizzler. Start from branch tip cursor/cf-16-twizzler-match-c78b (or main if that tip is there).

LOCKED (do not regress):
- Cubic Bézier / Catmull-Rom strokes (no polyline lineTo kinks)
- Banner lock denseness ~240 lines unless your axis explicitly changes count
- B-like wide Z heat lobes as starting point
- TARGET: apps/lab/src/presets/builtin/handoff/TARGET-twizzler.png
- Capture stills to /opt/cursor/artifacts/ with labeled PNGs + stack
- Push your feature branch; do NOT push main unless asked
- Linear CF-16 stays In Progress

You own ONE axis only (below). Produce 3 structurally different A/B/C stills for that axis, then stop and wait for human pick. Do not rewrite the whole engine unless the axis requires it.
```

## Agent 1 — Z heat scatter

```
[paste shared rules]

AXIS: Z-scattered amplitude heat only.
Vary how many / how wide heat lobes sit through depth (across), while keeping fluid X.
A = fewer wider Z lobes · B = mid · C = denser Z spots.
Do not change lineCount, cubic stroke, or bend spine recipe except as needed for the axis.
Branch: cursor/cf-16-z-heat-c78b
```

## Agent 2 — Macro hills L→R

```
[paste shared rules]

AXIS: Left→right hill rhythm (spine / bends / marketing centerY knots).
A = calmer fewer hills · B = current energy · C = more hills / sharper valleys (but keep cubic-smooth ribbons).
Keep Z-heat roughly like lock B.
Branch: cursor/cf-16-macro-hills-c78b
```

## Agent 3 — Pack denseness / fog

```
[paste shared rules]

AXIS: Pack read — lineCount, lineWidth, depthSpread, fog/nearness.
A = airier fewer thicker · B = 240 mid · C = 300+ hairlines.
Keep B Z-lobe character and cubic stroke.
Branch: cursor/cf-16-pack-density-c78b
```

## Agent 4 — TARGET match polish

```
[paste shared rules]

AXIS: Visual match to TARGET-twizzler.png only (silhouette, color fog, right-edge energy).
Start from lock B. Small structural moves allowed; show TARGET vs OURS compare still.
A/B/C = three different match strategies (not ±5% knobs).
Branch: cursor/cf-16-target-polish-c78b
```

## Fast local farm (one agent / this machine)

```bash
# Broad knob sweep
node scripts/farm-twizzler-variants.mjs
# stills → /opt/cursor/artifacts/farm/farm-*.png + farm-STACK.png

# Four axes × A/B/C (knob-level; structural A/B/C live on axis branches)
node scripts/farm-twizzler-axes.mjs
# or: node scripts/farm-twizzler-axes.mjs --axis z-heat

# Prefer each axis branch capture script for structural variants:
#   scripts/capture-twizzler-z-heat.mjs
#   scripts/capture-twizzler-macro-hills.mjs
#   scripts/capture-twizzler-density-variants.mjs
#   scripts/capture-twizzler-target-polish.mjs
```

Pick board: `apps/lab/src/presets/builtin/handoff/variants/README.md`
