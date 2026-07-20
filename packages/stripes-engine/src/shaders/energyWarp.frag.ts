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
    highp float n0 = fbm2(vUv * mix(4.0, 14.0, uDetail) + 7.3);
    highp float n1 = vhash(floor(vUv * mix(8.0, 26.0, uDetail)) * 0.173 + 3.7);
    n = clamp(mix(n0, n1, 0.55), 0.0, 1.0);
  } else if (uMode == 1) {
    highp float rowsC = mix(8.0, 24.0, uDetail);
    highp float rowsF = mix(40.0, 120.0, uDetail);
    n = clamp(vhash(vec2(floor(vUv.y * rowsC) * 0.61, 8.8)) * 0.6 + vhash(vec2(floor(vUv.y * rowsF) * 0.13, 5.2)) * 0.4, 0.0, 1.0);
  } else if (uMode == 3) {
    n = clamp(0.1 + 0.75 * (1.0 - texture(uField, vUv).r) + (fbm2(vUv * 6.0 + 1.3) - 0.5) * 0.3, 0.0, 1.0);
  } else {
    n = 0.12;
  }

  highp float f = clamp((p - uSpread * n) / max(uFlight, 1e-4), 0.0, 1.0);
  if (f >= 1.0) {
    finalColor = vec4(vec3(texture(uField, vUv).r), 1.0);
    return;
  }
  highp float ease = 1.0 - pow(1.0 - f, 3.0);

  if (uMode == 0) {
    highp float sOff = (fbm2(vUv * 5.0 + 21.7) - 0.5) * 0.24;
    highp float s = smoothstep(0.5 + sOff, 1.0, f);
    highp float settle = s * s * (3.0 - 2.0 * s);
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
    highp float decay = 1.0 - ease;
    highp float emerge = smoothstep(0.0, 0.25, f);
    highp float rowsC = mix(8.0, 24.0, uDetail);
    highp float rowsF = mix(40.0, 120.0, uDetail);
    highp float rowC = floor(vUv.y * rowsC);
    highp float rowF = floor(vUv.y * rowsF);
    highp float stp = floor(p * 38.0);
    highp float actC = step(0.6, vhash(vec2(rowC * 0.53 + stp * 1.71, 6.1)));
    highp float actF = step(0.72, vhash(vec2(rowF * 0.41 + stp * 1.29, 3.3)));
    highp float magVar = 0.4 + 0.6 * vhash(vec2(stp * 0.77, 1.9));
    highp float hC = vhash(vec2(rowC * 0.37 + stp * 1.13, 4.2));
    highp float hF = vhash(vec2(rowF * 0.23 + stp * 0.87, 7.6));
    highp float spike = 1.0 + step(0.93, vhash(vec2(rowC * 0.29 + stp * 0.97, 9.4))) * 2.6;
    vec2 disp = vec2((hC - 0.5) * 0.4 * spike * actC + (hF - 0.5) * 0.18 * actF, (vhash(vec2(rowC * 0.71 + stp * 1.31, 2.6)) - 0.5) * 0.08 * actC) * magVar * uIntensity * decay;
    highp float acc = 0.0;
    for (int t = 0; t < 5; t++) {
      highp float w = 0.55 + 0.225 * float(t);
      acc += texture(uField, clamp(vUv + disp * w, 0.0, 1.0)).r;
    }
    highp float v = acc * 0.2;
    highp float gain = 1.0 + uGlow * 0.5 * actC * decay + uGlow * 0.6 * decay * (vhash(vec2(stp, 3.7)) - 0.5) * 2.0 + uGlow * 1.2 * emerge * (1.0 - emerge);
    finalColor = vec4(vec3(v * max(gain, 0.0) * emerge), 1.0);
    return;
  }

  if (uMode == 2) {
    vec2 wv = vec2(fbm2(vUv * 3.5 + vec2(p * 0.7, 2.2)), fbm2(vUv * 3.5 + vec2(15.3, -p * 0.55))) - 0.5;
    vec2 wuv = vUv + wv * 0.28 * uIntensity;
    highp float dmin = 1e9;
    for (int k = 0; k < 3; k++) {
      highp float fk = float(k);
      vec2 ip = vec2(vhash(vec2(fk * 2.9 + 0.8, 4.1)), vhash(vec2(fk * 4.3 + 2.2, 7.9))) * 0.7 + 0.15;
      dmin = min(dmin, distance(wuv, ip));
    }
    highp float grow = ease * 1.7;
    highp float conc = smoothstep(grow, grow - 0.3, dmin);
    conc *= 0.55 + 0.45 * fbm2(wuv * 7.0 + vec2(p * 1.3, 9.4));
    conc = max(conc, smoothstep(0.93, 1.0, f));
    vec2 su = vUv + wv * 0.1 * uIntensity * (1.0 - conc);
    highp float v = texture(uField, clamp(su, 0.0, 1.0)).r;
    highp float edge = conc * (1.0 - conc) * 4.0;
    finalColor = vec4(vec3(v * conc + edge * edge * uGlow * 0.5 * fbm2(wuv * 9.0 + p)), 1.0);
    return;
  }

  if (uMode == 3) {
    highp float lum = texture(uField, vUv).r;
    highp float emerge = smoothstep(0.0, 0.18, f);
    highp float rim = emerge * (1.0 - emerge) * 4.0;
    highp float flick = 0.75 + 0.25 * sin(p * 40.0 + vhash(floor(vUv * 40.0) * 0.31 + 2.9) * 6.2831853);
    finalColor = vec4(vec3(lum * emerge * (1.0 + uGlow * 0.6 * rim * flick) + rim * rim * lum * uGlow * 1.4 * flick), 1.0);
    return;
  }

  highp float rr = length(vUv - 0.5) * (1.0 + (fbm2(vUv * 4.0 + 6.7) - 0.5) * 0.25);
  highp float mask = smoothstep(0.95, 1.0, f);
  highp float ringG = 0.0;
  for (int k = 0; k < 4; k++) {
    highp float fk = float(k);
    highp float tk = 0.1 + 0.2 * fk;
    highp float sp = mix(0.9, 2.8, fk / 3.0);
    highp float Rk = max(f - tk, 0.0) * sp;
    mask = max(mask, smoothstep(Rk, Rk - 0.07, rr) * step(tk, f));
    highp float rw = (rr - Rk) * 16.0;
    ringG += exp(-rw * rw) * step(tk, f) * (1.0 - smoothstep(tk, tk + 0.28, f)) * (0.5 + 0.3 * fk);
  }
  finalColor = vec4(vec3(texture(uField, vUv).r * mask + ringG * uGlow * 0.9), 1.0);
}
`;
