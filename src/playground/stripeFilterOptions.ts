export type Rgb01 = [number, number, number];

export type StripeDuotoneOptions = {
  /** UI swatch for background (white or black per clip). */
  ignoreColorRgb: Rgb01;
  /** Measured RGB from frame corners; overrides swatch when set. */
  referenceColorRgb?: Rgb01;
  /** Max per-channel distance (0–1) treated as background. */
  ignoreTolerance: number;
  /**
   * Gamma applied before bg matching (< 1 pulls values toward white / thinner fg on light clips).
   */
  gamma: number;
  /** Share of block pixels that must match bg for the cell to count as background (0–1). */
  threshold: number;
  /** Scales fg distance bands for stripe width (lower → thinner / denser stripes). */
  density: number;
};

export const DEFAULT_STRIPE_THRESHOLD = 0.72;
export const DEFAULT_STRIPE_DENSITY = 1;

export const DEFAULT_STRIPE_DUOTONE_OPTIONS: StripeDuotoneOptions = {
  ignoreColorRgb: [1, 1, 1],
  ignoreTolerance: 0.08,
  gamma: 1,
  threshold: DEFAULT_STRIPE_THRESHOLD,
  density: DEFAULT_STRIPE_DENSITY,
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
