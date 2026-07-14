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
uniform float uMotionDirection;
uniform float uLettersEnabled;
uniform sampler2D uGlyphData;
uniform sampler2D uAtlas;
uniform vec2 uAtlasGrid;
uniform float uLetterSizeScale;
uniform float uUseCellColors;
uniform sampler2D uCellColor;
uniform float uImageColorLightness;
uniform float uImageColorDensity;
uniform vec3 uLetterColor;
uniform float uBlendMode;
uniform float uGradientEnabled;
uniform float uGradientDirection;
uniform float uGradientStopCount;
uniform vec3 uGradientStop0;
uniform vec3 uGradientStop1;
uniform vec3 uGradientStop2;
uniform vec3 uGradientStop3;
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
  float maxWidth = min(255.0, max(uCellPx.x, uCellPx.y));
  float tw = clamp(defaultWidth + (h * 2.0 - 1.0) * max(uShuffleSwingPx, 0.0), 1.0, maxWidth);
  float envelope = pulseEnvelope(localT);
  return defaultWidth + (tw - defaultWidth) * envelope;
}

float staggerMotionOffset(float col, float row) {
  if (uMotionEnabled <= 0.5 || uMotionAmplitudePx <= 0.0 || uMotionMaxOffsetPx <= 0.0) return 0.0;
  float phaseSource = col * uCellPx.x;
  if (uMotionDirection > 0.5 && uMotionDirection < 1.5) {
    phaseSource = -col * uCellPx.x;
  } else if (uMotionDirection > 1.5 && uMotionDirection < 2.5) {
    phaseSource = row * uCellPx.y;
  } else if (uMotionDirection > 2.5) {
    phaseSource = -row * uCellPx.y;
  }
  float phase = phaseSource / max(uMotionStaggerPx, 0.001);
  float wave = sin(uTimeSec * max(uMotionSpeed, 0.05) * 6.283185307179586 - phase);
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
    float offset = staggerMotionOffset(result.cell.x, row);
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

vec3 gradientColorWithRampLightness(vec2 uv, vec3 rampColor) {
  return withLightness(gradientColor(uv), colorLightness(rampColor));
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
  vec2 sourceCell = floor(vUv * uGridCount);
  sourceCell = clamp(sourceCell, vec2(0.0), max(vec2(0.0), uGridCount - 1.0));
  vec2 sourceUv = (sourceCell + 0.5) / uGridCount;
  float v = normalizedCellValue(sourceUv);
  vec2 lutUv = vec2((v * 255.0 + 0.5) / 256.0, 0.5);
  vec4 lut = texture(uLut, lutUv);
  vec3 barColor = lut.rgb;
  float barWidthPx = (lut.a * 255.0) * 0.5;
  float barOpacity = texture(uOpacityLut, lutUv).r;

  if (uUseCellColors > 0.5) {
    barColor = cellImageColor(sourceUv);
  }
  if (uGradientEnabled > 0.5 && uUseCellColors < 0.5) {
    barColor = gradientColorWithRampLightness(sourceUv, barColor);
  }

  if (uShuffleEnabled > 0.5) barWidthPx = shuffledWidth(cell.x, cell.y, barWidthPx);
  float earlyAngleNorm = mod(abs(uAngleDeg), 180.0);
  bool willUseNeighborRotation = abs(earlyAngleNorm) > 0.001 && abs(earlyAngleNorm - 90.0) > 0.001;

  if (!willUseNeighborRotation && barWidthPx < 0.5) { finalColor = bgColor; return; }

  if (!willUseNeighborRotation && uGapEnabled > 0.5 && uGapCoverage > 0.0 && isGapped(cell.x, cell.y)) { finalColor = bgColor; return; }

  if (!willUseNeighborRotation && uUseCellColors > 0.5 && !imageColorDensityVisible(sourceCell)) { finalColor = bgColor; return; }

  vec2 drawablePx = max(vec2(0.0001), uCellPx - clamp(uGridGapPx, vec2(0.0), uCellPx));
  vec2 p = (local - 0.5) * uCellPx;
  float w = max(1.0 / uDpr, 1e-4);
  float cellAngleRad = angleRad;
  vec2 axis = vec2(sin(cellAngleRad), cos(cellAngleRad));
  vec2 normal = vec2(cos(cellAngleRad), -sin(cellAngleRad));
  float angleNorm = mod(abs(uAngleDeg), 180.0);
  bool arbitraryAngle = abs(angleNorm) > 0.001 && abs(angleNorm - 90.0) > 0.001;
  float extendY = (uGridGapPx.y <= 0.0001) ? w : 0.0;
  float extendX = (uGridGapPx.x <= 0.0001) ? w : 0.0;
  float noGapExtend = max(extendX, extendY);

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
    float bestAlpha = 0.0;
    vec3 bestColor = barColor;
    float bestDepth = -1.0;

    for (int ss = -4; ss <= 4; ss++) {
      float stackIndex = baseStack + float(ss);
      float stackCenter = (stackIndex + 0.5) * stackCellPx;

      for (int aa = -4; aa <= 4; aa++) {
        float axisIndex = baseAxis + float(aa);
        float axisCenter = (axisIndex + 0.5) * axisCellPx;

        vec2 candidateCell = horizontalStacks ? vec2(axisIndex, stackIndex) : vec2(stackIndex, axisIndex);
        vec2 samplePixel = displayCenter + normal * (stackCenter - stackSpanPx * 0.5) + axis * (axisCenter - axisSpanPx * 0.5);
        vec2 candidateUv = clamp(samplePixel / displayPx, vec2(0.0), vec2(1.0));

        float candidateValue = normalizedCellValue(candidateUv);
        vec2 candidateLutUv = vec2((candidateValue * 255.0 + 0.5) / 256.0, 0.5);
        vec4 candidateLut = texture(uLut, candidateLutUv);
        vec3 candidateColor = candidateLut.rgb;
        float candidateWidthPx = (candidateLut.a * 255.0) * 0.5;
        float candidateOpacity = texture(uOpacityLut, candidateLutUv).r;

        if (uUseCellColors > 0.5) {
          candidateColor = cellImageColor(candidateUv);
        }
        if (uGradientEnabled > 0.5 && uUseCellColors < 0.5) {
          candidateColor = gradientColorWithRampLightness(candidateUv, candidateColor);
        }
        if (uShuffleEnabled > 0.5) candidateWidthPx = shuffledWidth(candidateCell.x, candidateCell.y, candidateWidthPx);
        if (candidateWidthPx < 0.5) continue;
        if (uGapEnabled > 0.5 && uGapCoverage > 0.0 && isGapped(candidateCell.x, candidateCell.y)) continue;
        if (uUseCellColors > 0.5 && !imageColorDensityVisible(candidateCell)) continue;

        float normalDist = stackCoord - stackCenter;
        float axisDist = axisCoord - axisCenter;
        vec2 candidateRotatedP = vec2(normalDist, axisDist);
        float candidateHalfW = min(candidateWidthPx, drawableStackPx) * 0.5;
        float candidateHalfH = drawableAxisPx * 0.5 + groupNoGapExtend + candidateHalfW + w;
        float candidateR = min(uCorner, min(candidateHalfW, candidateHalfH));
        float candidateAlpha = stripeAlpha(candidateRotatedP, vec2(candidateHalfW, candidateHalfH), candidateR, w) * candidateOpacity;
        if (
          candidateAlpha > 0.001 &&
          (candidateValue > bestDepth + 0.0001 || (abs(candidateValue - bestDepth) <= 0.0001 && candidateAlpha > bestAlpha))
        ) {
          bestAlpha = candidateAlpha;
          bestColor = candidateColor;
          bestDepth = candidateValue;
        }
      }
    }

    vec3 blendedBestColor = bgColor.a <= 0.0001 ? bestColor : blendStripeColor(bgColor.rgb, bestColor);
    finalColor = mix(bgColor, vec4(blendedBestColor, 1.0), bestAlpha);
  } else {
  vec2 rotatedP = vec2(dot(p, normal), dot(p, axis));
  float halfW = min(barWidthPx, max(drawablePx.x, drawablePx.y)) * 0.5;
  float halfH = length(drawablePx) * 0.5;
  float r = min(uCorner, min(halfW, halfH));
  vec2 halfExt = vec2(halfW, halfH + noGapExtend + r);
  float alpha = stripeAlpha(rotatedP, halfExt, r, w);
  float effectiveAlpha = alpha * barOpacity;
  vec3 blendedBarColor = bgColor.a <= 0.0001 ? barColor : blendStripeColor(bgColor.rgb, barColor);
  finalColor = mix(bgColor, vec4(blendedBarColor, 1.0), effectiveAlpha);
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
