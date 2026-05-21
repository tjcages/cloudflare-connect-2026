import { supportsDisplayP3 } from "../theme/colorSpace";

type WebGLContextWithColorSpace = WebGLContextAttributes & {
  colorSpace?: "srgb" | "display-p3";
};

/** Match Pixi `GlContextSystem.createContext` defaults plus wide-gamut color space. */
const PLAYGROUND_GL_ATTRIBUTES: WebGLContextWithColorSpace = {
  alpha: true,
  premultipliedAlpha: true,
  antialias: true,
  stencil: true,
  preserveDrawingBuffer: false,
  powerPreference: "default",
  colorSpace: "display-p3",
};

export function readCanvasColorSpace(canvas: HTMLCanvasElement): string {
  return (canvas as HTMLCanvasElement & { colorSpace?: string }).colorSpace ?? "srgb";
}

/**
 * Create a display-p3 WebGL context for Pixi `Application.init({ context })`.
 * Must run before Pixi init; passing the context prevents Pixi from opening a default sRGB context.
 */
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

/** Wide-gamut stripe rendering (P3→sRGB conversion for Pixi filter targets). */
export function playgroundPrefersDisplayP3(_canvas: HTMLCanvasElement, _gl: WebGLRenderingContext | null): boolean {
  return supportsDisplayP3();
}

/** Set drawing buffer to display-p3 after Pixi init (clears the buffer). */
export function applyPlaygroundDrawingBufferColorSpace(gl: WebGLRenderingContext): boolean {
  if (!supportsDisplayP3() || !("drawingBufferColorSpace" in gl)) {
    return false;
  }
  (gl as WebGLRenderingContext & { drawingBufferColorSpace: string }).drawingBufferColorSpace = "display-p3";
  return (gl as WebGLRenderingContext & { drawingBufferColorSpace: string }).drawingBufferColorSpace === "display-p3";
}

/** @deprecated Use {@link createPlaygroundWebGLContext} + Pixi `context` init option. */
export function configurePlaygroundCanvasColorSpace(canvas: HTMLCanvasElement): boolean {
  const gl = createPlaygroundWebGLContext(canvas);
  return playgroundPrefersDisplayP3(canvas, gl);
}
