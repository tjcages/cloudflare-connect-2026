import type { Stripe } from "../config/types";

export const WIDTH_LUT_SCALE = 2;

function resolveBand(sorted: Stripe[], t: number): number {
  let band = -1;
  for (let i = 0; i < sorted.length; i++) if (sorted[i].startFrom <= t) band = i;
  return band;
}

export function buildStripeLut(stripes: Stripe[]): Uint8Array {
  const lut = new Uint8Array(256 * 4);
  if (stripes.length === 0) return lut;
  const sorted = [...stripes].sort((a, b) => a.startFrom - b.startFrom);
  for (let v = 0; v < 256; v++) {
    const t = v / 255;
    const band = resolveBand(sorted, t);
    const o = v * 4;
    if (band < 0) {
      lut[o] = lut[o + 1] = lut[o + 2] = lut[o + 3] = 0;
      continue;
    } // no stripe
    const s = sorted[band];
    lut[o] = (s.color >> 16) & 255;
    lut[o + 1] = (s.color >> 8) & 255;
    lut[o + 2] = s.color & 255;
    lut[o + 3] = Math.max(0, Math.min(255, Math.round(s.width * WIDTH_LUT_SCALE)));
  }
  return lut;
}

export function buildStripeOpacityLut(stripes: Stripe[]): Uint8Array {
  const lut = new Uint8Array(256 * 4);
  if (stripes.length === 0) return lut;
  const sorted = [...stripes].sort((a, b) => a.startFrom - b.startFrom);
  for (let v = 0; v < 256; v++) {
    const t = v / 255;
    const band = resolveBand(sorted, t);
    const o = v * 4;
    const opacity = band < 0 ? 0 : Math.max(0, Math.min(255, Math.round(sorted[band].opacity * 255)));
    lut[o] = lut[o + 1] = lut[o + 2] = opacity;
    lut[o + 3] = 255;
  }
  return lut;
}

export function lutSignature(stripes: Stripe[]): string {
  return stripes.map((s) => `${s.color}:${s.startFrom}:${s.width}:${s.opacity}`).join("|");
}
