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
- At native size: headline 486 px; hours and Happy Hour 162 px; day names
  97.2 px. All final copy uses the marketing text token (black in light mode).
- Three daily schedules share the first grid row. Happy Hour spans the full
  second row. Both rows are the same height and align to the frame bottom.
- Shared `GridArea`, overlay borders, and dashed divider components supply the
  marketing grid styling. The white schedule surface is fully opaque.
- The inner frame clips the original shader; a light-gray grid sits outside it.
- Text dimensions and both grid rows are reserved before the entrance animation
  so the title does not move when the schedule appears.
- The title repeats the unchanged code-snippet `rainLayer` transition every
  30 visible seconds, alternating sweep direction. The initial entrance travels
  left to right; the 30-second replay travels right to left; 60 seconds returns
  to left to right. Its orange flash settles back to black.
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
