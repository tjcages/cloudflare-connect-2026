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
  } else if (uMode == 1) {
    highp float rows = mix(18.0, 70.0, uDetail);
    n = vhash(vec2(floor(vUv.y * rows) * 0.61, 8.8));
  } else if (uMode == 2) {
    n = fbm2(vUv * mix(3.0, 9.0, uDetail) + 4.7);
  } else {
    n = 0.12;
  }

  highp float f = clamp((p - uSpread * n) / max(uFlight, 1e-4), 0.0, 1.0);
  if (f >= 1.0) {
    finalColor = vec4(vec3(texture(uField, vUv).r), 1.0);
    return;
  }

  if (uMode == 0) {
    highp float s = smoothstep(0.62, 1.0, f);
    highp float settle = 1.0 - pow(1.0 - s, 3.0);
    highp float decay = 1.0 - settle;
    highp float emerge = smoothstep(0.0, 0.22, f);
    vec2 flow = vec2(p * 0.9, -p * 0.6);
    vec2 q1 = vUv * freq + flow + 2.1;
    vec2 q2 = vUv * freq * 2.6 + flow * 1.8 + 17.3;
    highp float e = 0.09;
    vec2 c1 = vec2(fbm2(q1 + vec2(0.0, e)) - fbm2(q1 - vec2(0.0, e)), fbm2(q1 - vec2(e, 0.0)) - fbm2(q1 + vec2(e, 0.0))) / (2.0 * e);
    vec2 c2 = vec2(fbm2(q2 + vec2(0.0, e)) - fbm2(q2 - vec2(0.0, e)), fbm2(q2 - vec2(e, 0.0)) - fbm2(q2 + vec2(e, 0.0))) / (2.0 * e);
    vec2 curlV = c1 * 0.75 + c2 * 0.35;
    highp float vort = 0.55 + 0.9 * decay;
    vec2 disp = curlV * 0.09 * vort * uIntensity * decay;
    highp float acc = 0.0;
    for (int t = 0; t < 5; t++) {
      highp float w = 0.55 + 0.225 * float(t);
      acc += texture(uField, clamp(vUv + disp * w, 0.0, 1.0)).r;
    }
    highp float v = acc * 0.2;
    highp float gain = 1.0 + uGlow * 1.2 * min(1.0, length(disp) * 8.0) * decay + uGlow * 1.6 * emerge * (1.0 - emerge);
    finalColor = vec4(vec3(v * gain * emerge), 1.0);
    return;
  }

  if (uMode == 1) {
    highp float ease = 1.0 - pow(1.0 - f, 3.0);
    highp float decay = 1.0 - ease;
    highp float emerge = smoothstep(0.0, 0.25, f);
    highp float rows = mix(18.0, 70.0, uDetail);
    highp float row = floor(vUv.y * rows);
    highp float stp = floor(p * 38.0);
    highp float active = step(0.55, vhash(vec2(row * 0.53 + stp * 1.71, 6.1)));
    highp float h = vhash(vec2(row * 0.37 + stp * 1.13, 4.2));
    highp float spike = 1.0 + step(0.92, vhash(vec2(row * 0.29 + stp * 0.97, 9.4))) * 2.2;
    vec2 disp = vec2((h - 0.5) * 0.35 * spike, (vhash(vec2(row * 0.71 + stp * 1.31, 2.6)) - 0.5) * 0.06) * active * uIntensity * decay;
    highp float acc = 0.0;
    for (int t = 0; t < 5; t++) {
      highp float w = 0.55 + 0.225 * float(t);
      acc += texture(uField, clamp(vUv + disp * w, 0.0, 1.0)).r;
    }
    highp float v = acc * 0.2;
    highp float gain = 1.0 + uGlow * 0.5 * active * decay + uGlow * 0.6 * decay * (vhash(vec2(stp, 3.7)) - 0.5) * 2.0 + uGlow * 1.2 * emerge * (1.0 - emerge);
    finalColor = vec4(vec3(v * max(gain, 0.0) * emerge), 1.0);
    return;
  }

  if (uMode == 2) {
    highp float emerge = smoothstep(0.05, 0.5, f);
    highp float rim = emerge * (1.0 - emerge) * 4.0;
    vec2 shim = (vec2(fbm2(vUv * 22.0 + p * 3.0), fbm2(vUv * 22.0 + 31.7 - p * 2.2)) - 0.5) * 0.03 * uIntensity * (1.0 - f);
    highp float v = texture(uField, clamp(vUv + shim, 0.0, 1.0)).r;
    highp float ember = rim * rim;
    finalColor = vec4(vec3(v * emerge * (1.0 + uGlow * 0.8 * rim) + uGlow * (0.55 + 0.45 * fbm2(vUv * 14.0 + p * 1.3)) * ember), 1.0);
    return;
  }

  if (uMode == 3) {
    highp float ease = 1.0 - pow(1.0 - f, 3.0);
    highp float dx = abs(vUv.x - 0.5);
    highp float e2 = fbm2(vec2(vUv.y * mix(3.0, 8.0, uDetail) + 1.7, p * 1.6)) - 0.5;
    highp float w = ease * 0.72;
    highp float edge = max(w * (1.0 + e2 * 0.35 * uIntensity), 0.0);
    highp float mask = max(smoothstep(edge, edge - 0.06, dx), smoothstep(0.97, 1.0, f));
    highp float rw = (dx - edge) * 26.0;
    highp float ring = exp(-rw * rw) * uGlow * 1.5 * (1.0 - ease) * smoothstep(0.0, 0.05, f);
    finalColor = vec4(vec3(texture(uField, vUv).r * mask + ring), 1.0);
    return;
  }

  highp float flood = smoothstep(0.84, 0.98, f);
  highp float fe = flood * flood * (3.0 - 2.0 * flood);
  highp float bolts = 0.0;
  highp float flash = 0.0;
  for (int k = 0; k < 4; k++) {
    highp float fk = float(k);
    highp float st = 0.16 + fk * 0.18;
    highp float tk = f - st;
    if (tk < 0.0) continue;
    highp float env = exp(-tk * 26.0);
    highp float bx = 0.14 + 0.72 * vhash(vec2(fk * 3.3 + 1.2, 5.5)) + (fbm2(vec2(vUv.y * 3.5 + fk * 7.7, fk * 13.1)) - 0.5) * 0.35 * uIntensity;
    highp float d = abs(vUv.x - bx);
    bolts += exp(-d * d * 2600.0) * env;
    flash += env * 0.16;
  }
  highp float v = texture(uField, vUv).r * min(1.0, fe + flash * uGlow);
  finalColor = vec4(vec3(v + bolts * uGlow * 1.4 * (1.0 - fe)), 1.0);
}
`;
