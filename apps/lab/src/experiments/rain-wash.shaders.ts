export const RAIN_WASH_STEP_FRAG = `#version 300 es
precision highp float;
in vec2 vUv;
uniform sampler2D uPrev;
uniform vec4 uStreaks[28];
uniform float uSeeds[28];
uniform int uCount;
uniform float uAspect;
uniform float uSheetHead;
uniform float uWetKeep;
out vec4 outColor;

float hash11(float n) {
  return fract(sin(n * 127.1) * 43758.5453123);
}

void main() {
  float px = vUv.x * uAspect;
  float py = 1.0 - vUv.y;
  vec2 prev = texture(uPrev, vUv).rg;
  float cover = prev.r;
  float wet = prev.g * uWetKeep;
  for (int i = 0; i < uCount; i++) {
    vec4 s = uStreaks[i];
    float seed = uSeeds[i];
    float xBase = s.x * uAspect;
    float headPrev = s.y;
    float head = s.z;
    float hw = s.w;
    float wob = hw * (0.55 * sin(py * 8.0 + seed * 6.2831) + 0.35 * sin(py * 19.0 + seed * 40.0));
    float xc = xBase + wob;
    float dx = abs(px - xc);
    float widthAt = hw * (1.0 + 0.55 * exp(-abs(py - head) * 24.0));
    float below = max(0.0, py - head);
    float stripe = smoothstep(0.011, -0.004, dx - widthAt) * smoothstep(0.03, 0.0, below);
    cover = max(cover, stripe);
    float relX = dx / max(widthAt * 1.25, 1e-4);
    float relY = (py - head) / max(hw * 2.6, 1e-4);
    wet = max(wet, exp(-(relX * relX + relY * relY)) * 0.95);
    for (int j = 0; j < 3; j++) {
      float fj = float(j);
      float lag = 0.09 + 0.22 * hash11(seed * 61.7 + fj * 7.31);
      float fall = 0.85 + 0.13 * hash11(seed * 23.9 + fj * 3.77);
      float dHead = head * fall - lag;
      if (dHead < -0.06) continue;
      float dPrev = min(dHead, headPrev * fall - lag);
      float xd = xBase + (hash11(seed * 45.3 + fj * 9.13) - 0.5) * hw * 3.2 + wob * 0.6;
      float rj = hw * (0.30 + 0.26 * hash11(seed * 12.9 + fj * 5.41));
      float cy = clamp(py, dPrev, dHead);
      float dd = length(vec2(px - xd, py - cy));
      cover = max(cover, smoothstep(rj, rj * 0.25, dd) * 0.9);
      float dxh = (px - xd) / max(rj * 1.3, 1e-4);
      float dyh = (py - dHead) / max(rj * 2.0, 1e-4);
      wet = max(wet, exp(-(dxh * dxh + dyh * dyh)) * 0.7);
    }
  }
  float xcell = px * 9.0;
  float j0 = hash11(floor(xcell) * 3.7);
  float j1 = hash11((floor(xcell) + 1.0) * 3.7);
  float jf = fract(xcell);
  jf = jf * jf * (3.0 - 2.0 * jf);
  float jitter = (mix(j0, j1, jf) - 0.5) * 0.16;
  float sheet = 1.0 - smoothstep(uSheetHead - 0.13, uSheetHead + 0.13, py + jitter);
  cover = max(cover, sheet);
  outColor = vec4(min(cover, 1.0), min(wet, 1.0), 0.0, 1.0);
}
`;

export const RAIN_WASH_COMPOSITE_FRAG = `#version 300 es
precision highp float;
in vec2 vUv;
uniform sampler2D uField;
uniform sampler2D uAccum;
uniform float uTime;
uniform float uWetScale;
uniform vec2 uCssSize;
out vec4 outColor;

float hash21(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

void main() {
  vec2 acc = texture(uAccum, vUv).rg;
  float cover = acc.r;
  float wet = acc.g * uWetScale;
  float image = texture(uField, vUv).r;
  vec2 grainCell = floor(vUv * uCssSize / 7.0);
  float tick = floor(uTime * 13.0);
  float grain = hash21(grainCell + tick * vec2(5.17, 9.73));
  float sub = hash21(vUv * uCssSize * 0.61 + tick * vec2(3.31, 7.97));
  float staticV = 0.08 + 0.66 * grain + 0.18 * sub;
  float v = mix(staticV, image, cover);
  float rim = cover * (1.0 - cover);
  v = clamp(v - rim * 0.5, 0.0, 1.0);
  v = mix(v, 1.0, clamp(wet, 0.0, 1.0) * 0.55);
  outColor = vec4(vec3(v), 1.0);
}
`;
