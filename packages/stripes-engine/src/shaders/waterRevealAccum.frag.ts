export const WATER_REVEAL_ACCUM_FRAG = `#version 300 es
precision highp float;
in vec2 vUv;
uniform sampler2D uPrevCover;
uniform sampler2D uHeight;
uniform float uThreshLo;
uniform float uThreshHi;
uniform float uFillFloor;
out vec4 outColor;

void main() {
  float prev = texture(uPrevCover, vUv).r;
  float h = abs(texture(uHeight, vUv).r);
  float energy = smoothstep(uThreshLo, uThreshHi, h);
  float cover = max(max(prev, energy), uFillFloor);
  outColor = vec4(cover, 0.0, 0.0, 1.0);
}
`;
