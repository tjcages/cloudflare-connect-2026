import type { SharedShaderSourceSpec } from "@necatikcl/stripes-engine/react";
import type { StripesTextureConfig } from "@/components/stripes-texture/config";

/**
 * Lab dump for the field behind the 3D badge (cream stripes + Corridor GLSL).
 * Cursor trail / click wave stay off: this layer is `pointer-events-none` and
 * those passes are the expensive bits. Cap fps here (the lab left it at 0).
 */
export const BADGE_BACKDROP_CONFIG: StripesTextureConfig = {
  transform: { fit: "width", zoom: 1, panX: 0, panY: 0 },
  adjustments: {
    brightness: 0,
    exposure: 0,
    contrast: 1,
    blackPoint: 0,
    whitePoint: 1,
    gamma: 1,
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
    gradient: { enabled: false },
    grid: { enabled: false },
    stars: {
      enabled: true,
      density: 2,
      sizePx: 12,
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
    cellWidth: 7,
    cellHeight: 7,
    gapX: 0,
    gapY: 0,
    cornerRadius: 0,
    orientation: "vertical",
    angleDeg: 45,
    rotationMode: "cell",
    overlapAmount: 1.2,
    streamGapWave: { enabled: false },
  },
  stripes: [
    { color: 0xffffff, startFrom: 0, width: 0.5, opacity: 1 },
    { color: 0xffffff, startFrom: 0.0195, width: 0.5, opacity: 1 },
    { color: 0xffffff, startFrom: 0.047, width: 1, opacity: 1 },
    { color: 0xffffff, startFrom: 0.086, width: 1.5, opacity: 1 },
    { color: 0xfafafa, startFrom: 0.1408, width: 1.5, opacity: 1 },
    { color: 0xfafafa, startFrom: 0.2167, width: 2, opacity: 1 },
    { color: 0xf7f7f7, startFrom: 0.3191, width: 2.5, opacity: 1 },
    { color: 0xf7f7f7, startFrom: 0.4512, width: 3, opacity: 1 },
    { color: 0xf5f5f5, startFrom: 0.6129, width: 3.5, opacity: 1 },
    { color: 0xf4f4f4, startFrom: 0.8, width: 4, opacity: 1 },
  ],
  stripesEnabled: true,
  fieldScale: 1,
  maxFps: 30,
  reveal: {
    enabled: true,
    type: "water",
    water: {
      durationMs: 950,
      settleMs: 520,
      rows: 5,
      intensity: 1.5,
      wobble: 0.7,
      refraction: 1.3,
      softness: 0.35,
    },
  },
  sparkle: {
    gaps: { enabled: false, coverage: 0, speed: 1 },
    width: {
      enabled: true,
      coverage: 0.5,
      swingPx: 2,
      swingPeriodMin: 0.5,
      swingPeriodMax: 1,
    },
    stripe: {
      enabled: true,
      coverage: 0.2,
      maxBrightness: 0.1,
      speed: 0.2,
      thickestCount: 4,
      hueDriftDeg: 21.5,
      saturationBoost: 0.4,
    },
    motion: { enabled: false },
  },
  stripeDots: {
    enabled: true,
    density: 0.8,
    randomVisibility: 1,
    sizePx: 1.5,
    brightness: 0.13,
    hueDriftDeg: 0,
    saturationBoost: 0,
  },
  stripeBorder: {
    enabled: true,
    minWidthPx: 4,
    density: 0.02,
  },
  gridLines: { enabled: false },
  frames: {
    enabled: true,
    luminanceThreshold: 0.69,
    highlightedStripeCount: 7,
    groupDistanceCells: 8,
    color: 0xffbf14,
    fontSizePx: 8,
    coordinateColor: 0xffffff,
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
  edgeMask: {
    enabled: true,
    start: 0,
    end: 0.1,
    power: 0.6,
    sides: { top: true, right: true, bottom: true, left: true },
  },
  cursorTrail: { enabled: false },
  clickWave: { enabled: false },
  letters: { enabled: false },
  colors: {
    mode: "luminance",
    stripeBlendMode: "normal",
    imageColorLightness: 0,
    imageColorDensity: 1,
    imageColorRemoveThin: 0,
    imageColorBoostThick: 0,
    autoDetectBackground: false,
    backgroundColor: 0,
    gradient: { enabled: false },
  },
  renderMode: "sharp",
  renderIntensity: 1,
  dark: {
    background: { transparent: true },
    stripes: [
      { color: 0x261106, startFrom: 0, width: 0.5, opacity: 1 },
      { color: 0x331607, startFrom: 0.0195, width: 0.5, opacity: 1 },
      { color: 0x44200d, startFrom: 0.047, width: 1, opacity: 1 },
      { color: 0x5b260e, startFrom: 0.086, width: 1.5, opacity: 1 },
      { color: 0x8a2b01, startFrom: 0.1408, width: 1.5, opacity: 1 },
      { color: 0xb33806, startFrom: 0.2167, width: 2, opacity: 1 },
      { color: 0xf46021, startFrom: 0.3191, width: 2.5, opacity: 1 },
      { color: 0xf86a00, startFrom: 0.4512, width: 3, opacity: 1 },
      { color: 0xff8839, startFrom: 0.6129, width: 3.5, opacity: 1 },
      { color: 0xffa05b, startFrom: 0.8, width: 4, opacity: 1 },
    ],
  },
};

/**
 * "Corridor" by @XorDev — lab texture-source GLSL for this field.
 * https://x.com/XorDev/status/1923882930834751520
 */
export const BADGE_BACKDROP_GLSL = `void mainImage(out vec4 O, vec2 I)
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

export const BADGE_BACKDROP_SHADER_SOURCE: SharedShaderSourceSpec = {
  source: BADGE_BACKDROP_GLSL,
  width: 1280,
  height: 960,
  speed: 1,
};
