import { compileProgram } from "../gl/program";
import { bindRenderTarget, type RenderTarget } from "../gl/renderTarget";
import { CLICK_SPLAT_VERT } from "../shaders/clickSplat.vert";
import { CLICK_SPLAT_FRAG } from "../shaders/clickSplat.frag";
import type { ClickWaveSample } from "../cursorTrail/clickWaveSim";

const FLOATS_PER_INSTANCE = 9;
const STRIDE_BYTES = FLOATS_PER_INSTANCE * 4;

export type ClickSplatParams = {
  cols: number;
  rows: number;
  displayWidth: number;
  displayHeight: number;
  pushScale: number;
  pushBandScale: number;
  stripeWhiteAlpha: number;
};

export function createClickSplatPass(gl: WebGL2RenderingContext) {
  const program = compileProgram(gl, CLICK_SPLAT_VERT, CLICK_SPLAT_FRAG);
  const vao = gl.createVertexArray();
  if (!vao) throw new Error("Failed to create VAO");
  const buf = gl.createBuffer();
  if (!buf) throw new Error("Failed to create instance buffer");

  const aCenterCell = gl.getAttribLocation(program, "aCenterCell");
  const aRadiusCell = gl.getAttribLocation(program, "aRadiusCell");
  const aHalfStrokeCell = gl.getAttribLocation(program, "aHalfStrokeCell");
  const aPushBandCell = gl.getAttribLocation(program, "aPushBandCell");
  const aPushPeak = gl.getAttribLocation(program, "aPushPeak");
  const aWhiteAmt = gl.getAttribLocation(program, "aWhiteAmt");
  const aProgress = gl.getAttribLocation(program, "aProgress");
  const aSeed = gl.getAttribLocation(program, "aSeed");
  const uGridSize = gl.getUniformLocation(program, "uGridSize");

  gl.bindVertexArray(vao);
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.enableVertexAttribArray(aCenterCell);
  gl.vertexAttribPointer(aCenterCell, 2, gl.FLOAT, false, STRIDE_BYTES, 0);
  gl.vertexAttribDivisor(aCenterCell, 1);
  gl.enableVertexAttribArray(aRadiusCell);
  gl.vertexAttribPointer(aRadiusCell, 1, gl.FLOAT, false, STRIDE_BYTES, 8);
  gl.vertexAttribDivisor(aRadiusCell, 1);
  gl.enableVertexAttribArray(aHalfStrokeCell);
  gl.vertexAttribPointer(aHalfStrokeCell, 1, gl.FLOAT, false, STRIDE_BYTES, 12);
  gl.vertexAttribDivisor(aHalfStrokeCell, 1);
  gl.enableVertexAttribArray(aPushBandCell);
  gl.vertexAttribPointer(aPushBandCell, 1, gl.FLOAT, false, STRIDE_BYTES, 16);
  gl.vertexAttribDivisor(aPushBandCell, 1);
  gl.enableVertexAttribArray(aPushPeak);
  gl.vertexAttribPointer(aPushPeak, 1, gl.FLOAT, false, STRIDE_BYTES, 20);
  gl.vertexAttribDivisor(aPushPeak, 1);
  gl.enableVertexAttribArray(aWhiteAmt);
  gl.vertexAttribPointer(aWhiteAmt, 1, gl.FLOAT, false, STRIDE_BYTES, 24);
  gl.vertexAttribDivisor(aWhiteAmt, 1);
  gl.enableVertexAttribArray(aProgress);
  gl.vertexAttribPointer(aProgress, 1, gl.FLOAT, false, STRIDE_BYTES, 28);
  gl.vertexAttribDivisor(aProgress, 1);
  gl.enableVertexAttribArray(aSeed);
  gl.vertexAttribPointer(aSeed, 1, gl.FLOAT, false, STRIDE_BYTES, 32);
  gl.vertexAttribDivisor(aSeed, 1);
  gl.bindVertexArray(null);
  gl.bindBuffer(gl.ARRAY_BUFFER, null);

  let instanceData = new Float32Array(0);

  return {
    render(target: RenderTarget, samples: readonly ClickWaveSample[], p: ClickSplatParams) {
      if (samples.length === 0) return;

      const scaleX = p.displayWidth > 0 ? p.cols / p.displayWidth : 1;
      const scaleY = p.displayHeight > 0 ? p.rows / p.displayHeight : 1;
      const radiusScale = p.displayWidth > 0 ? p.cols / p.displayWidth : 1;

      const needed = samples.length * FLOATS_PER_INSTANCE;
      if (instanceData.length < needed) {
        instanceData = new Float32Array(needed);
      }

      let count = 0;
      for (let i = 0; i < samples.length; i++) {
        const s = samples[i];
        const ringRadius = Math.max(0, s.radius * radiusScale);
        if (ringRadius <= 0) continue;
        const whiteAmt = s.whitePower * p.stripeWhiteAlpha;
        const pushPeak = p.pushScale * s.pushPower;
        if (whiteAmt <= 0 && pushPeak <= 0) continue;
        const halfStroke = Math.max(0.5, s.strokeWidth * 0.5 * radiusScale);
        const pushBand = Math.max(0.5, halfStroke * p.pushBandScale);
        const base = count * FLOATS_PER_INSTANCE;
        instanceData[base] = s.x * scaleX;
        instanceData[base + 1] = s.y * scaleY;
        instanceData[base + 2] = ringRadius;
        instanceData[base + 3] = halfStroke;
        instanceData[base + 4] = pushBand;
        instanceData[base + 5] = pushPeak;
        instanceData[base + 6] = whiteAmt;
        instanceData[base + 7] = s.waveProgress;
        instanceData[base + 8] = s.seed;
        count++;
      }

      if (count === 0) return;

      bindRenderTarget(gl, target);
      gl.useProgram(program);
      gl.uniform2f(uGridSize, p.cols, p.rows);

      gl.bindVertexArray(vao);
      gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.bufferData(gl.ARRAY_BUFFER, instanceData.subarray(0, count * FLOATS_PER_INSTANCE), gl.DYNAMIC_DRAW);
      gl.bindBuffer(gl.ARRAY_BUFFER, null);

      gl.enable(gl.BLEND);
      gl.blendFunc(gl.ONE, gl.ONE);
      gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, count);
      gl.disable(gl.BLEND);

      gl.bindVertexArray(null);
    },
    dispose() {
      gl.deleteProgram(program);
      gl.deleteVertexArray(vao);
      gl.deleteBuffer(buf);
    },
  };
}
