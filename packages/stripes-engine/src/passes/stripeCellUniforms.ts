import { unpackRgb } from "../colors/colorMath";

/**
 * The uniforms `stripeCell.glsl` reads. Both the per-cell precompute pass and
 * the stripe pass compile that chunk, so they bind the same values through
 * this one setter — a cell resolved in either place sees identical inputs.
 */
export type StripeCellUniforms = {
  cellW: number;
  cellH: number;
  cols: number;
  rows: number;
  cellMin: number;
  cellMax: number;
  timeSec: number;
  gapEnabled: boolean;
  gapCoverage: number;
  gapPeriodMin: number;
  gapPeriodMax: number;
  stripeSparkleEnabled: boolean;
  stripeSparkleCoverage: number;
  stripeSparkleMaxBrightness: number;
  stripeSparkleSpeed: number;
  stripeSparkleMinWidthPx: number;
  stripeSparkleHueDriftDeg: number;
  stripeSparkleSaturationBoost: number;
  shuffleEnabled: boolean;
  shuffleCoverage: number;
  shufflePeriodMin: number;
  shufflePeriodMax: number;
  shuffleSwingPx: number;
  motionEnabled: boolean;
  motionAmplitudePx: number;
  motionStaggerPx: number;
  motionMaxOffsetPx: number;
  motionSpeed: number;
  useCellColors: boolean;
  cellColorTex: WebGLTexture;
  imageColorLightness: number;
  imageColorDensity: number;
  opacityTex: WebGLTexture;
  bandValueTex: WebGLTexture;
  stripeBandCount: number;
  edgeMaskEnabled: boolean;
  edgeMaskStart: number;
  edgeMaskEnd: number;
  edgeMaskPower: number;
  edgeMaskSides: [number, number, number, number];
  gradientEnabled: boolean;
  gradientDirection: number;
  gradientStopCount: number;
  gradientStops: number[];
  gradientHueDriftDeg: number;
  gradientSaturationBoost: number;
};

export const CELL_TEXTURE_UNIT = 0;
export const LUT_TEXTURE_UNIT = 1;
export const CELL_COLOR_TEXTURE_UNIT = 4;
export const OPACITY_LUT_TEXTURE_UNIT = 5;
export const BAND_VALUE_LUT_TEXTURE_UNIT = 8;

export function stripeCellLocations(gl: WebGL2RenderingContext, program: WebGLProgram) {
  const u = (n: string) => gl.getUniformLocation(program, n);
  return {
    cell: u("uCell"),
    lut: u("uLut"),
    opacityLut: u("uOpacityLut"),
    bandValueLut: u("uBandValueLut"),
    stripeBandCount: u("uStripeBandCount"),
    edgeMaskEnabled: u("uEdgeMaskEnabled"),
    edgeMaskStart: u("uEdgeMaskStart"),
    edgeMaskEnd: u("uEdgeMaskEnd"),
    edgeMaskPower: u("uEdgeMaskPower"),
    edgeMaskSides: u("uEdgeMaskSides"),
    cellColor: u("uCellColor"),
    grid: u("uGridCount"),
    cellPx: u("uCellPx"),
    cellMin: u("uCellMin"),
    cellMax: u("uCellMax"),
    timeSec: u("uTimeSec"),
    gapEnabled: u("uGapEnabled"),
    gapCoverage: u("uGapCoverage"),
    gapPeriodMin: u("uGapPeriodMin"),
    gapPeriodMax: u("uGapPeriodMax"),
    stripeSparkleEnabled: u("uStripeSparkleEnabled"),
    stripeSparkleCoverage: u("uStripeSparkleCoverage"),
    stripeSparkleMaxBrightness: u("uStripeSparkleMaxBrightness"),
    stripeSparkleSpeed: u("uStripeSparkleSpeed"),
    stripeSparkleMinWidthPx: u("uStripeSparkleMinWidthPx"),
    stripeSparkleHueDriftDeg: u("uStripeSparkleHueDriftDeg"),
    stripeSparkleSaturationBoost: u("uStripeSparkleSaturationBoost"),
    shuffleEnabled: u("uShuffleEnabled"),
    shuffleCoverage: u("uShuffleCoverage"),
    shufflePeriodMin: u("uShufflePeriodMin"),
    shufflePeriodMax: u("uShufflePeriodMax"),
    shuffleSwingPx: u("uShuffleSwingPx"),
    motionEnabled: u("uMotionEnabled"),
    motionAmplitudePx: u("uMotionAmplitudePx"),
    motionStaggerPx: u("uMotionStaggerPx"),
    motionMaxOffsetPx: u("uMotionMaxOffsetPx"),
    motionSpeed: u("uMotionSpeed"),
    useCellColors: u("uUseCellColors"),
    imageColorLightness: u("uImageColorLightness"),
    imageColorDensity: u("uImageColorDensity"),
    gradientEnabled: u("uGradientEnabled"),
    gradientDirection: u("uGradientDirection"),
    gradientStopCount: u("uGradientStopCount"),
    gradientStop0: u("uGradientStop0"),
    gradientStop1: u("uGradientStop1"),
    gradientStop2: u("uGradientStop2"),
    gradientStop3: u("uGradientStop3"),
    gradientHueDriftDeg: u("uGradientHueDriftDeg"),
    gradientSaturationBoost: u("uGradientSaturationBoost"),
  };
}

export type StripeCellLocations = ReturnType<typeof stripeCellLocations>;

