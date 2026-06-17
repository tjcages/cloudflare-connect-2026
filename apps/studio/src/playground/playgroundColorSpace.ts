import type { Application } from "pixi.js";
import { supportsDisplayP3 } from "../theme/colorSpace";

type WebGLContextWithColorSpace = WebGLContextAttributes & {
  colorSpace?: "srgb" | "display-p3";
};

type GlWithColorSpace = WebGLRenderingContext & {
  drawingBufferColorSpace?: string;
  unpackColorSpace?: string;
};

/** Match Pixi `GlContextSystem.createContext` defaults plus wide-gamut color space. */
const PLAYGROUND_GL_ATTRIBUTES: WebGLContextWithColorSpace = {
  alpha: true,
  premultipliedAlpha: true,
  antialias: false,
  stencil: true,
  preserveDrawingBuffer: false,
  powerPreference: "default",
  colorSpace: "display-p3",
};

export type PlaygroundGlColorSpaceStatus = {
  drawingBufferColorSpace: string;
  unpackColorSpace: string;
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

/** Configure drawing buffer and texture unpack to display-p3. */
export function configurePlaygroundGlColorSpace(gl: WebGLRenderingContext): PlaygroundGlColorSpaceStatus | null {
  if (!supportsDisplayP3()) {
    return null;
  }

  const glExt = gl as GlWithColorSpace;

  if ("drawingBufferColorSpace" in gl) {
    glExt.drawingBufferColorSpace = "display-p3";
  }
  if ("unpackColorSpace" in gl) {
    glExt.unpackColorSpace = "display-p3";
  }

  return {
    drawingBufferColorSpace: glExt.drawingBufferColorSpace ?? "srgb",
    unpackColorSpace: glExt.unpackColorSpace ?? "srgb",
  };
}

type GlCapableRenderer = { gl?: WebGLRenderingContext };

function readPixiWebGLContext(app: Application, canvas: HTMLCanvasElement): WebGLRenderingContext | null {
  const gl = (app.renderer as GlCapableRenderer).gl;
  if (gl) {
    return gl;
  }
  return canvas.getContext("webgl2") ?? canvas.getContext("webgl");
}

/** Re-apply display-p3 GL settings after Pixi init and expose status on the canvas element. */
export function configurePlaygroundCanvasAfterPixiInit(
  canvas: HTMLCanvasElement,
  app: Application,
): PlaygroundGlColorSpaceStatus | null {
  const gl = readPixiWebGLContext(app, canvas);
  if (!gl) {
    return null;
  }

  const status = configurePlaygroundGlColorSpace(gl);
  if (!status) {
    return null;
  }

  canvas.dataset.canvasColorSpace = readCanvasColorSpace(canvas);
  canvas.dataset.drawingBufferColorSpace = status.drawingBufferColorSpace;
  canvas.dataset.unpackColorSpace = status.unpackColorSpace;
  return status;
}

/** @deprecated Use {@link configurePlaygroundGlColorSpace}. */
export function applyPlaygroundDrawingBufferColorSpace(gl: WebGLRenderingContext): boolean {
  const status = configurePlaygroundGlColorSpace(gl);
  return status?.drawingBufferColorSpace === "display-p3";
}

/** @deprecated Use {@link createPlaygroundWebGLContext} + Pixi `context` init option. */
export function configurePlaygroundCanvasColorSpace(canvas: HTMLCanvasElement): boolean {
  const gl = createPlaygroundWebGLContext(canvas);
  return playgroundPrefersDisplayP3(canvas, gl);
}
