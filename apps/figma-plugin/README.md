# Connect Shader — Figma development plugin

This package is the first local-only Figma MVP. It runs the existing WebGL2 engine inside a Figma plugin UI and inserts the current render into Figma as editable SVG or a PNG image fill.

## Build and install

1. From the repository root, run `pi`.
2. Run `pir --filter connect-figma-plugin build`.
3. Open the Figma desktop app and a Figma Design file.
4. Open **Plugins → Development → Import plugin from manifest…**.
5. Select `apps/figma-plugin/manifest.json`.
6. Run **Connect Shader** from **Plugins → Development**.

After rebuilding, close and reopen the development plugin to load the new bundle.

The deployed web preview is available at `/figma-plugin.html`. It verifies the renderer and responsive plugin UI; Figma document actions only complete inside the development plugin.

## Current MVP

- Live WebGL preview with a built-in demo source.
- Upload a local PNG/JPEG/GIF source.
- Pull the image fill from the selected Figma layer.
- Adjust output size, grid density, gap, angle, background, and stripe colors.
- Insert the result as editable SVG or pixel-accurate PNG.
- Store the complete engine config on the inserted layer for future reopen/edit support.

The manifest intentionally allows no network access. Shared presets and uploaded asset sync can be added later without changing the plugin-to-document bridge.
