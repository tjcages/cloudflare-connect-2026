import { advanceCometLogoAnimation, createCometLogoAnimationState, type CometLogoAnimationState } from "./animation";
import { COMET_LOGO_RENDER_POINT_COUNT, COMET_LOGO_TRAIL_SEGMENT_COUNT } from "./points";
import { COMET_LOGO_FRAGMENT_SHADER, COMET_LOGO_VERTEX_SHADER } from "./shaders";

export const COMET_LOGO_RENDER_SCALE = 0.5;

export type CometLogoTextureRenderer = {
  canvas: HTMLCanvasElement;
  readonly width: number;
  readonly height: number;
  resize(width: number, height: number): void;
  render(timeSec: number): void;
  getAnimationState(): Readonly<CometLogoAnimationState>;
  dispose(): void;
};

function compileShader(gl: WebGL2RenderingContext, type: number, source: string): WebGLShader {
  const shader = gl.createShader(type);
  if (!shader) throw new Error("Could not create comet logo shader.");
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const info = gl.getShaderInfoLog(shader) || "Unknown comet logo shader compile error.";
    gl.deleteShader(shader);
    throw new Error(info);
  }
  return shader;
}

function createProgram(gl: WebGL2RenderingContext): WebGLProgram {
  const vertex = compileShader(gl, gl.VERTEX_SHADER, COMET_LOGO_VERTEX_SHADER);
  const fragment = compileShader(gl, gl.FRAGMENT_SHADER, COMET_LOGO_FRAGMENT_SHADER);
  const program = gl.createProgram();
  if (!program) throw new Error("Could not create comet logo shader program.");
  gl.attachShader(program, vertex);
  gl.attachShader(program, fragment);
  gl.linkProgram(program);
  gl.deleteShader(vertex);
  gl.deleteShader(fragment);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const info = gl.getProgramInfoLog(program) || "Unknown comet logo shader link error.";
    gl.deleteProgram(program);
    throw new Error(info);
  }
  return program;
}

export function createCometLogoTextureRenderer(width: number, height: number): CometLogoTextureRenderer {
  const canvas = document.createElement("canvas");
  const gl = canvas.getContext("webgl2", {
    alpha: false,
    antialias: false,
    depth: false,
    powerPreference: "high-performance",
    premultipliedAlpha: false,
    preserveDrawingBuffer: false,
    stencil: false,
  });
  if (!gl) throw new Error("WebGL2 is required for the comet logo shader.");

  const program = createProgram(gl);
  const vao = gl.createVertexArray();
  if (!vao) {
    gl.deleteProgram(program);
    throw new Error("Could not create comet logo vertex array.");
  }

  const resolutionLoc = gl.getUniformLocation(program, "uResolution");
  const timeLoc = gl.getUniformLocation(program, "uTime");
  let animation = createCometLogoAnimationState();
  let disposed = false;

  const resize = (nextWidth: number, nextHeight: number) => {
    const w = Math.max(1, Math.round(nextWidth * COMET_LOGO_RENDER_SCALE));
    const h = Math.max(1, Math.round(nextHeight * COMET_LOGO_RENDER_SCALE));
    if (canvas.width !== w) canvas.width = w;
    if (canvas.height !== h) canvas.height = h;
  };
  resize(width, height);

  return {
    canvas,
    get width() {
      return canvas.width;
    },
    get height() {
      return canvas.height;
    },
    resize,
    render(timeSec) {
      if (disposed) return;
      animation = advanceCometLogoAnimation(animation, timeSec);
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.clearColor(0, 0, 0, 1);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.useProgram(program);
      gl.bindVertexArray(vao);
      gl.uniform2f(resolutionLoc, canvas.width, canvas.height);
      gl.uniform1f(timeLoc, animation.timeSec);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.ONE, gl.ONE);
      gl.drawArraysInstanced(gl.TRIANGLES, 0, COMET_LOGO_TRAIL_SEGMENT_COUNT * 6, COMET_LOGO_RENDER_POINT_COUNT);
      gl.disable(gl.BLEND);
      gl.bindVertexArray(null);
    },
    getAnimationState() {
      return animation;
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      gl.deleteVertexArray(vao);
      gl.deleteProgram(program);
    },
  };
}
