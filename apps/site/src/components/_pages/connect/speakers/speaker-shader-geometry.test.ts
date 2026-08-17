import { describe, expect, it } from "vitest";
import {
  buildPartialFramePlan,
  intersectRects,
  mapClientPointToRoot,
  measureRelativeRect,
  objectCoverSourceRect,
  resolveFloatingFrames,
  resolvePortraitBands,
} from "./speaker-shader-geometry";

const domRect = (left: number, top: number, width: number, height: number) =>
  ({
    left,
    top,
    width,
    height,
    right: left + width,
    bottom: top + height,
  }) as DOMRect;

describe("speaker shader geometry", () => {
  it("measures CSS-space geometry independently of backing-store DPR", () => {
    const root = domRect(100, 200, 900, 760);
    expect(measureRelativeRect(root, domRect(124, 240, 280, 320))).toEqual({
      x: 24,
      y: 40,
      width: 280,
      height: 320,
    });
    expect(mapClientPointToRoot(380, 320, domRect(80, 120, 600, 400), 2)).toEqual({
      x: 150,
      y: 100,
    });
  });

  it("matches top-centered object-cover for portrait and landscape sources", () => {
    expect(objectCoverSourceRect({ width: 600, height: 900 }, { width: 320, height: 320 })).toEqual({
      x: 0,
      y: 0,
      width: 600,
      height: 600,
    });
    expect(objectCoverSourceRect({ width: 1200, height: 600 }, { width: 320, height: 320 })).toEqual({
      x: 300,
      y: 0,
      width: 600,
      height: 600,
    });
  });

  it("returns no shader coverage when frames miss every portrait", () => {
    expect(
      buildPartialFramePlan([{ x: 300, y: 0, width: 40, height: 40 }], [{ x: 0, y: 0, width: 200, height: 200 }]),
    ).toEqual({
      maskFragments: [],
      outlines: [{ x: 300, y: 0, width: 40, height: 40 }],
      renderPasses: 0,
    });
  });

  it("clips shader pixels to frame–portrait intersections", () => {
    expect(intersectRects({ x: 160, y: 20, width: 200, height: 120 }, { x: 0, y: 0, width: 240, height: 200 })).toEqual(
      { x: 160, y: 20, width: 80, height: 120 },
    );
  });

  it("straddles two portraits while leaving their gutter transparent", () => {
    const frame = { x: 190, y: 30, width: 180, height: 100 };
    const plan = buildPartialFramePlan(
      [frame],
      [
        { x: 0, y: 0, width: 240, height: 200 },
        { x: 280, y: 0, width: 240, height: 200 },
      ],
    );

    expect(plan.maskFragments.map(({ rect }) => rect)).toEqual([
      { x: 190, y: 30, width: 50, height: 100 },
      { x: 280, y: 30, width: 90, height: 100 },
    ]);
    expect(plan.outlines).toEqual([frame]);
    expect(plan.renderPasses).toBe(1);
  });

  it("builds continuous row bands for outlines without metadata coverage", () => {
    expect(
      resolvePortraitBands(
        [
          { x: 20, y: 10, width: 240, height: 200 },
          { x: 300, y: 10, width: 240, height: 200 },
          { x: 20, y: 300, width: 240, height: 200 },
        ],
        560,
      ),
    ).toEqual([
      { x: 0, y: 10, width: 560, height: 200 },
      { x: 0, y: 300, width: 560, height: 200 },
    ]);
  });

  it("freezes every frame at one deterministic reduced-motion pose", () => {
    const bands = [{ x: 0, y: 0, width: 900, height: 320 }];
    expect(resolveFloatingFrames(0, bands, true)).toEqual(resolveFloatingFrames(1_000, bands, true));
    expect(resolveFloatingFrames(0, bands, false)).not.toEqual(resolveFloatingFrames(1_000, bands, false));
  });

  it("keeps all authored frames inside their portrait bands", () => {
    const bands = [
      { x: 0, y: 40, width: 900, height: 320 },
      { x: 0, y: 440, width: 900, height: 320 },
    ];
    for (const frame of resolveFloatingFrames(42, bands)) {
      const containingBand = bands.find(
        (band) =>
          frame.x >= band.x &&
          frame.y >= band.y &&
          frame.x + frame.width <= band.x + band.width &&
          frame.y + frame.height <= band.y + band.height,
      );
      expect(containingBand).toBeDefined();
    }
  });
});
