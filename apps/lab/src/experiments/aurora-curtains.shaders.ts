export const AURORA_CURTAINS_FRAG = `#version 300 es
precision highp float;

uniform sampler2D uField;
uniform float uTime;
uniform float uGhost;
uniform float uSurge;

in vec2 vUv;
out vec4 outColor;

float hash21(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

float vnoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  float a = hash21(i);
  float b = hash21(i + vec2(1.0, 0.0));
  float c = hash21(i + vec2(0.0, 1.0));
  float d = hash21(i + vec2(1.0, 1.0));
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

float fbm(vec2 p) {
  float v = 0.0;
  float amp = 0.5;
  for (int i = 0; i < 4; i++) {
    v += amp * vnoise(p);
    p = p * 2.03 + vec2(19.19, 7.7);
    amp *= 0.5;
  }
  return v * 1.0667;
}

struct Curtain {
  float baseX;
  float driftAmp;
  float driftPeriod;
  float phase;
  float bendAmp;
  float bendFreq;
  float bendSpeed;
  float sigmaSharp;
  float sigmaSoft;
  float rippleFreq;
  float rippleTravel;
  float rippleDepth;
  float gain;
  float seed;
};

float curtain(vec2 uv, float t, Curtain c) {
  float drift = c.driftAmp * sin(6.2831853 * t / c.driftPeriod + c.phase);
  float bend = (fbm(vec2(uv.y * c.bendFreq + c.seed, t * c.bendSpeed + c.seed * 2.7)) - 0.5) * 2.0 * c.bendAmp;
  float xc = c.baseX + drift + bend;
  float d = uv.x - xc;
  float sigma = d < 0.0 ? c.sigmaSharp : c.sigmaSoft;
  float profile = exp(-d * d / (2.0 * sigma * sigma));
  float rip = fbm(vec2(uv.y * c.rippleFreq - t * c.rippleTravel + c.seed * 5.3, t * 0.06 + c.seed));
  float ripple = mix(1.0 - c.rippleDepth, 1.0, smoothstep(0.22, 0.85, rip));
  float breathe = 0.86 + 0.14 * sin(6.2831853 * t / (c.driftPeriod * 1.53) + c.seed * 4.0);
  return profile * ripple * breathe * c.gain;
}

void main() {
  vec2 uv = vUv;
  float t = uTime;
  float ghost = texture(uField, uv).r * uGhost;

  float back = curtain(uv, t, Curtain(
    0.26, 0.05, 19.0, 0.0,
    0.075, 1.3, 0.05,
    0.105, 0.17,
    2.0, 0.13, 0.45,
    0.34, 3.7));
  float mid = curtain(uv, t, Curtain(
    0.62, 0.06, 13.0, 2.1,
    0.095, 1.7, 0.07,
    0.062, 0.105,
    2.8, 0.19, 0.58,
    0.5, 11.2));
  float front = curtain(uv, t, Curtain(
    0.44, 0.07, 8.5, 4.4,
    0.115, 2.2, 0.105,
    0.04, 0.068,
    3.6, 0.27, 0.7,
    0.72, 27.5));

  float aurora = back + mid + front;

  float vfade = smoothstep(0.0, 0.12, uv.y) * smoothstep(1.0, 0.88, uv.y);
  aurora *= mix(0.6, 1.0, vfade);

  if (uSurge >= 0.0) {
    float sx = mix(-0.35, 1.35, uSurge);
    float dx = uv.x - sx;
    float boost = exp(-dx * dx / (2.0 * 0.14 * 0.14));
    aurora = aurora * (1.0 + 1.25 * boost) + 0.14 * boost * mix(0.6, 1.0, vfade);
  }

  float value = min(1.0, ghost + aurora);
  outColor = vec4(vec3(value), 1.0);
}
`;
