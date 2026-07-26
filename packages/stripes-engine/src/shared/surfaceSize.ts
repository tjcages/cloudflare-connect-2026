/**
 * Dimensions snap to this quantum so a few pixels of jitter never resizes the
 * shared backbuffer.
 */
const SIZE_QUANTUM = 64;

/**
 * How many consecutive ticks a smaller requirement has to hold before the
 * backbuffer follows it down. Resizing the drawing buffer on alternating ticks
 * costs as much as leaving it oversized, so shrinking waits for the page to
 * settle (~0.75 s at 60 Hz) instead of tracking every scroll frame.
 */
export const SHRINK_HOLD_TICKS = 45;

/** Share of the buffer that has to go unused before shrinking is worth a resize. */
const SHRINK_SLACK = 0.25;

export type SurfaceSize = { width: number; height: number };

export type SurfaceSizeState = {
  peakWidth: number;
  peakHeight: number;
  holdTicks: number;
};

export function createSurfaceSizeState(): SurfaceSizeState {
  return { peakWidth: 0, peakHeight: 0, holdTicks: 0 };
}

function quantize(value: number): number {
  return Math.max(SIZE_QUANTUM, Math.ceil(value / SIZE_QUANTUM) * SIZE_QUANTUM);
}

function reset(state: SurfaceSizeState): void {
  state.peakWidth = 0;
  state.peakHeight = 0;
  state.holdTicks = 0;
}

/**
 * Pick the size the shared backbuffer should have for this tick.
 *
 * The buffer is cleared and reacquired every tick, so every pixel it carries
 * beyond the packed batch is bandwidth spent on nothing — an oversized buffer
 * measured ~30% slower through the present path than an exact one at the same
 * drawn-pixel count. It grows immediately, but only follows a requirement down
 * once that requirement has held for {@link SHRINK_HOLD_TICKS}: resizing on
 * alternating ticks is as expensive as the waste it would avoid.
 *
 * Slot positions and viewports are independent of the buffer's size, so the
 * rendered pixels are unaffected — only where each slot lands in the
 * bottom-left-origin buffer, which the caller derives from the height it gets
 * back here.
 */
export function nextSurfaceSize(state: SurfaceSizeState, current: SurfaceSize, required: SurfaceSize): SurfaceSize {
  const width = quantize(required.width);
  const height = quantize(required.height);

  if (width > current.width || height > current.height) {
    reset(state);
    return { width: Math.max(width, current.width), height: Math.max(height, current.height) };
  }

  state.peakWidth = Math.max(state.peakWidth, width);
  state.peakHeight = Math.max(state.peakHeight, height);

  if (state.peakWidth * state.peakHeight > current.width * current.height * (1 - SHRINK_SLACK)) {
    reset(state);
    return current;
  }

  state.holdTicks++;
  if (state.holdTicks < SHRINK_HOLD_TICKS) return current;

  const next = { width: state.peakWidth, height: state.peakHeight };
  reset(state);
  return next;
}
