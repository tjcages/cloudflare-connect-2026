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
uniform float uFlamesEnabled;
uniform float uFlamesMaskEnabled;
uniform float uFlamesMaskStart;
uniform float uFlamesMaskEnd;
uniform float uFlamesMaskPower;
uniform float uColorsMode;
uniform vec3 uTextureBgColor;

const float COLOR_DISTANCE_SCALE = 0.8660254037844386; // sqrt(3)

float rec709Luma(vec3 rgb) {
    return dot(rgb, vec3(0.2126, 0.7152, 0.0722));
}

float colorDistanceLuma(vec3 rgb) {
    return min(1.0, length(rgb - uTextureBgColor) / COLOR_DISTANCE_SCALE);
}

float sampleMergedLuma(vec3 rgb) {
    if (uColorsMode > 0.5) {
        return colorDistanceLuma(rgb);
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

void main(void) {
    vec4 sourceColor = texture(uTexture, vTextureCoord);
    vec3 merged = applyFlames(sourceColor.rgb);
    float mergedLuma = sampleMergedLuma(merged);
    float adjusted = adjustLuma(mergedLuma);
    vec3 finalRgb = mergedLuma > 0.0001 ? merged * (adjusted / mergedLuma) : vec3(adjusted);
    finalColor = vec4(clamp(finalRgb, 0.0, 1.0), sourceColor.a);
}
`;

export type SourceTextureFilter = Filter & {
  syncAdjustments: (adjustments: PlaygroundTextureAdjustments) => void;
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
    uFlamesEnabled: { value: 0, type: "f32" },
    uFlamesMaskEnabled: { value: 0, type: "f32" },
    uFlamesMaskStart: { value: 0, type: "f32" },
    uFlamesMaskEnd: { value: 0.1, type: "f32" },
    uFlamesMaskPower: { value: 1, type: "f32" },
    uColorsMode: { value: 0, type: "f32" },
    uTextureBgColor: { value: [0, 0, 0], type: "vec3<f32>" },
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

  filter.syncLuminanceSettings = (settings) => {
    const mode = normalizeTextureLuminanceMode(settings.mode);
    const bg = textureBackgroundColorToRgb01(settings.backgroundColor);
    const uniforms = textureUniforms.uniforms as {
      uColorsMode: number;
      uTextureBgColor: number[];
    };
    uniforms.uColorsMode = mode === "colors" ? 1 : 0;
    uniforms.uTextureBgColor = bg;
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
