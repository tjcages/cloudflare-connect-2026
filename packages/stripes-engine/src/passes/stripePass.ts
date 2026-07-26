import { compileProgram } from "../gl/program";
import { noteFillTarget } from "../perf/fillRecorder";
import { bindRenderTarget, type RenderTarget } from "../gl/renderTarget";
import { FULLSCREEN_VERT } from "../shaders/fullscreen.vert";
import { STRIPE_FRAG } from "../shaders/stripe.frag";
import { unpackRgb } from "../colors/colorMath";
import { gradientDirectionIndex, STRIPE_BLEND_MODE_INDEX } from "../config/normalize";
import type { EngineConfig } from "../config/types";
import { bindStripeCellUniforms, stripeCellLocations, type StripeCellUniforms } from "./stripeCellUniforms";

export type StripeUniforms = StripeCellUniforms & {
  gapX: number;
  gapY: number;
  cornerRadius: number;
  orientation: 0 | 1;
  angleDeg: number;
  rotationMode: number;
  overlapAmount: number;
  streamGapWaveEnabled: boolean;
  streamGapWaveSqueeze: number;
  streamGapWaveWavelengthCells: number;
  streamGapWaveSpeed: number;
  streamGapWavePhaseDeg: number;
  background: number;
  backgroundAlpha: number;
  transparent: boolean;
  backgroundGradientEnabled: boolean;
  backgroundGradientDirection: number;
  backgroundGradientStopCount: number;
  backgroundGradientStops: number[];
  backgroundGridEnabled: boolean;
  backgroundGridCellW: number;
  backgroundGridCellH: number;
  backgroundGridGapX: number;
  backgroundGridGapY: number;
  backgroundGridCornerRadius: number;
  backgroundGridColor: number;
  backgroundGridOpacity: number;
  displayW: number;
  displayH: number;
  dpr: number;
  stripeDotsEnabled: boolean;
  stripeDotsSizePx: number;
  stripeDotsRandomVisibility: number;
  stripeDotsBrightness: number;
  stripeDotsHueDriftDeg: number;
  stripeDotsSaturationBoost: number;
  stripeBorderEnabled: boolean;
  stripeBorderMinWidthPx: number;
  stripeBorderDensity: number;
  gridLinesEnabled: boolean;
  gridLinesBrightness: number;
  gridLinesDensity: number;
  lettersEnabled: boolean;
  glyphDataTex: WebGLTexture;
  atlasTex: WebGLTexture;
  atlasGrid: [number, number];
  letterSizeScale: number;
  letterColor: number;
  cellDataA: WebGLTexture | null;
  cellDataB: WebGLTexture | null;
  blendMode: number;
};

export type StripeRenderInputs = {
  cols: number;
  rows: number;
  displayW: number;
  displayH: number;
  dpr: number;
  timeSec: number;
  lettersEnabled: boolean;
  colorsMode: boolean;
  glyphDataTex: WebGLTexture;
  atlasTex: WebGLTexture;
  atlasGrid: [number, number];
  cellColorTex: WebGLTexture;
  opacityTex: WebGLTexture;
  cellDataA: WebGLTexture | null;
  cellDataB: WebGLTexture | null;
};

