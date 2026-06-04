import { describe, expect, it } from "vitest";
import { widthPxFromBand } from "./stripeGridConstants";
import {
  DEFAULT_PLAYGROUND_WIDTH_SHUFFLE_OPTIONS,
  WIDTH_SHUFFLE_COVERAGE,
  WIDTH_SHUFFLE_MIN_SWING_PX,
  isWidthShuffleActive,
  resolveWidthShuffleCellPeriod,
  resolveWidthShuffleCyclePeriod,
  resolveWidthShuffleHalfWidth,
  resolveWidthShuffleStripeWidth,
  playgroundWidthShuffleOptionsFromSliders,
  WIDTH_SHUFFLE_BASE_PERIOD_MIN_SEC,
  WIDTH_SHUFFLE_BASE_PERIOD_MAX_SEC,
  widthShuffleCellSeed,
  widthShufflePhaseHash,
  widthShufflePulseEnvelope,
  widthShuffleTargetWidth,
} from "./playgroundWidthShuffle";

const enabledOptions = {
  ...DEFAULT_PLAYGROUND_WIDTH_SHUFFLE_OPTIONS,
  enabled: true,
};

describe("playgroundWidthShuffle", () => {
  it("returns default half-width when shuffle is disabled", () => {
    const band = 3;
    const halfW = resolveWidthShuffleHalfWidth(4, 6, band, 12.5, {
      ...DEFAULT_PLAYGROUND_WIDTH_SHUFFLE_OPTIONS,
      enabled: false,
    });
    expect(halfW).toBe(widthPxFromBand(band) * 0.5);
  });

  it("returns default width for non-stripe cells", () => {
    expect(resolveWidthShuffleStripeWidth(0, 0, 0, 5, enabledOptions)).toBe(0);
  });

  it("keeps a stable seed per cell", () => {
    expect(widthShuffleCellSeed(2, 4)).toBe(widthShuffleCellSeed(2, 4));
    expect(widthShuffleCellSeed(2, 4)).not.toBe(widthShuffleCellSeed(2, 5));
  });

  it("picks a continuous target width with enough swing from default", () => {
    for (let pulse = 0; pulse < 20; pulse++) {
      for (let col = 0; col < 20; col++) {
        for (let row = 0; row < 20; row++) {
          for (let band = 1; band <= 5; band++) {
            const defaultWidth = widthPxFromBand(band);
            const target = widthShuffleTargetWidth(col, row, pulse, defaultWidth);
            expect(target).toBeGreaterThanOrEqual(1);
            expect(target).toBeLessThanOrEqual(5);
            expect(Math.abs(target - defaultWidth)).toBeGreaterThanOrEqual(WIDTH_SHUFFLE_MIN_SWING_PX - 0.001);
          }
        }
      }
    }
  });

  it("keeps roughly 30% of cells animating at once", () => {
    let active = 0;
    const total = 50 * 50;
    const timeSec = 12.345;
    const band = 2;
    const defaultWidth = widthPxFromBand(band);

    for (let col = 0; col < 50; col++) {
      for (let row = 0; row < 50; row++) {
        const width = resolveWidthShuffleStripeWidth(col, row, band, timeSec, enabledOptions);
        if (Math.abs(width - defaultWidth) > 0.05) {
          active++;
        }
      }
    }

    const ratio = active / total;
    expect(ratio).toBeGreaterThan(0.22);
    expect(ratio).toBeLessThan(0.38);
  });

  it("returns to default width after one pulse and stays idle until the next cycle", () => {
    const col = 5;
    const row = 7;
    const band = 3;
    const defaultWidth = widthPxFromBand(band);
    const period = resolveWidthShuffleCellPeriod(col, row, enabledOptions);
    const cyclePeriod = resolveWidthShuffleCyclePeriod(period, WIDTH_SHUFFLE_COVERAGE);
    const phaseOffset = widthShufflePhaseHash(col, row) * cyclePeriod;
    const cycleStart = -phaseOffset;

    expect(resolveWidthShuffleStripeWidth(col, row, band, cycleStart, enabledOptions)).toBeCloseTo(defaultWidth, 1);
    expect(
      Math.abs(
        resolveWidthShuffleStripeWidth(col, row, band, cycleStart + period * 0.5, enabledOptions) - defaultWidth,
      ),
    ).toBeGreaterThan(0.5);
    expect(resolveWidthShuffleStripeWidth(col, row, band, cycleStart + period, enabledOptions)).toBeCloseTo(
      defaultWidth,
      1,
    );
    expect(resolveWidthShuffleStripeWidth(col, row, band, cycleStart + period + 0.01, enabledOptions)).toBe(
      defaultWidth,
    );
    expect(resolveWidthShuffleStripeWidth(col, row, band, cycleStart + cyclePeriod - 0.01, enabledOptions)).toBe(
      defaultWidth,
    );
  });

  it("uses independent per-cell periods and phases", () => {
    const periods = new Set<number>();
    for (let col = 0; col < 30; col++) {
      for (let row = 0; row < 30; row++) {
        periods.add(Math.round(resolveWidthShuffleCellPeriod(col, row, enabledOptions) * 100));
      }
    }
    expect(periods.size).toBeGreaterThan(20);
  });

  it("smoothly pulses width with fractional intermediate values during one active window", () => {
    const col = 5;
    const row = 7;
    const band = 2;
    const defaultWidth = widthPxFromBand(band);
    const period = resolveWidthShuffleCellPeriod(col, row, enabledOptions);
    const cyclePeriod = resolveWidthShuffleCyclePeriod(period, WIDTH_SHUFFLE_COVERAGE);
    const phaseOffset = widthShufflePhaseHash(col, row) * cyclePeriod;
    const cycleStart = -phaseOffset;

    const samples: number[] = [];
    for (let step = 1; step < 20; step++) {
      samples.push(resolveWidthShuffleStripeWidth(col, row, band, cycleStart + (period * step) / 20, enabledOptions));
    }

    const fractional = samples.filter((width) => Math.abs(width - Math.round(width)) > 0.01);
    expect(fractional.length).toBeGreaterThan(10);
    expect(Math.max(...samples)).toBeGreaterThan(defaultWidth + 0.5);
    expect(widthShufflePulseEnvelope(0)).toBeCloseTo(0, 5);
    expect(widthShufflePulseEnvelope(0.5)).toBeCloseTo(1, 5);
    expect(widthShufflePulseEnvelope(1)).toBeCloseTo(0, 5);
    expect(widthShufflePulseEnvelope(1.5)).toBe(0);
  });

  it("desynchronizes neighboring cells at the same time", () => {
    const cells = [
      { col: 5, row: 7 },
      { col: 6, row: 7 },
    ];
    const band = 3;
    const widths = new Set<number>();

    for (let step = 0; step < 40; step++) {
      const timeSec = step * 0.13;
      for (const { col, row } of cells) {
        widths.add(Math.round(resolveWidthShuffleStripeWidth(col, row, band, timeSec, enabledOptions) * 100));
      }
      if (widths.size >= 2) {
        break;
      }
    }

    expect(widths.size).toBeGreaterThanOrEqual(2);
  });

  it("reports active cells only during their pulse window", () => {
    const col = 5;
    const row = 7;
    const period = resolveWidthShuffleCellPeriod(col, row, enabledOptions);
    const cyclePeriod = resolveWidthShuffleCyclePeriod(period, WIDTH_SHUFFLE_COVERAGE);
    const phaseOffset = widthShufflePhaseHash(col, row) * cyclePeriod;
    const cycleStart = -phaseOffset;

    expect(isWidthShuffleActive(col, row, cycleStart + period * 0.25, enabledOptions)).toBe(true);
    expect(isWidthShuffleActive(col, row, cycleStart + period + 0.01, enabledOptions)).toBe(false);
  });

  it("keeps default width when enabled but outside the pulse window", () => {
    const col = 3;
    const row = 4;
    const band = 3;
    const defaultWidth = widthPxFromBand(band);
    const period = resolveWidthShuffleCellPeriod(col, row, enabledOptions);
    const cyclePeriod = resolveWidthShuffleCyclePeriod(period, WIDTH_SHUFFLE_COVERAGE);
    const phaseOffset = widthShufflePhaseHash(col, row) * cyclePeriod;
    const idleTime = -phaseOffset + period + 0.05;

    expect(resolveWidthShuffleStripeWidth(col, row, band, idleTime, enabledOptions)).toBe(defaultWidth);
  });

  it("maps sparkle width sliders to shuffle options", () => {
    expect(playgroundWidthShuffleOptionsFromSliders(0, 1).enabled).toBe(false);
    expect(playgroundWidthShuffleOptionsFromSliders(0.3, 1)).toEqual({
      enabled: true,
      coverage: 0.3,
      periodMinSec: WIDTH_SHUFFLE_BASE_PERIOD_MIN_SEC,
      periodMaxSec: WIDTH_SHUFFLE_BASE_PERIOD_MAX_SEC,
    });
    expect(playgroundWidthShuffleOptionsFromSliders(1, 1).coverage).toBe(1);
    expect(playgroundWidthShuffleOptionsFromSliders(0.3, 1.5).periodMinSec).toBeLessThan(
      WIDTH_SHUFFLE_BASE_PERIOD_MIN_SEC,
    );
    expect(playgroundWidthShuffleOptionsFromSliders(0.3, 1.5).periodMinSec).toBeLessThan(
      playgroundWidthShuffleOptionsFromSliders(0.3, 1).periodMinSec,
    );
  });
});
