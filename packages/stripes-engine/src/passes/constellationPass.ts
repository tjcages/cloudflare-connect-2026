import type { ConstellationTrailConfig } from "../config/types";
import {
  createConstellationState,
  stepConstellation,
  type ConstellationCaps,
  type ConstellationState,
} from "../cursorTrail/constellationSim";
import type { CursorTrailPoint } from "../cursorTrail/cursorTrailSim";
import { createDataTexture, updateDataTexture } from "../gl/dataTexture";
import { compileProgram } from "../gl/program";
import { bindRenderTarget, type RenderTarget } from "../gl/renderTarget";
import { buildConstellationFrag } from "../shaders/constellation.frag";
import { FULLSCREEN_VERT } from "../shaders/fullscreen.vert";

export type ConstellationRenderParams = {
  config: ConstellationTrailConfig;
  cursor: CursorTrailPoint | null;
  cssW: number;
  cssH: number;
  now: number;
  timeSec: number;
};

export function createConstellationPass(gl: WebGL2RenderingContext, quad: { draw(): void }, caps: ConstellationCaps) {
  const program = compileProgram(
    gl,
    FULLSCREEN_VERT,
    buildConstellationFrag(caps.maxStars, caps.maxLinks, caps.maxPulses),
  );
  const state: ConstellationState = createConstellationState(caps);
  const starTex = createDataTexture(gl, state.starBytes, caps.maxStars, 1);
  const starFxTex = createDataTexture(gl, state.starFxBytes, caps.maxStars, 1);

  const uField = gl.getUniformLocation(program, "uField");
  const uStars = gl.getUniformLocation(program, "uStars");
  const uStarFx = gl.getUniformLocation(program, "uStarFx");
  const uCssSize = gl.getUniformLocation(program, "uCssSize");
  const uCursor = gl.getUniformLocation(program, "uCursor");
  const uCursorFade = gl.getUniformLocation(program, "uCursorFade");
  const uLinkRadius = gl.getUniformLocation(program, "uLinkRadius");
  const uTime = gl.getUniformLocation(program, "uTime");
  const uStarCount = gl.getUniformLocation(program, "uStarCount");
  const uLineCount = gl.getUniformLocation(program, "uLineCount");
  const uPulseCount = gl.getUniformLocation(program, "uPulseCount");
  const uLineStyle = gl.getUniformLocation(program, "uLineStyle");
  const uStarStyle = gl.getUniformLocation(program, "uStarStyle");
  const uStarExtra = gl.getUniformLocation(program, "uStarExtra");
  const uPulseStyle = gl.getUniformLocation(program, "uPulseStyle");
  const uFlashStrength = gl.getUniformLocation(program, "uFlashStrength");
  const uLineSeg = gl.getUniformLocation(program, "uLineSeg");
  const uLineFx = gl.getUniformLocation(program, "uLineFx");
  const uPulseSeg = gl.getUniformLocation(program, "uPulseSeg");
  const uPulseFx = gl.getUniformLocation(program, "uPulseFx");

  return {
    render(target: RenderTarget, fieldTex: WebGLTexture, p: ConstellationRenderParams) {
      const c = p.config;
      stepConstellation(state, c, p.cursor, p.cssW, p.cssH, p.now);
      if (state.starsDirty) {
        updateDataTexture(gl, starTex, state.starBytes, caps.maxStars, 1);
        state.starsDirty = false;
      }
      updateDataTexture(gl, starFxTex, state.starFxBytes, caps.maxStars, 1);

      bindRenderTarget(gl, target);
      gl.useProgram(program);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, fieldTex);
      gl.uniform1i(uField, 0);
      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, starTex);
      gl.uniform1i(uStars, 1);
      gl.activeTexture(gl.TEXTURE2);
      gl.bindTexture(gl.TEXTURE_2D, starFxTex);
      gl.uniform1i(uStarFx, 2);
      gl.uniform2f(uCssSize, p.cssW, p.cssH);
      gl.uniform2f(uCursor, state.hasSmooth ? state.smoothX : -1e5, state.hasSmooth ? state.smoothY : -1e5);
      gl.uniform1f(uCursorFade, state.cursorFade);
      gl.uniform1f(uLinkRadius, Math.max(1, state.linkRadius));
      gl.uniform1f(uTime, p.timeSec);
      gl.uniform1i(uStarCount, state.starCount);
      gl.uniform1i(uLineCount, state.lineCount);
      gl.uniform1i(uPulseCount, state.pulseCount);
      gl.uniform4f(uLineStyle, c.linkThicknessPx, c.linkBrightness, c.linkGrooveDepth, c.linkShearPx);
      gl.uniform4f(uStarStyle, c.starSizePx, c.starSizeRandomness, c.starPushPx, c.starGrowScale);
      gl.uniform3f(uStarExtra, c.twinkleAmount, c.twinkleSpeed, c.flareScale);
      gl.uniform3f(uPulseStyle, c.pulseCoreLenPx, c.pulseTailLenPx, c.pulseBrightness);
      gl.uniform1f(uFlashStrength, c.polygonFlashEnabled ? c.polygonFlashStrength : 0);
      gl.uniform4fv(uLineSeg, state.segData);
      gl.uniform2fv(uLineFx, state.fxData);
      gl.uniform4fv(uPulseSeg, state.pulseSegData);
      gl.uniform2fv(uPulseFx, state.pulseFxData);
      quad.draw();
    },
    dispose() {
      gl.deleteProgram(program);
      gl.deleteTexture(starTex);
      gl.deleteTexture(starFxTex);
    },
  };
}
