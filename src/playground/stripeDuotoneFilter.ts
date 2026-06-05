import { Filter, GlProgram, Texture, UniformGroup } from "pixi.js";
import { STRIPE_FILTER_FRAGMENT, STRIPE_FILTER_VERTEX } from "./stripeFilterShaders";
import { buildStripeColors, resolveStripePalette, type StripeColors } from "./stripeColors";
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

export type StripeDuotoneFilter = Filter & {
  syncColors: (colors: StripeColors, preferP3?: boolean) => void;
  syncSparkle: (options: PlaygroundSparkleOptions, timeSec: number) => void;
  syncWidthShuffle: (options: PlaygroundWidthShuffleOptions, timeSec: number) => void;
  /** Push live-updatable grid params (gap, chain gap, min height, softness, swing, orientation). */
  syncGrid: (grid: PlaygroundGridConfig) => void;
  updateBlockMap: (blockMap: Texture) => void;
};

function bindBlockMapTexture(filter: Filter, blockMap: Texture) {
  blockMap.source.style.scaleMode = "nearest";
  filter.resources.uBlockMap = blockMap.source;
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
  palette.update(resolveStripePalette(colors, preferP3));

  const effectiveCell = effectivePlaygroundCellSize(grid);

  const stripeUniforms = new UniformGroup({
    uPixelSize: { value: [canvasWidth, canvasHeight], type: "vec2<f32>" },
    uFrameSize: { value: [canvasWidth, canvasHeight], type: "vec2<f32>" },
    uGridSize: { value: [gridCols, gridRows], type: "vec2<f32>" },
    uCellSize: { value: [effectiveCell.width, effectiveCell.height], type: "vec2<f32>" },
    uGap: { value: [grid.gapX, grid.gapY], type: "vec2<f32>" },
    uChainBreakGap: { value: grid.chainBreakGap, type: "f32" },
    uMinStripeHeight: { value: grid.minStripeHeight, type: "f32" },
    uCornerRadius: { value: grid.cornerRadius, type: "f32" },
    uStripeMaxWidth: { value: STRIPE_WIDTH_ENCODE_MAX, type: "f32" },
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
      uStripeData: palette.texture.source,
    },
  }) as StripeDuotoneFilter;

  let currentBlockMap = blockMap;
  bindBlockMapTexture(filter, currentBlockMap);

  filter.syncColors = (nextColors, nextPreferP3 = preferP3) => {
    palette.update(resolveStripePalette(nextColors, nextPreferP3));
    filter.resources.uStripeData = palette.texture.source;
    (stripeUniforms.uniforms as { uStripeCount: number }).uStripeCount = palette.count;
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

  filter.syncGrid = (nextGrid) => {
    const uniforms = stripeUniforms.uniforms as {
      uGap: number[];
      uChainBreakGap: number;
      uMinStripeHeight: number;
      uCornerRadius: number;
      uWidthShuffleSwing: number;
      uOrientation: number;
    };
    uniforms.uGap[0] = nextGrid.gapX;
    uniforms.uGap[1] = nextGrid.gapY;
    uniforms.uChainBreakGap = nextGrid.chainBreakGap;
    uniforms.uMinStripeHeight = nextGrid.minStripeHeight;
    uniforms.uCornerRadius = nextGrid.cornerRadius;
    uniforms.uWidthShuffleSwing = nextGrid.widthShuffleSwing;
    uniforms.uOrientation = nextGrid.orientation === "horizontal" ? 1 : 0;
    stripeUniforms.update();
  };

  filter.updateBlockMap = (nextBlockMap) => {
    currentBlockMap = nextBlockMap;
    bindBlockMapTexture(filter, nextBlockMap);
  };

  const pixelSizeUniform = stripeUniforms.uniforms.uPixelSize as number[];
  const frameSizeUniform = stripeUniforms.uniforms.uFrameSize as number[];

  const baseApply = filter.apply.bind(filter);
  filter.apply = (filterManager, input, output, clearMode) => {
    bindBlockMapTexture(filter, currentBlockMap);
    filter.resources.uStripeData = palette.texture.source;
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
