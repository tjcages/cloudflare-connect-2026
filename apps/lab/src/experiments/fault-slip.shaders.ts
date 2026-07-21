const FAULT_HELPERS = `
const float TAU = 6.2831853;

float slipEnvelope(float localAge, float creepSec, float phase) {
  if (localAge <= 0.0) return 0.0;
  float rise = 1.0 - pow(1.0 - clamp(localAge / 0.19, 0.0, 1.0), 3.0);
  float x = clamp((localAge - 0.26) / max(creepSec, 0.5), 0.0, 1.0);
  float creep = 1.0 - smoothstep(0.0, 1.0, x);
  creep *= 1.0 + 0.11 * sin(x * 8.0 + phase * TAU) * (1.0 - x);
  creep += 0.05 * sin(x * 17.0 + phase * 23.0) * (1.0 - x) * x;
  return rise * clamp(creep, 0.0, 1.2);
}
`;

export const FAULT_FIELD_FRAG = `#version 300 es
precision highp float;

uniform sampler2D uField;
uniform vec2 uCssSize;
uniform int uEventCount;
uniform vec4 uEventBounds[3];
uniform vec4 uEventMeta[3];
uniform vec4 uSeg[30];
uniform vec4 uSegT[30];

in vec2 vUv;
out vec4 outColor;
${FAULT_HELPERS}
void main() {
  float sc = clamp(min(uCssSize.x, uCssSize.y) / 300.0, 0.5, 2.5);
  vec2 pos = vec2(vUv.x, 1.0 - vUv.y) * uCssSize;

  vec2 slip = vec2(0.0);
  float seam = 0.0;

  for (int e = 0; e < 3; e++) {
    if (e >= uEventCount) break;
    vec4 bounds = uEventBounds[e];
    vec2 toCenter = pos - bounds.xy;
    if (dot(toCenter, toCenter) > bounds.z * bounds.z) continue;
    float age = bounds.w;
    vec4 meta = uEventMeta[e];

    for (int j = 0; j < 10; j++) {
      int idx = e * 10 + j;
      vec4 s = uSeg[idx];
      vec4 p = uSegT[idx];
      if (age <= p.x) continue;

      float prog = clamp((age - p.x) / max(p.y - p.x, 1e-4), 0.0, 1.0);
      vec2 a = s.xy;
      vec2 full = s.zw - a;
      float len = max(length(full), 1e-4);
      vec2 tangent = full / len;
      vec2 ab = full * prog;
      float l2 = max(dot(ab, ab), 1e-4);
      float u = clamp(dot(pos - a, ab) / l2, 0.0, 1.0);
      float uFull = u * prog;

      float w = mix(p.z, p.w, uFull);
      if (w <= 0.003) continue;

      vec2 rel = pos - (a + full * uFull);
      float dist = length(rel);
      float influence = (14.0 + 20.0 * w) * sc;
      if (dist > influence * 2.0) continue;

      float env = slipEnvelope(age - mix(p.x, p.y, uFull), meta.y, meta.z);
      if (env <= 0.002) continue;

      float fall = exp(-(dist * dist) / (influence * influence));
      float side = clamp((tangent.x * rel.y - tangent.y * rel.x) / (0.9 * sc), -1.0, 1.0);
      slip += tangent * (11.0 * sc * meta.x * w * env * fall) * side;

      float seamWidth = (1.1 + 1.0 * w) * sc;
      seam = max(seam, (1.0 - smoothstep(seamWidth * 0.35, seamWidth, dist)) * env * w);
    }
  }

  vec2 uv = clamp(vUv - vec2(slip.x / uCssSize.x, -slip.y / uCssSize.y), 0.0, 1.0);
  float base = texture(uField, uv).r;
  outColor = vec4(vec3(clamp(base * (1.0 - clamp(seam * 0.5, 0.0, 0.86)), 0.0, 1.0)), 1.0);
}
`;

export const FAULT_POST_FRAG = `#version 300 es
precision highp float;

uniform sampler2D uSrc;
uniform vec2 uCssSize;
uniform int uEventCount;
uniform vec4 uEventBounds[3];
uniform vec4 uEventMeta[3];
uniform vec4 uSeg[30];
uniform vec4 uSegT[30];

in vec2 vUv;
out vec4 outColor;
${FAULT_HELPERS}
void main() {
  float sc = clamp(min(uCssSize.x, uCssSize.y) / 300.0, 0.5, 2.5);
  vec2 pos = vec2(vUv.x, 1.0 - vUv.y) * uCssSize;
  vec2 crease = vec2(0.0);

  for (int e = 0; e < 3; e++) {
    if (e >= uEventCount) break;
    vec4 bounds = uEventBounds[e];
    vec2 toCenter = pos - bounds.xy;
    if (dot(toCenter, toCenter) > bounds.z * bounds.z) continue;
    float age = bounds.w;
    vec4 meta = uEventMeta[e];

    for (int j = 0; j < 10; j++) {
      int idx = e * 10 + j;
      vec4 s = uSeg[idx];
      vec4 p = uSegT[idx];
      if (age <= p.x) continue;

      float prog = clamp((age - p.x) / max(p.y - p.x, 1e-4), 0.0, 1.0);
      vec2 a = s.xy;
      vec2 full = s.zw - a;
      vec2 ab = full * prog;
      float l2 = max(dot(ab, ab), 1e-4);
      float u = clamp(dot(pos - a, ab) / l2, 0.0, 1.0);
      float uFull = u * prog;

      float w = mix(p.z, p.w, uFull);
      if (w <= 0.003) continue;

      vec2 rel = pos - (a + full * uFull);
      float dist = length(rel);
      float influence = 16.0 * sc;
      if (dist > influence * 2.0) continue;

      float env = slipEnvelope(age - mix(p.x, p.y, uFull), meta.y, meta.z);
      if (env <= 0.002) continue;

      vec2 n = dist > 1e-4 ? rel / dist : vec2(0.0);
      float fall = exp(-(dist * dist) / (influence * influence));
      crease -= n * (1.7 * sc * meta.x * w * env * fall);
    }
  }

  vec2 uv = clamp(vUv + vec2(crease.x / uCssSize.x, -crease.y / uCssSize.y), 0.0, 1.0);
  outColor = texture(uSrc, uv);
}
`;
