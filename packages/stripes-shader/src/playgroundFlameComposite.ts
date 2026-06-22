/** Composite premultiplied flame RGB over the source as light (mirrors the preview shader). */
export function mergeFlameColorBytes(
  sourceR: number,
  sourceG: number,
  sourceB: number,
  flameR: number,
  flameG: number,
  flameB: number,
  mask: number,
): { r: number; g: number; b: number; hasFlame: boolean } {
  const fr = flameR * mask;
  const fg = flameG * mask;
  const fb = flameB * mask;
  const flameCover = Math.max(fr, fg, fb) / 255;
  if (flameCover < 0.001) {
    return { r: sourceR, g: sourceG, b: sourceB, hasFlame: false };
  }

  // The flame raster is white/colored streaks drawn over opaque black, so flameR/G/B are
  // premultiplied (channel = straightColor * coverage). Un-premultiply to the straight color
  // before compositing so partial-coverage flames add light toward the flame color (white =
  // brighter cells), instead of pulling bright cells down toward gray/black.
  const unpremul = (flame: number) => Math.min(255, flame / flameCover);
  const mixChannel = (source: number, flame: number) =>
    Math.round(Math.min(255, Math.max(0, source + (flame - source) * flameCover)));

  return {
    r: mixChannel(sourceR, unpremul(fr)),
    g: mixChannel(sourceG, unpremul(fg)),
    b: mixChannel(sourceB, unpremul(fb)),
    hasFlame: fr > 0 || fg > 0 || fb > 0,
  };
}
