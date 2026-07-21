export const SONAR_LENS_REVEAL_FRAG = `#version 300 es
precision highp float;
in vec2 vUv;
uniform sampler2D uField;
uniform int uRingCount;
uniform vec4 uRings[12];
uniform vec2 uRingMeta[12];
uniform vec4 uFlash;
uniform float uAspect;
uniform float uTime;
uniform vec2 uGrain;
out vec4 outColor;

float hash21(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

float vnoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  float a = hash21(i);
  float b = hash21(i + vec2(1.0, 0.0));
  float c = hash21(i + vec2(0.0, 1.0));
  float d = hash21(i + vec2(1.0, 1.0));
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

void main() {
  vec2 p = vec2(vUv.x * uAspect, vUv.y);
  float tq = floor(uTime * 14.0) / 14.0;
  float grain = hash21(floor(vUv * uGrain) + vec2(tq * 61.7, tq * 47.3));
  float low = vnoise(p * 5.0 + vec2(uTime * 0.07, -uTime * 0.05));
  float staticV = 0.04 + 0.15 * low + 0.5 * pow(grain, 6.0);

  float reveal = 0.0;
  float crest = 0.0;
  for (int i = 0; i < 12; i++) {
    if (i >= uRingCount) break;
    vec4 ring = uRings[i];
    vec2 c = vec2(ring.x * uAspect, ring.y);
    vec2 rel = p - c;
    float d = length(rel);
    float ang = atan(rel.y, rel.x);
    float seed = uRingMeta[i].x;
    float widthScale = uRingMeta[i].y;
    float wob = (sin(ang * 5.0 + seed * 6.28 + uTime * 0.9) * 0.6 + sin(ang * 9.0 - seed * 9.42 + uTime * 1.4) * 0.4) *
      (0.004 + ring.z * 0.012);
    float rr = ring.z + wob;
    float frontW = 0.055 * widthScale;
    float front = exp(-pow((d - rr) / frontW, 2.0));
    float tail = d < rr ? exp(-(rr - d) / (0.16 * widthScale)) : 0.0;
    float lift = min(1.0, ring.w * max(front, tail * 0.88));
    reveal = 1.0 - (1.0 - reveal) * (1.0 - lift);
    crest += ring.w * exp(-pow((d - rr) / (0.012 * widthScale), 2.0));
  }

  float fieldV = texture(uField, vUv).r;
  float v = mix(staticV, fieldV, clamp(reveal, 0.0, 1.0));
  v += crest * 0.4;
  float fd = distance(p, vec2(uFlash.x * uAspect, uFlash.y));
  v += uFlash.z * exp(-pow(fd / max(uFlash.w, 1e-4), 2.0));
  outColor = vec4(vec3(clamp(v, 0.0, 1.0)), 1.0);
}
`;
