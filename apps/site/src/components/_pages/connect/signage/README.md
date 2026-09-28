# Cloudflare Connect Signage

Route: `/connect/signage/`. Copy lives in `schedule.ts`.

All signage lines use the existing marketing code-snippet `rainLayer` transition:
`01` characters resolve through the shared orange flash into their final color.
Hours remain visible after the entrance so visitors can read them without
waiting for a rotation. The original Connect hero shader animates behind the
solid white schedule grid and clips at the inner frame.

## Venue display

- Native raster: **7200 × 1620 pixels**, aspect ratio **40:9**.
- Physical size: **29’11.1” × 6’8.8”**.
- Bottom edge: **11’7” above the floor**.
- Ribbon layout activates above 3:1 and sizes type from viewport height.
- At native size: headline 550.8 px; days and hours 113.4 px; Happy Hour
  162 px. All final copy uses the marketing text token (black in light mode).
- Three daily schedules share the first grid row. Happy Hour spans the full
  second row. Both rows are the same height inside a 40vh schedule area, with
  16px gutters between rows and between day cards. Bottom and side insets
  match at 40px (16px on narrow screens).
- Shared `GridArea`, overlay borders, and marketing spacing/color tokens supply
  the grid styling. Every card has a fully opaque white surface.
- The inner frame clips the original shader; a light-gray grid sits outside it.
- Text dimensions and both grid rows are reserved before the entrance animation
  so the title does not move when the schedule appears.
- The title repeats the existing code-snippet `rainLayer` transition every
  30 visible seconds, alternating sweep direction. The initial entrance travels
  left to right; the 30-second replay travels right to left; 60 seconds returns
  to left to right. Its orange flash settles back to black.
- The title opts into a 1.8-second steady directional sweep and a roughly
  3.16-second total transition. The shared helper retains its original defaults
  for code snippets. Proportional glyph advances are measured after fonts load,
  reserved in em units, and the binary digits fit within those widths.
- Replays leave letters visible ahead of the sweep. Only the advancing wave
  changes them, eliminating the previous full-title disappearance and reflow.
- The logo sits 8vh below the inner frame top in the LED layout.

## Final delivery specification (future work)

No video export is requested yet. The browser preview is the current deliverable.

- Motion: MP4, H.265/HEVC, minimum 60 fps with no dropped frames, no audio,
  file size below 1 GB.
- Static: PNG or JPG, RGB, 72 DPI, native pixel dimensions.
- Playback: continuous loop or up to four scheduled periods per day.

Before final export, use a deterministic 60 fps render and validate every frame,
loop seam, encoding, dimensions, duration and file size. The preview intentionally
reuses the source shader's frame-rate limits; browser capture alone is not proof
of the final 60 fps requirement.
