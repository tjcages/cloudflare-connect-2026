import type { BackgroundMeteors } from "../config/types";
import { compileProgram } from "../gl/program";
import { bindRenderTarget, type RenderTarget } from "../gl/renderTarget";
import { createMeteorsState, stepMeteors, type MeteorsCaps, type MeteorsState } from "../meteors/meteorsSim";
import { buildMeteorsFrag } from "../shaders/meteors.frag";
import { FULLSCREEN_VERT } from "../shaders/fullscreen.vert";

export type MeteorsRenderParams = {
  config: BackgroundMeteors;
  cssW: number;
  cssH: number;
  timeSec: number;
};

export function createMeteorsPass(gl: WebGL2RenderingContext, quad: { draw(): void }, caps: MeteorsCaps) {
  const program = compileProgram(gl, FULLSCREEN_VERT, buildMeteorsFrag(caps.maxActive));
  let state: MeteorsState | null = null;
  let seed = -1;

  const uField = gl.getUniformLocation(program, "uField");
  const uCssSize = gl.getUniformLocation(program, "uCssSize");
  const uRadiant = gl.getUniformLocation(program, "uRadiant");
  const uStyle = gl.getUniformLocation(program, "uStyle");
  const uMeteorCount = gl.getUniformLocation(program, "uMeteorCount");
  const uMeteorOrigin = gl.getUniformLocation(program, "uMeteorOrigin[0]");
  const uMeteorShape = gl.getUniformLocation(program, "uMeteorShape[0]");

  return {
    render(target: RenderTarget, fieldTex: WebGLTexture, p: MeteorsRenderParams) {
      const c = p.config;
      if (!state || c.seed !== seed) {
        seed = c.seed;
        state = createMeteorsState(caps, seed);
      }
      stepMeteors(state, c, p.cssW, p.cssH, p.timeSec);

      const radiant = (c.radiantAngleDeg * Math.PI) / 180;
      bindRenderTarget(gl, target);
      gl.useProgram(program);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, fieldTex);
      gl.uniform1i(uField, 0);
      gl.uniform2f(uCssSize, Math.max(1, p.cssW), Math.max(1, p.cssH));
      gl.uniform2f(uRadiant, Math.cos(radiant), Math.sin(radiant));
      gl.uniform4f(uStyle, c.brightness, c.headGlow, c.pushPx, c.pushFalloffScale);
      gl.uniform1i(uMeteorCount, state.count);
      gl.uniform4fv(uMeteorOrigin, state.originData);
      gl.uniform4fv(uMeteorShape, state.shapeData);
      quad.draw();
    },
    dispose() {
      gl.deleteProgram(program);
    },
  };
}
