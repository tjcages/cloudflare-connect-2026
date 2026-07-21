import type { DetonationClickConfig } from "../config/types";
import { stepDetonation, type DetonationCaps, type DetonationState } from "../detonation/detonationSim";
import { compileProgram } from "../gl/program";
import { bindRenderTarget, type RenderTarget } from "../gl/renderTarget";
import { buildDetonationFrag } from "../shaders/detonation.frag";
import { FULLSCREEN_VERT } from "../shaders/fullscreen.vert";

export type DetonationRenderParams = {
  config: DetonationClickConfig;
  state: DetonationState;
  cssW: number;
  cssH: number;
  timeSec: number;
};

export function createDetonationPass(gl: WebGL2RenderingContext, quad: { draw(): void }, caps: DetonationCaps) {
  const program = compileProgram(gl, FULLSCREEN_VERT, buildDetonationFrag(caps.maxConcurrent, caps.debrisCount));
  const uField = gl.getUniformLocation(program, "uField");
  const uCssSize = gl.getUniformLocation(program, "uCssSize");
  const uDetCount = gl.getUniformLocation(program, "uDetCount");
  const uDetCenter = gl.getUniformLocation(program, "uDetCenter[0]");
  const uDetLife = gl.getUniformLocation(program, "uDetLife[0]");
  const uRing = gl.getUniformLocation(program, "uRing");
  const uFlash = gl.getUniformLocation(program, "uFlash");
  const uDebrisA = gl.getUniformLocation(program, "uDebrisA");
  const uDebrisB = gl.getUniformLocation(program, "uDebrisB");
  const uCrater = gl.getUniformLocation(program, "uCrater");
  const uCraterExtra = gl.getUniformLocation(program, "uCraterExtra");

  return {
    render(target: RenderTarget, fieldTex: WebGLTexture, p: DetonationRenderParams) {
      const c = p.config;
      const state = p.state;
      stepDetonation(state, c, p.timeSec);

      bindRenderTarget(gl, target);
      gl.useProgram(program);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, fieldTex);
      gl.uniform1i(uField, 0);
      gl.uniform2f(uCssSize, Math.max(1, p.cssW), Math.max(1, p.cssH));
      gl.uniform1i(uDetCount, state.count);
      gl.uniform2fv(uDetCenter, state.centerData);
      gl.uniform4fv(uDetLife, state.lifeData);
      gl.uniform4f(uRing, c.ringReachPx, c.ringDurationMs / 1000, c.ringThicknessPx, c.ringRefractionPx);
      gl.uniform4f(uFlash, c.flashRadiusPx, c.flashBrightness, c.flashDurationMs / 1000, 0);
      gl.uniform4f(uDebrisA, c.debrisSpeedPxPerSec, c.debrisSpeedVariation, c.debrisDrag, c.debrisGravityPxPerSec2);
      gl.uniform4f(uDebrisB, c.debrisLifetimeMs / 1000, c.debrisLifetimeVariation, c.debrisSizePx, c.debrisBrightness);
      gl.uniform4f(uCrater, c.craterRadiusPx, c.craterDepth, c.craterRelaxFastMs / 1000, c.craterRelaxSlowMs / 1000);
      gl.uniform4f(uCraterExtra, c.craterLifeMs / 1000, c.craterRimStrength, 0, 0);
      quad.draw();
    },
    dispose() {
      gl.deleteProgram(program);
    },
  };
}
