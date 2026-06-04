import { describe, expect, it } from "vitest";
import {
  DEFAULT_PLAYGROUND_SPARKLE_GAPS_ACTIVE_PERCENT,
  DEFAULT_PLAYGROUND_SPARKLE_GAPS_SPEED_SLIDER,
  DEFAULT_PLAYGROUND_SPARKLE_OPTIONS,
  isPlaygroundSparkleCellVisible,
  playgroundSparkleOptionsFromSliders,
  resolveSparkleLocalPulseTime,
  sparkleCellHash,
  sparkleGapsSpeedLabelFromSlider,
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

  it("maps sparkle gaps sliders to options", () => {
    expect(playgroundSparkleOptionsFromSliders(0, 0.5).enabled).toBe(false);
    expect(playgroundSparkleOptionsFromSliders(20, 0.5).enabled).toBe(true);
    expect(playgroundSparkleOptionsFromSliders(20, 0.5).coverage).toBeCloseTo(0.2);
    expect(playgroundSparkleOptionsFromSliders(20, 1).periodMinSec).toBeLessThan(
      playgroundSparkleOptionsFromSliders(20, 0).periodMinSec,
    );
    expect(sparkleGapsSpeedLabelFromSlider(0.5)).toBe("1.0×");
  });

  it("hides cells during their scheduled gap pulse", () => {
    const options = playgroundSparkleOptionsFromSliders(
      DEFAULT_PLAYGROUND_SPARKLE_GAPS_ACTIVE_PERCENT,
      DEFAULT_PLAYGROUND_SPARKLE_GAPS_SPEED_SLIDER,
    );

    let pulseCol = -1;
    let pulseRow = -1;
    outer: for (let col = 0; col < 50; col++) {
      for (let row = 0; row < 50; row++) {
        if (resolveSparkleLocalPulseTime(col, row, 0.12, options) !== null) {
          pulseCol = col;
          pulseRow = row;
          break outer;
        }
      }
    }

    expect(pulseCol).toBeGreaterThanOrEqual(0);
    expect(isPlaygroundSparkleCellVisible(pulseCol, pulseRow, 0.12, options)).toBe(false);
    expect(isPlaygroundSparkleCellVisible(pulseCol, pulseRow, 5, options)).toBe(true);
  });

  it("rotates gap pulses over time for the same cell", () => {
    const options = playgroundSparkleOptionsFromSliders(25, 0.5);
    const visibilities = new Set<boolean>();
    for (let step = 0; step < 400; step++) {
      visibilities.add(isPlaygroundSparkleCellVisible(4, 6, step * 0.02, options));
      if (visibilities.size === 2) {
        break;
      }
    }
    expect(visibilities.size).toBe(2);
  });
});
