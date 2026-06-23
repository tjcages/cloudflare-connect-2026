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
      quad.draw();
    },
    dispose() {
      gl.deleteProgram(program);
    },
  };
}
