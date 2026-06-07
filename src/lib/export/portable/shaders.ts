import { Filter, GlProgram, Texture, UniformGroup } from "pixi.js";
import type { StripeColors } from "./types";
import { resolveStripePalette } from "./runtime/stripes";
import { StripePaletteTexture } from "./runtime/stripePaletteTexture";
import { DEFAULT_PLAYGROUND_SPARKLE_OPTIONS, type PlaygroundSparkleOptions } from "./runtime/playgroundSparkle";
import {
  DEFAULT_PLAYGROUND_WIDTH_SHUFFLE_OPTIONS,
  type PlaygroundWidthShuffleOptions,
} from "./runtime/playgroundWidthShuffle";
import {
  normalizePlaygroundTextureAdjustments,
  type PlaygroundTextureAdjustments,
} from "./runtime/playgroundTextureAdjustments";

export const STRIPE_FILTER_VERTEX = `
in vec2 aPosition;
out vec2 vTextureCoord;

uniform vec4 uInputSize;
uniform vec4 uOutputFrame;
uniform vec4 uOutputTexture;

vec4 filterVertexPosition(void)
{
    vec2 position = aPosition * uOutputFrame.zw + uOutputFrame.xy;

    position.x = position.x * (2.0 / uOutputTexture.x) - 1.0;
    position.y = position.y * (2.0*uOutputTexture.z / uOutputTexture.y) - uOutputTexture.z;

    return vec4(position, 0.0, 1.0);
}

vec2 filterTextureCoord(void)
{
    return aPosition * (uOutputFrame.zw * uInputSize.zw);
}

void main(void)
{
    gl_Position = filterVertexPosition();
    vTextureCoord = filterTextureCoord();
}
`;

