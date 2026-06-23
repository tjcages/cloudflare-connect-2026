export const BLUR_FRAG = `#version 300 es
precision highp float;
in vec2 vUv;
uniform sampler2D uTex;
uniform vec2 uStep;
out vec4 finalColor;

void main() {
  float w0 = 0.22702703;
  float w1 = 0.19459460;
  float w2 = 0.12162162;
  float w3 = 0.05405405;
  float w4 = 0.01621622;
  vec4 c =
    texture(uTex, vUv + uStep * -4.0) * w4 +
    texture(uTex, vUv + uStep * -3.0) * w3 +
    texture(uTex, vUv + uStep * -2.0) * w2 +
    texture(uTex, vUv + uStep * -1.0) * w1 +
    texture(uTex, vUv              ) * w0 +
    texture(uTex, vUv + uStep *  1.0) * w1 +
    texture(uTex, vUv + uStep *  2.0) * w2 +
    texture(uTex, vUv + uStep *  3.0) * w3 +
    texture(uTex, vUv + uStep *  4.0) * w4;
  finalColor = c;
}
`;
