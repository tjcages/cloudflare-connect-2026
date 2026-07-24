import { describe, expect, it } from "vitest";
import { DEFAULT_ENGINE_CONFIG } from "@necatikcl/stripes-engine";
import { buildFrameGroups, framesOverlayToSvg } from "./framesOverlay";

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
        cells: [
          { col: 0, row: 0 },
          { col: 1, row: 0 },
          { col: 1, row: 1 },
        ],
        peakLuminance: 230 / 255,
        peakColor: null,
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
        cells: [
          { col: 0, row: 0 },
          { col: 2, row: 0 },
        ],
        peakLuminance: 240 / 255,
        peakColor: null,
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
        cells: [{ col: 1, row: 0 }],
        peakLuminance: 240 / 255,
        peakColor: null,
      },
    ]);
    expect(buildFrameGroups(readback, 0.5, 1, stripes, 2)[0]?.cells).toEqual([
      { col: 0, row: 0 },
      { col: 1, row: 0 },
    ]);
  });

  it("exports frame outlines, corner points, and coordinate labels as SVG", () => {
    const config = {
      ...DEFAULT_ENGINE_CONFIG,
      grid: { ...DEFAULT_ENGINE_CONFIG.grid, cellWidth: 10, cellHeight: 8 },
      frames: {
        ...DEFAULT_ENGINE_CONFIG.frames,
        enabled: true,
        color: 0xff6600,
        coordinateColor: 0x112233,
        fontSizePx: 12,
      },
    };
    const svg = framesOverlayToSvg(
      [{ cells: [{ col: 0, row: 0 }], peakLuminance: 1, peakColor: null }],
      config,
      10,
      8,
      0,
    );

    expect(svg).toContain('data-layer="frames"');
    expect(svg).toContain('class="frame-outline"');
    expect(svg.match(/class="frame-corner"/g)).toHaveLength(4);
    expect(svg.match(/class="frame-outline"[^>]*stroke-opacity/g)).toBeNull();
    expect(svg.match(/class="frame-corner"[^>]*fill-opacity/g)).toBeNull();
    expect(svg.match(/class="frame-label-bg"[^>]*fill-opacity/g)).toBeNull();
    expect(svg).toContain('fill="#ff6600"');
    expect(svg).toContain('fill="#112233"');
    expect(svg).toContain("font-size:12px");
    expect(svg).toContain('x="18.5" y="12.3"');
    expect(svg).toContain('text-anchor="middle"');
    expect(svg).not.toContain("dominant-baseline");
    expect(svg).toContain(">0, 0</text>");
  });
});
