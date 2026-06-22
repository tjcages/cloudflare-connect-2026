export type Fit = "stretch" | "contain" | "cover";
export type FieldMode = "luminance" | "overlay";

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

export interface FieldConfig {
  mode: FieldMode;
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

export interface EngineConfig {
  transform: Transform;
  adjustments: Adjustments;
  field: FieldConfig;
  background: Background;
  grid: Grid;
  stripes: Stripe[];
  overlayStripes: Stripe[];
  stripesEnabled: boolean;
}
