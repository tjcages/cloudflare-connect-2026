/**
 * Pure resolver: StripesShaderConfig → StripesSceneConfig.
 *
 * Mirrors exactly how TexturePlayground.tsx populates its refs before each scene render.
 * Authority: apps/studio/src/playground/TexturePlayground.tsx
 */

import { normalizeStripesShaderConfig, type StripesShaderConfig } from "./StripesShaderConfig";
import { type StripesSceneConfig, type PlaygroundRevealPlayback } from "./setupTextureShaderScene";
import { resolveActivePlaygroundStripes, cloneDefaultOverlayStripes } from "./stripeColors";
import { normalizeTextureLuminanceMode } from "./colorWhiteness";
import { playgroundSparkleOptionsFromSliders } from "./playgroundSparkle";
import { playgroundWidthShuffleOptionsFromSliders } from "./playgroundWidthShuffle";
import { DEFAULT_PLAYGROUND_GRID_CONFIG, normalizePlaygroundGridConfig } from "./playgroundGridConfig";
import {
  DEFAULT_PLAYGROUND_TEXTURE_ADJUSTMENTS,
  normalizePlaygroundTextureAdjustments,
} from "./playgroundTextureAdjustments";
import { DEFAULT_PLAYGROUND_SOURCE_TRANSFORM, normalizePlaygroundSourceTransform } from "./playgroundSourceTransform";
import { DEFAULT_PLAYGROUND_FLAMES_CONFIG, normalizePlaygroundFlamesConfig } from "./playgroundFlamesConfig";
import { DEFAULT_PLAYGROUND_REVEAL_CONFIG, normalizePlaygroundRevealConfig } from "./playgroundRevealConfig";
import {
  DEFAULT_PLAYGROUND_CURSOR_TRAIL_CONFIG,
  normalizePlaygroundCursorTrailConfig,
} from "./playgroundCursorTrailConfig";
import { DEFAULT_PLAYGROUND_CLICK_WAVE_CONFIG, normalizePlaygroundClickWaveConfig } from "./playgroundClickWaveConfig";
import { DEFAULT_TEXTURE_LUMINANCE_BACKGROUND_COLOR } from "./colorWhiteness";

/**
 * Resolve a serializable StripesShaderConfig into the runtime StripesSceneConfig bundle.
 *
 * Mirrors how TexturePlayground populates its refs:
 * - stripeColors ← resolveActivePlaygroundStripes(mode, stripes, overlayStripes) [TP line 361-364, 624-626]
 * - sparkle ← playgroundSparkleOptionsFromSliders(activePercent, speed, gridConfig.periodMinSec, gridConfig.periodMaxSec) [TP lines 453-465]
 * - widthShuffle ← playgroundWidthShuffleOptionsFromSliders(widthPercent, widthSpeed, gridConfig.widthPeriodMinSec, gridConfig.widthPeriodMaxSec) [TP lines 467-479]
 * - textureGamma ← textureAdjustments.gamma [TP line 360]
 * - All sub-configs pass through directly
 */
export function resolveStripesSceneConfig(
  config: StripesShaderConfig,
  opts: {
    preferP3: boolean;
    revealPlayback: PlaygroundRevealPlayback;
  },
): StripesSceneConfig {
  const normalized = normalizeStripesShaderConfig(config);

  // Resolve sub-configs through their normalizers (guaranteed non-undefined)
  const grid = normalizePlaygroundGridConfig(normalized.grid ?? DEFAULT_PLAYGROUND_GRID_CONFIG);
  const textureAdjustments = normalizePlaygroundTextureAdjustments(
    normalized.textureAdjustments ?? DEFAULT_PLAYGROUND_TEXTURE_ADJUSTMENTS,
  );
  const sourceTransform = normalizePlaygroundSourceTransform(
    normalized.sourceTransform ?? DEFAULT_PLAYGROUND_SOURCE_TRANSFORM,
  );
  const flamesConfig = normalizePlaygroundFlamesConfig(normalized.flames ?? DEFAULT_PLAYGROUND_FLAMES_CONFIG);
  const revealConfig = normalizePlaygroundRevealConfig(normalized.reveal ?? DEFAULT_PLAYGROUND_REVEAL_CONFIG);
  const cursorTrailConfig = normalizePlaygroundCursorTrailConfig(
    normalized.cursorTrail ?? DEFAULT_PLAYGROUND_CURSOR_TRAIL_CONFIG,
  );
  const clickWaveConfig = normalizePlaygroundClickWaveConfig(
    normalized.clickWave ?? DEFAULT_PLAYGROUND_CLICK_WAVE_CONFIG,
  );

  const textureLuminanceMode = normalizeTextureLuminanceMode(normalized.textureLuminanceMode);
  const textureLuminanceSettings = {
    mode: textureLuminanceMode,
    backgroundColor: normalized.textureLuminanceBackgroundColor ?? DEFAULT_TEXTURE_LUMINANCE_BACKGROUND_COLOR,
  };

  // Overlay stripes: use provided overlayStripes or fall back to defaults (mirrors resolvePersistedOverlayStripes)
  const overlayStripes = normalized.overlayStripes ?? cloneDefaultOverlayStripes();

  // stripeColors: resolveActivePlaygroundStripes picks stripes or overlayStripes based on luminance mode
  // Authority: TexturePlayground.tsx line 361-364 (activeStripes useMemo) + line 624-626 (sync to ref)
  const activeStripes = resolveActivePlaygroundStripes(textureLuminanceMode, normalized.stripes, overlayStripes);
  const stripeColors = { stripes: [...activeStripes] };

  // Sparkle options: slider values + grid period config
  // Authority: TexturePlayground.tsx useEffect lines 453-465
  const sparkle = playgroundSparkleOptionsFromSliders(
    normalized.sparkleGapsActivePercent ?? 0,
    normalized.sparkleGapsSpeed ?? 1,
    grid.sparkleGapsPeriodMinSec,
    grid.sparkleGapsPeriodMaxSec,
  );

  // Width shuffle options: slider values + grid period config
  // Authority: TexturePlayground.tsx useEffect lines 467-479
  const widthShuffle = playgroundWidthShuffleOptionsFromSliders(
    normalized.sparkleWidthActivePercent ?? 0.3,
    normalized.sparkleWidthSpeed ?? 1,
    grid.sparkleWidthPeriodMinSec,
    grid.sparkleWidthPeriodMaxSec,
  );

  // textureGamma: derived from textureAdjustments.gamma
  // Authority: TexturePlayground.tsx line 360 "const textureGamma = textureAdjustments.gamma;"
  const textureGamma = textureAdjustments.gamma;

  return {
    stripeColors,
    preferP3: opts.preferP3,
    duotoneEnabled: normalized.duotoneEnabled,
    stripesEnabled: normalized.stripesEnabled !== false,
    textureGamma,
    sparkle,
    widthShuffle,
    gridConfig: grid,
    textureAdjustments,
    textureLuminanceSettings,
    sourceTransform,
    flamesConfig,
    revealConfig,
    revealPlayback: opts.revealPlayback,
    cursorTrailConfig,
    clickWaveConfig,
  };
}
