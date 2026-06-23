import { compileProgram } from "../gl/program";
import { bindRenderTarget, type RenderTarget } from "../gl/renderTarget";
import { FULLSCREEN_VERT } from "../shaders/fullscreen.vert";
import { BLUR_FRAG } from "../shaders/blur.frag";

export function createBlurPass(gl: WebGL2RenderingContext, quad: { draw(): void }) {
  const program = compileProgram(gl, FULLSCREEN_VERT, BLUR_FRAG);
  const uTex = gl.getUniformLocation(program, "uTex");
  const uStep = gl.getUniformLocation(program, "uStep");

  function drawWith(srcTex: WebGLTexture, outRT: RenderTarget, sx: number, sy: number) {
    bindRenderTarget(gl, outRT);
    gl.useProgram(program);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, srcTex);
    gl.uniform1i(uTex, 0);
    gl.uniform2f(uStep, sx, sy);
    quad.draw();
  }

  return {
    render(
      srcTex: WebGLTexture,
      tempRT: RenderTarget,
      outRT: RenderTarget,
      radiusPx: number,
      size: { width: number; height: number },
    ) {
      const stepH = radiusPx / size.width / 4;
      const stepV = radiusPx / size.height / 4;
      drawWith(srcTex, tempRT, stepH, 0);
      drawWith(tempRT.texture, outRT, 0, stepV);
    },
    copy(srcTex: WebGLTexture, outRT: RenderTarget) {
      drawWith(srcTex, outRT, 0, 0);
    },
    dispose() {
      gl.deleteProgram(program);
    },
  };
}
