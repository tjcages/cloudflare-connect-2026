export const ASSEMBLY_SCATTER_FRAG = `#version 300 es
precision highp float;
in vec2 vSampleUv;
in vec2 vBlockLocal;
in float vSoft;
uniform sampler2D uField;
out vec4 finalColor;

void main() {
  float v = texture(uField, vSampleUv).r;
  float fw = vSoft * 0.5 + 1e-5;
  float ex = smoothstep(0.0, fw, vBlockLocal.x) * smoothstep(0.0, fw, 1.0 - vBlockLocal.x);
  float ey = smoothstep(0.0, fw, vBlockLocal.y) * smoothstep(0.0, fw, 1.0 - vBlockLocal.y);
  finalColor = vec4(vec3(v), ex * ey);
}
`;
