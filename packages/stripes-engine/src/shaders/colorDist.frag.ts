import { COLOR_ADJUST_GLSL } from "./colorAdjust.glsl";

export const COLOR_DIST_FRAG = `#version 300 es
precision highp float;
in vec2 vUv;
out vec4 finalColor;
${COLOR_ADJUST_GLSL}
void main() {
  vec3 col = adjustedColor(vUv);
  float d = clamp(length(col - uColorBg) / sqrt(3.0), 0.0, 1.0);
  finalColor = vec4(d, 0.0, 0.0, 1.0);
}
`;
