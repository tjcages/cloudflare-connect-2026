/** GLSL sources for the playground stripe duotone filter (shared with React export). */

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
uniform vec2 uPixelSize;
uniform vec2 uFrameSize;
uniform vec2 uGridSize;
uniform vec3 uColorBand0;
uniform vec3 uColorBand1;
uniform vec3 uColorBand2;
uniform vec3 uColorBand3;
uniform vec3 uColorBand4;
uniform float uBandEnabled0;
uniform float uBandEnabled1;
uniform float uBandEnabled2;
uniform float uBandEnabled3;
uniform float uBandEnabled4;
uniform float uDebugVideoAlpha;
uniform float uSparkleEnabled;
uniform float uSparkleTime;
uniform float uSparkleCoverage;
uniform float uSparkleRateHz;
uniform float uWidthShuffleEnabled;
uniform float uWidthShuffleTime;
uniform float uWidthShuffleCoverage;
uniform float uWidthShufflePeriodMinSec;
uniform float uWidthShufflePeriodMaxSec;

const float CELL_SIZE = 7.0;
const float STRIPE_BAND_COUNT = 5.0;
const float STRIPE_MAX_WIDTH = 5.0;
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

float decodeStripeBand(float encoded) {
    if (encoded < 0.5 / STRIPE_BAND_COUNT) {
        return 0.0;
    }
    if (encoded >= 4.5 / STRIPE_BAND_COUNT) {
        return 5.0;
    }
    if (encoded >= 3.5 / STRIPE_BAND_COUNT) {
        return 4.0;
    }
    if (encoded >= 2.5 / STRIPE_BAND_COUNT) {
        return 3.0;
    }
    if (encoded >= 1.5 / STRIPE_BAND_COUNT) {
        return 2.0;
    }
    return 1.0;
}

float widthPxFromBand(float band) {
    if (band < 0.5) {
        return 0.0;
    }
    return min(STRIPE_MAX_WIDTH, max(1.0, ceil(band * STRIPE_MAX_WIDTH / STRIPE_BAND_COUNT)));
}

vec2 blockGridUv(float colIndex, float rowIndex) {
    float gridRow = uGridSize.y - 1.0 - rowIndex;
    return vec2(
        (colIndex + 0.5) / uGridSize.x,
        (gridRow + 0.5) / uGridSize.y
    );
}

float blockStripeBand(float colIndex, float rowIndex) {
    return decodeStripeBand(texture(uBlockMap, blockGridUv(colIndex, rowIndex)).r);
}

bool stripeBandEnabled(float band) {
    if (band < 1.5) {
        return uBandEnabled0 > 0.5;
    }
    if (band < 2.5) {
        return uBandEnabled1 > 0.5;
    }
    if (band < 3.5) {
        return uBandEnabled2 > 0.5;
    }
    if (band < 4.5) {
        return uBandEnabled3 > 0.5;
    }
    return uBandEnabled4 > 0.5;
}

vec3 stripeFillColor(float band) {
    if (band < 1.5) {
        return uColorBand0;
    }
    if (band < 2.5) {
        return uColorBand1;
    }
    if (band < 3.5) {
        return uColorBand2;
    }
    if (band < 4.5) {
        return uColorBand3;
    }
    return uColorBand4;
}

// Keep in sync with playgroundSparkle.ts sparkleCellHash.
float sparkleCellHash(float col, float row) {
    vec2 p = vec2(col + 17.0, row + 31.0);
    vec3 p3 = fract(vec3(p.x, p.y, p.x) * vec3(0.1031, 0.1030, 0.0973));
    p3 += dot(p3, p3.yzx + 33.33);
    return fract((p3.x + p3.y) * p3.z);
}

bool sparkleCellVisible(float col, float row) {
    if (uSparkleEnabled < 0.5) {
        return true;
    }
    float h = sparkleCellHash(col, row);
    if (h >= uSparkleCoverage) {
        return true;
    }
    float phase = h * 17.0;
    float slot = floor(uSparkleTime * uSparkleRateHz + phase);
    return mod(slot, 2.0) < 1.0;
}

// Keep in sync with playgroundWidthShuffle.ts.
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
    float maxW = 5.0;
    float minSwing = 1.25;
    float span = maxW - minW;
    float h = widthShuffleAltHash(col, row, pulseIndex);
    float target = minW + h * span;

    if (abs(target - defaultWidth) < minSwing) {
        if (defaultWidth <= 3.0) {
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
    float defaultWidth = widthPxFromBand(band);
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
    float halfW = stripeWidth * 0.5;
    float relX = pixelCoord.x - columnCenterPx;

    float hCoverage = stripeHorizontalCoverage(relX, halfW, uWidthShuffleEnabled);
    float vCoverage = stripeVerticalVisible(localY, bandTop, bandBottom) ? 1.0 : 0.0;
    float stripeCoverage = hCoverage * vCoverage;

    if (stripeBand > 0.5 && stripeBandEnabled(stripeBand)) {
        if (!sparkleCellVisible(colIndex, rowIndex)) {
            stripeCoverage = 0.0;
        }
        vec3 stripeColor = stripeFillColor(stripeBand);
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
