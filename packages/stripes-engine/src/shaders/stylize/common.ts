export const STYLIZE_COMMON = `#version 300 es
precision highp float;
in vec2 vUv;
uniform sampler2D uTex;
uniform sampler2D uStripes;
uniform vec3 uColorA;
uniform vec3 uColorB;
uniform float uTime;
uniform float uIntensity;
uniform vec2 uResolution;
uniform float uDpr;
uniform vec4 uParams;
out vec4 fragColor;

float hash21(vec2 p){ p = fract(p * vec2(123.34, 345.45)); p += dot(p, p + 34.345); return fract(p.x * p.y); }
float vnoise(vec2 p){
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float a = hash21(i), b = hash21(i + vec2(1.0, 0.0));
  float c = hash21(i + vec2(0.0, 1.0)), d = hash21(i + vec2(1.0, 1.0));
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}
float fbm(vec2 p){ float s = 0.0, a = 0.5; for (int i = 0; i < 5; i++){ s += a * vnoise(p); p *= 2.0; a *= 0.5; } return s; }
vec2 warp(vec2 uv, vec2 freq, float scale, float t){
  float nx = fbm(uv * freq + vec2(0.0, t));
  float ny = fbm(uv * freq + vec2(5.2, 1.3) - vec2(t, 0.0));
  return uv + (vec2(nx, ny) - 0.5) * scale;
}
float grain(vec2 uv, float t){ return hash21(uv * uResolution + t); }
float luma(vec3 c){ return dot(c, vec3(0.299, 0.587, 0.114)); }
vec3 blurTex(vec2 uv, float px){
  vec2 o = px / uResolution;
  vec3 s = texture(uTex, uv).rgb * 0.4;
  s += texture(uTex, uv + vec2(o.x, 0.0)).rgb * 0.15;
  s += texture(uTex, uv - vec2(o.x, 0.0)).rgb * 0.15;
  s += texture(uTex, uv + vec2(0.0, o.y)).rgb * 0.15;
  s += texture(uTex, uv - vec2(0.0, o.y)).rgb * 0.15;
  return s;
}
`;
