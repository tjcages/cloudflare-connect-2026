export const CLICK_SPLAT_VERT = `#version 300 es
precision highp float;
in vec2 aCenterCell;
in float aRadiusCell;
in float aHalfStrokeCell;
in float aPushBandCell;
in float aPushPeak;
in float aWhiteAmt;
in float aProgress;
in float aSeed;
uniform vec2 uGridSize;
out vec2 vCenterCell;
out float vRadiusCell;
out float vHalfStrokeCell;
out float vPushBandCell;
out float vPushPeak;
out float vWhiteAmt;
out float vProgress;
out float vSeed;
out float vWobbleAmplitude;
void main() {
  vec2 corner = vec2(
    float(gl_VertexID == 1 || gl_VertexID == 4 || gl_VertexID == 5),
    float(gl_VertexID == 2 || gl_VertexID == 3 || gl_VertexID == 5)
  );
  float wobbleAmplitude = max(1.0, aRadiusCell * 0.18);
  float reachCell = aRadiusCell + max(aHalfStrokeCell, aPushBandCell) + wobbleAmplitude + 1.0;
  vec2 quadOriginCell = aCenterCell - reachCell;
  vec2 quadSizeCell = vec2(reachCell * 2.0);
  vec2 cell = quadOriginCell + corner * quadSizeCell;
  vec2 uv = cell / uGridSize;
  gl_Position = vec4(uv.x * 2.0 - 1.0, uv.y * 2.0 - 1.0, 0.0, 1.0);
  vCenterCell = aCenterCell;
  vRadiusCell = aRadiusCell;
  vHalfStrokeCell = aHalfStrokeCell;
  vPushBandCell = aPushBandCell;
  vPushPeak = aPushPeak;
  vWhiteAmt = aWhiteAmt;
  vProgress = aProgress;
  vSeed = aSeed;
  vWobbleAmplitude = wobbleAmplitude;
}
`;
