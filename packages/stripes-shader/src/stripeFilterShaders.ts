/** GLSL sources for the playground stripe duotone filter (shared with React export). */

export const STRIPE_FILTER_VERTEX = `
in vec2 aPosition;
out vec2 vTextureCoord;
out vec2 vDisplayCoord;

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
    vDisplayCoord = aPosition;
}
`;

export const STRIPE_FILTER_FRAGMENT = `
in vec2 vTextureCoord;
in vec2 vDisplayCoord;
out vec4 finalColor;

uniform sampler2D uTexture;
uniform sampler2D uBlockMap;
uniform sampler2D uCellColorMap;
uniform sampler2D uStripeData;
uniform sampler2D uFlames;
uniform sampler2D uStripeIndexLut;
uniform sampler2D uCursorTrail;
uniform sampler2D uCursorTrailPush;
uniform float uFlamesEnabled;
uniform float uInvertStripeBucketing;
uniform float uCursorTrailEnabled;
uniform float uCursorTrailPushEnabled;
uniform float uCursorTrailPushRange;
uniform float uCursorTrailDebug;
uniform float uRevealMode;
uniform float uRevealProgress;
uniform vec2 uRevealOrigin;
uniform float uRevealMaxDistance;
uniform float uRevealSoftness;
uniform float uRevealWaviness;
uniform float uRevealNoiseScale;
uniform float uRevealBandRamp;
uniform float uFlamesMaskEnabled;
uniform float uFlamesMaskStart;
uniform float uFlamesMaskEnd;
uniform float uFlamesMaskPower;
uniform float uStripeCount;
uniform float uUseCellColors;
uniform float uTextureUnderlay;
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
uniform float uScreenScale;

// Signed distance to a rounded rectangle centered at the origin (half-extents b, radius r).
float roundedBoxSdf(vec2 p, vec2 b, float r) {
    vec2 q = abs(p) - b + vec2(r);
    return min(max(q.x, q.y), 0.0) + length(max(q, 0.0)) - r;
}

// Coverage 1 inside the (optionally rounded) stripe rectangle. Edge fade is ~1 framebuffer px
// (via uScreenScale) and capped for thin stripes so 1px bands do not bloom to ~2px on screen.
float stripeRectCoverage(vec2 p, vec2 halfExtents, float radius) {
    if (halfExtents.x <= 0.0 || halfExtents.y <= 0.0) {
        return 0.0;
    }
    float r = clamp(radius, 0.0, min(halfExtents.x, halfExtents.y));
    float dist = roundedBoxSdf(p, halfExtents, r);
    float screenScale = max(uScreenScale, 1.0);
    float aa = 0.5 / screenScale;
    aa = min(aa, min(halfExtents.x, halfExtents.y) * 0.5);
    return 1.0 - smoothstep(0.0, aa, dist);
}

vec2 blockGridUv(float colIndex, float rowIndex) {
    float gridRow = uGridSize.y - 1.0 - rowIndex;
    return vec2(
        (colIndex + 0.5) / uGridSize.x,
        (gridRow + 0.5) / uGridSize.y
    );
}

// Flame raster uses display top-left origin; block-map textures are stored bottom-up.
vec2 flameCellUv(float colIndex, float rowIndex) {
    return vec2(
        (colIndex + 0.5) / uGridSize.x,
        (rowIndex + 0.5) / uGridSize.y
    );
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

float flamesEdgeMaskInset(float inset) {
    if (uFlamesMaskEnabled < 0.5) {
        return 1.0;
    }
    float start = uFlamesMaskStart;
    float end = max(uFlamesMaskEnd, start + 0.0001);
    float t = clamp((inset - start) / (end - start), 0.0, 1.0);
    return pow(t, max(uFlamesMaskPower, 0.0001));
}

float flamesEdgeMask(vec2 coord) {
    float insetX = min(coord.x, 1.0 - coord.x);
    float insetY = min(coord.y, 1.0 - coord.y);
    return flamesEdgeMaskInset(insetX) * flamesEdgeMaskInset(insetY);
}

float bucketingLuma(float luma01) {
    return uInvertStripeBucketing > 0.5 ? 1.0 - luma01 : luma01;
}

float stripeBandForBucketLuma(float luma01) {
    float u = clamp(luma01, 0.0, 1.0);
    return floor(texture(uStripeIndexLut, vec2(u, 0.5)).r * 255.0 + 0.5);
}

float flameCoverAtCell(float colIndex, float rowIndex) {
    if (uFlamesEnabled < 0.5) {
        return 0.0;
    }
    vec2 cellUv = flameCellUv(colIndex, rowIndex);
    vec3 flame = texture(uFlames, cellUv).rgb;
    float mask = flamesEdgeMask(cellUv);
    vec3 flameRgb = flame * mask;
    return clamp(max(max(flameRgb.r, flameRgb.g), flameRgb.b), 0.0, 1.0);
}

// Mirrors cellNoise() in playgroundReveal.ts (same float-hash recipe as the sparkle noise).
float revealCellNoise(float col, float row, float scale) {
    float s = max(0.1, scale);
    vec2 p = vec2(floor(col / s), floor(row / s));
    vec3 p3 = fract(vec3(p.x, p.y, p.x) * vec3(0.1031, 0.1030, 0.0973));
    p3 += dot(p3, p3.yzx + 33.33);
    return fract((p3.x + p3.y) * p3.z);
}

float resolveStripeBand(float band, float colIndex, float rowIndex) {
    float flameCover = flameCoverAtCell(colIndex, rowIndex);
    if (flameCover > 0.001) {
        float flameBand = stripeBandForBucketLuma(bucketingLuma(flameCover));
        band = max(band, flameBand);
    }
    return band;
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
    // Grid indices use filter-quad position (0–1), not texture UVs — video sources can
    // expose a larger GPU source than the visible frame, which skews vTextureCoord.
    vec2 pixelCoord = vDisplayCoord * uPixelSize;

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

    // Reveal runs on the GPU as a per-cell data mask before stripe calculation: the grid
    // is built once unmasked, and the animation only changes uniforms. Wave: feathered
    // distance front from the origin with hash-noise waviness. The trailing band ramp
    // recreates the concentric intermediate rings the CPU path produced via temporal
    // index smoothing during rebuilds.
    float revealMask = 1.0;
    bool revealing = uRevealMode > 0.5;
    if (revealing) {
        vec2 cellUvPos = vec2((colIndex + 0.5) / uGridSize.x, (rowIndex + 0.5) / uGridSize.y);
        float normalizedDistance = length(cellUvPos - uRevealOrigin) / uRevealMaxDistance;
        float edgeNoise = (revealCellNoise(colIndex, rowIndex, uRevealNoiseScale) - 0.5) * uRevealWaviness;
        float softness = max(uRevealSoftness, 0.0001);
        revealMask = smoothstep(
            normalizedDistance - softness,
            normalizedDistance + softness + uRevealBandRamp,
            uRevealProgress + edgeNoise
        );
    }

    vec4 trail = uCursorTrailEnabled > 0.5 ? texture(uCursorTrail, flameCellUv(colIndex, rowIndex)) : vec4(0.0);
    vec3 push = uCursorTrailPushEnabled > 0.5
        ? texture(uCursorTrailPush, flameCellUv(colIndex, rowIndex)).rgb
        : vec3(128.0 / 255.0, 128.0 / 255.0, 0.0);
    // Byte 128 = exactly zero offset (matches the 127-step biased encoding in CursorTrailOverlay).
    vec2 offset = (push.xy * 255.0 - 128.0) / 127.0 * uCursorTrailPushRange;
    float tear = push.z;
    bool displaced = dot(offset, offset) >= 0.0001;
    // Push happens strictly before stripe calculation: each fixed grid cell buckets the
    // source data displaced into it (cell-quantized), then stripes render on the unchanged
    // grid. Block map: R = stripe band, G = bucketing-space luma (already inverted for
    // overlay mode upstream — do not re-invert), A = color coverage.
    vec2 srcPos = vec2(colIndex, rowIndex) + 0.5 - offset;
    float srcCol = colIndex;
    float srcRow = rowIndex;
    vec4 srcBlock;
    if (displaced) {
        // Footprint sampling: take the most content-ful cell (highest band) in the 2x2
        // around the displaced source, so sparse single-cell stripes survive quantization
        // when pushed instead of vanishing into the background.
        vec2 base = floor(srcPos - 0.5);
        vec2 maxCell = uGridSize - 1.0;
        vec2 c00 = clamp(base, vec2(0.0), maxCell);
        vec2 c11 = clamp(base + 1.0, vec2(0.0), maxCell);
        srcCol = c00.x;
        srcRow = c00.y;
        srcBlock = texture(uBlockMap, blockGridUv(c00.x, c00.y));
        vec4 s10 = texture(uBlockMap, blockGridUv(c11.x, c00.y));
        if (s10.r > srcBlock.r) {
            srcBlock = s10;
            srcCol = c11.x;
            srcRow = c00.y;
        }
        vec4 s01 = texture(uBlockMap, blockGridUv(c00.x, c11.y));
        if (s01.r > srcBlock.r) {
            srcBlock = s01;
            srcCol = c00.x;
            srcRow = c11.y;
        }
        vec4 s11 = texture(uBlockMap, blockGridUv(c11.x, c11.y));
        if (s11.r > srcBlock.r) {
            srcBlock = s11;
            srcCol = c11.x;
            srcRow = c11.y;
        }
    } else {
        srcBlock = texture(uBlockMap, blockGridUv(colIndex, rowIndex));
    }
    float storedBand = floor(srcBlock.r * 255.0 + 0.5);
    float l = srcBlock.g;
    float srcCoverage = srcBlock.a;
    if (uCursorTrailDebug > 1.5) {
        // Reveal debug: raw mask field in grayscale.
        finalColor = vec4(vec3(revealMask), 1.0);
        return;
    }
    if (uCursorTrailDebug > 0.5) {
        finalColor = vec4(displaced ? 1.0 : 0.0, trail.a > 0.002 ? 1.0 : 0.0, tear, 1.0);
        return;
    }
    bool inverted = uInvertStripeBucketing > 0.5;
    bool torn = tear > 0.002;
    if (displaced || torn || trail.a > 0.002) {
        // Tear: where the push field stretches the source apart (positive divergence), the
        // data thins toward background — pixels genuinely leave, opening a hole at the core.
        if (inverted) {
            l += (1.0 - l) * tear;
        } else {
            l *= (1.0 - tear);
        }
        // Trail/click paint white directly: every touched cell is lifted toward white
        // (→ top stripe band) by the trail alpha, so the wake adds new stripes over the
        // background too, not just over existing content. No content gate — this matches
        // the applyCursorTrailCell reference model (l + (1 - l) * whiteAlpha).
        float trailLift = trail.a;
        if (inverted) {
            l *= (1.0 - trailLift);
        } else {
            l += (1.0 - l) * trailLift;
        }
        float trailBand = stripeBandForBucketLuma(l);
        // Brighten-only cells stay monotonic vs the stored index (protects colors-mode
        // promotion and non-monotonic stripe lists); displaced/torn/inverted replace.
        storedBand = (displaced || torn || inverted) ? trailBand : max(storedBand, trailBand);
        if (uUseCellColors > 0.5) {
            srcCoverage *= (1.0 - tear);
        }
    }
    if (revealing) {
        // Band-space ramp across the feathered front recreates the concentric
        // intermediate rings of the CPU path.
        storedBand = min(storedBand, floor(storedBand * revealMask + 0.5));
        if (uUseCellColors > 0.5 && revealMask < 1.0) {
            srcCoverage *= revealMask;
        }
    }
    float stripeBand = resolveStripeBand(storedBand, colIndex, rowIndex);

    // The cell size fed in already includes the gap (effective cell = bar size + gap), so the
    // bar keeps its full configured size and the gap is real spacing carved uniformly between
    // every cell — not padding subtracted from the bar.
    float bandTop = alongGap * 0.5;
    float bandBottom = alongCell - alongGap * 0.5;

    // Stripe thickness scales with non-background color fill in colors mode (alpha channel).
    float stripeWidth = resolveAnimatedStripeWidth(colIndex, rowIndex, stripeBand, acrossCell);
    // Coverage is stored in the block-map alpha channel so cell RGB alpha can stay 255.
    // Same content gate as the brighten: width only grows where color coverage exists.
    float coverageScale = uUseCellColors > 0.5
        ? srcCoverage + (1.0 - srcCoverage) * trail.a * smoothstep(0.0, 0.25, srcCoverage)
        : 1.0;
    stripeWidth *= coverageScale;
    stripeWidth = max(stripeWidth, 1.0);
    float halfW = stripeWidth * 0.5;
    float acrossCenter = acrossCell * 0.5;

    float bandCenter = (bandTop + bandBottom) * 0.5;
    float bandHalf = (bandBottom - bandTop) * 0.5;
    vec2 stripePoint = vec2(acrossLocal - acrossCenter, alongLocal - bandCenter);
    vec2 stripeHalf = vec2(halfW, bandHalf);
    float stripeCoverage = stripeRectCoverage(stripePoint, stripeHalf, uCornerRadius);

    vec4 texturePixel = texture(uTexture, vTextureCoord);

    if (stripeBand > 0.5) {
        if (!sparkleCellVisible(colIndex, rowIndex)) {
            stripeCoverage = 0.0;
        }
        vec3 stripeColor = cellFillColor(srcCol, srcRow, stripeBand);
        // Trail tints stripes only in colors mode; in luminance/overlay modes it acts purely
        // through the band (palette colors stay exact).
        if (uUseCellColors > 0.5) {
            stripeColor = mix(stripeColor, trail.rgb, trail.a);
        }
        if (uTextureUnderlay > 0.5) {
            vec3 composite = mix(texturePixel.rgb, stripeColor, stripeCoverage);
            finalColor = vec4(composite, 1.0);
        } else {
            finalColor = vec4(stripeColor * stripeCoverage, stripeCoverage);
        }
    } else if (uTextureUnderlay > 0.5) {
        finalColor = vec4(texturePixel.rgb, texturePixel.a);
    } else {
        finalColor = vec4(0.0, 0.0, 0.0, 0.0);
    }

    if (uDebugVideoAlpha > 0.0) {
        vec4 videoPx = texture(uTexture, vTextureCoord);
        finalColor = mix(finalColor, videoPx, uDebugVideoAlpha);
    }
}
`;