export function bindStripeCellUniforms(
  gl: WebGL2RenderingContext,
  L: StripeCellLocations,
  p: StripeCellUniforms,
  cellTex: WebGLTexture,
  lutTex: WebGLTexture,
): void {
  gl.activeTexture(gl.TEXTURE0 + CELL_TEXTURE_UNIT);
  gl.bindTexture(gl.TEXTURE_2D, cellTex);
  gl.uniform1i(L.cell, CELL_TEXTURE_UNIT);
  gl.activeTexture(gl.TEXTURE0 + LUT_TEXTURE_UNIT);
  gl.bindTexture(gl.TEXTURE_2D, lutTex);
  gl.uniform1i(L.lut, LUT_TEXTURE_UNIT);
  gl.activeTexture(gl.TEXTURE0 + OPACITY_LUT_TEXTURE_UNIT);
  gl.bindTexture(gl.TEXTURE_2D, p.opacityTex);
  gl.uniform1i(L.opacityLut, OPACITY_LUT_TEXTURE_UNIT);
  gl.activeTexture(gl.TEXTURE0 + BAND_VALUE_LUT_TEXTURE_UNIT);
  gl.bindTexture(gl.TEXTURE_2D, p.bandValueTex);
  gl.uniform1i(L.bandValueLut, BAND_VALUE_LUT_TEXTURE_UNIT);
  gl.activeTexture(gl.TEXTURE0 + CELL_COLOR_TEXTURE_UNIT);
  gl.bindTexture(gl.TEXTURE_2D, p.cellColorTex);
  gl.uniform1i(L.cellColor, CELL_COLOR_TEXTURE_UNIT);
  gl.uniform1f(L.stripeBandCount, p.stripeBandCount);
  gl.uniform1f(L.edgeMaskEnabled, p.edgeMaskEnabled ? 1 : 0);
  gl.uniform1f(L.edgeMaskStart, p.edgeMaskStart);
  gl.uniform1f(L.edgeMaskEnd, p.edgeMaskEnd);
  gl.uniform1f(L.edgeMaskPower, p.edgeMaskPower);
  gl.uniform4f(L.edgeMaskSides, ...p.edgeMaskSides);
  gl.uniform2f(L.grid, p.cols, p.rows);
  gl.uniform2f(L.cellPx, p.cellW, p.cellH);
  gl.uniform1f(L.cellMin, p.cellMin);
  gl.uniform1f(L.cellMax, p.cellMax);
  gl.uniform1f(L.timeSec, p.timeSec);
  gl.uniform1f(L.gapEnabled, p.gapEnabled ? 1 : 0);
  gl.uniform1f(L.gapCoverage, p.gapCoverage);
  gl.uniform1f(L.gapPeriodMin, p.gapPeriodMin);
  gl.uniform1f(L.gapPeriodMax, p.gapPeriodMax);
  gl.uniform1f(L.stripeSparkleEnabled, p.stripeSparkleEnabled ? 1 : 0);
  gl.uniform1f(L.stripeSparkleCoverage, p.stripeSparkleCoverage);
  gl.uniform1f(L.stripeSparkleMaxBrightness, p.stripeSparkleMaxBrightness);
  gl.uniform1f(L.stripeSparkleSpeed, p.stripeSparkleSpeed);
  gl.uniform1f(L.stripeSparkleMinWidthPx, p.stripeSparkleMinWidthPx);
  gl.uniform1f(L.stripeSparkleHueDriftDeg, p.stripeSparkleHueDriftDeg);
  gl.uniform1f(L.stripeSparkleSaturationBoost, p.stripeSparkleSaturationBoost);
  gl.uniform1f(L.shuffleEnabled, p.shuffleEnabled ? 1 : 0);
  gl.uniform1f(L.shuffleCoverage, p.shuffleCoverage);
  gl.uniform1f(L.shufflePeriodMin, p.shufflePeriodMin);
  gl.uniform1f(L.shufflePeriodMax, p.shufflePeriodMax);
  gl.uniform1f(L.shuffleSwingPx, p.shuffleSwingPx);
  gl.uniform1f(L.motionEnabled, p.motionEnabled ? 1 : 0);
  gl.uniform1f(L.motionAmplitudePx, p.motionAmplitudePx);
  gl.uniform1f(L.motionStaggerPx, p.motionStaggerPx);
  gl.uniform1f(L.motionMaxOffsetPx, p.motionMaxOffsetPx);
  gl.uniform1f(L.motionSpeed, p.motionSpeed);
  gl.uniform1f(L.useCellColors, p.useCellColors ? 1 : 0);
  gl.uniform1f(L.imageColorLightness, p.imageColorLightness);
  gl.uniform1f(L.imageColorDensity, p.imageColorDensity);
  gl.uniform1f(L.gradientEnabled, p.gradientEnabled ? 1 : 0);
  gl.uniform1f(L.gradientDirection, p.gradientDirection);
  gl.uniform1f(L.gradientStopCount, p.gradientStopCount);
  gl.uniform3f(L.gradientStop0, ...unpackRgb(p.gradientStops[0]));
  gl.uniform3f(L.gradientStop1, ...unpackRgb(p.gradientStops[1]));
  gl.uniform3f(L.gradientStop2, ...unpackRgb(p.gradientStops[2]));
  gl.uniform3f(L.gradientStop3, ...unpackRgb(p.gradientStops[3]));
  gl.uniform1f(L.gradientHueDriftDeg, p.gradientHueDriftDeg);
  gl.uniform1f(L.gradientSaturationBoost, p.gradientSaturationBoost);
}
