export const STRIPE_FRAG = `#version 300 es
precision highp float;
in vec2 vUv;
uniform sampler2D uCell;
uniform sampler2D uLut;
uniform sampler2D uOpacityLut;
uniform vec2 uGridCount;
uniform vec2 uCellPx;
uniform vec2 uGridGapPx;
uniform float uCorner;
uniform float uOrient;
uniform float uAngleDeg;
uniform float uRotationMode;
uniform float uCellMin;
uniform float uCellMax;
uniform vec3 uBg;
uniform float uBgAlpha;
uniform float uTransparent;
uniform float uBgGradientEnabled;
uniform float uBgGradientDirection;
uniform float uBgGradientStopCount;
uniform vec3 uBgGradientStop0;
uniform vec3 uBgGradientStop1;
uniform vec3 uBgGradientStop2;
uniform vec3 uBgGradientStop3;
uniform float uBgGridEnabled;
uniform vec2 uBgGridCellPx;
uniform vec2 uBgGridGapPx;
uniform float uBgGridCorner;
uniform vec3 uBgGridColor;
uniform float uBgGridOpacity;
uniform vec2 uDisplayPx;
uniform float uDpr;
uniform float uTimeSec;
uniform float uGapEnabled;
uniform float uGapCoverage;
uniform float uGapPeriodMin;
uniform float uGapPeriodMax;
uniform float uStripeSparkleEnabled;
uniform float uStripeSparkleCoverage;
uniform float uStripeSparkleMaxBrightness;
uniform float uStripeSparkleSpeed;
uniform float uStripeSparkleMinWidthPx;
uniform float uStripeSparkleHueDriftDeg;
uniform float uStripeSparkleSaturationBoost;
uniform float uStripeDotsEnabled;
uniform float uStripeDotsSizePx;
uniform float uStripeDotsBrightness;
uniform float uStripeDotsHueDriftDeg;
uniform float uStripeDotsSaturationBoost;
uniform float uStripeBorderEnabled;
uniform float uStripeBorderMinWidthPx;
uniform float uStripeBorderDensity;
uniform float uGridLinesEnabled;
uniform float uGridLinesBrightness;
uniform float uGridLinesDensity;
uniform float uShuffleEnabled;
uniform float uShuffleCoverage;
uniform float uShufflePeriodMin;
uniform float uShufflePeriodMax;
uniform float uShuffleSwingPx;
uniform float uMotionEnabled;
uniform float uMotionAmplitudePx;
uniform float uMotionStaggerPx;
uniform float uMotionMaxOffsetPx;
uniform float uMotionSpeed;
uniform float uLettersEnabled;
uniform sampler2D uGlyphData;
uniform sampler2D uAtlas;
uniform vec2 uAtlasGrid;
uniform float uLetterSizeScale;
uniform float uUseCellColors;
uniform sampler2D uCellColor;
uniform float uImageColorLightness;
uniform float uImageColorDensity;
uniform float uOverlapAmount;
uniform float uStreamGapWaveEnabled;
uniform float uStreamGapWaveSqueeze;
uniform float uStreamGapWaveWavelengthCells;
uniform float uStreamGapWaveSpeed;
uniform float uStreamGapWavePhaseDeg;
uniform vec3 uLetterColor;
uniform float uBlendMode;
uniform float uGradientEnabled;
uniform float uGradientDirection;
uniform float uGradientStopCount;
uniform vec3 uGradientStop0;
uniform vec3 uGradientStop1;
uniform vec3 uGradientStop2;
uniform vec3 uGradientStop3;
uniform float uGradientHueDriftDeg;
uniform float uGradientSaturationBoost;
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

float streamGapWaveOffset(float stackIndex, float stackCellPx) {
  if (uStreamGapWaveEnabled <= 0.5 || uStreamGapWaveSqueeze <= 0.0) return 0.0;
  float tau = 6.283185307179586;
  float stepPhase = tau / max(uStreamGapWaveWavelengthCells, 2.0);
  float denominator = max(2.0 * sin(stepPhase * 0.5), 0.001);
  float amplitude = clamp(uStreamGapWaveSqueeze, 0.0, 1.0) * stackCellPx / denominator;
  float timePhase = uTimeSec * uStreamGapWaveSpeed * tau + radians(uStreamGapWavePhaseDeg);
  return sin(stackIndex * stepPhase + timePhase) * amplitude;
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
  float maxWidth = min(255.0, max(uCellPx.x, uCellPx.y));
  float tw = clamp(defaultWidth + (h * 2.0 - 1.0) * max(uShuffleSwingPx, 0.0), 1.0, maxWidth);
  float envelope = pulseEnvelope(localT);
  return defaultWidth + (tw - defaultWidth) * envelope;
}

float randomColumnMotionTarget(float col, float cycleIndex) {
  float patternSeed = uMotionStaggerPx * 0.61803398875;
  return sparkleHash(col + patternSeed + 307.0, cycleIndex + patternSeed + 401.0) * 2.0 - 1.0;
}

float randomColumnMotionOffset(float col) {
  if (uMotionEnabled <= 0.5 || uMotionAmplitudePx <= 0.0 || uMotionMaxOffsetPx <= 0.0) return 0.0;
  float patternSeed = uMotionStaggerPx * 0.61803398875;
  float columnRate = mix(0.65, 1.35, sparkleHash(col + patternSeed + 89.0, patternSeed + 113.0));
  float columnPhase = sparkleHash(col + patternSeed + 179.0, patternSeed + 233.0) * 7.0;
  float randomTime = uTimeSec * max(uMotionSpeed, 0.05) * columnRate + columnPhase;
  float cycleIndex = floor(randomTime);
  float cycleT = fract(randomTime);
  float easedT = cycleT * cycleT * (3.0 - 2.0 * cycleT);
  float wave = mix(
    randomColumnMotionTarget(col, cycleIndex),
    randomColumnMotionTarget(col, cycleIndex + 1.0),
    easedT
  );
  float amplitude = min(max(uMotionAmplitudePx, 0.0), max(uMotionMaxOffsetPx, 0.0));
  return wave * amplitude;
}

struct MotionCell {
  vec2 cell;
  vec2 local;
};

MotionCell resolveMotionCell(vec2 cellF) {
  MotionCell result;
  result.cell = floor(cellF);
  result.local = fract(cellF);
  if (uMotionEnabled <= 0.5 || uMotionAmplitudePx <= 0.0 || uMotionMaxOffsetPx <= 0.0) return result;

  float baseRow = floor(cellF.y);
  float yPx = cellF.y * uCellPx.y;
  float maxSpan = ceil(min(max(uMotionAmplitudePx, 0.0), max(uMotionMaxOffsetPx, 0.0)) / max(uCellPx.y, 1.0)) + 2.0;
  float bestScore = 100000.0;
  vec2 bestCell = result.cell;
  vec2 bestLocal = result.local;

  for (int i = -40; i <= 40; i++) {
    float row = baseRow + float(i);
    if (row < 0.0 || row >= uGridCount.y || abs(float(i)) > maxSpan) continue;
    float offset = randomColumnMotionOffset(result.cell.x);
    float localY = (yPx - (row * uCellPx.y + offset)) / uCellPx.y;
    float outside = max(max(-localY, localY - 1.0), 0.0);
    float centerDist = abs(localY - 0.5);
    float score = outside * 100.0 + centerDist;
    if (score < bestScore) {
      bestScore = score;
      bestCell = vec2(result.cell.x, row);
      bestLocal = vec2(result.local.x, clamp(localY, 0.0, 1.0));
    }
  }

  result.cell = bestCell;
  result.local = bestLocal;
  return result;
}

float stripeAlpha(vec2 p, vec2 halfExt, float r, float w) {
  float d = sdRoundBox(p, halfExt, r);
  return clamp(0.5 - d / w, 0.0, 1.0);
}

float gradientPosition(vec2 uv, float direction) {
  float t = 1.0 - uv.y;
  if (direction > 0.5 && direction < 1.5) t = uv.x;
  else if (direction > 1.5 && direction < 2.5) t = 1.0 - uv.x;
  else if (direction > 2.5) t = uv.y;
  return clamp(t, 0.0, 1.0);
}

vec3 gradientRamp(vec2 uv, float direction, float stopCount, vec3 stop0, vec3 stop1, vec3 stop2, vec3 stop3) {
  float t = gradientPosition(uv, direction);

  if (stopCount < 2.5) {
    return mix(stop0, stop1, t);
  }
  if (stopCount < 3.5) {
    if (t < 0.5) return mix(stop0, stop1, t / 0.5);
    return mix(stop1, stop2, (t - 0.5) / 0.5);
  }
  if (t < 0.3333333) return mix(stop0, stop1, t / 0.3333333);
  if (t < 0.6666667) return mix(stop1, stop2, (t - 0.3333333) / 0.3333334);
  return mix(stop2, stop3, (t - 0.6666667) / 0.3333333);
}

vec3 gradientColor(vec2 uv) {
  return gradientRamp(uv, uGradientDirection, uGradientStopCount, uGradientStop0, uGradientStop1, uGradientStop2, uGradientStop3);
}

vec3 backgroundGradientColor(vec2 uv) {
  return gradientRamp(
    uv,
    uBgGradientDirection,
    uBgGradientStopCount,
    uBgGradientStop0,
    uBgGradientStop1,
    uBgGradientStop2,
    uBgGradientStop3
  );
}

vec4 backgroundColor(vec2 uv) {
  if (uTransparent > 0.5) return vec4(0.0);
  vec3 bgRgb = uBgGradientEnabled > 0.5 ? backgroundGradientColor(uv) : uBg;
  vec4 bg = vec4(bgRgb, clamp(uBgAlpha, 0.0, 1.0));
  vec2 displayPx = max(vec2(1.0), uDisplayPx);
  vec2 pixel = uv * displayPx;
  float w = max(1.0 / uDpr, 1e-4);

  if (uBgGridEnabled > 0.5 && uBgGridOpacity > 0.0) {
    vec2 cellPx = max(vec2(1.0), uBgGridCellPx);
    vec2 local = fract(pixel / cellPx);
    vec2 drawablePx = max(vec2(0.0001), cellPx - clamp(uBgGridGapPx, vec2(0.0), cellPx));
    vec2 p = (local - 0.5) * cellPx;
    vec2 halfSize = drawablePx * 0.5;
    float r = min(uBgGridCorner, min(halfSize.x, halfSize.y));
    float d = sdRoundBox(p, halfSize, r);
    float alpha = clamp(0.5 - d / w, 0.0, 1.0) * clamp(uBgGridOpacity, 0.0, 1.0);
    bg = mix(bg, vec4(uBgGridColor, 1.0), alpha);
  }

  return bg;
}

float normalizedCellValue(vec2 uv) {
  float raw = texture(uCell, uv).r;
  return clamp((raw - uCellMin) / max(0.0001, uCellMax - uCellMin), 0.0, 1.0);
}

vec3 blendStripeColor(vec3 base, vec3 source) {
  if (uBlendMode < 0.5) return source;
  if (uBlendMode < 1.5) return base * source;
  if (uBlendMode < 2.5) return 1.0 - (1.0 - base) * (1.0 - source);
  if (uBlendMode < 3.5) {
    return mix(
      2.0 * base * source,
      1.0 - 2.0 * (1.0 - base) * (1.0 - source),
      step(vec3(0.5), base)
    );
  }
  if (uBlendMode < 4.5) return min(base, source);
  if (uBlendMode < 5.5) return max(base, source);
  if (uBlendMode < 6.5) return abs(base - source);
  return base + source - 2.0 * base * source;
}

float colorLightness(vec3 c) {
  float hi = max(max(c.r, c.g), c.b);
  float lo = min(min(c.r, c.g), c.b);
  return (hi + lo) * 0.5;
}

vec3 withLightness(vec3 base, float targetLightness) {
  float currentLightness = colorLightness(base);
  float target = clamp(targetLightness, 0.0, 1.0);
  if (currentLightness < 0.0001 || currentLightness > 0.9999) return vec3(target);
  if (target < currentLightness) {
    return clamp(base * (target / currentLightness), 0.0, 1.0);
  }
  return clamp(1.0 - (1.0 - base) * ((1.0 - target) / (1.0 - currentLightness)), 0.0, 1.0);
}

vec3 rgbToHsl(vec3 c) {
  float maxc = max(max(c.r, c.g), c.b);
  float minc = min(min(c.r, c.g), c.b);
  float l = (maxc + minc) * 0.5;
  float h = 0.0;
  float s = 0.0;
  float d = maxc - minc;
  if (d > 0.00001) {
    s = l > 0.5 ? d / (2.0 - maxc - minc) : d / (maxc + minc);
    if (maxc == c.r) h = (c.g - c.b) / d + (c.g < c.b ? 6.0 : 0.0);
    else if (maxc == c.g) h = (c.b - c.r) / d + 2.0;
    else h = (c.r - c.g) / d + 4.0;
    h /= 6.0;
  }
  return vec3(h, s, l);
}

float hueToRgb(float p, float q, float t) {
  if (t < 0.0) t += 1.0;
  if (t > 1.0) t -= 1.0;
  if (t < 1.0 / 6.0) return p + (q - p) * 6.0 * t;
  if (t < 1.0 / 2.0) return q;
  if (t < 2.0 / 3.0) return p + (q - p) * (2.0 / 3.0 - t) * 6.0;
  return p;
}

vec3 hslToRgb(vec3 hsl) {
  float h = fract(hsl.x);
  float s = clamp(hsl.y, 0.0, 1.0);
  float l = clamp(hsl.z, 0.0, 1.0);
  if (s <= 0.00001) return vec3(l);
  float q = l < 0.5 ? l * (1.0 + s) : l + s - l * s;
  float p = 2.0 * l - q;
  return vec3(
    hueToRgb(p, q, h + 1.0 / 3.0),
    hueToRgb(p, q, h),
    hueToRgb(p, q, h - 1.0 / 3.0)
  );
}

vec3 applyStripeSparkleTone(vec3 color, float amount) {
  vec3 hsl = rgbToHsl(color);
  if (hsl.y <= 0.0001) return color;
  hsl.y = clamp(hsl.y * (1.0 + clamp(uStripeSparkleSaturationBoost, 0.0, 1.0) * amount), 0.0, 1.0);
  return hslToRgb(hsl);
}

float stripeSparkleAmount(float col, float row) {
  if (uStripeSparkleEnabled <= 0.5) return 0.0;
  float coverage = clamp(uStripeSparkleCoverage, 0.0, 1.0);
  if (coverage <= 0.0) return 0.0;
  if (cellSeed(col, row) >= coverage) return 0.0;
  float speed = max(uStripeSparkleSpeed, 0.05);
  float periodMin = 0.18 / speed;
  float periodMax = 0.85 / speed;
  CellPulse p = cellPulse(col + 179.0, row + 233.0, uTimeSec, coverage, periodMin, periodMax);
  if (p.localTime >= p.period) return 0.0;
  return pulseEnvelope(p.localTime / p.period) * clamp(uStripeSparkleMaxBrightness, 0.0, 1.0);
}

vec3 applyStripeSparkle(vec3 color, vec2 cell, float widthPx, float opacity) {
  if (widthPx < uStripeSparkleMinWidthPx || opacity <= 0.001) return color;
  float amount = stripeSparkleAmount(cell.x, cell.y);
  vec3 brightened = withLightness(color, colorLightness(color) + amount);
  return applyStripeSparkleTone(brightened, amount);
}

float stripeDotAlpha(vec2 centeredP, float eligible, float widthPx, float opacity, float aaWidth) {
  if (uStripeDotsEnabled <= 0.5 || eligible < 0.5 || widthPx < 2.0 || opacity <= 0.001) return 0.0;
  float radius = clamp(uStripeDotsSizePx, 1.0, 2.0) * 0.5;
  return clamp(0.5 - (length(centeredP) - radius) / aaWidth, 0.0, 1.0);
}

vec3 stripeBrightnessColor(vec3 stripeColor, float brightness) {
  float lightnessLift = clamp(brightness, 0.0, 1.0);
  if (lightnessLift <= 0.0001) return stripeColor;
  vec3 stripeHsl = rgbToHsl(stripeColor);
  stripeHsl.z = clamp(stripeHsl.z + lightnessLift, 0.0, 1.0);
  return hslToRgb(stripeHsl);
}

vec3 stripeDotColor(vec3 stripeColor, float rampT) {
  vec3 dotColor = stripeBrightnessColor(stripeColor, uStripeDotsBrightness);
  vec3 hsl = rgbToHsl(dotColor);
  if (hsl.y <= 0.0001) return dotColor;
  float t = clamp(rampT, 0.0, 1.0);
  hsl.x = fract(hsl.x + (uStripeDotsHueDriftDeg * t) / 360.0);
  float satLift = clamp(uStripeDotsSaturationBoost, 0.0, 1.0) * sin(t * 3.141592653589793 * 0.85);
  hsl.y = clamp(hsl.y * (1.0 + satLift), 0.0, 1.0);
  return hslToRgb(hsl);
}

float stripeShapeAlpha(
  vec2 centeredP,
  vec2 halfExt,
  vec2 borderHalfExt,
  float cornerRadius,
  float geometryAlpha,
  float widthPx,
  float aaWidth,
  vec2 stripeCell
) {
  if (uStripeBorderEnabled <= 0.5 || widthPx < uStripeBorderMinWidthPx) return geometryAlpha;
  float density = clamp(uStripeBorderDensity, 0.0, 1.0);
  if (density <= 0.001 || (density < 0.999 && cellSeed(stripeCell.x, stripeCell.y) > density)) {
    return geometryAlpha;
  }
  float inset = 1.0;
  vec2 outerHalfExt = min(halfExt, borderHalfExt);
  float outerRadius = min(cornerRadius, min(outerHalfExt.x, outerHalfExt.y));
  float outerAlpha = stripeAlpha(centeredP, outerHalfExt, outerRadius, aaWidth);
  vec2 innerHalfExt = max(outerHalfExt - vec2(inset), vec2(0.0));
  float innerRadius = max(0.0, outerRadius - inset);
  float innerAlpha = stripeAlpha(centeredP, innerHalfExt, innerRadius, aaWidth);
  return max(0.0, outerAlpha - innerAlpha);
}

bool gridLineCellVisible(vec2 cell, float density, bool allowOutsideGrid) {
  if (!allowOutsideGrid && (any(lessThan(cell, vec2(0.0))) || any(greaterThanEqual(cell, uGridCount)))) return false;
  return density >= 0.999 || cellSeed(cell.x + 211.0, cell.y + 307.0) <= density;
}

float gridLineAlpha(vec2 rawCellF, float aaWidth, bool allowOutsideGrid) {
  if (uGridLinesEnabled <= 0.5) return 0.0;
  float density = clamp(uGridLinesDensity, 0.0, 1.0);
  if (density <= 0.001) return 0.0;

  vec2 rawCell = floor(rawCellF);
  vec2 rawLocal = fract(rawCellF);
  vec2 edgeDistancePx = min(rawLocal, 1.0 - rawLocal) * uCellPx;
  float verticalAlpha = clamp(0.5 - (edgeDistancePx.x - 0.5) / aaWidth, 0.0, 1.0);
  float horizontalAlpha = clamp(0.5 - (edgeDistancePx.y - 0.5) / aaWidth, 0.0, 1.0);
  bool currentVisible = gridLineCellVisible(rawCell, density, allowOutsideGrid);
  float xSide = rawLocal.x < 0.5 ? -1.0 : 1.0;
  float ySide = rawLocal.y < 0.5 ? -1.0 : 1.0;
  vec2 verticalNeighbor = rawCell + vec2(xSide, 0.0);
  vec2 horizontalNeighbor = rawCell + vec2(0.0, ySide);
  vec2 diagonalNeighbor = rawCell + vec2(xSide, ySide);
  bool verticalCellVisible = currentVisible || gridLineCellVisible(verticalNeighbor, density, allowOutsideGrid);
  bool horizontalCellVisible = currentVisible || gridLineCellVisible(horizontalNeighbor, density, allowOutsideGrid);
  bool cornerCellVisible =
    verticalCellVisible ||
    horizontalCellVisible ||
    gridLineCellVisible(diagonalNeighbor, density, allowOutsideGrid);
  float verticalVisible = verticalCellVisible ? 1.0 : 0.0;
  float horizontalVisible = horizontalCellVisible ? 1.0 : 0.0;
  float squareCornerAlpha = cornerCellVisible ? min(verticalAlpha, horizontalAlpha) : 0.0;
  verticalAlpha *= verticalVisible;
  horizontalAlpha *= horizontalVisible;
  return max(max(verticalAlpha, horizontalAlpha), squareCornerAlpha);
}

vec3 gradientAverageColor() {
  if (uGradientStopCount < 2.5) return (uGradientStop0 + uGradientStop1) * 0.5;
  if (uGradientStopCount < 3.5) return (uGradientStop0 + uGradientStop1 + uGradientStop2) / 3.0;
  return (uGradientStop0 + uGradientStop1 + uGradientStop2 + uGradientStop3) * 0.25;
}

vec3 gradientColorWithRampLightness(vec2 uv, vec3 rampColor, float rampT) {
  vec3 localColor = gradientColor(uv);
  vec3 hsl = rgbToHsl(localColor);
  float t = clamp(rampT, 0.0, 1.0);
  if (hsl.y > 0.0001) {
    hsl.x = fract(hsl.x + (uGradientHueDriftDeg * t) / 360.0);
    float satLift = clamp(uGradientSaturationBoost, 0.0, 1.0) * sin(t * 3.141592653589793 * 0.85);
    hsl.y = clamp(hsl.y * (1.0 + satLift), 0.0, 1.0);
    localColor = hslToRgb(hsl);
  }
  float baseLightness = colorLightness(gradientAverageColor());
  float lightnessLift = max(0.0, colorLightness(rampColor) - baseLightness);
  return withLightness(localColor, colorLightness(localColor) + lightnessLift);
}

vec3 applyImageColorLightness(vec3 color) {
  float amount = clamp(uImageColorLightness, -1.0, 1.0);
  return amount >= 0.0 ? mix(color, vec3(1.0), amount) : mix(color, vec3(0.0), -amount);
}

vec3 cellImageColor(vec2 uv) {
  vec2 colorCell = clamp(floor(uv * uGridCount), vec2(0.0), max(vec2(0.0), uGridCount - 1.0));
  vec2 colorUv = (colorCell + 0.5) / uGridCount;
  vec3 color = texture(uCellColor, colorUv).rgb;
  return applyImageColorLightness(color);
}

bool imageColorDensityVisible(vec2 cell) {
  float density = clamp(uImageColorDensity, 0.0, 1.0);
  if (density >= 0.999) return true;
  if (density <= 0.001) return false;
  float col = clamp(floor(cell.x), 0.0, max(0.0, uGridCount.x - 1.0));
  float row = clamp(floor(cell.y), 0.0, max(0.0, uGridCount.y - 1.0));
  float chunk = floor(row / 20.0);
  float localRow = row - chunk * 20.0;
  float splitRow = 5.0 + floor(sparkleHash(col + 421.0, chunk + 17.0) * 11.0);
  float side = localRow < splitRow ? 0.0 : 1.0;
  float cluster = col * 4096.0 + chunk * 2.0 + side;
  return sparkleHash(cluster + 197.0, 313.0) <= density;
}

void main() {
  vec4 bgColor = backgroundColor(vUv);
  float angleRad = radians(uAngleDeg);
  vec2 renderUv = vUv;

  vec2 cellF = renderUv * uGridCount;
  MotionCell motionCell = resolveMotionCell(cellF);
  vec2 cell = motionCell.cell;
  vec2 local = motionCell.local;
  vec2 sourceCell = cell;
  sourceCell = clamp(sourceCell, vec2(0.0), max(vec2(0.0), uGridCount - 1.0));
  vec2 sourceUv = (sourceCell + 0.5) / uGridCount;
  float v = normalizedCellValue(sourceUv);
  vec2 lutUv = vec2((v * 255.0 + 0.5) / 256.0, 0.5);
  vec4 lut = texture(uLut, lutUv);
  vec3 barColor = lut.rgb;
  float barWidthPx = (lut.a * 255.0) * 0.5;
  vec4 opacityMeta = texture(uOpacityLut, lutUv);
  float barOpacity = opacityMeta.r;
  float barRampT = opacityMeta.g;
  float barDotEligible = opacityMeta.b;

  if (uUseCellColors > 0.5) {
    barColor = cellImageColor(sourceUv);
  }
  if (uGradientEnabled > 0.5 && uUseCellColors < 0.5) {
    barColor = gradientColorWithRampLightness(sourceUv, barColor, barRampT);
  }
  barColor = applyStripeSparkle(barColor, sourceCell, barWidthPx, barOpacity);

  if (uShuffleEnabled > 0.5) barWidthPx = shuffledWidth(cell.x, cell.y, barWidthPx);
  float earlyAngleNorm = mod(abs(uAngleDeg), 180.0);
  bool willUseNeighborRotation = abs(earlyAngleNorm) > 0.001 && abs(earlyAngleNorm - 90.0) > 0.001;

  bool baseStripeVisible = true;
  if (!willUseNeighborRotation && barWidthPx < 0.5) baseStripeVisible = false;
  if (!willUseNeighborRotation && uGapEnabled > 0.5 && uGapCoverage > 0.0 && isGapped(cell.x, cell.y)) {
    baseStripeVisible = false;
  }
  if (!willUseNeighborRotation && uUseCellColors > 0.5 && !imageColorDensityVisible(sourceCell)) {
    baseStripeVisible = false;
  }

  vec2 drawablePx = max(vec2(0.0001), uCellPx - clamp(uGridGapPx, vec2(0.0), uCellPx));
  vec2 p = (local - 0.5) * uCellPx;
  float w = max(1.0 / uDpr, 1e-4);
  float cellAngleRad = angleRad;
  vec2 axis = vec2(sin(cellAngleRad), cos(cellAngleRad));
  vec2 normal = vec2(cos(cellAngleRad), -sin(cellAngleRad));
  float angleNorm = mod(abs(uAngleDeg), 180.0);
  bool arbitraryAngle = abs(angleNorm) > 0.001 && abs(angleNorm - 90.0) > 0.001;
  bool overlapRotation = uRotationMode > 1.5;
  float overlapAmount = overlapRotation ? clamp(uOverlapAmount, 0.0, 4.0) : 1.0;
  float extendY = (uGridGapPx.y <= 0.0001) ? w : 0.0;
  float extendX = (uGridGapPx.x <= 0.0001) ? w : 0.0;
  float noGapExtend = max(extendX, extendY);
  vec2 gridLineCellF = cellF;
  if (arbitraryAngle) {
    vec2 displayPx = max(vec2(1.0), uDisplayPx);
    vec2 centeredPixel = vUv * displayPx - displayPx * 0.5;
    float normalCoord = dot(centeredPixel, normal);
    float axisCoord = dot(centeredPixel, axis);
    if (uOrient > 0.5) {
      gridLineCellF = vec2(
        (axisCoord + displayPx.x * 0.5) / max(uCellPx.x, 0.0001),
        (normalCoord + displayPx.y * 0.5) / max(uCellPx.y, 0.0001)
      );
    } else {
      gridLineCellF = vec2(
        (normalCoord + displayPx.x * 0.5) / max(uCellPx.x, 0.0001),
        (axisCoord + displayPx.y * 0.5) / max(uCellPx.y, 0.0001)
      );
    }
  }

  if (arbitraryAngle) {
    vec2 displayPx = max(vec2(1.0), uDisplayPx);
    vec2 pixel = vUv * displayPx;
    vec2 displayCenter = displayPx * 0.5;
    vec2 centeredPixel = pixel - displayCenter;
    bool horizontalStacks = uOrient > 0.5;
    float stackCellPx = max(0.0001, horizontalStacks ? uCellPx.y : uCellPx.x);
    float axisCellPx = max(0.0001, horizontalStacks ? uCellPx.x : uCellPx.y);
    float stackGapPx = max(0.0, horizontalStacks ? uGridGapPx.y : uGridGapPx.x);
    float axisGapPx = max(0.0, horizontalStacks ? uGridGapPx.x : uGridGapPx.y);
    float stackSpanPx = max(1.0, horizontalStacks ? displayPx.y : displayPx.x);
    float axisSpanPx = max(1.0, horizontalStacks ? displayPx.x : displayPx.y);
    float stackCoord = dot(centeredPixel, normal) + stackSpanPx * 0.5;
    float axisCoord = dot(centeredPixel, axis) + axisSpanPx * 0.5;
    float baseStack = floor(stackCoord / stackCellPx);
    float baseAxis = floor(axisCoord / axisCellPx);
    float drawableStackPx = max(0.0001, stackCellPx - min(stackGapPx, stackCellPx));
    float drawableAxisPx = max(0.0001, axisCellPx - min(axisGapPx, axisCellPx));
    float groupNoGapExtend = axisGapPx <= 0.0001 ? w : 0.0;
    float motionReach = uMotionEnabled > 0.5
      ? min(max(uMotionAmplitudePx, 0.0), max(uMotionMaxOffsetPx, 0.0))
      : 0.0;
    float maxNormalReach = drawableStackPx * 0.5 + abs(normal.y) * motionReach + w;
    float maxAxisReach =
      drawableAxisPx * 0.5 +
      drawableStackPx * 0.5 * overlapAmount +
      abs(axis.y) * motionReach +
      groupNoGapExtend +
      w * 2.0;
    float bestAlpha = 0.0;
    vec3 bestColor = barColor;
    float bestDepth = -1.0;
    vec4 overlapColor = bgColor;

    float gapWaveStep = 6.283185307179586 / max(uStreamGapWaveWavelengthCells, 2.0);
    float gapWaveAmplitude = uStreamGapWaveEnabled > 0.5
      ? clamp(uStreamGapWaveSqueeze, 0.0, 1.0) * stackCellPx / max(2.0 * sin(gapWaveStep * 0.5), 0.001)
      : 0.0;
    float stackSearch = max(
      uStreamGapWaveEnabled > 0.5 ? ceil(gapWaveAmplitude / stackCellPx) + 2.0 : 1.0,
      ceil(abs(normal.y) * motionReach / stackCellPx) + 2.0
    );
    float axisSearch = ceil(abs(axis.y) * motionReach / axisCellPx) + 2.0;
    for (int ss = -20; ss <= 20; ss++) {
      if (abs(float(ss)) > stackSearch) continue;
      float stackIndex = baseStack + float(ss);
      float stackCenter = (stackIndex + 0.5) * stackCellPx + streamGapWaveOffset(stackIndex, stackCellPx);

      for (int aa = -20; aa <= 20; aa++) {
        if (abs(float(aa)) > axisSearch) continue;
        float axisIndex = baseAxis + float(aa);
        float axisCenter = (axisIndex + 0.5) * axisCellPx;
        float normalDist = stackCoord - stackCenter;
        float axisDist = axisCoord - axisCenter;
        if (abs(normalDist) > maxNormalReach) continue;
        if (abs(axisDist) > maxAxisReach) continue;

        vec2 candidateCell = horizontalStacks ? vec2(axisIndex, stackIndex) : vec2(stackIndex, axisIndex);
        vec2 candidateBaseCenterPixel =
          displayCenter +
          normal * (stackCenter - stackSpanPx * 0.5) +
          axis * (axisCenter - axisSpanPx * 0.5);
        vec2 candidateUv = clamp(candidateBaseCenterPixel / displayPx, vec2(0.0), vec2(1.0));

        float candidateValue = normalizedCellValue(candidateUv);
        vec2 candidateLutUv = vec2((candidateValue * 255.0 + 0.5) / 256.0, 0.5);
        vec4 candidateLut = texture(uLut, candidateLutUv);
        float candidateWidthPx = (candidateLut.a * 255.0) * 0.5;

        if (uShuffleEnabled > 0.5) candidateWidthPx = shuffledWidth(candidateCell.x, candidateCell.y, candidateWidthPx);
        if (uUseCellColors > 0.5 && !imageColorDensityVisible(candidateCell)) continue;
        if (candidateWidthPx < 0.5) continue;
        if (uGapEnabled > 0.5 && uGapCoverage > 0.0 && isGapped(candidateCell.x, candidateCell.y)) continue;

        vec2 candidateCenterPixel = candidateBaseCenterPixel;
        candidateCenterPixel.y += randomColumnMotionOffset(candidateCell.x);
        vec2 candidateDelta = pixel - candidateCenterPixel;
        vec2 candidateRotatedP = vec2(dot(candidateDelta, normal), dot(candidateDelta, axis));
        float candidateHalfW = min(candidateWidthPx, drawableStackPx) * 0.5;
        float candidateHalfH = drawableAxisPx * 0.5 + groupNoGapExtend + candidateHalfW * overlapAmount + w;
        float candidateR = min(uCorner, min(candidateHalfW, candidateHalfH));
        float candidateGeometryAlpha = stripeAlpha(candidateRotatedP, vec2(candidateHalfW, candidateHalfH), candidateR, w);
        if (candidateGeometryAlpha <= 0.001) continue;

        vec4 candidateOpacityMeta = texture(uOpacityLut, candidateLutUv);
        float candidateOpacity = candidateOpacityMeta.r;
        float candidateRampT = candidateOpacityMeta.g;
        float candidateDotEligible = candidateOpacityMeta.b;
        float candidateShapeAlpha = stripeShapeAlpha(
          candidateRotatedP,
          vec2(candidateHalfW, candidateHalfH),
          vec2(candidateHalfW, drawableAxisPx * 0.5),
          candidateR,
          candidateGeometryAlpha,
          candidateWidthPx,
          w,
          candidateCell
        );
        float candidateDotAlpha = stripeDotAlpha(
          candidateRotatedP,
          candidateDotEligible,
          candidateWidthPx,
          candidateOpacity,
          w
        );
        float candidateAlpha = max(candidateShapeAlpha, candidateDotAlpha) * candidateOpacity;
        if (candidateAlpha > 0.001) {
          vec3 candidateColor = candidateLut.rgb;
          if (uUseCellColors > 0.5) {
            candidateColor = cellImageColor(candidateUv);
          }
          if (uGradientEnabled > 0.5 && uUseCellColors < 0.5) {
            candidateColor = gradientColorWithRampLightness(candidateUv, candidateColor, candidateRampT);
          }
          candidateColor = applyStripeSparkle(candidateColor, candidateCell, candidateWidthPx, candidateOpacity);
          candidateColor = mix(
            candidateColor,
            stripeDotColor(candidateColor, candidateRampT),
            candidateDotAlpha
          );

          if (overlapRotation) {
            vec3 blendedCandidateColor = bgColor.a <= 0.0001 ? candidateColor : blendStripeColor(bgColor.rgb, candidateColor);
            overlapColor = mix(overlapColor, vec4(blendedCandidateColor, 1.0), candidateAlpha);
            continue;
          }

          if (
            candidateValue <= bestDepth + 0.0001 &&
            (abs(candidateValue - bestDepth) > 0.0001 || candidateAlpha <= bestAlpha)
          ) {
            continue;
          }

          bestAlpha = candidateAlpha;
          bestColor = candidateColor;
          bestDepth = candidateValue;
        }
      }
    }

    if (overlapRotation) {
      finalColor = overlapColor;
    } else {
      vec3 blendedBestColor = bgColor.a <= 0.0001 ? bestColor : blendStripeColor(bgColor.rgb, bestColor);
      finalColor = mix(bgColor, vec4(blendedBestColor, 1.0), bestAlpha);
    }
  } else {
    if (!baseStripeVisible) {
      finalColor = bgColor;
    } else {
      vec2 rotatedP = vec2(dot(p, normal), dot(p, axis));
      float halfW = min(barWidthPx, max(drawablePx.x, drawablePx.y)) * 0.5;
      float halfH = length(drawablePx) * 0.5;
      float r = min(uCorner, min(halfW, halfH));
      vec2 halfExt = vec2(halfW, halfH + noGapExtend + r);
      float geometryAlpha = stripeAlpha(rotatedP, halfExt, r, w);
      float borderHalfH = max(w, dot(abs(axis), drawablePx) * 0.5);
      float shapeAlpha = stripeShapeAlpha(
        rotatedP,
        halfExt,
        vec2(halfW, borderHalfH),
        r,
        geometryAlpha,
        barWidthPx,
        w,
        sourceCell
      );
      float dotAlpha = stripeDotAlpha(rotatedP, barDotEligible, barWidthPx, barOpacity, w) * geometryAlpha;
      float effectiveAlpha = max(shapeAlpha, dotAlpha) * barOpacity;
      vec3 dottedBarColor = mix(barColor, stripeDotColor(barColor, barRampT), dotAlpha);
      vec3 blendedBarColor = bgColor.a <= 0.0001 ? dottedBarColor : blendStripeColor(bgColor.rgb, dottedBarColor);
      finalColor = mix(bgColor, vec4(blendedBarColor, 1.0), effectiveAlpha);
    }
  }

  float lineAlpha = gridLineAlpha(gridLineCellF, w, arbitraryAngle);
  if (lineAlpha > 0.001) {
    vec3 lineColor = stripeBrightnessColor(barColor, uGridLinesBrightness);
    vec3 blendedLineColor = finalColor.a <= 0.0001 ? lineColor : blendStripeColor(finalColor.rgb, lineColor);
    finalColor = mix(finalColor, vec4(blendedLineColor, 1.0), lineAlpha);
  }

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
        if (uTransparent > 0.5) finalColor *= 1.0 - cov;
        else finalColor.rgb = mix(finalColor.rgb, uLetterColor, cov);
      }
    }
  }
}
`;
