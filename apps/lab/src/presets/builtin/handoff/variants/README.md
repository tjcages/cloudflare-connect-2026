# CF-16 Twizzler — A/B/C pick board

Parallel axis branches off `cursor/cf-16-twizzler-match-c78b`. **CF-16 stays In Progress** until human accepts.

## Canonical stills (agent captures)

| Axis          | Branch                            | A / B / C stills                            | Stack                                                        |
| ------------- | --------------------------------- | ------------------------------------------- | ------------------------------------------------------------ |
| Z heat        | `cursor/cf-16-z-heat-c78b`        | `twizzler-z-heat-{A,B,C}.png`               | `twizzler-z-heat-STACK.png`                                  |
| Macro hills   | `cursor/cf-16-macro-hills-c78b`   | `twizzler-macro-hills-{A,B,C}.png`          | `twizzler-macro-hills-STACK.png`                             |
| Pack density  | `cursor/cf-16-pack-density-c78b`  | `twizzler-pack-density-{A,B,C}-labeled.png` | `twizzler-pack-density-ABC-stack.png`                        |
| TARGET polish | `cursor/cf-16-target-polish-c78b` | `CF-16-target-polish-{A,B,C}.png`           | `CF-16-target-polish-STACK.png` + `CF-16-TARGET-vs-OURS.png` |

All under `/opt/cursor/artifacts/`.

## What each axis varies

1. **Z heat** — lobe count/width through depth (`heatVariant` 0/1/2 → 3/5/9 bands). lineCount 240 locked.
2. **Macro hills** — L→R spine (`hillRhythm` 0/1/2). Z-heat ≈ lock B.
3. **Pack density** — lineCount / lineWidth / depthSpread (airy 140 · 240 mid · 320+ hairlines).
4. **TARGET polish** — three match strategies vs `TARGET-twizzler.png` (silhouette / fan / depth-fog).

## Local farm

```bash
node scripts/farm-twizzler-variants.mjs   # broad knob sweep
node scripts/farm-twizzler-axes.mjs       # knob-only A/B/C (supplemental)
# Prefer each axis branch's capture-twizzler-*.mjs for structural A/B/C
```
