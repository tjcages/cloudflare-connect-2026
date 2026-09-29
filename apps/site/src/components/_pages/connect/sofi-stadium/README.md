# SoFi Stadium

Route: `/connect/sofi-stadium/`. Previews three separate layers on a 6:1 board over
a checkerboard (transparent pixels); the checkboxes toggle each layer.

## Deliverables

Three 30-second videos that loop seamlessly, each with a transparent background:

| Layer    | Loop                                                                     |
| -------- | ------------------------------------------------------------------------ |
| Twizzler | Every sine phase is rounded to whole turns per 30 s (`orangeWavePhase`). |
| Rain     | Deterministic engine; the last 2 s crossfade into a replay of the start. |
| Logo     | Blurs in at 0.3 s, holds, blurs out by 29.5 s; empty frames at the seam. |

- 7680 × 1280 (6:1), 60 fps, 1800 frames.
- ProRes 4444 + alpha (`.mov`, BT.709). Roughly 2 GB (logo) to 14 GB (Twizzler) each.
- Layer order when compositing: Twizzler, then rain, then logo.

## Export

With the site dev server running on port 4399 (`site` launch config), run:

```bash
node scripts/export-sofi-stadium.mjs --out ~/Downloads/sofi-stadium
```

Pass layer names (`twizzler rain logo`) to export a subset, or `--frames 120` for a
quick check. Frames render one by one at full resolution in Chrome, so the export
never drops a frame. The full run takes about 11 minutes on an M3 Pro and needs
Google Chrome plus ffmpeg with `prores_videotoolbox`.
