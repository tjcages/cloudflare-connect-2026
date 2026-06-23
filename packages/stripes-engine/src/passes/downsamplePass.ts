import { compileProgram } from "../gl/program";
import { bindRenderTarget, type RenderTarget } from "../gl/renderTarget";
import { FULLSCREEN_VERT } from "../shaders/fullscreen.vert";
import { DOWNSAMPLE_FRAG } from "../shaders/downsample.frag";

export function createDownsamplePass(gl: WebGL2RenderingContext, quad: { draw(): void }) {
  const program = compileProgram(gl, FULLSCREEN_VERT, DOWNSAMPLE_FRAG);
  const uField = gl.getUniformLocation(program, "uField");
  const uGrid = gl.getUniformLocation(program, "uGridCount");
  return {
    render(target: RenderTarget, fieldTex: WebGLTexture, cols: number, rows: number) {
      bindRenderTarget(gl, target);
      gl.useProgram(program);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, fieldTex);
      gl.uniform1i(uField, 0);
      gl.uniform2f(uGrid, cols, rows);
      quad.draw();
    },
    dispose() {
      gl.deleteProgram(program);
    },
  };
}
