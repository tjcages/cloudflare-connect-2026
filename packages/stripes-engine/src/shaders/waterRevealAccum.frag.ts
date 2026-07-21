export const WATER_REVEAL_ACCUM_FRAG = `#version 300 es
precision highp float;
in vec2 vUv;
uniform sampler2D uPrevCover;
uniform sampler2D uHeight;
uniform float uRevealK;
uniform float uGamma;
uniform float uSoak;
out vec4 outColor;

// Cover is driven only by the water that touches each pixel — there is no global
// end-of-animation fill, so a pixel the water never reaches stays hidden.
// Two ways water reveals, both local:
//   peak  — the whitest water that ever hit it, immediate
//   soak  — water that keeps washing over it finishes it off
// Soak is what completes the image: the weakest pixels only ever see a crest of
// ~0.1, so peak alone cannot reach 1 and the reveal would pop at the end.
void main() {
  float prev = texture(uPrevCover, vUv).r;
  float h = max(texture(uHeight, vUv).r, 0.0);
  float a = pow(h / (h + uRevealK), uGamma);
  float cover = min(1.0, max(prev, a) + a * uSoak);
  outColor = vec4(cover, 0.0, 0.0, 1.0);
}
`;
