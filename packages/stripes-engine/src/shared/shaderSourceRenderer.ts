/**
 * Worker-side Shadertoy-style texture source for the shared context.
 *
 * The GLSL wrapper (uniforms, fallback channels, view transform) mirrors the
 * lab's `shaderTextureSource.ts` exactly so a preset authored there renders
 * identically here — only the canvas is an `OffscreenCanvas`, because there is
 * no `document` in a worker.
 */

export type SharedShaderSourceView = {
  orbitRad?: readonly [number, number, number];
  pan?: readonly [number, number];
  zoom?: number;
};

export type SharedShaderSourceSpec = {
  /** Shadertoy-style GLSL defining `mainImage(out vec4, in vec2)`. */
  source: string;
  width: number;
  height: number;
  /** iTime advance multiplier; 1 = real time. */
  speed?: number;
  view?: SharedShaderSourceView;
};

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

export type SharedShaderSourceRenderer = {
  canvas: OffscreenCanvas;
  render(timeSec: number): void;
  dispose(): void;
};

export function createSharedShaderSourceRenderer(spec: SharedShaderSourceSpec): SharedShaderSourceRenderer {
  const width = Math.max(1, Math.round(spec.width));
  const height = Math.max(1, Math.round(spec.height));
  const canvas = new OffscreenCanvas(width, height);
  const gl = canvas.getContext("webgl2", { alpha: false, premultipliedAlpha: false });
  if (!gl) throw new Error("WebGL2 is required for shader texture sources.");

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

  const program = createProgram(gl, spec.source);
  gl.useProgram(program);
  for (let index = 0; index < channelTextures.length; index += 1) {
    gl.uniform1i(gl.getUniformLocation(program, `iChannel${index}`), index);
  }
  const resolutionLoc = gl.getUniformLocation(program, "iResolution");
  const timeLoc = gl.getUniformLocation(program, "iTime");
  const mouseLoc = gl.getUniformLocation(program, "iMouse");
  const viewOrbitLoc = gl.getUniformLocation(program, "iViewOrbit");
  const viewPanLoc = gl.getUniformLocation(program, "iViewPan");
  const viewZoomLoc = gl.getUniformLocation(program, "iViewZoom");
  const orbit = spec.view?.orbitRad ?? [0, 0, 0];
  const pan = spec.view?.pan ?? [0, 0];
  const zoom = spec.view?.zoom ?? 1;

  return {
    canvas,
    render(timeSec: number) {
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.useProgram(program);
      gl.uniform3f(resolutionLoc, canvas.width, canvas.height, 1);
      gl.uniform1f(timeLoc, timeSec);
      gl.uniform4f(mouseLoc, 0, 0, 0, 0);
      gl.uniform3f(viewOrbitLoc, orbit[0], orbit[1], orbit[2]);
      gl.uniform2f(viewPanLoc, pan[0], pan[1]);
      gl.uniform1f(viewZoomLoc, zoom);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      gl.flush();
    },
    dispose() {
      gl.deleteProgram(program);
      channelTextures.forEach((texture) => gl.deleteTexture(texture));
    },
  };
}
