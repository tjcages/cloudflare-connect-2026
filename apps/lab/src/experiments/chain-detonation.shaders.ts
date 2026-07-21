const SHOCK_HELPERS = `
const float SHOCK_SECONDS = 0.6;
const float TAU = 6.2831853;

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
`;

const CRATER_HELPERS = `
const float CRATER_LIFE = 3.4;
const float CRATER_PUNCH = 0.12;
const float CRATER_RIM = 0.4;
const float CRATER_BASE_RADIUS = 118.0;

float craterPower(float seed) {
  return 0.86 + 0.3 * hash11(seed * 1.73 + 5.11);
}

float craterAmp(float t) {
  if (t < 0.0 || t > CRATER_LIFE) return 0.0;
  float punch = 1.0 - pow(1.0 - clamp(t / CRATER_PUNCH, 0.0, 1.0), 2.6);
  float d = max(t - CRATER_PUNCH, 0.0);
  float fast = exp(-d / 0.26);
  float slow = exp(-d / 1.45);
  float tail = smoothstep(CRATER_LIFE, CRATER_LIFE * 0.7, t);
  float defer = mix(0.42, 1.0, smoothstep(0.1, 0.58, t));
  return punch * (0.64 * slow + 0.36 * fast) * tail * defer;
}

float craterRadius(float t, float s, float seed, float ang) {
  float grow = 0.34 + 0.66 * (1.0 - pow(1.0 - clamp(t / CRATER_PUNCH, 0.0, 1.0), 2.6));
  float over = 1.0 + 0.12 * sin(3.14159265 * clamp((t - CRATER_PUNCH) / CRATER_RIM, 0.0, 1.0));
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

export const CHAIN_MAX_DETONATIONS = 8;
export const CHAIN_MAX_FUSES = 6;

export const CHAIN_FIELD_FRAG = `#version 300 es
precision highp float;

uniform sampler2D uField;
uniform vec2 uCssSize;
uniform int uDetCount;
uniform vec2 uDetCenter[${CHAIN_MAX_DETONATIONS}];
uniform float uDetAge[${CHAIN_MAX_DETONATIONS}];
uniform float uDetSeed[${CHAIN_MAX_DETONATIONS}];
uniform float uDetFlash[${CHAIN_MAX_DETONATIONS}];
uniform float uDetScale[${CHAIN_MAX_DETONATIONS}];
uniform int uFuseCount;
uniform vec2 uFuseCenter[${CHAIN_MAX_FUSES}];
uniform float uFuseHeat[${CHAIN_MAX_FUSES}];
uniform float uFuseScale[${CHAIN_MAX_FUSES}];

in vec2 vUv;
out vec4 outColor;
${SHOCK_HELPERS}${CRATER_HELPERS}
const int DEBRIS_COUNT = 20;
const float DEBRIS_SECONDS = 1.2;

