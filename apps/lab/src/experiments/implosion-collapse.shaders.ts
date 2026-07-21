const IMPLOSION_HELPERS = `
const float PI = 3.14159265;
const float COLLAPSE_S = 0.45;
const float HOLD_S = 0.6;
const float REBOUND_S = 1.1;
const float BASE_RADIUS = 132.0;

float hash11(float p) {
  p = fract(p * 0.1031);
  p *= p + 33.33;
  p *= p + p;
  return fract(p);
}

float implodePower(float seed) {
  return 0.88 + 0.26 * hash11(seed * 2.17 + 3.41);
}

float implodeAmp(float t) {
  if (t <= 0.0 || t >= REBOUND_S) return 0.0;
  if (t < COLLAPSE_S) {
    float u = t / COLLAPSE_S;
    return pow(u, 2.3);
  }
  if (t < HOLD_S) {
    float u = (t - COLLAPSE_S) / (HOLD_S - COLLAPSE_S);
    return 1.0 - 0.035 * sin(PI * u);
  }
  float u = (t - HOLD_S) / (REBOUND_S - HOLD_S);
  float e = 1.0 - pow(1.0 - u, 2.6);
  return (1.0 - e) - 0.3 * sin(PI * u) * (1.0 - 0.25 * u);
}

float implodeRadius(float t, float sc, float seed, float ang) {
  float squeeze = 1.0 - 0.16 * clamp(t / HOLD_S, 0.0, 1.0);
  float puff = 1.0;
  if (t > HOLD_S) {
    float u = clamp((t - HOLD_S) / (REBOUND_S - HOLD_S), 0.0, 1.0);
    puff = 1.0 + 0.34 * sin(PI * pow(u, 0.8));
  }
  float wob = 1.0 + 0.05 * sin(ang * 3.0 + seed * 5.0) + 0.028 * sin(ang * 5.0 - seed * 2.3);
  return BASE_RADIUS * sc * squeeze * puff * wob;
}

float implodeProfile(float u) {
  return u * exp(0.5 - 0.9 * u * u);
}

float knotGlow(float t) {
  if (t <= 0.0) return 0.0;
  float rise = smoothstep(COLLAPSE_S * 0.5, COLLAPSE_S, t);
  float fall = 1.0 - smoothstep(HOLD_S, HOLD_S + 0.24, t);
  return rise * fall;
}
`;

export const IMPLOSION_FIELD_FRAG = `#version 300 es
precision highp float;

uniform sampler2D uField;
uniform vec2 uCssSize;
uniform int uEventCount;
uniform vec2 uEventCenter[3];
uniform float uEventAge[3];
uniform float uEventSeed[3];

in vec2 vUv;
out vec4 outColor;
${IMPLOSION_HELPERS}
void main() {
  float sc = clamp(min(uCssSize.x, uCssSize.y) / 300.0, 0.5, 2.5);
  vec2 pos = vec2(vUv.x, 1.0 - vUv.y) * uCssSize;

  vec2 warp = vec2(0.0);
  for (int i = 0; i < 3; i++) {
    if (i >= uEventCount) break;
    float t = uEventAge[i];
    float amp = implodeAmp(t);
    if (amp == 0.0) continue;
    float seed = uEventSeed[i];
    float power = implodePower(seed);
    vec2 d = pos - uEventCenter[i];
    float r = max(length(d), 1e-3);
    vec2 dir = d / r;
    float ang = atan(d.y, d.x);
    float R = implodeRadius(t, sc, seed, ang) * power;
    float u = r / R;
    warp -= dir * implodeProfile(u) * amp * power * 0.18 * R;
  }

  vec2 uv = clamp(vUv + vec2(warp.x / uCssSize.x, -warp.y / uCssSize.y), 0.0, 1.0);
  float base = texture(uField, uv).r;

  float add = 0.0;
  float dim = 0.0;
  for (int i = 0; i < 3; i++) {
    if (i >= uEventCount) break;
    float t = uEventAge[i];
    if (t <= 0.0 || t > REBOUND_S) continue;
    float seed = uEventSeed[i];
    float power = implodePower(seed);
    vec2 d = pos - uEventCenter[i];
    float r = max(length(d), 1e-3);
    float ang = atan(d.y, d.x);
    float R = implodeRadius(t, sc, seed, ang) * power;
    float u = r / R;

    float knot = knotGlow(t);
    float core = 26.0 * sc;
    add += exp(-pow(r / core, 2.0)) * knot * 0.42;

    float amp = implodeAmp(t);
    float rim = exp(-pow((u - 1.02) / 0.36, 2.0));
    dim += rim * max(amp, 0.0) * 0.16;

    if (t > HOLD_S) {
      float ru = clamp((t - HOLD_S) / (REBOUND_S - HOLD_S), 0.0, 1.0);
      float shell = exp(-pow((u - (0.35 + 0.75 * ru)) / 0.24, 2.0));
      add += shell * sin(PI * ru) * 0.16 * (0.86 + 0.14 * sin(ang * 7.0 + seed * 13.0));
    }
  }

  float value = clamp(base * (1.0 - min(dim, 0.45)) + add, 0.0, 1.0);
  outColor = vec4(vec3(value), 1.0);
}
`;

export const IMPLOSION_POST_FRAG = `#version 300 es
precision highp float;

uniform sampler2D uSrc;
uniform vec2 uCssSize;
uniform int uEventCount;
uniform vec2 uEventCenter[3];
uniform float uEventAge[3];
uniform float uEventSeed[3];

in vec2 vUv;
out vec4 outColor;
${IMPLOSION_HELPERS}
void main() {
  float sc = clamp(min(uCssSize.x, uCssSize.y) / 300.0, 0.5, 2.5);
  vec2 pos = vec2(vUv.x, 1.0 - vUv.y) * uCssSize;

  vec2 warp = vec2(0.0);
  for (int i = 0; i < 3; i++) {
    if (i >= uEventCount) break;
    float t = uEventAge[i];
    float amp = implodeAmp(t);
    if (amp == 0.0) continue;
    float seed = uEventSeed[i];
    float power = implodePower(seed);
    vec2 d = pos - uEventCenter[i];
    float r = max(length(d), 1e-3);
    vec2 dir = d / r;
    float ang = atan(d.y, d.x);
    float R = implodeRadius(t, sc, seed, ang) * power * 0.86;
    float u = r / R;
    warp -= dir * implodeProfile(u) * amp * power * 0.055 * R;
  }

  vec2 uv = clamp(vUv + vec2(warp.x / uCssSize.x, -warp.y / uCssSize.y), 0.0, 1.0);
  outColor = texture(uSrc, uv);
}
`;
