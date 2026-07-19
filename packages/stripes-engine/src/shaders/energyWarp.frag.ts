export const ENERGY_WARP_FRAG = `#version 300 es
precision highp float;
in vec2 vUv;
uniform sampler2D uField;
uniform int uMode;
uniform float uProgress;
uniform float uSpread;
uniform float uFlight;
uniform float uIntensity;
uniform float uDetail;
uniform float uGlow;
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
  highp float freq = mix(2.0, 10.0, uDetail);

  highp float n;
  if (uMode == 0) {
    n = fbm2(vUv * mix(3.0, 12.0, uDetail) + 7.3);
  } else {
    highp float rows = mix(14.0, 56.0, uDetail);
    n = vhash(vec2(floor(vUv.y * rows) * 0.61, 8.8));
  }

  highp float f = clamp((p - uSpread * n) / max(uFlight, 1e-4), 0.0, 1.0);
  highp float ease = 1.0 - pow(1.0 - f, 3.0);
  highp float decay = 1.0 - ease;
  if (f >= 1.0) {
    finalColor = vec4(vec3(texture(uField, vUv).r), 1.0);
    return;
  }

  vec2 D;
  highp float emerge;
  if (uMode == 0) {
    vec2 flow = vec2(p * 0.9, -p * 0.6);
    vec2 q1 = vUv * freq + flow + 2.1;
    vec2 q2 = vUv * freq * 2.6 + flow * 1.8 + 17.3;
    highp float e = 0.09;
    vec2 c1 = vec2(
      fbm2(q1 + vec2(0.0, e)) - fbm2(q1 - vec2(0.0, e)),
      fbm2(q1 - vec2(e, 0.0)) - fbm2(q1 + vec2(e, 0.0))
    ) / (2.0 * e);
    vec2 c2 = vec2(
      fbm2(q2 + vec2(0.0, e)) - fbm2(q2 - vec2(0.0, e)),
      fbm2(q2 - vec2(e, 0.0)) - fbm2(q2 + vec2(e, 0.0))
    ) / (2.0 * e);
    vec2 curlV = c1 * 0.75 + c2 * 0.35;
    highp float vort = 0.55 + 0.9 * decay;
    D = curlV * 0.09 * vort;
    emerge = smoothstep(0.0, 0.4, f);
  } else {
    highp float rows = mix(14.0, 56.0, uDetail);
    highp float row = floor(vUv.y * rows);
    highp float h = vhash(vec2(row * 0.37 + floor(p * 22.0) * 1.13, 4.2));
    D = vec2((h - 0.5) * 0.55, 0.0);
    emerge = smoothstep(0.0, 0.25, f);
  }

  vec2 disp = D * uIntensity * decay;
  highp float acc = 0.0;
  for (int t = 0; t < 5; t++) {
    highp float w = 0.55 + 0.225 * float(t);
    acc += texture(uField, clamp(vUv + disp * w, 0.0, 1.0)).r;
  }
  highp float v = acc * 0.2;
  highp float gain = 1.0 + uGlow * 1.2 * min(1.0, length(disp) * 8.0) * decay + uGlow * 1.6 * emerge * (1.0 - emerge);
  if (uMode == 1) {
    gain += uGlow * 0.5 * decay * (vhash(vec2(floor(p * 22.0), 3.7)) - 0.5) * 2.0;
  }
  finalColor = vec4(vec3(v * gain * emerge), 1.0);
}
`;
