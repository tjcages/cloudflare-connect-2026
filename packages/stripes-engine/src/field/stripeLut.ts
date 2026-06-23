import type { Stripe } from "../config/types";

export function buildStripeLut(stripes: Stripe[]): Uint8Array {
  const lut = new Uint8Array(256 * 4);
  if (stripes.length === 0) return lut;
  // assume the list is in ascending startFrom order (normalizer preserves input order; defaults are ascending)
  for (let v = 0; v < 256; v++) {
    const t = v / 255;
    let band = 0;
    for (let i = 0; i < stripes.length; i++) {
      if (stripes[i].startFrom <= t) band = i;
    }
    const s = stripes[band];
    const o = v * 4;
    lut[o] = (s.color >> 16) & 255;
    lut[o + 1] = (s.color >> 8) & 255;
    lut[o + 2] = s.color & 255;
    lut[o + 3] = Math.max(0, Math.min(255, Math.round(s.width)));
  }
  return lut;
}

export function lutSignature(stripes: Stripe[]): string {
  return stripes.map((s) => `${s.color}:${s.startFrom}:${s.width}`).join("|");
}
