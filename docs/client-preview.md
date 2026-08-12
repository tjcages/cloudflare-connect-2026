# Client preview mode (limited Leva)

Shareable review surface for clients / agencies. Uses the **same Lab + Leva UI**, with most folders hidden.

**Production:** always deploy to [`connect-shader`](https://dash.cloudflare.com/944ca70087298faa2e84783db46162c5/workers/services/view/connect-shader/production) — see `docs/deploy.md`.

| URL                   | Role                              |
| --------------------- | --------------------------------- |
| `/` or `/client.html` | Client mode — reduced Leva panels |
| `/lab.html`           | Full authoring lab                |
| `/experiments.html`   | Experiments gallery               |

## What clients see (Leva)

Top of the shader panel (scrolls with the panel — not sticky): **Default | Advanced** toggle + export buttons.

- **Default** — only the knobs a client needs:
  - **Presets** — Size / Layout / Color
  - **Twizzler → General** — Show, Rain
  - **Twizzler → Shape** — Amplitude, Rotate X/Y/Z
  - **Twizzler → Motion** — Speed
  - **Background** — Fill (Solid / Transparent) + library Color
- **Advanced** — full Leva folders (same authoring surface as the lab). Gradient background fill, Gradients / Stroke / View / Edges / Noise, per-axis Twizzler colors, Zoom / Opacity, and camera folders return here.

## Twizzler (orange-wave)

Current ribbon geometry is the **orange-wave** 3D projected vector from
`apps/lab/src/presets/references/orange-wave-vector.html` (ported into `twizzler.ts`).

- Stroke colors use **COLOR_LIBRARY** (X: Orange Pair→Accent, Y peaks: Red Accent; HTML #ffcc33/#ff6709/#ff2a2a snapped)
- Background: Neutral White (`#ffffff`), solid — not the HTML demo black
- Z fade: far / +Z lerps ink **toward stage background color** (not HTML opacity modulate)
- Camera/stroke/gradient knobs from orange-wave v3 live in Advanced (Gradients + Stroke folders)
- ~56 layers, Rotate X/Y/Z (defaults 12° / −18° / 0°), `lineWidth` ~1.15, dense sampling (≥160 pts)
- Rain (`sparkle.gaps`) unchanged from Banner — toggle with **Rain** next to Twizzler **Show**
- Reference: `apps/lab/src/presets/references/orange-wave-vector.html`

## Exports

Client panel (and lab) expose:

- **Download JSON** — full lab configuration
- **Export Video** — MediaRecorder / ffmpeg pipeline
- **Export SVG** — true vectors (per-segment `<path>` strokes, not averaged cubics / rasters)

## Next HTML → Leva mapping (do this on the next drop)

When the nicer orange-wave HTML arrives, wire **every** HTML control into Leva (Default for client knobs, Advanced for fine ones). Keep the color library — no freeform-only hex fields.

| HTML / design control        | Leva folder               | Notes                                                         |
| ---------------------------- | ------------------------- | ------------------------------------------------------------- |
| Stroke color                 | Presets → Color (Default) | `colorLibraryInputPlugin` → `LIBRARY_COLOR.*` / Orange tokens |
| Background                   | Background → Fill + Color | Library Neutral White / Neutral steps; Gradient = Advanced    |
| Twizzler on/off              | Twizzler → Show           | existing `twizzlerEnabled`                                    |
| Rain on/off                  | Twizzler → Rain           | existing `rainEnabled` → `sparkle.gaps`                       |
| Rotate X/Y/Z                 | Twizzler → Shape          | already live in Default                                       |
| Layer count / width / points | Twizzler → Stroke         | Advanced                                                      |
| Speed / pause                | Twizzler → Motion         | `speed` (0 = freeze)                                          |
| Wave amplitude / envelope    | Twizzler → Shape          | Amplitude in Default; Center Y via Layout presets             |
| Any new HTML sliders         | Twizzler Shape/Motion     | add settings + normalize + Leva                               |

Colors in the HTML that are not exact library hexes get **snapped** to the nearest `COLOR_LIBRARY` token (prefer Accent / Pair levels). Do not invent a parallel palette.

## Implementation

- Boot: `apps/lab/src/client-main.tsx` → `<LabApp clientMode />` + Banner 5:1
- Gating: `drawerFolder({ hideInClient, clientOnly })` + `showTwizzlerAuthoring` / `showFullLab` in `controls/levaSchema.ts`
- Preset data: `apps/lab/src/client/clientPresets.ts`
- Library: `apps/lab/src/components/colorLibrary.ts` (`LIBRARY_COLOR`, `HexColorPopover`)
