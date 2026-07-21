const GLASS_HELPERS = `
const float TAU = 6.2831853;

float glassEase(float x) {
  float inv = 1.0 - clamp(x, 0.0, 1.0);
  return 1.0 - inv * inv * inv;
}

float glassEnv(float localAge, float phase) {
  if (localAge <= 0.0) return 0.0;
  float rise = 1.0 - exp(-localAge / 0.055);
  float hold = 0.62 + 0.30 * fract(phase * 1.618);
  float closeSec = 2.10 + 0.90 * fract(phase * 2.713 + 0.37);
  float x = clamp((localAge - hold) / closeSec, 0.0, 1.0);
  float closing = 1.0 - glassEase(x);
  return rise * closing;
}

float glassJag(float u, float phase) {
  return max(0.42, 0.78 + 0.26 * sin(u * 24.0 + phase * 41.0) + 0.14 * sin(u * 61.0 - phase * 13.0));
}

vec2 glassHash(vec2 p) {
  vec3 a = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973));
  a += dot(a, a.yzx + 33.33);
  return fract((a.xx + a.yz) * a.zy);
}

void glassCraze(vec2 p, float cell, out vec2 dir, out float edge) {
  vec2 sp = p / max(cell, 1.0);
  vec2 g = floor(sp);
  vec2 f = sp - g;
  float d1 = 8.0;
  float d2 = 8.0;
  vec2 best = g;
  for (int y = -1; y <= 1; y++) {
    for (int x = -1; x <= 1; x++) {
      vec2 o = vec2(float(x), float(y));
      vec2 c = o + glassHash(g + o);
      float d = length(c - f);
      if (d < d1) {
        d2 = d1;
        d1 = d;
        best = g + o;
      } else if (d < d2) {
        d2 = d;
      }
    }
  }
  vec2 h = glassHash(best + 7.13) - 0.5;
  float len = max(length(h), 1e-4);
  dir = h / len;
  edge = d2 - d1;
}
`;

export const GLASS_FIELD_FRAG = `#version 300 es
precision highp float;

uniform sampler2D uField;
uniform vec2 uCssSize;
uniform int uEventCount;
uniform vec4 uEventBounds[3];
uniform vec4 uEventShape[3];
uniform vec4 uSeg[72];
uniform vec4 uSegT[72];

in vec2 vUv;
out vec4 outColor;
${GLASS_HELPERS}
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
    float distCenter = length(toCenter);
    if (distCenter > bounds.z) continue;
    float age = bounds.w;
    vec4 shape = uEventShape[e];

    if (distCenter < shape.x) {
      float crazeEnv = glassEnv(age, shape.y);
      if (crazeEnv > 0.002) {
        vec2 dir;
        float edge;
        glassCraze(pos + vec2(shape.y * 131.0, shape.y * 79.0), shape.z, dir, edge);
        float k = (1.0 - smoothstep(shape.x * 0.30, shape.x, distCenter)) * crazeEnv;
        push += dir * 3.4 * sc * k;
        seam = max(seam, (1.0 - smoothstep(0.03, 0.20, edge)) * k * 0.80);
      }
    }

    for (int j = 0; j < 24; j++) {
      int idx = e * 24 + j;
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

      float w = abs(p.z);
      float taper = p.z > 0.0 ? 1.0 - 0.48 * u * prog : 1.0;
      float influence = (18.0 + 34.0 * w) * sc;
      if (dist > influence * 1.9) continue;

      float env = glassEnv(age - mix(p.x, p.y, u * prog), p.w);
      if (env <= 0.002) continue;

      float gap = 9.5 * sc * w * taper * env * glassJag(u, p.w);
      float fall = exp(-(dist * dist) / (influence * influence));
      vec2 n = dist > 1e-4 ? rel / dist : vec2(0.0, 0.0);
      push += n * gap * fall * 1.30;
      if (gap > 0.4) seam = max(seam, 1.0 - smoothstep(gap * 0.68, gap * 1.28, dist));

      if (prog < 1.0) {
        float dt = length(pos - b);
        float rt = 9.0 * sc;
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

export const GLASS_POST_FRAG = `#version 300 es
precision highp float;

uniform sampler2D uSrc;
uniform vec2 uCssSize;
uniform int uEventCount;
uniform vec4 uEventBounds[3];
uniform vec4 uEventShape[3];

in vec2 vUv;
out vec4 outColor;
${GLASS_HELPERS}
void main() {
  float sc = clamp(min(uCssSize.x, uCssSize.y) / 300.0, 0.5, 2.5);
  vec2 pos = vec2(vUv.x, 1.0 - vUv.y) * uCssSize;
  vec2 offset = vec2(0.0);

  for (int e = 0; e < 3; e++) {
    if (e >= uEventCount) break;
    vec4 bounds = uEventBounds[e];
    vec4 shape = uEventShape[e];
    vec2 toCenter = pos - bounds.xy;
    float distCenter = length(toCenter);
    float outer = shape.x * 1.18;
    if (distCenter > outer) continue;

    float env = glassEnv(bounds.w, shape.y);
    if (env <= 0.002) continue;

    vec2 dir;
    float edge;
    glassCraze(pos + vec2(shape.y * 131.0, shape.y * 79.0), shape.z, dir, edge);
    float k = (1.0 - smoothstep(shape.x * 0.24, outer, distCenter)) * env;
    offset += dir * 1.9 * sc * k;

    vec2 radial = distCenter > 1e-4 ? toCenter / distCenter : vec2(0.0, 0.0);
    float lens = sin(clamp(distCenter / max(outer, 1.0), 0.0, 1.0) * TAU * 0.5);
    offset += radial * 1.4 * sc * lens * env;
  }

  vec2 uv = clamp(vUv + vec2(offset.x / uCssSize.x, -offset.y / uCssSize.y), 0.0, 1.0);
  outColor = texture(uSrc, uv);
}
`;
