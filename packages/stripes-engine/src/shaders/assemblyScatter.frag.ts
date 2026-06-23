export const ASSEMBLY_SCATTER_FRAG = `#version 300 es
precision highp float;
in vec2 vSampleUv;
in vec2 vBlockLocal;
in float vCellHalf;
uniform sampler2D uField;
out vec4 finalColor;

void main() {
  float v = texture(uField, vSampleUv).r;
  float dx = abs(vBlockLocal.x - 0.5);
  float dy = abs(vBlockLocal.y - 0.5);
  float ax = 1.0 - smoothstep(vCellHalf, 0.5 + 1e-4, dx);
  float ay = 1.0 - smoothstep(vCellHalf, 0.5 + 1e-4, dy);
  finalColor = vec4(vec3(v), ax * ay);
}
`;
