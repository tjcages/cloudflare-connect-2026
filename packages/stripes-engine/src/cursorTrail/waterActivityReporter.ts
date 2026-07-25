/** Below this delta the value is not worth a host callback. */
const REPORT_THRESHOLD = 0.01;

export type WaterActivityReporter = {
  /** Report only on visible change; hosts typically drive a CSS variable. */
  report(activity: number): void;
  /**
   * Terminal zero for a paused or disabled sim, so a frozen value cannot be
   * left standing on the host. Deduped like `report`, and deliberately leaves
   * the next `report` free to re-emit the sim's real value on resume.
   */
  settle(): void;
};

export function createWaterActivityReporter(onActivity?: (activity: number) => void): WaterActivityReporter {
  let lastReported = 0;
  return {
    report(activity) {
      if (Math.abs(activity - lastReported) <= REPORT_THRESHOLD) return;
      lastReported = activity;
      onActivity?.(activity);
    },
    settle() {
      if (lastReported === 0) return;
      lastReported = 0;
      onActivity?.(0);
    },
  };
}
