import {
  DEFAULT_TEXTURE_LUMINANCE_BACKGROUND_COLOR,
  DEFAULT_TEXTURE_GAMMA,
  normalizeTextureGamma,
  normalizeTextureLuminanceBackgroundColor,
  pixelTextureLuminance,
  type TextureLuminanceSettings,
} from "./colorWhiteness";

export type PlaygroundTextureAdjustments = {
  brightness: number;
  exposure: number;
  contrast: number;
  blackPoint: number;
  whitePoint: number;
  gamma: number;
  invert: boolean;
  posterizeLevels: number;
  thresholdBias: number;
  noiseAmount: number;
  blurRadius: number;
  sharpenAmount: number;
};

export const DEFAULT_PLAYGROUND_TEXTURE_ADJUSTMENTS: PlaygroundTextureAdjustments = {
  brightness: 0,
  exposure: 0,
  contrast: 1,
  blackPoint: 0,
  whitePoint: 1,
  gamma: DEFAULT_TEXTURE_GAMMA,
  invert: false,
  posterizeLevels: 0,
  thresholdBias: 0,
  noiseAmount: 0,
  blurRadius: 0,
  sharpenAmount: 0,
};

function clampNumber(value: unknown, min: number, max: number, fallback: number): number {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return fallback;
  }
  return Math.min(max, Math.max(min, numeric));
}

function clampInt(value: unknown, min: number, max: number, fallback: number): number {
  return Math.round(clampNumber(value, min, max, fallback));
}

export function normalizePlaygroundTextureAdjustments(
  input: Partial<PlaygroundTextureAdjustments> | undefined,
): PlaygroundTextureAdjustments {
  const base = DEFAULT_PLAYGROUND_TEXTURE_ADJUSTMENTS;
  if (!input) {
    return { ...base };
  }

  const blackPoint = clampNumber(input.blackPoint ?? base.blackPoint, 0, 1, base.blackPoint);
  const whitePoint = clampNumber(input.whitePoint ?? base.whitePoint, blackPoint + 0.01, 1, base.whitePoint);

  return {
    brightness: clampNumber(input.brightness ?? base.brightness, -1, 1, base.brightness),
    exposure: clampNumber(input.exposure ?? base.exposure, -5, 5, base.exposure),
    contrast: clampNumber(input.contrast ?? base.contrast, 0, 4, base.contrast),
    blackPoint,
    whitePoint,
    gamma: normalizeTextureGamma(Number(input.gamma ?? base.gamma)),
    invert: input.invert === true,
    posterizeLevels: clampInt(input.posterizeLevels ?? base.posterizeLevels, 0, 16, base.posterizeLevels),
    thresholdBias: clampNumber(input.thresholdBias ?? base.thresholdBias, -1, 1, base.thresholdBias),
    noiseAmount: clampNumber(input.noiseAmount ?? base.noiseAmount, 0, 1, base.noiseAmount),
    blurRadius: clampNumber(input.blurRadius ?? base.blurRadius, 0, 4, base.blurRadius),
    sharpenAmount: clampNumber(input.sharpenAmount ?? base.sharpenAmount, 0, 4, base.sharpenAmount),
  };
}

