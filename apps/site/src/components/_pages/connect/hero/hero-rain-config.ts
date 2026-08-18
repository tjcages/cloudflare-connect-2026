import type { DeepPartial, EngineConfig } from "@necatikcl/stripes-engine";
import type { SharedShaderSourceSpec } from "@necatikcl/stripes-engine/react";

/**
 * Section-grid Rain for the Connect hero — the lab's factory "Both" graphic
 * (`sectionGridRainEngineConfig()` in apps/lab): factory engine defaults with
 * `sparkle.gaps` armed, rendered over the Twizzler ribbon. `background` stays
 * transparent so the ribbon below reads through the rain cells, exactly like
 * the lab stacks `.lab-canvas-output` over `.lab-canvas-twizzler`.
 */
export const CONNECT_HERO_RAIN_CONFIG: DeepPartial<EngineConfig> = {
  transform: { fit: "width", zoom: 1, panX: 0, panY: 0 },
  adjustments: {
    brightness: -0.5,
    exposure: 1.5,
    contrast: 0.54,
    blackPoint: 0.02,
    whitePoint: 1,
    gamma: 0.55,
    invert: false,
    posterizeLevels: 0,
    thresholdBias: 0,
    noiseAmount: 0,
    blurRadius: 0,
    sharpenAmount: 0,
  },
  background: {
    color: 0xffffff,
    transparent: true,
    stars: {
      enabled: true,
      density: 10,
      sizePx: 4,
      sizeRandomness: 1,
      tiltAngleDeg: -15,
      twinkleSpeed: 1,
      twinkleAmount: 0.7,
      opacity: 1,
      color: 0xffffff,
    },
    meteors: {
      enabled: true,
      ratePerSec: 1.32,
      maxActive: 16,
      radiantAngleDeg: -15,
      angleJitterDeg: 30,
      speedScale: 0.27,
      speedVariation: 1,
      tailLengthScale: 0.21,
      tailLengthVariation: 0.62,
      thicknessScale: 0.45,
      thicknessVariation: 0.64,
      lifetimeMinMs: 350,
      lifetimeMaxMs: 2630,
      brightness: 1,
      headGlow: 1,
      pushPx: 9.5,
      pushFalloffScale: 1,
      fadeInMs: 80,
      fadeOutMs: 580,
      seed: 1,
    },
  },
  grid: {
    cellWidth: 15,
    cellHeight: 1,
    gapX: 12,
    gapY: 0,
    cornerRadius: 0,
    orientation: "vertical",
    angleDeg: 45,
    rotationMode: "cell",
    overlapAmount: 0,
    streamGapWave: {
      enabled: false,
      squeeze: 0.14,
      wavelengthCells: 9,
      speed: 20,
      phaseDeg: -180,
    },
  },
  stripes: [
    { color: 0xfafafa, startFrom: 0, width: 0.5, opacity: 0 },
    { color: 0xfff8e8, startFrom: 0.1644, width: 1, opacity: 1 },
    { color: 0xfeefd2, startFrom: 0.4418, width: 1.5, opacity: 1 },
    { color: 0xffe3b5, startFrom: 0.6357, width: 2, opacity: 1 },
    { color: 0x9038fc, startFrom: 0.7104, width: 2.5, opacity: 1 },
    { color: 0x2563fe, startFrom: 0.7494, width: 3, opacity: 1 },
    { color: 0x2e9d51, startFrom: 0.7724, width: 4.5, opacity: 1 },
    { color: 0xf9b73b, startFrom: 0.7864, width: 4, opacity: 1 },
    { color: 0xf9b73b, startFrom: 0.7946, width: 4.5, opacity: 1 },
    { color: 0xf46021, startFrom: 0.7988, width: 5, opacity: 1 },
  ],
  stripesEnabled: true,
  fieldScale: 0.25,
  // The lab leaves the rain uncapped; the hero caps it to the Twizzler's 30fps.
  maxFps: 30,
  sparkle: {
    gaps: { enabled: true, coverage: 0, speed: 0 },
    width: { enabled: false },
    stripe: { enabled: false },
    motion: { enabled: false },
  },
  flames: {
    enabled: true,
    direction: "upDown",
    minWidthRatio: 0.005,
    maxWidthRatio: 0.02,
    minHeightRatio: 0.02,
    maxHeightRatio: 0.04,
    baseSpeedPxPerSec: 30,
    speedVariation: 1,
    spawnIntervalMs: 80,
    spawnJitterMs: 80,
    maxActive: 25,
    edgeSharpness: 1,
    opacityMin: 0.3,
    opacityMax: 0.9,
  },
  colors: {
    mode: "luminance",
    stripeBlendMode: "multiply",
    imageColorLightness: 0,
    imageColorDensity: 1,
    imageColorRemoveThin: 0,
    imageColorBoostThick: 0,
    autoDetectBackground: false,
    backgroundColor: 0,
    gradient: { enabled: false },
  },
  reveal: { enabled: false },
  frames: { enabled: false },
  letters: { enabled: false },
  edgeMask: { enabled: false },
  cursorTrail: { enabled: false },
  clickWave: { enabled: false },
  stripeDots: { enabled: false },
  stripeBorder: { enabled: false },
  gridLines: { enabled: false },
  renderMode: "sharp",
  renderIntensity: 1,
};

