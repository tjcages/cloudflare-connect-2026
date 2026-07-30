import { EDGE_MASK_GLSL } from "./edgeMask.glsl";

export const PRESENT_FRAG = `#version 300 es
precision highp float;
in vec2 vUv;
uniform sampler2D uField;
${EDGE_MASK_GLSL}
out vec4 finalColor;
void main() {
  // Stripes-off debug view. Without this the mask is invisible in exactly the
  // view you would open to inspect it.
  finalColor = vec4(texture(uField, vUv).rgb * edgeMaskAlpha(vUv), 1.0);
}
`;
