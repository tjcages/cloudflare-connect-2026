/** Rec.709 relative luminance, 0 (black) … 1 (white). */
export function pixelLuminance(r: number, g: number, b: number): number {
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
}

export type TextureLuminanceMode = "luminance" | "colors";

export type TextureLuminanceSettings = {
  mode: TextureLuminanceMode;
  backgroundColor: number;
};

export const DEFAULT_TEXTURE_LUMINANCE_MODE: TextureLuminanceMode = "luminance";
export const DEFAULT_TEXTURE_LUMINANCE_BACKGROUND_COLOR = 0x000000;

export const DEFAULT_TEXTURE_GAMMA = 1;
export const TEXTURE_GAMMA_MIN = 0.05;
export const TEXTURE_GAMMA_MAX = 5;

export function normalizeTextureLuminanceMode(value: unknown): TextureLuminanceMode {
  return value === "colors" ? "colors" : DEFAULT_TEXTURE_LUMINANCE_MODE;
}

export function normalizeTextureLuminanceBackgroundColor(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value & 0xffffff;
  }
  if (typeof value === "string") {
    const trimmed = value.trim().replace(/^#/, "");
    if (/^[\da-f]{6}$/i.test(trimmed)) {
      const parsed = Number.parseInt(trimmed, 16);
      return Number.isFinite(parsed) ? parsed & 0xffffff : DEFAULT_TEXTURE_LUMINANCE_BACKGROUND_COLOR;
    }
  }
  return DEFAULT_TEXTURE_LUMINANCE_BACKGROUND_COLOR;
}

export function normalizeTextureGamma(value: number): number {
  if (!Number.isFinite(value)) {
    return DEFAULT_TEXTURE_GAMMA;
  }
  return Math.max(TEXTURE_GAMMA_MIN, value);
}

export function colorDistanceLuminance(r: number, g: number, b: number, backgroundColor: number): number {
  const bg = normalizeTextureLuminanceBackgroundColor(backgroundColor);
  const br = (bg >> 16) & 0xff;
  const bgc = (bg >> 8) & 0xff;
  const bb = bg & 0xff;
  const dr = r - br;
  const dg = g - bgc;
  const db = b - bb;
  return Math.min(1, Math.sqrt(dr * dr + dg * dg + db * db) / (255 * Math.sqrt(3)));
}

/** HSL saturation in 0–1 from 0–255 RGB channels. */
export function pixelSaturation(r: number, g: number, b: number): number {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  if (max <= 0) {
    return 0;
  }
  return (max - min) / max;
}

/** Minimum RGB distance from the texture background to count as foreground. */
export const COLOR_DISTANCE_EPSILON = 0.04;

/** Saturation above this uses the vivid boost; neutral blacks/grays use distance only. */
export const COLOR_SATURATION_EPSILON = 0.02;

/** @deprecated Use COLOR_DISTANCE_EPSILON */
export const COLOR_PRESENCE_EPSILON = COLOR_DISTANCE_EPSILON;

function rgbToHexByte(r: number, g: number, b: number): number {
  return ((r & 0xff) << 16) | ((g & 0xff) << 8) | (b & 0xff);
}

/** Samples image edges and returns the most common RGB (typical canvas background). */
export function detectTextureBackgroundColor(
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
): number {
  if (width <= 0 || height <= 0 || pixels.length < width * height * 4) {
    return DEFAULT_TEXTURE_LUMINANCE_BACKGROUND_COLOR;
  }

  const counts = new Map<number, number>();
  const sample = (x: number, y: number) => {
    const clampedX = Math.min(width - 1, Math.max(0, x));
    const clampedY = Math.min(height - 1, Math.max(0, y));
    const idx = (clampedY * width + clampedX) * 4;
    const key = rgbToHexByte(pixels[idx] ?? 0, pixels[idx + 1] ?? 0, pixels[idx + 2] ?? 0);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  };

  for (let x = 0; x < width; x++) {
    sample(x, 0);
    sample(x, height - 1);
  }
  for (let y = 0; y < height; y++) {
    sample(0, y);
    sample(width - 1, y);
  }

  let bestColor = DEFAULT_TEXTURE_LUMINANCE_BACKGROUND_COLOR;
  let bestCount = -1;
  for (const [color, count] of counts) {
    if (count > bestCount) {
      bestCount = count;
      bestColor = color;
    }
  }
  return bestColor;
}

/** Colors-mode strength for stripe bucketing and coverage. */
export function colorPixelPresence(r: number, g: number, b: number, backgroundColor: number): number {
  const distance = colorDistanceLuminance(r, g, b, backgroundColor);
  const saturation = pixelSaturation(r, g, b);
  if (saturation <= COLOR_SATURATION_EPSILON) {
    return distance;
  }
  return distance * (0.2 + 0.8 * saturation);
}

/** @deprecated Alias for colorPixelPresence */
export function colorChromaPresence(r: number, g: number, b: number, backgroundColor: number): number {
  return colorPixelPresence(r, g, b, backgroundColor);
}

export function isNonBackgroundColorPixel(
  r: number,
  g: number,
  b: number,
  backgroundColor: number,
  distanceEpsilon: number = COLOR_DISTANCE_EPSILON,
): boolean {
  return colorDistanceLuminance(r, g, b, backgroundColor) > distanceEpsilon;
}

export function pixelTextureLuminance(
  r: number,
  g: number,
  b: number,
  settings?: Partial<TextureLuminanceSettings>,
): number {
  return normalizeTextureLuminanceMode(settings?.mode) === "colors"
    ? colorPixelPresence(r, g, b, settings?.backgroundColor ?? DEFAULT_TEXTURE_LUMINANCE_BACKGROUND_COLOR)
    : pixelLuminance(r, g, b);
}

/** Remap sampled texture luminance before stripe bucketing. */
export function applyTextureLuminanceGamma(luma01: number, gamma: number): number {
  const x = Math.min(1, Math.max(0, luma01));
  const normalizedGamma = normalizeTextureGamma(gamma);
  if (normalizedGamma === 1) {
    return x;
  }
  return Math.pow(x, normalizedGamma);
}
