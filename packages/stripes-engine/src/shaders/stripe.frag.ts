import { STRIPE_CELL_GLSL } from "./stripeCell.glsl";

export const STRIPE_FRAG = `#version 300 es
precision highp float;
in vec2 vUv;
${STRIPE_CELL_GLSL}
uniform sampler2D uCellDataA;
uniform sampler2D uCellDataB;
uniform float uUseCellData;
uniform vec2 uGridGapPx;
uniform float uCorner;
uniform float uOrient;
uniform float uAngleDeg;
uniform float uRotationMode;
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
uniform float uStripeDotsEnabled;
uniform float uStripeDotsSizePx;
uniform float uStripeDotsRandomVisibility;
uniform float uStripeDotsBrightness;
uniform float uStripeDotsHueDriftDeg;
uniform float uStripeDotsSaturationBoost;
uniform float uStripeBorderEnabled;
uniform float uStripeBorderMinWidthPx;
uniform float uStripeBorderDensity;
uniform float uGridLinesEnabled;
uniform float uGridLinesBrightness;
uniform float uGridLinesDensity;
uniform float uLettersEnabled;
uniform sampler2D uGlyphData;
uniform sampler2D uAtlas;
uniform vec2 uAtlasGrid;
uniform float uLetterSizeScale;
uniform float uOverlapAmount;
uniform float uStreamGapWaveEnabled;
uniform float uStreamGapWaveSqueeze;
uniform float uStreamGapWaveWavelengthCells;
uniform float uStreamGapWaveSpeed;
uniform float uStreamGapWavePhaseDeg;
uniform vec3 uLetterColor;
uniform float uBlendMode;
out vec4 finalColor;

float sdRoundBox(vec2 p, vec2 b, float r) {
  vec2 q = abs(p) - b + r;
  return min(max(q.x, q.y), 0.0) + length(max(q, 0.0)) - r;
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

struct MotionCell {
  vec2 cell;
  vec2 local;
};

/**
 * Every row of a column shifts by the same offset, so the shifted grid is a
 * pure translation: the covering row is \`floor((yPx - offset) / cellPx.y)\`
 * clamped into the grid. The three candidates around it keep the original
 * scan's exact scoring and tie-break while dropping the rest of the sweep —
 * rows further out always score above 100 (they miss the cell outright).
 */
MotionCell resolveMotionCell(vec2 cellF, float offset) {
  MotionCell result;
  result.cell = floor(cellF);
  result.local = fract(cellF);
  if (uMotionEnabled <= 0.5 || uMotionAmplitudePx <= 0.0 || uMotionMaxOffsetPx <= 0.0) return result;

  float yPx = cellF.y * uCellPx.y;
  float maxRow = max(0.0, uGridCount.y - 1.0);
  float coveringRow = floor((yPx - offset) / uCellPx.y);
  float bestScore = 100000.0;
  vec2 bestCell = result.cell;
  vec2 bestLocal = result.local;

  for (int i = -1; i <= 1; i++) {
    float row = clamp(coveringRow + float(i), 0.0, maxRow);
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

float stripeDotAlpha(
  vec2 centeredP,
  vec2 stripeCell,
  float eligible,
  float widthPx,
  float opacity,
  float aaWidth
) {
  if (uStripeDotsEnabled <= 0.5 || eligible < 0.5 || widthPx < 2.0 || opacity <= 0.001) return 0.0;
  float visibility = clamp(uStripeDotsRandomVisibility, 0.0, 1.0);
  if (sparkleHash(stripeCell.x + 137.0, stripeCell.y + 174.0) >= visibility) return 0.0;
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
  vec3 hsl = rgbToHsl(stripeColor);
  hsl.z = clamp(hsl.z + clamp(uStripeDotsBrightness, 0.0, 1.0), 0.0, 1.0);
  if (hsl.y <= 0.0001) return vec3(hsl.z);
  float t = clamp(rampT, 0.0, 1.0);
  hsl.x = fract(hsl.x + (uStripeDotsHueDriftDeg * t) / 360.0);
  float satLift = clamp(uStripeDotsSaturationBoost, 0.0, 1.0) * sin(t * 3.141592653589793 * 0.85);
  hsl.y = clamp(hsl.y * (1.0 + satLift), 0.0, 1.0);
  return hslToRgb(hsl);
}

vec3 dottedStripeColor(vec3 stripeColor, float rampT, float dotAlpha) {
  if (dotAlpha <= 0.0) return stripeColor;
  return mix(stripeColor, stripeDotColor(stripeColor, rampT), dotAlpha);
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

CellData fetchCellData(vec2 cell) {
  ivec2 texel = ivec2(cell);
  vec4 packedA = texelFetch(uCellDataA, texel, 0);
  vec4 packedB = texelFetch(uCellDataB, texel, 0);
  CellData d;
  d.color = packedA.rgb;
  d.widthPx = packedA.a;
  d.opacity = packedB.r;
  d.rampT = packedB.g;
  d.dotEligible = packedB.b;
  return d;
}

void main() {
  vec4 bgColor = backgroundColor(vUv);
  float angleRad = radians(uAngleDeg);
  vec2 renderUv = vUv;

  vec2 cellF = renderUv * uGridCount;
  float motionOffset = 0.0;
  if (uMotionEnabled > 0.5 && uMotionAmplitudePx > 0.0 && uMotionMaxOffsetPx > 0.0) {
    motionOffset = uUseCellData > 0.5
      ? texelFetch(uCellDataB, ivec2(int(floor(cellF.x)), 0), 0).a
      : randomColumnMotionOffset(floor(cellF.x));
  }
  MotionCell motionCell = resolveMotionCell(cellF, motionOffset);
  vec2 cell = motionCell.cell;
  vec2 local = motionCell.local;
  vec2 sourceCell = clamp(cell, vec2(0.0), max(vec2(0.0), uGridCount - 1.0));
  CellData cellState;
  if (uUseCellData > 0.5) cellState = fetchCellData(sourceCell);
  else cellState = cellData(cell);
  vec3 barColor = cellState.color;
  float barOpacity = cellState.opacity;
  float barRampT = cellState.rampT;
  float barDotEligible = cellState.dotEligible;
  float barWidthPx = cellState.widthPx;
  if (uShuffleEnabled > 0.5) barWidthPx = shuffledWidth(cell.x, cell.y, barWidthPx);
  bool cellHidden = barWidthPx < 0.5;
  barWidthPx = max(barWidthPx, 0.0);

  float earlyAngleNorm = mod(abs(uAngleDeg), 180.0);
  bool willUseNeighborRotation = abs(earlyAngleNorm) > 0.001 && abs(earlyAngleNorm - 90.0) > 0.001;
  bool baseStripeVisible = willUseNeighborRotation || !cellHidden;

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
    int stackSpan = int(min(stackSearch, 20.0));
    int axisSpan = int(min(axisSearch, 20.0));
    for (int ss = -stackSpan; ss <= stackSpan; ss++) {
      float stackIndex = baseStack + float(ss);
      float stackCenter = (stackIndex + 0.5) * stackCellPx + streamGapWaveOffset(stackIndex, stackCellPx);

      for (int aa = -axisSpan; aa <= axisSpan; aa++) {
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
          candidateCell,
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
          candidateColor = dottedStripeColor(candidateColor, candidateRampT, candidateDotAlpha);

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
      float dotAlpha = stripeDotAlpha(rotatedP, sourceCell, barDotEligible, barWidthPx, barOpacity, w) * geometryAlpha;
      float effectiveAlpha = max(shapeAlpha, dotAlpha) * barOpacity;
      vec3 dottedBarColor = dottedStripeColor(barColor, barRampT, dotAlpha);
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
