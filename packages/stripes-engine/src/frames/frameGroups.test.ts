import { describe, expect, it } from "vitest";
import { buildFrameGroups } from "./frameGroups";

describe("buildFrameGroups", () => {
  it("groups neighboring bright cells and converts WebGL rows to display rows", () => {
    const groups = buildFrameGroups(
      {
        cols: 3,
        rows: 2,
        values: new Uint8Array([0, 230, 0, 230, 230, 0]),
        colors: null,
      },
      0.8,
    );

    expect(groups).toEqual([
      {
        columns: [
          { col: 0, minRow: 0, maxRow: 0 },
          { col: 1, minRow: 0, maxRow: 1 },
        ],
      },
    ]);
  });

  it("uses the distance slider to join nearby peak cells", () => {
    const readback = {
      cols: 3,
      rows: 1,
      values: new Uint8Array([230, 0, 240]),
      colors: null,
    };

    expect(buildFrameGroups(readback, 0.8, 1)).toHaveLength(2);
    expect(buildFrameGroups(readback, 0.8, 2)).toEqual([
      {
        columns: [
          { col: 0, minRow: 0, maxRow: 0 },
          { col: 2, minRow: 0, maxRow: 0 },
        ],
      },
    ]);
  });

  it("groups only the requested highest highlighted stripe bands", () => {
    const readback = {
      cols: 2,
      rows: 1,
      values: new Uint8Array([200, 240]),
      colors: null,
    };
    const stripes = [
      { color: 0x111111, startFrom: 0, width: 2, opacity: 1 },
      { color: 0x777777, startFrom: 0.7, width: 3, opacity: 1 },
      { color: 0xffffff, startFrom: 0.9, width: 4, opacity: 1 },
    ];

    expect(buildFrameGroups(readback, 0.5, 1, stripes, 1)).toEqual([
      {
        columns: [{ col: 1, minRow: 0, maxRow: 0 }],
      },
    ]);
    expect(buildFrameGroups(readback, 0.5, 1, stripes, 2)[0]?.columns).toEqual([
      { col: 0, minRow: 0, maxRow: 0 },
      { col: 1, minRow: 0, maxRow: 0 },
    ]);
  });
});
