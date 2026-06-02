import { describe, expect, it } from "vitest";
import {
  DEFAULT_PLAYGROUND_SPARKLE_OPTIONS,
  DEFAULT_PLAYGROUND_SPARKLE_RATE_HZ,
  isPlaygroundSparkleCellVisible,
  playgroundSparkleOptionsFromRate,
  sparkleCellHash,
} from "./playgroundSparkle";

describe("playgroundSparkle", () => {
  it("returns always visible when sparkle is disabled", () => {
    const options = { ...DEFAULT_PLAYGROUND_SPARKLE_OPTIONS, enabled: false };
    expect(isPlaygroundSparkleCellVisible(0, 0, 0, options)).toBe(true);
    expect(isPlaygroundSparkleCellVisible(3, 7, 12.5, options)).toBe(true);
  });

  it("keeps a stable hash per cell", () => {
    expect(sparkleCellHash(2, 4)).toBe(sparkleCellHash(2, 4));
    expect(sparkleCellHash(2, 4)).not.toBe(sparkleCellHash(2, 5));
  });

  it("maps slider rate 0 to disabled and 1 to max Hz", () => {
    expect(playgroundSparkleOptionsFromRate(0).enabled).toBe(false);
    expect(playgroundSparkleOptionsFromRate(0).rateHz).toBe(0);
    expect(playgroundSparkleOptionsFromRate(1).enabled).toBe(true);
    expect(playgroundSparkleOptionsFromRate(1).rateHz).toBe(DEFAULT_PLAYGROUND_SPARKLE_RATE_HZ);
    expect(playgroundSparkleOptionsFromRate(0.5).rateHz).toBeCloseTo(DEFAULT_PLAYGROUND_SPARKLE_RATE_HZ * 0.5);
  });

  it("blinks participating cells over time", () => {
    const options = playgroundSparkleOptionsFromRate(1);
    let participantCol = -1;
    let participantRow = -1;

    outer: for (let col = 0; col < 50; col++) {
      for (let row = 0; row < 50; row++) {
        if (sparkleCellHash(col, row) < options.coverage) {
          participantCol = col;
          participantRow = row;
          break outer;
        }
      }
    }

    expect(participantCol).toBeGreaterThanOrEqual(0);

    const visibilities = new Set<boolean>();
    for (let step = 0; step < 200; step++) {
      visibilities.add(
        isPlaygroundSparkleCellVisible(participantCol, participantRow, step * 0.01, options),
      );
      if (visibilities.size === 2) {
        break;
      }
    }

    expect(visibilities.size).toBe(2);
  });

  it("leaves non-participating cells always visible", () => {
    const options = playgroundSparkleOptionsFromRate(1);
    for (let col = 0; col < 30; col++) {
      for (let row = 0; row < 30; row++) {
        if (sparkleCellHash(col, row) < options.coverage) {
          continue;
        }
        expect(isPlaygroundSparkleCellVisible(col, row, 0, options)).toBe(true);
        expect(isPlaygroundSparkleCellVisible(col, row, 99, options)).toBe(true);
      }
    }
  });
});
