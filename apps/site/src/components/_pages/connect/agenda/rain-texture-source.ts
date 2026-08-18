/**
 * The lab's Graphic Rain texture source, lifted for the site: the saved
 * "Wave to Full Screen" shader ("Corridor" by @XorDev) rendered into a canvas
 * the stripes engine samples as its luminance field. This is a trimmed
 * version of the lab's shader-texture renderer — the rain source only reads
 * `iResolution` / `iTime`, so the channel textures, mouse and orbit uniforms
 * are dropped while the zoom / pan framing survives as plain uniforms.
 */

/** Matches the lab's factory `shaderSourceWidth` × `shaderSourceHeight`. */
export const RAIN_SOURCE_WIDTH = 1280;
export const RAIN_SOURCE_HEIGHT = 960;

// "Corridor" by @XorDev — https://x.com/XorDev/status/1923882930834751520
// Saved in the lab's shader library as "Wave to Full Screen", the Graphic
// Rain default preset.
const RAIN_SHADER_SOURCE = /* glsl */ `
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

const FRAGMENT_SOURCE = `#version 300 es
precision highp float;
out vec4 outColor;
uniform vec3 iResolution;
uniform float iTime;
uniform vec2 uPan;
uniform float uZoom;
const float pi = 3.141592653589793;
const float tau = 6.283185307179586;

${RAIN_SHADER_SOURCE}

vec2 applyViewTransform(vec2 fragCoord) {
  vec2 center = 0.5 * iResolution.xy;
  vec2 uv = (fragCoord - center) / max(iResolution.y, 1.0);
  uv = uv / max(uZoom, 0.01) + uPan;
  return uv * iResolution.y + center;
}

void main() {
  vec4 color = vec4(0.0, 0.0, 0.0, 1.0);
  mainImage(color, applyViewTransform(gl_FragCoord.xy));
  outColor = vec4(color.rgb, 1.0);
}`;

export type RainView = {
  /** 1 = identity framing, larger = closer. */
  zoom: number;
  /** Normalized screen-space pan, -1..1. */
  panX: number;
  panY: number;
};

export type RainTextureRenderer = {
  canvas: HTMLCanvasElement;
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

  const vertex = compileShader(gl, gl.VERTEX_SHADER, VERTEX_SOURCE);
  const fragment = compileShader(gl, gl.FRAGMENT_SHADER, FRAGMENT_SOURCE);
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

  gl.useProgram(program);
  const resolutionLoc = gl.getUniformLocation(program, "iResolution");
  const timeLoc = gl.getUniformLocation(program, "iTime");
  const panLoc = gl.getUniformLocation(program, "uPan");
  const zoomLoc = gl.getUniformLocation(program, "uZoom");

  return {
    canvas,
    render(timeSec: number, view: RainView) {
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.useProgram(program);
      gl.uniform3f(resolutionLoc, canvas.width, canvas.height, 1);
      gl.uniform1f(timeLoc, timeSec);
      gl.uniform2f(panLoc, view.panX, view.panY);
      gl.uniform1f(zoomLoc, view.zoom);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      gl.flush();
    },
    dispose() {
      gl.deleteProgram(program);
    },
  };
}
