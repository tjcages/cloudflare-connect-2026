/**
 * Exact Shadertoy sine-pack as a WebGL2 mainImage, with CF Twizzler uniforms.
 *
 * Edge lock: uv.x always comes from screen X (canvas L/R = pattern L/R).
 * XYZ rotate tilts the sampling plane (Y/Z) without sliding the L/R anchors.
 */

import type { TwizzlerSettings } from "./twizzler";
import { twizzlerShaderPackRecipe } from "./twizzler";

export const TWIZZLER_SINE_SHADER_SOURCE = `// Twizzler sine-pack — exact Shadertoy isolines + CF uniforms
uniform float uLineCount;
uniform float uLineWidth;
uniform float uAmplitude;
uniform float uScale;
uniform float uCenterY;
uniform float uWrinkles;
uniform float uRecipe;
uniform float uSpeed;
uniform float uOpacity;
uniform float uLeftHeight;
uniform float uRightHeight;
uniform float uEdgeTaper;
uniform float uEdgeFluctuation;
uniform float uEdgeSpeed;
uniform float uTwist;
uniform float uBendPos1;
uniform float uBendAmt1;
uniform float uBendPos2;
uniform float uBendAmt2;
uniform float uBendPos3;
uniform float uBendAmt3;
uniform float uDepthPos;
uniform float uDepthAmt;
uniform float uDepthWidth;
uniform float uDepthSpread;
uniform float uDepthLift;
uniform float uWrinkleStrength;
uniform float uNoiseScaleX;
uniform float uNoiseScaleY;
uniform float uDrift;
uniform vec3 uColorNear;
uniform vec3 uColorFar;
uniform vec3 uColorEdge;
uniform vec3 uRotate;
uniform vec2 uPan;
uniform float uZoom;

float twHash(float n) {
  return fract(sin(n) * 43758.5453123);
}

float twNoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float n = i.x + i.y * 57.0;
  return mix(
    mix(twHash(n), twHash(n + 1.0), f.x),
    mix(twHash(n + 57.0), twHash(n + 58.0), f.x),
    f.y
  );
}

float twBend(float xT, float pos, float amt, float width) {
  float d = (xT - pos) / max(0.02, width);
  return amt * exp(-d * d);
}

mat3 twRotX(float a) {
  float c = cos(a), s = sin(a);
  return mat3(1.0, 0.0, 0.0, 0.0, c, -s, 0.0, s, c);
}
mat3 twRotY(float a) {
  float c = cos(a), s = sin(a);
  return mat3(c, 0.0, s, 0.0, 1.0, 0.0, -s, 0.0, c);
}
mat3 twRotZ(float a) {
  float c = cos(a), s = sin(a);
  return mat3(c, -s, 0.0, s, c, 0.0, 0.0, 0.0, 1.0);
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  // --- Edge lock: screen L/R always map to pattern L/R (exact Shadertoy uv.x) ---
  float aspect = iResolution.x / max(iResolution.y, 1.0);
  float xT = clamp(fragCoord.x / max(iResolution.x, 1.0), 0.0, 1.0);
  float yT = fragCoord.y / max(iResolution.y, 1.0);

  // Plane in UV units; X parameter stays screen-locked through rotation.
  vec3 p = vec3((xT - 0.5) * aspect, (yT - 0.5), 0.0);
  p = twRotZ(uRotate.z) * twRotY(uRotate.y) * twRotX(uRotate.x) * p;
  p.xy = p.xy / max(uZoom, 0.05) + uPan;

  // Exact Shadertoy uv (Y up). X from locked screen edge; Y from rotated plane.
  float uvx = (xT - 0.5) * aspect;
  float uvy = p.y / max(0.2, 1.0 + p.z * 0.9);
  uvy -= (uCenterY - 0.5);

  float time = iTime * max(0.0, uSpeed);
  float n = max(1.0, floor(uLineCount + 0.5));
  float m = clamp(1.0 + uWrinkles * 1.6, 1.0, 10.0);
  float recipe = floor(uRecipe + 0.5);

  // Edge height anchors (Leva left/right) + fluctuation.
  float edgeWave = uEdgeFluctuation * sin(time * uEdgeSpeed * 2.0 + xT * 6.2831853);
  float edgeY = mix(uLeftHeight - 0.5, uRightHeight - 0.5, xT) * 0.35 + edgeWave;
  float taper = mix(1.0, mix(uLeftHeight, uRightHeight, xT), uEdgeTaper * 0.5);

  float bend =
    twBend(xT, uBendPos1, uBendAmt1, 0.16) +
    twBend(xT, uBendPos2, uBendAmt2, 0.16) +
    twBend(xT, uBendPos3, uBendAmt3, 0.16);
  float depthGate = twBend(xT, uDepthPos, 1.0, max(0.05, uDepthWidth));
  float depthY = (uDepthAmt * depthGate + uDepthLift * 0.15) * 0.2 * (0.5 + uDepthSpread * 0.5);
  float noiseY =
    (twNoise(vec2(xT * (40.0 * uNoiseScaleX + 1.0) + time * uDrift, uNoiseScaleY * 12.0)) - 0.5) *
    uWrinkleStrength *
    0.35;

  float amp = 0.25 * max(0.05, uAmplitude) * max(0.2, uScale) * taper;
  float ink = 0.0;
  float halfW = max(0.0008, uLineWidth * 0.0028);

  for (float i = 0.0; i < 400.0; i += 1.0) {
    if (i >= n) break;
    float t = 0.2 * time + 6.28318530718 * i / n;
    t += uTwist * xT * 0.35 * (i / n - 0.5);

    float wave = 0.0;
    if (recipe < 0.5) {
      wave = sin(t + 11.0 * uvx) - 4.0 * uvx * cos(t * 0.5);
    } else if (recipe < 1.5) {
      wave = sin(m * t + 11.0 * uvx) - 4.0 * uvx * cos(t * 0.5);
    } else {
      wave = sin(m * t + 11.0 * uvx) - 4.0 * uvx * cos(t);
    }

    float y = amp * wave + edgeY + bend * 0.25 + depthY + noiseY;
    float d = abs(uvy - y);
    float aa = fwidth(uvy) * 1.25 + halfW;
    float line = 1.0 - smoothstep(0.0, aa, d);
    ink = max(ink, line);
  }

  vec3 nearC = uColorNear;
  vec3 farC = uColorFar;
  vec3 edgeC = uColorEdge;
  vec3 col = mix(farC, nearC, smoothstep(0.0, 1.0, xT));
  col = mix(col, edgeC, 0.12 * abs(uvy) * ink);

  // White stage + CF ink (banner hero).
  vec3 rgb = mix(vec3(1.0), col, ink * clamp(uOpacity, 0.0, 1.0));
  fragColor = vec4(rgb, 1.0);
}
`;

