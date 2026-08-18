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
    cellWidth: 17,
    cellHeight: 1,
    gapX: 12,
    gapY: 0,
    cornerRadius: 0,
    orientation: "vertical",
    angleDeg: 45,
    rotationMode: "cell",
    overlapAmount: 1.2,
    streamGapWave: {
      enabled: false,
      squeeze: 0.14,
      wavelengthCells: 9,
      speed: -4,
      phaseDeg: -180,
    },
  },
  stripes: [
    { color: 0xfafafa, startFrom: 0, width: 0.5, opacity: 1 },
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
    gaps: { enabled: true, coverage: 0, speed: 1 },
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
 * "Corridor" by @XorDev, comment-stripped — the lab's Graphic-rain texture
 * source ("Wave to Full Screen", shaderLibrary preset a1f684cd). Kept inline so
 * the hero island does not pull the vendored shader library (panel-chunk only);
 * the library's matcher is comment-insensitive, so the preset select still
 * recognizes it. https://x.com/XorDev/status/1923882930834751520
 */
export const CONNECT_HERO_RAIN_GLSL = `void mainImage(out vec4 O, vec2 I)
{
    float t = iTime,
    i,
    d,
    z;
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
}`;

/**
 * Rendered inside the shared worker at the lab's factory source size
 * (1280×960, identity view). The lab's transport starts paused (iTime frozen);
 * the hero plays it at 1× so the corridor scroll animates the rain field.
 */
export const CONNECT_HERO_RAIN_SHADER_SOURCE: SharedShaderSourceSpec = {
  source: CONNECT_HERO_RAIN_GLSL,
  width: 1280,
  height: 960,
  speed: 1,
};
