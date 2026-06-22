import { compileProgram } from "../gl/program";
import { bindRenderTarget, type RenderTarget } from "../gl/renderTarget";
import { FULLSCREEN_VERT } from "../shaders/fullscreen.vert";
import { FIELD_FRAG } from "../shaders/field.frag";

export function createFieldPass(gl: WebGL2RenderingContext, quad: { draw(): void }) {
  const program = compileProgram(gl, FULLSCREEN_VERT, FIELD_FRAG);
  const uTime = gl.getUniformLocation(program, "uTime");
  return {
    render(target: RenderTarget, timeMs: number) {
      bindRenderTarget(gl, target);
      gl.useProgram(program);
      gl.uniform1f(uTime, timeMs);
      quad.draw();
    },
    dispose() {
      gl.deleteProgram(program);
    },
  };
}