export const TWIZZLER_SINE_SHADER_PRESET_ID = "twizzler-sine";

export type TwizzlerViewState = {
  rotateXDeg: number;
  rotateYDeg: number;
  rotateZDeg: number;
  panX: number;
  panY: number;
  distance: number;
};

export const TWIZZLER_VIEW_DEFAULTS: TwizzlerViewState = {
  rotateXDeg: 0,
  rotateYDeg: 0,
  rotateZDeg: 0,
  panX: 0,
  panY: 0,
  distance: 30,
};

function hexToRgb01(hex: string): [number, number, number] {
  const raw = hex.replace("#", "").trim();
  const full =
    raw.length === 3
      ? raw
          .split("")
          .map((c) => c + c)
          .join("")
      : raw.padEnd(6, "0").slice(0, 6);
  const n = Number.parseInt(full, 16);
  if (!Number.isFinite(n)) return [0.91, 0.28, 0.11];
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

/** Flat uniform map for the Twizzler sine WebGL program. */
export function twizzlerSineUniforms(
  settings: TwizzlerSettings,
  view: TwizzlerViewState = TWIZZLER_VIEW_DEFAULTS,
): Record<string, number | [number, number] | [number, number, number]> {
  const recipe = twizzlerShaderPackRecipe(settings.depthTerrain) ?? 0;
  const zoom = TWIZZLER_VIEW_DEFAULTS.distance / Math.max(view.distance, 0.01);
  return {
    uLineCount: settings.lineCount,
    uLineWidth: settings.lineWidth,
    uAmplitude: settings.amplitude,
    uScale: settings.scale,
    uCenterY: settings.centerY,
    uWrinkles: settings.wrinkles,
    uRecipe: recipe,
    uSpeed: settings.speed,
    uOpacity: settings.opacity,
    uLeftHeight: settings.leftHeight,
    uRightHeight: settings.rightHeight,
    uEdgeTaper: settings.edgeTaper,
    uEdgeFluctuation: settings.edgeFluctuation,
    uEdgeSpeed: settings.edgeSpeed,
    uTwist: settings.twist,
    uBendPos1: settings.bendPosition,
    uBendAmt1: settings.bendAmount,
    uBendPos2: settings.bend2Position,
    uBendAmt2: settings.bend2Amount,
    uBendPos3: settings.bend3Position,
    uBendAmt3: settings.bend3Amount,
    uDepthPos: settings.depthPosition,
    uDepthAmt: settings.depthAmount,
    uDepthWidth: settings.depthWidth,
    uDepthSpread: settings.depthSpread,
    uDepthLift: settings.depthLift,
    uWrinkleStrength: settings.wrinkleStrength,
    uNoiseScaleX: settings.noiseScaleX,
    uNoiseScaleY: settings.noiseScaleY,
    uDrift: settings.drift,
    uColorNear: hexToRgb01(settings.colorNear),
    uColorFar: hexToRgb01(settings.colorFar),
    uColorEdge: hexToRgb01(settings.colorEdge),
    uRotate: [(view.rotateXDeg * Math.PI) / 180, (view.rotateYDeg * Math.PI) / 180, (view.rotateZDeg * Math.PI) / 180],
    uPan: [view.panX / 40, view.panY / 40],
    uZoom: Math.max(0.2, Math.min(5, zoom)),
  };
}

export function isTwizzlerSineShaderPreset(id: string): boolean {
  return id === TWIZZLER_SINE_SHADER_PRESET_ID;
}

/** True when Twizzler should draw via the exact GLSL sine-pack (not Canvas2D strokes). */
export function shouldUseTwizzlerSineShader(settings: Pick<TwizzlerSettings, "depthTerrain">): boolean {
  return twizzlerShaderPackRecipe(settings.depthTerrain) !== null;
}
