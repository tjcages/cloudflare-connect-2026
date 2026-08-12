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

- **Default** — rich authoring for the orange-wave ribbon:
  - **Presets** — Size / Layout / Color
  - **Twizzler → General** — Show, Rain, Gradients, colors, Opacity, Zoom
  - **Twizzler → Shape** — Center Y, Move X/Y/Z, Amplitude, Rotate X/Y/Z, FOV, Cam Z
  - **Twizzler → Gradients** — X/Y/Z gradient mixes
  - **Twizzler → Stroke** — width, layers, perspective
  - **Twizzler → Motion** — Speed
  - **Background** — Fill (Solid / Transparent) + library Color
- **Advanced** — legacy / experimental folders (View, Edges, Noise, wrinkles/bends/depth terrain, Background Gradient fill, camera, etc.)

## Twizzler (orange-wave)

Current ribbon geometry is the **orange-wave** 3D projected vector from
`apps/lab/src/presets/references/orange-wave-vector.html` (ported into `twizzler.ts`).

- Stroke colors use **COLOR_LIBRARY** (X: Orange Pair→Accent, Y peaks: Red Accent; HTML #ffcc33/#ff6709/#ff2a2a snapped)
- Background: Neutral White (`#ffffff`), solid — not the HTML demo black
- Z fade: far / +Z lerps ink **toward stage background color** (not HTML opacity modulate)
- Move X/Y = pixel translate after projection; Move Z = world Z before projection
- Zoom is unbounded (no L/R lock / vertical stretch)
- ~56 layers, Rotate X/Y/Z (defaults 12° / −18° / 0°), `lineWidth` ~1.15, dense sampling (≥160 pts)
- Rain (`sparkle.gaps`) unchanged from Banner — toggle with **Rain** next to Twizzler **Show**
- Reference: `apps/lab/src/presets/references/orange-wave-vector.html`

## Exports

Client panel (and lab) expose:

- **Download JSON** — full lab configuration
- **Export Video** — MediaRecorder / ffmpeg pipeline
- **Export SVG** — true vectors (per-segment `<path>` strokes when gradients on; combined per-fiber fills when solid)

## Implementation

- Boot: `apps/lab/src/client-main.tsx` → `<LabApp clientMode />` + Banner 5:1
- Gating: `drawerFolder({ hideInClient, clientOnly })` + `showTwizzlerAuthoring` / `showFullLab` in `controls/levaSchema.ts`
- Preset data: `apps/lab/src/client/clientPresets.ts`
- Library: `apps/lab/src/components/colorLibrary.ts` (`LIBRARY_COLOR`, `HexColorPopover`)
