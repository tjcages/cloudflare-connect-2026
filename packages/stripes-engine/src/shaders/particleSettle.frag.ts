export const PARTICLE_SETTLE_FRAG = `#version 300 es
precision highp float;
in vec2 vUv;
uniform sampler2D uField;
out vec4 finalColor;
void main() {
  finalColor = vec4(vec3(texture(uField, vUv).r), 1.0);
}
`;
