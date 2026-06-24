export const CURSOR_TEAR_FRAG = `#version 300 es
precision highp float;
in vec2 vUv;
uniform sampler2D uAccum;
uniform vec2 uTexel;
uniform float uTearStrength;
out vec4 finalColor;

void main() {
  float pushXRight = texture(uAccum, vUv + vec2(uTexel.x, 0.0)).g;
  float pushXLeft = texture(uAccum, vUv - vec2(uTexel.x, 0.0)).g;
  float pushYDown = texture(uAccum, vUv + vec2(0.0, uTexel.y)).b;
  float pushYUp = texture(uAccum, vUv - vec2(0.0, uTexel.y)).b;

  float divergence = (pushXRight - pushXLeft) + (pushYDown - pushYUp);
  float tear = clamp(uTearStrength * max(0.0, divergence), 0.0, 1.0);

  finalColor = vec4(tear, 0.0, 0.0, 1.0);
}
`;