void main() {
  float sc = clamp(min(uCssSize.x, uCssSize.y) / 300.0, 0.5, 2.5);
  vec2 pos = vec2(vUv.x, 1.0 - vUv.y) * uCssSize;

  vec2 warp = vec2(0.0);
  float craterDelta = 0.0;
  for (int i = 0; i < ${CHAIN_MAX_DETONATIONS}; i++) {
    if (i >= uDetCount) break;
    float t = uDetAge[i];
    if (t > CRATER_LIFE) continue;
    float amp = craterAmp(t);
    if (amp <= 0.0) continue;
    float s = sc * uDetScale[i];
    float power = craterPower(uDetSeed[i]);
    vec2 d = pos - uDetCenter[i];
    float r = max(length(d), 1e-3);
    vec2 dir = d / r;
    float ang = atan(d.y, d.x);
    float R = craterRadius(t, s, uDetSeed[i], ang) * power;
    float u = r / R;
    warp -= dir * craterProfile(u) * amp * power * 0.18 * R;
    craterDelta += craterBands(u) * amp * power * 0.8;
  }

  for (int i = 0; i < ${CHAIN_MAX_DETONATIONS}; i++) {
    if (i >= uDetCount) break;
    float ts = uDetAge[i] / SHOCK_SECONDS;
    if (ts >= 1.0) continue;
    float s = sc * uDetScale[i];
    vec2 d = pos - uDetCenter[i];
    float r = max(length(d), 1e-3);
    vec2 dir = d / r;
    float ang = atan(d.y, d.x);
    float R = shockRadius(ts, s) + shockWobble(ang, uDetSeed[i], ts) * s;
    float th = mix(24.0, 9.0, ts) * s;
    float band = (r - R) / th;
    float g = exp(-band * band);
    float w = pow(1.0 - ts, 0.85);
    warp += dir * band * g * 20.0 * s * w;
  }

  for (int i = 0; i < ${CHAIN_MAX_FUSES}; i++) {
    if (i >= uFuseCount) break;
    float h = uFuseHeat[i];
    float s = sc * uFuseScale[i];
    vec2 d = pos - uFuseCenter[i];
    float r = max(length(d), 1e-3);
    warp -= (d / r) * exp(-r / (9.0 * s)) * 5.0 * s * h;
  }

  vec2 uv = clamp(vUv + vec2(warp.x / uCssSize.x, -warp.y / uCssSize.y), 0.0, 1.0);
  float base = texture(uField, uv).r;

  float add = 0.0;
  float dim = 0.0;
  for (int i = 0; i < ${CHAIN_MAX_DETONATIONS}; i++) {
    if (i >= uDetCount) break;
    float age = uDetAge[i];
    float seed = uDetSeed[i];
    float s = sc * uDetScale[i];
    vec2 d = pos - uDetCenter[i];
    float r = max(length(d), 1e-3);
    float ang = atan(d.y, d.x);

    float f = uDetFlash[i];
    if (f < 1.0) {
      float coreR = mix(24.0, 42.0, f) * s;
      add += smoothstep(coreR, coreR * 0.25, r) * (1.0 - f);
    }
    add += exp(-r / (70.0 * s)) * exp(-age * 14.0) * 0.6;

    float ts = age / SHOCK_SECONDS;
    if (ts < 1.0) {
      float R = shockRadius(ts, s) + shockWobble(ang, seed, ts) * s;
      float th = mix(24.0, 9.0, ts) * s;
      float band = (r - R) / th;
      float g = exp(-band * band);
      float w = pow(1.0 - ts, 0.85);
      float grain = 0.82 + 0.18 * sin(ang * 23.0 + seed * 29.0 + ts * 9.0);
      add += g * w * 0.8 * grain;
      float behind = (r - (R - th * 1.9)) / (th * 1.4);
      dim += exp(-behind * behind) * w * 0.24 * smoothstep(0.08, 0.4, ts);
    }

    if (age < DEBRIS_SECONDS && r < 380.0 * s) {
      for (int j = 0; j < DEBRIS_COUNT; j++) {
        float fj = float(j);
        float h1 = hash11(seed + fj * 7.13);
        float h2 = hash11(seed + fj * 3.71 + 11.7);
        float h3 = hash11(seed + fj * 5.39 + 29.3);
        float h4 = hash11(seed + fj * 9.02 + 47.9);
        float h5 = hash11(seed + fj * 1.97 + 71.3);
        float life = 0.7 + 0.5 * h3;
        float tt = age / life;
        if (tt >= 1.0) continue;
        float angJ = (fj + (h1 - 0.5) * 0.9) * (TAU / float(DEBRIS_COUNT));
        vec2 dirJ = vec2(cos(angJ), sin(angJ));
        float v0 = (130.0 + 290.0 * h2 * h2) * s;
        float k = 2.1 + 1.6 * h4;
        float ds = (1.0 - exp(-k * age)) / k;
        float grav = 360.0 * s;
        vec2 pPos = uDetCenter[i] + dirJ * v0 * ds + vec2(0.0, grav * (age - ds) / k);
        vec2 vel = dirJ * v0 * exp(-k * age) + vec2(0.0, grav * (1.0 - exp(-k * age)) / k);
        vec2 seg = -vel * 0.045;
        float segLen2 = max(dot(seg, seg), 1e-4);
        float proj = clamp(dot(pos - pPos, seg) / segLen2, 0.0, 1.0);
        float distSeg = length(pos - (pPos + seg * proj));
        float size = (2.6 + 2.6 * h5) * s * (1.0 - 0.45 * tt);
        float cool = pow(1.0 - tt, 1.4);
        float flicker = mix(1.0, 0.55 + 0.45 * sin(age * 34.0 + fj * 9.7 + seed), smoothstep(0.35, 0.9, tt));
        add += smoothstep(size, size * 0.15, distSeg) * cool * flicker;
      }
    }
  }

  for (int i = 0; i < ${CHAIN_MAX_FUSES}; i++) {
    if (i >= uFuseCount) break;
    float h = uFuseHeat[i];
    float s = sc * uFuseScale[i];
    float r = length(pos - uFuseCenter[i]);
    float sparkR = (2.2 + 4.4 * h) * s;
    add += smoothstep(sparkR, sparkR * 0.2, r) * (0.2 + 0.8 * h * h) * 0.85;
    add += exp(-r / (16.0 * s)) * 0.18 * h * h;
  }

  float value = clamp(base * (1.0 - min(dim, 0.6)) + add + craterDelta, 0.0, 1.0);
  outColor = vec4(vec3(value), 1.0);
}
`;

export const CHAIN_POST_FRAG = `#version 300 es
precision highp float;

uniform sampler2D uSrc;
uniform vec2 uCssSize;
uniform int uDetCount;
uniform vec2 uDetCenter[${CHAIN_MAX_DETONATIONS}];
uniform float uDetAge[${CHAIN_MAX_DETONATIONS}];
uniform float uDetSeed[${CHAIN_MAX_DETONATIONS}];
uniform float uDetScale[${CHAIN_MAX_DETONATIONS}];

in vec2 vUv;
out vec4 outColor;
${SHOCK_HELPERS}
void main() {
  float sc = clamp(min(uCssSize.x, uCssSize.y) / 300.0, 0.5, 2.5);
  vec2 pos = vec2(vUv.x, 1.0 - vUv.y) * uCssSize;
  vec2 warp = vec2(0.0);
  for (int i = 0; i < ${CHAIN_MAX_DETONATIONS}; i++) {
    if (i >= uDetCount) break;
    float ts = uDetAge[i] / SHOCK_SECONDS;
    if (ts >= 1.0) continue;
    float s = sc * uDetScale[i];
    vec2 d = pos - uDetCenter[i];
    float r = max(length(d), 1e-3);
    vec2 dir = d / r;
    float ang = atan(d.y, d.x);
    float R = shockRadius(ts, s) + shockWobble(ang, uDetSeed[i], ts) * s;
    float th = mix(26.0, 10.0, ts) * s;
    float band = (r - R) / th;
    float g = exp(-band * band);
    float w = pow(1.0 - ts, 0.9);
    warp += dir * band * g * 10.0 * s * w;
  }
  vec2 uv = clamp(vUv + vec2(warp.x / uCssSize.x, -warp.y / uCssSize.y), 0.0, 1.0);
  outColor = texture(uSrc, uv);
}
`;