export const STRIPE_FILTER_FRAGMENT = `
in vec2 vTextureCoord;
out vec4 finalColor;

uniform sampler2D uTexture;
uniform sampler2D uBlockMap;
uniform sampler2D uCellColorMap;
uniform sampler2D uStripeData;
uniform float uStripeCount;
uniform float uUseCellColors;
uniform vec2 uPixelSize;
uniform vec2 uFrameSize;
uniform vec2 uGridSize;
uniform float uDebugVideoAlpha;
uniform float uSparkleEnabled;
uniform float uSparkleTime;
uniform float uSparkleCoverage;
uniform float uSparklePeriodMinSec;
uniform float uSparklePeriodMaxSec;
uniform float uWidthShuffleEnabled;
uniform float uWidthShuffleTime;
uniform float uWidthShuffleCoverage;
uniform float uWidthShufflePeriodMinSec;
uniform float uWidthShufflePeriodMaxSec;

const float CELL_SIZE = 7.0;
const float STRIPE_MAX_WIDTH = 7.0;
const float MIN_STRIPE_HEIGHT = 7.0;
const float ROW_WIDTH_GAP = 1.0;

bool sameStripeBand(float a, float b) {
    if (a < 0.5 || b < 0.5) {
        return false;
    }
    return abs(a - b) < 0.001;
}

bool stripePixelVisible(float relX, float localY, float halfW, float bandTop, float bandBottom) {
    return abs(relX) <= halfW + 0.001 && localY >= bandTop - 0.001 && localY <= bandBottom + 0.001;
}

bool stripeVerticalVisible(float localY, float bandTop, float bandBottom) {
    return localY >= bandTop - 0.001 && localY <= bandBottom + 0.001;
}

// Soft horizontal edge when width shuffle is active (fade outward from stripe boundary).
float stripeHorizontalCoverage(float relX, float halfW, float soften) {
    if (soften < 0.5) {
        return step(abs(relX), halfW + 0.001);
    }
    float dist = max(abs(relX) - halfW, 0.0);
    return 1.0 - smoothstep(0.0, 0.85, dist);
}

vec2 blockGridUv(float colIndex, float rowIndex) {
    float gridRow = uGridSize.y - 1.0 - rowIndex;
    return vec2(
        (colIndex + 0.5) / uGridSize.x,
        (gridRow + 0.5) / uGridSize.y
    );
}

// Red channel stores the stripe index directly (0 = background, 1..N).
float blockStripeBand(float colIndex, float rowIndex) {
    return floor(texture(uBlockMap, blockGridUv(colIndex, rowIndex)).r * 255.0 + 0.5);
}

// Palette texture: width = stripe count, height = 2. Canvas row 0 (v=0.25) = color, row 1 (v=0.75) = width.
float stripePaletteU(float band) {
    return (band - 0.5) / max(uStripeCount, 1.0);
}

vec3 stripeFillColor(float band) {
    return texture(uStripeData, vec2(stripePaletteU(band), 0.25)).rgb;
}

vec3 cellFillColor(float colIndex, float rowIndex, float band) {
    if (uUseCellColors > 0.5) {
        return texture(uCellColorMap, blockGridUv(colIndex, rowIndex)).rgb;
    }
    return stripeFillColor(band);
}

float stripeWidthPx(float band) {
    if (band < 0.5) {
        return 0.0;
    }
    return texture(uStripeData, vec2(stripePaletteU(band), 0.75)).r * STRIPE_MAX_WIDTH;
}

// Keep in sync with runtime/playgroundSparkle.ts.
float sparkleHashFromCoords(vec2 p) {
    vec3 p3 = fract(vec3(p.x, p.y, p.x) * vec3(0.1031, 0.1030, 0.0973));
    p3 += dot(p3, p3.yzx + 33.33);
    return fract((p3.x + p3.y) * p3.z);
}

float sparklePhaseHash(float col, float row) {
    return sparkleHashFromCoords(vec2(col + 53.0, row + 71.0));
}

float sparklePeriodHash(float col, float row) {
    return sparkleHashFromCoords(vec2(col + 89.0, row + 113.0));
}

bool sparkleCellVisible(float col, float row) {
    if (uSparkleEnabled < 0.5) {
        return true;
    }
    float periodSpan = uSparklePeriodMaxSec - uSparklePeriodMinSec;
    float period = uSparklePeriodMinSec + sparklePeriodHash(col, row) * periodSpan;
    float coverage = max(uSparkleCoverage, 0.001);
    float cyclePeriod = period / coverage;
    float phaseOffset = sparklePhaseHash(col, row) * cyclePeriod;
    float scheduledTime = uSparkleTime + phaseOffset;
    float cycleIndex = floor(scheduledTime / cyclePeriod);
    float localTime = scheduledTime - cycleIndex * cyclePeriod;
    return localTime >= period;
}

// Keep in sync with runtime/playgroundWidthShuffle.ts.
float widthShuffleHashFromCoords(vec2 p) {
    vec3 p3 = fract(vec3(p.x, p.y, p.x) * vec3(0.1031, 0.1030, 0.0973));
    p3 += dot(p3, p3.yzx + 33.33);
    return fract((p3.x + p3.y) * p3.z);
}

float widthShuffleCellSeed(float col, float row) {
    return widthShuffleHashFromCoords(vec2(col + 17.0, row + 31.0));
}

float widthShufflePhaseHash(float col, float row) {
    return widthShuffleHashFromCoords(vec2(col + 53.0, row + 71.0));
}

float widthShufflePeriodHash(float col, float row) {
    return widthShuffleHashFromCoords(vec2(col + 89.0, row + 113.0));
}

float widthShuffleAltHash(float col, float row, float pulseIndex) {
    return widthShuffleHashFromCoords(vec2(col + 53.0 + pulseIndex * 61.0, row + 71.0 + pulseIndex * 101.0));
}

float widthShuffleTargetWidth(float col, float row, float pulseIndex, float defaultWidth) {
    float minW = 1.0;
    float maxW = STRIPE_MAX_WIDTH;
    float minSwing = 1.25;
    float span = maxW - minW;
    float h = widthShuffleAltHash(col, row, pulseIndex);
    float target = minW + h * span;

    if (abs(target - defaultWidth) < minSwing) {
        if (defaultWidth <= maxW * 0.5) {
            target = defaultWidth + minSwing + h * (maxW - defaultWidth - minSwing);
        } else {
            target = defaultWidth - minSwing - h * (defaultWidth - minW - minSwing);
        }
        target = clamp(target, minW, maxW);
    }

    return target;
}

float widthShuffleSmoothStep(float t) {
    float c = clamp(t, 0.0, 1.0);
    return c * c * (3.0 - 2.0 * c);
}

float widthShufflePulseEnvelope(float localT) {
    if (localT < 0.0 || localT > 1.0) {
        return 0.0;
    }
    float cosine = 0.5 - 0.5 * cos(6.28318530718 * localT);
    return widthShuffleSmoothStep(cosine);
}

float resolveAnimatedStripeWidth(float col, float row, float band) {
    float defaultWidth = stripeWidthPx(band);
    if (band < 0.5 || uWidthShuffleEnabled < 0.5) {
        return defaultWidth;
    }

    float periodSpan = uWidthShufflePeriodMaxSec - uWidthShufflePeriodMinSec;
    float period = uWidthShufflePeriodMinSec + widthShufflePeriodHash(col, row) * periodSpan;
    float coverage = max(uWidthShuffleCoverage, 0.001);
    float cyclePeriod = period / coverage;
    float phaseOffset = widthShufflePhaseHash(col, row) * cyclePeriod;
    float scheduledTime = uWidthShuffleTime + phaseOffset;
    float cycleIndex = floor(scheduledTime / cyclePeriod);
    float localTime = scheduledTime - cycleIndex * cyclePeriod;

    if (localTime >= period) {
        return defaultWidth;
    }

    float localT = localTime / period;
    float targetWidth = widthShuffleTargetWidth(col, row, cycleIndex, defaultWidth);
    float envelope = widthShufflePulseEnvelope(localT);

    return mix(defaultWidth, targetWidth, envelope);
}

void main(void) {
    vec2 pixelCoord = vTextureCoord * uPixelSize;

    float colIndex = floor(pixelCoord.x / CELL_SIZE);
    float rowIndex = floor(pixelCoord.y / CELL_SIZE);
    float maxRowIndex = max(0.0, floor((uFrameSize.y - 1.0) / CELL_SIZE));
    float columnCenterPx = (colIndex + 0.5) * CELL_SIZE;
    float localY = pixelCoord.y - rowIndex * CELL_SIZE;

    float stripeBand = blockStripeBand(colIndex, rowIndex);
    float bandAbove = rowIndex > 0.0
        ? blockStripeBand(colIndex, rowIndex - 1.0)
        : 0.0;
    float bandBelow = rowIndex < maxRowIndex
        ? blockStripeBand(colIndex, rowIndex + 1.0)
        : 0.0;

    bool chainBreaksAbove = stripeBand > 0.5 && !sameStripeBand(stripeBand, bandAbove);
    bool chainBreaksBelow = stripeBand > 0.5 && !sameStripeBand(stripeBand, bandBelow);

    float gapTop = chainBreaksAbove ? ROW_WIDTH_GAP * 0.5 : 0.0;
    float gapBottom = chainBreaksBelow ? ROW_WIDTH_GAP * 0.5 : 0.0;

    float bandTop = gapTop;
    float bandBottom = CELL_SIZE - gapBottom;

    if (bandBottom - bandTop < MIN_STRIPE_HEIGHT) {
        bandTop = 0.0;
        bandBottom = CELL_SIZE;
    }
    float stripeWidth = resolveAnimatedStripeWidth(colIndex, rowIndex, stripeBand);
    float defaultStripeWidth = stripeWidthPx(stripeBand);
    float halfW = stripeWidth * 0.5;
    float relX = pixelCoord.x - columnCenterPx;
    // Soften edges only during an active pulse — not for every stripe when shuffle is on.
    float softenEdges =
        (uWidthShuffleEnabled > 0.5 && abs(stripeWidth - defaultStripeWidth) > 0.05) ? 1.0 : 0.0;

    float hCoverage = stripeHorizontalCoverage(relX, halfW, softenEdges);
    float vCoverage = stripeVerticalVisible(localY, bandTop, bandBottom) ? 1.0 : 0.0;
    float stripeCoverage = hCoverage * vCoverage;

    if (stripeBand > 0.5) {
        if (!sparkleCellVisible(colIndex, rowIndex)) {
            stripeCoverage = 0.0;
        }
        vec3 stripeColor = cellFillColor(colIndex, rowIndex, stripeBand);
        finalColor = vec4(mix(vec3(1.0), stripeColor, stripeCoverage), 1.0);
    } else {
        finalColor = vec4(1.0, 1.0, 1.0, 1.0);
    }

    if (uDebugVideoAlpha > 0.0) {
        vec4 videoPx = texture(uTexture, vTextureCoord);
        finalColor = mix(finalColor, videoPx, uDebugVideoAlpha);
    }
}
`;

