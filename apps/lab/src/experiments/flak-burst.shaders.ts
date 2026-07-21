const BURST_HELPERS = `
const float TAU = 6.2831853;
const float PI = 3.14159265;
const float SHOCK_SECONDS = 0.34;
const float CRATER_LIFE = 1.5;
const float CRATER_PUNCH = 0.09;
const float CRATER_RIM = 0.3;
const float CRATER_BASE_RADIUS = 118.0;

float hash11(float p) {
  p = fract(p * 0.1031);
  p *= p + 33.33;
  p *= p + p;
  return fract(p);
}

float shockRadius(float ts, float s) {
  return 168.0 * s * pow(ts, 0.42);
}

float shockWobble(float ang, float seed, float ts) {
  return (sin(ang * 5.0 + seed * 11.0) + 0.6 * sin(ang * 9.0 - seed * 7.0) + 0.4 * sin(ang * 13.0 + seed * 3.0)) *
    3.4 * ts;
}

float craterPower(float seed) {
  return 0.86 + 0.3 * hash11(seed * 1.73 + 5.11);
}

float craterAmp(float t) {
  if (t < 0.0 || t > CRATER_LIFE) return 0.0;
  float punch = 1.0 - pow(1.0 - clamp(t / CRATER_PUNCH, 0.0, 1.0), 2.6);
  float d = max(t - CRATER_PUNCH, 0.0);
  float fast = exp(-d / 0.14);
  float slow = exp(-d / 0.62);
  float tail = smoothstep(CRATER_LIFE, CRATER_LIFE * 0.66, t);
  float defer = mix(0.42, 1.0, smoothstep(0.06, 0.3, t));
  return punch * (0.62 * slow + 0.38 * fast) * tail * defer;
}

float craterRadius(float t, float s, float seed, float ang) {
  float grow = 0.34 + 0.66 * (1.0 - pow(1.0 - clamp(t / CRATER_PUNCH, 0.0, 1.0), 2.6));
  float over = 1.0 + 0.12 * sin(PI * clamp((t - CRATER_PUNCH) / CRATER_RIM, 0.0, 1.0));
  float wob = 1.0 + 0.055 * sin(ang * 3.0 + seed * 7.0) + 0.03 * sin(ang * 5.0 - seed * 3.7);
  float settle = 1.0 - 0.06 * smoothstep(CRATER_PUNCH + CRATER_RIM, CRATER_LIFE * 0.8, t);
  return CRATER_BASE_RADIUS * s * grow * over * wob * settle;
}

float craterProfile(float u) {
  float bowl = u * exp(0.5 - 0.5 * u * u);
  float lobe = -0.24 * exp(-pow((u - 1.72) * 1.5, 2.0));
  return bowl + lobe;
}

float craterBands(float u) {
  float rim = exp(-pow((u - 1.0) / 0.32, 2.0));
  float bowl = exp(-pow(u / 0.66, 2.0));
  return 0.26 * rim - 0.2 * bowl;
}
`;

