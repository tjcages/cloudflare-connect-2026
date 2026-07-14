export const LETTER_DATA_FRAG = `#version 300 es
precision highp float;

in vec2 vUv;

uniform sampler2D uCell;
uniform vec2 uGridSize;
uniform float uTopBandThreshold;
uniform float uCoverage;
uniform float uTimeSec;
uniform float uCharsetLen;
uniform float uShuffleSpeed;
uniform vec2 uPosition;
uniform vec2 uArea;

out vec4 finalColor;

const float BASE_DELAY_SEC = 0.25;
const float JITTER_SEC = 0.3;
const float BURST_SEC = 0.18;
const float STEP_SEC = 0.045;
const float K1 = 137.0;
const float K2 = 61.0;

float cellHash(float col, float row, float salt) {
  float x = sin(col * 12.9898 + row * 78.233 + salt * 43.7381) * 43758.5453;
  return fract(x);
}

float letterBaseGlyph(float col, float row) {
  float h = cellHash(col, row, 2.0);
  return min(floor(h * uCharsetLen), uCharsetLen - 1.0);
}

float letterGlyphAt(float col, float row) {
  float speed = max(uShuffleSpeed, 0.05);
  float jitter = cellHash(col, row, 3.0);
  float cycleLen = (BASE_DELAY_SEC + jitter * JITTER_SEC) / speed;
  float burstDur = BURST_SEC / speed;
  float stepDur = STEP_SEC / speed;

  float cycleIndex = floor(uTimeSec / cycleLen);
  float localTime = uTimeSec - cycleIndex * cycleLen;

  if (localTime >= burstDur) {
    return letterBaseGlyph(col, row);
  }

  float stepIndex = floor(localTime / stepDur);
  float h = cellHash(col + K1 * cycleIndex + K2 * stepIndex, row + K1 * stepIndex + K2 * cycleIndex, 5.0);
  return min(floor(h * uCharsetLen), uCharsetLen - 1.0);
}

void main() {
  float cols = uGridSize.x;
  float rows = uGridSize.y;
  float col = floor(vUv.x * cols);
  float row = floor(vUv.y * rows);

  float luma = texture(uCell, vUv).r;
  vec2 cellCenter = (vec2(col, row) + 0.5) / uGridSize;
  vec2 halfArea = max(uArea * 0.5, vec2(0.0001));
  bool insideArea = all(lessThanEqual(abs(cellCenter - uPosition), halfArea));

  bool present = insideArea && (uCoverage > 0.0) && (luma >= uTopBandThreshold) && (cellHash(col, row, 1.0) < uCoverage);
  float gi = letterGlyphAt(col, row);

  finalColor = vec4((present ? (gi + 1.0) : 0.0) / 255.0, 0.0, 0.0, 1.0);
}
`;
