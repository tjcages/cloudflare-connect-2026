export const ASSEMBLY_SCATTER_FRAG = `#version 300 es
precision highp float;
in vec2 vSampleUv;
in vec2 vBlockLocal;
in float vF;
uniform sampler2D uField;
out vec4 finalColor;

void main() {
  float soft = 1.0 - smoothstep(0.3, 1.0, vF);
  float r = soft * 0.13;
  float v = 0.0;
  float wsum = 0.0;
  for (int j = -2; j <= 2; j++) {
    for (int i = -2; i <= 2; i++) {
      vec2 o = vec2(float(i), float(j)) * (r * 0.5);
      float w = exp(-float(i * i + j * j) * 0.4);
      v += texture(uField, vSampleUv + o).r * w;
      wsum += w;
    }
  }
  v /= wsum;
  finalColor = vec4(vec3(v), 1.0);
}
`;
