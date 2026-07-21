export const WATER_REVEAL_ACCUM_FRAG = `#version 300 es
precision highp float;
in vec2 vUv;
uniform sampler2D uPrevCover;
uniform sampler2D uHeight;
uniform float uWhiteK;
uniform float uGamma;
uniform float uFillFloor;
out vec4 outColor;

// Cover is a peak-hold of the water's alpha: a pixel is revealed exactly as much
// as the whitest water that ever reached it. The alpha curve must stay identical
// to waterAlpha() in waterReveal.frag, or the reveal stops matching what the
// water looks like. Crests only — troughs are dark water and reveal nothing.
void main() {
  float prev = texture(uPrevCover, vUv).r;
  float h = max(texture(uHeight, vUv).r, 0.0);
  float a = pow(h / (h + uWhiteK), uGamma);
  float cover = max(max(prev, a), uFillFloor);
  outColor = vec4(cover, 0.0, 0.0, 1.0);
}
`;
