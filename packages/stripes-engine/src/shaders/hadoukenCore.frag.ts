export const HADOUKEN_CORE_FRAG = `#version 300 es
precision highp float;
in vec2 vUv;
uniform sampler2D uField;
uniform float uProgress;
uniform float uCharge;
uniform float uDetail;
uniform float uGlow;
uniform float uAspect;
uniform float uBurst;
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
  if (uBurst >= 1.0) {
    finalColor = vec4(vec3(texture(uField, vUv).r), 1.0);
    return;
  }
  vec2 a = (vUv - 0.5) * vec2(uAspect, 1.0);
  highp float r = length(a);
  vec2 edir = r > 1e-5 ? a / r : vec2(1.0, 0.0);
  highp float maxR = length(vec2(uAspect, 1.0)) * 0.5;

  highp float grow = smoothstep(0.0, 0.5, uCharge);
  highp float cs = smoothstep(0.42, 0.82, uCharge);
  highp float comp = cs * cs * (3.0 - 2.0 * cs);
  highp float orbR = (0.035 + 0.11 * grow) * (1.0 - 0.55 * comp);
  highp float orbN = fbm2(edir * 3.0 + vec2(p * 1.1, 5.3)) - 0.5;
  highp float orbRl = max(orbR * (1.0 + orbN * 0.35) * (1.0 + 0.05 * sin(p * 11.0)), 1e-3);
  highp float dens = 0.9 + 1.6 * comp;
  highp float orb = (exp(-(r * r) / (orbRl * orbRl * 0.25)) * dens + exp(-(r * r) / (orbRl * orbRl * 2.5)) * 0.35) * uGlow * step(0.001, uCharge);
  orb *= 1.0 - smoothstep(0.0, 0.3, uBurst);

  highp float v = 0.0;
  highp float ring = 0.0;
  if (uBurst > 0.0) {
    highp float be = 1.0 - pow(1.0 - uBurst, 3.0);
    highp float Rb = orbR + be * (maxR + 0.28 - orbR);
    highp float n1 = fbm2(edir * mix(4.0, 9.0, uDetail) + vec2(2.2, p * 0.7));
    highp float ridge = 1.0 - abs(2.0 * n1 - 1.0);
    highp float Rl = Rb * (1.0 + (ridge - 0.5) * 0.55 * (1.0 - be));
    highp float mask = max(smoothstep(Rl, Rl - 0.1, r), smoothstep(0.97, 1.0, uBurst));
    highp float rw = (r - Rl) * 8.0;
    ring = exp(-rw * rw) * uGlow * 1.6 * (1.0 - be) + uGlow * 0.9 * exp(-uBurst * 5.0) * exp(-(r * r) * 2.0);
    v = texture(uField, vUv).r * mask;
  }
  finalColor = vec4(vec3(v + orb + ring), 1.0);
}
`;
