import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { setStatsCollector, subscribeStripesStats, type StripesStats } from "./stats";

beforeEach(() => {
  vi.useFakeTimers();
  setStatsCollector(null);
});

afterEach(() => {
  vi.useRealTimers();
  setStatsCollector(null);
});

describe("stats registry without a coordinator", () => {
  it("reports zero immediately when no coordinator has loaded", () => {
    const seen: StripesStats[] = [];
    const unsubscribe = subscribeStripesStats((stats) => seen.push(stats), { intervalMs: 200 });

    expect(seen).toHaveLength(1);
    expect(seen[0]).toMatchObject({ total: 0, rendering: 0, megapixelsPerFrame: 0 });

    vi.advanceTimersByTime(400);
    expect(seen.length).toBeGreaterThan(1);

    unsubscribe();
  });

  it("hands over to the real collector as soon as one installs", () => {
    const start = vi.fn();
    const stop = vi.fn();
    const seen: StripesStats[] = [];
    const unsubscribe = subscribeStripesStats((stats) => seen.push(stats), { intervalMs: 200 });

    const before = seen.length;
    setStatsCollector({ start, stop });
    expect(start).toHaveBeenCalledWith(200);

    // The idle reporter must not keep publishing zeros over the real samples.
    vi.advanceTimersByTime(1000);
    expect(seen.length).toBe(before);

    unsubscribe();
  });

  it("stops the idle reporter when the last subscriber detaches", () => {
    const seen: StripesStats[] = [];
    const unsubscribe = subscribeStripesStats((stats) => seen.push(stats), { intervalMs: 200 });
    unsubscribe();

    const after = seen.length;
    vi.advanceTimersByTime(1000);
    expect(seen.length).toBe(after);
  });
});
