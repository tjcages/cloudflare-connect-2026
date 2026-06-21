import { Filter, GlProgram, Texture, UniformGroup } from "pixi.js";
import {
  normalizeTextureLuminanceBackgroundColor,
  normalizeTextureLuminanceMode,
  type TextureLuminanceSettings,
} from "./colorWhiteness";
import type { PlaygroundFlamesConfig } from "./playgroundFlamesConfig";
import {
  normalizePlaygroundTextureAdjustments,
  type PlaygroundTextureAdjustments,
} from "./playgroundTextureAdjustments";
import { STRIPE_FILTER_VERTEX } from "./stripeFilterShaders";

// Produces the RENDER FIELD (docs/render-pipeline-architecture.md, R1/R2): a grayscale
// texture where white = render a stripe, black = hide. NOT a color image.
export const SOURCE_TEXTURE_FILTER_FRAGMENT = `
in vec2 vTextureCoord;
in vec2 vDisplayCoord;
out vec4 finalColor;

uniform sampler2D uTexture;
uniform sampler2D uFlames;
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
uniform float uBlurRadius;
uniform float uSharpenAmount;
uniform vec2 uTexelSize;
uniform float uFlamesEnabled;
uniform float uFlamesMaskEnabled;
uniform float uFlamesMaskStart;
uniform float uFlamesMaskEnd;
uniform float uFlamesMaskPower;
uniform float uColorsMode;
uniform float uOverlayInvert;
uniform vec3 uTextureBgColor;

const float COLOR_DISTANCE_SCALE = 0.8660254037844386; // sqrt(3)

float rec709Luma(vec3 rgb) {
    return dot(rgb, vec3(0.2126, 0.7152, 0.0722));
}

float colorDistanceLuma(vec3 rgb) {
    return min(1.0, length(rgb - uTextureBgColor) / COLOR_DISTANCE_SCALE);
}

float pixelSaturation(vec3 rgb) {
    float maxC = max(max(rgb.r, rgb.g), rgb.b);
    float minC = min(min(rgb.r, rgb.g), rgb.b);
    if (maxC <= 0.0) {
        return 0.0;
    }
    return (maxC - minC) / maxC;
}

float colorPixelPresence(vec3 rgb) {
    float distance = colorDistanceLuma(rgb);
    float saturation = pixelSaturation(rgb);
    if (saturation <= 0.02) {
        return distance;
    }
    return distance * (0.2 + 0.8 * saturation);
}

float sampleMergedLuma(vec3 rgb) {
    if (uColorsMode > 0.5) {
        return colorPixelPresence(rgb);
    }
    return rec709Luma(rgb);
}

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

vec3 readFlameSample(out float flameCover) {
    flameCover = 0.0;
    if (uFlamesEnabled < 0.5) {
        return vec3(0.0);
    }
    vec3 flame = texture(uFlames, vDisplayCoord).rgb;
    float mask = flamesEdgeMask(vDisplayCoord);
    vec3 flameRgb = flame * mask;
    flameCover = clamp(max(max(flameRgb.r, flameRgb.g), flameRgb.b), 0.0, 1.0);
    return flameRgb;
}

vec3 mergeFlameColor(vec3 sourceRgb, vec3 flameRgb, float flameCover) {
    if (flameCover < 0.001) {
        return sourceRgb;
    }
    // max() hides flames on bright/white pixels; blend toward overlay color instead.
    return mix(sourceRgb, flameRgb, flameCover);
}

vec3 applyFlames(vec3 color) {
    float flameCover;
    vec3 flameRgb = readFlameSample(flameCover);
    return mergeFlameColor(color, flameRgb, flameCover);
}

vec3 compositeSourceRgb(vec4 source) {
    float alpha = source.a;
    vec3 straight = alpha > 0.0001 ? source.rgb / alpha : vec3(0.0);
    return mix(uTextureBgColor, straight, alpha);
}

vec3 readCompositedSource(vec2 uv) {
    return compositeSourceRgb(texture(uTexture, uv));
}

vec3 boxBlurSourceRgb(vec2 uv, float radius) {
    vec3 sum = vec3(0.0);
    float count = 0.0;
    for (int y = -8; y <= 8; y++) {
        for (int x = -8; x <= 8; x++) {
            if (abs(float(x)) > radius || abs(float(y)) > radius) {
                continue;
            }
            vec2 offset = vec2(float(x), float(y)) * uTexelSize;
            sum += readCompositedSource(uv + offset);
            count += 1.0;
        }
    }
    return sum / max(count, 1.0);
}

vec3 sampleFilteredSourceRgb(vec2 uv) {
    vec3 center = readCompositedSource(uv);
    float radius = floor(uBlurRadius + 0.5);
    if (radius < 0.5) {
        return center;
    }

    float spread = min(radius * 2.0, 8.0);
    vec3 blurred = boxBlurSourceRgb(uv, spread);
    if (uSharpenAmount > 0.0) {
        return clamp(center + (center - blurred) * uSharpenAmount, 0.0, 1.0);
    }
    return blurred;
}

void main(void) {
    vec3 merged = applyFlames(sampleFilteredSourceRgb(vTextureCoord));
    float mergedLuma = sampleMergedLuma(merged);
    float adjusted = adjustLuma(mergedLuma);
    // Render field (rules R1/R2): grayscale, white = render a stripe, black = hide.
    // Overlay mode inverts so dark content on a light background renders on the content.
    // Mirrors finalizeStripeBucketingLuminance(applyTextureLuminanceAdjustments(...), mode).
    float field = uOverlayInvert > 0.5 ? 1.0 - adjusted : adjusted;
    finalColor = vec4(vec3(field), 1.0);
}
`;

