export const MOLTEN_POUR_FRAG = `#version 300 es
precision highp float;
in vec2 vUv;
uniform sampler2D uField;
uniform float uAspect;
uniform float uTime;
uniform float uFill;
uniform float uFade;
uniform float uSettle;
uniform vec2 uFlow;
uniform vec2 uOrigin;
uniform float uDiag;
uniform vec2 uSeed;
out vec4 outColor;

const float FRONT_TH = 0.075;
const float BULGE = 0.155;
const float WOBBLE = 0.17;
const float LAG = 0.5;

float hash21(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

float vnoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float a = hash21(i);
  float b = hash21(i + vec2(1.0, 0.0));
  float c = hash21(i + vec2(0.0, 1.0));
  float d = hash21(i + vec2(1.0, 1.0));
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}

float fbm(vec2 p) {
  float v = 0.0;
  float amp = 0.5;
  for (int i = 0; i < 4; i++) {
    v += amp * vnoise(p);
    p = p * 2.03 + vec2(13.71, 7.19);
    amp *= 0.5;
  }
  return v;
}

float axisS(vec2 p) {
  return dot(p - uOrigin, uFlow) / uDiag;
}

float perpQ(vec2 p) {
  return dot(p - uOrigin, vec2(-uFlow.y, uFlow.x)) / uDiag;
}

float frontier(vec2 p) {
  float s = axisS(p);
  float q = perpQ(p);
  float wob = (fbm(p * 2.2 + uSeed * 1.7) - 0.5) * WOBBLE + 0.022 * sin(q * 9.0 + uTime * 1.2 + uSeed.x);
  return s + wob * (1.0 - 0.82 * uSettle) + LAG * abs(q) * (1.0 - uSettle);
}

float crustValue(vec2 p) {
  float n = fbm(p * 2.6 + uSeed);
  float m = fbm(p * 1.15 + uSeed * 0.7 + vec2(11.3, 4.9));
  return clamp(0.10 + 0.88 * mix(n, m, 0.45), 0.0, 1.0);
}

void main() {
  vec2 p = vec2(vUv.x * uAspect, vUv.y);
  vec2 perp = vec2(-uFlow.y, uFlow.x);

  float e = uFill - frontier(p);
  float x = e / FRONT_TH;
  float lens = x * exp(-x * x);
  float behind = max(e, 0.0);
  float ripple = sin(behind * 46.0 - uTime * 4.2) * exp(-behind / 0.16) * 0.030;
  float lateral = lens * 0.055 * sin(perpQ(p) * 11.0 + uSeed.y * 3.7);
  vec2 warp = (uFlow * (lens * BULGE + ripple) + perp * lateral) * uFade;

  vec2 pw = p + warp;
  vec2 uvw = clamp(vec2(pw.x / uAspect, pw.y), 0.0, 1.0);
  float image = texture(uField, uvw).r;
  float crust = crustValue(pw);

  float e2 = uFill - frontier(pw);
  float fill = smoothstep(-0.008, 0.008, e2);
  float v = mix(crust, image, fill);

  float hot = exp(-max(e2, 0.0) / 0.11) * fill;
  v = clamp(v + 0.20 * hot * uFade * (0.7 + 0.3 * vnoise(p * 7.0 + uSeed)), 0.0, 1.0);

  float shx = (e2 + 0.030) / 0.026;
  v *= 1.0 - 0.30 * exp(-shx * shx) * uFade;

  float rimx = (e2 - 0.010) / 0.016;
  float rim = exp(-rimx * rimx);
  v = max(v, rim * (0.82 + 0.18 * vnoise(p * 14.0 + uSeed * 2.3)) * uFade);

  outColor = vec4(vec3(clamp(v, 0.0, 1.0)), 1.0);
}
`;
