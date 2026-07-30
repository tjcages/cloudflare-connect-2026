import { compileProgram } from "../gl/program";
import { bindRenderTarget, type RenderTarget } from "../gl/renderTarget";
import { FULLSCREEN_VERT } from "../shaders/fullscreen.vert";
import { EDGE_MASK_FRAG } from "../shaders/edgeMask.frag";
import type { EdgeMaskSides } from "../config/types";

export function createEdgeMaskPass(gl: WebGL2RenderingContext, quad: { draw(): void }) {
  const program = compileProgram(gl, FULLSCREEN_VERT, EDGE_MASK_FRAG);
  const uField = gl.getUniformLocation(program, "uField");
  const uStart = gl.getUniformLocation(program, "uStart");
  const uEnd = gl.getUniformLocation(program, "uEnd");
  const uPower = gl.getUniformLocation(program, "uPower");
  const uSides = gl.getUniformLocation(program, "uSides");

  return {
    render(
      target: RenderTarget,
      fieldTex: WebGLTexture,
      p: { start: number; end: number; power: number; sides: EdgeMaskSides },
    ) {
      bindRenderTarget(gl, target);
      gl.useProgram(program);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, fieldTex);
      gl.uniform1i(uField, 0);
      gl.uniform1f(uStart, p.start);
      gl.uniform1f(uEnd, p.end);
      gl.uniform1f(uPower, p.power);
      gl.uniform4f(uSides, p.sides.left ? 1 : 0, p.sides.right ? 1 : 0, p.sides.bottom ? 1 : 0, p.sides.top ? 1 : 0);
      quad.draw();
    },
    dispose() {
      gl.deleteProgram(program);
    },
  };
}
