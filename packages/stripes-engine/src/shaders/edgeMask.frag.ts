export const EDGE_MASK_FRAG = `#version 300 es
precision highp float;
in vec2 vUv;
uniform sampler2D uField;
uniform float uStart;
uniform float uEnd;
uniform float uPower;
uniform vec4 uSides;
out vec4 finalColor;

float ramp(float inset, float side) {
  float t = clamp((inset - uStart) / (uEnd - uStart), 0.0, 1.0);
  return mix(1.0, pow(t, uPower), side);
}

void main() {
  vec4 insets = vec4(vUv.x, 1.0 - vUv.x, vUv.y, 1.0 - vUv.y);
  float a =
    ramp(insets.x, uSides.x) *
    ramp(insets.y, uSides.y) *
    ramp(insets.z, uSides.z) *
    ramp(insets.w, uSides.w);
  finalColor = vec4(texture(uField, vUv).rgb * a, 1.0);
}
`;
