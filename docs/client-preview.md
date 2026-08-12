# Client preview mode (limited Twizzler editing)

Shareable review surface for clients / agencies. **No camera controls.** Boots from the Banner 5:1 Twizzler + shader design.

| URL                   | Role                                               |
| --------------------- | -------------------------------------------------- |
| `/` or `/client.html` | Limited client preview (default staging link)      |
| `/lab.html`           | Full authoring lab (Leva drawers, camera, exports) |
| `/experiments.html`   | Experiments gallery                                |

## Allowed controls

- **Layers:** Twizzler on/off, rain on/off (`sparkle.gaps`)
- **Size presets:** Banner 5:1, Wide 3:1, Hero 16:9, Square
- **Layout presets:** Classic, Low ribbon, High fan, Compact
- **Color presets:** Coral classic, Soft gold, Deep ember, Graphite
- **Tweaks:** opacity, scale, twist/rotation, amplitude, vertical position, motion speed

## Implementation

- Presets + bundle builder: `apps/lab/src/client/clientPresets.ts`
- UI: `apps/lab/src/client/ClientPreviewApp.tsx`
- Entry: `apps/lab/src/client-main.tsx` → `index.html` / `client.html`
