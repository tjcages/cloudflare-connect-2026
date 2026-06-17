/**
 * Minimal WebGL context + display-p3 color-space init for the stripes-shader package.
 *
 * Equivalent to the studio's playgroundColorSpace.ts helpers.
 * Does NOT import studio code.
 */

import { supportsDisplayP3 } from "./colorSpace";

type WebGLContextWithColorSpace = WebGLContextAttributes & {
  colorSpace?: "srgb" | "display-p3";
};

type GlWithColorSpace = WebGLRenderingContext & {
  drawingBufferColorSpace?: string;
  unpackColorSpace?: string;
};

/** Match Pixi GlContextSystem.createContext defaults plus wide-gamut color space. */
const STRIPES_GL_ATTRIBUTES: WebGLContextWithColorSpace = {
  alpha: true,
  premultipliedAlpha: true,
  antialias: false,
  stencil: true,
  preserveDrawingBuffer: false,
  powerPreference: "default",
  colorSpace: "display-p3",
};

/**
 * Create a display-p3 WebGL context for Pixi `Application.init({ context })`.
 * Must run before Pixi init; passing the context prevents Pixi from opening a default sRGB context.
 * Returns null when display-p3 is not supported (Pixi will create its own context).
 */
export function createStripesWebGLContext(
  canvas: HTMLCanvasElement,
): WebGL2RenderingContext | WebGLRenderingContext | null {
  if (!supportsDisplayP3()) {
    return null;
  }
  const gl2 = canvas.getContext("webgl2", STRIPES_GL_ATTRIBUTES);
  if (gl2) {
    return gl2;
  }
  return canvas.getContext("webgl", STRIPES_GL_ATTRIBUTES);
}

/**
 * Returns true when the canvas will render in display-p3 wide gamut.
 * Call after `createStripesWebGLContext` — the answer is solely based on browser support.
 */
export function stripesPreferDisplayP3(): boolean {
  return supportsDisplayP3();
}

/**
 * Configure drawing-buffer and texture-unpack color spaces to display-p3.
 * Must be called after Pixi init to re-apply settings Pixi may have reset.
 */
export function applyStripesDrawingBufferColorSpace(gl: WebGLRenderingContext): boolean {
  if (!supportsDisplayP3()) {
    return false;
  }
  const glExt = gl as GlWithColorSpace;
  if ("drawingBufferColorSpace" in gl) {
    glExt.drawingBufferColorSpace = "display-p3";
  }
  if ("unpackColorSpace" in gl) {
    glExt.unpackColorSpace = "display-p3";
  }
  return glExt.drawingBufferColorSpace === "display-p3";
}
