/** ShaderToy-style procedural source for the playground texture pipeline. */

import {
  DEFAULT_PLAYGROUND_SOURCE_TRANSFORM,
  normalizePlaygroundSourceTransform,
  type PlaygroundSourceTransform,
} from "./playgroundSourceTransform";
import { findSavedShaderBySource, savedShaderPresetId, type PlaygroundSavedShader } from "./playgroundSavedShaders";

export const PLAYGROUND_SHADER_NATIVE_WIDTH = 800;
export const PLAYGROUND_SHADER_NATIVE_HEIGHT = 450;

/**
 * Live render cap for the procedural shader. Raymarch cost scales with shaded pixels while the
 * stripe output quantizes to ~7px cells, so rendering above the native box wastes GPU time:
 * cap to the native box (aspect preserved) and let the sprite upscale. Exports still render at
 * full display resolution.
 */
export function resolvePlaygroundShaderRenderSize(
  displayWidth: number,
  displayHeight: number,
): { width: number; height: number } {
  const width = Math.max(1, Math.round(displayWidth));
  const height = Math.max(1, Math.round(displayHeight));
  const scale = Math.min(1, PLAYGROUND_SHADER_NATIVE_WIDTH / width, PLAYGROUND_SHADER_NATIVE_HEIGHT / height);
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

/**
 * Mirrored audio-style waveform centered on the horizontal midline, flat 2D: each pixel costs a
 * handful of cos() calls instead of a 90-step raymarch, so it stays fast on integrated GPUs.
 * The constants block is the tuning surface — edit and the shader live-reloads.
 */
export const DEFAULT_PLAYGROUND_SHADER_SOURCE = `// --- Tweakables ----------------------------------------------------
// AMPLITUDE  waveform envelope height
// FREQUENCY  base horizontal wave frequency
// SPEED      animation speed
// DETAIL     octaves of smaller ripples in the envelope
// RIPPLE     how much each luminance band waves independently
// BASELINE   minimum envelope height at quiet points
// CONTRAST   luminance ramp steepness toward the centerline
// HUEDRIFT   how fast the palette shifts across the envelope
// PHASE      cosine palette RGB phase offsets (color scheme)
const float AMPLITUDE = .55;
const float FREQUENCY = 2.9;
const float SPEED     = 1.;
const float DETAIL    = 5.;
const float RIPPLE    = .12;
const float BASELINE  = .08;
const float CONTRAST  = 2.5;
const float HUEDRIFT  = 3.;
const vec4  PHASE     = vec4(0, 2, 4, 0);
// -------------------------------------------------------------------

void mainImage(out vec4 O, vec2 I)
{
    //Aspect-corrected coords, -1..1 vertically with 0 at the center
    vec2 uv = (I + I - iResolution.xy) / iResolution.y;
    float t = iTime * SPEED;
    //Multi-octave drifting signal
    float y = 0., a = AMPLITUDE, f = FREQUENCY;
    for (float d = 1.; d <= DETAIL; d++)
    {
        y += a * cos(uv.x * f + 2. * t * cos(d)) / d;
        f += f;
    }
    //Mirrored envelope around the centerline: 0 at the edge, max at the center
    float depth = abs(y) + BASELINE - abs(uv.y);
    //Secondary ripples so each luminance band waves on its own
    depth += RIPPLE * cos(uv.x * 5. - t + depth * 6.) * depth;
    //Brightness ramps toward the centerline; cosine palette drifts with depth and time
    O = (cos(depth * HUEDRIFT + t * .2 + PHASE) + 1.3) * max(depth * CONTRAST, 0.);
    //Tanh tonemapping, same family as the raymarched original
    O = tanh(O * O);
}`;

/** Original raymarched ocean default: pretty but heavy (90 raymarch steps per pixel). */
export const RAYMARCH_PLAYGROUND_SHADER_SOURCE = `void mainImage(out vec4 O, vec2 I)
{
    //Raymarch iterator, step distance, depth and reflection
    float i, d, z, r;
    //Clear fragcolor and raymarch 90 steps
    for(O*= i; i++<9e1;
    //Pick color and attenuate
    O += (cos(z*.5+iTime+vec4(0,2,4,3))+1.3)/d/z)
    {
        //Raymarch sample point
        vec3 p = z * normalize(vec3(I+I,0) - iResolution.xyy);
        //Shift camera and get reflection coordinates
        r = max(-++p, 0.).y;
        //Mirror
        p.y += r+r;
        //Music test
        //-4.*texture(iChannel0, vec2(p.x,-10)/2e1+.5,2.).r

        //Sine waves
        for(d=1.; d<3e1; d+=d)
            p.y += cos(p*d+2.*iTime*cos(d)+z).x/d;

        //Step forward (reflections are softer)
        z += d = (.1*r+abs(p.y-1.)/ (1.+r+r+r*r) + max(d=p.z+3.,-d*.1))/8.;
    }
    //Tanh tonemapping
    O = tanh(O/9e2);
}`;

/** Stacked individually-colored wave traces with glow; cheap single 2D pass. */
export const RIBBONS_PLAYGROUND_SHADER_SOURCE = `// --- Tweakables ----------------------------------------------------
// LAYERS     waveform ribbon count (keep WIDTHS entries in sync)
// WIDTHS     per-ribbon solid line thickness, one entry per ribbon
//            (in screen units: .01 is about 5px on a 450px canvas)
// AMPLITUDE  wave height
// SPEED      animation speed
// DETAIL     octaves of smaller ripples per ribbon (lower = faster)
// SPREAD     vertical spacing of the ribbon stack
// PHASE      cosine palette RGB phase offsets (color scheme)
const float LAYERS    = 6.;
const float WIDTHS[6] = float[6](.06, .012, .035, .005, .05, .02);
const float AMPLITUDE = .18;
const float SPEED     = 1.;
const float DETAIL    = 2.;
const float SPREAD    = 1.2;
const vec4  PHASE     = vec4(0, 2, 4, 0);
// -------------------------------------------------------------------

void mainImage(out vec4 O, vec2 I)
{
    //Aspect-corrected coords, -1..1 vertically
    vec2 uv = (I + I - iResolution.xy) / iResolution.y;
    O = vec4(0);
    float t = iTime * SPEED;
    //One-pixel anti-alias edge for the line boundaries
    float aa = 2. / iResolution.y;
    for (float k = 0.; k < LAYERS; k++)
    {
        //Each ribbon: a couple octaves of drifting sine waves
        float y = 0., a = AMPLITUDE, f = 1.7 + .5 * k;
        for (float d = 1.; d <= DETAIL; d++)
        {
            y += a * cos(uv.x * f + 2. * t * cos(d + k) + k * 5.) / d;
            f += f;
        }
        float center = SPREAD * (k / LAYERS - .5) + y;
        //This ribbon's half-thickness (wraps if LAYERS exceeds the WIDTHS list)
        float w = .5 * WIDTHS[int(mod(k, 6.))];
        //Solid flat line: full color inside the thickness, black outside
        float line = 1. - smoothstep(w - aa, w + aa, abs(uv.y - center));
        O += (cos(k * .7 + t * .3 + PHASE) + 1.3) * line;
    }
    //Tanh tonemapping, same family as the raymarched original
    O = tanh(O * O);
}`;

/** Single bright oscilloscope-style trace; the cheapest preset. */
export const SCOPE_PLAYGROUND_SHADER_SOURCE = `// --- Tweakables ----------------------------------------------------
const float AMPLITUDE = .45;  // trace height
const float SPEED     = 1.2;  // animation speed
const float GLOW      = .02;  // trace glow thickness
const vec4  PHASE     = vec4(0, 2, 4, 0); // color scheme
// -------------------------------------------------------------------

void mainImage(out vec4 O, vec2 I)
{
    vec2 uv = (I + I - iResolution.xy) / iResolution.y;
    float t = iTime * SPEED;
    //Three octaves of drifting sines form the trace
    float y = AMPLITUDE * (cos(uv.x * 2.1 + t)
            + .5 * cos(uv.x * 4.3 - t * 1.4 + 1.)
            + .25 * cos(uv.x * 9.7 + t * .7));
    //Glow around the trace plus a faint floor gradient
    O = (cos(uv.x + t * .25 + PHASE) + 1.3)
      * (GLOW / (abs(uv.y - y) + GLOW) + max(y - uv.y, 0.) * .12);
    O = tanh(O * O);
}`;

/**
 * Audio-reactive flames driven by the microphone spectrum in iChannel0. Enable "Audio input (mic)"
 * for it to come alive — without an audio channel the FFT reads zero and the frame stays dark.
 */
export const AUDIO_FLAMES_PLAYGROUND_SHADER_SOURCE = `// Enable "Audio input (mic)" below — the flame height follows the microphone FFT (iChannel0).
vec3 B2_spline(vec3 x) { // returns 3 B-spline functions of degree 2
    vec3 t = 3.0 * x;
    vec3 b0 = step(0.0, t)     * step(0.0, 1.0-t);
    vec3 b1 = step(0.0, t-1.0) * step(0.0, 2.0-t);
    vec3 b2 = step(0.0, t-2.0) * step(0.0, 3.0-t);
    return 0.5 * (
        b0 * pow(t, vec3(2.0)) +
        b1 * (-2.0*pow(t, vec3(2.0)) + 6.0*t - 3.0) +
        b2 * pow(3.0-t,vec3(2.0))
    );
}

void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
    // create pixel coordinates
    vec2 uv = fragCoord.xy / iResolution.xy;

    float fVBars = 100.;

    float x = floor(uv.x * fVBars)/fVBars;
    float fSample = texture( iChannel0, vec2(abs(2.0 * x - 1.0), 0.25)).x;

    float fft = 1.0 * fSample * 0.5;

    float fVFreq = (uv.y * 3.14);

    vec2 centered = vec2(1.0) * uv - vec2(1.0);
    float t = iTime / 100.0;
    float polychrome = 1.0;
    vec3 spline_args = fract(vec3(polychrome*uv.x-t) + vec3(0.0, -1.0/3.0, -2.0/3.0));
    vec3 spline = B2_spline(spline_args);

    float f = abs(centered.y);
    vec3 base_color  = vec3(1.0, 1.0, 1.0) - f*spline;
    vec3 flame_color = pow(base_color, vec3(3.0));

    float tt = 0.3 - uv.y;
    float df = sign(tt);
    df = (df + 1.0)/0.5;
    vec3 col = flame_color * vec3(1.0 - step(fft, abs(0.3-uv.y))) * vec3(fVFreq);
    col -= col * df * 0.180;

    // output final color
    fragColor = vec4(col,1.0);
}`;

export type PlaygroundShaderPreset = {
  id: string;
  label: string;
  source: string;
};

export const PLAYGROUND_SHADER_PRESETS: readonly PlaygroundShaderPreset[] = [
  { id: "waveforms", label: "Waveforms (fast)", source: DEFAULT_PLAYGROUND_SHADER_SOURCE },
  { id: "ribbons", label: "Wave ribbons (fast)", source: RIBBONS_PLAYGROUND_SHADER_SOURCE },
  { id: "scope", label: "Scope trace (fastest)", source: SCOPE_PLAYGROUND_SHADER_SOURCE },
  { id: "audioflames", label: "Audio flames (mic)", source: AUDIO_FLAMES_PLAYGROUND_SHADER_SOURCE },
  { id: "raymarch", label: "Ocean raymarch (slow)", source: RAYMARCH_PLAYGROUND_SHADER_SOURCE },
] as const;

export const PLAYGROUND_SHADER_PRESET_CUSTOM_ID = "custom";

/**
 * Match the current editor source to a built-in preset id, a saved shader id (namespaced via
 * {@link savedShaderPresetId}), or "custom" when it matches neither. Built-in presets win over
 * saved shaders with identical sources.
 */
export function resolvePlaygroundShaderPresetId(
  source: string,
  savedShaders: readonly PlaygroundSavedShader[] = [],
): string {
  const trimmed = source.trim();
  const preset = PLAYGROUND_SHADER_PRESETS.find((entry) => entry.source.trim() === trimmed);
  if (preset) {
    return preset.id;
  }
  const saved = findSavedShaderBySource(savedShaders, source);
  if (saved) {
    return savedShaderPresetId(saved.id);
  }
  return PLAYGROUND_SHADER_PRESET_CUSTOM_ID;
}

const VERTEX_SHADER = `#version 300 es
in vec2 aPosition;
out vec2 vUv;

void main() {
    vUv = aPosition * 0.5 + 0.5;
    gl_Position = vec4(aPosition, 0.0, 1.0);
}
`;

const FRAGMENT_PREFIX = `#version 300 es
precision highp float;

uniform float iTime;
uniform vec3 iResolution;
uniform float iViewZoom;
uniform vec2 iViewPan;
uniform float iViewInShader;
uniform sampler2D iChannel0;
uniform sampler2D iChannel1;
uniform sampler2D iChannel2;
uniform sampler2D iChannel3;

in vec2 vUv;
out vec4 finalColor;

vec2 playgroundViewCoord(vec2 fragCoord) {
    if (iViewInShader < 0.5) {
        return fragCoord;
    }
    vec2 res = iResolution.xy;
    float zoom = max(iViewZoom, 0.001);
    vec2 window = res / zoom;
    vec2 available = res - window;
    vec2 origin = 0.5 * available + iViewPan * available * 0.5;
    return origin + fragCoord * (window / res);
}

`;

const FRAGMENT_SUFFIX = `
void main() {
    vec4 color = vec4(0.0);
    vec2 fragCoord = vUv * iResolution.xy;
    mainImage(color, playgroundViewCoord(fragCoord));
    finalColor = vec4(color.rgb, 1.0);
}
`;

export function wrapShaderToyMainImage(userSource: string): string {
  return `${FRAGMENT_PREFIX}${userSource.trim()}\n${FRAGMENT_SUFFIX}`;
}

function compileShader(gl: WebGL2RenderingContext, type: number, source: string): WebGLShader | null {
  const shader = gl.createShader(type);
  if (!shader) {
    return null;
  }
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(shader) ?? "Shader compile failed.";
    gl.deleteShader(shader);
    throw new Error(log);
  }
  return shader;
}

