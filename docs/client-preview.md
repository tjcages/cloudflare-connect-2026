# Client preview mode (limited Leva)

Shareable review surface for clients / agencies. Uses the **same Lab + Leva UI**, with most folders hidden.

| URL                   | Role                              |
| --------------------- | --------------------------------- |
| `/` or `/client.html` | Client mode — reduced Leva panels |
| `/lab.html`           | Full authoring lab                |
| `/experiments.html`   | Experiments gallery               |

## What clients see (Leva)

- **Presets** — size / layout / color
- **Twizzler** — Show, Rain, Opacity, Scale, plus Shape (Center Y / Amplitude / Twist) and Motion (Speed)
- Camera, texture drawers, stripes, sparkle authoring, surfaces, etc. are hidden

## Implementation

- Boot: `apps/lab/src/client-main.tsx` → `<LabApp clientMode />` + Banner 5:1
- Gating: `drawerFolder({ hideInClient, clientOnly })` in `controls/levaSchema.ts`
- Preset data: `apps/lab/src/client/clientPresets.ts`
