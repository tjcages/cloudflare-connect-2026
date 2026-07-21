export const WATER_REVEAL_ACCUM_FRAG = `#version 300 es
precision highp float;
in vec2 vUv;
uniform sampler2D uPrevCover;
uniform sampler2D uHeight;
uniform float uThreshLo;
uniform float uThreshHi;
uniform float uFillFloor;
uniform float uAccumRate;
out vec4 outColor;

// Cover integrates wave energy instead of latching on first contact, so a pixel
// only reaches full reveal where strong crests actually worked on it; distant
// spill-over ripples leave a faint partial reveal proportional to their strength.
void main() {
  float prev = texture(uPrevCover, vUv).r;
  float h = abs(texture(uHeight, vUv).r);
  float energy = smoothstep(uThreshLo, uThreshHi, h);
  float cover = min(1.0, prev + energy * energy * uAccumRate);
  cover = max(cover, uFillFloor);
  outColor = vec4(cover, 0.0, 0.0, 1.0);
}
`;
