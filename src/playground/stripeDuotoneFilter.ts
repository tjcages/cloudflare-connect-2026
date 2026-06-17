import { Filter, GlProgram, Texture, UniformGroup } from "pixi.js";
import type { PlaygroundFlamesConfig } from "./playgroundFlamesConfig";
import { resolveWaveRevealGeometry } from "./playgroundReveal";
import { resolvePlaygroundRevealDurationMs, type PlaygroundRevealConfig } from "./playgroundRevealConfig";
import { STRIPE_FILTER_FRAGMENT, STRIPE_FILTER_VERTEX } from "./stripeFilterShaders";
import { buildStripeIndexLut, buildStripeColors, resolveStripePalette, type StripeColors } from "./stripeColors";
import { StripeIndexLutTexture } from "./stripeIndexLutTexture";
import { StripePaletteTexture } from "./stripePaletteTexture";
import { DEFAULT_PLAYGROUND_SPARKLE_OPTIONS, type PlaygroundSparkleOptions } from "./playgroundSparkle";
import { DEFAULT_PLAYGROUND_WIDTH_SHUFFLE_OPTIONS, type PlaygroundWidthShuffleOptions } from "./playgroundWidthShuffle";
import {
  DEFAULT_PLAYGROUND_GRID_CONFIG,
  effectivePlaygroundCellSize,
  type PlaygroundGridConfig,
} from "./playgroundGridConfig";
import { STRIPE_WIDTH_ENCODE_MAX } from "./stripeGridConstants";

/** Set > 0 to composite source video for grid-alignment debugging. */
export const STRIPE_DEBUG_VIDEO_OVERLAY_ALPHA = 0;

/**
 * 1 = cursor-trail cell classification (R=displaced, G=brighten, B=tear); 2 = reveal mask
 * field; 3 = raw reveal view — cell content as solid grayscale blocks inside the
 * reveal-scaled column slice, stripes removed entirely.
 */
export const STRIPE_DEBUG_CURSOR_TRAIL = 0;

