/**
 * The lab's Graphic Rain texture source, lifted for the site: a ShaderToy-style
 * `mainImage` fragment rendered into a canvas the stripes engine samples as
 * its luminance field. This is the lab's shader-texture renderer wrapper —
 * same uniforms (`iResolution`, `iTime`, `iMouse`, `iChannel0..3`, view
 * orbit/pan/zoom) and the same fallback channel textures, so every entry in
 * the shared shader library compiles here exactly as it does in the lab.
 * The mouse is pinned to 0 (the overlay is pointer-inert).
 */

/** Matches the lab's factory `shaderSourceWidth` × `shaderSourceHeight`. */
export const RAIN_SOURCE_WIDTH = 1280;
export const RAIN_SOURCE_HEIGHT = 960;

// "Corridor" by @XorDev — https://x.com/XorDev/status/1923882930834751520
// Saved in the lab's shader library as "Wave to Full Screen", the Graphic
// Rain default preset. Inlined so the default path never loads the library.
export const DEFAULT_RAIN_SHADER_SOURCE = /* glsl */ `
void mainImage(out vec4 O, vec2 I)
{
    float t = iTime, i, d, z;
    for(O *= i; i++<3e1;)
    {
        vec3 r = normalize(vec3(I+I,0)-iResolution.xyy),
        p = z*r,
        w = abs(r);
        w /= max(w.x,w.y);
        w.z += t;
        p.z -= t;

        r = ++p;
        z += d = length(
            (p.xy=abs(mod(p.xy-2.,4.)-2.))-1.
            +cos(p.z/vec2(3.1,2))) +
            .1 * length(p-r) *
            exp(dot(cos(ceil(w/=.3)),sin(w/.6).yzx));

        O.rgb += (cos(p)+1.4) / d / z;
    }
    O = tanh(O/4e1);
}
`;

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

export type RainView = {
  /** Degrees; lab shader-view convention (yaw = rotate Y). */
  rotateXDeg: number;
  rotateYDeg: number;
  rotateZDeg: number;
  /** 1 = identity framing, larger = closer. */
  zoom: number;
  /** Normalized screen-space pan, -1..1. */
  panX: number;
  panY: number;
};

export type RainTextureRenderer = {
  canvas: HTMLCanvasElement;
  /** Swap the `mainImage` source. Returns the compile error, or null on success (keeping the previous program on failure). */
  setSource(source: string): string | null;
  resize(width: number, height: number): void;
  render(timeSec: number, view: RainView): void;
  dispose(): void;
};

function compileShader(
  gl: WebGL2RenderingContext,
  type: number,
  source: string
): WebGLShader {
  const shader = gl.createShader(type);
  if (!shader) throw new Error("Could not create rain shader.");
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const info = gl.getShaderInfoLog(shader) || "Rain shader compile error.";
    gl.deleteShader(shader);
    throw new Error(info);
  }
  return shader;
}

function createProgram(
  gl: WebGL2RenderingContext,
  userSource: string
): WebGLProgram {
  const vertex = compileShader(gl, gl.VERTEX_SHADER, VERTEX_SOURCE);
  const fragment = compileShader(
    gl,
    gl.FRAGMENT_SHADER,
    fragmentSource(userSource)
  );
  const program = gl.createProgram();
  if (!program) throw new Error("Could not create rain shader program.");
  gl.attachShader(program, vertex);
  gl.attachShader(program, fragment);
  gl.linkProgram(program);
  gl.deleteShader(vertex);
  gl.deleteShader(fragment);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const info = gl.getProgramInfoLog(program) || "Rain shader link error.";
    gl.deleteProgram(program);
    throw new Error(info);
  }
  return program;
}

// Same fallback channels as the lab: iChannel0/2/3 carry deterministic noise
// (library shaders sample them for grain), iChannel1 is a black keyboard stub.
function makeFallbackChannelPixels(index: number): {
  width: number;
  height: number;
  pixels: Uint8Array;
} {
  if (index === 1)
    return { width: 1, height: 1, pixels: new Uint8Array([0, 0, 0, 255]) };
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

export function createRainTextureRenderer(
  width = RAIN_SOURCE_WIDTH,
  height = RAIN_SOURCE_HEIGHT
): RainTextureRenderer {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const gl = canvas.getContext("webgl2", {
    alpha: false,
    premultipliedAlpha: false,
  });
  if (!gl) throw new Error("WebGL2 is required for the rain texture source.");

  let program: WebGLProgram | null = null;
  let resolutionLoc: WebGLUniformLocation | null = null;
  let timeLoc: WebGLUniformLocation | null = null;
  let mouseLoc: WebGLUniformLocation | null = null;
  let viewOrbitLoc: WebGLUniformLocation | null = null;
  let viewPanLoc: WebGLUniformLocation | null = null;
  let viewZoomLoc: WebGLUniformLocation | null = null;

  const channelTextures = Array.from({ length: 4 }, (_, index) => {
    const fallback = makeFallbackChannelPixels(index);
    const texture = gl.createTexture();
    if (!texture) throw new Error("Could not create rain channel texture.");
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
      fallback.pixels
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
      gl.useProgram(program);
      for (let index = 0; index < channelTextures.length; index += 1) {
        gl.uniform1i(gl.getUniformLocation(program, `iChannel${index}`), index);
      }
      return null;
    } catch (error) {
      return error instanceof Error ? error.message : String(error);
    }
  };

  const firstError = installProgram(DEFAULT_RAIN_SHADER_SOURCE);
  if (firstError) throw new Error(firstError);

  return {
    canvas,
    setSource(source: string) {
      return installProgram(source);
    },
    resize(nextWidth: number, nextHeight: number) {
      const w = Math.max(1, Math.round(nextWidth));
      const h = Math.max(1, Math.round(nextHeight));
      if (canvas.width === w && canvas.height === h) return;
      canvas.width = w;
      canvas.height = h;
    },
    render(timeSec: number, view: RainView) {
      if (!program) return;
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.useProgram(program);
      gl.uniform3f(resolutionLoc, canvas.width, canvas.height, 1);
      gl.uniform1f(timeLoc, timeSec);
      gl.uniform4f(mouseLoc, 0, 0, 0, 0);
      gl.uniform3f(
        viewOrbitLoc,
        (view.rotateYDeg * Math.PI) / 180,
        (view.rotateXDeg * Math.PI) / 180,
        (view.rotateZDeg * Math.PI) / 180
      );
      gl.uniform2f(viewPanLoc, view.panX, view.panY);
      gl.uniform1f(viewZoomLoc, view.zoom);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      gl.flush();
    },
    dispose() {
      if (program) gl.deleteProgram(program);
      for (const texture of channelTextures) gl.deleteTexture(texture);
      program = null;
    },
  };
}