export const SOURCE_TEXTURE_FILTER_FRAGMENT = `
in vec2 vTextureCoord;
out vec4 finalColor;

uniform sampler2D uTexture;
uniform float uBrightness;
uniform float uExposure;
uniform float uContrast;
uniform float uBlackPoint;
uniform float uWhitePoint;
uniform float uGamma;
uniform float uInvert;
uniform float uPosterizeLevels;
uniform float uThresholdBias;
uniform float uNoiseAmount;

float lumaNoiseHash(vec2 p) {
    vec3 p3 = fract(vec3(p.x, p.y, p.x) * vec3(0.1031, 0.1030, 0.0973));
    p3 += dot(p3, p3.yzx + 33.33);
    return fract((p3.x + p3.y) * p3.z);
}

float adjustLuma(float luma) {
    float safeWhite = max(uWhitePoint, uBlackPoint + 0.01);
    float value = clamp((luma - uBlackPoint) / (safeWhite - uBlackPoint), 0.0, 1.0);
    value = pow(value, max(uGamma, 0.0001));
    value = clamp(value * exp2(uExposure), 0.0, 1.0);
    value = clamp((value - 0.5) * uContrast + 0.5, 0.0, 1.0);
    value = clamp(value + uBrightness + uThresholdBias, 0.0, 1.0);
    if (uNoiseAmount > 0.0) {
        value = clamp(value + (lumaNoiseHash(vTextureCoord * 4096.0) * 2.0 - 1.0) * uNoiseAmount, 0.0, 1.0);
    }
    if (uInvert > 0.5) {
        value = 1.0 - value;
    }
    if (uPosterizeLevels >= 2.0) {
        float steps = uPosterizeLevels - 1.0;
        value = floor(value * steps + 0.5) / steps;
    }
    return clamp(value, 0.0, 1.0);
}

void main(void) {
    vec4 sourceColor = texture(uTexture, vTextureCoord);
    float luma = dot(sourceColor.rgb, vec3(0.2126, 0.7152, 0.0722));
    float adjusted = adjustLuma(luma);
    vec3 adjustedColor = luma > 0.0001 ? sourceColor.rgb * (adjusted / luma) : vec3(adjusted);
    finalColor = vec4(clamp(adjustedColor, 0.0, 1.0), sourceColor.a);
}
`;

