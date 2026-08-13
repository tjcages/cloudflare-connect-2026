# Client preview mode (limited Leva)

Shareable review surface for clients / agencies. Uses the **same Lab + Leva UI**, with most folders hidden.

**Production:** always deploy to [`connect-shader`](https://dash.cloudflare.com/944ca70087298faa2e84783db46162c5/workers/services/view/connect-shader/production) — see `docs/deploy.md`.

| URL                   | Role                              |
| --------------------- | --------------------------------- |
| `/` or `/client.html` | Client mode — reduced Leva panels |
| `/lab.html`           | Full authoring lab                |
| `/experiments.html`   | Experiments gallery               |

Canvas preview zoom (bottom-center overlay): **−** / **Reset** / **+** plus a percent readout. Chrome uses a **large radius** (`border-radius: 12px`), not a full pill. There is no Mouse On / Mouse Off control (CF-49). Pointer still drives the shader; that toggle was preview chrome only.

## What clients see (Leva)

Top of the shader panel (scrolls with the panel — not sticky): **Default | Advanced** segmented toggle, **Saved layouts**, and **JSON** (Copy / Upload). Leva starts with **Hero** (Graphic selector) then **Presets**. **Video duration**, **Export Video**, and **Export SVG** follow the Leva folders in the same panel scroll (not a floating footer, and not overlaying expanded folders).

- **Saved layouts** — Save / Apply / Delete named layouts. Saves **all** live Leva values (engine config + lab/Twizzler + Size/Layout/Appearance/Color). **Refresh keeps your live knobs** (localStorage; flushed on `pagehide` so a quick refresh still keeps Speed/Move). Named layouts are only reapplied when you click Apply (or `?preset=`). **Reset** restores Banner 5:1 defaults. Upload JSON also registers a layout.
- **JSON** — **Copy JSON** (clipboard) and **Upload JSON** (import as a saved layout)
- **Default** — rich authoring for the orange-wave ribbon:
- **Hero** — **Graphic** selector: Twizzler / Rain / Both (which asset stack is visible). **Shader** picker appears when Graphic includes Rain (Connect / Spiral / etc.).
  - **Presets** — Size / Layout / **Appearance** (Light / Dark) / Color
    - **Size** — canvas dimensions only (does not touch Twizzler color, geometry, or other shader knobs)
    - **Layout** — ribbon geometry / motion only (does not reapply Color)
    - **Appearance** — stage look defaults: Light = orange Twizzler on white; Dark = cream Twizzler on `#f86a00`. **Background → Color** overrides the Appearance stage color until Appearance is toggled again.
    - **Color** — original stripe palettes for Rain (**Default** = Orange factory, plus Red / Green / Blue / Purple). Twizzler Graphic uses the same catalog for ribbon ink. Orange pair / deep / Light stay as extra ribbon looks.
    - ~~Graphite~~ removed (legacy `graphite` ids normalize to **Light**)
  - **Twizzler → General** — Color mode (Solid / Shared gradient / Shared field / Fiber / Baked), colors, Opacity, Zoom
    - Solid: Color only
    - Shared gradient: 1D ramp (Figma-editable SVG `linearGradient`)
    - Shared field / Fiber: 2D hotspot field (SVG exports as a PNG fill)
    - Baked: Color / left / peaks + **Gradients** folder (X/Y/Z mixes)
  - **Twizzler → Shape** — Center Y, Move X/Y/Z, Amplitude, Rotate X/Y/Z, FOV, Cam Z
  - **Twizzler → Gradients** — X/Y/Z gradient mixes (**Baked** Color mode only)
  - **Twizzler → Stroke** — width, layers, perspective
  - **Twizzler → Motion** — Speed
  - **Background** — Fill (Transparent / Solid / Gradient), Color, Gradient direction + stops. Stage chrome for every Graphic (Twizzler sits on it); not nested under Rain.
  - **Rain** — parent folder (collapsed by default) with Shader config, Stripes, Grid, Background Stars/Meteors/Flames, Sparkle, etc. when Graphic includes Rain
- **Hero → Graphic** (no page reload; toggles layers live; **never wipes** Twizzler or Rain knobs):
  - **Twizzler** — orange-wave ribbon only (**Twizzler** parent folders; **Rain** parent hidden). **Background** Fill/Color/Gradient stay visible. Rain FX (frames, stars, meteors, flames, sparkle, letters) are not drawn.
  - **Rain** — rain/Connect stack under a **Rain** parent (**Twizzler** parent hidden). **Shader** dropdown in Hero (Connect / Spiral / etc.). Texture sidebar (Camera / Tone) when Rain is on. Graphic selection persists across refresh.
  - **Both** — **Twizzler** and **Rain** parents both visible so each stack can be collapsed independently. Rain FX draw when authored on.- **Presets** (Size / Layout / Appearance / Color) stay the same catalog. When Graphic is Rain they map onto Rain/Connect knobs; when Twizzler onto ribbon knobs; when Both onto both stacks.
- **Advanced** — reveals the same registered knobs (View, Edges, Noise, wrinkles/bends/depth, etc.) without rebuilding Leva, so values are not wiped when toggling.

## Twizzler (orange-wave)

Current ribbon geometry is the **orange-wave** 3D projected vector from
`apps/lab/src/presets/references/orange-wave-vector.html` (ported into `twizzler.ts`).

- Stroke colors use **COLOR_LIBRARY** (X: Orange Pair→Accent, Y peaks: Red Accent; HTML #ffcc33/#ff6709/#ff2a2a snapped)
- Background: Neutral White (`#ffffff`), solid — not the HTML demo black
- Z fade: far / +Z lerps ink **toward stage background color** (not HTML opacity modulate)
- Move X/Y = pixel translate after projection; Move Z = post-fit dolly (closer/farther)
- Zoom is unbounded (no L/R lock / vertical stretch)
- ~56 layers, Rotate X/Y/Z (defaults 12° / −18° / 0°), `lineWidth` ~1.15, dense sampling (≥160 pts)
- Rain is selected via **Hero → Graphic** (Twizzler / Rain / Both). Twizzler mode = ribbon only (rain canvas hidden so it doesn’t cover the shader). Rain / Both = individual rain rects from the section-grid stripe engine (`sparkle.gaps`). Export omits rain paths in Twizzler mode; Twizzler exports whenever Graphic includes Twizzler / Both.
- Reference: `apps/lab/src/presets/references/orange-wave-vector.html`

## Exports

Client panel (and lab) expose:

- **Save** — named localStorage preset with **complete** `config` + `lab` (Twizzler, Color mode, rain, Size/Layout/Color ids, background fill, etc.)
- **Apply / Delete** — restore or remove saved layouts (builtins stay read-only; user layouts keep transparent/gradient fills)
- **Reset** — restore Banner 5:1 defaults (keeps named saved layouts)
- **Copy JSON** — copy full lab configuration to the clipboard
- **Upload JSON** — import a config file as a saved layout and apply it
- **Video duration** / **Export Video** — high-quality MediaRecorder (60fps, high bitrate) + ffmpeg.wasm (libx264 veryslow / CRF 14). Button shows progress (Recording / Converting) and stays disabled until the export finishes.
- **Export SVG** — filled ribbon paths (auto outline-stroke). Mode from **Color mode**: Solid (one fill/fiber), Shared gradient (one artboard-wide 1D `linearGradient` masked by all ribbons — Figma can edit stops), Shared field (one 2D hotspot PNG sized to the SVG frame, masked by ribbons), Fiber gradient (per-ribbon 2D field PNG sized to that ribbon’s box), Baked (segmented X/Y/Z). Twizzler exports when Graphic is Twizzler or Both. **Rain** / **Both** add stripe-rect paths; Twizzler-only Graphic exports ribbon (+ background) without rain.

## Next HTML → Leva mapping (do this on the next drop)

When the nicer orange-wave HTML arrives, wire **every** HTML control into Leva (Default for client knobs, Advanced for fine ones). Keep the color library — no freeform-only hex fields.

| HTML / design control        | Leva folder               | Notes                                                               |
| ---------------------------- | ------------------------- | ------------------------------------------------------------------- |
| Stroke color                 | Presets → Color (Default) | `colorLibraryInputPlugin` → `LIBRARY_COLOR.*` / Orange tokens       |
| Background                   | Background → Fill + Color | Library Neutral White / Neutral steps; visible for every Graphic    |
| Twizzler on/off              | Hero → Graphic            | Twizzler / Both drives `twizzlerEnabled`                            |
| Color mode                   | Twizzler → Color mode     | Solid / Shared gradient / Shared field / Fiber gradient / Baked     |
| Rain on/off                  | Hero → Graphic            | Rain / Both → `rainEnabled` → `sparkle.gaps` (section-grid lineage) |
| Zoom / Move X/Y/Z            | Twizzler → General/Shape  | Zoom + translate live in Default                                    |
| Rotate X/Y/Z                 | Twizzler → Shape          | already live in Default                                             |
| Layer count / width / points | Twizzler → Stroke         | Default                                                             |
| Speed / pause                | Twizzler → Motion         | `speed` (0 = freeze)                                                |
| Wave amplitude / envelope    | Twizzler → Shape          | Amplitude + Center Y in Default                                     |
| Any new HTML sliders         | Twizzler Shape/Motion     | add settings + normalize + Leva                                     |

Colors in the HTML that are not exact library hexes get **snapped** to the nearest `COLOR_LIBRARY` token (prefer Accent / Pair levels). Do not invent a parallel palette. Color selectors show the library token name (e.g. `Orange / 900 [Accent]`) when the value matches; focus the field to edit hex.

## Implementation

- Boot: `apps/lab/src/client-main.tsx` → keep live localStorage on refresh; seed Banner 5:1 knobs on first visit at **Hero 16:9** canvas (or `?preset=`) → `<LabApp clientMode />`
- Saved layouts: `apps/lab/src/client/savedLayouts.ts` + shared `presets.ts` storage; **Reset** reapplies Banner 5:1
- Default Size catalog entry: **Hero 16:9** (`DEFAULT_CLIENT_PREVIEW_STATE`)
- Both-mode perf: Shared Field ribbons draw in one pass; client Both soft-caps Twizzler ~30fps (rain source stays full-rate like production)
- Gating: `drawerFolder({ hideInClient, clientOnly })` + `showTwizzlerAuthoring` / `showFullLab` in `controls/levaSchema.ts`
- Preset data: `apps/lab/src/client/clientPresets.ts`
- Section-grid Rain bootstrap: `apps/lab/src/client/sectionGridRainDefaults.ts` → `applyPresetToStorage(factoryDefaults)` (same as Factory reset)
- Library: `apps/lab/src/components/colorLibrary.ts` (`LIBRARY_COLOR`, `HexColorPopover`)
