export const ASSEMBLY_SCATTER_FRAG = `#version 300 es
precision highp float;
in vec2 vSampleUv;
in vec2 vBlockLocal;
in float vF;
uniform sampler2D uField;
out vec4 finalColor;

void main() {
  float v = texture(uField, vSampleUv).r;
  float feather = 1.0 - min(vF, 1.0);
  float edgeX = smoothstep(0.0, feather * 0.5 + 1e-5, vBlockLocal.x) *
                smoothstep(0.0, feather * 0.5 + 1e-5, 1.0 - vBlockLocal.x);
  float edgeY = smoothstep(0.0, feather * 0.5 + 1e-5, vBlockLocal.y) *
                smoothstep(0.0, feather * 0.5 + 1e-5, 1.0 - vBlockLocal.y);
  float alpha = edgeX * edgeY;
  finalColor = vec4(vec3(v), alpha);
}
`;
