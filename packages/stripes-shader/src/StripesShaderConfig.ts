/**
 * Aggregate shader configuration type for @necatikcl/stripes-shader.
 *
 * This is the clean version of PlaygroundPersistedConfig from apps/studio, with
 * three deprecated fields removed: textureGamma, sparkleRate, sparkleEnabled.
 * The studio's resolvePersisted* functions are the authority for fill/clamp semantics.
 */

import {
  type PlaygroundTextureAdjustments,
  normalizePlaygroundTextureAdjustments,
  DEFAULT_PLAYGROUND_TEXTURE_ADJUSTMENTS,
} from "./playgroundTextureAdjustments";
import {
  type TextureLuminanceMode,
  normalizeTextureLuminanceMode,
  DEFAULT_TEXTURE_LUMINANCE_MODE,
  normalizeTextureLuminanceBackgroundColor,
  DEFAULT_TEXTURE_LUMINANCE_BACKGROUND_COLOR,
} from "./colorWhiteness";
import {
  type PlaygroundSourceTransform,
  normalizePlaygroundSourceTransform,
  DEFAULT_PLAYGROUND_SOURCE_TRANSFORM,
} from "./playgroundSourceTransform";
import {
  type PlaygroundGridConfig,
  normalizePlaygroundGridConfig,
  DEFAULT_PLAYGROUND_GRID_CONFIG,
} from "./playgroundGridConfig";
import {
  type PlaygroundFlamesConfig,
  normalizePlaygroundFlamesConfig,
  DEFAULT_PLAYGROUND_FLAMES_CONFIG,
} from "./playgroundFlamesConfig";
import {
  type PlaygroundRevealConfig,
  normalizePlaygroundRevealConfig,
  DEFAULT_PLAYGROUND_REVEAL_CONFIG,
} from "./playgroundRevealConfig";
import {
  type PlaygroundCursorTrailConfig,
  normalizePlaygroundCursorTrailConfig,
  DEFAULT_PLAYGROUND_CURSOR_TRAIL_CONFIG,
} from "./playgroundCursorTrailConfig";
import {
  type PlaygroundClickWaveConfig,
  normalizePlaygroundClickWaveConfig,
  DEFAULT_PLAYGROUND_CLICK_WAVE_CONFIG,
} from "./playgroundClickWaveConfig";
import { type Stripe, cloneDefaultStripes, normalizeStripe } from "./stripeColors";
import {
  normalizeSparkleGapsActivePercent,
  DEFAULT_PLAYGROUND_SPARKLE_GAPS_ACTIVE_PERCENT,
  normalizeSparkleGapsSpeed,
  DEFAULT_PLAYGROUND_SPARKLE_GAPS_SPEED,
} from "./playgroundSparkle";
import {
  normalizeSparkleWidthActivePercent,
  DEFAULT_PLAYGROUND_SPARKLE_WIDTH_ACTIVE_PERCENT,
  normalizeSparkleWidthSpeed,
  DEFAULT_PLAYGROUND_SPARKLE_WIDTH_SPEED,
} from "./playgroundWidthShuffle";

/**
 * Clean aggregate config for the stripes shader.
 * Equivalent to PlaygroundPersistedConfig minus the three deprecated fields:
 *   - textureGamma (superseded by textureAdjustments.gamma)
 *   - sparkleRate (superseded by sparkleGapsActivePercent)
 *   - sparkleEnabled (superseded by sparkleGapsActivePercent)
 */
