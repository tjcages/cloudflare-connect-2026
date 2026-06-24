import { compileProgram } from "../gl/program";
import { bindRenderTarget, bindMrtTarget, type RenderTarget, type MrtTarget } from "../gl/renderTarget";
import { FLAMES_VERT, FLAMES_COLOR_VERT } from "../shaders/flames.vert";
import { FLAMES_FRAG, FLAMES_COLOR_FRAG } from "../shaders/flames.frag";
import type { Flame } from "../flames/flamesSim";
import type { VibrantColor } from "../colors/vibrantPalette";

type FlamesOpts = { canvasW: number; canvasH: number; vertical: boolean; inner: number; outer: number };

export function createFlamesPass(gl: WebGL2RenderingContext) {
  const lumProgram = compileProgram(gl, FLAMES_VERT, FLAMES_FRAG);
  const colorProgram = compileProgram(gl, FLAMES_COLOR_VERT, FLAMES_COLOR_FRAG);

  const lumVao = gl.createVertexArray();
  const colorVao = gl.createVertexArray();
  const lumBuf = gl.createBuffer();
  const colorBuf = gl.createBuffer();
  if (!lumVao || !colorVao || !lumBuf || !colorBuf) throw new Error("Failed to create flames GL objects");

  const lumStride = 20;
  gl.bindVertexArray(lumVao);
  gl.bindBuffer(gl.ARRAY_BUFFER, lumBuf);
  {
    const aRect = gl.getAttribLocation(lumProgram, "aRect");
    const aOpacity = gl.getAttribLocation(lumProgram, "aOpacity");
    gl.enableVertexAttribArray(aRect);
    gl.vertexAttribPointer(aRect, 4, gl.FLOAT, false, lumStride, 0);
    gl.vertexAttribDivisor(aRect, 1);
    gl.enableVertexAttribArray(aOpacity);
    gl.vertexAttribPointer(aOpacity, 1, gl.FLOAT, false, lumStride, 16);
    gl.vertexAttribDivisor(aOpacity, 1);
  }

  const colorStride = 32;
  gl.bindVertexArray(colorVao);
  gl.bindBuffer(gl.ARRAY_BUFFER, colorBuf);
  {
    const aRect = gl.getAttribLocation(colorProgram, "aRect");
    const aOpacity = gl.getAttribLocation(colorProgram, "aOpacity");
    const aColor = gl.getAttribLocation(colorProgram, "aColor");
    gl.enableVertexAttribArray(aRect);
    gl.vertexAttribPointer(aRect, 4, gl.FLOAT, false, colorStride, 0);
    gl.vertexAttribDivisor(aRect, 1);
    gl.enableVertexAttribArray(aOpacity);
    gl.vertexAttribPointer(aOpacity, 1, gl.FLOAT, false, colorStride, 16);
    gl.vertexAttribDivisor(aOpacity, 1);
    gl.enableVertexAttribArray(aColor);
    gl.vertexAttribPointer(aColor, 3, gl.FLOAT, false, colorStride, 20);
    gl.vertexAttribDivisor(aColor, 1);
  }
  gl.bindVertexArray(null);
  gl.bindBuffer(gl.ARRAY_BUFFER, null);

  const lumUCanvas = gl.getUniformLocation(lumProgram, "uCanvas");
  const lumUVertical = gl.getUniformLocation(lumProgram, "uVertical");
  const lumUInner = gl.getUniformLocation(lumProgram, "uInner");
  const lumUOuter = gl.getUniformLocation(lumProgram, "uOuter");

  const colorUCanvas = gl.getUniformLocation(colorProgram, "uCanvas");
  const colorUVertical = gl.getUniformLocation(colorProgram, "uVertical");
  const colorUInner = gl.getUniformLocation(colorProgram, "uInner");
  const colorUOuter = gl.getUniformLocation(colorProgram, "uOuter");

  let lumData = new Float32Array(0);
  let colorData = new Float32Array(0);

  return {
    render(target: RenderTarget, flames: Flame[], opts: FlamesOpts) {
      if (flames.length === 0) return;

      const needed = flames.length * 5;
      if (lumData.length < needed) lumData = new Float32Array(needed);
      for (let i = 0; i < flames.length; i++) {
        const f = flames[i];
        const base = i * 5;
        lumData[base] = f.x;
        lumData[base + 1] = f.y;
        lumData[base + 2] = f.width;
        lumData[base + 3] = f.height;
        lumData[base + 4] = f.opacity;
      }

      bindRenderTarget(gl, target);
      gl.useProgram(lumProgram);
      gl.uniform2f(lumUCanvas, opts.canvasW, opts.canvasH);
      gl.uniform1f(lumUVertical, opts.vertical ? 1.0 : 0.0);
      gl.uniform1f(lumUInner, opts.inner);
      gl.uniform1f(lumUOuter, opts.outer);

      gl.bindVertexArray(lumVao);
      gl.bindBuffer(gl.ARRAY_BUFFER, lumBuf);
      gl.bufferData(gl.ARRAY_BUFFER, lumData.subarray(0, needed), gl.DYNAMIC_DRAW);
      gl.bindBuffer(gl.ARRAY_BUFFER, null);

      gl.enable(gl.BLEND);
      gl.blendFunc(gl.ONE, gl.ONE);
      gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, flames.length);
      gl.disable(gl.BLEND);
      gl.bindVertexArray(null);
    },
    renderColors(
      mrt: MrtTarget,
      field: RenderTarget,
      fieldColor: RenderTarget,
      flames: Flame[],
      palette: VibrantColor[],
      opts: FlamesOpts,
    ) {
      if (flames.length === 0) return;
      const paletteLen = Math.max(1, palette.length);

      const needed = flames.length * 8;
      if (colorData.length < needed) colorData = new Float32Array(needed);
      for (let i = 0; i < flames.length; i++) {
        const f = flames[i];
        const base = i * 8;
        const pick = palette[Math.min(paletteLen - 1, Math.floor(f.colorSeed * paletteLen))];
        colorData[base] = f.x;
        colorData[base + 1] = f.y;
        colorData[base + 2] = f.width;
        colorData[base + 3] = f.height;
        colorData[base + 4] = f.opacity;
        colorData[base + 5] = pick.r / 255;
        colorData[base + 6] = pick.g / 255;
        colorData[base + 7] = pick.b / 255;
      }

      bindMrtTarget(gl, mrt, [field, fieldColor]);
      gl.useProgram(colorProgram);
      gl.uniform2f(colorUCanvas, opts.canvasW, opts.canvasH);
      gl.uniform1f(colorUVertical, opts.vertical ? 1.0 : 0.0);
      gl.uniform1f(colorUInner, opts.inner);
      gl.uniform1f(colorUOuter, opts.outer);

      gl.bindVertexArray(colorVao);
      gl.bindBuffer(gl.ARRAY_BUFFER, colorBuf);
      gl.bufferData(gl.ARRAY_BUFFER, colorData.subarray(0, needed), gl.DYNAMIC_DRAW);
      gl.bindBuffer(gl.ARRAY_BUFFER, null);

      gl.enable(gl.BLEND);
      gl.blendFunc(gl.ONE, gl.ONE);
      gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, flames.length);
      gl.disable(gl.BLEND);
      gl.bindVertexArray(null);
    },
    dispose() {
      gl.deleteProgram(lumProgram);
      gl.deleteProgram(colorProgram);
      gl.deleteVertexArray(lumVao);
      gl.deleteVertexArray(colorVao);
      gl.deleteBuffer(lumBuf);
      gl.deleteBuffer(colorBuf);
    },
  };
}
