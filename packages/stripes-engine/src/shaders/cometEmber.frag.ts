export const COMET_EMBER_FRAG = `#version 300 es
precision highp float;

in vec2 vLocal;
in float vT;
uniform float uFadeIn;
out vec4 outColor;

void main() {
  float r = length(vLocal);
  float disc = 1.0 - smoothstep(0.46, 0.58, r);
  float t = clamp(vT, 0.0, 1.0);
  float amp = smoothstep(0.0, max(uFadeIn, 1e-3), t) * (1.0 - smoothstep(0.58, 1.0, t));
  outColor = vec4(0.0, disc * amp, 0.0, 1.0);
}
`;