export function buildStripeRenderOpts(config: EngineConfig, i: StripeRenderInputs): StripeUniforms {
  const gapSpeed = Math.max(0.05, config.sparkle.gaps.speed);
  const stripeSparkleMinWidthPx = () => {
    const widths = Array.from(
      new Set(
        config.stripes.filter((s) => s.opacity > 0.001 && s.width >= 0.5).map((s) => Math.round(s.width * 1000) / 1000),
      ),
    ).sort((a, b) => b - a);
    if (widths.length === 0) return 1e6;
    const n = Math.max(1, Math.round(config.sparkle.stripe.thickestCount));
    return widths[Math.min(n - 1, widths.length - 1)];
  };
  return {
    cellW: config.grid.cellWidth,
    cellH: config.grid.cellHeight,
    gapX: config.grid.gapX,
    gapY: config.grid.gapY,
    cornerRadius: config.grid.cornerRadius,
    orientation: config.grid.orientation === "horizontal" ? 1 : 0,
    angleDeg: config.grid.angleDeg,
    rotationMode: config.grid.rotationMode === "overlap" ? 2 : 0,
    overlapAmount: config.grid.overlapAmount,
    streamGapWaveEnabled: config.grid.streamGapWave.enabled,
    streamGapWaveSqueeze: config.grid.streamGapWave.squeeze,
    streamGapWaveWavelengthCells: config.grid.streamGapWave.wavelengthCells,
    streamGapWaveSpeed: config.grid.streamGapWave.speed,
    streamGapWavePhaseDeg: config.grid.streamGapWave.phaseDeg,
    cellMin: 0,
    cellMax: 1,
    cols: i.cols,
    rows: i.rows,
    background: config.background.color,
    backgroundAlpha: config.background.transparent ? 0 : 1,
    transparent: config.background.transparent,
    backgroundGradientEnabled: !config.background.transparent && config.background.gradient.enabled,
    backgroundGradientDirection: gradientDirectionIndex(config.background.gradient.direction),
    backgroundGradientStopCount: config.background.gradient.stopCount,
    backgroundGradientStops: config.background.gradient.stops,
    backgroundGridEnabled: !config.background.transparent && config.background.grid.enabled,
    backgroundGridCellW: config.background.grid.cellWidth,
    backgroundGridCellH: config.background.grid.cellHeight,
    backgroundGridGapX: config.background.grid.gapX,
    backgroundGridGapY: config.background.grid.gapY,
    backgroundGridCornerRadius: config.background.grid.cornerRadius,
    backgroundGridColor: config.background.grid.color,
    backgroundGridOpacity: config.background.grid.opacity,
    displayW: i.displayW,
    displayH: i.displayH,
    dpr: i.dpr,
    timeSec: i.timeSec,
    gapEnabled: config.sparkle.gaps.enabled,
    gapCoverage: config.sparkle.gaps.coverage,
    gapPeriodMin: 0.21 / gapSpeed,
    gapPeriodMax: 0.55 / gapSpeed,
    stripeSparkleEnabled: config.sparkle.stripe.enabled,
    stripeSparkleCoverage: config.sparkle.stripe.coverage,
    stripeSparkleMaxBrightness: config.sparkle.stripe.maxBrightness,
    stripeSparkleSpeed: config.sparkle.stripe.speed,
    stripeSparkleMinWidthPx: stripeSparkleMinWidthPx(),
    stripeSparkleHueDriftDeg: config.sparkle.stripe.hueDriftDeg,
    stripeSparkleSaturationBoost: config.sparkle.stripe.saturationBoost,
    stripeDotsEnabled: config.stripeDots.enabled,
    stripeDotsSizePx: config.stripeDots.sizePx,
    stripeDotsRandomVisibility: config.stripeDots.randomVisibility,
    stripeDotsBrightness: config.stripeDots.brightness,
    stripeDotsHueDriftDeg: config.stripeDots.hueDriftDeg,
    stripeDotsSaturationBoost: config.stripeDots.saturationBoost,
    stripeBorderEnabled: config.stripeBorder.enabled,
    stripeBorderMinWidthPx: config.stripeBorder.minWidthPx,
    stripeBorderDensity: config.stripeBorder.density,
    gridLinesEnabled: config.gridLines.enabled,
    gridLinesBrightness: config.gridLines.brightness,
    gridLinesDensity: config.gridLines.density,
    shuffleEnabled: config.sparkle.width.enabled,
    shuffleCoverage: config.sparkle.width.coverage,
    shufflePeriodMin: config.sparkle.width.swingPeriodMin,
    shufflePeriodMax: config.sparkle.width.swingPeriodMax,
    shuffleSwingPx: config.sparkle.width.swingPx,
    motionEnabled: config.sparkle.motion.enabled,
    motionAmplitudePx: config.sparkle.motion.amplitudePx,
    motionStaggerPx: config.sparkle.motion.staggerPx,
    motionMaxOffsetPx: config.sparkle.motion.maxOffsetPx,
    motionSpeed: config.sparkle.motion.speed,
    lettersEnabled: i.lettersEnabled,
    glyphDataTex: i.glyphDataTex,
    atlasTex: i.atlasTex,
    atlasGrid: i.atlasGrid,
    letterSizeScale: config.letters.sizeScale,
    letterColor: config.letters.color,
    useCellColors: i.colorsMode,
    cellColorTex: i.cellColorTex,
    imageColorLightness: config.colors.imageColorLightness,
    imageColorDensity: config.colors.imageColorDensity,
    opacityTex: i.opacityTex,
    cellDataA: i.cellDataA,
    cellDataB: i.cellDataB,
    blendMode: STRIPE_BLEND_MODE_INDEX[config.colors.stripeBlendMode],
    gradientEnabled: config.colors.gradient.enabled,
    gradientDirection: gradientDirectionIndex(config.colors.gradient.direction),
    gradientStopCount: config.colors.gradient.stopCount,
    gradientStops: config.colors.gradient.stops,
    gradientHueDriftDeg: config.colors.gradient.hueDriftDeg,
    gradientSaturationBoost: config.colors.gradient.saturationBoost,
  };
}

