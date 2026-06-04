import { Filter, GlProgram, Texture, UniformGroup } from "pixi.js";
import { STRIPE_FILTER_FRAGMENT, STRIPE_FILTER_VERTEX } from "./stripeFilterShaders";
import { DEFAULT_STRIPE_DUOTONE_OPTIONS, type StripeDuotoneOptions } from "./stripeFilterOptions";
import { buildStripeColors, stripeColorsToUniformRgb, type StripeColors } from "./stripeColors";
import {
  DEFAULT_PLAYGROUND_SPARKLE_OPTIONS,
  type PlaygroundSparkleOptions,
} from "./playgroundSparkle";
import {
  DEFAULT_PLAYGROUND_WIDTH_SHUFFLE_OPTIONS,
  type PlaygroundWidthShuffleOptions,
} from "./playgroundWidthShuffle";

/** Set > 0 to composite source video for grid-alignment debugging. */
export const STRIPE_DEBUG_VIDEO_OVERLAY_ALPHA = 0;

export type StripeDuotoneFilter = Filter & {
  syncOptions: (options: StripeDuotoneOptions) => void;
  syncColors: (colors: StripeColors, preferP3?: boolean) => void;
  syncSparkle: (options: PlaygroundSparkleOptions, timeSec: number) => void;
  syncWidthShuffle: (options: PlaygroundWidthShuffleOptions, timeSec: number) => void;
  updateBlockMap: (blockMap: Texture) => void;
};

function bindBlockMapTexture(filter: Filter, blockMap: Texture) {
  blockMap.source.style.scaleMode = "nearest";
  filter.resources.uBlockMap = blockMap.source;
}

function copyRgbUniform(target: number[] | Float32Array, source: readonly [number, number, number]) {
  target[0] = source[0];
  target[1] = source[1];
  target[2] = source[2];
}

function applyStripeColors(stripeUniforms: UniformGroup, colors: StripeColors, preferP3 = false) {
  const rgb = stripeColorsToUniformRgb(colors, preferP3);
  const uniforms = stripeUniforms.uniforms as {
    uColorBand0: number[];
    uColorBand1: number[];
    uColorBand2: number[];
    uColorBand3: number[];
    uColorBand4: number[];
    uBandEnabled0: number;
    uBandEnabled1: number;
    uBandEnabled2: number;
    uBandEnabled3: number;
    uBandEnabled4: number;
  };
  copyRgbUniform(uniforms.uColorBand0, rgb[0]);
  copyRgbUniform(uniforms.uColorBand1, rgb[1]);
  copyRgbUniform(uniforms.uColorBand2, rgb[2]);
  copyRgbUniform(uniforms.uColorBand3, rgb[3]);
  copyRgbUniform(uniforms.uColorBand4, rgb[4]);
  uniforms.uBandEnabled0 = colors.enabled[0] ? 1 : 0;
  uniforms.uBandEnabled1 = colors.enabled[1] ? 1 : 0;
  uniforms.uBandEnabled2 = colors.enabled[2] ? 1 : 0;
  uniforms.uBandEnabled3 = colors.enabled[3] ? 1 : 0;
  uniforms.uBandEnabled4 = colors.enabled[4] ? 1 : 0;
}

export function createStripeDuotoneFilter(
  canvasWidth: number,
  canvasHeight: number,
  blockMap: Texture,
  gridCols: number,
  gridRows: number,
  colors: StripeColors = buildStripeColors(),
  _options: StripeDuotoneOptions = DEFAULT_STRIPE_DUOTONE_OPTIONS,
  preferP3 = false,
): StripeDuotoneFilter {
  const initialRgb = stripeColorsToUniformRgb(colors, preferP3);
  const stripeUniforms = new UniformGroup({
    uPixelSize: {
      value: [canvasWidth, canvasHeight],
      type: "vec2<f32>",
    },
    uFrameSize: {
      value: [canvasWidth, canvasHeight],
      type: "vec2<f32>",
    },
    uGridSize: {
      value: [gridCols, gridRows],
      type: "vec2<f32>",
    },
    uColorBand0: {
      value: initialRgb[0],
      type: "vec3<f32>",
    },
    uColorBand1: {
      value: initialRgb[1],
      type: "vec3<f32>",
    },
    uColorBand2: {
      value: initialRgb[2],
      type: "vec3<f32>",
    },
    uColorBand3: {
      value: initialRgb[3],
      type: "vec3<f32>",
    },
    uColorBand4: {
      value: initialRgb[4],
      type: "vec3<f32>",
    },
    uBandEnabled0: { value: 1, type: "f32" },
    uBandEnabled1: { value: 1, type: "f32" },
    uBandEnabled2: { value: 1, type: "f32" },
    uBandEnabled3: { value: 1, type: "f32" },
    uBandEnabled4: { value: 1, type: "f32" },
    uDebugVideoAlpha: {
      value: STRIPE_DEBUG_VIDEO_OVERLAY_ALPHA,
      type: "f32",
    },
    uSparkleEnabled: { value: 0, type: "f32" },
    uSparkleTime: { value: 0, type: "f32" },
    uSparkleCoverage: {
      value: DEFAULT_PLAYGROUND_SPARKLE_OPTIONS.coverage,
      type: "f32",
    },
    uSparkleRateHz: {
      value: DEFAULT_PLAYGROUND_SPARKLE_OPTIONS.rateHz,
      type: "f32",
    },
    uWidthShuffleEnabled: { value: 0, type: "f32" },
    uWidthShuffleTime: { value: 0, type: "f32" },
    uWidthShuffleCoverage: {
      value: DEFAULT_PLAYGROUND_WIDTH_SHUFFLE_OPTIONS.coverage,
      type: "f32",
    },
    uWidthShufflePeriodMinSec: {
      value: DEFAULT_PLAYGROUND_WIDTH_SHUFFLE_OPTIONS.periodMinSec,
      type: "f32",
    },
    uWidthShufflePeriodMaxSec: {
      value: DEFAULT_PLAYGROUND_WIDTH_SHUFFLE_OPTIONS.periodMaxSec,
      type: "f32",
    },
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
    },
  }) as StripeDuotoneFilter;

  let currentBlockMap = blockMap;
  bindBlockMapTexture(filter, currentBlockMap);
  applyStripeColors(stripeUniforms, colors, preferP3);

  filter.syncOptions = () => {
    // Block map carries bands; bg options affect CPU grid rebuild only.
  };

  filter.syncColors = (nextColors, nextPreferP3 = preferP3) => {
    applyStripeColors(stripeUniforms, nextColors, nextPreferP3);
  };

  filter.syncSparkle = (options, timeSec) => {
    const uniforms = stripeUniforms.uniforms as {
      uSparkleEnabled: number;
      uSparkleTime: number;
      uSparkleCoverage: number;
      uSparkleRateHz: number;
    };
    uniforms.uSparkleEnabled = options.enabled ? 1 : 0;
    uniforms.uSparkleTime = timeSec;
    uniforms.uSparkleCoverage = options.coverage;
    uniforms.uSparkleRateHz = options.rateHz;
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

  filter.updateBlockMap = (nextBlockMap) => {
    currentBlockMap = nextBlockMap;
    bindBlockMapTexture(filter, nextBlockMap);
  };

  const pixelSizeUniform = stripeUniforms.uniforms.uPixelSize as number[];
  const frameSizeUniform = stripeUniforms.uniforms.uFrameSize as number[];

  const baseApply = filter.apply.bind(filter);
  filter.apply = (filterManager, input, output, clearMode) => {
    bindBlockMapTexture(filter, currentBlockMap);
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
