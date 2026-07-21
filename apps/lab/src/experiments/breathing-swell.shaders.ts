export const BREATHING_SWELL_FRAG = `#version 300 es
precision highp float;

uniform sampler2D uField;
uniform vec2 uCssSize;
uniform float uTime;
uniform float uBoost;

in vec2 vUv;
out vec4 outColor;

const float TAU = 6.2831853;

void main() {
  float h = max(uCssSize.y, 1.0);
  vec2 pos = vec2(vUv.x, 1.0 - vUv.y) * uCssSize;
  float t = uTime;

  float theta = t * 0.7308;
  float breath = 0.5 + 0.5 * sin(theta - 0.38 * sin(theta));
  breath = mix(breath, 0.5 + 0.5 * sin(t * 0.3191 + 1.7), 0.28);
  float amp = (0.58 + 0.42 * breath) * uBoost;

  vec2 dirs[3];
  dirs[0] = normalize(vec2(0.42, 0.91));
  dirs[1] = normalize(vec2(-0.68, 0.73));
  dirs[2] = normalize(vec2(0.13, 0.99));

  float lambda[3];
  lambda[0] = 1.15 * h;
  lambda[1] = 0.72 * h;
  lambda[2] = 1.90 * h;

  float ampl[3];
  ampl[0] = 0.045 * h;
  ampl[1] = 0.028 * h;
  ampl[2] = 0.060 * h;

  float speed[3];
  speed[0] = 0.1449;
  speed[1] = 0.1075;
  speed[2] = 0.0763;

  float dy = 0.0;
  float dx = 0.0;
  float compress = 0.0;

  for (int i = 0; i < 3; i++) {
    float k = TAU / lambda[i];
    float drift = 0.42 * sin(t * 0.1103 + float(i) * 2.1);
    float phase = dot(pos, dirs[i]) * k - TAU * speed[i] * t + drift;
    float s = sin(phase);
    dy += ampl[i] * s;
    dx += ampl[i] * dirs[i].x * s * 0.25;
    compress += ampl[i] * k * dirs[i].y * cos(phase);
  }

  dy *= amp;
  dx *= amp;
  compress *= amp;

  vec2 uv = clamp(vUv + vec2(dx / max(uCssSize.x, 1.0), -dy / h), 0.0, 1.0);
  float base = texture(uField, uv).r;
  float gain = 1.0 + 0.30 * clamp(compress, -0.7, 0.7);

  outColor = vec4(vec3(clamp(base * gain, 0.0, 1.0)), 1.0);
}
`;
