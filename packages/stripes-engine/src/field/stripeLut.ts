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

export function stripeDotBandEligibility(stripes: Stripe[], density: number): boolean[] {
  const sorted = [...stripes].sort((a, b) => a.startFrom - b.startFrom);
  const clampedDensity = Number.isFinite(density) ? Math.max(0, Math.min(1, density)) : 0;
  const candidates = sorted
    .map((stripe, band) => ({ band, stripe }))
    .filter(({ stripe }) => stripe.width >= 2 && stripe.opacity > 0.001)
    .sort((a, b) => b.stripe.startFrom - a.stripe.startFrom || b.band - a.band);
  const selectedCount = clampedDensity <= 0 ? 0 : Math.ceil(candidates.length * clampedDensity);
  const selectedBands = new Set(candidates.slice(0, selectedCount).map(({ band }) => band));
  return sorted.map((_, band) => selectedBands.has(band));
}

export function buildStripeOpacityLut(stripes: Stripe[], dotDensity = 1): Uint8Array {
  const lut = new Uint8Array(256 * 4);
  if (stripes.length === 0) return lut;
  const sorted = [...stripes].sort((a, b) => a.startFrom - b.startFrom);
  const dotEligibleBands = stripeDotBandEligibility(sorted, dotDensity);
  for (let v = 0; v < 256; v++) {
    const t = v / 255;
    const band = resolveBand(sorted, t);
    const o = v * 4;
    const opacity = band < 0 ? 0 : Math.max(0, Math.min(255, Math.round(sorted[band].opacity * 255)));
    const rampT = band < 0 ? 0 : sorted.length <= 1 ? 1 : band / (sorted.length - 1);
    lut[o] = opacity;
    lut[o + 1] = Math.max(0, Math.min(255, Math.round(rampT * 255)));
    lut[o + 2] = band >= 0 && dotEligibleBands[band] ? 255 : 0;
    lut[o + 3] = 255;
  }
  return lut;
}

export function lutSignature(stripes: Stripe[]): string {
  return stripes.map((s) => `${s.color}:${s.startFrom}:${s.width}:${s.opacity}`).join("|");
}