export type StripeDuotoneFilter = Filter & {
  syncColors: (colors: StripeColors, preferP3?: boolean) => void;
  syncUseCellColors: (enabled: boolean) => void;
  syncSparkle: (options: PlaygroundSparkleOptions, timeSec: number) => void;
  syncWidthShuffle: (options: PlaygroundWidthShuffleOptions, timeSec: number) => void;
  updateBlockMap: (blockMap: Texture) => void;
  updateCellColorMap: (cellColorMap: Texture) => void;
};

export type SourceTextureFilter = Filter & {
  syncAdjustments: (adjustments: PlaygroundTextureAdjustments) => void;
};

function bindBlockMapTexture(filter: Filter, blockMap: Texture) {
  blockMap.source.style.scaleMode = "nearest";
  filter.resources.uBlockMap = blockMap.source;
}

function bindCellColorMapTexture(filter: Filter, cellColorMap: Texture) {
  cellColorMap.source.style.scaleMode = "nearest";
  filter.resources.uCellColorMap = cellColorMap.source;
}

export function createStripeDuotoneFilter(
  canvasWidth: number,
  canvasHeight: number,
  blockMap: Texture,
  gridCols: number,
  gridRows: number,
  colors: StripeColors,
  preferP3 = false,
): StripeDuotoneFilter {
  const palette = new StripePaletteTexture();
  palette.update(resolveStripePalette(colors, preferP3));

  const stripeUniforms = new UniformGroup({
    uPixelSize: { value: [canvasWidth, canvasHeight], type: "vec2<f32>" },
    uFrameSize: { value: [canvasWidth, canvasHeight], type: "vec2<f32>" },
    uGridSize: { value: [gridCols, gridRows], type: "vec2<f32>" },
    uStripeCount: { value: palette.count, type: "f32" },
    uUseCellColors: { value: 0, type: "f32" },
    uDebugVideoAlpha: { value: 0, type: "f32" },
    uSparkleEnabled: { value: 0, type: "f32" },
    uSparkleTime: { value: 0, type: "f32" },
    uSparkleCoverage: { value: DEFAULT_PLAYGROUND_SPARKLE_OPTIONS.coverage, type: "f32" },
    uSparklePeriodMinSec: { value: DEFAULT_PLAYGROUND_SPARKLE_OPTIONS.periodMinSec, type: "f32" },
    uSparklePeriodMaxSec: { value: DEFAULT_PLAYGROUND_SPARKLE_OPTIONS.periodMaxSec, type: "f32" },
    uWidthShuffleEnabled: { value: 0, type: "f32" },
    uWidthShuffleTime: { value: 0, type: "f32" },
    uWidthShuffleCoverage: { value: DEFAULT_PLAYGROUND_WIDTH_SHUFFLE_OPTIONS.coverage, type: "f32" },
    uWidthShufflePeriodMinSec: { value: DEFAULT_PLAYGROUND_WIDTH_SHUFFLE_OPTIONS.periodMinSec, type: "f32" },
    uWidthShufflePeriodMaxSec: { value: DEFAULT_PLAYGROUND_WIDTH_SHUFFLE_OPTIONS.periodMaxSec, type: "f32" },
  });

  const filter = new Filter({
    glProgram: GlProgram.from({
      vertex: STRIPE_FILTER_VERTEX,
      fragment: STRIPE_FILTER_FRAGMENT,
    }),
    clipToViewport: false,
    padding: 0,
    resources: {
      stripeUniforms,
      uBlockMap: blockMap.source,
      uCellColorMap: blockMap.source,
      uStripeData: palette.texture.source,
    },
  }) as StripeDuotoneFilter;

  let currentBlockMap = blockMap;
  let currentCellColorMap = blockMap;
  bindBlockMapTexture(filter, currentBlockMap);
  bindCellColorMapTexture(filter, currentCellColorMap);

  filter.syncColors = (nextColors, nextPreferP3 = preferP3) => {
    palette.update(resolveStripePalette(nextColors, nextPreferP3));
    filter.resources.uStripeData = palette.texture.source;
    (stripeUniforms.uniforms as { uStripeCount: number }).uStripeCount = palette.count;
    stripeUniforms.update();
  };

  filter.syncUseCellColors = (enabled) => {
    const uniforms = stripeUniforms.uniforms as { uUseCellColors: number };
    uniforms.uUseCellColors = enabled ? 1 : 0;
    stripeUniforms.update();
  };

  filter.syncSparkle = (options, timeSec) => {
    const uniforms = stripeUniforms.uniforms as {
      uSparkleEnabled: number;
      uSparkleTime: number;
      uSparkleCoverage: number;
      uSparklePeriodMinSec: number;
      uSparklePeriodMaxSec: number;
    };
    uniforms.uSparkleEnabled = options.enabled ? 1 : 0;
    uniforms.uSparkleTime = timeSec;
    uniforms.uSparkleCoverage = options.coverage;
    uniforms.uSparklePeriodMinSec = options.periodMinSec;
    uniforms.uSparklePeriodMaxSec = options.periodMaxSec;
  };

  filter.syncWidthShuffle = (options, timeSec) => {
    const uniforms = stripeUniforms.uniforms as {
      uWidthShuffleEnabled: number;
      uWidthShuffleTime: number;
      uWidthShuffleCoverage: number;
      uWidthShufflePeriodMinSec: number;
      uWidthShufflePeriodMaxSec: number;
    };
    uniforms.uWidthShuffleEnabled = options.enabled ? 1 : 0;
    uniforms.uWidthShuffleTime = timeSec;
    uniforms.uWidthShuffleCoverage = options.coverage;
    uniforms.uWidthShufflePeriodMinSec = options.periodMinSec;
    uniforms.uWidthShufflePeriodMaxSec = options.periodMaxSec;
    stripeUniforms.update();
  };

  filter.updateBlockMap = (nextBlockMap) => {
    currentBlockMap = nextBlockMap;
    bindBlockMapTexture(filter, nextBlockMap);
  };

  filter.updateCellColorMap = (nextCellColorMap) => {
    currentCellColorMap = nextCellColorMap;
    bindCellColorMapTexture(filter, nextCellColorMap);
  };

  const pixelSizeUniform = stripeUniforms.uniforms.uPixelSize as number[];
  const frameSizeUniform = stripeUniforms.uniforms.uFrameSize as number[];
  const baseApply = filter.apply.bind(filter);
  filter.apply = (filterManager, input, output, clearMode) => {
    bindBlockMapTexture(filter, currentBlockMap);
    bindCellColorMapTexture(filter, currentCellColorMap);
    filter.resources.uStripeData = palette.texture.source;
    pixelSizeUniform[0] = canvasWidth;
    pixelSizeUniform[1] = canvasHeight;
    frameSizeUniform[0] = canvasWidth;
    frameSizeUniform[1] = canvasHeight;
    stripeUniforms.update();
    baseApply(filterManager, input, output, clearMode);
  };

  return filter;
}

