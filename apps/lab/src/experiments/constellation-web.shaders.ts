export const CONSTELLATION_STAR_COUNT = 44;
export const CONSTELLATION_MAX_LINES = 48;

export const CONSTELLATION_WEB_FRAG = `#version 300 es
precision highp float;

uniform sampler2D uField;
uniform sampler2D uStars;
uniform vec2 uCssSize;
uniform vec2 uCursor;
uniform float uCursorFade;
uniform float uLinkRadius;
uniform float uTime;
uniform int uLineCount;
uniform vec4 uLineSeg[${CONSTELLATION_MAX_LINES}];
uniform vec2 uLineFx[${CONSTELLATION_MAX_LINES}];

in vec2 vUv;
out vec4 outColor;

void main() {
  vec2 pos = vec2(vUv.x, 1.0 - vUv.y) * uCssSize;
  float ghost = texture(uField, vUv).r * 0.12;

  float lineSum = 0.0;
  for (int i = 0; i < ${CONSTELLATION_MAX_LINES}; i++) {
    if (i >= uLineCount) break;
    vec4 seg = uLineSeg[i];
    vec2 fx = uLineFx[i];
    vec2 a = seg.xy * uCssSize;
    vec2 b = seg.zw * uCssSize;
    vec2 pa = pos - a;
    vec2 ba = b - a;
    float h = clamp(dot(pa, ba) / max(dot(ba, ba), 1e-4), 0.0, 1.0);
    float d = length(pa - ba * h);
    float w = 2.0 + 0.8 * fx.y;
    if (d > w + 2.0) continue;
    float body = smoothstep(w, w * 0.22, d);
    body *= smoothstep(0.0, 0.09, h) * smoothstep(1.0, 0.91, h);
    float shimmer = 0.88 + 0.12 * sin(uTime * 1.7 + (a.x + b.y) * 0.045);
    lineSum += body * fx.x * (1.0 + 0.6 * fx.y) * shimmer;
  }

  float starSum = 0.0;
  for (int i = 0; i < ${CONSTELLATION_STAR_COUNT}; i++) {
    vec4 s = texelFetch(uStars, ivec2(i, 0), 0);
    vec2 sp = s.xy * uCssSize;
    float radius = 2.1 + s.z * 2.1;
    float d = distance(pos, sp);
    if (d > radius + 1.5) continue;
    float speed = 0.6 + fract(s.z * 13.71 + s.w * 3.93) * 1.7;
    float twinkle = 0.78 + 0.22 * sin(uTime * speed + s.w * 6.2831853);
    float near = smoothstep(uLinkRadius, uLinkRadius * 0.3, distance(sp, uCursor)) * uCursorFade;
    starSum += smoothstep(radius, radius * 0.2, d) * twinkle * (0.6 + 0.3 * near);
  }

  outColor = vec4(vec3(min(1.0, ghost + lineSum + starSum)), 1.0);
}
`;
