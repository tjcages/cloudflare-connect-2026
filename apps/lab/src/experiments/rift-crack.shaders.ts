const RIFT_HELPERS = `
const float TAU = 6.2831853;

float riftEnvelope(float localAge, float phase) {
  if (localAge <= 0.0) return 0.0;
  float rise = 1.0 - exp(-localAge / 0.085);
  float closeSec = 1.9 + 1.1 * fract(phase * 1.618);
  float x = clamp((localAge - 0.30) / closeSec, 0.0, 1.0);
  x = clamp(x + 0.10 * sin(x * 7.0 + phase * TAU) * (1.0 - x), 0.0, 1.0);
  float closing = 1.0 - smoothstep(0.0, 1.0, x);
  return rise * pow(closing, 1.15);
}

float riftJag(float u, float phase) {
  return max(0.35, 0.72 + 0.34 * sin(u * 21.0 + phase * 37.0) + 0.16 * sin(u * 53.0 - phase * 11.0));
}
`;

export const RIFT_FIELD_FRAG = `#version 300 es
precision highp float;

uniform sampler2D uField;
uniform vec2 uCssSize;
uniform int uEventCount;
uniform vec4 uEventBounds[3];
uniform vec4 uSeg[54];
uniform vec4 uSegT[54];

in vec2 vUv;
out vec4 outColor;
${RIFT_HELPERS}
void main() {
  float sc = clamp(min(uCssSize.x, uCssSize.y) / 300.0, 0.5, 2.5);
  vec2 pos = vec2(vUv.x, 1.0 - vUv.y) * uCssSize;

  vec2 push = vec2(0.0);
  float seam = 0.0;
  float tip = 0.0;

  for (int e = 0; e < 3; e++) {
    if (e >= uEventCount) break;
    vec4 bounds = uEventBounds[e];
    vec2 toCenter = pos - bounds.xy;
    if (dot(toCenter, toCenter) > bounds.z * bounds.z) continue;
    float age = bounds.w;

    for (int j = 0; j < 18; j++) {
      int idx = e * 18 + j;
      vec4 s = uSeg[idx];
      vec4 p = uSegT[idx];
      if (age <= p.x) continue;

      float prog = clamp((age - p.x) / max(p.y - p.x, 1e-4), 0.0, 1.0);
      vec2 a = s.xy;
      vec2 b = mix(s.xy, s.zw, prog);
      vec2 ab = b - a;
      float l2 = max(dot(ab, ab), 1e-4);
      float u = clamp(dot(pos - a, ab) / l2, 0.0, 1.0);
      vec2 rel = pos - (a + ab * u);
      float dist = length(rel);

      float w = p.z;
      float influence = (24.0 + 40.0 * w) * sc;
      if (dist > influence * 2.0) continue;

      float env = riftEnvelope(age - mix(p.x, p.y, u * prog), p.w);
      if (env <= 0.002) continue;

      float gap = 11.0 * sc * w * env * riftJag(u, p.w);
      float fall = exp(-(dist * dist) / (influence * influence));
      vec2 n = dist > 1e-4 ? rel / dist : vec2(0.0, 0.0);
      push += n * gap * fall * 1.35;
      if (gap > 0.4) seam = max(seam, 1.0 - smoothstep(gap * 0.70, gap * 1.30, dist));

      if (prog < 1.0) {
        float dt = length(pos - b);
        float rt = 10.0 * sc;
        tip += exp(-(dt * dt) / (rt * rt)) * (1.0 - prog) * w;
      }
    }
  }

  vec2 uv = clamp(vUv - vec2(push.x / uCssSize.x, -push.y / uCssSize.y), 0.0, 1.0);
  float base = texture(uField, uv).r;
  float value = base * (1.0 - clamp(seam, 0.0, 0.94)) + min(tip, 1.0) * 0.5;
  outColor = vec4(vec3(clamp(value, 0.0, 1.0)), 1.0);
}
`;

export const RIFT_POST_FRAG = `#version 300 es
precision highp float;

uniform sampler2D uSrc;
uniform vec2 uCssSize;
uniform int uEventCount;
uniform vec4 uEventBounds[3];
uniform vec4 uSeg[54];
uniform vec4 uSegT[54];

in vec2 vUv;
out vec4 outColor;
${RIFT_HELPERS}
void main() {
  float sc = clamp(min(uCssSize.x, uCssSize.y) / 300.0, 0.5, 2.5);
  vec2 pos = vec2(vUv.x, 1.0 - vUv.y) * uCssSize;
  vec2 shear = vec2(0.0);

  for (int e = 0; e < 3; e++) {
    if (e >= uEventCount) break;
    vec4 bounds = uEventBounds[e];
    vec2 toCenter = pos - bounds.xy;
    if (dot(toCenter, toCenter) > bounds.z * bounds.z) continue;
    float age = bounds.w;

    for (int j = 0; j < 12; j++) {
      int idx = e * 18 + j;
      vec4 s = uSeg[idx];
      vec4 p = uSegT[idx];
      if (age <= p.x) continue;

      float prog = clamp((age - p.x) / max(p.y - p.x, 1e-4), 0.0, 1.0);
      vec2 a = s.xy;
      vec2 b = mix(s.xy, s.zw, prog);
      vec2 ab = b - a;
      float l2 = max(dot(ab, ab), 1e-4);
      float u = clamp(dot(pos - a, ab) / l2, 0.0, 1.0);
      vec2 rel = pos - (a + ab * u);
      float dist = length(rel);

      float influence = 30.0 * sc;
      if (dist > influence * 2.0) continue;

      float env = riftEnvelope(age - mix(p.x, p.y, u * prog), p.w);
      if (env <= 0.002) continue;

      vec2 tangent = ab / sqrt(l2);
      float side = tangent.x * rel.y - tangent.y * rel.x;
      float slip = 4.5 * sc * p.z * env * exp(-(dist * dist) / (influence * influence));
      shear += tangent * slip * (side >= 0.0 ? 1.0 : -1.0);
    }
  }

  vec2 uv = clamp(vUv + vec2(shear.x / uCssSize.x, -shear.y / uCssSize.y), 0.0, 1.0);
  outColor = texture(uSrc, uv);
}
`;
