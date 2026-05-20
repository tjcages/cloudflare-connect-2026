export type Rgb01 = [number, number, number];

export type StripeDuotoneOptions = {
  /** UI swatch for background (typically white). */
  ignoreColorRgb: Rgb01;
  /** Measured min(R,G,B) whiteness from frame corners; overrides swatch when set. */
  referenceWhiteness?: number;
  /** Pixels at least this close to reference whiteness are treated as bg. */
  ignoreTolerance: number;
};

export const DEFAULT_STRIPE_DUOTONE_OPTIONS: StripeDuotoneOptions = {
  ignoreColorRgb: [1, 1, 1],
  ignoreTolerance: 0.08,
};

export function hexToRgb01(hex: string): Rgb01 {
  const normalized = hex.trim().replace(/^#/, "");
  const expanded =
    normalized.length === 3
      ? normalized
          .split("")
          .map((ch) => ch + ch)
          .join("")
      : normalized;
  const value = Number.parseInt(expanded, 16);
  if (!Number.isFinite(value) || expanded.length !== 6) {
    return [1, 1, 1];
  }
  return [(value >> 16) / 255, ((value >> 8) & 255) / 255, (value & 255) / 255];
}

export function rgb01ToHex([r, g, b]: Rgb01): string {
  const toByte = (channel: number) =>
    Math.round(Math.min(1, Math.max(0, channel)) * 255)
      .toString(16)
      .padStart(2, "0");
  return `#${toByte(r)}${toByte(g)}${toByte(b)}`;
}
