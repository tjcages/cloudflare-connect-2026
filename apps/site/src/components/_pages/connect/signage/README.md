# Cloudflare Connect Signage

Route: `/connect/signage/`. Copy lives in `schedule.ts`.

All signage lines use the existing marketing code-snippet `rainLayer` transition:
`01` characters resolve through the shared orange flash into their final color.
Hours remain readable between synchronized 30-second animation cycles. The original Connect hero shader animates behind the
solid white schedule grid and clips at the inner frame.

## Venue display

- Native raster: **7200 × 1620 pixels**, aspect ratio **40:9**.
- Physical size: **29’11.1” × 6’8.8”**.
- Bottom edge: **11’7” above the floor**.
- Ribbon layout activates at 2.5:1 and wider and sizes type from viewport height.
- At native size: headline 550.8 px; days and hours 113.4 px; Happy
  Hour label 129.6 px and time 111.6 px. All final copy uses the marketing text
  token (black in light mode).
- At 2.5:1 and wider, all four items use one equal-height four-column row inside
  the 40vh schedule area. Happy Hour is the fourth card, with its label above
  its time. Narrower layouts keep the three day cards above a full-width Happy
  Hour card. Gutters are 16px; bottom and side insets match at 40px (16px on
  narrow screens).
- Shared `GridArea`, overlay borders, and marketing spacing/color tokens supply
  the grid styling. Every card has a fully opaque white surface.
- The inner frame clips the original shader; a light-gray grid sits outside it.
- Text dimensions and the schedule grid are reserved before the entrance
  animation so the title does not move when the schedule appears.
- All text repeats the existing code-snippet `rainLayer` transition together every
  30 visible seconds, alternating sweep direction. The initial entrance travels
  left to right; the 30-second replay travels right to left; 60 seconds returns
  to left to right. Each orange flash settles back to black. The initial schedule
  entrance follows the title after 1.1 seconds; subsequent sweeps start together.
- Schedule text runs at 1.6× the original animation duration (roughly 0.6–1
  second per line), slower than before while remaining quicker than the title.
- The title opts into a 1.35-second steady directional sweep and a roughly
  2.37-second total transition. The shared helper retains its original defaults
  for code snippets. The heading stays in STK Bureau Sans. Its glyph positions
  are reserved in em units after the font loads, while a single full-size
  orange `0` or `1` moves through the line at a time. The ordered 70ms binary
  pulse prevents adjacent digits from overlapping despite proportional letter
  widths. All signage `01` transitions use the orange marketing token.
- Replays leave letters visible ahead of the sweep. Only the advancing wave
  changes them, eliminating the previous full-title disappearance and reflow.
- A soft white radial gradient behind the title reduces shader contrast without
  adding a visible panel or changing the shader.
- The supplied wide Cloudflare Connect SVG is used only on this signage route.
  It sits 8vh below the inner frame top and scales to 6vh on the LED layout,
  capped at 84px high, so it remains clear of the centered heading.

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
