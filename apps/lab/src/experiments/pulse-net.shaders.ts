export const PULSE_NET_STAR_COUNT = 42;
export const PULSE_NET_MAX_LINES = 48;
export const PULSE_NET_MAX_PULSES = 20;

export const PULSE_NET_FRAG = `#version 300 es
precision highp float;

uniform sampler2D uField;
uniform sampler2D uStars;
uniform vec2 uCssSize;
uniform vec2 uCursor;
uniform float uCursorFade;
uniform float uLinkRadius;
uniform float uTime;
uniform int uLineCount;
uniform int uPulseCount;
uniform vec4 uLineSeg[${PULSE_NET_MAX_LINES}];
uniform float uLineAlpha[${PULSE_NET_MAX_LINES}];
uniform vec4 uPulseSeg[${PULSE_NET_MAX_PULSES}];
uniform vec2 uPulseFx[${PULSE_NET_MAX_PULSES}];
uniform float uStarAct[${PULSE_NET_STAR_COUNT}];
uniform float uStarFlare[${PULSE_NET_STAR_COUNT}];

in vec2 vUv;
out vec4 outColor;

const float TAU = 6.2831853;

void main() {
  float sc = clamp(min(uCssSize.x, uCssSize.y) / 300.0, 0.6, 2.5);
  vec2 pos = vec2(vUv.x, 1.0 - vUv.y) * uCssSize;

  vec2 warp = vec2(0.0);
  float add = 0.0;
  float dim = 0.0;

  for (int i = 0; i < ${PULSE_NET_MAX_LINES}; i++) {
    if (i >= uLineCount) break;
    vec4 seg = uLineSeg[i];
    vec2 a = seg.xy * uCssSize;
    vec2 b = seg.zw * uCssSize;
    vec2 pa = pos - a;
    vec2 ba = b - a;
    float len2 = max(dot(ba, ba), 1e-4);
    float h = clamp(dot(pa, ba) / len2, 0.0, 1.0);
    vec2 off = pa - ba * h;
    float d = length(off);
    float lw = 2.9 * sc;
    float reach = lw * 6.4;
    if (d > reach) continue;
    float alpha = uLineAlpha[i] * smoothstep(0.0, 0.05, h) * smoothstep(1.0, 0.95, h);
    if (alpha < 0.004) continue;
    vec2 tng = ba * inversesqrt(len2);
    vec2 nrm = vec2(-tng.y, tng.x);
    float side = dot(off, nrm) >= 0.0 ? 1.0 : -1.0;
    float t = d / reach;
    float prof = exp(-t * t * 2.4);
    float amp = 13.0 * sc * alpha;
    warp += (nrm * 1.05 + tng * 0.3) * side * amp * prof;
    float shimmer = 0.94 + 0.06 * sin(uTime * 1.6 + (a.x + b.y) * 0.045);
    float core = smoothstep(lw * 0.92, lw * 0.1, d);
    float halo = smoothstep(lw * 2.1, lw * 0.85, d) * (1.0 - core);
    add += (core * 1.5 + halo * 0.38) * alpha * shimmer;
    float groove = smoothstep(lw * 4.6, lw * 1.6, d) * (1.0 - core) * (1.0 - 0.45 * halo);
    dim += groove * alpha * 1.05;
  }

  for (int i = 0; i < ${PULSE_NET_MAX_PULSES}; i++) {
    if (i >= uPulseCount) break;
    vec4 seg = uPulseSeg[i];
    vec2 fx = uPulseFx[i];
    vec2 a = seg.xy * uCssSize;
    vec2 b = seg.zw * uCssSize;
    vec2 ba = b - a;
    float len = max(length(ba), 1e-3);
    vec2 tng = ba / len;
    vec2 nrm = vec2(-tng.y, tng.x);
    vec2 pa = pos - a;
    float along = dot(pa, tng);
    float perp = dot(pa, nrm);
    float wid = 3.0 * sc;
    if (abs(perp) > wid * 6.0) continue;
    float coreLen = 3.4 * sc;
    float tailLen = 27.0 * sc;
    float s = along - fx.x * len;
    if (s > coreLen * 3.0 || s < -tailLen * 1.7) continue;
    if (along < -coreLen * 2.0 || along > len + coreLen * 2.0) continue;
    float lateral = exp(-(perp * perp) / (wid * wid));
    float core = exp(-(s * s) / (coreLen * coreLen));
    float tail = s < 0.0 ? exp(s / tailLen) * (1.0 - core) : 0.0;
    add += (core * 2.1 + tail * 0.6) * lateral * fx.y;
    float side = perp >= 0.0 ? 1.0 : -1.0;
    float spread = exp(-(perp * perp) / (wid * wid * 22.0));
    float push = (core + 0.45 * tail) * spread * fx.y;
    warp += (nrm * side * 1.15 + tng * 0.22) * push * 15.5 * sc;
    dim += smoothstep(wid * 5.5, wid * 1.5, abs(perp)) * (core + 0.55 * tail) * fx.y * 0.72;
  }

  for (int i = 0; i < ${PULSE_NET_STAR_COUNT}; i++) {
    vec4 s = texelFetch(uStars, ivec2(i, 0), 0);
    vec2 sp = s.xy * uCssSize;
    vec2 q = pos - sp;
    float d = length(q);
    float near = smoothstep(uLinkRadius, uLinkRadius * 0.25, distance(sp, uCursor)) * uCursorFade;
    float speed = 0.6 + fract(s.z * 13.71 + s.w * 3.93) * 1.7;
    float tw = 0.82 + 0.18 * sin(uTime * speed + s.w * TAU);
    float grow = clamp(uStarAct[i], 0.0, 1.0);
    float flare = clamp(uStarFlare[i], 0.0, 1.0);
    float rcBase = (2.2 + 1.7 * s.z) * sc * (1.0 + 0.22 * near) * (0.95 + 0.05 * tw);
    float reach = rcBase * 4.4 * (1.0 + 0.6 * flare);
    if (d > reach) continue;
    vec2 dir = d > 1e-4 ? q / d : vec2(0.0);
    float t = d / reach;
    float push = (1.9 + 1.5 * s.z) * sc * (1.0 + 0.55 * near + 1.1 * flare);
    warp += dir * push * 3.3 * t * exp(-t * t * 2.0);
    float rc = rcBase * (1.0 + 1.2 * grow + 0.85 * flare);
    add += smoothstep(rc, rc * mix(0.28, 0.6, max(grow, flare)), d) * (0.92 + 0.16 * tw) * (1.0 + 0.55 * flare);
    float spikeX = exp(-abs(q.y) / (rc * 0.16)) * exp(-abs(q.x) / (rc * 1.35));
    float spikeY = exp(-abs(q.x) / (rc * 0.16)) * exp(-abs(q.y) / (rc * 1.35));
    add += (spikeX + spikeY) * tw * (0.24 + 0.22 * near + 0.62 * flare);
    float ring = smoothstep(rcBase * 2.9, rcBase * 1.5, d) * smoothstep(rcBase * 0.95, rcBase * 1.3, d);
    dim += ring * (0.42 + 0.14 * near + 0.3 * flare);
  }

  vec2 uv = clamp(vUv + vec2(warp.x / uCssSize.x, -warp.y / uCssSize.y), 0.0, 1.0);
  float base = texture(uField, uv).r;
  float value = clamp(base * (1.0 - min(dim, 0.9)) + add, 0.0, 1.0);
  outColor = vec4(vec3(value), 1.0);
}
`;
