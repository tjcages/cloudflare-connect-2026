export type StripeBandBreakpoints = readonly [number, number, number, number];

export type StripeBandEnabled = readonly [boolean, boolean, boolean, boolean, boolean];

export type StripeBandColors = {
  bandHex: readonly [string, string, string, string, string];
  bandDisplayP3Css: readonly [string, string, string, string, string];
  bandEnabled: StripeBandEnabled;
};

export type AsciiVideoConfig = {
  duotoneEnabled: boolean;
  ignoreColorHex: string;
  ignoreTolerance: number;
  gamma: number;
  threshold: number;
  density: number;
  displayWidth?: number;
  displayHeight?: number;
  bandBreakpoints: StripeBandBreakpoints;
  bandEnabled: StripeBandEnabled;
  bandHex: readonly [string, string, string, string, string];
  bandDisplayP3Css: readonly [string, string, string, string, string];
};

export type AsciiVideoProps = {
  /** Video or image URL */
  src: string;
  mediaKind?: "video" | "image";
  config?: AsciiVideoConfig;
  className?: string;
  style?: import("react").CSSProperties;
  autoplay?: boolean;
};

export const defaultConfig: AsciiVideoConfig = {
  duotoneEnabled: true,
  ignoreColorHex: "#000000",
  ignoreTolerance: 0.095,
  gamma: 1.15,
  threshold: 0.99,
  density: 0.6,
  displayWidth: 848,
  displayHeight: 480,
  bandBreakpoints: [1, 2, 3, 4],
  bandEnabled: [true, true, true, true, true],
  bandHex: ["#F3F3F3", "#F3F3F3", "#FFA900", "#FF7E00", "#FF2C00"],
  bandDisplayP3Css: [
    "#F3F3F3",
    "#F3F3F3",
    "color(display-p3 0.9882 0.698 0.2471)",
    "color(display-p3 0.9686 0.5255 0.1176)",
    "color(display-p3 0.9216 0.3412 0.1608)",
  ],
};

export function configToStripeBandColors(config: AsciiVideoConfig): StripeBandColors {
  return {
    bandHex: config.bandHex,
    bandDisplayP3Css: config.bandDisplayP3Css,
    bandEnabled: config.bandEnabled,
  };
}

export type Rgb01 = [number, number, number];

export { hexToRgb01 } from "./colorSpace";

import { hexToRgb01 } from "./colorSpace";

export function configToStripeOptions(config: AsciiVideoConfig) {
  return {
    ignoreColorRgb: hexToRgb01(config.ignoreColorHex),
    ignoreTolerance: config.ignoreTolerance,
    gamma: config.gamma,
    threshold: config.threshold,
    density: config.density,
    bandBreakpoints: config.bandBreakpoints,
  };
}
