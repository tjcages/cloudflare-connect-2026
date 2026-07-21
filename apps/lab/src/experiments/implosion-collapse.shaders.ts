const IMPLOSION_HELPERS = `
const float PI = 3.14159265;
const float PULL_S = 0.55;
const float HOLD_S = 1.02;
const float END_S = 1.58;

float hash11(float p) {
  p = fract(p * 0.1031);
  p *= p + 33.33;
  p *= p + p;
  return fract(p);
}

float implodeVar(float seed) {
  return 0.92 + 0.16 * hash11(seed * 2.17 + 3.41);
}

float implodeAmp(float t) {
  if (t <= 0.0 || t >= END_S) return 0.0;
  if (t < PULL_S) {
    float u = t / PULL_S;
    return pow(u, 2.4);
  }
  if (t < HOLD_S) {
    float u = (t - PULL_S) / (HOLD_S - PULL_S);
    return 1.0 - 0.05 * sin(PI * u);
  }
  float u = (t - HOLD_S) / (END_S - HOLD_S);
  return pow(1.0 - u, 3.0) - 0.3 * sin(PI * pow(u, 0.75));
}

float implodeRadius(float t, float minSide, float seed, float ang) {
  float base = clamp(minSide * 0.2, 46.0, 108.0);
  float squeeze = 1.0 - 0.2 * smoothstep(0.0, HOLD_S, min(t, HOLD_S));
  float puff = 1.0;
  if (t > HOLD_S) {
    float u = clamp((t - HOLD_S) / (END_S - HOLD_S), 0.0, 1.0);
    puff = 1.0 + 0.16 * sin(PI * pow(u, 0.8));
  }
  float wob = 1.0 + 0.045 * sin(ang * 3.0 + seed * 5.0) + 0.025 * sin(ang * 5.0 - seed * 2.3);
  return base * squeeze * puff * wob * implodeVar(seed);
}

float implodeProfile(float u) {
  if (u >= 1.0) return 0.0;
  float w = 1.0 - u * u;
  return 4.2 * u * w * w * w;
}

float implodeWindow(float u) {
  if (u >= 1.0) return 0.0;
  float w = 1.0 - u * u;
  return w * w;
}

float knotGlow(float t) {
  if (t <= 0.0) return 0.0;
  float rise = smoothstep(PULL_S * 0.4, PULL_S, t);
  float fall = 1.0 - smoothstep(HOLD_S, HOLD_S + 0.2, t);
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
  float minSide = min(uCssSize.x, uCssSize.y);
  vec2 pos = vec2(vUv.x, 1.0 - vUv.y) * uCssSize;

  vec2 warp = vec2(0.0);
  for (int i = 0; i < 3; i++) {
    if (i >= uEventCount) break;
    float t = uEventAge[i];
    float amp = implodeAmp(t);
    if (amp == 0.0) continue;
    float seed = uEventSeed[i];
    vec2 d = pos - uEventCenter[i];
    float r = max(length(d), 1e-3);
    vec2 dir = d / r;
    float ang = atan(d.y, d.x);
    float R = implodeRadius(t, minSide, seed, ang);
    float p = implodeProfile(r / R);
    if (p == 0.0) continue;
    warp += dir * p * amp * 0.34 * R;
  }

  vec2 uv = clamp(vUv + vec2(warp.x / uCssSize.x, -warp.y / uCssSize.y), 0.0, 1.0);
  float base = texture(uField, uv).r;

  float add = 0.0;
  float dim = 0.0;
  for (int i = 0; i < 3; i++) {
    if (i >= uEventCount) break;
    float t = uEventAge[i];
    if (t <= 0.0 || t >= END_S) continue;
    float seed = uEventSeed[i];
    vec2 d = pos - uEventCenter[i];
    float r = max(length(d), 1e-3);
    float ang = atan(d.y, d.x);
    float R = implodeRadius(t, minSide, seed, ang);
    float u = r / R;
    float win = implodeWindow(u);
    if (win == 0.0) continue;

    float core = 0.2 * R;
    add += exp(-pow(r / core, 2.0)) * knotGlow(t) * 0.34 * win;

    float amp = implodeAmp(t);
    float rim = exp(-pow((u - 0.74) / 0.2, 2.0));
    dim += rim * max(amp, 0.0) * 0.14 * win;

    if (t > HOLD_S) {
      float ru = clamp((t - HOLD_S) / (END_S - HOLD_S), 0.0, 1.0);
      float shell = exp(-pow((u - (0.24 + 0.6 * ru)) / 0.2, 2.0));
      add += shell * sin(PI * ru) * 0.14 * win * (0.86 + 0.14 * sin(ang * 7.0 + seed * 13.0));
    }
  }

  float value = clamp(base * (1.0 - min(dim, 0.28)) + add, 0.0, 1.0);
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
  float minSide = min(uCssSize.x, uCssSize.y);
  vec2 pos = vec2(vUv.x, 1.0 - vUv.y) * uCssSize;

  vec2 warp = vec2(0.0);
  for (int i = 0; i < 3; i++) {
    if (i >= uEventCount) break;
    float t = uEventAge[i];
    float amp = implodeAmp(t);
    if (amp == 0.0) continue;
    float seed = uEventSeed[i];
    vec2 d = pos - uEventCenter[i];
    float r = max(length(d), 1e-3);
    vec2 dir = d / r;
    float ang = atan(d.y, d.x);
    float R = implodeRadius(t, minSide, seed, ang) * 0.82;
    float p = implodeProfile(r / R);
    if (p == 0.0) continue;
    warp += dir * p * amp * 0.09 * R;
  }

  vec2 uv = clamp(vUv + vec2(warp.x / uCssSize.x, -warp.y / uCssSize.y), 0.0, 1.0);
  outColor = texture(uSrc, uv);
}
`;
