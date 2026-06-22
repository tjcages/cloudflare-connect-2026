export const FIELD_FRAG = `#version 300 es
precision highp float;
in vec2 vUv;
uniform float uTime;
out vec4 finalColor;
void main() {
  vec2 c = vUv - 0.5;
  float r = length(c);
  // Deterministic radial gradient with a slow time wobble; grayscale field (white = draw).
  float v = clamp(0.5 + 0.5 * cos(r * 9.0 - uTime * 0.001), 0.0, 1.0);
  finalColor = vec4(vec3(v), 1.0);
}
`;