export function isDefaultPlaygroundTextureAdjustments(input: PlaygroundTextureAdjustments): boolean {
  const base = DEFAULT_PLAYGROUND_TEXTURE_ADJUSTMENTS;
  return (
    input.brightness === base.brightness &&
    input.exposure === base.exposure &&
    input.contrast === base.contrast &&
    input.blackPoint === base.blackPoint &&
    input.whitePoint === base.whitePoint &&
    input.gamma === base.gamma &&
    input.invert === base.invert &&
    input.posterizeLevels === base.posterizeLevels &&
    input.thresholdBias === base.thresholdBias &&
    input.noiseAmount === base.noiseAmount &&
    input.blurRadius === base.blurRadius &&
    input.sharpenAmount === base.sharpenAmount
  );
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function lumaNoiseHash(col: number, row: number): number {
  const x = Math.sin((col + 17) * 12.9898 + (row + 31) * 78.233) * 43758.5453;
  return x - Math.floor(x);
}

function applyGamma(luma: number, gamma: number): number {
  const normalizedGamma = normalizeTextureGamma(gamma);
  if (normalizedGamma === 1) {
    return luma;
  }
  return Math.pow(luma, normalizedGamma);
}

export function applyTextureLuminanceAdjustments(
  luma01: number,
  adjustmentsInput: PlaygroundTextureAdjustments,
  col = 0,
  row = 0,
): number {
  const adjustments = normalizePlaygroundTextureAdjustments(adjustmentsInput);
  let value = clamp01(luma01);

  value = clamp01((value - adjustments.blackPoint) / (adjustments.whitePoint - adjustments.blackPoint));
  value = applyGamma(value, adjustments.gamma);
  value = clamp01(value * 2 ** adjustments.exposure);
  value = clamp01((value - 0.5) * adjustments.contrast + 0.5);
  value = clamp01(value + adjustments.brightness + adjustments.thresholdBias);

  if (adjustments.noiseAmount > 0) {
    value = clamp01(value + (lumaNoiseHash(col, row) * 2 - 1) * adjustments.noiseAmount);
  }
  if (adjustments.invert) {
    value = 1 - value;
  }
  if (adjustments.posterizeLevels >= 2) {
    const steps = adjustments.posterizeLevels - 1;
    value = Math.round(value * steps) / steps;
  }

  return clamp01(value);
}

/** Match preview shader tone mapping: scale RGB by adjusted / source luminance. */
export function applyTextureRgbAdjustments(
  r: number,
  g: number,
  b: number,
  adjustmentsInput: PlaygroundTextureAdjustments,
  luminanceSettings?: Partial<TextureLuminanceSettings>,
  col = 0,
  row = 0,
): { r: number; g: number; b: number } {
  const luma = pixelTextureLuminance(r, g, b, luminanceSettings);
  const adjusted = applyTextureLuminanceAdjustments(luma, adjustmentsInput, col, row);
  if (luma <= 0.0001) {
    const gray = Math.round(adjusted * 255);
    return { r: gray, g: gray, b: gray };
  }
  const scale = adjusted / luma;
  return {
    r: Math.round(Math.min(255, Math.max(0, r * scale))),
    g: Math.round(Math.min(255, Math.max(0, g * scale))),
    b: Math.round(Math.min(255, Math.max(0, b * scale))),
  };
}

/** Flatten transparent RGBA onto a solid background before blur/sampling. */
export function compositeRgbaOverBackground(
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
  backgroundColor: number,
): Uint8ClampedArray {
  const bgR = (backgroundColor >> 16) & 0xff;
  const bgG = (backgroundColor >> 8) & 0xff;
  const bgB = backgroundColor & 0xff;
  const composited = new Uint8ClampedArray(pixels.length);
  for (let i = 0; i < pixels.length; i += 4) {
    const alpha = (pixels[i + 3] ?? 255) / 255;
    composited[i] = Math.round((pixels[i] ?? 0) * alpha + bgR * (1 - alpha));
    composited[i + 1] = Math.round((pixels[i + 1] ?? 0) * alpha + bgG * (1 - alpha));
    composited[i + 2] = Math.round((pixels[i + 2] ?? 0) * alpha + bgB * (1 - alpha));
    composited[i + 3] = 255;
  }
  return composited;
}

function boxBlurRgbaPixels(
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
  blurRadius: number,
): Uint8ClampedArray {
  const blurred = new Uint8ClampedArray(pixels.length);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let rSum = 0;
      let gSum = 0;
      let bSum = 0;
      let aSum = 0;
      let count = 0;
      for (let dy = -blurRadius; dy <= blurRadius; dy++) {
        for (let dx = -blurRadius; dx <= blurRadius; dx++) {
          const sampleX = x + dx;
          const sampleY = y + dy;
          if (sampleX < 0 || sampleY < 0 || sampleX >= width || sampleY >= height) {
            continue;
          }
          const idx = (sampleY * width + sampleX) * 4;
          rSum += pixels[idx] ?? 0;
          gSum += pixels[idx + 1] ?? 0;
          bSum += pixels[idx + 2] ?? 0;
          aSum += pixels[idx + 3] ?? 255;
          count += 1;
        }
      }
      const divisor = Math.max(1, count);
      const out = (y * width + x) * 4;
      blurred[out] = Math.round(rSum / divisor);
      blurred[out + 1] = Math.round(gSum / divisor);
      blurred[out + 2] = Math.round(bSum / divisor);
      blurred[out + 3] = Math.round(aSum / divisor);
    }
  }
  return blurred;
}

/** CPU preview path: composite, blur/sharpen, then tone-map every pixel. */
export function renderAdjustedPreviewPixels(
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
  adjustmentsInput: PlaygroundTextureAdjustments,
  luminanceSettings?: Partial<TextureLuminanceSettings>,
): Uint8ClampedArray {
  const backgroundColor = normalizeTextureLuminanceBackgroundColor(
    luminanceSettings?.backgroundColor ?? DEFAULT_TEXTURE_LUMINANCE_BACKGROUND_COLOR,
  );
  const adjustments = normalizePlaygroundTextureAdjustments(adjustmentsInput);
  const composited = compositeRgbaOverBackground(pixels, width, height, backgroundColor);
  const filtered = blurRgbaPixels(composited, width, height, adjustments);
  const output = new Uint8ClampedArray(filtered.length);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const adjusted = applyTextureRgbAdjustments(
        filtered[i] ?? 0,
        filtered[i + 1] ?? 0,
        filtered[i + 2] ?? 0,
        adjustments,
        luminanceSettings,
        x,
        y,
      );
      output[i] = adjusted.r;
      output[i + 1] = adjusted.g;
      output[i + 2] = adjusted.b;
      output[i + 3] = 255;
    }
  }

  return output;
}

/** Box-blur source RGBA in pixel space so color bleeds across edges before grid sampling. */
export function blurRgbaPixels(
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
  adjustmentsInput: PlaygroundTextureAdjustments,
): Uint8ClampedArray {
  const adjustments = normalizePlaygroundTextureAdjustments(adjustmentsInput);
  const blurRadius = Math.round(adjustments.blurRadius);
  if (blurRadius <= 0 && adjustments.sharpenAmount <= 0) {
    return pixels;
  }

  const blurred = blurRadius > 0 ? boxBlurRgbaPixels(pixels, width, height, blurRadius) : pixels;
  if (adjustments.sharpenAmount <= 0) {
    return blurred;
  }

  const sharpened = new Uint8ClampedArray(pixels.length);
  for (let i = 0; i < pixels.length; i += 4) {
    for (let channel = 0; channel < 3; channel++) {
      const idx = i + channel;
      const original = pixels[idx] ?? 0;
      const soft = blurred[idx] ?? 0;
      sharpened[idx] = Math.round(
        Math.min(255, Math.max(0, original + (original - soft) * adjustments.sharpenAmount)),
      );
    }
    sharpened[i + 3] = pixels[i + 3] ?? 255;
  }
  return sharpened;
}
