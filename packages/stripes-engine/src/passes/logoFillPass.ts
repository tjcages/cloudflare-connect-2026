import { compileProgram } from "../gl/program";
import { bindRenderTarget, type RenderTarget } from "../gl/renderTarget";
import { FULLSCREEN_VERT } from "../shaders/fullscreen.vert";
import { LOGO_FILL_FRAG } from "../shaders/logoFill.frag";

export function createLogoFillPass(gl: WebGL2RenderingContext, quad: { draw(): void }) {
  const program = compileProgram(gl, FULLSCREEN_VERT, LOGO_FILL_FRAG);
  const uTex = gl.getUniformLocation(program, "uTex");
  const uResolution = gl.getUniformLocation(program, "uResolution");
  const uBg = gl.getUniformLocation(program, "uBg");
  return {
    render(target: RenderTarget, srcTex: WebGLTexture, p: { resolution: [number, number]; bg: number }) {
      bindRenderTarget(gl, target);
      gl.useProgram(program);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, srcTex);
      gl.uniform1i(uTex, 0);
      gl.uniform2f(uResolution, p.resolution[0], p.resolution[1]);
      gl.uniform3f(uBg, ((p.bg >> 16) & 255) / 255, ((p.bg >> 8) & 255) / 255, (p.bg & 255) / 255);
      quad.draw();
    },
    dispose() {
      gl.deleteProgram(program);
    },
  };
}
