import { compileProgram } from "../gl/program";
import { bindRenderTarget, type RenderTarget } from "../gl/renderTarget";
import { STARS_VERT, STARS_COLOR_VERT } from "../shaders/stars.vert";
import { STARS_FRAG, STARS_COLOR_FRAG } from "../shaders/stars.frag";
import type { Star } from "../stars/starsSim";
import type { VibrantColor } from "../colors/vibrantPalette";
import { unpackRgb } from "../colors/colorMath";

const STAR_QUAD_SCALE = 8;
const LUM_FLOATS_PER_INSTANCE = 6;
const LUM_STRIDE_BYTES = LUM_FLOATS_PER_INSTANCE * 4;
const COLOR_FLOATS_PER_INSTANCE = 9;
const COLOR_STRIDE_BYTES = COLOR_FLOATS_PER_INSTANCE * 4;

type StarsOpts = { canvasW: number; canvasH: number; color: number };

export function createStarsPass(gl: WebGL2RenderingContext) {
  const lumProgram = compileProgram(gl, STARS_VERT, STARS_FRAG);
  const colorProgram = compileProgram(gl, STARS_COLOR_VERT, STARS_COLOR_FRAG);

  const lumVao = gl.createVertexArray();
  const colorVao = gl.createVertexArray();
  const lumBuf = gl.createBuffer();
  const colorBuf = gl.createBuffer();
  if (!lumVao || !colorVao || !lumBuf || !colorBuf) throw new Error("Failed to create background stars GL objects");

  const lumStride = LUM_STRIDE_BYTES;
  gl.bindVertexArray(lumVao);
  gl.bindBuffer(gl.ARRAY_BUFFER, lumBuf);
  {
    const aRect = gl.getAttribLocation(lumProgram, "aRect");
    const aOpacity = gl.getAttribLocation(lumProgram, "aOpacity");
    const aTilt = gl.getAttribLocation(lumProgram, "aTilt");
    gl.enableVertexAttribArray(aRect);
    gl.vertexAttribPointer(aRect, 4, gl.FLOAT, false, lumStride, 0);
    gl.vertexAttribDivisor(aRect, 1);
    gl.enableVertexAttribArray(aOpacity);
    gl.vertexAttribPointer(aOpacity, 1, gl.FLOAT, false, lumStride, 16);
    gl.vertexAttribDivisor(aOpacity, 1);
    gl.enableVertexAttribArray(aTilt);
    gl.vertexAttribPointer(aTilt, 1, gl.FLOAT, false, lumStride, 20);
    gl.vertexAttribDivisor(aTilt, 1);
  }

  const colorStride = COLOR_STRIDE_BYTES;
  gl.bindVertexArray(colorVao);
  gl.bindBuffer(gl.ARRAY_BUFFER, colorBuf);
  {
    const aRect = gl.getAttribLocation(colorProgram, "aRect");
    const aOpacity = gl.getAttribLocation(colorProgram, "aOpacity");
    const aTilt = gl.getAttribLocation(colorProgram, "aTilt");
    const aColor = gl.getAttribLocation(colorProgram, "aColor");
    gl.enableVertexAttribArray(aRect);
    gl.vertexAttribPointer(aRect, 4, gl.FLOAT, false, colorStride, 0);
    gl.vertexAttribDivisor(aRect, 1);
    gl.enableVertexAttribArray(aOpacity);
    gl.vertexAttribPointer(aOpacity, 1, gl.FLOAT, false, colorStride, 16);
    gl.vertexAttribDivisor(aOpacity, 1);
    gl.enableVertexAttribArray(aTilt);
    gl.vertexAttribPointer(aTilt, 1, gl.FLOAT, false, colorStride, 20);
    gl.vertexAttribDivisor(aTilt, 1);
    gl.enableVertexAttribArray(aColor);
    gl.vertexAttribPointer(aColor, 3, gl.FLOAT, false, colorStride, 24);
    gl.vertexAttribDivisor(aColor, 1);
  }
  gl.bindVertexArray(null);
  gl.bindBuffer(gl.ARRAY_BUFFER, null);

  const lumUCanvas = gl.getUniformLocation(lumProgram, "uCanvas");
  const colorUCanvas = gl.getUniformLocation(colorProgram, "uCanvas");

  let lumData = new Float32Array(0);
  let colorData = new Float32Array(0);

  function packLum(stars: Star[]): number {
    const needed = stars.length * LUM_FLOATS_PER_INSTANCE;
    if (lumData.length < needed) lumData = new Float32Array(needed);
    for (let i = 0; i < stars.length; i++) {
      const s = stars[i];
      const size = Math.max(0.001, s.sizePx * s.scale * STAR_QUAD_SCALE);
      const base = i * LUM_FLOATS_PER_INSTANCE;
      lumData[base] = s.x - size * 0.5;
      lumData[base + 1] = s.y - size * 0.5;
      lumData[base + 2] = size;
      lumData[base + 3] = size;
      lumData[base + 4] = s.opacity;
      lumData[base + 5] = s.tiltRad;
    }
    return needed;
  }

  return {
    render(target: RenderTarget, stars: Star[], opts: StarsOpts) {
      if (stars.length === 0) return;
      const needed = packLum(stars);

      bindRenderTarget(gl, target);
      gl.useProgram(lumProgram);
      gl.uniform2f(lumUCanvas, opts.canvasW, opts.canvasH);
      gl.bindVertexArray(lumVao);
      gl.bindBuffer(gl.ARRAY_BUFFER, lumBuf);
      gl.bufferData(gl.ARRAY_BUFFER, lumData.subarray(0, needed), gl.DYNAMIC_DRAW);
      gl.bindBuffer(gl.ARRAY_BUFFER, null);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.ONE, gl.ONE);
      gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, stars.length);
      gl.disable(gl.BLEND);
      gl.bindVertexArray(null);
    },
    renderColors(
      field: RenderTarget,
      fieldColor: RenderTarget,
      stars: Star[],
      palette: VibrantColor[],
      opts: StarsOpts,
    ) {
      if (stars.length === 0) return;
      const paletteLen = Math.max(1, palette.length);
      const lumNeeded = packLum(stars);

      bindRenderTarget(gl, field);
      gl.useProgram(lumProgram);
      gl.uniform2f(lumUCanvas, opts.canvasW, opts.canvasH);
      gl.bindVertexArray(lumVao);
      gl.bindBuffer(gl.ARRAY_BUFFER, lumBuf);
      gl.bufferData(gl.ARRAY_BUFFER, lumData.subarray(0, lumNeeded), gl.DYNAMIC_DRAW);
      gl.bindBuffer(gl.ARRAY_BUFFER, null);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.ONE, gl.ONE);
      gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, stars.length);
      gl.bindVertexArray(null);

      const needed = stars.length * COLOR_FLOATS_PER_INSTANCE;
      if (colorData.length < needed) colorData = new Float32Array(needed);
      const [fallbackR, fallbackG, fallbackB] = unpackRgb(opts.color);
      for (let i = 0; i < stars.length; i++) {
        const s = stars[i];
        const size = Math.max(0.001, s.sizePx * s.scale * STAR_QUAD_SCALE);
        const base = i * COLOR_FLOATS_PER_INSTANCE;
        const pick = palette[Math.min(paletteLen - 1, Math.floor(s.colorSeed * paletteLen))];
        colorData[base] = s.x - size * 0.5;
        colorData[base + 1] = s.y - size * 0.5;
        colorData[base + 2] = size;
        colorData[base + 3] = size;
        colorData[base + 4] = s.opacity;
        colorData[base + 5] = s.tiltRad;
        colorData[base + 6] = pick ? pick.r / 255 : fallbackR;
        colorData[base + 7] = pick ? pick.g / 255 : fallbackG;
        colorData[base + 8] = pick ? pick.b / 255 : fallbackB;
      }

      bindRenderTarget(gl, fieldColor);
      gl.useProgram(colorProgram);
      gl.uniform2f(colorUCanvas, opts.canvasW, opts.canvasH);
      gl.bindVertexArray(colorVao);
      gl.bindBuffer(gl.ARRAY_BUFFER, colorBuf);
      gl.bufferData(gl.ARRAY_BUFFER, colorData.subarray(0, needed), gl.DYNAMIC_DRAW);
      gl.bindBuffer(gl.ARRAY_BUFFER, null);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
      gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, stars.length);
      gl.blendFunc(gl.ONE, gl.ONE);
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
