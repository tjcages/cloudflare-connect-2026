import { compileProgram } from "../gl/program";
import { bindRenderTarget, type RenderTarget } from "../gl/renderTarget";
import { FULLSCREEN_VERT } from "../shaders/fullscreen.vert";
import { EDGE_MASK_FRAG } from "../shaders/edgeMask.frag";

export function createEdgeMaskPass(gl: WebGL2RenderingContext, quad: { draw(): void }) {
  const program = compileProgram(gl, FULLSCREEN_VERT, EDGE_MASK_FRAG);
  const uField = gl.getUniformLocation(program, "uField");
  const uStart = gl.getUniformLocation(program, "uStart");
  const uEnd = gl.getUniformLocation(program, "uEnd");
  const uPower = gl.getUniformLocation(program, "uPower");

  return {
    render(target: RenderTarget, fieldTex: WebGLTexture, p: { start: number; end: number; power: number }) {
      bindRenderTarget(gl, target);
      gl.useProgram(program);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, fieldTex);
      gl.uniform1i(uField, 0);
      gl.uniform1f(uStart, p.start);
      gl.uniform1f(uEnd, p.end);
      gl.uniform1f(uPower, p.power);
      quad.draw();
    },
    dispose() {
      gl.deleteProgram(program);
    },
  };
}
