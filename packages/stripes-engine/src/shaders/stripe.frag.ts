export const STRIPE_FRAG = `#version 300 es
precision highp float;
in vec2 vUv;
uniform sampler2D uCell;
uniform sampler2D uLut;
uniform vec2 uGridCount;
uniform vec2 uCellPx;
uniform float uCorner;
uniform float uOrient;
uniform vec3 uBg;
uniform float uDpr;
uniform float uTimeSec;
uniform float uGapEnabled;
uniform float uGapCoverage;
uniform float uGapPeriodMin;
uniform float uGapPeriodMax;
uniform float uShuffleEnabled;
uniform float uShuffleCoverage;
uniform float uShufflePeriodMin;
uniform float uShufflePeriodMax;
uniform float uShuffleSwingPx;
uniform float uLettersEnabled;
uniform sampler2D uGlyphData;
uniform sampler2D uAtlas;
uniform vec2 uAtlasGrid;
uniform float uLetterSizeScale;
uniform float uUseCellColors;
uniform sampler2D uCellColor;
out vec4 finalColor;

float sdRoundBox(vec2 p, vec2 b, float r) {
  vec2 q = abs(p) - b + r;
  return min(max(q.x, q.y), 0.0) + length(max(q, 0.0)) - r;
}

float sparkleHash(float px, float py) {
  float p3x = fract(px * 0.1031);
  float p3y = fract(py * 0.103);
  float p3z = fract(px * 0.0973);
  float dotVal = p3x * (p3y + 33.33) + p3y * (p3z + 33.33) + p3z * (p3x + 33.33);
  p3x = fract(p3x + dotVal);
  p3y = fract(p3y + dotVal);
  p3z = fract(p3z + dotVal);
  return fract((p3x + p3y) * p3z);
}

float phaseHash(float col, float row) {
  return sparkleHash(col + 53.0, row + 71.0);
}

float periodHash(float col, float row) {
  return sparkleHash(col + 89.0, row + 113.0);
}

float cellSeed(float col, float row) {
  return sparkleHash(col + 17.0, row + 31.0);
}

float altHash(float col, float row, float pulseIndex) {
  return sparkleHash(col + 53.0 + pulseIndex * 61.0, row + 71.0 + pulseIndex * 101.0);
}

struct CellPulse {
  float localTime;
  float period;
  float cycleIndex;
};

CellPulse cellPulse(float col, float row, float timeSec, float coverage, float periodMin, float periodMax) {
  float periodSpan = periodMax - periodMin;
  float period = periodMin + periodHash(col, row) * periodSpan;
  float cyclePeriod = period / max(coverage, 0.001);
  float phaseOffset = phaseHash(col, row) * cyclePeriod;
  float scheduledTime = timeSec + phaseOffset;
  float cycleIndex = floor(scheduledTime / cyclePeriod);
  float localTime = scheduledTime - cycleIndex * cyclePeriod;
  CellPulse p;
  p.localTime = localTime;
  p.period = period;
  p.cycleIndex = cycleIndex;
  return p;
}

bool isGapped(float col, float row) {
  if (uGapCoverage <= 0.0) return false;
  CellPulse p = cellPulse(col, row, uTimeSec, uGapCoverage, uGapPeriodMin, uGapPeriodMax);
  return p.localTime < p.period;
}

float pulseEnvelope(float localT) {
  if (localT < 0.0 || localT > 1.0) return 0.0;
  float cosine = 0.5 - 0.5 * cos(2.0 * 3.141592653589793 * localT);
  float c = clamp(cosine, 0.0, 1.0);
  return c * c * (3.0 - 2.0 * c);
}

float shuffledWidth(float col, float row, float defaultWidth) {
  if (defaultWidth <= 0.0) return defaultWidth;
  if (cellSeed(col, row) >= uShuffleCoverage) return defaultWidth;
  CellPulse p = cellPulse(col, row, uTimeSec, uShuffleCoverage, uShufflePeriodMin, uShufflePeriodMax);
  if (p.localTime >= p.period) return defaultWidth;
  float localT = p.localTime / p.period;
  float h = altHash(col, row, p.cycleIndex);
  float maxWidth = min(255.0, (uOrient < 0.5 ? uCellPx.x : uCellPx.y));
  float tw = clamp(defaultWidth + (h * 2.0 - 1.0) * max(uShuffleSwingPx, 0.0), 1.0, maxWidth);
  float envelope = pulseEnvelope(localT);
  return defaultWidth + (tw - defaultWidth) * envelope;
}

void main() {
  vec2 cellF = vUv * uGridCount;
  vec2 cell = floor(cellF);
  vec2 local = fract(cellF);
  float v = texture(uCell, (cell + 0.5) / uGridCount).r;
  vec4 lut = texture(uLut, vec2((v * 255.0 + 0.5) / 256.0, 0.5));
  vec3 barColor = lut.rgb;
  float barWidthPx = lut.a * 255.0;

  if (uUseCellColors > 0.5) {
    vec4 cc = texture(uCellColor, (cell + 0.5) / uGridCount);
    barColor = cc.rgb;
    float maxBarPx = (uOrient < 0.5) ? uCellPx.x : uCellPx.y;
    barWidthPx = clamp(cc.a, 0.0, 1.0) * maxBarPx;
  }

  if (uShuffleEnabled > 0.5) barWidthPx = shuffledWidth(cell.x, cell.y, barWidthPx);

  if (barWidthPx < 0.5) { finalColor = vec4(uBg, 1.0); return; }

  if (uGapEnabled > 0.5 && uGapCoverage > 0.0 && isGapped(cell.x, cell.y)) { finalColor = vec4(uBg, 1.0); return; }

  vec2 p = (local - 0.5) * uCellPx;
  float w = max(1.0 / uDpr, 1e-4);
  float halfW;
  float halfH;
  if (uOrient < 0.5) {
    halfW = min(barWidthPx, uCellPx.x) * 0.5;
    halfH = uCellPx.y * 0.5;
  } else {
    halfW = uCellPx.x * 0.5;
    halfH = min(barWidthPx, uCellPx.y) * 0.5;
  }
  float r = min(uCorner, (uOrient < 0.5) ? halfW : halfH);
  vec2 halfExt = (uOrient < 0.5) ? vec2(halfW, halfH + r + w) : vec2(halfW + r + w, halfH);
  float d = sdRoundBox(p, halfExt, r);
  float alpha = clamp(0.5 - d / w, 0.0, 1.0);
  finalColor = vec4(mix(uBg, barColor, alpha), 1.0);

  if (uLettersEnabled > 0.5) {
    float data = texture(uGlyphData, (cell + 0.5) / uGridCount).r * 255.0;
    if (data >= 0.5) {
      float gi = floor(data + 0.5) - 1.0;
      vec2 gpos = (local - 0.5) / max(uLetterSizeScale, 0.001) + 0.5;
      if (all(greaterThanEqual(gpos, vec2(0.0))) && all(lessThanEqual(gpos, vec2(1.0)))) {
        float gcol = mod(gi, uAtlasGrid.x);
        float grow = floor(gi / uAtlasGrid.x);
        vec2 atlasUv = (vec2(gcol, grow) + vec2(gpos.x, 1.0 - gpos.y)) / uAtlasGrid;
        float cov = texture(uAtlas, atlasUv).r;
        finalColor.rgb = mix(finalColor.rgb, vec3(1.0), cov);
      }
    }
  }
}
`;
