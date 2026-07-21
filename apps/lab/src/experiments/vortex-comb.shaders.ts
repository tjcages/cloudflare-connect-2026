export const VORTEX_COMB_STEP_FRAG = `#version 300 es
precision highp float;

uniform sampler2D uPrev;
uniform vec2 uTexel;
uniform float uDt;
uniform float uAspect;
uniform vec2 uSegA;
uniform vec2 uSegB;
uniform float uSpeed;

in vec2 vUv;
out vec4 outColor;

const float TAU_V = 2.8;
const float TAU_D = 3.2;
const float INJECT = 4.5;
const float PUSH = 0.32;
const float RADIUS = 0.135;
const float DISP_GAIN = 0.28;
const float VMAX = 1.2;
const float DMAX = 0.07;

vec2 softLimit(vec2 v, float m) {
  float l = length(v);
  if (l < 1e-6) return v;
  return v * (m * tanh(l / m) / l);
}

void main() {
  vec2 P = vec2(vUv.x * uAspect, vUv.y);
  vec4 here = texture(uPrev, vUv);

  vec2 traced = P - here.xy * uDt;
  vec4 adv = texture(uPrev, clamp(vec2(traced.x / uAspect, traced.y), 0.0, 1.0));

  vec4 sum = texture(uPrev, vUv + vec2(uTexel.x, 0.0)) + texture(uPrev, vUv - vec2(uTexel.x, 0.0)) +
    texture(uPrev, vUv + vec2(0.0, uTexel.y)) + texture(uPrev, vUv - vec2(0.0, uTexel.y));
  vec4 relaxed = mix(adv, sum * 0.25, clamp(uDt * 7.0, 0.0, 0.45));

  vec2 V = relaxed.xy * exp(-uDt / TAU_V);
  vec2 D = relaxed.zw * exp(-uDt / TAU_D);

  if (uSpeed > 0.0) {
    vec2 ab = uSegB - uSegA;
    float l2 = dot(ab, ab);
    bool hasDir = l2 > 1e-8;
    vec2 dir = hasDir ? ab * inversesqrt(l2) : vec2(1.0, 0.0);
    float t = hasDir ? clamp(dot(P - uSegA, ab) / l2, 0.0, 1.0) : 0.0;
    vec2 d = P - (uSegA + ab * t);
    vec2 dn = d / RADIUS;
    float g = exp(-dot(dn, dn));
    float lateral = dot(d, vec2(-dir.y, dir.x));
    float sgn = tanh(lateral / (RADIUS * 0.34));
    V += vec2(-dn.y, dn.x) * sgn * g * INJECT * uSpeed * uDt;
    V += dir * g * PUSH * INJECT * uSpeed * uDt;
  }

  V = softLimit(V, VMAX);
  D = softLimit(D + V * uDt * DISP_GAIN, DMAX);
  outColor = vec4(V, D);
}
`;

export const VORTEX_COMB_COMPOSITE_FRAG = `#version 300 es
precision highp float;

uniform sampler2D uField;
uniform sampler2D uSim;
uniform float uAspect;

in vec2 vUv;
out vec4 outColor;

void main() {
  vec2 D = texture(uSim, vec2(vUv.x, 1.0 - vUv.y)).zw;
  vec2 uv = clamp(vUv - vec2(D.x / uAspect, -D.y), 0.0, 1.0);
  outColor = vec4(vec3(texture(uField, uv).r), 1.0);
}
`;
