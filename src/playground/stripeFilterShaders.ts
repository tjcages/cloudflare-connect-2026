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
uniform sampler2D uStripeData;
uniform float uStripeCount;
uniform vec2 uPixelSize;
uniform vec2 uFrameSize;
uniform vec2 uGridSize;
uniform vec2 uCellSize;
uniform vec2 uGap;
uniform float uCornerRadius;
uniform float uStripeMaxWidth;
uniform float uWidthShuffleSwing;
uniform float uOrientation;
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

// Signed distance to a rounded rectangle centered at the origin (half-extents b, radius r).
float roundedBoxSdf(vec2 p, vec2 b, float r) {
    vec2 q = abs(p) - b + vec2(r);
    return min(max(q.x, q.y), 0.0) + length(max(q, 0.0)) - r;
}

// Coverage 1 inside the (optionally rounded) stripe rectangle, fading to 0 over a ~1px edge.
float stripeRectCoverage(vec2 p, vec2 halfExtents, float radius) {
    if (halfExtents.x <= 0.0 || halfExtents.y <= 0.0) {
        return 0.0;
    }
    float r = clamp(radius, 0.0, min(halfExtents.x, halfExtents.y));
    float dist = roundedBoxSdf(p, halfExtents, r);
    return 1.0 - smoothstep(0.0, 0.75, dist);
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

float stripeWidthPx(float band) {
    if (band < 0.5) {
        return 0.0;
    }
    return texture(uStripeData, vec2(stripePaletteU(band), 0.75)).r * uStripeMaxWidth;
}

// Keep in sync with playgroundSparkle.ts.
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

float widthShuffleTargetWidth(float col, float row, float pulseIndex, float defaultWidth, float maxW) {
    // Swing is a bounded +/- delta in px around the configured width, independent of cell size.
    float swing = max(uWidthShuffleSwing, 0.0);
    float h = widthShuffleAltHash(col, row, pulseIndex);
    float target = defaultWidth + (h * 2.0 - 1.0) * swing;
    return clamp(target, 1.0, maxW);
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

float resolveAnimatedStripeWidth(float col, float row, float band, float maxW) {
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
    float targetWidth = widthShuffleTargetWidth(col, row, cycleIndex, defaultWidth, maxW);
    float envelope = widthShufflePulseEnvelope(localT);

    return mix(defaultWidth, targetWidth, envelope);
}

void main(void) {
    vec2 pixelCoord = vTextureCoord * uPixelSize;

    float cw = max(uCellSize.x, 1.0);
    float ch = max(uCellSize.y, 1.0);
    float colIndex = floor(pixelCoord.x / cw);
    float rowIndex = floor(pixelCoord.y / ch);
    float localX = pixelCoord.x - colIndex * cw;
    float localY = pixelCoord.y - rowIndex * ch;

    bool horizontal = uOrientation > 0.5;

    // "along" = the band-run direction; "across" = the stripe thickness direction.
    float alongLocal = horizontal ? localX : localY;
    float acrossLocal = horizontal ? localY : localX;
    float alongCell = horizontal ? cw : ch;
    float acrossCell = horizontal ? ch : cw;
    float alongGap = horizontal ? uGap.x : uGap.y;

    float stripeBand = blockStripeBand(colIndex, rowIndex);

    // The cell size fed in already includes the gap (effective cell = bar size + gap), so the
    // bar keeps its full configured size and the gap is real spacing carved uniformly between
    // every cell — not padding subtracted from the bar.
    float bandTop = alongGap * 0.5;
    float bandBottom = alongCell - alongGap * 0.5;

    // Stripe thickness is exactly the configured width in px, centered in the gap-expanded cell.
    float stripeWidth = resolveAnimatedStripeWidth(colIndex, rowIndex, stripeBand, acrossCell);
    float halfW = stripeWidth * 0.5;
    float acrossCenter = acrossCell * 0.5;

    float bandCenter = (bandTop + bandBottom) * 0.5;
    float bandHalf = (bandBottom - bandTop) * 0.5;
    vec2 stripePoint = vec2(acrossLocal - acrossCenter, alongLocal - bandCenter);
    vec2 stripeHalf = vec2(halfW, bandHalf);
    float stripeCoverage = stripeRectCoverage(stripePoint, stripeHalf, uCornerRadius);

    if (stripeBand > 0.5) {
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
