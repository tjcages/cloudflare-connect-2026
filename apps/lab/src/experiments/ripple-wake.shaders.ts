export const RIPPLE_WAKE_STEP_FRAG = `#version 300 es
precision highp float;
in vec2 vUv;
uniform sampler2D uPrev;
uniform vec2 uTexel;
uniform vec2 uSplatA;
uniform vec2 uSplatB;
uniform vec2 uSplatDir;
uniform float uSplatAmp;
uniform float uSplatRadius;
uniform vec4 uDrop;
out vec4 outColor;

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

float valueNoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 s = f * f * (3.0 - 2.0 * f);
  float n00 = hash(i);
  float n10 = hash(i + vec2(1.0, 0.0));
  float n01 = hash(i + vec2(0.0, 1.0));
  float n11 = hash(i + vec2(1.0, 1.0));
  return mix(mix(n00, n10, s.x), mix(n01, n11, s.x), s.y);
}

void main() {
  vec2 hv = texture(uPrev, vUv).rg;
  float hL = texture(uPrev, vUv - vec2(uTexel.x, 0.0)).r;
  float hR = texture(uPrev, vUv + vec2(uTexel.x, 0.0)).r;
  float hT = texture(uPrev, vUv + vec2(0.0, uTexel.y)).r;
  float hB = texture(uPrev, vUv - vec2(0.0, uTexel.y)).r;
  float avg = (hL + hR + hT + hB) * 0.25;

  vec2 pos = vUv / uTexel;
  float wn = valueNoise(pos * 0.045);

  float k = 0.45 * (0.84 + 0.24 * wn);
  float vel = (hv.g + (avg - hv.r) * k) * 0.986;
  float h = (hv.r + vel) * 0.9965;
  h = mix(h, avg, 0.045);

  if (uSplatAmp != 0.0) {
    vec2 ba = uSplatB - uSplatA;
    float tt = clamp(dot(pos - uSplatA, ba) / max(dot(ba, ba), 1e-6), 0.0, 1.0);
    vec2 d = pos - (uSplatA + ba * tt);
    float along = dot(d, uSplatDir);
    float across = dot(d, vec2(-uSplatDir.y, uSplatDir.x));
    float wob = 0.85 + 0.3 * wn;
    float sa2 = uSplatRadius * uSplatRadius * 4.4 * wob;
    float sc2 = uSplatRadius * uSplatRadius * 0.72 * wob;
    float bow = along - uSplatRadius * 1.15;
    float stern = along + uSplatRadius * 1.55;
    float crest = exp(-(bow * bow / (2.0 * sa2) + across * across / (2.0 * sc2)));
    float trough = exp(-(stern * stern / (2.9 * sa2) + across * across / (3.4 * sc2)));
    h += uSplatAmp * (crest - 0.62 * trough);
  }

  if (uDrop.z != 0.0) {
    vec2 dp = pos - uDrop.xy;
    float ang = atan(dp.y, dp.x);
    float wobble = 1.0 + 0.22 * sin(ang * 3.0 + wn * 6.2831) + 0.12 * sin(ang * 5.0 - wn * 4.0);
    float r2 = uDrop.w * uDrop.w * wobble;
    float g1 = exp(-dot(dp, dp) / (2.0 * r2));
    float g2 = exp(-dot(dp, dp) / (6.48 * r2));
    h += uDrop.z * (g1 - 0.55 * g2);
  }

  outColor = vec4(h, vel, 0.0, 1.0);
}
`;

export const RIPPLE_WAKE_COMPOSITE_FRAG = `#version 300 es
precision highp float;
in vec2 vUv;
uniform sampler2D uField;
uniform sampler2D uSim;
uniform vec2 uSimTexel;
out vec4 outColor;

void main() {
  float hC = texture(uSim, vUv).r;
  float hL = texture(uSim, vUv - vec2(uSimTexel.x, 0.0)).r;
  float hR = texture(uSim, vUv + vec2(uSimTexel.x, 0.0)).r;
  float hT = texture(uSim, vUv + vec2(0.0, uSimTexel.y)).r;
  float hB = texture(uSim, vUv - vec2(0.0, uSimTexel.y)).r;
  vec2 grad = vec2(hR - hL, hT - hB);
  vec2 offs = clamp(grad * 0.09, vec2(-0.02), vec2(0.02));
  float base = texture(uField, clamp(vUv + offs, 0.0, 1.0)).r;
  float hs = hC / (1.0 + abs(hC) * 0.6);
  float lit = dot(grad, vec2(-0.447, 0.894)) * 2.6;
  lit = lit / (1.0 + abs(lit) * 0.7);
  float shade = hs * 0.5 + lit;
  float value = base * (1.0 + shade * 0.85) + max(shade, 0.0) * 0.22;
  outColor = vec4(vec3(clamp(value, 0.0, 1.0)), 1.0);
}
`;
