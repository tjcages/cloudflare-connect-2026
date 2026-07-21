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

const float TAU = 6.2831853;

void main() {
  float sc = clamp(min(uCssSize.x, uCssSize.y) / 300.0, 0.6, 2.5);
  vec2 pos = vec2(vUv.x, 1.0 - vUv.y) * uCssSize;

  vec2 warp = vec2(0.0);
  float add = 0.0;
  float dim = 0.0;

  for (int i = 0; i < ${CONSTELLATION_MAX_LINES}; i++) {
    if (i >= uLineCount) break;
    vec4 seg = uLineSeg[i];
    vec2 fx = uLineFx[i];
    vec2 a = seg.xy * uCssSize;
    vec2 b = seg.zw * uCssSize;
    vec2 pa = pos - a;
    vec2 ba = b - a;
    float len2 = max(dot(ba, ba), 1e-4);
    float h = clamp(dot(pa, ba) / len2, 0.0, 1.0);
    vec2 off = pa - ba * h;
    float d = length(off);
    float flash = fx.y;
    float lw = (2.9 + 1.8 * flash) * sc;
    float reach = lw * 6.4;
    if (d > reach) continue;
    float alpha = fx.x * smoothstep(0.0, 0.05, h) * smoothstep(1.0, 0.95, h);
    if (alpha < 0.004) continue;
    vec2 tng = ba * inversesqrt(len2);
    vec2 nrm = vec2(-tng.y, tng.x);
    float side = dot(off, nrm) >= 0.0 ? 1.0 : -1.0;
    float t = d / reach;
    float prof = exp(-t * t * 2.4);
    float amp = (13.5 + 10.0 * flash) * sc * alpha;
    warp += (nrm * 1.05 + tng * 0.3) * side * amp * prof;
    float shimmer = 0.94 + 0.06 * sin(uTime * 1.7 + (a.x + b.y) * 0.045);
    float core = smoothstep(lw * 0.92, lw * 0.1, d);
    float halo = smoothstep(lw * 2.1, lw * 0.85, d) * (1.0 - core);
    add += (core * (1.55 + 1.2 * flash) + halo * 0.4) * alpha * shimmer;
    float groove = smoothstep(lw * 4.6, lw * 1.6, d) * (1.0 - core) * (1.0 - 0.45 * halo);
    dim += groove * alpha * (1.05 + 0.35 * flash);
  }

  for (int i = 0; i < ${CONSTELLATION_STAR_COUNT}; i++) {
    vec4 s = texelFetch(uStars, ivec2(i, 0), 0);
    vec2 sp = s.xy * uCssSize;
    vec2 q = pos - sp;
    float d = length(q);
    float near = smoothstep(uLinkRadius, uLinkRadius * 0.25, distance(sp, uCursor)) * uCursorFade;
    float speed = 0.6 + fract(s.z * 13.71 + s.w * 3.93) * 1.7;
    float tw = 0.82 + 0.18 * sin(uTime * speed + s.w * TAU);
    float rc = (2.2 + 1.7 * s.z) * sc * (1.0 + 0.22 * near) * (0.95 + 0.05 * tw);
    float reach = rc * 4.4;
    if (d > reach) continue;
    vec2 dir = d > 1e-4 ? q / d : vec2(0.0);
    float t = d / reach;
    float push = (1.9 + 1.5 * s.z) * sc * (1.0 + 0.55 * near);
    warp += dir * push * 3.3 * t * exp(-t * t * 2.0);
    add += smoothstep(rc, rc * 0.28, d) * (0.92 + 0.16 * tw);
    float spikeX = exp(-abs(q.y) / (rc * 0.16)) * exp(-abs(q.x) / (rc * 1.35));
    float spikeY = exp(-abs(q.x) / (rc * 0.16)) * exp(-abs(q.y) / (rc * 1.35));
    add += (spikeX + spikeY) * tw * (0.24 + 0.22 * near);
    float ring = smoothstep(rc * 2.9, rc * 1.5, d) * smoothstep(rc * 0.95, rc * 1.3, d);
    dim += ring * (0.42 + 0.14 * near);
  }

  vec2 uv = clamp(vUv + vec2(warp.x / uCssSize.x, -warp.y / uCssSize.y), 0.0, 1.0);
  float base = texture(uField, uv).r;
  float value = clamp(base * (1.0 - min(dim, 0.9)) + add, 0.0, 1.0);
  outColor = vec4(vec3(value), 1.0);
}
`;
