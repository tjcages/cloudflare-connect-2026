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
  vec2 rdir = r > 1e-4 ? a / r : vec2(0.0, 1.0);
  highp float freq = mix(2.0, 10.0, uDetail);

  highp float n;
  if (uMode == 0) {
    n = fbm2(vUv * mix(3.0, 12.0, uDetail) + 7.3);
  } else if (uMode == 1) {
    n = fbm2(vUv * 6.0 + 3.3) * 0.6 + r * 0.4;
  } else if (uMode == 2) {
    n = fbm2(vec2(vUv.x * freq * 2.0, 1.7)) * 0.8 + 0.2 * fbm2(vUv * 5.0);
  } else if (uMode == 3) {
    n = fbm2(vUv * 7.0 + 1.9);
  } else if (uMode == 4) {
    n = 0.15;
  } else {
    highp float rows = mix(14.0, 56.0, uDetail);
    n = vhash(vec2(floor(vUv.y * rows) * 0.61, 8.8));
  }

  highp float f = clamp((p - uSpread * n) / max(uFlight, 1e-4), 0.0, 1.0);
  highp float ease = 1.0 - pow(1.0 - f, 3.0);
  highp float decay = 1.0 - ease;

  vec2 D;
  if (uMode == 0) {
    highp float ang = fbm2(vUv * freq + 2.1) * 12.566370;
    highp float mag = 0.5 + 0.5 * fbm2(vUv * freq * 1.7 + 5.9);
    D = vec2(cos(ang), sin(ang)) * 0.28 * mag;
  } else if (uMode == 1) {
    vec2 perp = vec2(-rdir.y, rdir.x);
    highp float fall = 1.0 - smoothstep(0.0, 0.85, r);
    D = perp * (0.9 * fall + 0.15) * r + a * 0.55;
  } else if (uMode == 2) {
    highp float dy = 0.45 + 0.75 * fbm2(vec2(vUv.x * freq * 2.0, vUv.y * 1.2 + 9.1));
    D = vec2((fbm2(vec2(vUv.x * freq, vUv.y * 2.0)) - 0.5) * 0.12, -dy);
  } else if (uMode == 3) {
    highp float best = 1e9;
    vec2 bw = vec2(0.0);
    for (int k = 0; k < 4; k++) {
      highp float fk = float(k);
      vec2 w = (vec2(vhash(vec2(fk * 1.7 + 0.3, 2.9)), vhash(vec2(fk * 3.1 + 1.1, 7.7))) - 0.5) * vec2(uAspect, 1.0) * 0.9;
      highp float dd = length(a - w);
      if (dd < best) {
        best = dd;
        bw = w;
      }
    }
    vec2 dir = best > 1e-4 ? (bw - a) / best : vec2(0.0, 1.0);
    D = dir * exp(-best * 2.2) * 0.55;
  } else if (uMode == 4) {
    highp float R = ease * 1.4;
    highp float rw = (r - R) * 6.0;
    D = rdir * exp(-rw * rw) * 0.3 + rdir * smoothstep(R, R + 0.6, r) * 0.12;
  } else {
    highp float rows = mix(14.0, 56.0, uDetail);
    highp float row = floor(vUv.y * rows);
    highp float h = vhash(vec2(row * 0.37 + floor(p * 22.0) * 1.13, 4.2));
    D = vec2((h - 0.5) * 0.55, 0.0);
  }

  vec2 disp = D * uIntensity * decay;
  highp float acc = 0.0;
  for (int t = 0; t < 5; t++) {
    highp float w = 0.55 + 0.225 * float(t);
    acc += texture(uField, clamp(vUv + disp * w, 0.0, 1.0)).r;
  }
  highp float v = acc * 0.2;
  highp float gain = 1.0 + uGlow * 1.2 * min(1.0, length(disp) * 8.0) * decay;
  if (uMode == 5) {
    gain += uGlow * 0.5 * decay * (vhash(vec2(floor(p * 22.0), 3.7)) - 0.5) * 2.0;
  }
  highp float fadeIn = smoothstep(0.0, 0.08, p);
  finalColor = vec4(vec3(v * gain * fadeIn), 1.0);
}
`;
