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
// as the whitest water that ever reached it (a 0.1-bright ripple leaves it 0.1
// revealed; only a full crest at uFullHeight reveals it completely). Crests
// only — troughs are dark water and must not reveal anything.
void main() {
  float prev = texture(uPrevCover, vUv).r;
  float h = max(texture(uHeight, vUv).r, 0.0);
  float a = clamp((h - uThreshLo) / max(uFullHeight - uThreshLo, 1e-4), 0.0, 1.0);
  a = pow(a, uGamma);
  float cover = max(max(prev, a), uFillFloor);
  outColor = vec4(cover, 0.0, 0.0, 1.0);
}
`;
