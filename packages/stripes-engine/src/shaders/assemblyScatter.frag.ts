export const ASSEMBLY_SCATTER_FRAG = `#version 300 es
precision highp float;
in vec2 vSampleUv;
uniform sampler2D uField;
out vec4 finalColor;

void main() {
  float v = texture(uField, vSampleUv).r;
  finalColor = vec4(vec3(v), 1.0);
}
`;
