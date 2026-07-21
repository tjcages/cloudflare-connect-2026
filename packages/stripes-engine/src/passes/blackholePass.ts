import { compileProgram } from "../gl/program";
import { bindRenderTarget, type RenderTarget } from "../gl/renderTarget";
import { FULLSCREEN_VERT } from "../shaders/fullscreen.vert";
import { BLACKHOLE_CORE_FRAG } from "../shaders/blackholeCore.frag";
import { BLACKHOLE_PARTICLES_VERT } from "../shaders/blackholeParticles.vert";
import { BLACKHOLE_PARTICLES_FRAG } from "../shaders/blackholeParticles.frag";

export type BlackholeUniforms = {
  progress: number;
  form: number;
  spread: number;
  flightMin: number;
  flightMax: number;
  collapse: number;
  gridX: number;
  gridY: number;
  glow: number;
  swirl: number;
  arms: number;
  lensing: number;
  horizon: number;
  intensity: number;
  aspect: number;
  diskCount: number;
  count: number;
};

export function createBlackholePass(gl: WebGL2RenderingContext, quad: { draw(): void }) {
  const coreProgram = compileProgram(gl, FULLSCREEN_VERT, BLACKHOLE_CORE_FRAG);
  const particleProgram = compileProgram(gl, BLACKHOLE_PARTICLES_VERT, BLACKHOLE_PARTICLES_FRAG);
  const vao = gl.createVertexArray();
  if (!vao) throw new Error("Failed to create VAO");
  const cu = (n: string) => gl.getUniformLocation(coreProgram, n);
  const C = {
    field: cu("uField"),
    progress: cu("uProgress"),
    form: cu("uForm"),
    spread: cu("uSpread"),
    flightMin: cu("uFlightMin"),
    flightMax: cu("uFlightMax"),
    collapse: cu("uCollapse"),
    grid: cu("uGrid"),
    glow: cu("uGlow"),
    swirl: cu("uSwirl"),
    arms: cu("uArms"),
    lens: cu("uLens"),
    horizon: cu("uHorizon"),
    aspect: cu("uAspect"),
  };
  const pu = (n: string) => gl.getUniformLocation(particleProgram, n);
  const P = {
    field: pu("uField"),
    progress: pu("uProgress"),
    form: pu("uForm"),
    spread: pu("uSpread"),
    flightMin: pu("uFlightMin"),
    flightMax: pu("uFlightMax"),
    collapse: pu("uCollapse"),
    grid: pu("uGrid"),
    glow: pu("uGlow"),
    swirl: pu("uSwirl"),
    arms: pu("uArms"),
    horizon: pu("uHorizon"),
    intensity: pu("uIntensity"),
    aspect: pu("uAspect"),
    diskCount: pu("uDiskCount"),
  };
  return {
    render(target: RenderTarget, fieldTex: WebGLTexture, p: BlackholeUniforms) {
      bindRenderTarget(gl, target);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, fieldTex);

      gl.useProgram(coreProgram);
      gl.uniform1i(C.field, 0);
      gl.uniform1f(C.progress, p.progress);
      gl.uniform1f(C.form, p.form);
      gl.uniform1f(C.spread, p.spread);
      gl.uniform1f(C.flightMin, p.flightMin);
      gl.uniform1f(C.flightMax, p.flightMax);
      gl.uniform1f(C.collapse, p.collapse);
      gl.uniform2f(C.grid, p.gridX, p.gridY);
      gl.uniform1f(C.glow, p.glow);
      gl.uniform1f(C.swirl, p.swirl);
      gl.uniform1f(C.arms, p.arms);
      gl.uniform1f(C.lens, p.lensing);
      gl.uniform1f(C.horizon, p.horizon);
      gl.uniform1f(C.aspect, p.aspect);
      quad.draw();

      if (p.progress < 1) {
        gl.useProgram(particleProgram);
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, fieldTex);
        gl.uniform1i(P.field, 0);
        gl.uniform1f(P.progress, p.progress);
        gl.uniform1f(P.form, p.form);
        gl.uniform1f(P.spread, p.spread);
        gl.uniform1f(P.flightMin, p.flightMin);
        gl.uniform1f(P.flightMax, p.flightMax);
        gl.uniform1f(P.collapse, p.collapse);
        gl.uniform2f(P.grid, p.gridX, p.gridY);
        gl.uniform1f(P.glow, p.glow);
        gl.uniform1f(P.swirl, p.swirl);
        gl.uniform1f(P.arms, p.arms);
        gl.uniform1f(P.horizon, p.horizon);
        gl.uniform1f(P.intensity, p.intensity);
        gl.uniform1f(P.aspect, p.aspect);
        gl.uniform1f(P.diskCount, p.diskCount);
        gl.enable(gl.BLEND);
        gl.blendEquation(gl.MAX);
        gl.bindVertexArray(vao);
        gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, Math.max(1, Math.floor(p.count)));
        gl.bindVertexArray(null);
        gl.blendEquation(gl.FUNC_ADD);
        gl.disable(gl.BLEND);
      }
    },
    dispose() {
      gl.deleteProgram(coreProgram);
      gl.deleteProgram(particleProgram);
      gl.deleteVertexArray(vao);
    },
  };
}
