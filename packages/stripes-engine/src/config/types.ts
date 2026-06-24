export type Fit = "stretch" | "contain" | "cover";

export type WavePosition =
  | "center"
  | "left top"
  | "center top"
  | "right top"
  | "left center"
  | "right center"
  | "left bottom"
  | "center bottom"
  | "right bottom";

export interface RevealConfig {
  enabled: boolean;
  type: "wave" | "assembly";
  wave: {
    position: WavePosition;
    durationMs: number;
    softness: number;
    waviness: number;
  };
  assembly: {
    sliceSizePx: number;
    speedMinMs: number;
    speedMaxMs: number;
    staggerMs: number;
  };
}

export interface Stripe {
  color: number;
  startFrom: number;
  width: number;
}

export interface Transform {
  fit: Fit;
  zoom: number;
  panX: number;
  panY: number;
}

export interface Adjustments {
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
}

export interface Background {
  color: number;
}

export interface Grid {
  cellWidth: number;
  cellHeight: number;
  gapX: number;
  gapY: number;
  cornerRadius: number;
  orientation: "vertical" | "horizontal";
}

export interface SparkleConfig {
  gaps: { enabled: boolean; coverage: number; speed: number };
  width: { enabled: boolean; coverage: number; speed: number; swingPx: number };
}

export interface EngineConfig {
  transform: Transform;
  adjustments: Adjustments;
  background: Background;
  grid: Grid;
  stripes: Stripe[];
  stripesEnabled: boolean;
  fieldScale: number;
  reveal: RevealConfig;
  sparkle: SparkleConfig;
}
