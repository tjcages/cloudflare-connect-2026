export const CURSOR_SPLAT_VERT = `#version 300 es
precision highp float;
in vec2 aCenterCell;
in float aBrightenRadiusCell;
in vec2 aPushCenterCell;
in float aPushRadiusCell;
in float aAlpha;
in float aProgress;
in float aSeed;
uniform vec2 uGridSize;
out vec2 vCenterCell;
out float vBrightenRadiusCell;
out vec2 vPushCenterCell;
out float vPushRadiusCell;
out float vAlpha;
out float vProgress;
out float vSeed;
void main() {
  vec2 corner = vec2(
    float(gl_VertexID == 1 || gl_VertexID == 4 || gl_VertexID == 5),
    float(gl_VertexID == 2 || gl_VertexID == 3 || gl_VertexID == 5)
  );
  float reachCell = max(aBrightenRadiusCell, aPushRadiusCell) + 1.0;
  vec2 quadOriginCell = aCenterCell - reachCell;
  vec2 quadSizeCell = vec2(reachCell * 2.0);
  vec2 cell = quadOriginCell + corner * quadSizeCell;
  vec2 uv = cell / uGridSize;
  gl_Position = vec4(uv.x * 2.0 - 1.0, uv.y * 2.0 - 1.0, 0.0, 1.0);
  vCenterCell = aCenterCell;
  vBrightenRadiusCell = aBrightenRadiusCell;
  vPushCenterCell = aPushCenterCell;
  vPushRadiusCell = aPushRadiusCell;
  vAlpha = aAlpha;
  vProgress = aProgress;
  vSeed = aSeed;
}
`;
