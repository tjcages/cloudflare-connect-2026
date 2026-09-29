# Cloudflare Connect Signage

Route: `/connect/signage/`. Copy lives in `schedule.ts`.

One sign per day: `?day=monday`, `?day=tuesday` or `?day=wednesday` shows only
that day's card plus Happy Hour, centered at the four-up card width. No param (or
an unknown value) shows every day.

Layout variant: `?layout=horizontal` keeps the title on the left and stacks larger
cards in a right-hand column (combine with `?day=`).

All signage lines use the existing marketing code-snippet `rainLayer` transition:
`01` characters resolve through the shared orange flash into their final color.
Hours remain readable between synchronized 30-second animation cycles. The original Connect hero shader animates behind the
solid white schedule grid and clips at the inner frame.

## Venue display

- Native raster: **7200 × 1620 pixels**, aspect ratio **40:9**.
- Physical size: **29’11.1” × 6’8.8”**.
- Bottom edge: **11’7” above the floor**.
- The artwork always stays **40:9**, centered and contained within the viewport. It
  does not reflow when the browser is resized. Extra space shows the marketing
  light-gray surround instead of stretching or cropping the artwork.
- The frame, logo, headline, schedule, gutters and card padding scale together
  from the frame width using container units. The four opaque white schedule
  cards stay in one equal-height row at every viewport shape; Happy Hour is
  the fourth card with its time below the label.
- The shared `GridArea` draws the gray surround's responsive grid texture.
  Its cells scale from 32px to 80px with the viewport; the existing dashed
  border color token gives the lines enough contrast to remain visible.
- The inner frame clips the original shader and keeps the logo above the title
  gradient.
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
- A slightly wider soft white radial gradient behind the title reduces shader
  contrast without adding a visible panel or changing the shader. The title sits
  0.4 container-width units lower within its reserved region.
- The supplied wide Cloudflare Connect SVG is used only on this signage route.
  It stays centered 1.8 container-width units below the frame top and scales
  to 1.48% of the frame width, clear of the heading.

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
