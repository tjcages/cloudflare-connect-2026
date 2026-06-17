import { supportsDisplayP3 } from "./colorSpace";

type WebGLContextWithColorSpace = WebGLContextAttributes & {
  colorSpace?: "srgb" | "display-p3";
};

const PLAYGROUND_GL_ATTRIBUTES: WebGLContextWithColorSpace = {
  alpha: true,
  premultipliedAlpha: true,
  antialias: true,
  stencil: true,
  preserveDrawingBuffer: false,
  powerPreference: "default",
  colorSpace: "display-p3",
};

export function createPlaygroundWebGLContext(
  canvas: HTMLCanvasElement,
): WebGL2RenderingContext | WebGLRenderingContext | null {
  if (!supportsDisplayP3()) {
    return null;
  }

  const gl2 = canvas.getContext("webgl2", PLAYGROUND_GL_ATTRIBUTES);
  if (gl2) {
    return gl2;
  }

  return canvas.getContext("webgl", PLAYGROUND_GL_ATTRIBUTES);
}

export function playgroundPrefersDisplayP3(_canvas: HTMLCanvasElement, _gl: WebGLRenderingContext | null): boolean {
  return supportsDisplayP3();
}

export function applyPlaygroundDrawingBufferColorSpace(gl: WebGLRenderingContext): boolean {
  if (!supportsDisplayP3() || !("drawingBufferColorSpace" in gl)) {
    return false;
  }
  (gl as WebGLRenderingContext & { drawingBufferColorSpace: string }).drawingBufferColorSpace = "display-p3";
  return (gl as WebGLRenderingContext & { drawingBufferColorSpace: string }).drawingBufferColorSpace === "display-p3";
}
