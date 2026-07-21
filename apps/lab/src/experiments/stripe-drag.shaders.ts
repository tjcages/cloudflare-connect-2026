export const STRIPE_DRAG_SIM_FRAG = `#version 300 es
precision highp float;

uniform sampler2D uPrev;
uniform vec2 uCssSize;
uniform vec2 uPrevPos;
uniform vec2 uCurPos;
uniform vec2 uDelta;
uniform float uActive;
uniform float uDt;
uniform float uScale;

in vec2 vUv;
out vec4 outColor;

const float GRAB = 1.22;
const float STIFFNESS = 74.0;
const float DAMPING = 5.9;
const float HOLD_RELIEF = 0.055;

float hash21(vec2 p) {
  vec3 q = fract(vec3(p.xyx) * 0.1031);
  q += dot(q, q.yzx + 33.33);
  return fract((q.x + q.y) * q.z);
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
  vec4 prev = texture(uPrev, vUv);
  vec2 off = prev.xy;
  vec2 vel = prev.zw;
  vec2 pos = vec2(vUv.x, 1.0 - vUv.y) * uCssSize;

  float radius = 138.0 * uScale;
  vec2 seg = uCurPos - uPrevPos;
  float segLen2 = max(dot(seg, seg), 1e-4);
  float t = clamp(dot(pos - uPrevPos, seg) / segLen2, 0.0, 1.0);
  float distSeg = length(pos - (uPrevPos + seg * t));
  float reach = pow(smoothstep(radius, 0.0, distSeg), 1.5);

  float pin = smoothstep(0.0, 0.09, vUv.x) * smoothstep(1.0, 0.91, vUv.x) *
    smoothstep(0.0, 0.09, vUv.y) * smoothstep(1.0, 0.91, vUv.y);

  float dl = length(uDelta);
  vec2 nd = dl > 1e-4 ? uDelta / dl : vec2(1.0, 0.0);
  vec2 perp = vec2(-nd.y, nd.x);
  vec2 nc = vec2(dot(pos, nd) / (300.0 * uScale), dot(pos, perp) / (44.0 * uScale));
  float ribbon = 0.42 + 1.28 * vnoise(nc);

  off += uDelta * (reach * ribbon * pin * GRAB * uActive);

  float maxOff = 96.0 * uScale;
  float m = length(off);
  if (m > maxOff) off *= maxOff / m;

  float grip = pow(smoothstep(radius * 1.1, 0.0, length(pos - uCurPos)), 1.4) * uActive;
  float k = mix(STIFFNESS, STIFFNESS * HOLD_RELIEF, grip);
  vel += (-k * off - DAMPING * vel) * uDt;
  off += vel * uDt;

  if (dot(off, off) < 4e-4 && dot(vel, vel) < 4e-3) {
    off = vec2(0.0);
    vel = vec2(0.0);
  }

  outColor = vec4(off, vel);
}
`;

export const STRIPE_DRAG_FIELD_FRAG = `#version 300 es
precision highp float;

uniform sampler2D uField;
uniform sampler2D uSim;
uniform vec2 uCssSize;

in vec2 vUv;
out vec4 outColor;

void main() {
  vec2 off = texture(uSim, vUv).xy;
  vec2 shift = vec2(-off.x / uCssSize.x, off.y / uCssSize.y);
  vec2 uv = clamp(vUv + shift, 0.0, 1.0);
  outColor = vec4(vec3(texture(uField, uv).r), 1.0);
}
`;
