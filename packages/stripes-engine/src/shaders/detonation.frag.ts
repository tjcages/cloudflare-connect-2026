export function buildDetonationFrag(maxConcurrent: number, debrisCount: number): string {
  return `#version 300 es
precision highp float;

const int MAX_DETONATIONS = ${maxConcurrent};
const int DEBRIS_COUNT = ${debrisCount};
const float TAU = 6.2831853;
const float CRATER_PUNCH = 0.12;
const float CRATER_RIM = 0.4;
const float FLASH_GROW = 1.75;
const float FLASH_GLOW_SCALE = 2.9167;
const float FLASH_GLOW_AMOUNT = 0.6;
const float FLASH_GLOW_DECAY = 14.0;
const float RING_END_THICKNESS_RATIO = 0.375;
const float RING_LENS_THICKNESS = 1.0833;
const float RING_LENS_RATIO = 0.5;
const float CRATER_WARP_SCALE = 0.18;
const float CRATER_BAND_SCALE = 0.8;
const float DEBRIS_SIZE_SPREAD = 1.0;
const float DEBRIS_DRAG_SPREAD = 0.1935;
const float DEBRIS_STREAK_SEC = 0.045;
const float DEBRIS_REACH_MARGIN = 1.1;

uniform sampler2D uField;
uniform vec2 uCssSize;
uniform int uDetCount;
uniform vec2 uDetCenter[MAX_DETONATIONS];
uniform vec4 uDetLife[MAX_DETONATIONS];
uniform vec4 uRing;
uniform vec4 uFlash;
uniform vec4 uDebrisA;
uniform vec4 uDebrisB;
uniform vec4 uCrater;
uniform vec4 uCraterExtra;

in vec2 vUv;
out vec4 outColor;

float hash11(float p) {
  p = fract(p * 0.1031);
  p *= p + 33.33;
  p *= p + p;
  return fract(p);
}

float shockRadius(float ts, float sc) {
  return uRing.x * sc * pow(ts, 0.42);
}

float shockWobble(float ang, float seed, float ts) {
  return (sin(ang * 5.0 + seed * 11.0) + 0.6 * sin(ang * 9.0 - seed * 7.0) + 0.4 * sin(ang * 13.0 + seed * 3.0)) *
    3.4 * ts;
}

float craterPower(float seed) {
  return 0.86 + 0.3 * hash11(seed * 1.73 + 5.11);
}

float craterAmp(float t) {
  float life = uCraterExtra.x;
  if (t < 0.0 || t > life) return 0.0;
  float punch = 1.0 - pow(1.0 - clamp(t / CRATER_PUNCH, 0.0, 1.0), 2.6);
  float d = max(t - CRATER_PUNCH, 0.0);
  float fast = exp(-d / max(1e-4, uCrater.z));
  float slow = exp(-d / max(1e-4, uCrater.w));
  float tail = smoothstep(life, life * 0.7, t);
  float defer = mix(0.42, 1.0, smoothstep(0.1, 0.58, t));
  return punch * (0.64 * slow + 0.36 * fast) * tail * defer;
}

float craterRadius(float t, float sc, float seed, float ang) {
  float rim = uCraterExtra.y;
  float grow = 0.34 + 0.66 * (1.0 - pow(1.0 - clamp(t / CRATER_PUNCH, 0.0, 1.0), 2.6));
  float over = 1.0 + 0.12 * rim * sin(3.14159265 * clamp((t - CRATER_PUNCH) / CRATER_RIM, 0.0, 1.0));
  float wob = 1.0 + 0.055 * sin(ang * 3.0 + seed * 7.0) + 0.03 * sin(ang * 5.0 - seed * 3.7);
  float settle = 1.0 - 0.06 * smoothstep(CRATER_PUNCH + CRATER_RIM, uCraterExtra.x * 0.8, t);
  return uCrater.x * sc * grow * over * wob * settle;
}

float craterProfile(float u) {
  float bowl = u * exp(0.5 - 0.5 * u * u);
  float lobe = -0.24 * exp(-pow((u - 1.72) * 1.5, 2.0));
  return bowl + lobe;
}

float craterBands(float u) {
  float rim = exp(-pow((u - 1.0) / 0.32, 2.0));
  float bowl = exp(-pow(u / 0.66, 2.0));
  return (0.26 * rim - 0.2 * bowl) * uCraterExtra.y;
}

void main() {
  float sc = clamp(min(uCssSize.x, uCssSize.y) / 300.0, 0.5, 2.5);
  vec2 pos = vec2(vUv.x, 1.0 - vUv.y) * uCssSize;
  float ringSec = max(1e-4, uRing.y);
  float debrisSec = max(1e-4, uDebrisB.x);
  float debrisDrag = max(0.05, uDebrisA.z);
  float debrisSpan = debrisSec * (1.0 + uDebrisB.y);
  float debrisReach =
    (uDebrisA.x * (1.0 + uDebrisA.y) / debrisDrag + uDebrisA.w * debrisSpan / debrisDrag + uDebrisB.z * 2.0) *
    DEBRIS_REACH_MARGIN;

  vec2 warp = vec2(0.0);
  float craterDelta = 0.0;
  for (int i = 0; i < MAX_DETONATIONS; i++) {
    if (i >= uDetCount) break;
    float t = uDetLife[i].x;
    if (t > uCraterExtra.x) continue;
    float amp = craterAmp(t);
    if (amp <= 0.0) continue;
    float seed = uDetLife[i].y;
    float power = craterPower(seed);
    vec2 d = pos - uDetCenter[i];
    float r = max(length(d), 1e-3);
    vec2 dir = d / r;
    float ang = atan(d.y, d.x);
    float R = craterRadius(t, sc, seed, ang) * power;
    float u = r / R;
    warp -= dir * craterProfile(u) * amp * power * CRATER_WARP_SCALE * uCrater.y * R;
    craterDelta += craterBands(u) * amp * power * CRATER_BAND_SCALE;
  }

  for (int i = 0; i < MAX_DETONATIONS; i++) {
    if (i >= uDetCount) break;
    float ts = uDetLife[i].x / ringSec;
    if (ts >= 1.0) continue;
    float seed = uDetLife[i].y;
    vec2 d = pos - uDetCenter[i];
    float r = max(length(d), 1e-3);
    vec2 dir = d / r;
    float ang = atan(d.y, d.x);
    float R = shockRadius(ts, sc) + shockWobble(ang, seed, ts) * sc;
    float th = mix(uRing.z, uRing.z * RING_END_THICKNESS_RATIO, ts) * sc;
    float band = (r - R) / th;
    float g = exp(-band * band);
    float w = pow(1.0 - ts, 0.85);
    warp += dir * band * g * uRing.w * sc * w;

    float lensTh = th * RING_LENS_THICKNESS;
    float lensBand = (r - R) / lensTh;
    float lensG = exp(-lensBand * lensBand);
    float lensW = pow(1.0 - ts, 0.9);
    warp += dir * lensBand * lensG * uRing.w * RING_LENS_RATIO * sc * lensW;
  }
  vec2 uv = clamp(vUv + vec2(warp.x / uCssSize.x, -warp.y / uCssSize.y), 0.0, 1.0);
  float base = texture(uField, uv).r;

  float add = 0.0;
  float dim = 0.0;
  for (int i = 0; i < MAX_DETONATIONS; i++) {
    if (i >= uDetCount) break;
    float age = uDetLife[i].x;
    float seed = uDetLife[i].y;
    vec2 d = pos - uDetCenter[i];
    float r = max(length(d), 1e-3);
    float ang = atan(d.y, d.x);

    float f = uDetLife[i].z;
    if (f < 1.0) {
      float coreR = mix(uFlash.x, uFlash.x * FLASH_GROW, f) * sc;
      add += smoothstep(coreR, coreR * 0.25, r) * (1.0 - f) * uFlash.y;
    }
    add += exp(-r / (uFlash.x * FLASH_GLOW_SCALE * sc)) * exp(-age * FLASH_GLOW_DECAY) * FLASH_GLOW_AMOUNT * uFlash.y;

    float ts = age / ringSec;
    if (ts < 1.0) {
      float R = shockRadius(ts, sc) + shockWobble(ang, seed, ts) * sc;
      float th = mix(uRing.z, uRing.z * RING_END_THICKNESS_RATIO, ts) * sc;
      float band = (r - R) / th;
      float g = exp(-band * band);
      float w = pow(1.0 - ts, 0.85);
      float grain = 0.82 + 0.18 * sin(ang * 23.0 + seed * 29.0 + ts * 9.0);
      add += g * w * 0.8 * grain;
      float behind = (r - (R - th * 1.9)) / (th * 1.4);
      dim += exp(-behind * behind) * w * 0.24 * smoothstep(0.08, 0.4, ts);
    }

    if (DEBRIS_COUNT > 0 && age < debrisSpan && r < debrisReach * sc) {
      for (int j = 0; j < DEBRIS_COUNT; j++) {
        float fj = float(j);
        float h1 = hash11(seed + fj * 7.13);
        float h2 = hash11(seed + fj * 3.71 + 11.7);
        float h3 = hash11(seed + fj * 5.39 + 29.3);
        float h4 = hash11(seed + fj * 9.02 + 47.9);
        float h5 = hash11(seed + fj * 1.97 + 71.3);
        float life = debrisSec * (1.0 + uDebrisB.y * h3);
        float tt = age / life;
        if (tt >= 1.0) continue;
        float angJ = (fj + (h1 - 0.5) * 0.9) * (TAU / float(DEBRIS_COUNT));
        vec2 dirJ = vec2(cos(angJ), sin(angJ));
        float v0 = uDebrisA.x * (1.0 + uDebrisA.y * h2 * h2) * sc;
        float k = uDebrisA.z * (1.0 + DEBRIS_DRAG_SPREAD * h4);
        float ds = (1.0 - exp(-k * age)) / k;
        float grav = uDebrisA.w * sc;
        vec2 pPos = uDetCenter[i] + dirJ * v0 * ds + vec2(0.0, grav * (age - ds) / k);
        vec2 vel = dirJ * v0 * exp(-k * age) + vec2(0.0, grav * (1.0 - exp(-k * age)) / k);
        vec2 seg = -vel * DEBRIS_STREAK_SEC;
        float segLen2 = max(dot(seg, seg), 1e-4);
        float proj = clamp(dot(pos - pPos, seg) / segLen2, 0.0, 1.0);
        float distSeg = length(pos - (pPos + seg * proj));
        float size = uDebrisB.z * (1.0 + DEBRIS_SIZE_SPREAD * h5) * sc * (1.0 - 0.45 * tt);
        float cool = pow(1.0 - tt, 1.4);
        float flicker = mix(1.0, 0.55 + 0.45 * sin(age * 34.0 + fj * 9.7 + seed), smoothstep(0.35, 0.9, tt));
        add += smoothstep(size, size * 0.15, distSeg) * cool * flicker * uDebrisB.w;
      }
    }
  }

  float value = clamp(base * (1.0 - min(dim, 0.6)) + add + craterDelta, 0.0, 1.0);
  outColor = vec4(vec3(value), 1.0);
}
`;
}
