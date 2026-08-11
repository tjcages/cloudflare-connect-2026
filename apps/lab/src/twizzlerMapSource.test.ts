import { describe, expect, it } from "vitest";
import type { TwizzlerLine } from "./twizzler";
import { normalizeTwizzlerMapSettings, twizzlerEnvelope, twizzlerMapDirectionVector } from "./twizzlerMapSource";

describe("Twizzler Map shader", () => {
  it("builds a ribbon envelope around every Twizzler line", () => {
    const lines: TwizzlerLine[] = [
      {
        across: 0,
        opacity: 1,
        color: "#e8481c",
        nearness: 0.5,
        strokeWidth: 1.5,
        points: [
          { x: 0, y: 4, depth: 1, along: 0, nearness: 0.5 },
          { x: 10, y: 8, depth: 1, along: 1, nearness: 0.6 },
        ],
      },
      {
        across: -1,
        opacity: 1,
        color: "#e8481c",
        nearness: 0.3,
        strokeWidth: 1,
        points: [
          { x: 0, y: 2, depth: 1, along: 0, nearness: 0.3 },
          { x: 10, y: 12, depth: 1, along: 1, nearness: 0.4 },
        ],
      },
      {
        across: 1,
        opacity: 1,
        color: "#e8481c",
        nearness: 0.7,
        strokeWidth: 2,
        points: [
          { x: 0, y: 6, depth: 1, along: 0, nearness: 0.7 },
          { x: 10, y: 10, depth: 1, along: 1, nearness: 0.8 },
        ],
      },
    ];

    expect(twizzlerEnvelope(lines)).toEqual({
      top: [
        { x: 0, y: 2 },
        { x: 10, y: 8 },
      ],
      bottom: [
        { x: 0, y: 6 },
        { x: 10, y: 12 },
      ],
    });
  });

  it("supports cardinal and diagonal animation directions", () => {
    expect(twizzlerMapDirectionVector("topToBottom")).toEqual({ x: 0, y: 1 });
    expect(twizzlerMapDirectionVector("topRightToBottomLeft")).toEqual({
      x: -Math.SQRT1_2,
      y: Math.SQRT1_2,
    });
  });

  it("normalizes the expanded map controls", () => {
    expect(
      normalizeTwizzlerMapSettings({
        flowAmplitude: 3,
        flowSpeed: -5,
        flowSpacing: 0,
        flowDirection: "invalid",
        topOffsetPx: 999,
        bottomOffsetPx: -10,
        topSpread: 9,
        bottomSpread: -2,
      }),
    ).toMatchObject({
      flowAmplitude: 1,
      flowSpeed: -3,
      flowSpacing: 0.02,
      flowDirection: "topRightToBottomLeft",
      topOffsetPx: 400,
      bottomOffsetPx: 0,
      topSpread: 4,
      bottomSpread: 0,
    });
  });
});
