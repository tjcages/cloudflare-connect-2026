# Cloudflare Connect Signage

Route: `/connect/signage/`. Copy lives in `schedule.ts`.

The Exhibition Hall title reveals with the marketing `WordFade` component. Hours
and the Happy Hour note follow with the existing binary `Scramble` preset. All
hours remain visible after the entrance so visitors can read them without waiting
for a rotation. The original Connect hero shader stays animated beneath the text.

## Venue display

- Native raster: **7200 × 1620 pixels**, aspect ratio **40:9**.
- Physical size: **29’11.1” × 6’8.8”**.
- Bottom edge: **11’7” above the floor**.
- Ribbon layout activates above 3:1 and sizes type from viewport height.
- At native size: headline 405 px; hours 210.6 px; day names 145.8 px;
  Happy Hour 178.2 px. Important copy uses the dark marketing text token on white.
- Three daily schedules appear side by side. Decorative shader stays below copy.

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
