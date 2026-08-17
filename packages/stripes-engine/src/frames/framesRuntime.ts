import type { EngineConfig } from "../config/types";
import { smooth } from "../core/math";
import { effectiveStripes } from "../field/imageColorDensity";
import { createAsyncCellGridReader } from "./cellGridReadback";
import { resolveFrameBoxes } from "./frameBoxes";
import { buildFrameGroups, type FrameGroup } from "./frameGroups";
import type { FramesOverlay } from "./framesPaint";

/**
 * How often the clusters are re-derived. The boxes themselves move every frame
 * — they follow sparkle motion on the host — so this only bounds how fast a
 * cluster can appear, merge or split, which is a much slower thing to watch.
 */
const REGROUP_INTERVAL_MS = 33;

/** Frames arrive on finished artwork rather than during the reveal. */
const FADE_MS = 450;

export type FramesRuntimeInput = {
  config: EngineConfig;
  cols: number;
  rows: number;
  /** Resolved only when a readback actually fires, so a disabled overlay never
   *  makes the render-target pool allocate a cell target it has no other use for. */
  valuesFbo: () => WebGLFramebuffer;
  /** True once the instance has a source and its reveal has stopped animating. */
  settled: boolean;
  nowMs: number;
  timeSec: number;
  cssWidth: number;
  cssHeight: number;
  dpr: number;
};

export type FramesRuntime = {
  /** Called from the render loop with the cell grid still bound to the pool. */
  update(input: FramesRuntimeInput): FramesOverlay | null;
  dispose(): void;
};

export function createFramesRuntime(gl: WebGL2RenderingContext): FramesRuntime {
  const reader = createAsyncCellGridReader(gl);
  let groups: FrameGroup[] | null = null;
  let lastRequestMs = -Infinity;
  let fadeStartMs = -1;

  function reset(): void {
    groups = null;
    lastRequestMs = -Infinity;
    fadeStartMs = -1;
    // Leaving a fence in flight would strand it and hand the next enable a
    // readback of the grid as it was before the pause.
    reader.cancel();
  }

  return {
    update(input) {
      const { frames } = input.config;
      if (!frames.enabled) {
        if (groups || fadeStartMs >= 0) reset();
        return null;
      }
      // Clusters derived mid-reveal describe an image that is still assembling,
      // so nothing is read until the artwork stops moving under them.
      if (!input.settled) {
        if (fadeStartMs >= 0) reset();
        return null;
      }
      if (fadeStartMs < 0) fadeStartMs = input.nowMs;

      if (input.nowMs - lastRequestMs >= REGROUP_INTERVAL_MS && !reader.inFlight) {
        lastRequestMs = input.nowMs;
        reader.request(input.cols, input.rows, input.valuesFbo());
      }

      const readback = reader.poll();
      if (readback) {
        groups = buildFrameGroups(
          readback,
          frames.luminanceThreshold,
          frames.groupDistanceCells,
          // The shader draws the density-adjusted bands, so band-matching has to
          // use the same list or the frames ring the wrong ones.
          effectiveStripes(input.config),
          frames.highlightedStripeCount,
        );
      }
      if (!groups || groups.length === 0) return null;

      return {
        boxes: resolveFrameBoxes(
          groups,
          input.config.grid,
          input.config.sparkle.motion,
          input.cssWidth,
          input.cssHeight,
          input.timeSec,
        ),
        cssWidth: input.cssWidth,
        cssHeight: input.cssHeight,
        scale: input.dpr,
        color: frames.color,
        coordinateColor: frames.coordinateColor,
        fontSizePx: frames.fontSizePx,
        alpha: smooth(0, 1, (input.nowMs - fadeStartMs) / FADE_MS),
      };
    },
    dispose() {
      reset();
      reader.dispose();
    },
  };
}
