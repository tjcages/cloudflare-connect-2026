import type { Stripe } from "@necatikcl/stripes-engine";

const LADDER = [0.06, 1 / 6, 1 / 3, 0.5, 2 / 3, 5 / 6, 1];
const WIDTHS = [1, 1, 1, 3, 3, 5, 5];

export type StripeSteps = readonly [
  number,
  number,
  number,
  number,
  number,
  number,
  number,
];

function toLinear(channel: number) {
  const c = channel / 255;
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

function toChannel(linear: number) {
  const c =
    linear <= 0.0031308
      ? linear * 12.92
      : 1.055 * Math.pow(linear, 1 / 2.4) - 0.055;
  return Math.max(0, Math.min(255, Math.round(c * 255)));
}

function rgbToOklab(hex: number): [number, number, number] {
  const r = toLinear((hex >> 16) & 0xff);
  const g = toLinear((hex >> 8) & 0xff);
  const b = toLinear(hex & 0xff);
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
}

function oklabToRgb([L, a, b]: [number, number, number]) {
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  const r = toChannel(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s);
  const g = toChannel(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s);
  const bl = toChannel(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s);
  return (r << 16) | (g << 8) | bl;
}

function mixOklab(from: number, to: number, amount: number) {
  const a = rgbToOklab(from);
  const b = rgbToOklab(to);
  return oklabToRgb([
    a[0] + (b[0] - a[0]) * amount,
    a[1] + (b[1] - a[1]) * amount,
    a[2] + (b[2] - a[2]) * amount,
  ]);
}

export function storyStripes(
  base: number,
  highlight: number,
  thresholds: StripeSteps
): Stripe[] {
  return LADDER.map((amount, index) => ({
    color: mixOklab(base, highlight, amount),
    startFrom: thresholds[index],
    width: WIDTHS[index],
    opacity: 1,
  }));
}
