# Client preview mode (limited Leva)

Shareable review surface for clients / agencies. Uses the **same Lab + Leva UI**, with most folders hidden.

**Production:** always deploy to [`connect-shader`](https://dash.cloudflare.com/944ca70087298faa2e84783db46162c5/workers/services/view/connect-shader/production) — see `docs/deploy.md`.

| URL                   | Role                              |
| --------------------- | --------------------------------- |
| `/` or `/client.html` | Client mode — reduced Leva panels |
| `/lab.html`           | Full authoring lab                |
| `/experiments.html`   | Experiments gallery               |

## What clients see (Leva)

Top of the shader panel (scrolls with the panel — not sticky): **Default | Advanced** toggle, **Saved layouts**, and export buttons.

- **Saved layouts** — Save / Apply / Delete named layouts (full shader + engine/lab config). Last applied layout restores on reload. Upload JSON also registers a layout.
- **Default** — rich authoring for the orange-wave ribbon:
  - **Presets** — Size / Layout / Color
  - **Twizzler → General** — Show, Rain, Color mode (Solid / Shared / Fiber / Baked), colors, Opacity, Zoom
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
- Move X/Y = pixel translate after projection; Move Z = post-fit dolly (closer/farther)
- Zoom is unbounded (no L/R lock / vertical stretch)
- ~56 layers, Rotate X/Y/Z (defaults 12° / −18° / 0°), `lineWidth` ~1.15, dense sampling (≥160 pts)
- Rain (`sparkle.gaps`) unchanged from Banner — toggle with **Rain** next to Twizzler **Show**
- Reference: `apps/lab/src/presets/references/orange-wave-vector.html`

## Exports

Client panel (and lab) expose:

- **Save layout** — named localStorage preset (full `config` + `lab`, including Twizzler / Color mode / rain)
- **Apply / Delete** — restore or remove saved layouts (builtins stay read-only)
- **Download JSON** — full lab configuration file
- **Upload JSON** — import a config file as a saved layout and apply it
- **Export Video** — MediaRecorder / ffmpeg pipeline
- **Export SVG** — filled ribbon paths (auto outline-stroke). Mode from **Color mode**: Solid (one fill/fiber), Shared gradient (one X gradient rect masked by all ribbons), Fiber gradient (per-fiber X gradients), Baked (segmented X/Y/Z).

## Next HTML → Leva mapping (do this on the next drop)

When the nicer orange-wave HTML arrives, wire **every** HTML control into Leva (Default for client knobs, Advanced for fine ones). Keep the color library — no freeform-only hex fields.

| HTML / design control        | Leva folder               | Notes                                                         |
| ---------------------------- | ------------------------- | ------------------------------------------------------------- |
| Stroke color                 | Presets → Color (Default) | `colorLibraryInputPlugin` → `LIBRARY_COLOR.*` / Orange tokens |
| Background                   | Background → Fill + Color | Library Neutral White / Neutral steps; Gradient = Advanced    |
| Twizzler on/off              | Twizzler → Show           | existing `twizzlerEnabled`                                    |
| Color mode                   | Twizzler → Color mode     | Solid / Shared gradient / Fiber gradient / Baked segments     |
| Rain on/off                  | Twizzler → Rain           | existing `rainEnabled` → `sparkle.gaps`                       |
| Zoom / Move X/Y/Z            | Twizzler → General/Shape  | Zoom + translate live in Default                              |
| Rotate X/Y/Z                 | Twizzler → Shape          | already live in Default                                       |
| Layer count / width / points | Twizzler → Stroke         | Default                                                       |
| Speed / pause                | Twizzler → Motion         | `speed` (0 = freeze)                                          |
| Wave amplitude / envelope    | Twizzler → Shape          | Amplitude + Center Y in Default                               |
| Any new HTML sliders         | Twizzler Shape/Motion     | add settings + normalize + Leva                               |

Colors in the HTML that are not exact library hexes get **snapped** to the nearest `COLOR_LIBRARY` token (prefer Accent / Pair levels). Do not invent a parallel palette.

## Implementation

- Boot: `apps/lab/src/client-main.tsx` → restore last saved layout (or Banner 5:1) → `<LabApp clientMode />`
- Saved layouts: `apps/lab/src/client/savedLayouts.ts` + shared `presets.ts` storage
- Gating: `drawerFolder({ hideInClient, clientOnly })` + `showTwizzlerAuthoring` / `showFullLab` in `controls/levaSchema.ts`
- Preset data: `apps/lab/src/client/clientPresets.ts`
- Library: `apps/lab/src/components/colorLibrary.ts` (`LIBRARY_COLOR`, `HexColorPopover`)
