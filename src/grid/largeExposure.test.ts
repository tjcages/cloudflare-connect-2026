import { describe, expect, it } from "vitest";
import { countLargeExposureSides } from "./largeExposure";
import type { GridCell } from "./types";

describe("countLargeExposureSides", () => {
  const config = {
    rows: 10,
    columns: 12,
    gapMask: Array.from({ length: 10 }, () => Array.from({ length: 12 }, () => false)),
  };

  const slotKinds = new Map<string, GridCell["kind"]>();
  const occupied = new Set<string>();

  const addLarge = (x: number, y: number) => {
    const cell: GridCell = { id: `large-${x}-${y}`, kind: "large", x, y, width: 80, height: 80 };

    for (let row = y / 40; row < y / 40 + 2; row += 1) {
      for (let column = x / 40; column < x / 40 + 2; column += 1) {
        const key = `${row}:${column}`;
        slotKinds.set(key, "large");
        occupied.add(key);
      }
    }

    return cell;
  };

  it("counts the canvas edge as an occupied side", () => {
    slotKinds.clear();
    occupied.clear();

    const topEdge = addLarge(80, 0);
    addLarge(0, 0);
    addLarge(160, 0);

    expect(countLargeExposureSides(topEdge, occupied, slotKinds, config)).toBe(3);
  });

  it("counts only large neighbors when away from the canvas edge", () => {
    slotKinds.clear();
    occupied.clear();

    const interior = addLarge(80, 80);
    addLarge(0, 80);
    addLarge(160, 80);

    expect(countLargeExposureSides(interior, occupied, slotKinds, config)).toBe(2);
  });
});
