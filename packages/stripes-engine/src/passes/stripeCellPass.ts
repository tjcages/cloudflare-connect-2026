import { compileProgram } from "../gl/program";
import { bindMrtTarget, type MrtTarget, type RenderTarget } from "../gl/renderTarget";
import { FULLSCREEN_VERT } from "../shaders/fullscreen.vert";
import { STRIPE_CELL_FRAG } from "../shaders/stripeCell.frag";
import { bindStripeCellUniforms, stripeCellLocations, type StripeCellUniforms } from "./stripeCellUniforms";

export function createStripeCellPass(gl: WebGL2RenderingContext, quad: { draw(): void }) {
  const program = compileProgram(gl, FULLSCREEN_VERT, STRIPE_CELL_FRAG);
  const L = stripeCellLocations(gl, program);
  return {
    render(
      mrt: MrtTarget,
      cellDataA: RenderTarget,
      cellDataB: RenderTarget,
      cellTex: WebGLTexture,
      lutTex: WebGLTexture,
      p: StripeCellUniforms,
    ) {
      bindMrtTarget(gl, mrt, [cellDataA, cellDataB]);
      gl.useProgram(program);
      bindStripeCellUniforms(gl, L, p, cellTex, lutTex);
      quad.draw();
    },
    dispose() {
      gl.deleteProgram(program);
    },
  };
}
