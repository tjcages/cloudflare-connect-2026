/** Placeholder types file — replaced during export with playground snapshot values. */

export type Rgb01 = [number, number, number];

/** One luminosity stripe: a color shown for source cells at/above `startFrom`. */
export type Stripe = {
  hex: string;
  /** Wide-gamut CSS, e.g. "color(display-p3 r g b)". */
  p3Css: string;
  /** Lower luminance bound 0–1. */
  startFrom: number;
  /** Stripe thickness in px. */
  width: number;
};

export type StripeColors = { stripes: Stripe[] };

export type PlaygroundSourceFit = "stretch" | "contain" | "cover";

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

export type PlaygroundSourceTransform = {
  fit: PlaygroundSourceFit;
  zoom: number;
  panX: number;
  panY: number;
};

export type AsciiVideoConfig = {
  duotoneEnabled: boolean;
  stripesEnabled?: boolean;
  /** Positive texture luminance gamma. Omitted when 1. */
  textureGamma?: number;
  textureAdjustments?: PlaygroundTextureAdjustments;
  sourceTransform?: PlaygroundSourceTransform;
  /** Active cell ratio 0–1. 0 = off. */
  sparkleGapsActivePercent?: number;
  /** Gap pulse speed factor (1 = baseline). */
  sparkleGapsSpeed?: number;
  /** Active cell ratio 0–1. 0 = off. */
  sparkleWidthActivePercent?: number;
  /** Width pulse speed factor (1 = baseline). */
  sparkleWidthSpeed?: number;
  displayWidth?: number;
  displayHeight?: number;
  stripes: Stripe[];
};

export type AsciiVideoProps = {
  /** Video or image URL */
  src: string;
  mediaKind?: "video" | "image";
  config?: AsciiVideoConfig;
  className?: string;
  style?: React.CSSProperties;
  autoplay?: boolean;
};

export const defaultConfig: AsciiVideoConfig = {
  duotoneEnabled: true,
  stripes: [
    { hex: "#F3F3F3", p3Css: "color(display-p3 0.9529 0.9529 0.9529)", startFrom: 0.12, width: 2 },
    { hex: "#FADA98", p3Css: "color(display-p3 0.9804 0.8549 0.5961)", startFrom: 0.28, width: 3 },
    { hex: "#F8BD70", p3Css: "color(display-p3 0.9725 0.7412 0.4392)", startFrom: 0.44, width: 4 },
    { hex: "#F69E4D", p3Css: "color(display-p3 0.9647 0.6196 0.302)", startFrom: 0.6, width: 5 },
    { hex: "#F27C33", p3Css: "color(display-p3 0.949 0.4863 0.2)", startFrom: 0.76, width: 6 },
    { hex: "#EB5729", p3Css: "color(display-p3 0.9216 0.3412 0.1608)", startFrom: 0.9, width: 7 },
  ],
};

export function configToStripeColors(config: AsciiVideoConfig): StripeColors {
  return { stripes: config.stripes };
}

export { hexToRgb01 } from "./colorSpace";
