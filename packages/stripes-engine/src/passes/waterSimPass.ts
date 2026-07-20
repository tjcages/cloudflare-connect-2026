import { compileProgram } from "../gl/program";
import { bindRenderTarget, type RenderTarget } from "../gl/renderTarget";
import { FULLSCREEN_VERT } from "../shaders/fullscreen.vert";
import { WATER_SIM_FRAG } from "../shaders/waterSim.frag";

export type WaterSimStep = {
  texelX: number;
  texelY: number;
  ax: number;
  ay: number;
  bx: number;
  by: number;
  amp: number;
  radius: number;
};

export function createWaterSimPass(gl: WebGL2RenderingContext, quad: { draw(): void }) {
  const program = compileProgram(gl, FULLSCREEN_VERT, WATER_SIM_FRAG);
  const u = (n: string) => gl.getUniformLocation(program, n);
  const L = {
    prev: u("uPrev"),
    texel: u("uTexel"),
    splatA: u("uSplatA"),
    splatB: u("uSplatB"),
    amp: u("uSplatAmp"),
    radius: u("uSplatRadius"),
  };

  return {
    render(target: RenderTarget, prev: RenderTarget, p: WaterSimStep) {
      bindRenderTarget(gl, target);
      gl.useProgram(program);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, prev.texture);
      gl.uniform1i(L.prev, 0);
      gl.uniform2f(L.texel, p.texelX, p.texelY);
      gl.uniform2f(L.splatA, p.ax, p.ay);
      gl.uniform2f(L.splatB, p.bx, p.by);
      gl.uniform1f(L.amp, p.amp);
      gl.uniform1f(L.radius, p.radius);
      quad.draw();
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    },
    dispose() {
      gl.deleteProgram(program);
    },
  };
}
