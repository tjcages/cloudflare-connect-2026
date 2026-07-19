import { compileProgram } from "../gl/program";
import { bindRenderTarget, type RenderTarget } from "../gl/renderTarget";
import { FULLSCREEN_VERT } from "../shaders/fullscreen.vert";
import { ENERGY_WARP_FRAG } from "../shaders/energyWarp.frag";

export type EnergyWarpUniforms = {
  mode: number;
  progress: number;
  spread: number;
  flight: number;
  intensity: number;
  detail: number;
  glow: number;
};

export function createEnergyWarpPass(gl: WebGL2RenderingContext, quad: { draw(): void }) {
  const program = compileProgram(gl, FULLSCREEN_VERT, ENERGY_WARP_FRAG);
  const u = (n: string) => gl.getUniformLocation(program, n);
  const L = {
    field: u("uField"),
    mode: u("uMode"),
    progress: u("uProgress"),
    spread: u("uSpread"),
    flight: u("uFlight"),
    intensity: u("uIntensity"),
    detail: u("uDetail"),
    glow: u("uGlow"),
  };
  return {
    render(target: RenderTarget, fieldTex: WebGLTexture, p: EnergyWarpUniforms) {
      bindRenderTarget(gl, target);
      gl.useProgram(program);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, fieldTex);
      gl.uniform1i(L.field, 0);
      gl.uniform1i(L.mode, p.mode);
      gl.uniform1f(L.progress, p.progress);
      gl.uniform1f(L.spread, p.spread);
      gl.uniform1f(L.flight, p.flight);
      gl.uniform1f(L.intensity, p.intensity);
      gl.uniform1f(L.detail, p.detail);
      gl.uniform1f(L.glow, p.glow);
      quad.draw();
    },
    dispose() {
      gl.deleteProgram(program);
    },
  };
}
