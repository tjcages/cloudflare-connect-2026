import { Filter, GlProgram, UniformGroup } from "pixi.js";
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

export type SourceTextureFilter = Filter & {
  syncAdjustments: (adjustments: PlaygroundTextureAdjustments) => void;
};

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
