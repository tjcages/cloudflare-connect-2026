import type { CometTrailConfig } from "../config/types";
import {
  COMET_EMBER_FLOATS,
  COMET_EMBER_STRIDE_BYTES,
  createCometState,
  stepComet,
  type CometCaps,
  type CometState,
} from "../cursorTrail/cometSim";
import type { CursorTrailPoint } from "../cursorTrail/cursorTrailSim";
import { compileProgram } from "../gl/program";
import {
  bindRenderTarget,
  createRenderTarget,
  disposeRenderTarget,
  resizeRenderTarget,
  type RenderTarget,
} from "../gl/renderTarget";
import { buildCometFrag } from "../shaders/comet.frag";
import { COMET_EMBER_FRAG } from "../shaders/cometEmber.frag";
import { COMET_EMBER_VERT } from "../shaders/cometEmber.vert";
import { FULLSCREEN_VERT } from "../shaders/fullscreen.vert";

export type CometRenderParams = {
  config: CometTrailConfig;
  cursor: CursorTrailPoint | null;
  cssW: number;
  cssH: number;
  now: number;
  timeSec: number;
};

export function createCometPass(gl: WebGL2RenderingContext, quad: { draw(): void }, caps: CometCaps) {
  const program = compileProgram(gl, FULLSCREEN_VERT, buildCometFrag(caps.nodeCount));
  const emberProgram = compileProgram(gl, COMET_EMBER_VERT, COMET_EMBER_FRAG);

  const vao = gl.createVertexArray();
  const buffer = gl.createBuffer();
  if (!vao || !buffer) {
    gl.deleteProgram(program);
    gl.deleteProgram(emberProgram);
    if (vao) gl.deleteVertexArray(vao);
    if (buffer) gl.deleteBuffer(buffer);
    throw new Error("Failed to create comet trail GL objects");
  }
  gl.bindVertexArray(vao);
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  const aEmber = gl.getAttribLocation(emberProgram, "aEmber");
  gl.enableVertexAttribArray(aEmber);
  gl.vertexAttribPointer(aEmber, 4, gl.FLOAT, false, COMET_EMBER_STRIDE_BYTES, 0);
  gl.vertexAttribDivisor(aEmber, 1);
  gl.bindVertexArray(null);
  gl.bindBuffer(gl.ARRAY_BUFFER, null);

  const uField = gl.getUniformLocation(program, "uField");
  const uHeat = gl.getUniformLocation(program, "uHeat");
  const uCssSize = gl.getUniformLocation(program, "uCssSize");
  const uNode = gl.getUniformLocation(program, "uNode[0]");
  const uNodeR = gl.getUniformLocation(program, "uNodeR[0]");
  const uPresence = gl.getUniformLocation(program, "uPresence");
  const uCore = gl.getUniformLocation(program, "uCore");
  const uTime = gl.getUniformLocation(program, "uTime");
  const uSmoothUnionPx = gl.getUniformLocation(program, "uSmoothUnionPx");
  const uStyle = gl.getUniformLocation(program, "uStyle");
  const uEmberCanvas = gl.getUniformLocation(emberProgram, "uCanvas");
  const uEmberFadeIn = gl.getUniformLocation(emberProgram, "uFadeIn");

  let state: CometState | null = null;
  let seed = -1;
  let heat: RenderTarget | null = null;

  return {
    render(target: RenderTarget, fieldTex: WebGLTexture, p: CometRenderParams) {
      const c = p.config;
      if (!state || c.seed !== seed) {
        seed = c.seed;
        state = createCometState(caps, seed);
      }
      stepComet(state, c, p.cursor, p.cssW, p.cssH, p.now);

      if (!heat) heat = createRenderTarget(gl, target.width, target.height, { linear: true });
      else resizeRenderTarget(gl, heat, target.width, target.height);

      bindRenderTarget(gl, heat);
      gl.clearColor(0, 0, 0, 1);
      gl.clear(gl.COLOR_BUFFER_BIT);
      if (c.embersEnabled && state.emberCount > 0) {
        gl.useProgram(emberProgram);
        gl.uniform2f(uEmberCanvas, Math.max(1, p.cssW), Math.max(1, p.cssH));
        gl.uniform1f(uEmberFadeIn, c.emberFadeInFraction);
        gl.bindVertexArray(vao);
        gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
        gl.bufferData(
          gl.ARRAY_BUFFER,
          state.emberData.subarray(0, state.emberCount * COMET_EMBER_FLOATS),
          gl.DYNAMIC_DRAW,
        );
        gl.bindBuffer(gl.ARRAY_BUFFER, null);
        gl.enable(gl.BLEND);
        gl.blendFunc(gl.ONE, gl.ONE);
        gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, state.emberCount);
        gl.disable(gl.BLEND);
        gl.bindVertexArray(null);
      }

      bindRenderTarget(gl, target);
      gl.useProgram(program);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, fieldTex);
      gl.uniform1i(uField, 0);
      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, heat.texture);
      gl.uniform1i(uHeat, 1);
      gl.activeTexture(gl.TEXTURE0);
      gl.uniform2f(uCssSize, Math.max(1, p.cssW), Math.max(1, p.cssH));
      gl.uniform2fv(uNode, state.nodeData);
      gl.uniform1fv(uNodeR, state.radiusData);
      gl.uniform1f(uPresence, state.presence);
      gl.uniform1f(uCore, state.core);
      gl.uniform1f(uTime, p.timeSec);
      gl.uniform1f(uSmoothUnionPx, c.smoothUnionPx);
      gl.uniform4f(uStyle, c.bodyBrightness, c.auraStrength, c.bodyPushPx, c.emberBrightness);
      quad.draw();
    },
    dispose() {
      gl.deleteProgram(program);
      gl.deleteProgram(emberProgram);
      gl.deleteVertexArray(vao);
      gl.deleteBuffer(buffer);
      if (heat) {
        disposeRenderTarget(gl, heat);
        heat = null;
      }
      state = null;
    },
  };
}
