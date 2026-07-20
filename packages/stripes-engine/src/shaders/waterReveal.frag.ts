export const WATER_REVEAL_FRAG = `#version 300 es
precision highp float;
in vec2 vUv;
uniform sampler2D uField;
uniform sampler2D uCover;
uniform sampler2D uHeight;
uniform vec2 uHeightTexel;
uniform float uRefraction;
uniform float uActive;
out vec4 finalColor;

void main() {
  if (uActive < 0.5) {
    finalColor = vec4(vec3(texture(uField, vUv).r), 1.0);
    return;
  }
  float hL = texture(uHeight, vUv - vec2(uHeightTexel.x, 0.0)).r;
  float hR = texture(uHeight, vUv + vec2(uHeightTexel.x, 0.0)).r;
  float hT = texture(uHeight, vUv + vec2(0.0, uHeightTexel.y)).r;
  float hB = texture(uHeight, vUv - vec2(0.0, uHeightTexel.y)).r;
  vec2 grad = vec2(hR - hL, hT - hB);
  vec2 uv = clamp(vUv - grad * uRefraction * 0.04, 0.0, 1.0);
  float v = texture(uField, uv).r;
  float crest = max(texture(uHeight, vUv).r, 0.0);
  v = clamp(v + crest * uRefraction * 0.22, 0.0, 1.0);
  float cover = texture(uCover, vUv).r;
  finalColor = vec4(vec3(v * cover), 1.0);
}
`;
