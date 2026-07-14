import { compileProgram } from "../gl/program";
import { bindRenderTarget, type RenderTarget } from "../gl/renderTarget";
import { FULLSCREEN_VERT } from "../shaders/fullscreen.vert";
import { STRIPE_FRAG } from "../shaders/stripe.frag";
import { unpackRgb } from "../colors/colorMath";
import { gradientDirectionIndex, motionDirectionIndex, STRIPE_BLEND_MODE_INDEX } from "../config/normalize";
import type { EngineConfig } from "../config/types";

export type StripeUniforms = {
  cellW: number;
  cellH: number;
  gapX: number;
  gapY: number;
  cornerRadius: number;
  orientation: 0 | 1;
  angleDeg: number;
  cellMin: number;
  cellMax: number;
  cols: number;
  rows: number;
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
  timeSec: number;
  gapEnabled: boolean;
  gapCoverage: number;
  gapPeriodMin: number;
  gapPeriodMax: number;
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
  motionDirection: number;
  lettersEnabled: boolean;
  glyphDataTex: WebGLTexture;
  atlasTex: WebGLTexture;
  atlasGrid: [number, number];
  letterSizeScale: number;
  useCellColors: boolean;
  cellColorTex: WebGLTexture;
  opacityTex: WebGLTexture;
  blendMode: number;
  gradientEnabled: boolean;
  gradientDirection: number;
  gradientStopCount: number;
  gradientStops: number[];
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
};

export function buildStripeRenderOpts(config: EngineConfig, i: StripeRenderInputs): StripeUniforms {
  const gapSpeed = Math.max(0.05, config.sparkle.gaps.speed);
  return {
    cellW: config.grid.cellWidth,
    cellH: config.grid.cellHeight,
    gapX: config.grid.gapX,
    gapY: config.grid.gapY,
    cornerRadius: config.grid.cornerRadius,
    orientation: config.grid.orientation === "horizontal" ? 1 : 0,
    angleDeg: config.grid.angleDeg,
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
    motionDirection: motionDirectionIndex(config.sparkle.motion.direction),
    lettersEnabled: i.lettersEnabled,
    glyphDataTex: i.glyphDataTex,
    atlasTex: i.atlasTex,
    atlasGrid: i.atlasGrid,
    letterSizeScale: config.letters.sizeScale,
    useCellColors: i.colorsMode,
    cellColorTex: i.cellColorTex,
    opacityTex: i.opacityTex,
    blendMode: STRIPE_BLEND_MODE_INDEX[config.colors.stripeBlendMode],
    gradientEnabled: false,
    gradientDirection: gradientDirectionIndex(config.colors.gradient.direction),
    gradientStopCount: config.colors.gradient.stopCount,
    gradientStops: config.colors.gradient.stops,
  };
}

export function createStripePass(gl: WebGL2RenderingContext, quad: { draw(): void }) {
  const program = compileProgram(gl, FULLSCREEN_VERT, STRIPE_FRAG);
  const u = (n: string) => gl.getUniformLocation(program, n);
  const L = {
    cell: u("uCell"),
    lut: u("uLut"),
    opacityLut: u("uOpacityLut"),
    grid: u("uGridCount"),
    cellPx: u("uCellPx"),
    gridGap: u("uGridGapPx"),
    corner: u("uCorner"),
    orient: u("uOrient"),
    angleDeg: u("uAngleDeg"),
    cellMin: u("uCellMin"),
    cellMax: u("uCellMax"),
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
    timeSec: u("uTimeSec"),
    gapEnabled: u("uGapEnabled"),
    gapCoverage: u("uGapCoverage"),
    gapPeriodMin: u("uGapPeriodMin"),
    gapPeriodMax: u("uGapPeriodMax"),
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
    motionDirection: u("uMotionDirection"),
    lettersEnabled: u("uLettersEnabled"),
    glyphData: u("uGlyphData"),
    atlas: u("uAtlas"),
    atlasGrid: u("uAtlasGrid"),
    letterSizeScale: u("uLetterSizeScale"),
    useCellColors: u("uUseCellColors"),
    cellColor: u("uCellColor"),
    blendMode: u("uBlendMode"),
    gradientEnabled: u("uGradientEnabled"),
    gradientDirection: u("uGradientDirection"),
    gradientStopCount: u("uGradientStopCount"),
    gradientStop0: u("uGradientStop0"),
    gradientStop1: u("uGradientStop1"),
    gradientStop2: u("uGradientStop2"),
    gradientStop3: u("uGradientStop3"),
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
    ) {
      if (target) {
        bindRenderTarget(gl, target);
      } else {
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        gl.viewport(0, 0, outWidth, outHeight);
      }
      gl.useProgram(program);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, cellTex);
      gl.uniform1i(L.cell, 0);
      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, lutTex);
      gl.uniform1i(L.lut, 1);
      gl.activeTexture(gl.TEXTURE5);
      gl.bindTexture(gl.TEXTURE_2D, p.opacityTex);
      gl.uniform1i(L.opacityLut, 5);
      gl.uniform2f(L.grid, p.cols, p.rows);
      gl.uniform2f(L.cellPx, p.cellW, p.cellH);
      gl.uniform2f(L.gridGap, p.gapX, p.gapY);
      gl.uniform1f(L.corner, p.cornerRadius);
      gl.uniform1f(L.orient, p.orientation);
      gl.uniform1f(L.angleDeg, p.angleDeg);
      gl.uniform1f(L.cellMin, p.cellMin);
      gl.uniform1f(L.cellMax, p.cellMax);
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
      gl.uniform1f(L.timeSec, p.timeSec);
      gl.uniform1f(L.gapEnabled, p.gapEnabled ? 1 : 0);
      gl.uniform1f(L.gapCoverage, p.gapCoverage);
      gl.uniform1f(L.gapPeriodMin, p.gapPeriodMin);
      gl.uniform1f(L.gapPeriodMax, p.gapPeriodMax);
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
      gl.uniform1f(L.motionDirection, p.motionDirection);
      gl.uniform1f(L.lettersEnabled, p.lettersEnabled ? 1 : 0);
      gl.activeTexture(gl.TEXTURE2);
      gl.bindTexture(gl.TEXTURE_2D, p.glyphDataTex);
      gl.uniform1i(L.glyphData, 2);
      gl.activeTexture(gl.TEXTURE3);
      gl.bindTexture(gl.TEXTURE_2D, p.atlasTex);
      gl.uniform1i(L.atlas, 3);
      gl.uniform2f(L.atlasGrid, p.atlasGrid[0], p.atlasGrid[1]);
      gl.uniform1f(L.letterSizeScale, p.letterSizeScale);
      gl.uniform1f(L.useCellColors, p.useCellColors ? 1 : 0);
      gl.activeTexture(gl.TEXTURE4);
      gl.bindTexture(gl.TEXTURE_2D, p.cellColorTex);
      gl.uniform1i(L.cellColor, 4);
      gl.uniform1f(L.blendMode, p.blendMode);
      gl.uniform1f(L.gradientEnabled, p.gradientEnabled ? 1 : 0);
      gl.uniform1f(L.gradientDirection, p.gradientDirection);
      gl.uniform1f(L.gradientStopCount, p.gradientStopCount);
      setColor(L.gradientStop0, p.gradientStops[0]);
      setColor(L.gradientStop1, p.gradientStops[1]);
      setColor(L.gradientStop2, p.gradientStops[2]);
      setColor(L.gradientStop3, p.gradientStops[3]);
      quad.draw();
    },
    dispose() {
      gl.deleteProgram(program);
    },
  };
}