function createProgram(gl: WebGL2RenderingContext, vertexSource: string, fragmentSource: string): WebGLProgram {
  const vertexShader = compileShader(gl, gl.VERTEX_SHADER, vertexSource);
  const fragmentShader = compileShader(gl, gl.FRAGMENT_SHADER, fragmentSource);
  if (!vertexShader || !fragmentShader) {
    throw new Error("Failed to create shader objects.");
  }
  const program = gl.createProgram();
  if (!program) {
    throw new Error("Failed to create shader program.");
  }
  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.linkProgram(program);
  gl.deleteShader(vertexShader);
  gl.deleteShader(fragmentShader);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const log = gl.getProgramInfoLog(program) ?? "Program link failed.";
    gl.deleteProgram(program);
    throw new Error(log);
  }
  return program;
}

function createBlackTexture(gl: WebGL2RenderingContext): WebGLTexture {
  const texture = gl.createTexture();
  if (!texture) {
    throw new Error("Failed to create channel texture.");
  }
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([0, 0, 0, 255]));
  gl.bindTexture(gl.TEXTURE_2D, null);
  return texture;
}

export type PlaygroundShaderCompileResult = { ok: true } | { ok: false; error: string };

export class PlaygroundShaderRenderer {
  readonly canvas: HTMLCanvasElement;
  private readonly gl: WebGL2RenderingContext;
  private program: WebGLProgram | null = null;
  private positionLocation = -1;
  private timeLocation: WebGLUniformLocation | null = null;
  private resolutionLocation: WebGLUniformLocation | null = null;
  private channelLocations: Array<WebGLUniformLocation | null> = [];
  private viewZoomLocation: WebGLUniformLocation | null = null;
  private viewPanLocation: WebGLUniformLocation | null = null;
  private viewInShaderLocation: WebGLUniformLocation | null = null;
  private viewTransform: PlaygroundSourceTransform = { ...DEFAULT_PLAYGROUND_SOURCE_TRANSFORM };
  private vao: WebGLVertexArrayObject | null = null;
  private positionBuffer: WebGLBuffer | null = null;
  private renderFramebuffer: WebGLFramebuffer | null = null;
  private renderTexture: WebGLTexture | null = null;
  private readonly defaultFramebufferMultisampled: boolean;
  private readonly channelTextures: WebGLTexture[] = [];
  private audioChannelActive = false;
  private width = PLAYGROUND_SHADER_NATIVE_WIDTH;
  private height = PLAYGROUND_SHADER_NATIVE_HEIGHT;
  private lastError: string | null = null;