export function createStripePass(gl: WebGL2RenderingContext, quad: { draw(): void }) {
  const program = compileProgram(gl, FULLSCREEN_VERT, STRIPE_FRAG);
  const u = (n: string) => gl.getUniformLocation(program, n);
  const shared = stripeCellLocations(gl, program);
  const L = {
    cellDataA: u("uCellDataA"),
    cellDataB: u("uCellDataB"),
    useCellData: u("uUseCellData"),
    gridGap: u("uGridGapPx"),
    corner: u("uCorner"),
    orient: u("uOrient"),
    angleDeg: u("uAngleDeg"),
    rotationMode: u("uRotationMode"),
    overlapAmount: u("uOverlapAmount"),
    streamGapWaveEnabled: u("uStreamGapWaveEnabled"),
    streamGapWaveSqueeze: u("uStreamGapWaveSqueeze"),
    streamGapWaveWavelengthCells: u("uStreamGapWaveWavelengthCells"),
    streamGapWaveSpeed: u("uStreamGapWaveSpeed"),
    streamGapWavePhaseDeg: u("uStreamGapWavePhaseDeg"),
    bg: u("uBg"),
    bgAlpha: u("uBgAlpha"),
    transparent: u("uTransparent"),
    bgGradientEnabled: u("uBgGradientEnabled"),
    bgGradientDirection: u("uBgGradientDirection"),
    bgGradientStopCount: u("uBgGradientStopCount"),
    bgGradientStop0: u("uBgGradientStop0"),
    bgGradientStop1: u("uBgGradientStop1"),
    bgGradientStop2: u("uBgGradientStop2"),
    bgGradientStop3: u("uBgGradientStop3"),
    bgGridEnabled: u("uBgGridEnabled"),
    bgGridCellPx: u("uBgGridCellPx"),
    bgGridGapPx: u("uBgGridGapPx"),
    bgGridCorner: u("uBgGridCorner"),
    bgGridColor: u("uBgGridColor"),
    bgGridOpacity: u("uBgGridOpacity"),
    displayPx: u("uDisplayPx"),
    dpr: u("uDpr"),
    stripeDotsEnabled: u("uStripeDotsEnabled"),
    stripeDotsSizePx: u("uStripeDotsSizePx"),
    stripeDotsRandomVisibility: u("uStripeDotsRandomVisibility"),
    stripeDotsBrightness: u("uStripeDotsBrightness"),
    stripeDotsHueDriftDeg: u("uStripeDotsHueDriftDeg"),
    stripeDotsSaturationBoost: u("uStripeDotsSaturationBoost"),
    stripeBorderEnabled: u("uStripeBorderEnabled"),
    stripeBorderMinWidthPx: u("uStripeBorderMinWidthPx"),
    stripeBorderDensity: u("uStripeBorderDensity"),
    gridLinesEnabled: u("uGridLinesEnabled"),
    gridLinesBrightness: u("uGridLinesBrightness"),
    gridLinesDensity: u("uGridLinesDensity"),
    lettersEnabled: u("uLettersEnabled"),
    glyphData: u("uGlyphData"),
    atlas: u("uAtlas"),
    atlasGrid: u("uAtlasGrid"),
    letterSizeScale: u("uLetterSizeScale"),
    letterColor: u("uLetterColor"),
    blendMode: u("uBlendMode"),
  };
  const setColor = (loc: WebGLUniformLocation | null, color: number) => gl.uniform3f(loc, ...unpackRgb(color));
  return {
    render(
      cellTex: WebGLTexture,
      lutTex: WebGLTexture,
      p: StripeUniforms,
      outWidth: number,
      outHeight: number,
      target: RenderTarget | null = null,
      originX = 0,
      originY = 0,
    ) {
      if (target) {
        bindRenderTarget(gl, target);
      } else {
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        gl.viewport(originX, originY, outWidth, outHeight);
        noteFillTarget(outWidth, outHeight);
      }
      gl.useProgram(program);
      bindStripeCellUniforms(gl, shared, p, cellTex, lutTex);
      const cellDataReady = !!p.cellDataA && !!p.cellDataB;
      gl.uniform1f(L.useCellData, cellDataReady ? 1 : 0);
      if (cellDataReady) {
        gl.activeTexture(gl.TEXTURE6);
        gl.bindTexture(gl.TEXTURE_2D, p.cellDataA);
        gl.uniform1i(L.cellDataA, 6);
        gl.activeTexture(gl.TEXTURE7);
        gl.bindTexture(gl.TEXTURE_2D, p.cellDataB);
        gl.uniform1i(L.cellDataB, 7);
      }
      gl.uniform2f(L.gridGap, p.gapX, p.gapY);
      gl.uniform1f(L.corner, p.cornerRadius);
      gl.uniform1f(L.orient, p.orientation);
      gl.uniform1f(L.angleDeg, p.angleDeg);
      gl.uniform1f(L.rotationMode, p.rotationMode);
      gl.uniform1f(L.overlapAmount, p.overlapAmount);
      gl.uniform1f(L.streamGapWaveEnabled, p.streamGapWaveEnabled ? 1 : 0);
      gl.uniform1f(L.streamGapWaveSqueeze, p.streamGapWaveSqueeze);
      gl.uniform1f(L.streamGapWaveWavelengthCells, p.streamGapWaveWavelengthCells);
      gl.uniform1f(L.streamGapWaveSpeed, p.streamGapWaveSpeed);
      gl.uniform1f(L.streamGapWavePhaseDeg, p.streamGapWavePhaseDeg);
      setColor(L.bg, p.background);
      gl.uniform1f(L.bgAlpha, p.backgroundAlpha);
      gl.uniform1f(L.transparent, p.transparent ? 1 : 0);
      gl.uniform1f(L.bgGradientEnabled, p.backgroundGradientEnabled ? 1 : 0);
      gl.uniform1f(L.bgGradientDirection, p.backgroundGradientDirection);
      gl.uniform1f(L.bgGradientStopCount, p.backgroundGradientStopCount);
      setColor(L.bgGradientStop0, p.backgroundGradientStops[0]);
      setColor(L.bgGradientStop1, p.backgroundGradientStops[1]);
      setColor(L.bgGradientStop2, p.backgroundGradientStops[2]);
      setColor(L.bgGradientStop3, p.backgroundGradientStops[3]);
      gl.uniform1f(L.bgGridEnabled, p.backgroundGridEnabled ? 1 : 0);
      gl.uniform2f(L.bgGridCellPx, p.backgroundGridCellW, p.backgroundGridCellH);
      gl.uniform2f(L.bgGridGapPx, p.backgroundGridGapX, p.backgroundGridGapY);
      gl.uniform1f(L.bgGridCorner, p.backgroundGridCornerRadius);
      setColor(L.bgGridColor, p.backgroundGridColor);
      gl.uniform1f(L.bgGridOpacity, p.backgroundGridOpacity);
      gl.uniform2f(L.displayPx, p.displayW, p.displayH);
      gl.uniform1f(L.dpr, p.dpr);
      gl.uniform1f(L.stripeDotsEnabled, p.stripeDotsEnabled ? 1 : 0);
      gl.uniform1f(L.stripeDotsSizePx, p.stripeDotsSizePx);
      gl.uniform1f(L.stripeDotsRandomVisibility, p.stripeDotsRandomVisibility);
      gl.uniform1f(L.stripeDotsBrightness, p.stripeDotsBrightness);
      gl.uniform1f(L.stripeDotsHueDriftDeg, p.stripeDotsHueDriftDeg);
      gl.uniform1f(L.stripeDotsSaturationBoost, p.stripeDotsSaturationBoost);
      gl.uniform1f(L.stripeBorderEnabled, p.stripeBorderEnabled ? 1 : 0);
      gl.uniform1f(L.stripeBorderMinWidthPx, p.stripeBorderMinWidthPx);
      gl.uniform1f(L.stripeBorderDensity, p.stripeBorderDensity);
      gl.uniform1f(L.gridLinesEnabled, p.gridLinesEnabled ? 1 : 0);
      gl.uniform1f(L.gridLinesBrightness, p.gridLinesBrightness);
      gl.uniform1f(L.gridLinesDensity, p.gridLinesDensity);
      gl.uniform1f(L.lettersEnabled, p.lettersEnabled ? 1 : 0);
      gl.activeTexture(gl.TEXTURE2);
      gl.bindTexture(gl.TEXTURE_2D, p.glyphDataTex);
      gl.uniform1i(L.glyphData, 2);
      gl.activeTexture(gl.TEXTURE3);
      gl.bindTexture(gl.TEXTURE_2D, p.atlasTex);
      gl.uniform1i(L.atlas, 3);
      gl.uniform2f(L.atlasGrid, p.atlasGrid[0], p.atlasGrid[1]);
      gl.uniform1f(L.letterSizeScale, p.letterSizeScale);
      setColor(L.letterColor, p.letterColor);
      gl.uniform1f(L.blendMode, p.blendMode);
      quad.draw();
    },
    dispose() {
      gl.deleteProgram(program);
    },
  };
}
