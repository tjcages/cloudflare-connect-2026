import { DEFAULT_SHADER_TEXTURE_SOURCE } from "./defaultShaderTextureSource";
import { shaderViewToUniforms, type ShaderViewState } from "./shaderView";

export { DEFAULT_SHADER_TEXTURE_SOURCE } from "./defaultShaderTextureSource";
export {
  SHADER_VIEW_DEFAULTS,
  normalizeShaderViewState,
  shaderViewToUniforms,
  type ShaderViewState,
  type ShaderViewUniforms,
} from "./shaderView";

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
uniform vec3 iViewOrbit;
uniform vec2 iViewPan;
uniform float iViewZoom;
uniform sampler2D iChannel0;
uniform sampler2D iChannel1;
uniform sampler2D iChannel2;
uniform sampler2D iChannel3;
const float pi = 3.141592653589793;
const float tau = 6.283185307179586;
const float eps = 0.001;

${userSource}

vec2 applyViewTransform(vec2 fragCoord) {
  vec2 center = 0.5 * iResolution.xy;
  vec2 uv = (fragCoord - center) / max(iResolution.y, 1.0);
  float cy = cos(iViewOrbit.y);
  float sy = sin(iViewOrbit.y);
  float cx = cos(iViewOrbit.x);
  float sx = sin(iViewOrbit.x);
  float cz = cos(iViewOrbit.z);
  float sz = sin(iViewOrbit.z);
  // Yaw around Y, then pitch around X, then roll around Z — in 2D UV space.
  uv = mat2(cx, -sx, sx, cx) * uv;
  uv = mat2(cy, -sy, sy, cy) * uv;
  uv = mat2(cz, -sz, sz, cz) * uv;
  uv = uv / max(iViewZoom, 0.01) + iViewPan;
  return uv * iResolution.y + center;
}

void main() {
  vec4 color = vec4(0.0, 0.0, 0.0, 1.0);
  mainImage(color, applyViewTransform(gl_FragCoord.xy));
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

export type ShaderUniformValue =
  | number
  | readonly [number, number]
  | readonly [number, number, number]
  | readonly [number, number, number, number];

export type ShaderTextureRenderer = {
  canvas: HTMLCanvasElement;
  width: number;
  height: number;
  setSource(source: string): string | null;
  /** Extra uniforms (floats / vec2–4) applied every render. Missing locs are ignored. */
  setUniforms(values: Record<string, ShaderUniformValue>): void;
  resize(width: number, height: number): void;
  render(
    timeSec: number,
    mouse?: { x: number; y: number; down?: boolean },
    view?: Partial<ShaderViewState> | null,
  ): void;
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
  let viewOrbitLoc: WebGLUniformLocation | null = null;
  let viewPanLoc: WebGLUniformLocation | null = null;
  let viewZoomLoc: WebGLUniformLocation | null = null;
  let extraUniforms: Record<string, ShaderUniformValue> = {};
  const extraUniformLocs = new Map<string, WebGLUniformLocation | null>();

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
      viewOrbitLoc = gl.getUniformLocation(program, "iViewOrbit");
      viewPanLoc = gl.getUniformLocation(program, "iViewPan");
      viewZoomLoc = gl.getUniformLocation(program, "iViewZoom");
      extraUniformLocs.clear();
      for (const key of Object.keys(extraUniforms)) {
        extraUniformLocs.set(key, gl.getUniformLocation(program, key));
      }
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
    setUniforms(values: Record<string, ShaderUniformValue>) {
      extraUniforms = { ...values };
      if (!program) return;
      for (const key of Object.keys(extraUniforms)) {
        if (!extraUniformLocs.has(key)) {
          extraUniformLocs.set(key, gl.getUniformLocation(program, key));
        }
      }
    },
    resize(nextWidth: number, nextHeight: number) {
      const w = Math.max(1, Math.round(nextWidth));
      const h = Math.max(1, Math.round(nextHeight));
      if (canvas.width === w && canvas.height === h) return;
      canvas.width = w;
      canvas.height = h;
      gl.viewport(0, 0, w, h);
    },
    render(timeSec: number, mouse = { x: 0, y: 0, down: false }, view = null) {
      if (!program) return;
      const uniforms = shaderViewToUniforms(view);
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.useProgram(program);
      gl.uniform3f(resolutionLoc, canvas.width, canvas.height, 1);
      gl.uniform1f(timeLoc, timeSec);
      gl.uniform4f(mouseLoc, mouse.x, mouse.y, mouse.down ? mouse.x : 0, mouse.down ? mouse.y : 0);
      gl.uniform3f(viewOrbitLoc, uniforms.orbitRad[0], uniforms.orbitRad[1], uniforms.orbitRad[2]);
      gl.uniform2f(viewPanLoc, uniforms.pan[0], uniforms.pan[1]);
      gl.uniform1f(viewZoomLoc, uniforms.zoom);
      for (const [key, value] of Object.entries(extraUniforms)) {
        const loc = extraUniformLocs.get(key) ?? gl.getUniformLocation(program, key);
        if (!extraUniformLocs.has(key)) extraUniformLocs.set(key, loc);
        if (!loc) continue;
        if (typeof value === "number") {
          gl.uniform1f(loc, value);
        } else if (value.length === 2) {
          gl.uniform2f(loc, value[0], value[1]);
        } else if (value.length === 3) {
          gl.uniform3f(loc, value[0], value[1], value[2]);
        } else if (value.length === 4) {
          gl.uniform4f(loc, value[0], value[1], value[2], value[3]);
        }
      }
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
