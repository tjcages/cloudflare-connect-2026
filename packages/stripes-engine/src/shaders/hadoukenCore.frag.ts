export const HADOUKEN_CORE_FRAG = `#version 300 es
precision highp float;
in vec2 vUv;
uniform sampler2D uField;
uniform float uProgress;
uniform float uCharge;
uniform float uDetail;
uniform float uGlow;
uniform float uAspect;
out vec4 finalColor;

highp float vhash(vec2 q) {
  return fract(sin(dot(q, vec2(127.1, 311.7))) * 43758.5453123);
}

highp float vnoise(vec2 q) {
  vec2 i = floor(q);
  vec2 fr = fract(q);
  vec2 u = fr * fr * (3.0 - 2.0 * fr);
  highp float a = vhash(i);
  highp float b = vhash(i + vec2(1.0, 0.0));
  highp float c = vhash(i + vec2(0.0, 1.0));
  highp float d = vhash(i + vec2(1.0, 1.0));
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

highp float fbm2(vec2 q) {
  return 0.62 * vnoise(q) + 0.38 * vnoise(q * 2.73 + 13.7);
}

void main() {
  highp float p = max(uProgress, 0.0);
  vec2 a = (vUv - 0.5) * vec2(uAspect, 1.0);
  highp float r = length(a);
  highp float angn = r > 1e-5 ? atan(a.y, a.x) : 0.0;
  highp float maxR = length(vec2(uAspect, 1.0)) * 0.5;
  highp float R = maxR * 1.15 * pow(uCharge, 0.8);
  highp float edgeN = (fbm2(vec2(angn * mix(1.0, 4.0, uDetail) + 3.1, p * 1.5)) - 0.5) * 0.25;
  highp float Rl = max(0.0, R * (1.0 + edgeN));
  highp float mask = smoothstep(Rl, Rl - 0.12, r);
  highp float done = smoothstep(0.85, 1.0, uCharge);
  highp float rw = (r - Rl) * 9.0;
  highp float ring = exp(-rw * rw) * uGlow * 1.2 * (1.0 - done) * step(0.001, uCharge);
  highp float coreSize = 0.04 + 0.1 * uCharge;
  highp float core = exp(-(r * r) / (coreSize * coreSize)) * uGlow * (0.4 + 1.2 * uCharge) * (1.0 - done) * step(0.001, uCharge);
  highp float v = texture(uField, vUv).r * mask;
  finalColor = vec4(vec3(v + ring + core), 1.0);
}
`;
