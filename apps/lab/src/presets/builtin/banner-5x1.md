# Banner 5:1 — style bible

Reference: [`banner-5x1.ref.png`](./banner-5x1.ref.png) (Cloudflare Connect 2026 marketing banner, logo/text ignored).

## Frame

- Aspect ~**5.02:1** (ref 1024×204). Lab canvas: **1600×320**.
- Solid white `#FFFFFF`. No logo/typography in the shader recreate.

## Twizzler (orange-wave ribbon)

- Port of `presets/references/orange-wave-vector.html`: 3D multi-sine layers → rotate → perspective project.
- Defaults: color `#ff6709`, 56 layers, Rotate X/Y/Z = 12° / −18° / 0°, animated `speed: 1`.
- Solid orange hairlines with depth-based opacity/width (no peach→coral fog gradient).

## Rain (dash envelope)

- Short diagonal dashes (~35–45°), sparse clusters with large gaps (`sparkle.gaps` ~0.85+).
- Gated to Twizzler Map luminance (hairline strokes + thin shoulders) so dashes sit in/around the ribbon, not full-frame.
- Full-spectrum accents: magenta / purple / cyan stripe layers + sparkle `hueDriftDeg` ~180.
- Motion enabled so dashes drift along the field (not a static screen overlay).
- **Unchanged** by the orange-wave Twizzler swap — keep Banner rain settings as-is.