export function createSourceTextureFilter(adjustments: PlaygroundTextureAdjustments): SourceTextureFilter {
  const normalized = normalizePlaygroundTextureAdjustments(adjustments);
  const textureUniforms = new UniformGroup({
    uBrightness: { value: normalized.brightness, type: "f32" },
    uExposure: { value: normalized.exposure, type: "f32" },
    uContrast: { value: normalized.contrast, type: "f32" },
    uBlackPoint: { value: normalized.blackPoint, type: "f32" },
    uWhitePoint: { value: normalized.whitePoint, type: "f32" },
    uGamma: { value: normalized.gamma, type: "f32" },
    uInvert: { value: normalized.invert ? 1 : 0, type: "f32" },
    uPosterizeLevels: { value: normalized.posterizeLevels, type: "f32" },
    uThresholdBias: { value: normalized.thresholdBias, type: "f32" },
    uNoiseAmount: { value: normalized.noiseAmount, type: "f32" },
  });

  const filter = new Filter({
    glProgram: GlProgram.from({
      vertex: STRIPE_FILTER_VERTEX,
      fragment: SOURCE_TEXTURE_FILTER_FRAGMENT,
    }),
    clipToViewport: false,
    padding: 0,
    resources: {
      textureUniforms,
    },
  }) as SourceTextureFilter;

  filter.syncAdjustments = (nextAdjustments) => {
    const next = normalizePlaygroundTextureAdjustments(nextAdjustments);
    const uniforms = textureUniforms.uniforms as {
      uBrightness: number;
      uExposure: number;
      uContrast: number;
      uBlackPoint: number;
      uWhitePoint: number;
      uGamma: number;
      uInvert: number;
      uPosterizeLevels: number;
      uThresholdBias: number;
      uNoiseAmount: number;
    };
    uniforms.uBrightness = next.brightness;
    uniforms.uExposure = next.exposure;
    uniforms.uContrast = next.contrast;
    uniforms.uBlackPoint = next.blackPoint;
    uniforms.uWhitePoint = next.whitePoint;
    uniforms.uGamma = next.gamma;
    uniforms.uInvert = next.invert ? 1 : 0;
    uniforms.uPosterizeLevels = next.posterizeLevels;
    uniforms.uThresholdBias = next.thresholdBias;
    uniforms.uNoiseAmount = next.noiseAmount;
    textureUniforms.update();
  };

  return filter;
}
