export const ENERGETIC_MERGE_FRAG = `#version 300 es
precision highp float;
in vec2 vUv;
uniform sampler2D uField;
uniform sampler2D uBlurQuarter;
uniform sampler2D uBlurHalf;
uniform sampler2D uBlurFull;
uniform int uMode;
uniform float uProgress;
uniform float uSpread;
uniform float uFlight;
uniform float uMoveEnd;
uniform float uMassCount;
uniform float uOvershoot;
uniform float uImpact;
uniform vec2 uSigmaUv;
uniform float uBlurStart;
uniform float uAspect;
out vec4 finalColor;

const int MAX_MASSES = 36;

highp float hash11(highp float n) {
  return fract(sin(n * 127.1 + 311.7) * 43758.5453123);
}

highp float backOut(highp float f, highp float s) {
  highp float t = f - 1.0;
  return 1.0 + (s + 1.0) * t * t * t + s * t * t;
}

highp float flightF(highp float order) {
  return clamp((max(uProgress, 0.0) - uSpread * order) / max(uFlight, 1e-4), 0.0, 1.0);
}

highp float sampleBlur(vec2 uv, highp float s) {
  vec2 suv = clamp(uv, 0.0, 1.0);
  if (s <= 0.0) return texture(uField, suv).r;
  if (s <= 0.25) return mix(texture(uField, suv).r, texture(uBlurQuarter, suv).r, s * 4.0);
  if (s <= 0.5) return mix(texture(uBlurQuarter, suv).r, texture(uBlurHalf, suv).r, (s - 0.25) * 4.0);
  return mix(texture(uBlurHalf, suv).r, texture(uBlurFull, suv).r, clamp((s - 0.5) * 2.0, 0.0, 1.0));
}

highp float remainingBlur(highp float f) {
  highp float fb = clamp((f - uBlurStart) / max(1.0 - uBlurStart, 1e-4), 0.0, 1.0);
  return 1.0 - fb * fb * (3.0 - 2.0 * fb);
}

void main() {
  highp float p = max(uProgress, 0.0);
  highp float s = uOvershoot * 17.0;

  if (p >= uMoveEnd && uMode != 2) {
    highp float tI = clamp((p - uMoveEnd) / 0.25, 0.0, 1.0);
    highp float fade = 1.0 - tI;
    vec2 uv = vUv;
    highp float boost = 0.0;
    if (uMode == 1 || uMode == 3) {
      vec2 c = (vUv - 0.5) * vec2(uAspect, 1.0);
      highp float d = length(c);
      highp float r = (d - tI * 0.9) * 7.0;
      highp float ring = exp(-r * r);
      vec2 dir = d > 1e-4 ? c / d : vec2(0.0);
      uv += dir * ring * 0.012 * uImpact * fade / vec2(uAspect, 1.0);
      boost = ring * 0.5 * uImpact * fade;
    } else if (uMode == 0) {
      boost = 0.25 * uImpact * fade;
    }
    highp float v = texture(uField, clamp(uv, 0.0, 1.0)).r;
    finalColor = vec4(vec3(v * (1.0 + boost)), 1.0);
    return;
  }

  highp float v = 0.0;

  if (uMode == 0) {
    highp float n = clamp(uMassCount, 2.0, 16.0);
    highp float col = min(floor(vUv.x * n), n - 1.0);
    highp float h = hash11(col + 1.0);
    highp float f = flightF(h);
    highp float dir = mod(col, 2.0) < 0.5 ? 1.0 : -1.0;
    highp float spawn = dir * (1.0 + 0.3 * h);
    highp float ease = backOut(f, s);
    highp float offY = (1.0 - ease) * spawn;
    highp float vel = abs(spawn) * 3.0 * (1.0 - f) * (1.0 - f);
    highp float smear = min(vel * 0.03, 0.05);
    highp float blurAmt = remainingBlur(f) * 0.5;
    highp float acc = 0.0;
    for (int t = -2; t <= 2; t++) {
      highp float sy = vUv.y - offY + float(t) * smear;
      acc += (sy >= 0.0 && sy <= 1.0 && f > 0.0) ? sampleBlur(vec2(vUv.x, sy), blurAmt) : 0.0;
    }
    v = acc * 0.2;
  } else if (uMode == 1) {
    highp float gc = clamp(floor(sqrt(uMassCount * uAspect) + 0.5), 2.0, 16.0);
    highp float gr = max(2.0, ceil(uMassCount / gc));
    int count = int(gc * gr);
    for (int i = 0; i < MAX_MASSES; i++) {
      if (i >= count) break;
      highp float fi = float(i);
      highp float bx = mod(fi, gc);
      highp float by = floor(fi / gc);
      vec2 rMin = vec2(bx / gc, by / gr);
      vec2 rMax = vec2((bx + 1.0) / gc, (by + 1.0) / gr);
      vec2 c = 0.5 * (rMin + rMax);
      highp float h = hash11(fi + 7.0);
      vec2 d = c - 0.5;
      vec2 dir = length(d) > 1e-3 ? normalize(d) : vec2(0.0, -1.0);
      vec2 spawnOff = dir * (0.6 + 0.5 * h);
      highp float f = flightF(hash11(fi + 41.0));
      if (f <= 0.0) continue;
      vec2 off = (1.0 - backOut(f, s)) * spawnOff;
      vec2 q = vUv - off;
      if (q.x < rMin.x || q.x > rMax.x || q.y < rMin.y || q.y > rMax.y) continue;
      v = max(v, sampleBlur(q, remainingBlur(f)));
    }
  } else if (uMode == 2) {
    highp float f = clamp(p / max(uMoveEnd, 1e-4), 0.0, 1.0);
    highp float charge = smoothstep(0.0, 0.7, f);
    highp float blurAmt = f < 0.7 ? mix(1.0, 0.3, charge) : 0.0;
    highp float scale = mix(1.04, 1.0, f * f * (3.0 - 2.0 * f));
    vec2 suv = 0.5 + (vUv - 0.5) / scale;
    highp float gain = f < 0.7 ? 0.3 * uImpact * charge : 0.0;
    highp float flash = f >= 0.7 ? 0.6 * uImpact * (1.0 - smoothstep(0.7, 0.85, f)) : 0.0;
    v = sampleBlur(suv, blurAmt) * (1.0 + gain + flash);
  } else {
    highp float k = clamp(uMassCount, 3.0, 8.0);
    int count = int(k);
    for (int i = 0; i < 8; i++) {
      if (i >= count) break;
      highp float fi = float(i);
      vec2 seed = vec2(hash11(fi * 2.3 + 1.7), hash11(fi * 3.1 + 0.37)) * 0.8 + 0.1;
      vec2 d = seed - 0.5;
      vec2 dir = length(d) > 1e-3 ? normalize(d) : vec2(0.0, -1.0);
      highp float h = hash11(fi + 13.0);
      highp float f = flightF(h * 0.5);
      if (f <= 0.0) continue;
      vec2 off = dir * (0.7 + 0.4 * h) * (1.0 - backOut(f, s));
      vec2 q = vUv - off;
      highp float dSelf = length((q - seed) * vec2(uAspect, 1.0));
      bool nearest = true;
      for (int j = 0; j < 8; j++) {
        if (j >= count || j == i) continue;
        highp float fj = float(j);
        vec2 seedJ = vec2(hash11(fj * 2.3 + 1.7), hash11(fj * 3.1 + 0.37)) * 0.8 + 0.1;
        if (length((q - seedJ) * vec2(uAspect, 1.0)) < dSelf) { nearest = false; break; }
      }
      if (!nearest || q.x < 0.0 || q.x > 1.0 || q.y < 0.0 || q.y > 1.0) continue;
      v = max(v, sampleBlur(q, remainingBlur(f)));
    }
  }

  finalColor = vec4(vec3(v), 1.0);
}
`;
