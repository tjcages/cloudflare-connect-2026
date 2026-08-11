# Banner 5:1 — style bible

Reference: [`banner-5x1.ref.png`](./banner-5x1.ref.png) (Cloudflare Connect 2026 marketing banner, logo/text ignored).

## Frame

- Aspect ~**5.02:1** (ref 1024×204). Lab canvas: **1600×320**.
- Solid white `#FFFFFF`. No logo/typography in the shader recreate.

## Twizzler (hairline ribbon)

- Continuous fine parallel strokes (not solid fill).
- Path: mid-left entry → multiple dips (~0.09, 0.22, 0.30, 0.48, 0.65, 0.87) → rise/fan top-right.
- Envelope: thin at entry → thick mid/right → wispy exit.
- Depth: denser/more opaque where ribbon comes toward camera; airier where it recedes.
- Color: peach far (`colorFar`) → deep coral near (`colorNear`); sparse magenta/cyan/purple hairline accents.
- Z controls: `depthSpread` widens the bundle near camera; `depthLift` raises Y with nearness.

## Rain (dash envelope)

- Short diagonal dashes (~35–45°), sparse clusters with large gaps (`sparkle.gaps` ~0.85+).
- Gated to Twizzler Map luminance (hairline strokes + thin shoulders) so dashes sit in/around the ribbon, not full-frame.
- Full-spectrum accents: magenta / purple / cyan stripe layers + sparkle `hueDriftDeg` ~180.
- Motion enabled so dashes drift along the field (not a static screen overlay).
