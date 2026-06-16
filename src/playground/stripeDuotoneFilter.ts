import { Filter, GlProgram, Texture, UniformGroup } from "pixi.js";
import type { PlaygroundFlamesConfig } from "./playgroundFlamesConfig";
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

/** Set > 0 to paint cursor-trail cell classification (R=displaced, G=brighten, B=shell). */
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
  });
  let uniformsDirty = true;

  const markUniformsDirty = () => {
    uniformsDirty = true;
  };

  const updateUniformsIfDirty = () => {
    if (!uniformsDirty) {
      return;
    }
    stripeUniforms.update();
    uniformsDirty = false;
  };

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

  bindBlockMapTexture(filter, blockMap);
  bindCellColorMapTexture(filter, blockMap);

  filter.syncColors = (nextColors, nextPreferP3 = preferP3) => {
    palette.update(resolveStripePalette(nextColors, nextPreferP3));
    stripeIndexLut.update(buildStripeIndexLut(nextColors.stripes));
    filter.resources.uStripeData = palette.texture.source;
    filter.resources.uStripeIndexLut = stripeIndexLut.texture.source;
    const uniforms = stripeUniforms.uniforms as { uStripeCount: number };
    if (uniforms.uStripeCount !== palette.count) {
      uniforms.uStripeCount = palette.count;
      markUniformsDirty();
    }
  };

  filter.syncUseCellColors = (enabled) => {
    const uniforms = stripeUniforms.uniforms as { uUseCellColors: number };
    const next = enabled ? 1 : 0;
    if (uniforms.uUseCellColors !== next) {
      uniforms.uUseCellColors = next;
      markUniformsDirty();
    }
  };

  filter.syncInvertStripeBucketing = (enabled) => {
    const uniforms = stripeUniforms.uniforms as { uInvertStripeBucketing: number };
    const next = enabled ? 1 : 0;
    if (uniforms.uInvertStripeBucketing !== next) {
      uniforms.uInvertStripeBucketing = next;
      markUniformsDirty();
    }
  };

  filter.syncTextureUnderlay = (enabled) => {
    const uniforms = stripeUniforms.uniforms as { uTextureUnderlay: number };
    const next = enabled ? 1 : 0;
    if (uniforms.uTextureUnderlay !== next) {
      uniforms.uTextureUnderlay = next;
      markUniformsDirty();
    }
  };

  filter.syncSparkle = (options, timeSec) => {
    const uniforms = stripeUniforms.uniforms as {
      uSparkleEnabled: number;
      uSparkleTime: number;
      uSparkleCoverage: number;
      uSparklePeriodMinSec: number;
      uSparklePeriodMaxSec: number;
    };
    let changed = false;
    const nextEnabled = options.enabled ? 1 : 0;
    if (uniforms.uSparkleEnabled !== nextEnabled) {
      uniforms.uSparkleEnabled = nextEnabled;
      changed = true;
    }
    if (uniforms.uSparkleEnabled > 0 && uniforms.uSparkleTime !== timeSec) {
      uniforms.uSparkleTime = timeSec;
      changed = true;
    }
    if (uniforms.uSparkleCoverage !== options.coverage) {
      uniforms.uSparkleCoverage = options.coverage;
      changed = true;
    }
    if (uniforms.uSparklePeriodMinSec !== options.periodMinSec) {
      uniforms.uSparklePeriodMinSec = options.periodMinSec;
      changed = true;
    }
    if (uniforms.uSparklePeriodMaxSec !== options.periodMaxSec) {
      uniforms.uSparklePeriodMaxSec = options.periodMaxSec;
      changed = true;
    }
    if (changed) {
      markUniformsDirty();
    }
  };

  filter.syncWidthShuffle = (options, timeSec) => {
    const uniforms = stripeUniforms.uniforms as {
      uWidthShuffleEnabled: number;
      uWidthShuffleTime: number;
      uWidthShuffleCoverage: number;
      uWidthShufflePeriodMinSec: number;
      uWidthShufflePeriodMaxSec: number;
    };
    let changed = false;
    const nextEnabled = options.enabled ? 1 : 0;
    if (uniforms.uWidthShuffleEnabled !== nextEnabled) {
      uniforms.uWidthShuffleEnabled = nextEnabled;
      changed = true;
    }
    if (uniforms.uWidthShuffleEnabled > 0 && uniforms.uWidthShuffleTime !== timeSec) {
      uniforms.uWidthShuffleTime = timeSec;
      changed = true;
    }
    if (uniforms.uWidthShuffleCoverage !== options.coverage) {
      uniforms.uWidthShuffleCoverage = options.coverage;
      changed = true;
    }
    if (uniforms.uWidthShufflePeriodMinSec !== options.periodMinSec) {
      uniforms.uWidthShufflePeriodMinSec = options.periodMinSec;
      changed = true;
    }
    if (uniforms.uWidthShufflePeriodMaxSec !== options.periodMaxSec) {
      uniforms.uWidthShufflePeriodMaxSec = options.periodMaxSec;
      changed = true;
    }
    if (changed) {
      markUniformsDirty();
    }
  };

  filter.syncScreenScale = (resolution) => {
    const uniforms = stripeUniforms.uniforms as { uScreenScale: number };
    const next = Number.isFinite(resolution) && resolution > 0 ? resolution : 1;
    if (uniforms.uScreenScale !== next) {
      uniforms.uScreenScale = next;
      markUniformsDirty();
    }
  };

  filter.syncGrid = (nextGrid) => {
    const uniforms = stripeUniforms.uniforms as {
      uGap: number[];
      uCornerRadius: number;
      uWidthShuffleSwing: number;
      uOrientation: number;
    };
    let changed = false;
    if (uniforms.uGap[0] !== nextGrid.gapX) {
      uniforms.uGap[0] = nextGrid.gapX;
      changed = true;
    }
    if (uniforms.uGap[1] !== nextGrid.gapY) {
      uniforms.uGap[1] = nextGrid.gapY;
      changed = true;
    }
    if (uniforms.uCornerRadius !== nextGrid.cornerRadius) {
      uniforms.uCornerRadius = nextGrid.cornerRadius;
      changed = true;
    }
    if (uniforms.uWidthShuffleSwing !== nextGrid.widthShuffleSwing) {
      uniforms.uWidthShuffleSwing = nextGrid.widthShuffleSwing;
      changed = true;
    }
    const nextOrientation = nextGrid.orientation === "horizontal" ? 1 : 0;
    if (uniforms.uOrientation !== nextOrientation) {
      uniforms.uOrientation = nextOrientation;
      changed = true;
    }
    if (changed) {
      markUniformsDirty();
    }
  };

  filter.resizeGrid = (cols, rows, effWidth, effHeight) => {
    const uniforms = stripeUniforms.uniforms as { uGridSize: number[]; uCellSize: number[] };
    let changed = false;
    if (uniforms.uGridSize[0] !== cols) {
      uniforms.uGridSize[0] = cols;
      changed = true;
    }
    if (uniforms.uGridSize[1] !== rows) {
      uniforms.uGridSize[1] = rows;
      changed = true;
    }
    if (uniforms.uCellSize[0] !== effWidth) {
      uniforms.uCellSize[0] = effWidth;
      changed = true;
    }
    if (uniforms.uCellSize[1] !== effHeight) {
      uniforms.uCellSize[1] = effHeight;
      changed = true;
    }
    if (changed) {
      markUniformsDirty();
    }
  };

  filter.updateBlockMap = (nextBlockMap) => {
    bindBlockMapTexture(filter, nextBlockMap);
  };

  filter.updateCellColorMap = (nextCellColorMap) => {
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
    let changed = false;
    const nextEnabled = enabled ? 1 : 0;
    if (uniforms.uFlamesEnabled !== nextEnabled) {
      uniforms.uFlamesEnabled = nextEnabled;
      changed = true;
    }
    const nextMaskEnabled = enabled && config?.edgeMaskEnabled !== false ? 1 : 0;
    if (uniforms.uFlamesMaskEnabled !== nextMaskEnabled) {
      uniforms.uFlamesMaskEnabled = nextMaskEnabled;
      changed = true;
    }
    const nextMaskStart = config?.edgeMaskStart ?? 0;
    if (uniforms.uFlamesMaskStart !== nextMaskStart) {
      uniforms.uFlamesMaskStart = nextMaskStart;
      changed = true;
    }
    const nextMaskEnd = config?.edgeMaskEnd ?? 0.1;
    if (uniforms.uFlamesMaskEnd !== nextMaskEnd) {
      uniforms.uFlamesMaskEnd = nextMaskEnd;
      changed = true;
    }
    const nextMaskPower = config?.edgeMaskPower ?? 1;
    if (uniforms.uFlamesMaskPower !== nextMaskPower) {
      uniforms.uFlamesMaskPower = nextMaskPower;
      changed = true;
    }
    if (changed) {
      markUniformsDirty();
    }
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
    let changed = false;
    const nextTrailEnabled = trail ? 1 : 0;
    if (uniforms.uCursorTrailEnabled !== nextTrailEnabled) {
      uniforms.uCursorTrailEnabled = nextTrailEnabled;
      changed = true;
    }
    const nextPushEnabled = pushTexture ? 1 : 0;
    if (uniforms.uCursorTrailPushEnabled !== nextPushEnabled) {
      uniforms.uCursorTrailPushEnabled = nextPushEnabled;
      changed = true;
    }
    if (uniforms.uCursorTrailPushRange !== pushRange) {
      uniforms.uCursorTrailPushRange = pushRange;
      changed = true;
    }
    if (changed) {
      markUniformsDirty();
    }
  };

  const pixelSizeUniform = stripeUniforms.uniforms.uPixelSize as number[];
  const frameSizeUniform = stripeUniforms.uniforms.uFrameSize as number[];

  const baseApply = filter.apply.bind(filter);
  filter.apply = (filterManager, input, output, clearMode) => {
    if (pixelSizeUniform[0] !== canvasWidth || pixelSizeUniform[1] !== canvasHeight) {
      pixelSizeUniform[0] = canvasWidth;
      pixelSizeUniform[1] = canvasHeight;
      markUniformsDirty();
    }
    if (frameSizeUniform[0] !== canvasWidth || frameSizeUniform[1] !== canvasHeight) {
      frameSizeUniform[0] = canvasWidth;
      frameSizeUniform[1] = canvasHeight;
      markUniformsDirty();
    }
    updateUniformsIfDirty();
    baseApply(filterManager, input, output, clearMode);
  };

  return filter;
}
