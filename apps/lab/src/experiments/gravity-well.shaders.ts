export const GRAVITY_WELL_FRAG = `#version 300 es
precision highp float;
in vec2 vUv;
uniform sampler2D uField;
uniform vec2 uCenter;
uniform vec2 uRippleCenter;
uniform float uAspect;
uniform float uTwist;
uniform float uPull;
uniform float uStrength;
uniform float uTime;
uniform float uRippleRadius;
uniform float uRippleAmp;
out vec4 outColor;

void main() {
  vec2 asp = vec2(uAspect, 1.0);
  vec2 p = vUv * asp;
  vec2 c = uCenter * asp;
  vec2 d = p - c;
  float r = length(d);
  float influence = 0.7;
  float fall = 1.0 - smoothstep(0.0, influence, r);
  float shape = fall * fall * (1.0 + 1.2 * fall);
  float mag = abs(uStrength);
  float theta = atan(d.y, d.x + 1e-6);
  float angle = uTwist * shape;
  angle *= 1.0 + 0.06 * mag * sin(uTime * 2.1 + r * 16.0);
  angle += uStrength * fall * fall * 0.14 * sin(theta * 3.0 - uTime * 1.7) * smoothstep(0.0, 0.05, r);
  float s = sin(angle);
  float co = cos(angle);
  vec2 rot = vec2(co * d.x - s * d.y, s * d.x + co * d.y);
  float pull = uPull * fall * fall;
  vec2 warped = c + rot * (1.0 + pull);

  vec2 rc = uRippleCenter * asp;
  vec2 rv = p - rc;
  float rr = length(rv);
  float rd = rr - uRippleRadius;
  float w = 0.05;
  float band = exp(-(rd * rd) / (w * w));
  vec2 dir = rr > 1e-4 ? rv / rr : vec2(0.0);
  warped += dir * (-(rd / w)) * band * uRippleAmp * 0.035;

  vec2 uv = clamp(warped / asp, vec2(0.0), vec2(1.0));
  float value = texture(uField, uv).r;
  value += band * uRippleAmp * 0.14;
  float core = exp(-(r * r) / 0.012);
  value *= 1.0 - 0.32 * max(uStrength, 0.0) * core;
  outColor = vec4(vec3(clamp(value, 0.0, 1.0)), 1.0);
}
`;
