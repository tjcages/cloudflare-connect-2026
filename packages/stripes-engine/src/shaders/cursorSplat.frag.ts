export const CURSOR_SPLAT_FRAG = `#version 300 es
precision highp float;
in vec2 vCenterCell;
in float vBrightenRadiusCell;
in vec2 vPushCenterCell;
in float vPushRadiusCell;
in float vAlpha;
in float vProgress;
in float vSeed;
uniform vec2 uGridSize;
uniform float uPushScale;
out vec4 finalColor;

float falloff(float distance, float radius) {
  if (radius <= 0.0 || distance >= radius) {
    return 0.0;
  }
  float t = 1.0 - distance / radius;
  return t * t * (3.0 - 2.0 * t);
}

float clickSeededUnit(float seed, float salt) {
  float x = sin(seed * 12.9898 + salt * 78.233) * 43758.5453;
  return x - floor(x);
}

float clickDissolveProgress(float waveProgress) {
  float t = clamp((waveProgress - 0.4) / 0.6, 0.0, 1.0);
  return t * t * (3.0 - 2.0 * t);
}

bool clickCellDissolved(float seed, float cellIdx, float dissolve) {
  return dissolve > 0.0 && clickSeededUnit(seed, cellIdx * 7.13 + 3.7) < dissolve;
}

void main() {
  vec2 cell = floor(gl_FragCoord.xy);
  float cellIdx = cell.y * uGridSize.x + cell.x;

  float dissolve = clickDissolveProgress(vProgress);
  if (clickCellDissolved(vSeed, cellIdx, dissolve)) {
    discard;
  }

  float distC = length(cell - vCenterCell);
  float brighten = vAlpha * falloff(distC, vBrightenRadiusCell);

  vec2 toCell = cell - vPushCenterCell;
  float distP = length(toCell);
  float pushX = 0.0;
  float pushY = 0.0;
  if (distP > 0.0 && distP < vPushRadiusCell) {
    float force = uPushScale * vAlpha * falloff(distP, vPushRadiusCell);
    vec2 dir = toCell / distP;
    pushX = force * dir.x;
    pushY = force * dir.y;
  }

  if (brighten <= 0.0 && pushX == 0.0 && pushY == 0.0) {
    discard;
  }

  finalColor = vec4(brighten, pushX, pushY, 0.0);
}
`;