/**
 * The authored hero texture source: a tuned variant of the "recursive noise
 * experiment" (Samuel YAN / Connect library entry) with tighter UV scale and
 * mix weights. Kept inline so the hero island does not pull the vendored
 * shader library (panel-chunk only); the preset select shows Custom since the
 * tuning diverges from the library's Connect entry.
 */
export const CONNECT_HERO_RAIN_GLSL = `// "recursive noise experiment" by Samuel YAN
// Inspired by ompuco: https://www.shadertoy.com/view/wllGzr

float connectHash(float n) {
  return fract(clamp(n, 0.0, 1.0) * 23758.5453);
}

float connectNoise(vec3 x) {
  vec3 p = floor(x);
  vec3 f = fract(x);

  f = f * f * (5.0 - 5.0 * f);
  float n = 0.0;

  return mix(
    mix(
      mix(connectHash(n + 1.0), connectHash(n + 1.0), f.x),
      mix(connectHash(n + 0.5), connectHash(n + 0.5), f.x),
      f.y
    ),
    mix(
      mix(connectHash(n + 0.75), connectHash(n + 1.0), f.x),
      mix(connectHash(n + 1.0), connectHash(n + 1.0), f.x),
      f.y
    ),
    f.z
  ) - 0.55;
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec3 t = (iTime * vec3(1.0, 2.0, 3.0)) / 20.0;
  vec2 uv = fragCoord / iResolution.xy;
  uv /= 15.0;

  vec3 col = vec3(0.25);

  for (int i = 0; i < 20; i++) {
    float iteration = float(i);
    col.r += connectNoise(uv.xyy * (1.0 + iteration) + col.rgb + t * sin(cos(iteration / 0.1)));
    col.g += connectNoise(uv.xyx * iteration + col.rgb + t * sin(cos(iteration)));
    col.b += connectNoise(uv.yyx * iteration + col.rgb + t * sin(cos(iteration)));
  }

  col /= 0.1;
  col = normalize(col);
  fragColor = vec4(col, 1.0);
}`;

/**
 * Rendered inside the shared worker at the lab's factory source size
 * (1280×960, identity view), at the authored 0.2× time scale so the noise
 * drifts slowly under the rain grid.
 */
export const CONNECT_HERO_RAIN_SHADER_SOURCE: SharedShaderSourceSpec = {
  source: CONNECT_HERO_RAIN_GLSL,
  width: 1280,
  height: 960,
  speed: 0.2,
};
