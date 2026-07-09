import { LETTER_CHARSET } from "./charset";

export type LetterAtlas = {
  data: Uint8Array;
  width: number;
  height: number;
  gridCols: number;
  gridRows: number;
  glyphPx: number;
};

type BuildOpts = {
  fontPx?: number;
  rasterScale?: number;
};

export function buildLetterAtlas(opts: BuildOpts = {}): LetterAtlas {
  const fontPx = opts.fontPx ?? 6;
  const rasterScale = opts.rasterScale ?? 8;
  const glyphPx = fontPx * rasterScale;

  const len = LETTER_CHARSET.length;
  const A = Math.ceil(Math.sqrt(len));
  const gridCols = A;
  const gridRows = A;
  const width = A * glyphPx;
  const height = A * glyphPx;

  let ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D | null = null;
  if (typeof document !== "undefined" && typeof document.createElement === "function") {
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    ctx = canvas.getContext("2d");
  } else if (typeof OffscreenCanvas !== "undefined") {
    ctx = new OffscreenCanvas(width, height).getContext("2d");
  }

  if (!ctx) {
    return { data: new Uint8Array(width * height), width, height, gridCols, gridRows, glyphPx };
  }

  ctx.clearRect(0, 0, width, height);
  ctx.font = `${fontPx * rasterScale}px monospace`;
  ctx.fillStyle = "#ffffff";
  ctx.textBaseline = "top";
  ctx.textAlign = "left";

  for (let g = 0; g < len; g++) {
    const col = g % A;
    const row = Math.floor(g / A);
    const x = col * glyphPx;
    const y = row * glyphPx;
    ctx.fillText(LETTER_CHARSET[g], x, y);
  }

  const imageData = ctx.getImageData(0, 0, width, height);
  const pixels = imageData.data;
  const data = new Uint8Array(width * height);
  for (let i = 0; i < data.length; i++) {
    data[i] = pixels[i * 4 + 3];
  }

  return { data, width, height, gridCols, gridRows, glyphPx };
}

export function createLetterAtlasTexture(gl: WebGL2RenderingContext, atlas: LetterAtlas): WebGLTexture {
  const tex = gl.createTexture();
  if (!tex) throw new Error("Failed to create letter atlas texture");

  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

  gl.texImage2D(gl.TEXTURE_2D, 0, gl.R8, atlas.width, atlas.height, 0, gl.RED, gl.UNSIGNED_BYTE, atlas.data);

  return tex;
}
