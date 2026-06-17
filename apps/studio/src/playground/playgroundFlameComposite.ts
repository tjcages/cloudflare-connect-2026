/** Blend source + flame RGB to match preview shader mix(source, flame, flameCover). */
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

  const mixChannel = (source: number, flame: number) =>
    Math.round(Math.min(255, Math.max(0, source + (flame - source) * flameCover)));

  return {
    r: mixChannel(sourceR, fr),
    g: mixChannel(sourceG, fg),
    b: mixChannel(sourceB, fb),
    hasFlame: fr > 0 || fg > 0 || fb > 0,
  };
}
