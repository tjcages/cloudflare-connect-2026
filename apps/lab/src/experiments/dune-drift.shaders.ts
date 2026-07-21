export const DUNE_FIELD_FRAG = `#version 300 es
precision highp float;

uniform sampler2D uField;
uniform vec2 uCssSize;
uniform float uDrift;
uniform float uMorph;
uniform float uGust;

in vec2 vUv;
out vec4 outColor;

const vec2 WIND_DIR = vec2(0.9659, -0.2588);
const mat2 RIDGE_ROT = mat2(0.9659, 0.2588, -0.2588, 0.9659);

float hash21(vec2 p) {
  p = fract(p * vec2(123.34, 345.45));
  p += dot(p, p + 34.345);
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
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

float ridge(vec2 p) {
  float n = 1.0 - abs(2.0 * vnoise(p) - 1.0);
  return n * n;
}

float duneHeight(vec2 q, float morph) {
  float sum = 0.0;
  float norm = 0.0;
  float amp = 1.0;
  float freq = 1.0;
  vec2 dir = vec2(0.31, 0.19);
  for (int i = 0; i < 4; i++) {
    sum += ridge(q * freq + dir * morph) * amp;
    norm += amp;
    amp *= 0.48;
    freq *= 2.07;
    dir = vec2(dir.y, -dir.x) * 1.35;
  }
  return sum / norm;
}

void main() {
  float sc = clamp(min(uCssSize.x, uCssSize.y) / 300.0, 0.55, 2.4);
  vec2 pos = vec2(vUv.x, 1.0 - vUv.y) * uCssSize;

  vec2 p = pos - WIND_DIR * uDrift;
  vec2 q = RIDGE_ROT * p / (118.0 * sc);
  q.y *= 0.30;

  float h = duneHeight(q, uMorph);
  float hc = h - 0.44;

  float amp = (25.0 + 16.0 * uGust) * sc;
  vec2 disp = vec2(WIND_DIR.x * 0.30, 1.0) * hc * amp;

  float across = dot(pos, vec2(-WIND_DIR.y, WIND_DIR.x));
  float along = dot(pos, WIND_DIR) - uDrift;
  float streak = vnoise(vec2(along / (60.0 * sc), across / (9.0 * sc))) - 0.5;
  disp += WIND_DIR * streak * uGust * 22.0 * sc;

  vec2 uv = clamp(vUv + vec2(disp.x / uCssSize.x, -disp.y / uCssSize.y), 0.0, 1.0);
  float base = texture(uField, uv).r;

  float crest = smoothstep(0.44, 0.90, h);
  float trough = smoothstep(0.40, 0.04, h);
  float density = 0.30 + 0.14 * uGust;
  float value = base + crest * density - trough * (density * 0.78);

  float line = smoothstep(0.82, 0.99, h);
  value += line * (0.08 + 0.06 * uGust);

  outColor = vec4(vec3(clamp(value, 0.0, 1.0)), 1.0);
}
`;
