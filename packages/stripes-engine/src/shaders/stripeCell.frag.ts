import { STRIPE_CELL_GLSL } from "./stripeCell.glsl";

/**
 * Resolves one grid cell per texel: colour, post-shuffle width (negative when
 * the cell is hidden), stripe opacity, ramp position, dot eligibility, and the
 * column's motion offset. The stripe pass reads these back with two texel
 * fetches instead of re-deriving them for every fragment the cell covers.
 */
export const STRIPE_CELL_FRAG = `#version 300 es
precision highp float;
in vec2 vUv;
${STRIPE_CELL_GLSL}
layout(location = 0) out vec4 outCellA;
layout(location = 1) out vec4 outCellB;

void main() {
  vec2 cell = floor(vUv * uGridCount);
  CellData d = cellData(cell);
  outCellA = vec4(d.color, d.widthPx);
  outCellB = vec4(d.opacity, d.rampT, d.dotEligible, randomColumnMotionOffset(cell.x));
}
`;
