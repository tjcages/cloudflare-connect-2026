export const ASSEMBLY_SCATTER_FRAG = `#version 300 es
precision highp float;
in vec2 vSampleUv;
in vec2 vBlockLocal;
in float vF;
uniform sampler2D uField;
out vec4 finalColor;

void main() {
  float soft = 1.0 - smoothstep(0.0, 0.65, vF);
  float blur = soft * 0.014;
  float v = texture(uField, vSampleUv).r * 0.36;
  v += texture(uField, vSampleUv + vec2(blur, 0.0)).r * 0.16;
  v += texture(uField, vSampleUv + vec2(-blur, 0.0)).r * 0.16;
  v += texture(uField, vSampleUv + vec2(0.0, blur)).r * 0.16;
  v += texture(uField, vSampleUv + vec2(0.0, -blur)).r * 0.16;
  float fw = soft * 0.9 + 1e-5;
  float edgeX = smoothstep(0.0, fw, vBlockLocal.x) * smoothstep(0.0, fw, 1.0 - vBlockLocal.x);
  float edgeY = smoothstep(0.0, fw, vBlockLocal.y) * smoothstep(0.0, fw, 1.0 - vBlockLocal.y);
  float alpha = edgeX * edgeY;
  finalColor = vec4(vec3(v), alpha);
}
`;
