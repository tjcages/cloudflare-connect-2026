import { compileProgram } from "../gl/program";
import { bindRenderTarget, type RenderTarget } from "../gl/renderTarget";
import { FULLSCREEN_VERT } from "../shaders/fullscreen.vert";
import { ENERGETIC_MERGE_FRAG } from "../shaders/energeticMerge.frag";

export type EnergeticMergeUniforms = {
  mode: number;
  progress: number;
  spread: number;
  flight: number;
  moveEnd: number;
  massCount: number;
  overshoot: number;
  impact: number;
  sigmaUv: [number, number];
  blurStart: number;
  aspect: number;
};

export function createEnergeticMergePass(gl: WebGL2RenderingContext, quad: { draw(): void }) {
  const program = compileProgram(gl, FULLSCREEN_VERT, ENERGETIC_MERGE_FRAG);
  const u = (n: string) => gl.getUniformLocation(program, n);
  const L = {
    field: u("uField"),
    blurQuarter: u("uBlurQuarter"),
    blurHalf: u("uBlurHalf"),
    blurFull: u("uBlurFull"),
    mode: u("uMode"),
    progress: u("uProgress"),
    spread: u("uSpread"),
    flight: u("uFlight"),
    moveEnd: u("uMoveEnd"),
    massCount: u("uMassCount"),
    overshoot: u("uOvershoot"),
    impact: u("uImpact"),
    sigmaUv: u("uSigmaUv"),
    blurStart: u("uBlurStart"),
    aspect: u("uAspect"),
  };
  return {
    render(
      target: RenderTarget,
      fieldTex: WebGLTexture,
      blurQuarterTex: WebGLTexture,
      blurHalfTex: WebGLTexture,
      blurFullTex: WebGLTexture,
      p: EnergeticMergeUniforms,
    ) {
      bindRenderTarget(gl, target);
      gl.useProgram(program);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, fieldTex);
      gl.uniform1i(L.field, 0);
      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, blurQuarterTex);
      gl.uniform1i(L.blurQuarter, 1);
      gl.activeTexture(gl.TEXTURE2);
      gl.bindTexture(gl.TEXTURE_2D, blurHalfTex);
      gl.uniform1i(L.blurHalf, 2);
      gl.activeTexture(gl.TEXTURE3);
      gl.bindTexture(gl.TEXTURE_2D, blurFullTex);
      gl.uniform1i(L.blurFull, 3);
      gl.activeTexture(gl.TEXTURE0);
      gl.uniform1i(L.mode, p.mode);
      gl.uniform1f(L.progress, p.progress);
      gl.uniform1f(L.spread, p.spread);
      gl.uniform1f(L.flight, p.flight);
      gl.uniform1f(L.moveEnd, p.moveEnd);
      gl.uniform1f(L.massCount, p.massCount);
      gl.uniform1f(L.overshoot, p.overshoot);
      gl.uniform1f(L.impact, p.impact);
      gl.uniform2f(L.sigmaUv, p.sigmaUv[0], p.sigmaUv[1]);
      gl.uniform1f(L.blurStart, p.blurStart);
      gl.uniform1f(L.aspect, p.aspect);
      quad.draw();
    },
    dispose() {
      gl.deleteProgram(program);
    },
  };
}
