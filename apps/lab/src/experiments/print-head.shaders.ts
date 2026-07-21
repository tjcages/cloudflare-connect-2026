export const PRINT_HEAD_BAKE_FRAG = `#version 300 es
precision highp float;
in vec2 vUv;
uniform sampler2D uField;
uniform sampler2D uPrev;
uniform float uPrevCommitT;
uniform float uCommitT;
out vec4 outColor;

void main() {
  float t = 1.0 - vUv.y;
  float commit = step(uPrevCommitT, t) * step(t, uCommitT);
  float fieldV = texture(uField, vUv).r;
  float prevV = texture(uPrev, vUv).r;
  outColor = vec4(vec3(mix(prevV, fieldV, commit)), 1.0);
}
`;

export const PRINT_HEAD_COMPOSITE_FRAG = `#version 300 es
precision highp float;
in vec2 vUv;
uniform sampler2D uField;
uniform sampler2D uAccum;
uniform float uHeadT;
uniform float uCommitT;
uniform float uSettleT;
uniform float uJitterU;
uniform float uRowCount;
uniform float uCssH;
uniform float uTime;
uniform float uSeed;
uniform float uHeadAlpha;
out vec4 outColor;

float hash21(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

float vnoise1(float x) {
  float i = floor(x);
  float f = fract(x);
  float u = f * f * (3.0 - 2.0 * f);
  return mix(hash21(vec2(i, 3.7)), hash21(vec2(i + 1.0, 3.7)), u);
}

void main() {
  float t = 1.0 - vUv.y;
  float base;
  if (t < uCommitT) {
    base = texture(uAccum, vUv).r;
  } else if (t < uHeadT) {
    float ageN = clamp((uHeadT - t) / max(uSettleT, 1e-5), 0.0, 1.0);
    float decay = pow(1.0 - ageN, 3.0);
    float row = floor(t * uRowCount);
    float land = hash21(vec2(row, uSeed)) * 2.0 - 1.0;
    float trem = vnoise1(row * 37.71 + uSeed + uTime * 24.0) * 2.0 - 1.0;
    float off = uJitterU * decay * (0.85 * land + 0.5 * trem);
    base = texture(uField, vec2(clamp(vUv.x + off, 0.0, 1.0), vUv.y)).r;
    base = clamp(base + 0.18 * decay * decay, 0.0, 1.0);
  } else {
    base = 0.0;
  }
  float d = (t - uHeadT) * uCssH;
  float core = exp(-d * d * 0.055);
  float up = d < 0.0 ? exp(d * 0.12) : 0.0;
  float spill = d > 0.0 ? exp(-d * 0.35) : 0.0;
  float energy = 0.9 + 0.1 * vnoise1(uTime * 27.0);
  float shim = 0.82 + 0.18 * vnoise1(vUv.x * 90.0 + uTime * 21.0);
  float head = uHeadAlpha * energy * (core * shim + up * 0.3 * shim + spill * 0.12);
  outColor = vec4(vec3(clamp(base + head, 0.0, 1.0)), 1.0);
}
`;
