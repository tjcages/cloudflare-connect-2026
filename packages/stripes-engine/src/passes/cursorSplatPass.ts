import { compileProgram } from "../gl/program";
import { bindRenderTarget, type RenderTarget } from "../gl/renderTarget";
import { CURSOR_SPLAT_VERT } from "../shaders/cursorSplat.vert";
import { CURSOR_SPLAT_FRAG } from "../shaders/cursorSplat.frag";
import type { CursorTrailSample } from "../cursorTrail/cursorTrailSim";

const FLOATS_PER_INSTANCE = 9;
const STRIDE_BYTES = FLOATS_PER_INSTANCE * 4;

export type CursorSplatParams = {
  cols: number;
  rows: number;
  displayWidth: number;
  displayHeight: number;
  pushRadiusScale: number;
  pushScale: number;
};

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

export function createCursorSplatPass(gl: WebGL2RenderingContext) {
  const program = compileProgram(gl, CURSOR_SPLAT_VERT, CURSOR_SPLAT_FRAG);
  const vao = gl.createVertexArray();
  if (!vao) throw new Error("Failed to create VAO");
  const buf = gl.createBuffer();
  if (!buf) throw new Error("Failed to create instance buffer");

  const aCenterCell = gl.getAttribLocation(program, "aCenterCell");
  const aBrightenRadiusCell = gl.getAttribLocation(program, "aBrightenRadiusCell");
  const aPushCenterCell = gl.getAttribLocation(program, "aPushCenterCell");
  const aPushRadiusCell = gl.getAttribLocation(program, "aPushRadiusCell");
  const aAlpha = gl.getAttribLocation(program, "aAlpha");
  const aProgress = gl.getAttribLocation(program, "aProgress");
  const aSeed = gl.getAttribLocation(program, "aSeed");
  const uGridSize = gl.getUniformLocation(program, "uGridSize");
  const uPushScale = gl.getUniformLocation(program, "uPushScale");

  gl.bindVertexArray(vao);
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.enableVertexAttribArray(aCenterCell);
  gl.vertexAttribPointer(aCenterCell, 2, gl.FLOAT, false, STRIDE_BYTES, 0);
  gl.vertexAttribDivisor(aCenterCell, 1);
  gl.enableVertexAttribArray(aBrightenRadiusCell);
  gl.vertexAttribPointer(aBrightenRadiusCell, 1, gl.FLOAT, false, STRIDE_BYTES, 8);
  gl.vertexAttribDivisor(aBrightenRadiusCell, 1);
  gl.enableVertexAttribArray(aPushCenterCell);
  gl.vertexAttribPointer(aPushCenterCell, 2, gl.FLOAT, false, STRIDE_BYTES, 12);
  gl.vertexAttribDivisor(aPushCenterCell, 1);
  gl.enableVertexAttribArray(aPushRadiusCell);
  gl.vertexAttribPointer(aPushRadiusCell, 1, gl.FLOAT, false, STRIDE_BYTES, 20);
  gl.vertexAttribDivisor(aPushRadiusCell, 1);
  gl.enableVertexAttribArray(aAlpha);
  gl.vertexAttribPointer(aAlpha, 1, gl.FLOAT, false, STRIDE_BYTES, 24);
  gl.vertexAttribDivisor(aAlpha, 1);
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
    render(target: RenderTarget, samples: readonly CursorTrailSample[], p: CursorSplatParams) {
      bindRenderTarget(gl, target);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);

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
        const alpha = clamp01(s.alpha);
        if (alpha <= 0) continue;
        const brightenRadiusCell = Math.max(1, s.radius * radiusScale);
        const pushRadiusCell = Math.max(1, s.radius * p.pushRadiusScale * radiusScale);
        const base = count * FLOATS_PER_INSTANCE;
        instanceData[base] = s.x * scaleX;
        instanceData[base + 1] = s.y * scaleY;
        instanceData[base + 2] = brightenRadiusCell;
        instanceData[base + 3] = s.pushX * scaleX;
        instanceData[base + 4] = s.pushY * scaleY;
        instanceData[base + 5] = pushRadiusCell;
        instanceData[base + 6] = alpha;
        instanceData[base + 7] = s.progress;
        instanceData[base + 8] = s.seed;
        count++;
      }

      gl.useProgram(program);
      gl.uniform2f(uGridSize, p.cols, p.rows);
      gl.uniform1f(uPushScale, p.pushScale);

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
