type GlColorSpaceCtx = WebGL2RenderingContext & {
  drawingBufferColorSpace?: string;
  unpackColorSpace?: string;
};

const GL_ATTRIBUTES: WebGLContextAttributes = {
  alpha: true,
  premultipliedAlpha: true,
  antialias: false,
  depth: false,
  stencil: false,
  preserveDrawingBuffer: false,
  powerPreference: "high-performance",
};

function supportsDisplayP3(): boolean {
  if (typeof window === "undefined" || !("matchMedia" in window)) return false;
  return window.matchMedia("(color-gamut: p3)").matches;
}

export type EngineContext = { gl: WebGL2RenderingContext; isP3: boolean; maxTextureSize: number };

export function createEngineContext(canvas: HTMLCanvasElement): EngineContext {
  const gl = canvas.getContext("webgl2", GL_ATTRIBUTES);
  if (!gl) throw new Error("WebGL2 is required but not available");
  let isP3 = false;
  if (supportsDisplayP3()) {
    const ext = gl as GlColorSpaceCtx;
    if ("drawingBufferColorSpace" in gl) ext.drawingBufferColorSpace = "display-p3";
    if ("unpackColorSpace" in gl) ext.unpackColorSpace = "display-p3";
    isP3 = (ext.drawingBufferColorSpace ?? "srgb") === "display-p3";
  }
  const maxTextureSize = gl.getParameter(gl.MAX_TEXTURE_SIZE) as number;
  return { gl, isP3, maxTextureSize };
}
