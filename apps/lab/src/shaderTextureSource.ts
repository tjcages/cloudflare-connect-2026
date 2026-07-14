import { DEFAULT_SHADER_TEXTURE_SOURCE } from "./defaultShaderTextureSource";

export { DEFAULT_SHADER_TEXTURE_SOURCE } from "./defaultShaderTextureSource";

const VERTEX_SOURCE = `#version 300 es
precision highp float;
const vec2 POS[3] = vec2[3](
  vec2(-1.0, -1.0),
  vec2(3.0, -1.0),
  vec2(-1.0, 3.0)
);
void main() {
  gl_Position = vec4(POS[gl_VertexID], 0.0, 1.0);
}`;

function fragmentSource(userSource: string): string {
  return `#version 300 es
precision highp float;
out vec4 outColor;
uniform vec3 iResolution;
uniform float iTime;
uniform vec4 iMouse;
uniform sampler2D iChannel0;
uniform sampler2D iChannel1;
uniform sampler2D iChannel2;
uniform sampler2D iChannel3;
const float pi = 3.141592653589793;
const float tau = 6.283185307179586;
const float eps = 0.001;

${userSource}

void main() {
  vec4 color = vec4(0.0, 0.0, 0.0, 1.0);
  mainImage(color, gl_FragCoord.xy);
  outColor = vec4(color.rgb, 1.0);
}`;
}

function compileShader(gl: WebGL2RenderingContext, type: number, source: string): WebGLShader {
  const shader = gl.createShader(type);
  if (!shader) throw new Error("Could not create shader.");
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const info = gl.getShaderInfoLog(shader) || "Unknown shader compile error.";
    gl.deleteShader(shader);
    throw new Error(info);
  }
  return shader;
}

function createProgram(gl: WebGL2RenderingContext, userSource: string): WebGLProgram {
  const vertex = compileShader(gl, gl.VERTEX_SHADER, VERTEX_SOURCE);
  const fragment = compileShader(gl, gl.FRAGMENT_SHADER, fragmentSource(userSource));
  const program = gl.createProgram();
  if (!program) throw new Error("Could not create shader program.");
  gl.attachShader(program, vertex);
  gl.attachShader(program, fragment);
  gl.linkProgram(program);
  gl.deleteShader(vertex);
  gl.deleteShader(fragment);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const info = gl.getProgramInfoLog(program) || "Unknown shader link error.";
    gl.deleteProgram(program);
    throw new Error(info);
  }
  return program;
}

export type ShaderTextureRenderer = {
  canvas: HTMLCanvasElement;
  width: number;
  height: number;
  setSource(source: string): string | null;
  resize(width: number, height: number): void;
  render(timeSec: number, mouse?: { x: number; y: number; down?: boolean }): void;
  dispose(): void;
};

function makeFallbackChannelPixels(index: number): { width: number; height: number; pixels: Uint8Array } {
  if (index === 1) return { width: 1, height: 1, pixels: new Uint8Array([0, 0, 0, 255]) };
  const width = index === 0 ? 256 : 64;
  const height = index === 0 ? 256 : 64;
  const pixels = new Uint8Array(width * height * 4);
  let seed = 0x9e3779b9 ^ (index * 0x85ebca6b);
  for (let i = 0; i < width * height; i += 1) {
    seed ^= seed << 13;
    seed ^= seed >>> 17;
    seed ^= seed << 5;
    const a = seed & 255;
    seed = (seed + 0x6d2b79f5) | 0;
    const b = (seed >>> 8) & 255;
    pixels[i * 4] = a;
    pixels[i * 4 + 1] = b;
    pixels[i * 4 + 2] = (a ^ b) & 255;
    pixels[i * 4 + 3] = 255;
  }
  return { width, height, pixels };
}

export function createShaderTextureRenderer(width = 1000, height = 1000): ShaderTextureRenderer {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const gl = canvas.getContext("webgl2", { alpha: false, premultipliedAlpha: false });
  if (!gl) throw new Error("WebGL2 is required for shader texture sources.");

  let program: WebGLProgram | null = null;
  let resolutionLoc: WebGLUniformLocation | null = null;
  let timeLoc: WebGLUniformLocation | null = null;
  let mouseLoc: WebGLUniformLocation | null = null;

  const channelTextures = Array.from({ length: 4 }, (_, index) => {
    const fallback = makeFallbackChannelPixels(index);
    const texture = gl.createTexture();
    if (!texture) throw new Error("Could not create fallback shader channel texture.");
    gl.activeTexture(gl.TEXTURE0 + index);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGBA,
      fallback.width,
      fallback.height,
      0,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      fallback.pixels,
    );
    return texture;
  });

  const installProgram = (source: string): string | null => {
    try {
      const next = createProgram(gl, source);
      if (program) gl.deleteProgram(program);
      program = next;
      resolutionLoc = gl.getUniformLocation(program, "iResolution");
      timeLoc = gl.getUniformLocation(program, "iTime");
      mouseLoc = gl.getUniformLocation(program, "iMouse");
      gl.useProgram(program);
      for (let index = 0; index < channelTextures.length; index += 1) {
        gl.uniform1i(gl.getUniformLocation(program, `iChannel${index}`), index);
      }
      return null;
    } catch (error) {
      return error instanceof Error ? error.message : String(error);
    }
  };

  const firstError = installProgram(DEFAULT_SHADER_TEXTURE_SOURCE);
  if (firstError) throw new Error(firstError);

  return {
    canvas,
    get width() {
      return canvas.width;
    },
    get height() {
      return canvas.height;
    },
    setSource(source: string) {
      return installProgram(source);
    },
    resize(nextWidth: number, nextHeight: number) {
      const w = Math.max(1, Math.round(nextWidth));
      const h = Math.max(1, Math.round(nextHeight));
      if (canvas.width === w && canvas.height === h) return;
      canvas.width = w;
      canvas.height = h;
      gl.viewport(0, 0, w, h);
    },
    render(timeSec: number, mouse = { x: 0, y: 0, down: false }) {
      if (!program) return;
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.useProgram(program);
      gl.uniform3f(resolutionLoc, canvas.width, canvas.height, 1);
      gl.uniform1f(timeLoc, timeSec);
      gl.uniform4f(mouseLoc, mouse.x, mouse.y, mouse.down ? mouse.x : 0, mouse.down ? mouse.y : 0);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      gl.flush();
    },
    dispose() {
      if (program) gl.deleteProgram(program);
      channelTextures.forEach((texture) => gl.deleteTexture(texture));
      program = null;
    },
  };
}
