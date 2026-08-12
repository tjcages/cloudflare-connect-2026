# Client preview mode (limited Leva)

Shareable review surface for clients / agencies. Uses the **same Lab + Leva UI**, with most folders hidden.

**Production:** always deploy to [`connect-shader`](https://dash.cloudflare.com/944ca70087298faa2e84783db46162c5/workers/services/view/connect-shader/production) — see `docs/deploy.md`.

| URL                   | Role                              |
| --------------------- | --------------------------------- |
| `/` or `/client.html` | Client mode — reduced Leva panels |
| `/lab.html`           | Full authoring lab                |
| `/experiments.html`   | Experiments gallery               |

## What clients see (Leva)

Top-right of the shader panel: **Default | Advanced** toggle.

- **Default** — Presets + Twizzler (Show / Rain / library Color) + Shape rotation + Motion + **Background** (fill + library Color). Camera and heavy authoring folders hidden.
- **Advanced** — full Leva folders (same authoring surface as the lab).

## Twizzler (orange-wave)

Current ribbon geometry is the **orange-wave** 3D projected vector from
`apps/lab/src/presets/references/orange-wave-vector.html` (ported into `twizzler.ts`).

- Stroke color uses **COLOR_LIBRARY** tokens via `colorLibraryInputPlugin` (default Orange / 900 Accent `#f46021`)
- ~56 layers, Rotate X/Y/Z (defaults 12° / −18° / 0°)
- Rain (`sparkle.gaps`) unchanged from Banner — toggle with **Rain** next to Twizzler **Show**
- Drop updated HTML into `presets/references/` when iterating

## Next HTML → Leva mapping (do this on the next drop)

When the nicer orange-wave HTML arrives, wire **every** HTML control into Leva (Default for client knobs, Advanced for fine ones). Keep the color library — no freeform-only hex fields.

| HTML / design control        | Leva folder               | Notes                                                         |
| ---------------------------- | ------------------------- | ------------------------------------------------------------- |
| Stroke color                 | Twizzler → Color          | `colorLibraryInputPlugin` → `LIBRARY_COLOR.*` / Orange tokens |
| Background                   | Background → Fill + Color | Library Neutral White / Neutral steps                         |
| Twizzler on/off              | Twizzler → Show           | existing `twizzlerEnabled`                                    |
| Rain on/off                  | Twizzler → Rain           | existing `rainEnabled` → `sparkle.gaps`                       |
| Rotate X/Y/Z                 | Twizzler → Shape          | already live                                                  |
| Layer count / width / points | Twizzler → Lines          | already in Advanced                                           |
| Speed / pause                | Twizzler → Motion         | `speed` (0 = freeze)                                          |
| Wave amplitude / envelope    | Twizzler → Shape          | amplitude, scale, centerY                                     |
| Any new HTML sliders         | Twizzler Shape/Motion     | add settings + normalize + Leva                               |

Colors in the HTML that are not exact library hexes get **snapped** to the nearest `COLOR_LIBRARY` token (prefer Accent / Pair levels). Do not invent a parallel palette.

## Implementation

- Boot: `apps/lab/src/client-main.tsx` → `<LabApp clientMode />` + Banner 5:1
- Gating: `drawerFolder({ hideInClient, clientOnly })` in `controls/levaSchema.ts`
- Preset data: `apps/lab/src/client/clientPresets.ts`
- Library: `apps/lab/src/components/colorLibrary.ts` (`LIBRARY_COLOR`, `HexColorPopover`)
