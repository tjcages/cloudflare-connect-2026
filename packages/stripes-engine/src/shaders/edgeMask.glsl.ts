export const EDGE_MASK_GLSL = `
uniform float uEdgeMaskEnabled;
uniform float uEdgeMaskStart;
uniform float uEdgeMaskEnd;
uniform float uEdgeMaskPower;
uniform vec4 uEdgeMaskSides;

float edgeMaskRamp(float inset, float side) {
  float t = clamp((inset - uEdgeMaskStart) / (uEdgeMaskEnd - uEdgeMaskStart), 0.0, 1.0);
  return mix(1.0, pow(t, uEdgeMaskPower), side);
}

float edgeMaskAlpha(vec2 uv) {
  if (uEdgeMaskEnabled < 0.5) return 1.0;
  vec4 insets = vec4(uv.x, 1.0 - uv.x, uv.y, 1.0 - uv.y);
  return
    edgeMaskRamp(insets.x, uEdgeMaskSides.x) *
    edgeMaskRamp(insets.y, uEdgeMaskSides.y) *
    edgeMaskRamp(insets.z, uEdgeMaskSides.z) *
    edgeMaskRamp(insets.w, uEdgeMaskSides.w);
}
`;
