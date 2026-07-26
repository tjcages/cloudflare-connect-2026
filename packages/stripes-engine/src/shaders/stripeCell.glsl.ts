/**
 * Everything the stripe pattern resolves once per grid cell.
 *
 * The stripe pass shades at output resolution, so a 7 CSS px cell at DPR 2
 * covers ~196 fragments — every hash, LUT lookup and HSL round trip below used
 * to run once per fragment even though its result is constant across the cell.
 * The chunk is shared verbatim by `stripeCell.frag` (which evaluates it once
 * per cell into a texture) and `stripe.frag` (which samples that texture, and
 * still evaluates it inline for the rotated-grid path and as the fallback when
 * float render targets are unavailable), so both paths compute bit-identical
 * values from the same source.
 */
export const STRIPE_CELL_GLSL = `
uniform sampler2D uCell;
uniform sampler2D uLut;
uniform sampler2D uOpacityLut;
uniform sampler2D uCellColor;
uniform vec2 uGridCount;
uniform vec2 uCellPx;
uniform float uCellMin;
uniform float uCellMax;
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
uniform float uUseCellColors;
uniform float uImageColorLightness;
uniform float uImageColorDensity;
uniform float uGradientEnabled;
uniform float uGradientDirection;
uniform float uGradientStopCount;
uniform vec3 uGradientStop0;
uniform vec3 uGradientStop1;
uniform vec3 uGradientStop2;
uniform vec3 uGradientStop3;
uniform float uGradientHueDriftDeg;
uniform float uGradientSaturationBoost;

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
  if (uStripeSparkleEnabled <= 0.5) return color;
  if (widthPx < uStripeSparkleMinWidthPx || opacity <= 0.001) return color;
  float amount = stripeSparkleAmount(cell.x, cell.y);
  vec3 brightened = withLightness(color, colorLightness(color) + amount);
  return applyStripeSparkleTone(brightened, amount);
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

float normalizedCellValue(vec2 uv) {
  float raw = texture(uCell, uv).r;
  return clamp((raw - uCellMin) / max(0.0001, uCellMax - uCellMin), 0.0, 1.0);
}

/**
 * Per-cell stripe state, before the width shuffle. A negative \`widthPx\` means
 * the cell is already hidden (gap pulse, or an image colour cell thinned out by
 * density); \`shuffledWidth\` passes it through untouched, so callers need one
 * \`< 0.5\` test to cover both that and a sub-pixel stripe.
 */
struct CellData {
  vec3 color;
  float widthPx;
  float opacity;
  float rampT;
  float dotEligible;
};

CellData cellData(vec2 cell) {
  vec2 sourceCell = clamp(cell, vec2(0.0), max(vec2(0.0), uGridCount - 1.0));
  vec2 sourceUv = (sourceCell + 0.5) / uGridCount;
  float v = normalizedCellValue(sourceUv);
  vec2 lutUv = vec2((v * 255.0 + 0.5) / 256.0, 0.5);
  vec4 lut = texture(uLut, lutUv);
  vec4 opacityMeta = texture(uOpacityLut, lutUv);

  CellData d;
  d.color = lut.rgb;
  d.widthPx = (lut.a * 255.0) * 0.5;
  d.opacity = opacityMeta.r;
  d.rampT = opacityMeta.g;
  d.dotEligible = opacityMeta.b;

  if (uUseCellColors > 0.5) {
    d.color = cellImageColor(sourceUv);
  }
  if (uGradientEnabled > 0.5 && uUseCellColors < 0.5) {
    d.color = gradientColorWithRampLightness(sourceUv, d.color, d.rampT);
  }
  d.color = applyStripeSparkle(d.color, sourceCell, d.widthPx, d.opacity);

  bool hidden = false;
  if (uGapEnabled > 0.5 && uGapCoverage > 0.0 && isGapped(cell.x, cell.y)) hidden = true;
  if (uUseCellColors > 0.5 && !imageColorDensityVisible(sourceCell)) hidden = true;
  if (hidden) d.widthPx = -1.0;
  return d;
}
`;
