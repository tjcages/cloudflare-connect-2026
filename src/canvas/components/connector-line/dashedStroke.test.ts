import { describe, expect, it } from "vitest";
import { Graphics } from "pixi.js";
import { appendDashedPolyline, appendDashedRectOutline } from "./dashedStroke";

type RecordedSegment = { x1: number; y1: number; x2: number; y2: number };

const recordDashedPolyline = (
  points: Array<{ x: number; y: number }>,
  dashOn: number,
  dashOff: number,
  phaseOffset = 0,
) => {
  const segments: RecordedSegment[] = [];
  let pendingMove: { x: number; y: number } | null = null;

  const graphics = {
    moveTo(x: number, y: number) {
      pendingMove = { x, y };
    },
    lineTo(x: number, y: number) {
      if (!pendingMove) {
        throw new Error("lineTo without moveTo");
      }
      segments.push({ x1: pendingMove.x, y1: pendingMove.y, x2: x, y2: y });
      pendingMove = { x, y };
    },
  } as unknown as Graphics;

  appendDashedPolyline(graphics, points, dashOn, dashOff, phaseOffset);
  return segments;
};

const segmentLength = (segment: RecordedSegment): number =>
  Math.hypot(segment.x2 - segment.x1, segment.y2 - segment.y1);

describe("appendDashedPolyline", () => {
  it("emits 3px dashes with 4px gaps along a horizontal segment", () => {
    const segments = recordDashedPolyline(
      [
        { x: 0, y: 0 },
        { x: 40, y: 0 },
      ],
      3,
      4,
    );

    expect(segments).toHaveLength(6);
    for (const segment of segments) {
      expect(segment.y1).toBe(0);
      expect(segment.y2).toBe(0);
      expect(segmentLength(segment)).toBeCloseTo(3, 5);
    }
    expect(segments[0]).toMatchObject({ x1: 0, x2: 3 });
    expect(segments[1]).toMatchObject({ x1: 7, x2: 10 });
    expect(segments[5]).toMatchObject({ x1: 35, x2: 38 });
  });

  it("keeps dash phase continuous across a 90° bend", () => {
    const segments = recordDashedPolyline(
      [
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 10, y: 10 },
      ],
      3,
      4,
    );

    expect(segments).toHaveLength(3);
    expect(segments[0]).toMatchObject({ x1: 0, y1: 0, x2: 3, y2: 0 });
    expect(segments[1]).toMatchObject({ x1: 7, y1: 0, x2: 10, y2: 0 });
    expect(segments[2]).toMatchObject({ x1: 10, y1: 4, x2: 10, y2: 7 });
  });
});

describe("appendDashedRectOutline", () => {
  it("walks all four edges of a rectangle", () => {
    const recorded: RecordedSegment[] = [];
    let pendingMove: { x: number; y: number } | null = null;
    const graphics = {
      moveTo(x: number, y: number) {
        pendingMove = { x, y };
      },
      lineTo(x: number, y: number) {
        if (!pendingMove) {
          throw new Error("lineTo without moveTo");
        }
        recorded.push({ x1: pendingMove.x, y1: pendingMove.y, x2: x, y2: y });
        pendingMove = { x, y };
      },
    } as unknown as Graphics;

    appendDashedRectOutline(graphics, 0, 0, 80, 80, 3, 4);

    expect(recorded.length).toBeGreaterThan(0);
    expect(recorded.some((segment) => segment.y1 === 0 && segment.y2 === 0)).toBe(true);
    expect(recorded.some((segment) => segment.x1 === 80 && segment.x2 === 80)).toBe(true);
    expect(recorded.some((segment) => segment.y1 === 80 && segment.y2 === 80)).toBe(true);
    expect(recorded.some((segment) => segment.x1 === 0 && segment.x2 === 0)).toBe(true);
  });
});

describe("appendDashedPolyline phase", () => {
  it("shifts dash pattern forward when phase offset increases", () => {
    const atZero = recordDashedPolyline(
      [
        { x: 0, y: 0 },
        { x: 40, y: 0 },
      ],
      3,
      4,
      0,
    );
    const atOne = recordDashedPolyline(
      [
        { x: 0, y: 0 },
        { x: 40, y: 0 },
      ],
      3,
      4,
      1,
    );

    expect(atZero[0]).toMatchObject({ x1: 0, x2: 3 });
    expect(atOne[0]).toMatchObject({ x1: 0, x2: 2 });
  });
});