  constructor() {
    const canvas = document.createElement("canvas");
    canvas.width = this.width;
    canvas.height = this.height;
    const gl = canvas.getContext("webgl2", {
      premultipliedAlpha: false,
      alpha: false,
      antialias: false,
    });
    if (!gl) {
      throw new Error("WebGL2 is unavailable for procedural shader rendering.");
    }
    this.canvas = canvas;
    this.gl = gl;
    this.defaultFramebufferMultisampled = (gl.getParameter(gl.SAMPLES) as number) > 0;
    for (let channel = 0; channel < 4; channel++) {
      this.channelTextures.push(createBlackTexture(gl));
    }
    this.initGeometry();
    this.initRenderTarget();
  }

  private initRenderTarget() {
    const gl = this.gl;
    const framebuffer = gl.createFramebuffer();
    if (!framebuffer) {
      throw new Error("Failed to create shader framebuffer.");
    }
    this.renderFramebuffer = framebuffer;

    const texture = gl.createTexture();
    if (!texture) {
      throw new Error("Failed to create shader render texture.");
    }
    this.renderTexture = texture;

    this.resizeRenderTarget(this.width, this.height);
  }

  private resizeRenderTarget(width: number, height: number) {
    const gl = this.gl;
    if (!this.renderFramebuffer || !this.renderTexture) {
      return;
    }
    gl.bindTexture(gl.TEXTURE_2D, this.renderTexture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);

    gl.bindFramebuffer(gl.FRAMEBUFFER, this.renderFramebuffer);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.renderTexture, 0);
    const status = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.bindTexture(gl.TEXTURE_2D, null);
    if (status !== gl.FRAMEBUFFER_COMPLETE) {
      throw new Error("Shader framebuffer is incomplete.");
    }
  }

  private initGeometry() {
    const gl = this.gl;
    const vao = gl.createVertexArray();
    if (!vao) {
      throw new Error("Failed to create vertex array.");
    }
    this.vao = vao;
    gl.bindVertexArray(vao);
    const buffer = gl.createBuffer();
    if (!buffer) {
      throw new Error("Failed to create vertex buffer.");
    }
    this.positionBuffer = buffer;
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    gl.bindVertexArray(null);
    gl.bindBuffer(gl.ARRAY_BUFFER, null);
  }

  private syncVertexLayout() {
    const gl = this.gl;
    if (!this.vao || !this.positionBuffer || this.positionLocation < 0) {
      return;
    }
    gl.bindVertexArray(this.vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.positionBuffer);
    gl.enableVertexAttribArray(this.positionLocation);
    gl.vertexAttribPointer(this.positionLocation, 2, gl.FLOAT, false, 0, 0);
    gl.bindVertexArray(null);
    gl.bindBuffer(gl.ARRAY_BUFFER, null);
  }

  get compileError(): string | null {
    return this.lastError;
  }

  setSource(userSource: string): PlaygroundShaderCompileResult {
    const gl = this.gl;
    try {
      const program = createProgram(gl, VERTEX_SHADER, wrapShaderToyMainImage(userSource));
      if (this.program) {
        gl.deleteProgram(this.program);
      }
      this.program = program;
      this.positionLocation = gl.getAttribLocation(program, "aPosition");
      this.timeLocation = gl.getUniformLocation(program, "iTime");
      this.resolutionLocation = gl.getUniformLocation(program, "iResolution");
      this.channelLocations = [0, 1, 2, 3].map((index) => gl.getUniformLocation(program, `iChannel${index}`));
      this.viewZoomLocation = gl.getUniformLocation(program, "iViewZoom");
      this.viewPanLocation = gl.getUniformLocation(program, "iViewPan");
      this.viewInShaderLocation = gl.getUniformLocation(program, "iViewInShader");
      this.syncVertexLayout();
      this.lastError = null;
      return { ok: true };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Shader compile failed.";
      this.lastError = message;
      return { ok: false, error: message };
    }
  }

  setViewTransform(transform: PlaygroundSourceTransform) {
    this.viewTransform = normalizePlaygroundSourceTransform(transform);
  }

  resolveSpriteSourceTransform(): PlaygroundSourceTransform {
    if (this.viewTransform.fit === "stretch") {
      return DEFAULT_PLAYGROUND_SOURCE_TRANSFORM;
    }
    return this.viewTransform;
  }

  resolveSampleSourceTransform(): PlaygroundSourceTransform {
    return this.resolveSpriteSourceTransform();
  }

  /** Stretch-fit shaders apply zoom/pan inside mainImage; sampling should not crop again. */
  viewZoomAppliedInShader(): boolean {
    return this.viewTransform.fit === "stretch";
  }

  resize(width: number, height: number) {
    const nextWidth = Math.max(1, Math.round(width));
    const nextHeight = Math.max(1, Math.round(height));
    if (nextWidth === this.width && nextHeight === this.height) {
      return;
    }
    this.width = nextWidth;
    this.height = nextHeight;
    this.canvas.width = nextWidth;
    this.canvas.height = nextHeight;
    this.resizeRenderTarget(nextWidth, nextHeight);
  }

  /**
   * Upload audio data (or clear it) into iChannel0. `data` is grayscale RGBA laid out as
   * `width × height` (see {@link packAudioTextureData}); pass null to restore the black default.
   * Linear filtering keeps the spectrum/waveform smooth when shaders sample between texels.
   */
  setAudioTexture(data: Uint8Array | null, width: number, height: number) {
    const gl = this.gl;
    const texture = this.channelTextures[0];
    if (!texture) {
      return;
    }
    if (data && width > 0 && height > 0) {
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, data);
      gl.bindTexture(gl.TEXTURE_2D, null);
      this.audioChannelActive = true;
      return;
    }
    if (this.audioChannelActive) {
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([0, 0, 0, 255]));
      gl.bindTexture(gl.TEXTURE_2D, null);
      this.audioChannelActive = false;
    }
  }

  /** Read the latest rendered frame from the offscreen render target (Y-flipped for 2D canvas use). */
  readNativeImageData(): ImageData | null {
    const gl = this.gl;
    if (!this.program || !this.renderFramebuffer || this.width <= 0 || this.height <= 0) {
      return null;
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.renderFramebuffer);
    const pixels = new Uint8Array(this.width * this.height * 4);
    gl.readPixels(0, 0, this.width, this.height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    const flipped = new Uint8ClampedArray(pixels.length);
    const rowBytes = this.width * 4;
    for (let y = 0; y < this.height; y++) {
      const srcRow = (this.height - 1 - y) * rowBytes;
      flipped.set(pixels.subarray(srcRow, srcRow + rowBytes), y * rowBytes);
    }
    for (let i = 3; i < flipped.length; i += 4) {
      flipped[i] = 255;
    }
    return new ImageData(flipped, this.width, this.height);
  }

  render(timeSeconds: number) {
    const gl = this.gl;
    const program = this.program;
    if (!program || !this.vao || !this.renderFramebuffer) {
      return;
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.renderFramebuffer);
    gl.viewport(0, 0, this.width, this.height);
    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.useProgram(program);
    gl.bindVertexArray(this.vao);

    if (this.timeLocation) {
      gl.uniform1f(this.timeLocation, timeSeconds);
    }
    if (this.resolutionLocation) {
      gl.uniform3f(this.resolutionLocation, this.width, this.height, 1);
    }
    const view = this.viewTransform;
    const viewInShader = view.fit === "stretch";
    if (this.viewZoomLocation) {
      gl.uniform1f(this.viewZoomLocation, viewInShader ? view.zoom : 1);
    }
    if (this.viewPanLocation) {
      gl.uniform2f(this.viewPanLocation, viewInShader ? view.panX : 0, viewInShader ? view.panY : 0);
    }
    if (this.viewInShaderLocation) {
      gl.uniform1f(this.viewInShaderLocation, viewInShader ? 1 : 0);
    }
    for (let channel = 0; channel < 4; channel++) {
      const location = this.channelLocations[channel];
      const texture = this.channelTextures[channel];
      if (!location || !texture) {
        continue;
      }
      gl.activeTexture(gl.TEXTURE0 + channel);
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.uniform1i(location, channel);
    }

    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

    // Present offscreen output to the canvas so Pixi/2D sampling still works.
    // Some browsers expose a multisampled default framebuffer where blit-from-texture is invalid.
    if (this.defaultFramebufferMultisampled) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.viewport(0, 0, this.width, this.height);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    } else {
      gl.bindFramebuffer(gl.READ_FRAMEBUFFER, this.renderFramebuffer);
      gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, null);
      gl.blitFramebuffer(0, 0, this.width, this.height, 0, 0, this.width, this.height, gl.COLOR_BUFFER_BIT, gl.NEAREST);
      gl.bindFramebuffer(gl.READ_FRAMEBUFFER, null);
      gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, null);
    }

    gl.bindVertexArray(null);
    gl.bindBuffer(gl.ARRAY_BUFFER, null);
  }

  destroy() {
    const gl = this.gl;
    if (this.program) {
      gl.deleteProgram(this.program);
      this.program = null;
    }
    if (this.positionBuffer) {
      gl.deleteBuffer(this.positionBuffer);
      this.positionBuffer = null;
    }
    if (this.vao) {
      gl.deleteVertexArray(this.vao);
      this.vao = null;
    }
    if (this.renderFramebuffer) {
      gl.deleteFramebuffer(this.renderFramebuffer);
      this.renderFramebuffer = null;
    }
    if (this.renderTexture) {
      gl.deleteTexture(this.renderTexture);
      this.renderTexture = null;
    }
    for (const texture of this.channelTextures) {
      gl.deleteTexture(texture);
    }
  }
}
