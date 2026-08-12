/**
 * Rain look from the original section-grid-generator demo
 * (https://section-grid-generator.hi-1e4.workers.dev/).
 *
 * This monorepo’s `DEFAULT_LAB_ENGINE_CONFIG` / `factoryDefaults.json` are that
 * demo’s rain engine — not the Banner 5:1 Twizzler marketing layout.
 * When Graphic → Rain, apply these so client preview matches that asset.
 */
import type { ConnectShaderParams } from "../connectShader";
import type { Stripe } from "@necatikcl/stripes-engine";
import { DEFAULT_LAB_ENGINE_CONFIG, DEFAULT_LAB_UI_SETTINGS } from "../defaultLabConfig";

const RAIN = DEFAULT_LAB_ENGINE_CONFIG;
const LAB = DEFAULT_LAB_UI_SETTINGS;

/** Opaque factory stripes — the section-grid rain ribbons. */
export function sectionGridRainStripes(): Stripe[] {
  return structuredClone(RAIN.stripes);
}

/** Full factory engine config used when Rain is enabled in client preview bundles. */
export function sectionGridRainEngineConfig() {
  return structuredClone(DEFAULT_LAB_ENGINE_CONFIG);
}

/** Texture-panel Leva keys (Camera / Tone / Source / General). */
export function sectionGridRainTextureLevaPatch(): Record<string, unknown> {
  const adj = RAIN.adjustments;
  const transform = RAIN.transform;
  return {
    stripesEnabled: RAIN.stripesEnabled,
    textureDpr: RAIN.fieldScale,
    exposure: adj.exposure,
    brightness: adj.brightness,
    contrast: adj.contrast,
    gamma: adj.gamma,
    invert: adj.invert,
    blackPoint: adj.blackPoint,
    whitePoint: adj.whitePoint,
    thresholdBias: adj.thresholdBias,
    posterizeLevels: adj.posterizeLevels,
    noiseAmount: adj.noiseAmount,
    blurRadius: adj.blurRadius,
    sharpenAmount: adj.sharpenAmount,
    fit: transform.fit,
    zoom: transform.zoom,
    panX: transform.panX,
    panY: transform.panY,
    connectCameraDistance: LAB.connectCameraDistance,
    connectCameraRotateX: LAB.connectCameraRotateX,
    connectCameraRotateY: LAB.connectCameraRotateY,
    connectCameraRotateZ: LAB.connectCameraRotateZ,
    connectCameraPanX: LAB.connectCameraPanX,
    connectCameraPanY: LAB.connectCameraPanY,
    connectCameraFov: LAB.connectCameraFov,
    connectGradientUnderlay: LAB.connectGradientUnderlay,
  };
}

/** Shader-panel Leva keys (Grid / Sparkle only — Connect params via lab settings). */
export function sectionGridRainShaderLevaPatch(): Record<string, unknown> {
  const grid = RAIN.grid;
  const sparkle = RAIN.sparkle;

  return {
    cellWidth: grid.cellWidth,
    cellHeight: grid.cellHeight,
    gapX: grid.gapX,
    gapY: grid.gapY,
    cornerRadius: grid.cornerRadius,
    orientationStackMode: grid.orientation,
    orientationAngleDeg: grid.angleDeg,
    orientationRotationMode: grid.rotationMode === "overlap" ? "overlap" : "cell",
    orientationOverlapAmount: grid.overlapAmount,
    streamGapWaveEnabled: grid.streamGapWave.enabled,
    streamGapWaveSqueeze: grid.streamGapWave.squeeze,
    streamGapWaveWavelengthCells: grid.streamGapWave.wavelengthCells,
    streamGapWaveSpeed: grid.streamGapWave.speed,
    streamGapWavePhaseDeg: grid.streamGapWave.phaseDeg,

    sparkleGapsCoverage: sparkle.gaps.coverage * 100,
    sparkleGapsSpeed: sparkle.gaps.speed,
    sparkleStripeEnabled: sparkle.stripe.enabled,
    sparkleStripeCoverage: sparkle.stripe.coverage * 100,
    sparkleStripeThickestCount: sparkle.stripe.thickestCount,
    sparkleStripeMaxBrightness: sparkle.stripe.maxBrightness * 100,
    sparkleStripeSpeed: sparkle.stripe.speed,
    sparkleStripeHueDriftDeg: sparkle.stripe.hueDriftDeg,
    sparkleStripeSaturationBoost: sparkle.stripe.saturationBoost * 100,
    sparkleWidthEnabled: sparkle.width.enabled,
    sparkleWidthCoverage: sparkle.width.coverage,
    sparkleWidthSwingPx: sparkle.width.swingPx,
    sparkleWidthSwingPeriodMin: sparkle.width.swingPeriodMin,
    sparkleWidthSwingPeriodMax: sparkle.width.swingPeriodMax,
    sparkleMotionEnabled: sparkle.motion.enabled,
    sparkleMotionAmplitudePx: sparkle.motion.amplitudePx,
    sparkleMotionStaggerPx: sparkle.motion.staggerPx,
    sparkleMotionMaxOffsetPx: sparkle.motion.maxOffsetPx,
    sparkleMotionSpeed: sparkle.motion.speed,
    sparkleMotionDirection: sparkle.motion.direction,
  };
}

/** Combined patch (tests / callers that merge both stores carefully). */
export function sectionGridRainLevaPatch(): Record<string, unknown> {
  return {
    ...sectionGridRainTextureLevaPatch(),
    ...sectionGridRainShaderLevaPatch(),
  };
}

/** Lab settings patch for Connect shape / camera when entering Rain. */
export function sectionGridRainLabSettingsPatch(): Partial<{
  connectShapeType: typeof LAB.connectShapeType;
  connectCameraDistance: number;
  connectCameraRotateX: number;
  connectCameraRotateY: number;
  connectCameraRotateZ: number;
  connectCameraPanX: number;
  connectCameraPanY: number;
  connectCameraFov: number;
  connectGradientUnderlay: boolean;
  connectShaderParams: ConnectShaderParams;
  shaderPresetId: string;
  textureSourceMode: "shader";
}> {
  return {
    connectShapeType: LAB.connectShapeType,
    connectCameraDistance: LAB.connectCameraDistance,
    connectCameraRotateX: LAB.connectCameraRotateX,
    connectCameraRotateY: LAB.connectCameraRotateY,
    connectCameraRotateZ: LAB.connectCameraRotateZ,
    connectCameraPanX: LAB.connectCameraPanX,
    connectCameraPanY: LAB.connectCameraPanY,
    connectCameraFov: LAB.connectCameraFov,
    connectGradientUnderlay: LAB.connectGradientUnderlay,
    connectShaderParams: structuredClone(LAB.connectShaderParams) as ConnectShaderParams,
    shaderPresetId: "connect",
    textureSourceMode: "shader",
  };
}
