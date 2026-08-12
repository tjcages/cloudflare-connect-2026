# Client preview mode (limited Leva)

Shareable review surface for clients / agencies. Uses the **same Lab + Leva UI**, with most folders hidden.

| URL                   | Role                              |
| --------------------- | --------------------------------- |
| `/` or `/client.html` | Client mode — reduced Leva panels |
| `/lab.html`           | Full authoring lab                |
| `/experiments.html`   | Experiments gallery               |

## What clients see (Leva)

Top-right of the shader panel: **Default | Advanced** toggle.

- **Default** — Presets (size / layout / color) + limited Twizzler (Show, Rain, Opacity, Scale, Shape, Motion). Camera and authoring folders hidden.
- **Advanced** — full Leva folders (same authoring surface as the lab).

## Implementation

- Boot: `apps/lab/src/client-main.tsx` → `<LabApp clientMode />` + Banner 5:1
- Gating: `drawerFolder({ hideInClient, clientOnly })` in `controls/levaSchema.ts`
- Preset data: `apps/lab/src/client/clientPresets.ts`
