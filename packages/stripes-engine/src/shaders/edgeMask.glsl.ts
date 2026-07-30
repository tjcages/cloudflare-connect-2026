/**
 * Edge mask ramp — a final alpha mask on whatever the shader just drew.
 *
 * It deliberately does not look at colour mode, palette opacity, background
 * colour or the presence field. Masking the field instead only steps cells
 * down the stripe LUT, which cannot fade a palette whose low bands are opaque
 * (every light quote palette), and cannot fade anything at all where the
 * source image left the field empty.
 *
 * Ramp maths mirror `edgeMask/edgeMaskMath.ts` exactly, per-side gating
 * included: `uEdgeMaskSides` packs (left, right, bottom, top) because vUv.y is
 * bottom-up, and a disabled side contributes 1.0.
 *
 * `uv` is the CSS-box UV, not the buffer UV — the grow-only canvas presents
 * through a viewport origin, so buffer coordinates would drift the ramp.
 */
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
