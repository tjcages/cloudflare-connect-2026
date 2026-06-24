import { compileProgram } from "../gl/program";
import { bindRenderTarget, type RenderTarget } from "../gl/renderTarget";
import { FULLSCREEN_VERT } from "../shaders/fullscreen.vert";
import { DOWNSAMPLE_COLOR_FRAG } from "../shaders/downsampleColor.frag";

export function createDownsampleColorPass(gl: WebGL2RenderingContext, quad: { draw(): void }) {
  const program = compileProgram(gl, FULLSCREEN_VERT, DOWNSAMPLE_COLOR_FRAG);
  const uField = gl.getUniformLocation(program, "uField");
  const uGrid = gl.getUniformLocation(program, "uGridCount");
  return {
    render(target: RenderTarget, fieldColorTex: WebGLTexture, cols: number, rows: number) {
      bindRenderTarget(gl, target);
      gl.useProgram(program);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, fieldColorTex);
      gl.uniform1i(uField, 0);
      gl.uniform2f(uGrid, cols, rows);
      quad.draw();
    },
    dispose() {
      gl.deleteProgram(program);
    },
  };
}
