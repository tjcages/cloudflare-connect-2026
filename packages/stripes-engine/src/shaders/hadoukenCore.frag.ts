export const HADOUKEN_CORE_FRAG = `#version 300 es
precision highp float;
in vec2 vUv;
uniform sampler2D uField;
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
  if (uCharge >= 1.0) {
    finalColor = vec4(vec3(texture(uField, vUv).r), 1.0);
    return;
  }
  vec2 a = (vUv - 0.5) * vec2(uAspect, 1.0);
  vec2 ea = a / vec2(1.55, 1.0);
  highp float r = length(ea);
  highp float maxR = length(vec2(uAspect / 1.55, 1.0)) * 0.5;
  highp float cells = mix(24.0, 64.0, uDetail);
  vec2 grid = vec2(cells, cells / uAspect);
  vec2 cid = floor(vUv * grid);
  vec2 cellCenter = (cid + 0.5) / grid;
  vec2 ca = (cellCenter - 0.5) * vec2(uAspect, 1.0) / vec2(1.55, 1.0);
  highp float cr = length(ca) / max(maxR, 1e-4);
  highp float hc = (vhash(cid * 0.173 + 4.7) * 0.65 + cr * 0.35) * 0.75;
  highp float on = smoothstep(hc, hc + 0.06, uCharge);
  highp float refine = smoothstep(hc + 0.05, hc + 0.2, uCharge);
  highp float blockV = texture(uField, cellCenter).r;
  highp float fullV = texture(uField, vUv).r;
  highp float v = mix(blockV, fullV, refine) * on;
  highp float flash = on * (1.0 - on) * 4.0;
  highp float core = exp(-(r * r) / 0.012) * uGlow * 0.5 * (1.0 - uCharge) * step(0.001, uCharge);
  finalColor = vec4(vec3(v + flash * flash * uGlow * 0.35 + core), 1.0);
}
`;
