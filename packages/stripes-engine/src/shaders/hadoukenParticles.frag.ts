export const HADOUKEN_PARTICLES_FRAG = `#version 300 es
precision highp float;
in vec2 vQuad;
flat in highp float vVal;
out vec4 finalColor;
void main() {
  finalColor = vec4(vec3(vVal), 1.0);
}
`;
