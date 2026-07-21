export const WATER_REVEAL_ACCUM_FRAG = `#version 300 es
precision highp float;
in vec2 vUv;
uniform sampler2D uPrevCover;
uniform sampler2D uHeight;
uniform float uThreshLo;
uniform float uFullHeight;
uniform float uGamma;
uniform float uFillFloor;
out vec4 outColor;

// Cover is a peak-hold of wave brightness: a pixel is revealed exactly as much
// as the strongest wave that ever reached it (a 0.1-high ripple leaves it 0.1
// revealed; only a full crest at uFullHeight reveals it completely).
void main() {
  float prev = texture(uPrevCover, vUv).r;
  float h = abs(texture(uHeight, vUv).r);
  float a = clamp((h - uThreshLo) / max(uFullHeight - uThreshLo, 1e-4), 0.0, 1.0);
  a = pow(a, uGamma);
  float cover = max(max(prev, a), uFillFloor);
  outColor = vec4(cover, 0.0, 0.0, 1.0);
}
`;
