import { describe, expect, it, vi } from "vitest";
import { createWaterActivityReporter } from "./waterActivityReporter";

describe("water activity reporter", () => {
  it("reports a visible change and swallows sub-threshold noise", () => {
    const onActivity = vi.fn();
    const reporter = createWaterActivityReporter(onActivity);

    reporter.report(0.4);
    expect(onActivity).toHaveBeenCalledWith(0.4);

    reporter.report(0.405);
    expect(onActivity).toHaveBeenCalledTimes(1);

    reporter.report(0.5);
    expect(onActivity).toHaveBeenCalledTimes(2);
    expect(onActivity).toHaveBeenLastCalledWith(0.5);
  });

  it("settle() reports a terminal zero, once", () => {
    const onActivity = vi.fn();
    const reporter = createWaterActivityReporter(onActivity);
    reporter.report(0.8);
    onActivity.mockClear();

    reporter.settle();
    expect(onActivity).toHaveBeenCalledWith(0);

    reporter.settle();
    expect(onActivity).toHaveBeenCalledTimes(1);
  });

  it("settle() on an at-rest reporter says nothing", () => {
    const onActivity = vi.fn();
    createWaterActivityReporter(onActivity).settle();
    expect(onActivity).not.toHaveBeenCalled();
  });

  // The desync this guards: settling only on the host side would leave the
  // engine believing it had already reported 0.8, so the dedupe would swallow
  // the first resumed frame and pin the host at 0 while the canvas moved.
  it("re-reports the real value after a settle, so a resumed instance re-syncs", () => {
    const onActivity = vi.fn();
    const reporter = createWaterActivityReporter(onActivity);
    reporter.report(0.8);
    reporter.settle();
    onActivity.mockClear();

    reporter.report(0.8);
    expect(onActivity).toHaveBeenCalledWith(0.8);
  });

  it("works without a handler", () => {
    const reporter = createWaterActivityReporter();
    expect(() => {
      reporter.report(0.5);
      reporter.settle();
    }).not.toThrow();
  });
});
