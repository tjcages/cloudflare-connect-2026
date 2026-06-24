import { compileProgram } from "../gl/program";
import { bindRenderTarget, type RenderTarget } from "../gl/renderTarget";
import { FULLSCREEN_VERT } from "../shaders/fullscreen.vert";
import { MAX_REDUCE_FRAG } from "../shaders/maxReduce.frag";

export function createMaxReducePass(gl: WebGL2RenderingContext, quad: { draw(): void }) {
  const program = compileProgram(gl, FULLSCREEN_VERT, MAX_REDUCE_FRAG);
  const uTex = gl.getUniformLocation(program, "uTex");
  const uSrcSize = gl.getUniformLocation(program, "uSrcSize");
  return {
    render(target: RenderTarget, srcTex: WebGLTexture, srcW: number, srcH: number) {
      bindRenderTarget(gl, target);
      gl.useProgram(program);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, srcTex);
      gl.uniform1i(uTex, 0);
      gl.uniform2f(uSrcSize, srcW, srcH);
      quad.draw();
    },
    dispose() {
      gl.deleteProgram(program);
    },
  };
}
