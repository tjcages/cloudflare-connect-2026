import { generateGridAsync } from "../grid/generateGridAsync";
import type { GeneratedGrid, GridConfig } from "../grid/types";

const DEBOUNCE_MS = 100;

let latestScheduleId = 0;
let debounceTimer: ReturnType<typeof setTimeout> | null = null;

export type GridScheduleOptions = {
  /** When true, skip debounce (seed regen, preset apply, explicit sync). */
  immediate?: boolean;
};

export type GridScheduleHandlers = {
  onPending?: () => void;
  onComplete: (grid: GeneratedGrid) => void;
  onError?: () => void;
};

const applyGridResult = (scheduleId: number, handlers: GridScheduleHandlers, grid: GeneratedGrid) => {
  if (scheduleId !== latestScheduleId) {
    return;
  }

  handlers.onComplete(grid);
};

const failGridResult = (scheduleId: number, handlers: GridScheduleHandlers) => {
  if (scheduleId !== latestScheduleId) {
    return;
  }

  handlers.onError?.();
};

const runGeneration = (scheduleId: number, gridConfig: GridConfig, handlers: GridScheduleHandlers) => {
  void generateGridAsync(gridConfig)
    .then((grid) => applyGridResult(scheduleId, handlers, grid))
    .catch(() => failGridResult(scheduleId, handlers));
};

/** Schedules async grid regeneration; stale results are dropped by monotonic schedule id. */
export const scheduleGridFromConfig = (
  gridConfig: GridConfig,
  handlers: GridScheduleHandlers,
  options: GridScheduleOptions = {},
) => {
  const scheduleId = latestScheduleId + 1;
  latestScheduleId = scheduleId;

  handlers.onPending?.();

  const start = () => runGeneration(scheduleId, gridConfig, handlers);

  if (options.immediate) {
    if (debounceTimer !== null) {
      clearTimeout(debounceTimer);
      debounceTimer = null;
    }

    start();
    return;
  }

  if (debounceTimer !== null) {
    clearTimeout(debounceTimer);
  }

  debounceTimer = setTimeout(() => {
    debounceTimer = null;
    start();
  }, DEBOUNCE_MS);
};

/** Test helper: reset scheduler state between cases. */
export const resetGridGenerationSchedulerForTests = () => {
  latestScheduleId = 0;

  if (debounceTimer !== null) {
    clearTimeout(debounceTimer);
    debounceTimer = null;
  }
};
