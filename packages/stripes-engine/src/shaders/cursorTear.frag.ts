export const CURSOR_TEAR_FRAG = `#version 300 es
precision highp float;
in vec2 vUv;
uniform sampler2D uAccum;
uniform vec2 uTexel;
uniform float uTearStrength;
out vec4 finalColor;

vec2 capPush(vec2 p) {
  float L = length(p);
  return L > 2.0 ? p * (2.0 / L) : p;
}

void main() {
  vec2 pushRight = capPush(texture(uAccum, vUv + vec2(uTexel.x, 0.0)).gb);
  vec2 pushLeft = capPush(texture(uAccum, vUv - vec2(uTexel.x, 0.0)).gb);
  vec2 pushDown = capPush(texture(uAccum, vUv + vec2(0.0, uTexel.y)).gb);
  vec2 pushUp = capPush(texture(uAccum, vUv - vec2(0.0, uTexel.y)).gb);

  float divergence = (pushRight.x - pushLeft.x) + (pushDown.y - pushUp.y);
  float tear = clamp(uTearStrength * max(0.0, divergence), 0.0, 1.0);

  finalColor = vec4(tear, 0.0, 0.0, 1.0);
}
`;
