import { compileProgram } from "../gl/program";
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
  };
  return {
    render(cellTex: WebGLTexture, lutTex: WebGLTexture, p: StripeUniforms, outWidth: number, outHeight: number) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.viewport(0, 0, outWidth, outHeight);
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
      quad.draw();
    },
    dispose() {
      gl.deleteProgram(program);
    },
  };
}
