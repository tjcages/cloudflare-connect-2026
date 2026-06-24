import { compileProgram } from "../gl/program";
import { bindRenderTarget, type RenderTarget } from "../gl/renderTarget";
import { FULLSCREEN_VERT } from "../shaders/fullscreen.vert";
import { CURSOR_TEAR_FRAG } from "../shaders/cursorTear.frag";

export const TEAR_STRENGTH = 0.6;

export function createCursorTearPass(gl: WebGL2RenderingContext, quad: { draw(): void }) {
  const program = compileProgram(gl, FULLSCREEN_VERT, CURSOR_TEAR_FRAG);
  const uAccum = gl.getUniformLocation(program, "uAccum");
  const uTexel = gl.getUniformLocation(program, "uTexel");
  const uTearStrength = gl.getUniformLocation(program, "uTearStrength");
  const uPushCap = gl.getUniformLocation(program, "uPushCap");

  return {
    render(target: RenderTarget, accumTex: WebGLTexture, p: { cols: number; rows: number; pushCap: number }) {
      bindRenderTarget(gl, target);
      gl.useProgram(program);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, accumTex);
      gl.uniform1i(uAccum, 0);
      gl.uniform2f(uTexel, p.cols > 0 ? 1 / p.cols : 0, p.rows > 0 ? 1 / p.rows : 0);
      gl.uniform1f(uTearStrength, TEAR_STRENGTH);
      gl.uniform1f(uPushCap, p.pushCap);
      quad.draw();
    },
    dispose() {
      gl.deleteProgram(program);
    },
  };
}
