export const PRESENT_FRAG = `#version 300 es
precision highp float;
in vec2 vUv;
uniform sampler2D uField;
out vec4 finalColor;
void main() {
  finalColor = vec4(texture(uField, vUv).rgb, 1.0);
}
`;
