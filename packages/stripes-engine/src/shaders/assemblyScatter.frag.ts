export const ASSEMBLY_SCATTER_FRAG = `#version 300 es
precision highp float;
in vec2 vSampleUv;
flat in highp float vBlurAmount;
flat in vec2 vRectMin;
flat in vec2 vRectMax;
uniform sampler2D uField;
uniform sampler2D uBlurQuarter;
uniform sampler2D uBlurHalf;
uniform sampler2D uBlurFull;
uniform vec2 uSigmaUv;
out vec4 finalColor;

void main() {
  float s = vBlurAmount;
  vec2 suv = clamp(vSampleUv, vRectMin, vRectMax);
  float v;
  if (s <= 0.0) {
    v = texture(uField, suv).r;
  } else if (s <= 0.25) {
    v = mix(texture(uField, suv).r, texture(uBlurQuarter, suv).r, s * 4.0);
  } else if (s <= 0.5) {
    v = mix(texture(uBlurQuarter, suv).r, texture(uBlurHalf, suv).r, (s - 0.25) * 4.0);
  } else {
    v = mix(texture(uBlurHalf, suv).r, texture(uBlurFull, suv).r, (s - 0.5) * 2.0);
  }
  vec2 r = max(s * uSigmaUv, vec2(1e-6));
  float cov = smoothstep(vRectMin.x - r.x, vRectMin.x + r.x, vSampleUv.x) *
    (1.0 - smoothstep(vRectMax.x - r.x, vRectMax.x + r.x, vSampleUv.x)) *
    smoothstep(vRectMin.y - r.y, vRectMin.y + r.y, vSampleUv.y) *
    (1.0 - smoothstep(vRectMax.y - r.y, vRectMax.y + r.y, vSampleUv.y));
  finalColor = vec4(vec3(v * cov), 1.0);
}
`;
