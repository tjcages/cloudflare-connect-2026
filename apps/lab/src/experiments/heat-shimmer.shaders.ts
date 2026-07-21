export const HEAT_SHIMMER_FIELD_FRAG = `#version 300 es
precision highp float;

uniform sampler2D uField;
uniform vec2 uCssSize;
uniform float uTime;
uniform float uSurge;

in vec2 vUv;
out vec4 outColor;

float hash21(vec2 p) {
  p = fract(p * vec2(127.31, 311.77));
  p += dot(p, p + 47.13);
  return fract(p.x * p.y);
}

float vnoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  float a = hash21(i);
  float b = hash21(i + vec2(1.0, 0.0));
  float c = hash21(i + vec2(0.0, 1.0));
  float d = hash21(i + vec2(1.0, 1.0));
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y) * 2.0 - 1.0;
}

float lateralDrift(float y, float t, float phase, float sc) {
  return (sin(y / (150.0 * sc) + t * 0.31 + phase) * 24.0 +
          sin(y / (430.0 * sc) - t * 0.17 + phase * 1.63) * 42.0 +
          sin(y / (77.0 * sc) + t * 0.53 + phase * 2.41) * 9.0) * sc;
}

float plume(vec2 pos, float t, float phase, float sc, float rise) {
  float drift = lateralDrift(pos.y, t, phase, sc);
  vec2 q = vec2((pos.x + drift) / (62.0 * sc), (pos.y + t * rise) / (208.0 * sc));
  float n = vnoise(q + phase) * 0.62;
  n += vnoise(q * 2.13 + vec2(0.0, t * 0.42) + phase * 1.9) * 0.27;
  n += vnoise(q * 4.47 + vec2(0.0, t * 0.78) + phase * 3.3) * 0.13;
  return n;
}

void main() {
  float sc = clamp(uCssSize.y / 280.0, 0.55, 2.2);
  vec2 pos = vec2(vUv.x, 1.0 - vUv.y) * uCssSize;
  float t = uTime;

  float ny = clamp(pos.y / max(uCssSize.y, 1.0), 0.0, 1.0);
  float falloff = pow(ny, mix(1.75, 0.95, uSurge));

  float colDrift = lateralDrift(pos.y, t, 1.9, sc) * 0.6;
  float column = 0.42 + 0.58 *
    (0.5 + 0.5 * vnoise(vec2((pos.x + colDrift) / (138.0 * sc), t * 0.11 + 17.0)));

  float amp = 16.5 * sc * falloff * column * (1.0 + 2.4 * uSurge);

  float dx = plume(pos, t, 0.0, sc, 118.0);
  float dy = plume(pos, t, 5.31, sc, 152.0);

  vec2 disp = vec2(dx * amp * 0.72, dy * amp);
  vec2 uv = vUv + vec2(disp.x / max(uCssSize.x, 1.0), -disp.y / max(uCssSize.y, 1.0));
  uv = 1.0 - abs(1.0 - abs(uv));

  outColor = vec4(vec3(texture(uField, uv).r), 1.0);
}
`;
