import { compileProgram } from "../gl/program";
import { bindRenderTarget, type RenderTarget } from "../gl/renderTarget";
import { FULLSCREEN_VERT } from "../shaders/fullscreen.vert";
import { STRIPE_FRAG } from "../shaders/stripe.frag";

export type StripeUniforms = {
  cellW: number;
  cellH: number;
  cornerRadius: number;
  orientation: 0 | 1;
  cols: number;
  rows: number;
  background: number;
  transparent: boolean;
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
  lettersEnabled: boolean;
  glyphDataTex: WebGLTexture;
  atlasTex: WebGLTexture;
  atlasGrid: [number, number];
  letterSizeScale: number;
  useCellColors: boolean;
  cellColorTex: WebGLTexture;
};

export function createStripePass(gl: WebGL2RenderingContext, quad: { draw(): void }) {
  const program = compileProgram(gl, FULLSCREEN_VERT, STRIPE_FRAG);
  const u = (n: string) => gl.getUniformLocation(program, n);
  const L = {
    cell: u("uCell"),
    lut: u("uLut"),
    grid: u("uGridCount"),
    cellPx: u("uCellPx"),
    corner: u("uCorner"),
    orient: u("uOrient"),
    bg: u("uBg"),
    transparent: u("uTransparent"),
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
    lettersEnabled: u("uLettersEnabled"),
    glyphData: u("uGlyphData"),
    atlas: u("uAtlas"),
    atlasGrid: u("uAtlasGrid"),
    letterSizeScale: u("uLetterSizeScale"),
    useCellColors: u("uUseCellColors"),
    cellColor: u("uCellColor"),
  };
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
      gl.uniform2f(L.grid, p.cols, p.rows);
      gl.uniform2f(L.cellPx, p.cellW, p.cellH);
      gl.uniform1f(L.corner, p.cornerRadius);
      gl.uniform1f(L.orient, p.orientation);
      gl.uniform3f(
        L.bg,
        ((p.background >> 16) & 255) / 255,
        ((p.background >> 8) & 255) / 255,
        (p.background & 255) / 255,
      );
      gl.uniform1f(L.transparent, p.transparent ? 1 : 0);
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
      quad.draw();
    },
    dispose() {
      gl.deleteProgram(program);
    },
  };
}