function previewBlurPadding(adjustments: PlaygroundTextureAdjustments): number {
  const blurRadius = Math.round(adjustments.blurRadius);
  const spread = Math.min(blurRadius * 2, 8);
  return Math.max(0, Math.ceil(spread));
}

export type SourceTextureFilter = Filter & {
  syncAdjustments: (adjustments: PlaygroundTextureAdjustments) => void;
  syncTexelSize: (width: number, height: number) => void;
  syncLuminanceSettings: (settings: TextureLuminanceSettings) => void;
  syncFlames: (texture: Texture | null, config: PlaygroundFlamesConfig | null) => void;
};

function textureBackgroundColorToRgb01(color: number): [number, number, number] {
  const normalized = normalizeTextureLuminanceBackgroundColor(color);
  return [((normalized >> 16) & 0xff) / 255, ((normalized >> 8) & 0xff) / 255, (normalized & 0xff) / 255];
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
    uBlurRadius: { value: normalized.blurRadius, type: "f32" },
    uSharpenAmount: { value: normalized.sharpenAmount, type: "f32" },
    uTexelSize: { value: [0, 0], type: "vec2<f32>" },
    uFlamesEnabled: { value: 0, type: "f32" },
    uFlamesMaskEnabled: { value: 0, type: "f32" },
    uFlamesMaskStart: { value: 0, type: "f32" },
    uFlamesMaskEnd: { value: 0.1, type: "f32" },
    uFlamesMaskPower: { value: 1, type: "f32" },
    uColorsMode: { value: 0, type: "f32" },
    uOverlayInvert: { value: 0, type: "f32" },
    uTextureBgColor: { value: [0, 0, 0], type: "vec3<f32>" },
  });

  const filter = new Filter({
    glProgram: GlProgram.from({
      vertex: STRIPE_FILTER_VERTEX,
      fragment: SOURCE_TEXTURE_FILTER_FRAGMENT,
    }),
    clipToViewport: false,
    padding: previewBlurPadding(normalized),
    resources: {
      textureUniforms,
      uFlames: Texture.EMPTY.source,
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
      uBlurRadius: number;
      uSharpenAmount: number;
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
    uniforms.uBlurRadius = next.blurRadius;
    uniforms.uSharpenAmount = next.sharpenAmount;
    filter.padding = previewBlurPadding(next);
    textureUniforms.update();
  };

  filter.syncTexelSize = (width, height) => {
    const uniforms = textureUniforms.uniforms as { uTexelSize: number[] };
    uniforms.uTexelSize[0] = width > 0 ? 1 / width : 0;
    uniforms.uTexelSize[1] = height > 0 ? 1 / height : 0;
    textureUniforms.update();
  };

  filter.syncLuminanceSettings = (settings) => {
    const mode = normalizeTextureLuminanceMode(settings.mode);
    const bg = textureBackgroundColorToRgb01(settings.backgroundColor);
    const uniforms = textureUniforms.uniforms as {
      uColorsMode: number;
      uTextureBgColor: number[];
      uOverlayInvert: number;
    };
    uniforms.uColorsMode = mode === "colors" ? 1 : 0;
    uniforms.uTextureBgColor = bg;
    uniforms.uOverlayInvert = mode === "overlay" ? 1 : 0;
    textureUniforms.update();
  };

  filter.syncLuminanceSettings({
    mode: "luminance",
    backgroundColor: normalizeTextureLuminanceBackgroundColor(undefined),
  });

  filter.syncFlames = (texture, config) => {
    const flamesTexture = texture ?? Texture.EMPTY;
    flamesTexture.source.style.scaleMode = "linear";
    filter.resources.uFlames = flamesTexture.source;
    const uniforms = textureUniforms.uniforms as {
      uFlamesEnabled: number;
      uFlamesMaskEnabled: number;
      uFlamesMaskStart: number;
      uFlamesMaskEnd: number;
      uFlamesMaskPower: number;
    };
    const enabled = Boolean(config?.enabled);
    uniforms.uFlamesEnabled = enabled ? 1 : 0;
    uniforms.uFlamesMaskEnabled = enabled && config?.edgeMaskEnabled !== false ? 1 : 0;
    uniforms.uFlamesMaskStart = config?.edgeMaskStart ?? 0;
    uniforms.uFlamesMaskEnd = config?.edgeMaskEnd ?? 0.1;
    uniforms.uFlamesMaskPower = config?.edgeMaskPower ?? 1;
    textureUniforms.update();
  };

  return filter;
}
