import { COLOR_ADJUST_GLSL } from "./colorAdjust.glsl";

export const SOURCE_FIELD_COLOR_FRAG = `#version 300 es
precision highp float;
in vec2 vUv;
uniform float uMaxColorDist;  // largest in-texture distance from uColorBg (0..sqrt(3))
layout(location=0) out vec4 oField;
layout(location=1) out vec4 oColor;
${COLOR_ADJUST_GLSL}
void main() {
  vec3 col = adjustedColor(vUv);
  float presence = min(1.0, length(col - uColorBg) / max(uMaxColorDist, 1e-4));
  oField = vec4(vec3(presence), 1.0);
  oColor = vec4(col, presence);
}
`;
