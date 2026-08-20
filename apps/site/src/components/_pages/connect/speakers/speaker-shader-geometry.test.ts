import { describe, expect, it } from "vitest";
import {
  buildPartialFramePlan,
  createCursorFrame,
  cursorFrameRect,
  intersectRects,
  mapClientPointToRoot,
  measureRelativeRect,
  objectCoverSourceRect,
  moveCursorFrame,
  resolveAuthoredFrames,
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

  it("locks authored frames to image-relative coordinates", () => {
    const apertures = [
      { x: 20, y: 10, width: 200, height: 200 },
      { x: 260, y: 10, width: 200, height: 200 },
    ];
    const [frame] = resolveAuthoredFrames(
      [
        {
          imageIndex: 1,
          x: 0.25,
          y: 0.1,
          width: 0.5,
          height: 0.4,
          span: false,
        },
      ],
      apertures,
    );

    expect(frame.rect).toEqual({
      x: 310,
      y: 30,
      width: 100,
      height: 80,
    });
  });

  it("clips non-span overflow back to the anchor image", () => {
    const apertures = [
      { x: 0, y: 0, width: 200, height: 200 },
      { x: 240, y: 0, width: 200, height: 200 },
    ];
    const [frame] = resolveAuthoredFrames(
      [
        {
          imageIndex: 0,
          x: 0.7,
          y: 0.2,
          width: 0.6,
          height: 0.5,
          span: false,
        },
      ],
      apertures,
    );

    expect(frame.rect).toEqual({ x: 140, y: 40, width: 60, height: 100 });
  });

  it("lets a spanning frame cover two portraits while leaving the gutter empty", () => {
    const apertures = [
      { x: 0, y: 0, width: 200, height: 200 },
      { x: 240, y: 0, width: 200, height: 200 },
    ];
    const [frame] = resolveAuthoredFrames(
      [
        {
          imageIndex: 0,
          x: 0.7,
          y: 0.2,
          width: 0.8,
          height: 0.5,
          span: true,
        },
      ],
      apertures,
    );
    const plan = buildPartialFramePlan([frame.rect], apertures);

    expect(frame.rect).toEqual({ x: 140, y: 40, width: 160, height: 100 });
    expect(plan.maskFragments.map(({ rect }) => rect)).toEqual([
      { x: 140, y: 40, width: 60, height: 100 },
      { x: 240, y: 40, width: 60, height: 100 },
    ]);
  });

  it("ignores placements aimed at a missing image", () => {
    expect(
      resolveAuthoredFrames(
        [
          {
            imageIndex: 4,
            x: 0.1,
            y: 0.1,
            width: 0.2,
            height: 0.2,
            span: false,
          },
        ],
        [{ x: 0, y: 0, width: 200, height: 200 }],
      ),
    ).toEqual([]);
  });

  it("creates a cursor frame only inside a portrait band and clamps it at the edges", () => {
    const bands = [{ x: 40, y: 100, width: 900, height: 320 }];

    expect(createCursorFrame({ x: 200, y: 80 }, bands)).toBeNull();
    expect(createCursorFrame({ x: 42, y: 102 }, bands)).toEqual({
      center: { x: 107.5, y: 154.4 },
      width: 135,
      height: 108.80000000000001,
    });
  });

  it("moves one cursor-owned frame toward the pointer without spawning another", () => {
    const seed = {
      center: { x: 300, y: 200 },
      width: 120,
      height: 80,
    };
    const moved = moveCursorFrame(seed, { x: 500, y: 260 }, [{ x: 0, y: 0, width: 900, height: 320 }], {
      follow: 0.25,
    });

    expect(moved.center).toEqual({ x: 350, y: 215 });
    expect(cursorFrameRect(moved)).toEqual({
      x: 288.125,
      y: 171.4,
      width: 123.75,
      height: 87.2,
    });
    expect(moveCursorFrame(moved, { x: 500, y: 400 }, [{ x: 0, y: 0, width: 900, height: 320 }])).toBe(moved);
  });
});
