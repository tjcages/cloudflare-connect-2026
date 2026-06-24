export const EDGE_MASK_FRAG = `#version 300 es
precision highp float;
in vec2 vUv;
uniform sampler2D uField;
uniform float uStart;
uniform float uEnd;
uniform float uPower;
out vec4 finalColor;

float ramp(float inset) {
  float t = clamp((inset - uStart) / (uEnd - uStart), 0.0, 1.0);
  return pow(t, uPower);
}

void main() {
  float insetX = min(vUv.x, 1.0 - vUv.x);
  float insetY = min(vUv.y, 1.0 - vUv.y);
  float a = ramp(insetX) * ramp(insetY);
  finalColor = vec4(texture(uField, vUv).rgb * a, 1.0);
}
`;