export type StripeDuotoneFilter = Filter & {
  syncColors: (colors: StripeColors, preferP3?: boolean) => void;
  syncUseCellColors: (enabled: boolean) => void;
  syncInvertStripeBucketing: (enabled: boolean) => void;
  syncTextureUnderlay: (enabled: boolean) => void;
  syncSparkle: (options: PlaygroundSparkleOptions, timeSec: number) => void;
  syncWidthShuffle: (options: PlaygroundWidthShuffleOptions, timeSec: number) => void;
  /** Renderer resolution (devicePixelRatio) for screen-space stripe edge antialiasing. */
  syncScreenScale: (resolution: number) => void;
  /** Push live-updatable grid params (gap, corner radius, swing, orientation). */
  syncGrid: (grid: PlaygroundGridConfig) => void;
  /** Update grid dimensions + effective cell size when the cell/gap changes (no scene remount). */
  resizeGrid: (cols: number, rows: number, effWidth: number, effHeight: number) => void;
  updateBlockMap: (blockMap: Texture) => void;
  updateCellColorMap: (cellColorMap: Texture) => void;
  syncFlames: (texture: Texture | null, config: PlaygroundFlamesConfig | null) => void;
  syncCursorTrail: (trail: Texture | null, pushTexture: Texture | null, pushRange: number) => void;
  /** GPU wave reveal mask: null disables it; progress may run past 1 for the ramp tail. */
  syncReveal: (config: PlaygroundRevealConfig | null, progress: number) => void;
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
  colors: StripeColors = buildStripeColors(),
  preferP3 = false,
  grid: PlaygroundGridConfig = DEFAULT_PLAYGROUND_GRID_CONFIG,
): StripeDuotoneFilter {
  const palette = new StripePaletteTexture();
  const stripeIndexLut = new StripeIndexLutTexture();
  palette.update(resolveStripePalette(colors, preferP3));
  stripeIndexLut.update(buildStripeIndexLut(colors.stripes));

  const effectiveCell = effectivePlaygroundCellSize(grid);

  const stripeUniforms = new UniformGroup({
    uPixelSize: { value: [canvasWidth, canvasHeight], type: "vec2<f32>" },
    uFrameSize: { value: [canvasWidth, canvasHeight], type: "vec2<f32>" },
    uGridSize: { value: [gridCols, gridRows], type: "vec2<f32>" },
    uCellSize: { value: [effectiveCell.width, effectiveCell.height], type: "vec2<f32>" },
    uGap: { value: [grid.gapX, grid.gapY], type: "vec2<f32>" },
    uCornerRadius: { value: grid.cornerRadius, type: "f32" },
    uStripeMaxWidth: { value: STRIPE_WIDTH_ENCODE_MAX, type: "f32" },
    uUseCellColors: { value: 0, type: "f32" },
    uTextureUnderlay: { value: 0, type: "f32" },
    uWidthShuffleSwing: { value: grid.widthShuffleSwing, type: "f32" },
    uOrientation: { value: grid.orientation === "horizontal" ? 1 : 0, type: "f32" },
    uStripeCount: { value: palette.count, type: "f32" },
    uDebugVideoAlpha: { value: STRIPE_DEBUG_VIDEO_OVERLAY_ALPHA, type: "f32" },
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
    uScreenScale: { value: 1, type: "f32" },
    uFlamesEnabled: { value: 0, type: "f32" },
    uFlamesMaskEnabled: { value: 0, type: "f32" },
    uFlamesMaskStart: { value: 0, type: "f32" },
    uFlamesMaskEnd: { value: 0.1, type: "f32" },
    uFlamesMaskPower: { value: 1, type: "f32" },
    uInvertStripeBucketing: { value: 0, type: "f32" },
    uCursorTrailEnabled: { value: 0, type: "f32" },
    uCursorTrailPushEnabled: { value: 0, type: "f32" },
    uCursorTrailPushRange: { value: 0, type: "f32" },
    uCursorTrailDebug: { value: STRIPE_DEBUG_CURSOR_TRAIL, type: "f32" },
    uRevealMode: { value: 0, type: "f32" },
    uRevealProgress: { value: 1, type: "f32" },
    uRevealOrigin: { value: [0.5, 0.5], type: "vec2<f32>" },
    uRevealMaxDistance: { value: 1, type: "f32" },
    uRevealSoftness: { value: 0, type: "f32" },
    uRevealWaviness: { value: 0, type: "f32" },
    uRevealNoiseScale: { value: 4, type: "f32" },
    uRevealBandRamp: { value: 0.18, type: "f32" },
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
      uStripeIndexLut: stripeIndexLut.texture.source,
      uFlames: Texture.EMPTY.source,
      uCursorTrail: Texture.EMPTY.source,
      uCursorTrailPush: Texture.EMPTY.source,
    },
  }) as StripeDuotoneFilter;

  let currentBlockMap = blockMap;
  let currentCellColorMap = blockMap;
  bindBlockMapTexture(filter, currentBlockMap);
  bindCellColorMapTexture(filter, currentCellColorMap);

  filter.syncColors = (nextColors, nextPreferP3 = preferP3) => {
    palette.update(resolveStripePalette(nextColors, nextPreferP3));
    stripeIndexLut.update(buildStripeIndexLut(nextColors.stripes));
    filter.resources.uStripeData = palette.texture.source;
    filter.resources.uStripeIndexLut = stripeIndexLut.texture.source;
    (stripeUniforms.uniforms as { uStripeCount: number }).uStripeCount = palette.count;
    stripeUniforms.update();
  };

  filter.syncUseCellColors = (enabled) => {
    const uniforms = stripeUniforms.uniforms as { uUseCellColors: number };
    uniforms.uUseCellColors = enabled ? 1 : 0;
    stripeUniforms.update();
  };

  filter.syncInvertStripeBucketing = (enabled) => {
    const uniforms = stripeUniforms.uniforms as { uInvertStripeBucketing: number };
    uniforms.uInvertStripeBucketing = enabled ? 1 : 0;
    stripeUniforms.update();
  };

  filter.syncTextureUnderlay = (enabled) => {
    const uniforms = stripeUniforms.uniforms as { uTextureUnderlay: number };
    uniforms.uTextureUnderlay = enabled ? 1 : 0;
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

  filter.syncScreenScale = (resolution) => {
    const uniforms = stripeUniforms.uniforms as { uScreenScale: number };
    uniforms.uScreenScale = Number.isFinite(resolution) && resolution > 0 ? resolution : 1;
    stripeUniforms.update();
  };

  filter.syncGrid = (nextGrid) => {
    const uniforms = stripeUniforms.uniforms as {
      uGap: number[];
      uCornerRadius: number;
      uWidthShuffleSwing: number;
      uOrientation: number;
    };
    uniforms.uGap[0] = nextGrid.gapX;
    uniforms.uGap[1] = nextGrid.gapY;
    uniforms.uCornerRadius = nextGrid.cornerRadius;
    uniforms.uWidthShuffleSwing = nextGrid.widthShuffleSwing;
    uniforms.uOrientation = nextGrid.orientation === "horizontal" ? 1 : 0;
    stripeUniforms.update();
  };

  filter.resizeGrid = (cols, rows, effWidth, effHeight) => {
    const uniforms = stripeUniforms.uniforms as { uGridSize: number[]; uCellSize: number[] };
    uniforms.uGridSize[0] = cols;
    uniforms.uGridSize[1] = rows;
    uniforms.uCellSize[0] = effWidth;
    uniforms.uCellSize[1] = effHeight;
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

  filter.syncFlames = (texture, config) => {
    const flamesTexture = texture ?? Texture.EMPTY;
    flamesTexture.source.style.scaleMode = "linear";
    filter.resources.uFlames = flamesTexture.source;
    const uniforms = stripeUniforms.uniforms as {
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
    stripeUniforms.update();
  };

  let currentCursorTrail = Texture.EMPTY;
  let currentCursorTrailPush = Texture.EMPTY;

  filter.syncCursorTrail = (trail, pushTexture, pushRange) => {
    currentCursorTrail = trail ?? Texture.EMPTY;
    currentCursorTrailPush = pushTexture ?? Texture.EMPTY;
    if (trail) {
      trail.source.style.scaleMode = "nearest";
    }
    if (pushTexture) {
      pushTexture.source.style.scaleMode = "nearest";
    }
    filter.resources.uCursorTrail = currentCursorTrail.source;
    filter.resources.uCursorTrailPush = currentCursorTrailPush.source;
    const uniforms = stripeUniforms.uniforms as {
      uCursorTrailEnabled: number;
      uCursorTrailPushEnabled: number;
      uCursorTrailPushRange: number;
    };
    uniforms.uCursorTrailEnabled = trail ? 1 : 0;
    uniforms.uCursorTrailPushEnabled = pushTexture ? 1 : 0;
    uniforms.uCursorTrailPushRange = pushRange;
    stripeUniforms.update();
  };

  filter.syncReveal = (config, progress) => {
    const uniforms = stripeUniforms.uniforms as {
      uRevealMode: number;
      uRevealProgress: number;
      uRevealOrigin: number[];
      uRevealMaxDistance: number;
      uRevealSoftness: number;
      uRevealWaviness: number;
      uRevealNoiseScale: number;
      uRevealBandRamp: number;
    };
    if (!config) {
      uniforms.uRevealMode = 0;
      uniforms.uRevealProgress = 1;
      stripeUniforms.update();
      return;
    }
    uniforms.uRevealProgress = progress;
    // Trailing band-climb window: ~5 of the old 66ms smoothing rebuilds, in progress units.
    uniforms.uRevealBandRamp = Math.min(
      0.4,
      Math.max(0.04, 330 / Math.max(1, resolvePlaygroundRevealDurationMs(config))),
    );
    uniforms.uRevealMode = 1;
    const geometry = resolveWaveRevealGeometry(config.wave.position);
    uniforms.uRevealOrigin[0] = geometry.x;
    uniforms.uRevealOrigin[1] = geometry.y;
    uniforms.uRevealMaxDistance = geometry.maxDistance;
    uniforms.uRevealSoftness = Math.max(0, config.wave.softness);
    uniforms.uRevealWaviness = config.wave.waviness;
    uniforms.uRevealNoiseScale = config.wave.noiseScale;
    stripeUniforms.update();
  };

  const pixelSizeUniform = stripeUniforms.uniforms.uPixelSize as number[];
  const frameSizeUniform = stripeUniforms.uniforms.uFrameSize as number[];

  const baseApply = filter.apply.bind(filter);
  filter.apply = (filterManager, input, output, clearMode) => {
    bindBlockMapTexture(filter, currentBlockMap);
    bindCellColorMapTexture(filter, currentCellColorMap);
    filter.resources.uStripeData = palette.texture.source;
    filter.resources.uStripeIndexLut = stripeIndexLut.texture.source;
    // Block grid + sparkle use logical display pixels (not 2× backing-store size).
    pixelSizeUniform[0] = canvasWidth;
    pixelSizeUniform[1] = canvasHeight;
    frameSizeUniform[0] = canvasWidth;
    frameSizeUniform[1] = canvasHeight;
    stripeUniforms.update();
    baseApply(filterManager, input, output, clearMode);
  };

  return filter;
}
