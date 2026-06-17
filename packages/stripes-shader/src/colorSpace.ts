export type Rgb01 = [number, number, number];

export type StripeFillColor = {
  hex: string;
  displayP3Css: string;
  srgb: Rgb01;
  displayP3: Rgb01;
};

const DISPLAY_P3_RE = /color\s*\(\s*display-p3\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)\s*\)/i;

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

export function parseDisplayP3Css(css: string): Rgb01 {
  const match = DISPLAY_P3_RE.exec(css.trim());
  if (!match) {
    return [1, 1, 1];
  }
  return [Number(match[1]), Number(match[2]), Number(match[3])];
}

export function supportsDisplayP3(): boolean {
  if (typeof CSS === "undefined" || typeof CSS.supports !== "function") {
    return false;
  }
  return CSS.supports("color", "color(display-p3 1 1 1)");
}

export function stripeFillFromAccent(accent: { hex: string; displayP3: string }): StripeFillColor {
  return {
    hex: accent.hex,
    displayP3Css: accent.displayP3,
    srgb: hexToRgb01(accent.hex),
    displayP3: parseDisplayP3Css(accent.displayP3),
  };
}

export function stripeFillFromHex(hex: string): StripeFillColor {
  const normalized = hex.trim();
  return {
    hex: normalized,
    displayP3Css: normalized,
    srgb: hexToRgb01(normalized),
    displayP3: hexToRgb01(normalized),
  };
}

const clamp01 = (channel: number) => Math.min(1, Math.max(0, channel));

/** CSS display-p3 / sRGB share the same transfer function (IEC 61966-2-1). */
function transferDecode(channel: number): number {
  if (channel <= 0.04045) {
    return channel / 12.92;
  }
  return ((channel + 0.055) / 1.055) ** 2.4;
}

function transferEncode(linear: number): number {
  if (linear <= 0.0031308) {
    return linear * 12.92;
  }
  return 1.055 * linear ** (1 / 2.4) - 0.055;
}

function displayP3LinearToXyz(r: number, g: number, b: number): Rgb01 {
  return [
    0.48657095 * r + 0.26566769 * g + 0.19821729 * b,
    0.22897456 * r + 0.69173852 * g + 0.07928691 * b,
    0.04511338 * g + 1.04394437 * b,
  ];
}

function xyzToSrgbLinear(x: number, y: number, z: number): Rgb01 {
  return [
    3.2404542 * x - 1.5371385 * y - 0.4985314 * z,
    -0.969266 * x + 1.8760108 * y + 0.041556 * z,
    0.0556434 * x - 0.2040259 * y + 1.0572252 * z,
  ];
}

/**
 * Map display-p3 (gamma-encoded) to sRGB (gamma-encoded) for sRGB WebGL framebuffers.
 * Pixi filters render to sRGB targets; the compositor then maps to the canvas color space.
 */
export function displayP3ToSrgb([r, g, b]: Rgb01): Rgb01 {
  const [x, y, z] = displayP3LinearToXyz(transferDecode(r), transferDecode(g), transferDecode(b));
  const [sr, sg, sb] = xyzToSrgbLinear(x, y, z);
  return [clamp01(transferEncode(sr)), clamp01(transferEncode(sg)), clamp01(transferEncode(sb))];
}

/**
 * Shader / filter uniform RGB. When wide gamut is requested, convert P3 design tokens to
 * sRGB triplets that survive Pixi's sRGB filter targets and still match CSS display-p3 on output.
 */
export function resolveFillRgb(fill: StripeFillColor, preferP3: boolean): Rgb01 {
  if (!preferP3) {
    return fill.srgb;
  }
  return displayP3ToSrgb(fill.displayP3);
}