export type StripesShaderConfig = {
  duotoneEnabled: boolean;
  /** Stripe overlay visibility. False keeps the source texture visible without stripe bucketing. */
  stripesEnabled?: boolean;
  /** Raw CSS declarations applied to the playground canvas element. */
  backgroundCss?: string;
  /**
   * Canvas background color as 0xRRGGBB when CSS is empty.
   * Default 0xffffff (white) — studio-side constant omitted here to keep the package dependency-clean.
   */
  backgroundColor?: number;
  /** Designer texture/tone adjustments (includes gamma; textureGamma deprecated field is gone). */
  textureAdjustments?: PlaygroundTextureAdjustments;
  /** How sampled texture pixels become 0–1 stripe thresholds. Default: "luminance". */
  textureLuminanceMode?: TextureLuminanceMode;
  /** Texture background color used by color-distance luminance mode. Default: 0x000000. */
  textureLuminanceBackgroundColor?: number;
  /** Source fit/crop transform. */
  sourceTransform?: PlaygroundSourceTransform;
  /** Active cell ratio 0–1 for gap sparkle (0 = off). Default 0.22. */
  sparkleGapsActivePercent?: number;
  /** Gap pulse speed factor (1 = baseline). Default 1. */
  sparkleGapsSpeed?: number;
  /** Active cell ratio 0–1 for width shuffle (0 = off). Default 0.3. */
  sparkleWidthActivePercent?: number;
  /** Width pulse speed factor (1 = baseline). Default 1. */
  sparkleWidthSpeed?: number;
  /** Canvas width in px; omitted = match native source width on load. */
  displayWidth?: number;
  /** Canvas height in px; omitted = match native source height on load. */
  displayHeight?: number;
  /** Designer-tunable grid geometry / letter / animation config. */
  grid?: PlaygroundGridConfig;
  /** Background flame streak settings. */
  flames?: PlaygroundFlamesConfig;
  /** Reveal animation settings. */
  reveal?: PlaygroundRevealConfig;
  /** Cursor trail settings. */
  cursorTrail?: PlaygroundCursorTrailConfig;
  /** Click ripple settings. */
  clickWave?: PlaygroundClickWaveConfig;
  /** Ordered luminosity stripes (color + start-from + width). */
  stripes: Stripe[];
  /** Overlay-mode stripe list (loudest three bands). Omitted = defaults. */
  overlayStripes?: Stripe[];
};

/**
 * Default StripesShaderConfig.
 * Presentation-only optionals (backgroundCss, displayWidth, displayHeight) are omitted
 * to mirror the studio's default-omission behavior.
 */
export const DEFAULT_STRIPES_SHADER_CONFIG: StripesShaderConfig = {
  duotoneEnabled: true,
  textureAdjustments: DEFAULT_PLAYGROUND_TEXTURE_ADJUSTMENTS,
  textureLuminanceMode: DEFAULT_TEXTURE_LUMINANCE_MODE,
  textureLuminanceBackgroundColor: DEFAULT_TEXTURE_LUMINANCE_BACKGROUND_COLOR,
  sourceTransform: DEFAULT_PLAYGROUND_SOURCE_TRANSFORM,
  sparkleGapsActivePercent: DEFAULT_PLAYGROUND_SPARKLE_GAPS_ACTIVE_PERCENT,
  sparkleGapsSpeed: DEFAULT_PLAYGROUND_SPARKLE_GAPS_SPEED,
  sparkleWidthActivePercent: DEFAULT_PLAYGROUND_SPARKLE_WIDTH_ACTIVE_PERCENT,
  sparkleWidthSpeed: DEFAULT_PLAYGROUND_SPARKLE_WIDTH_SPEED,
  grid: DEFAULT_PLAYGROUND_GRID_CONFIG,
  flames: DEFAULT_PLAYGROUND_FLAMES_CONFIG,
  reveal: DEFAULT_PLAYGROUND_REVEAL_CONFIG,
  cursorTrail: DEFAULT_PLAYGROUND_CURSOR_TRAIL_CONFIG,
  clickWave: DEFAULT_PLAYGROUND_CLICK_WAVE_CONFIG,
  stripes: cloneDefaultStripes(),
};

/**
 * Normalize a partial StripesShaderConfig into a complete one.
 *
 * Semantics match the studio's resolvePersisted* functions in
 * apps/studio/src/playground/playgroundPersistence.ts field-for-field.
 *
 * Note on textureAdjustments: the studio's resolvePersistedTextureAdjustments
 * folds the deprecated textureGamma into textureAdjustments.gamma. That
 * deprecated-field fold is studio-only (Task 2). Here we normalize
 * textureAdjustments directly — callers providing a clean StripesShaderConfig
 * (no textureGamma) get identical results.
 */