export const FLAK_FIELD_FRAG = `#version 300 es
precision highp float;

uniform sampler2D uField;
uniform vec2 uCssSize;
uniform int uBurstCount;
uniform vec2 uBurstCenter[21];
uniform float uBurstAge[21];
uniform float uBurstSeed[21];
uniform float uBurstScale[21];
uniform float uBurstFlash[21];

in vec2 vUv;
out vec4 outColor;
${BURST_HELPERS}
const int DEBRIS_COUNT = 6;
const float DEBRIS_SECONDS = 0.75;

void main() {
  float sc = clamp(min(uCssSize.x, uCssSize.y) / 300.0, 0.5, 2.5);
  vec2 pos = vec2(vUv.x, 1.0 - vUv.y) * uCssSize;

  vec2 warp = vec2(0.0);
  float craterDelta = 0.0;
  for (int i = 0; i < 21; i++) {
    if (i >= uBurstCount) break;
    float t = uBurstAge[i];
    if (t > CRATER_LIFE) continue;
    float amp = craterAmp(t);
    if (amp <= 0.0) continue;
    float s = sc * uBurstScale[i];
    float seed = uBurstSeed[i];
    float power = craterPower(seed);
    vec2 d = pos - uBurstCenter[i];
    float r = max(length(d), 1e-3);
    vec2 dir = d / r;
    float ang = atan(d.y, d.x);
    float R = craterRadius(t, s, seed, ang) * power;
    float u = r / R;
    warp -= dir * craterProfile(u) * amp * power * 0.18 * R;
    craterDelta += craterBands(u) * amp * power * 0.7;
  }

  for (int i = 0; i < 21; i++) {
    if (i >= uBurstCount) break;
    float ts = uBurstAge[i] / SHOCK_SECONDS;
    if (ts >= 1.0) continue;
    float s = sc * uBurstScale[i];
    vec2 d = pos - uBurstCenter[i];
    float r = max(length(d), 1e-3);
    vec2 dir = d / r;
    float ang = atan(d.y, d.x);
    float R = shockRadius(ts, s) + shockWobble(ang, uBurstSeed[i], ts) * s;
    float th = mix(20.0, 8.0, ts) * s;
    float band = (r - R) / th;
    float g = exp(-band * band);
    float w = pow(1.0 - ts, 0.85);
    warp += dir * band * g * 20.0 * s * w;
  }

  vec2 uv = clamp(vUv + vec2(warp.x / uCssSize.x, -warp.y / uCssSize.y), 0.0, 1.0);
  float base = texture(uField, uv).r;

  float add = 0.0;
  float dim = 0.0;
  for (int i = 0; i < 21; i++) {
    if (i >= uBurstCount) break;
    float age = uBurstAge[i];
    float seed = uBurstSeed[i];
    float scl = uBurstScale[i];
    float s = sc * scl;
    vec2 d = pos - uBurstCenter[i];
    float r = max(length(d), 1e-3);
    float ang = atan(d.y, d.x);

    float f = uBurstFlash[i];
    if (f < 1.0) {
      float coreR = mix(26.0, 44.0, f) * s;
      add += smoothstep(coreR, coreR * 0.25, r) * (1.0 - f);
    }
    add += exp(-r / (70.0 * s + 14.0)) * exp(-age * 16.0) * 0.5;

    float ts = age / SHOCK_SECONDS;
    if (ts < 1.0) {
      float R = shockRadius(ts, s) + shockWobble(ang, seed, ts) * s;
      float th = mix(20.0, 8.0, ts) * s;
      float band = (r - R) / th;
      float g = exp(-band * band);
      float w = pow(1.0 - ts, 0.85);
      float grain = 0.82 + 0.18 * sin(ang * 23.0 + seed * 29.0 + ts * 9.0);
      add += g * w * 0.78 * grain;
      float behind = (r - (R - th * 1.9)) / (th * 1.4);
      dim += exp(-behind * behind) * w * 0.22 * smoothstep(0.08, 0.4, ts);
    }

    if (age < DEBRIS_SECONDS && r < 240.0 * sc) {
      for (int j = 0; j < DEBRIS_COUNT; j++) {
        float fj = float(j);
        float h1 = hash11(seed + fj * 7.13);
        float h2 = hash11(seed + fj * 3.71 + 11.7);
        float h3 = hash11(seed + fj * 5.39 + 29.3);
        float h4 = hash11(seed + fj * 9.02 + 47.9);
        float h5 = hash11(seed + fj * 1.97 + 71.3);
        float life = 0.42 + 0.3 * h3;
        float tt = age / life;
        if (tt >= 1.0) continue;
        float angJ = (fj + (h1 - 0.5) * 1.1) * (TAU / float(DEBRIS_COUNT)) + seed;
        vec2 dirJ = vec2(cos(angJ), sin(angJ));
        float v0 = (130.0 + 290.0 * h2 * h2) * s * 1.6;
        float k = 2.6 + 1.8 * h4;
        float ds = (1.0 - exp(-k * age)) / k;
        float grav = 300.0 * sc;
        vec2 pPos = uBurstCenter[i] + dirJ * v0 * ds + vec2(0.0, grav * (age - ds) / k);
        vec2 vel = dirJ * v0 * exp(-k * age) + vec2(0.0, grav * (1.0 - exp(-k * age)) / k);
        vec2 seg = -vel * 0.04;
        float segLen2 = max(dot(seg, seg), 1e-4);
        float proj = clamp(dot(pos - pPos, seg) / segLen2, 0.0, 1.0);
        float distSeg = length(pos - (pPos + seg * proj));
        float size = (2.0 + 2.2 * h5) * sc * (0.52 + scl) * (1.0 - 0.45 * tt);
        float cool = pow(1.0 - tt, 1.4);
        float flicker = mix(1.0, 0.55 + 0.45 * sin(age * 38.0 + fj * 9.7 + seed), smoothstep(0.3, 0.9, tt));
        add += smoothstep(size, size * 0.15, distSeg) * cool * flicker;
      }
    }
  }

  float value = clamp(base * (1.0 - min(dim, 0.6)) + add + craterDelta, 0.0, 1.0);
  outColor = vec4(vec3(value), 1.0);
}
`;

export const FLAK_POST_FRAG = `#version 300 es
precision highp float;

uniform sampler2D uSrc;
uniform vec2 uCssSize;
uniform int uBurstCount;
uniform vec2 uBurstCenter[21];
uniform float uBurstAge[21];
uniform float uBurstSeed[21];
uniform float uBurstScale[21];

in vec2 vUv;
out vec4 outColor;
${BURST_HELPERS}
void main() {
  float sc = clamp(min(uCssSize.x, uCssSize.y) / 300.0, 0.5, 2.5);
  vec2 pos = vec2(vUv.x, 1.0 - vUv.y) * uCssSize;
  vec2 warp = vec2(0.0);
  for (int i = 0; i < 21; i++) {
    if (i >= uBurstCount) break;
    float ts = uBurstAge[i] / SHOCK_SECONDS;
    if (ts >= 1.0) continue;
    float s = sc * uBurstScale[i];
    vec2 d = pos - uBurstCenter[i];
    float r = max(length(d), 1e-3);
    vec2 dir = d / r;
    float ang = atan(d.y, d.x);
    float R = shockRadius(ts, s) + shockWobble(ang, uBurstSeed[i], ts) * s;
    float th = mix(22.0, 9.0, ts) * s;
    float band = (r - R) / th;
    float g = exp(-band * band);
    float w = pow(1.0 - ts, 0.9);
    warp += dir * band * g * 11.0 * s * w;
  }
  vec2 uv = clamp(vUv + vec2(warp.x / uCssSize.x, -warp.y / uCssSize.y), 0.0, 1.0);
  outColor = texture(uSrc, uv);
}
`;
