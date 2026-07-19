import { compileProgram } from "../gl/program";
import { bindRenderTarget, type RenderTarget } from "../gl/renderTarget";
import { FULLSCREEN_VERT } from "../shaders/fullscreen.vert";
import { PARTICLE_MERGE_VERT } from "../shaders/particleMerge.vert";
import { PARTICLE_MERGE_FRAG } from "../shaders/particleMerge.frag";
import { PARTICLE_SETTLE_FRAG } from "../shaders/particleSettle.frag";

export type ParticleMergeUniforms = {
  count: number;
  progress: number;
  spread: number;
  flight: number;
  settle: number;
  sizeUv: [number, number];
  swirl: number;
};

export function createParticleMergePass(gl: WebGL2RenderingContext, quad: { draw(): void }) {
  const particleProgram = compileProgram(gl, PARTICLE_MERGE_VERT, PARTICLE_MERGE_FRAG);
  const settleProgram = compileProgram(gl, FULLSCREEN_VERT, PARTICLE_SETTLE_FRAG);
  const vao = gl.createVertexArray();
  if (!vao) throw new Error("Failed to create VAO");
  const u = (n: string) => gl.getUniformLocation(particleProgram, n);
  const L = {
    field: u("uField"),
    progress: u("uProgress"),
    spread: u("uSpread"),
    flight: u("uFlight"),
    sizeUv: u("uSizeUv"),
    swirl: u("uSwirl"),
  };
  const settleField = gl.getUniformLocation(settleProgram, "uField");
  return {
    render(target: RenderTarget, fieldTex: WebGLTexture, p: ParticleMergeUniforms) {
      bindRenderTarget(gl, target);
      gl.clearColor(0, 0, 0, 1);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, fieldTex);
      if (p.settle < 1) {
        gl.useProgram(particleProgram);
        gl.uniform1i(L.field, 0);
        gl.uniform1f(L.progress, p.progress);
        gl.uniform1f(L.spread, p.spread);
        gl.uniform1f(L.flight, p.flight);
        gl.uniform2f(L.sizeUv, p.sizeUv[0], p.sizeUv[1]);
        gl.uniform1f(L.swirl, p.swirl);
        gl.enable(gl.BLEND);
        gl.blendEquation(gl.MAX);
        gl.bindVertexArray(vao);
        gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, Math.max(1, Math.floor(p.count)));
        gl.bindVertexArray(null);
        gl.blendEquation(gl.FUNC_ADD);
        gl.disable(gl.BLEND);
      }
      if (p.settle > 0) {
        gl.useProgram(settleProgram);
        gl.uniform1i(settleField, 0);
        if (p.settle < 1) {
          gl.enable(gl.BLEND);
          gl.blendColor(0, 0, 0, p.settle);
          gl.blendFunc(gl.CONSTANT_ALPHA, gl.ONE_MINUS_CONSTANT_ALPHA);
          quad.draw();
          gl.blendFunc(gl.ONE, gl.ZERO);
          gl.blendColor(0, 0, 0, 0);
          gl.disable(gl.BLEND);
        } else {
          quad.draw();
        }
      }
    },
    dispose() {
      gl.deleteProgram(particleProgram);
      gl.deleteProgram(settleProgram);
      gl.deleteVertexArray(vao);
    },
  };
}
