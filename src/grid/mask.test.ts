import { describe, expect, it } from "vitest";
import { candidateTouchesGap, createGapMask, setMaskCell } from "./mask";

describe("gap mask", () => {
  it("maps top painted cells to top grid slots", () => {
    const mask = setMaskCell(createGapMask(14, 20), 0, 0, true);

    expect(
      candidateTouchesGap(mask, {
        kind: "small",
        x: 0,
        y: 0,
        width: 40,
        height: 40,
      }),
    ).toBe(true);
  });

  it("does not mirror top painted cells into bottom grid slots", () => {
    const mask = setMaskCell(createGapMask(14, 20), 0, 0, true);

    expect(
      candidateTouchesGap(mask, {
        kind: "small",
        x: 0,
        y: 520,
        width: 40,
        height: 40,
      }),
    ).toBe(false);
  });

  it("scales by exact base-grid slots instead of a coarse preview proxy", () => {
    const mask = setMaskCell(createGapMask(14, 20), 3, 7, true);

    expect(
      candidateTouchesGap(mask, {
        kind: "large",
        x: 240,
        y: 80,
        width: 80,
        height: 80,
      }),
    ).toBe(true);
  });
});
