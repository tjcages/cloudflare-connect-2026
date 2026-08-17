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
    lut[o + 3] = band < 0 ? 0 : Math.min(255, band + 1);
  }
  return lut;
}

/**
 * Band index → a source value that lands in that band, as a byte.
 *
 * The edge mask walks a cell DOWN the authored ladder, which needs both
 * directions of the value↔band mapping: `buildStripeOpacityLut` carries
 * value→band in its alpha channel, and this carries band→value. Together they
 * let the shader re-enter the existing LUTs at a lower band and read that
 * band's authored width, opacity and colour rather than scaling anything.
 *
 * The values come from scanning the same `resolveBand` the LUTs are built from,
 * so the two can never disagree. A band whose value range is too narrow to
 * contain any of the 256 bytes is unreachable through the LUT at all, so it
 * inherits the nearest reachable band below it and the walk still terminates.
 */
export function buildBandValueLut(stripes: Stripe[]): Uint8Array {
  const lut = new Uint8Array(256 * 4);
  if (stripes.length === 0) return lut;
  const sorted = [...stripes].sort((a, b) => a.startFrom - b.startFrom);
  const firstValue = new Int32Array(sorted.length).fill(-1);
  for (let v = 0; v < 256; v++) {
    const band = resolveBand(sorted, v / 255);
    if (band >= 0 && firstValue[band] < 0) firstValue[band] = v;
  }
  let reachable = 0;
  for (let band = 0; band < Math.min(sorted.length, 256); band++) {
    if (firstValue[band] >= 0) reachable = firstValue[band];
    lut[band * 4] = reachable;
    lut[band * 4 + 3] = 255;
  }
  return lut;
}

export function lutSignature(stripes: Stripe[]): string {
  return stripes.map((s) => `${s.color}:${s.startFrom}:${s.width}:${s.opacity}`).join("|");
}
