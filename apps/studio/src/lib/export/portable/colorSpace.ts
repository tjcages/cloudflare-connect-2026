import type { Rgb01 } from "./types";

const DISPLAY_P3_RE = /color\s*\(\s*display-p3\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)\s*\)/i;

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

const clamp01 = (channel: number) => Math.min(1, Math.max(0, channel));

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

/** display-p3 (gamma) → sRGB (gamma) for Pixi filter targets (matches playground). */
export function displayP3ToSrgb([r, g, b]: Rgb01): Rgb01 {
  const [x, y, z] = displayP3LinearToXyz(transferDecode(r), transferDecode(g), transferDecode(b));
  const [sr, sg, sb] = xyzToSrgbLinear(x, y, z);
  return [clamp01(transferEncode(sr)), clamp01(transferEncode(sg)), clamp01(transferEncode(sb))];
}

export function bandUniformRgb(hex: string, displayP3Css: string, preferP3: boolean): Rgb01 {
  if (!preferP3) {
    return hexToRgb01(hex);
  }
  // Neutral bands use hex as displayP3Css (see playground stripeFillFromHex).
  if (!DISPLAY_P3_RE.test(displayP3Css)) {
    return displayP3ToSrgb(hexToRgb01(hex));
  }
  return displayP3ToSrgb(parseDisplayP3Css(displayP3Css));
}

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
