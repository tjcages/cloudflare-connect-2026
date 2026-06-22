import { compileProgram } from "../gl/program";
import { FULLSCREEN_VERT } from "../shaders/fullscreen.vert";
import { PRESENT_FRAG } from "../shaders/present.frag";

export function createPresentPass(gl: WebGL2RenderingContext, quad: { draw(): void }) {
  const program = compileProgram(gl, FULLSCREEN_VERT, PRESENT_FRAG);
  const uField = gl.getUniformLocation(program, "uField");
  return {
    render(fieldTex: WebGLTexture, outWidth: number, outHeight: number) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.viewport(0, 0, outWidth, outHeight);
      gl.useProgram(program);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, fieldTex);
      gl.uniform1i(uField, 0);
      quad.draw();
    },
    dispose() {
      gl.deleteProgram(program);
    },
  };
}
