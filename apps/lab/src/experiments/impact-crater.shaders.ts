const CRATER_HELPERS = `
const float CRATER_LIFE = 4.6;
const float CRATER_PUNCH = 0.12;
const float CRATER_RIM = 0.4;
const float CRATER_BASE_RADIUS = 132.0;

float craterAmp(float t) {
  if (t < 0.0 || t > CRATER_LIFE) return 0.0;
  float punch = 1.0 - pow(1.0 - clamp(t / CRATER_PUNCH, 0.0, 1.0), 2.6);
  float d = max(t - CRATER_PUNCH, 0.0);
  float fast = exp(-d / 0.28);
  float slow = exp(-d / 1.9);
  float tail = smoothstep(CRATER_LIFE, CRATER_LIFE * 0.72, t);
  return punch * (0.62 * slow + 0.38 * fast) * tail;
}

float craterRadius(float t, float sc, float seed, float ang) {
  float grow = 0.34 + 0.66 * (1.0 - pow(1.0 - clamp(t / CRATER_PUNCH, 0.0, 1.0), 2.6));
  float over = 1.0 + 0.12 * sin(3.14159265 * clamp((t - CRATER_PUNCH) / CRATER_RIM, 0.0, 1.0));
  float wob = 1.0 + 0.055 * sin(ang * 3.0 + seed * 7.0) + 0.03 * sin(ang * 5.0 - seed * 3.7);
  float settle = 1.0 - 0.06 * smoothstep(CRATER_PUNCH + CRATER_RIM, CRATER_LIFE * 0.8, t);
  return CRATER_BASE_RADIUS * sc * grow * over * wob * settle;
}

float craterProfile(float u) {
  float bowl = u * exp(0.5 - 0.5 * u * u);
  float lobe = -0.24 * exp(-pow((u - 1.72) * 1.5, 2.0));
  return bowl + lobe;
}
`;

export const CRATER_FIELD_FRAG = `#version 300 es
precision highp float;

uniform sampler2D uField;
uniform vec2 uCssSize;
uniform int uCraterCount;
uniform vec2 uCraterCenter[4];
uniform float uCraterAge[4];
uniform float uCraterSeed[4];
uniform float uCraterPower[4];

in vec2 vUv;
out vec4 outColor;
${CRATER_HELPERS}
float craterBands(float u) {
  float rim = exp(-pow((u - 1.0) / 0.32, 2.0));
  float bowl = exp(-pow(u / 0.66, 2.0));
  return 0.26 * rim - 0.2 * bowl;
}

void main() {
  float sc = clamp(min(uCssSize.x, uCssSize.y) / 300.0, 0.5, 2.5);
  vec2 pos = vec2(vUv.x, 1.0 - vUv.y) * uCssSize;

  vec2 warp = vec2(0.0);
  float delta = 0.0;
  float add = 0.0;

  for (int i = 0; i < 4; i++) {
    if (i >= uCraterCount) break;
    float t = uCraterAge[i];
    if (t > CRATER_LIFE) continue;
    float power = uCraterPower[i];
    vec2 d = pos - uCraterCenter[i];
    float r = max(length(d), 1e-3);
    vec2 dir = d / r;
    float ang = atan(d.y, d.x);
    float R = craterRadius(t, sc, uCraterSeed[i], ang) * power;
    float u = r / R;
    float amp = craterAmp(t) * power;

    warp -= dir * craterProfile(u) * amp * 0.2 * R;
    delta += craterBands(u) * amp * 0.8;

    float impact = exp(-t * 22.0);
    if (impact > 0.004) {
      float ring = exp(-pow((r - R) / (0.16 * R), 2.0));
      add += impact * (ring * 0.5 + exp(-r / (0.35 * R)) * 0.3);
    }
  }

  vec2 uv = clamp(vUv + vec2(warp.x / uCssSize.x, -warp.y / uCssSize.y), 0.0, 1.0);
  float base = texture(uField, uv).r;
  outColor = vec4(vec3(clamp(base + delta + add, 0.0, 1.0)), 1.0);
}
`;

export const CRATER_POST_FRAG = `#version 300 es
precision highp float;

uniform sampler2D uSrc;
uniform vec2 uCssSize;
uniform int uCraterCount;
uniform vec2 uCraterCenter[4];
uniform float uCraterAge[4];
uniform float uCraterSeed[4];
uniform float uCraterPower[4];

in vec2 vUv;
out vec4 outColor;
${CRATER_HELPERS}
void main() {
  float sc = clamp(min(uCssSize.x, uCssSize.y) / 300.0, 0.5, 2.5);
  vec2 pos = vec2(vUv.x, 1.0 - vUv.y) * uCssSize;
  vec2 warp = vec2(0.0);

  for (int i = 0; i < 4; i++) {
    if (i >= uCraterCount) break;
    float t = uCraterAge[i];
    if (t > 0.95) continue;
    float power = uCraterPower[i];
    vec2 d = pos - uCraterCenter[i];
    float r = max(length(d), 1e-3);
    vec2 dir = d / r;
    float ang = atan(d.y, d.x);
    float R = craterRadius(t, sc, uCraterSeed[i], ang) * power;
    float x = r / R - 1.0;
    float lens = x * exp(-pow(x / 0.3, 2.0)) * 2.2;
    warp -= dir * lens * craterAmp(t) * power * exp(-t / 0.42) * 0.1 * R;
  }

  vec2 uv = clamp(vUv + vec2(warp.x / uCssSize.x, -warp.y / uCssSize.y), 0.0, 1.0);
  outColor = texture(uSrc, uv);
}
`;
