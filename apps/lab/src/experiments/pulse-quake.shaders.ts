const QUAKE_HELPERS = `
const float EVENT_SECONDS = 2.2;
const float S_DELAY = 0.09;
const float P_SPEED = 332.0;
const float S_SPEED = 156.0;

float qEase(float t) {
  float c = clamp(t, 0.0, 1.0);
  return c * c * (3.0 - 2.0 * c);
}

float frontLobe(float r, float R, float th) {
  float band = (r - R) / th;
  return band * exp(-band * band);
}

float frontEnergy(float r, float R, float th) {
  float band = (r - R) / th;
  return exp(-band * band);
}
`;

const QUAKE_WARP = `
vec2 quakeWarp(vec2 pos, vec2 center, float age, float seed, float sc, float maxR, float ampP, float ampS,
  out float leadEdge) {
  leadEdge = 0.0;
  if (age >= EVENT_SECONDS) return vec2(0.0);

  vec2 d = pos - center;
  float r = max(length(d), 1e-3);
  vec2 dir = d / r;
  vec2 perp = vec2(-dir.y, dir.x);
  float ang = atan(d.y, d.x);

  float tail = 1.0 - qEase((age - EVENT_SECONDS * 0.60) / (EVENT_SECONDS * 0.40));
  float spread = 1.0 / (1.0 + r / (240.0 * sc));

  float tp = age;
  float Rp = P_SPEED * sc * tp;
  float thP = mix(18.0, 11.0, qEase(tp / EVENT_SECONDS)) * sc;
  float fadeP = 1.0 - qEase((Rp - maxR * 0.48) / (maxR * 0.52));
  float gainP = ampP * sc * qEase(tp / 0.12) * spread * tail * fadeP;

  float ts = max(age - S_DELAY, 0.0);
  float Rs = S_SPEED * sc * ts;
  float thS = mix(50.0, 33.0, qEase(ts / EVENT_SECONDS)) * sc;
  float lobe = 0.76 + 0.24 * sin(ang * 3.0 + seed * 5.0);
  float fadeS = 1.0 - qEase((Rs - maxR * 0.52) / (maxR * 0.48));
  float gainS = ampS * sc * qEase(ts / 0.24) * spread * tail * fadeS * lobe;

  leadEdge = frontEnergy(r, Rp, thP) * fadeP * tail * qEase(tp / 0.12);

  return dir * frontLobe(r, Rp, thP) * gainP + perp * frontLobe(r, Rs, thS) * gainS;
}
`;

export const PULSE_QUAKE_FIELD_FRAG = `#version 300 es
precision highp float;

uniform sampler2D uField;
uniform vec2 uCssSize;
uniform int uQuakeCount;
uniform vec2 uQuakeCenter[3];
uniform float uQuakeAge[3];
uniform float uQuakeSeed[3];

in vec2 vUv;
out vec4 outColor;
${QUAKE_HELPERS}
${QUAKE_WARP}
void main() {
  float sc = clamp(min(uCssSize.x, uCssSize.y) / 300.0, 0.5, 2.5);
  float maxR = length(uCssSize) * 0.74;
  vec2 pos = vec2(vUv.x, 1.0 - vUv.y) * uCssSize;

  vec2 warp = vec2(0.0);
  float lead = 0.0;
  for (int i = 0; i < 3; i++) {
    if (i >= uQuakeCount) break;
    float edge = 0.0;
    warp += quakeWarp(pos, uQuakeCenter[i], uQuakeAge[i], uQuakeSeed[i], sc, maxR, 27.0, 41.0, edge);
    lead += edge;
  }

  vec2 uv = clamp(vUv + vec2(warp.x / uCssSize.x, -warp.y / uCssSize.y), 0.0, 1.0);
  float base = texture(uField, uv).r;
  float value = clamp(base + min(lead, 1.0) * 0.09, 0.0, 1.0);
  outColor = vec4(vec3(value), 1.0);
}
`;

export const PULSE_QUAKE_POST_FRAG = `#version 300 es
precision highp float;

uniform sampler2D uSrc;
uniform vec2 uCssSize;
uniform int uQuakeCount;
uniform vec2 uQuakeCenter[3];
uniform float uQuakeAge[3];
uniform float uQuakeSeed[3];

in vec2 vUv;
out vec4 outColor;
${QUAKE_HELPERS}
${QUAKE_WARP}
void main() {
  float sc = clamp(min(uCssSize.x, uCssSize.y) / 300.0, 0.5, 2.5);
  float maxR = length(uCssSize) * 0.74;
  vec2 pos = vec2(vUv.x, 1.0 - vUv.y) * uCssSize;

  vec2 warp = vec2(0.0);
  for (int i = 0; i < 3; i++) {
    if (i >= uQuakeCount) break;
    float edge = 0.0;
    warp += quakeWarp(pos, uQuakeCenter[i], uQuakeAge[i], uQuakeSeed[i], sc, maxR, 9.0, 14.0, edge);
  }

  vec2 uv = clamp(vUv + vec2(warp.x / uCssSize.x, -warp.y / uCssSize.y), 0.0, 1.0);
  outColor = texture(uSrc, uv);
}
`;