export function normalizeStripesShaderConfig(input: Partial<StripesShaderConfig>): StripesShaderConfig {
  return {
    // Boolean passthrough — default true (matches studio persisted config convention)
    duotoneEnabled: input.duotoneEnabled !== undefined ? input.duotoneEnabled : true,
    // Optional presentation booleans/strings passed through as-is
    ...(input.stripesEnabled !== undefined ? { stripesEnabled: input.stripesEnabled } : {}),
    ...(input.backgroundCss !== undefined ? { backgroundCss: input.backgroundCss } : {}),
    ...(input.backgroundColor !== undefined ? { backgroundColor: input.backgroundColor } : {}),
    // sub-configs: each runs through its own normalizer (mirrors resolvePersistedXxx calls)
    textureAdjustments: normalizePlaygroundTextureAdjustments(input.textureAdjustments),
    textureLuminanceMode: normalizeTextureLuminanceMode(input.textureLuminanceMode ?? DEFAULT_TEXTURE_LUMINANCE_MODE),
    textureLuminanceBackgroundColor: normalizeTextureLuminanceBackgroundColor(
      input.textureLuminanceBackgroundColor ?? DEFAULT_TEXTURE_LUMINANCE_BACKGROUND_COLOR,
    ),
    sourceTransform: normalizePlaygroundSourceTransform(input.sourceTransform),
    // sparkle scalars: absent-field semantics mirror the studio's resolvePersisted* functions exactly.
    //
    // sparkleGapsActivePercent:
    //   resolvePersistedSparkleGapsActivePercent (playgroundSparkle.ts:113-129) returns 0 when the
    //   field is absent and no legacy sparkleRate/sparkleEnabled present → absent means OFF (0), not
    //   DEFAULT_PLAYGROUND_SPARKLE_GAPS_ACTIVE_PERCENT (0.22).
    //
    // sparkleGapsSpeed:
    //   resolvePersistedSparkleGapsSpeed (playgroundSparkle.ts:131-147) returns
    //   DEFAULT_PLAYGROUND_SPARKLE_GAPS_SPEED (1) when the field is absent → absent = default speed.
    //
    // sparkleWidthActivePercent:
    //   resolvePersistedSparkleWidthActivePercent (playgroundWidthShuffle.ts:244-249) returns
    //   DEFAULT_PLAYGROUND_SPARKLE_WIDTH_ACTIVE_PERCENT (0.3) when absent → absent = default ON (0.3).
    //   serializePlaygroundState omits the field precisely when it equals 0.3, so round-trips cleanly.
    //
    // sparkleWidthSpeed:
    //   resolvePersistedSparkleWidthSpeed (playgroundWidthShuffle.ts:251-256) returns
    //   DEFAULT_PLAYGROUND_SPARKLE_WIDTH_SPEED (1) when absent → absent = default speed.
    sparkleGapsActivePercent: normalizeSparkleGapsActivePercent(
      input.sparkleGapsActivePercent !== undefined ? input.sparkleGapsActivePercent : 0,
    ),
    sparkleGapsSpeed: normalizeSparkleGapsSpeed(input.sparkleGapsSpeed ?? DEFAULT_PLAYGROUND_SPARKLE_GAPS_SPEED),
    sparkleWidthActivePercent: normalizeSparkleWidthActivePercent(
      input.sparkleWidthActivePercent ?? DEFAULT_PLAYGROUND_SPARKLE_WIDTH_ACTIVE_PERCENT,
    ),
    sparkleWidthSpeed: normalizeSparkleWidthSpeed(input.sparkleWidthSpeed ?? DEFAULT_PLAYGROUND_SPARKLE_WIDTH_SPEED),
    // Display dimensions: passthrough (falsy = omit, matching studio behavior)
    ...(input.displayWidth && input.displayWidth > 0 ? { displayWidth: input.displayWidth } : {}),
    ...(input.displayHeight && input.displayHeight > 0 ? { displayHeight: input.displayHeight } : {}),
    // sub-configs via their own normalizers
    grid: normalizePlaygroundGridConfig(input.grid),
    flames: normalizePlaygroundFlamesConfig(input.flames),
    reveal: normalizePlaygroundRevealConfig(input.reveal),
    cursorTrail: normalizePlaygroundCursorTrailConfig(input.cursorTrail),
    clickWave: normalizePlaygroundClickWaveConfig(input.clickWave),
    // stripes: map through normalizeStripe; fallback to defaults when absent/empty
    stripes: (input.stripes ?? cloneDefaultStripes()).map((s) => normalizeStripe({ ...s })),
    // overlayStripes: same as resolvePersistedOverlayStripes — empty/absent → defaults
    ...(() => {
      const raw = input.overlayStripes;
      if (!raw || raw.length === 0) {
        return {};
      }
      return { overlayStripes: raw.map((s) => normalizeStripe({ ...s })) };
    })(),
  };
}
