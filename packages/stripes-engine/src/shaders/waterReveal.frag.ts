export const WATER_REVEAL_FRAG = `#version 300 es
precision highp float;
in vec2 vUv;
uniform sampler2D uField;
uniform sampler2D uCover;
uniform sampler2D uHeight;
uniform vec2 uHeightTexel;
uniform float uRefraction;
uniform float uWhiteK;
uniform float uGlow;
uniform float uActive;
uniform float uFade;
out vec4 finalColor;

// Water alpha compresses instead of clipping: crest/(crest+K) approaches 1 but
// never reaches it, so a strong splat stays a gradient rather than flattening
// into a solid white plateau. Must match the same curve in waterRevealAccum.
float waterAlpha(float crest, float k) {
  return crest / (crest + k);
}

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
  vec2 uv = clamp(vUv - grad * uRefraction * 0.04 * uFade, 0.0, 1.0);
  float v = texture(uField, uv).r;
  float crest = max(texture(uHeight, vUv).r, 0.0);
  v = clamp(v + waterAlpha(crest, uWhiteK) * uGlow * uFade, 0.0, 1.0);
  float cover = mix(1.0, texture(uCover, vUv).r, uFade);
  finalColor = vec4(vec3(v * cover), 1.0);
}
`;
