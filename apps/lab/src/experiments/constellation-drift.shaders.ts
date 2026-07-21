export const DRIFT_STAR_COUNT = 40;
export const DRIFT_MAX_LINES = 14;

export const CONSTELLATION_DRIFT_FRAG = `#version 300 es
precision highp float;

uniform sampler2D uField;
uniform vec2 uCssSize;
uniform float uTime;
uniform int uLineCount;
uniform vec2 uStarPos[${DRIFT_STAR_COUNT}];
uniform vec2 uStarSeed[${DRIFT_STAR_COUNT}];
uniform float uStarAct[${DRIFT_STAR_COUNT}];
uniform vec4 uLineSeg[${DRIFT_MAX_LINES}];
uniform vec2 uLineFx[${DRIFT_MAX_LINES}];

in vec2 vUv;
out vec4 outColor;

const float TAU = 6.2831853;

void main() {
  float sc = clamp(min(uCssSize.x, uCssSize.y) / 300.0, 0.6, 2.5);
  vec2 pos = vec2(vUv.x, 1.0 - vUv.y) * uCssSize;

  vec2 warp = vec2(0.0);
  float add = 0.0;
  float dim = 0.0;

  for (int i = 0; i < ${DRIFT_MAX_LINES}; i++) {
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
    float lw = (2.8 + 1.2 * flash) * sc;
    float reach = lw * 6.0;
    if (d > reach) continue;
    float alpha = fx.x * smoothstep(0.0, 0.06, h) * smoothstep(1.0, 0.94, h);
    if (alpha < 0.004) continue;
    vec2 tng = ba * inversesqrt(len2);
    vec2 nrm = vec2(-tng.y, tng.x);
    float side = dot(off, nrm) >= 0.0 ? 1.0 : -1.0;
    float t = d / reach;
    float prof = exp(-t * t * 2.8);
    float amp = (10.4 + 5.6 * flash) * sc * alpha;
    warp += (nrm * 1.05 + tng * 0.24) * side * amp * prof;
    float shimmer = 0.95 + 0.05 * sin(uTime * 0.7 + (a.x + b.y) * 0.03);
    float core = smoothstep(lw * 0.92, lw * 0.1, d);
    float halo = smoothstep(lw * 2.1, lw * 0.85, d) * (1.0 - core);
    add += (core * (1.5 + 0.85 * flash) + halo * 0.38) * alpha * shimmer;
    float groove = smoothstep(lw * 4.4, lw * 1.55, d) * (1.0 - core) * (1.0 - 0.45 * halo);
    dim += groove * alpha * (1.02 + 0.28 * flash);
  }

  for (int i = 0; i < ${DRIFT_STAR_COUNT}; i++) {
    vec2 sp = uStarPos[i] * uCssSize;
    vec2 sd = uStarSeed[i];
    vec2 q = pos - sp;
    float d = length(q);
    float speed = 0.32 + fract(sd.x * 13.71 + sd.y * 3.93) * 0.62;
    float tw = 0.84 + 0.16 * sin(uTime * speed + sd.y * TAU);
    float rcBase = (2.1 + 1.6 * sd.x) * sc * (0.95 + 0.05 * tw);
    float reach = rcBase * 4.2;
    if (d > reach) continue;
    vec2 dir = d > 1e-4 ? q / d : vec2(0.0);
    float t = d / reach;
    float push = (1.5 + 1.1 * sd.x) * sc;
    warp += dir * push * 3.0 * t * exp(-t * t * 2.3);
    float grow = clamp(uStarAct[i], 0.0, 1.0);
    float rc = rcBase * (1.0 + 1.2 * grow);
    add += smoothstep(rc, rc * mix(0.3, 0.6, grow), d) * (0.9 + 0.16 * tw);
    float spikeX = exp(-abs(q.y) / (rc * 0.16)) * exp(-abs(q.x) / (rc * 1.3));
    float spikeY = exp(-abs(q.x) / (rc * 0.16)) * exp(-abs(q.y) / (rc * 1.3));
    add += (spikeX + spikeY) * tw * (0.2 + 0.16 * grow);
    float ring = smoothstep(rcBase * 2.8, rcBase * 1.5, d) * smoothstep(rcBase * 0.95, rcBase * 1.3, d);
    dim += ring * (0.4 + 0.12 * grow);
  }

  vec2 uv = clamp(vUv + vec2(warp.x / uCssSize.x, -warp.y / uCssSize.y), 0.0, 1.0);
  float base = texture(uField, uv).r;
  float value = clamp(base * (1.0 - min(dim, 0.9)) + add, 0.0, 1.0);
  outColor = vec4(vec3(value), 1.0);
}
`;
