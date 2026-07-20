import { compileProgram } from "../gl/program";
import { bindRenderTarget, type RenderTarget } from "../gl/renderTarget";
import { FULLSCREEN_VERT } from "../shaders/fullscreen.vert";
import { HADOUKEN_CORE_FRAG } from "../shaders/hadoukenCore.frag";
import { HADOUKEN_PARTICLES_VERT } from "../shaders/hadoukenParticles.vert";
import { HADOUKEN_PARTICLES_FRAG } from "../shaders/hadoukenParticles.frag";

export type HadoukenUniforms = {
  progress: number;
  spread: number;
  flight: number;
  charge: number;
  count: number;
  sizeUv: [number, number];
  detail: number;
  glow: number;
  aspect: number;
};

export function createHadoukenPass(gl: WebGL2RenderingContext, quad: { draw(): void }) {
  const coreProgram = compileProgram(gl, FULLSCREEN_VERT, HADOUKEN_CORE_FRAG);
  const particleProgram = compileProgram(gl, HADOUKEN_PARTICLES_VERT, HADOUKEN_PARTICLES_FRAG);
  const vao = gl.createVertexArray();
  if (!vao) throw new Error("Failed to create VAO");
  const cu = (n: string) => gl.getUniformLocation(coreProgram, n);
  const C = {
    field: cu("uField"),
    charge: cu("uCharge"),
    detail: cu("uDetail"),
    glow: cu("uGlow"),
    aspect: cu("uAspect"),
  };
  const pu = (n: string) => gl.getUniformLocation(particleProgram, n);
  const P = {
    progress: pu("uProgress"),
    spread: pu("uSpread"),
    flight: pu("uFlight"),
    sizeUv: pu("uSizeUv"),
    aspect: pu("uAspect"),
  };
  return {
    render(target: RenderTarget, fieldTex: WebGLTexture, p: HadoukenUniforms) {
      bindRenderTarget(gl, target);
      gl.useProgram(coreProgram);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, fieldTex);
      gl.uniform1i(C.field, 0);
      gl.uniform1f(C.charge, p.charge);
      gl.uniform1f(C.detail, p.detail);
      gl.uniform1f(C.glow, p.glow);
      gl.uniform1f(C.aspect, p.aspect);
      quad.draw();
      if (p.charge < 1) {
        gl.useProgram(particleProgram);
        gl.uniform1f(P.progress, p.progress);
        gl.uniform1f(P.spread, p.spread);
        gl.uniform1f(P.flight, p.flight);
        gl.uniform2f(P.sizeUv, p.sizeUv[0], p.sizeUv[1]);
        gl.uniform1f(P.aspect, p.aspect);
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
