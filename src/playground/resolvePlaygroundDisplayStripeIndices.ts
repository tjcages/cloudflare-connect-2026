import { overlayInvertsStripeBucketing, type TextureLuminanceMode } from "./colorWhiteness";
import { applyCursorTrailCell, type CursorTrailCellMap } from "./cursorTrailOverlay";
import { buildStripeIndexLut, resolveStripesForLuminanceMode, type StripeColors } from "./stripeColors";

/** Mirrors the cursor-trail band lift applied in the stripe shader and letter layer. */
export function applyTrailStripeIndices(
  baseIndices: Uint8Array,
  luma: Uint8Array,
  trailMap: CursorTrailCellMap | null | undefined,
  lut: Uint8Array,
  inverted: boolean,
): Uint8Array {
  const out = new Uint8Array(baseIndices.length);
  for (let i = 0; i < baseIndices.length; i++) {
    const whiteAlpha = trailMap?.whiteAlpha[i] ?? 0;
    const tear = trailMap?.tear[i] ?? 0;
    if (!trailMap || (whiteAlpha <= 0.002 && tear <= 0.002)) {
      out[i] = baseIndices[i] ?? 0;
      continue;
    }

    let luma01 = (luma[i] ?? 0) / 255;
    luma01 = inverted ? luma01 + (1 - luma01) * tear : luma01 * (1 - tear);
    const presence = inverted ? 1 - luma01 : luma01;
    const presenceT = Math.min(1, Math.max(0, presence / 0.25));
    const lift = whiteAlpha * presenceT * presenceT * (3 - 2 * presenceT);
    luma01 = applyCursorTrailCell(luma01, lift, inverted);
    const trailBand = lut[Math.min(255, Math.floor(luma01 * 256))] ?? 0;
    const base = baseIndices[i] ?? 0;
    out[i] = !inverted && tear <= 0.002 ? Math.max(base, trailBand) : trailBand;
  }
  return out;
}

export function resolvePlaygroundDisplayStripeLut(
  colors: StripeColors,
  luminanceMode: TextureLuminanceMode,
): Uint8Array {
  return buildStripeIndexLut(resolveStripesForLuminanceMode(colors, luminanceMode));
}

export function resolvePlaygroundDisplayStripeIndices(
  baseIndices: Uint8Array,
  luma: Uint8Array | undefined,
  colors: StripeColors,
  luminanceMode: TextureLuminanceMode,
  trailMap: CursorTrailCellMap | null | undefined,
): Uint8Array {
  if (!luma || luma.length !== baseIndices.length) {
    return new Uint8Array(baseIndices);
  }
  const lut = resolvePlaygroundDisplayStripeLut(colors, luminanceMode);
  const inverted = overlayInvertsStripeBucketing(luminanceMode);
  return applyTrailStripeIndices(baseIndices, luma, trailMap, lut, inverted);
}
