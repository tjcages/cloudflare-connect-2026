export const BURN_AWAY_FRAG = `#version 300 es
precision highp float;
in vec2 vUv;
uniform sampler2D uField;
uniform float uProgress;
uniform vec2 uDir;
uniform vec2 uSeed;
uniform float uAspect;
uniform float uTime;
uniform vec2 uCssSize;
out vec4 outColor;

const float IRR = 0.34;
const float PRE = 0.10;
const float RIM = 0.05;
const float SOOT = 0.24;

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
    p = p * 2.03 + vec2(17.13, 9.71);
    amp *= 0.5;
  }
  return v;
}

void main() {
  float image = texture(uField, vUv).r;
  vec2 p = vec2(vUv.x * uAspect, vUv.y);
  vec2 center = vec2(uAspect * 0.5, 0.5);
  float halfExtent = 0.5 * (uAspect * abs(uDir.x) + abs(uDir.y));
  float d01 = 0.5 + dot(p - center, uDir) / max(2.0 * halfExtent, 1e-4);
  float frontNoise = fbm(p * 3.1 + uSeed);
  float burnCoord = d01 + (frontNoise - 0.5) * IRR;
  float t = mix(-0.5 * IRR - PRE - 0.02, 1.0 + 0.5 * IRR + RIM + SOOT + 0.02, uProgress);
  float e = t - burnCoord;

  vec2 grainCell = floor(vUv * uCssSize / 8.0);
  float grain = hash21(grainCell + floor(uTime * 14.0) * vec2(7.31, 3.17));
  float staticV = 0.08 + 0.72 * grain;
  float scorch = smoothstep(-PRE, -0.005, e);
  float unburnedV = staticV * (1.0 - 0.82 * scorch);

  float charTex = 0.05 + 0.12 * vnoise(p * 16.0 + uSeed * 3.1);
  float sootAmt = smoothstep(0.0, RIM * 0.8, e) * (1.0 - smoothstep(RIM, RIM + SOOT, e));
  float burnedV = mix(image, charTex, sootAmt);

  float burnMask = smoothstep(-0.012, 0.012, e);
  float v = mix(unburnedV, burnedV, burnMask);

  float rx = (e - RIM * 0.5) / (RIM * 0.38);
  float rimShape = exp(-rx * rx);
  float alongFront = 0.7 + 0.3 * vnoise(p * 9.0 + uSeed * 1.7);
  float flicker = 0.78 + 0.22 * vnoise(p * 22.0 + vec2(uTime * 6.5, -uTime * 4.5));
  v = max(v, rimShape * alongFront * flicker);

  float speckSeed = hash21(floor(p * 40.0 + uSeed));
  float speckZone = smoothstep(0.0, RIM, e) * (1.0 - smoothstep(RIM, RIM + SOOT * 0.6, e));
  float speckFlicker = 0.6 + 0.4 * vnoise(p * 30.0 + vec2(uTime * 9.0, uTime * 7.0));
  v = max(v, step(0.965, speckSeed) * speckZone * speckFlicker * 0.9);

  outColor = vec4(vec3(v), 1.0);
}
`;
