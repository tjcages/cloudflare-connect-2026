import { compileProgram } from "../gl/program";
import { bindRenderTarget, type RenderTarget } from "../gl/renderTarget";
import { FULLSCREEN_VERT } from "../shaders/fullscreen.vert";
import { WATER_REVEAL_FRAG } from "../shaders/waterReveal.frag";
import type { WaterRevealTextures } from "../reveal/waterRevealSim";

export function createWaterRevealPass(gl: WebGL2RenderingContext, quad: { draw(): void }) {
  const program = compileProgram(gl, FULLSCREEN_VERT, WATER_REVEAL_FRAG);
  const u = (n: string) => gl.getUniformLocation(program, n);
  const L = {
    field: u("uField"),
    cover: u("uCover"),
    height: u("uHeight"),
    heightTexel: u("uHeightTexel"),
    refraction: u("uRefraction"),
    whiteK: u("uWhiteK"),
    glow: u("uGlow"),
    active: u("uActive"),
  };

  return {
    render(
      target: RenderTarget,
      fieldTex: WebGLTexture,
      sim: WaterRevealTextures | null,
      p: { refraction: number; whiteK: number; glow: number },
    ) {
      bindRenderTarget(gl, target);
      gl.useProgram(program);

      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, fieldTex);
      gl.uniform1i(L.field, 0);

      if (!sim) {
        gl.activeTexture(gl.TEXTURE1);
        gl.bindTexture(gl.TEXTURE_2D, fieldTex);
        gl.uniform1i(L.cover, 1);

        gl.activeTexture(gl.TEXTURE2);
        gl.bindTexture(gl.TEXTURE_2D, fieldTex);
        gl.uniform1i(L.height, 2);

        gl.uniform1f(L.active, 0);
        quad.draw();
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        return;
      }

      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, sim.cover);
      gl.uniform1i(L.cover, 1);

      gl.activeTexture(gl.TEXTURE2);
      gl.bindTexture(gl.TEXTURE_2D, sim.height);
      gl.uniform1i(L.height, 2);

      gl.uniform2f(L.heightTexel, sim.texelX, sim.texelY);
      gl.uniform1f(L.refraction, p.refraction);
      gl.uniform1f(L.whiteK, p.whiteK);
      gl.uniform1f(L.glow, p.glow);
      gl.uniform1f(L.active, 1);
      quad.draw();
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    },
    dispose() {
      gl.deleteProgram(program);
    },
  };
}
