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
  } else if (uMode == 2) {
    n = 0.1 + 0.45 * length(vUv - 0.5) * 1.2;
  } else if (uMode == 5) {
    highp float dmin = 1e9;
    for (int k = 0; k < 4; k++) {
      highp float fk = float(k);
      vec2 sd = vec2(vhash(vec2(fk * 2.7 + 0.4, 3.9)), vhash(vec2(fk * 5.1 + 1.8, 8.3))) * 0.8 + 0.1;
      dmin = min(dmin, distance(vUv, sd));
    }
    n = clamp(0.12 + 0.88 * (dmin * 1.35 + (fbm2(vUv * 5.0 + 3.3) - 0.5) * 0.4), 0.0, 1.0);
  } else {
    n = 0.1;
  }

  highp float f = clamp((p - uSpread * n) / max(uFlight, 1e-4), 0.0, 1.0);
  if (f >= 1.0) {
    finalColor = vec4(vec3(texture(uField, vUv).r), 1.0);
    return;
  }
  highp float ease = 1.0 - pow(1.0 - f, 3.0);

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
    highp float zoom = mix(3.5, 1.0, ease);
    highp float emerge = smoothstep(0.0, 0.15, f);
    highp float acc = 0.0;
    for (int t = 0; t < 7; t++) {
      highp float zt = mix(zoom, 1.0, float(t) / 6.0);
      vec2 su = 0.5 + (vUv - 0.5) / zt;
      acc += texture(uField, clamp(su, 0.0, 1.0)).r;
    }
    highp float v = acc / 7.0;
    highp float gain = 1.0 + uGlow * 0.9 * min(1.0, (zoom - 1.0) * 0.8);
    finalColor = vec4(vec3(v * gain * emerge), 1.0);
    return;
  }

  if (uMode == 3) {
    highp float mask = smoothstep(0.96, 1.0, f);
    highp float glowAcc = 0.0;
    for (int k = 0; k < 5; k++) {
      highp float fk = float(k);
      highp float th = 0.12 + 0.15 * fk;
      vec2 tgt = vec2(0.15 + 0.7 * vhash(vec2(fk * 3.1 + 0.7, 2.3)), 0.2 + 0.6 * vhash(vec2(fk * 4.7 + 1.9, 6.6)));
      highp float ang2 = vhash(vec2(fk * 1.3 + 0.2, 9.1)) * 6.2831853;
      vec2 dk = vec2(cos(ang2), sin(ang2));
      if (f < th) {
        highp float tt = f / th;
        vec2 head = tgt - dk * 0.9 * (1.0 - tt);
        vec2 tail = head - dk * 0.22;
        vec2 pa = vUv - head;
        vec2 ba = tail - head;
        highp float hseg = clamp(dot(pa, ba) / max(dot(ba, ba), 1e-6), 0.0, 1.0);
        highp float dseg = length(pa - ba * hseg);
        glowAcc += exp(-dseg * dseg * 4200.0) * tt * 1.2;
      } else {
        highp float tp = (f - th) / max(1.0 - th, 1e-4);
        highp float pe = 1.0 - pow(1.0 - tp, 3.0);
        highp float en = (fbm2(normalize(vUv - tgt + vec2(1e-4)) * 2.5 + fk * 3.7 + vec2(0.0, p * 1.1)) - 0.5) * 0.3;
        highp float Rk = 1.6 * pe * (1.0 + en);
        highp float dd = distance(vUv, tgt);
        mask = max(mask, smoothstep(Rk, Rk - 0.09, dd));
        highp float rw = (dd - Rk) * 14.0;
        glowAcc += exp(-rw * rw) * (1.0 - pe) * 0.8 + exp(-tp * 9.0) * exp(-dd * dd * 60.0) * 1.4;
      }
    }
    finalColor = vec4(vec3(texture(uField, vUv).r * mask + glowAcc * uGlow), 1.0);
    return;
  }

  if (uMode == 4) {
    highp float sweep = smoothstep(0.25, 0.9, f);
    highp float se = 1.0 - pow(1.0 - sweep, 3.0);
    highp float bx = mix(0.06, 1.02, se);
    highp float damp = 1.0 - smoothstep(0.85, 1.0, f);
    highp float behind = smoothstep(bx, bx - 0.05, vUv.x) * smoothstep(0.25, 0.32, f);
    highp float wake = exp(-max(bx - vUv.x, 0.0) * 9.0) * behind * damp;
    vec2 disp = (vec2(fbm2(vUv * 9.0 + vec2(p * 2.4, 3.1)), fbm2(vUv * 9.0 + vec2(17.9, -p * 1.9))) - 0.5) * 0.12 * uIntensity * wake;
    highp float acc = 0.0;
    for (int t = 0; t < 5; t++) {
      highp float w = 0.55 + 0.225 * float(t);
      acc += texture(uField, clamp(vUv + disp * w, 0.0, 1.0)).r;
    }
    highp float v = acc * 0.2 * behind * (1.0 + uGlow * 0.8 * wake);
    highp float db = abs(vUv.x - bx);
    highp float beamAmp = damp * (f < 0.25 ? 0.55 + 0.25 * sin(p * 14.0) : 1.0);
    highp float beamG = (exp(-db * db * 2400.0) * 1.3 + exp(-db * db * 180.0) * 0.5) * uGlow * beamAmp;
    finalColor = vec4(vec3(v + beamG), 1.0);
    return;
  }

  highp float emerge = smoothstep(0.02, 0.45, f);
  highp float rim = emerge * (1.0 - emerge) * 4.0;
  vec2 disp = (vec2(fbm2(vUv * 11.0 + vec2(p * 1.7, 4.4)), fbm2(vUv * 11.0 + vec2(23.1, -p * 1.4))) - 0.5) * 0.12 * uIntensity * rim;
  highp float acc = 0.0;
  for (int t = 0; t < 5; t++) {
    highp float w = 0.55 + 0.225 * float(t);
    acc += texture(uField, clamp(vUv + disp * w, 0.0, 1.0)).r;
  }
  highp float v = acc * 0.2;
  highp float plasmaG = rim * rim * (0.6 + 0.4 * fbm2(vUv * 8.0 + p * 1.9)) * uGlow * 1.6;
  finalColor = vec4(vec3(v * emerge * (1.0 + uGlow * 0.5 * rim) + plasmaG), 1.0);
}
`;
