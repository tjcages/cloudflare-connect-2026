export const ASSEMBLY_SCATTER_FRAG = `#version 300 es
precision highp float;
in vec2 vSampleUv;
in vec2 vBlockLocal;
in float vF;
uniform sampler2D uField;
out vec4 finalColor;

void main() {
  float soft = 1.0 - smoothstep(0.0, 0.7, vF);
  float r = soft * 0.07;
  float v = 0.0;
  v += texture(uField, vSampleUv + vec2(-r, -r)).r * 0.075;
  v += texture(uField, vSampleUv + vec2(0.0, -r)).r * 0.125;
  v += texture(uField, vSampleUv + vec2(r, -r)).r * 0.075;
  v += texture(uField, vSampleUv + vec2(-r, 0.0)).r * 0.125;
  v += texture(uField, vSampleUv).r * 0.2;
  v += texture(uField, vSampleUv + vec2(r, 0.0)).r * 0.125;
  v += texture(uField, vSampleUv + vec2(-r, r)).r * 0.075;
  v += texture(uField, vSampleUv + vec2(0.0, r)).r * 0.125;
  v += texture(uField, vSampleUv + vec2(r, r)).r * 0.075;
  float inner = mix(2.0, 0.0, soft);
  float outer = mix(3.0, 0.62, soft);
  float d = length(vBlockLocal - vec2(0.5));
  float alpha = 1.0 - smoothstep(inner, outer, d);
  finalColor = vec4(vec3(v), alpha);
}
`;
