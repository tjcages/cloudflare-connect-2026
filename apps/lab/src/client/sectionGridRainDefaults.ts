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

function connectShaderParamsToLeva(params: ConnectShaderParams): Record<string, unknown> {
  return {
    connectSpeed: params.speed,
    connectWavesX: params.wavesX,
    connectWavesY: params.wavesY,
    connectDisplacement: params.displacementHeight,
    connectSpeedX: params.speedX,
    connectSpeedY: params.speedY,
    connectShapeWidth: params.shapeWidth,
    connectCylinderLength: params.cylinderLength,
    connectTwistX: params.twistX,
    connectTwistY: params.twistY,
    connectShapeRadius: params.shapeRadius,
    connectConeRadiusStart: params.shapeConeRadiusStart,
    connectConeRadiusEnd: params.shapeConeRadiusEnd,
    connectShapeTube: params.shapeTube,
    connectShapeBend: params.shapeBend,
    connectShapePitch: params.shapePitch,
    connectShapeAmplitude: params.shapeAmplitude,
    connectShapeTurns: params.shapeTurns,
    connectShapeWaveFreq: params.shapeWaveFreq,
    connectMeshQuality: params.shapeMeshQuality,
    connectFillColor: params.fillColor,
    connectFillColor2: params.fillColor2,
    connectFillGradScale: params.fillGradScale,
    connectFillRadius: params.fillRadius,
    connectFillAlpha: params.fillAlpha,
    connectFillLow: params.fillLow,
    connectFillHigh: params.fillHigh,
    connectLineColor: params.lineColor,
    connectLineCount: params.lineCount,
    connectLineWidth: params.lineWidth,
    connectLineAlpha: params.lineAlpha,
    connectLineFadeLow: params.lineFadeLow,
    connectLineFadeHigh: params.lineFadeHigh,
    connectHatchAngle: params.hatchAngle,
    connectHatchLift: params.hatchLift,
    connectHatchSpacing: params.hatchSpacing,
    connectHatchCell: params.hatchCell,
    connectHatchFill: params.hatchFill,
    connectDashMin: params.dashMin,
    connectDashMax: params.dashMax,
    connectHatchDensity: params.hatchDensity,
    connectDensityFloor: params.densityFloor,
    connectHatchDrift: params.hatchDrift,
    connectWaveGate: params.waveGate,
    connectEnvCenter: params.envCenter,
    connectEnvSlope: params.envSlope,
    connectEnvWidth: params.envWidth,
    connectEmitCount: params.emitCount,
    connectEmitAmount: params.emitAmount,
    connectEmitSpeed: params.emitSpeed,
    connectEmitDist: params.emitDist,
    connectEmitFall: params.emitFall,
    connectEmitSize: params.emitSize,
    connectEmitStretch: params.emitStretch,
    connectEmitAlpha: params.emitAlpha,
    connectEmitPaleColor: params.emitPaleColor,
    connectEmitSalmonColor: params.emitSalmonColor,
    connectEmitOrangeColor: params.emitOrangeColor,
    connectEmitAmberColor: params.emitAmberColor,
    connectEmitDeepColor: params.emitDeepColor,
    connectPaleColor: params.paleColor,
    connectSalmonColor: params.salmonColor,
    connectOrangeColor: params.orangeColor,
    connectAmberColor: params.amberColor,
    connectDeepColor: params.deepColor,
  };
}

/**
 * Leva control patch for section-grid rain (grid, sparkle, tone, Connect view).
 * Keys match `levaSchema` / Connect folder control ids.
 */
export function sectionGridRainLevaPatch(): Record<string, unknown> {
  const grid = RAIN.grid;
  const sparkle = RAIN.sparkle;
  const adj = RAIN.adjustments;
  const transform = RAIN.transform;
  const connectParams = LAB.connectShaderParams as ConnectShaderParams;

  return {
    // Grid — factory is 7×7 cells, 0° (not Banner 3×11 / −38°)
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

    // Sparkle / rain gaps — coverage is Leva % (0–100)
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

    // Tone + scale (Banner uses milder tone; factory is punchier)
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

    // Connect spiral view from factoryDefaults.lab
    connectCameraDistance: LAB.connectCameraDistance,
    connectCameraRotateX: LAB.connectCameraRotateX,
    connectCameraRotateY: LAB.connectCameraRotateY,
    connectCameraRotateZ: LAB.connectCameraRotateZ,
    connectCameraPanX: LAB.connectCameraPanX,
    connectCameraPanY: LAB.connectCameraPanY,
    connectCameraFov: LAB.connectCameraFov,
    connectGradientUnderlay: LAB.connectGradientUnderlay,
    ...connectShaderParamsToLeva(connectParams),
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
