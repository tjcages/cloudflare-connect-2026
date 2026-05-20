import { describe, expect, it } from "vitest";
import {
  constrainReferenceColor,
  isIgnoredBgPixel,
  pixelDistanceFromReference,
  pixelWhiteness,
  smoothReferenceColor,
} from "./colorWhiteness";

const WHITE: [number, number, number] = [1, 1, 1];
const BLACK: [number, number, number] = [0, 0, 0];

describe("colorWhiteness", () => {
  it("treats near-white pixels as background against a white reference", () => {
    expect(isIgnoredBgPixel(250, 252, 255, WHITE, 0.08)).toBe(true);
    expect(isIgnoredBgPixel(255, 255, 255, WHITE, 0.08)).toBe(true);
  });

  it("treats near-black pixels as background against a black reference", () => {
    expect(isIgnoredBgPixel(0, 0, 0, BLACK, 0.08)).toBe(true);
    expect(isIgnoredBgPixel(8, 10, 12, BLACK, 0.08)).toBe(true);
    expect(isIgnoredBgPixel(40, 90, 220, BLACK, 0.08)).toBe(false);
  });

  it("gives blue a high distance from white and a low distance from black", () => {
    const blueFromWhite = pixelDistanceFromReference(40, 90, 220, WHITE);
    const blueFromBlack = pixelDistanceFromReference(40, 90, 220, BLACK);
    expect(blueFromWhite).toBeGreaterThan(0.3);
    expect(blueFromBlack).toBeGreaterThan(0.15);
  });

  it("ranks blue min channel below white", () => {
    expect(pixelWhiteness(40, 90, 220)).toBeLessThan(pixelWhiteness(255, 255, 255));
  });

  it("clamps bright corner spikes when ignore is black", () => {
    const constrained = constrainReferenceColor([0.4, 0.35, 0.3], BLACK, 0.08);
    expect(constrained[0]).toBeLessThanOrEqual(0.08);
    expect(constrained[1]).toBeLessThanOrEqual(0.08);
    expect(constrained[2]).toBeLessThanOrEqual(0.08);
  });

  it("smooths reference color over time", () => {
    const first = smoothReferenceColor(undefined, [0.1, 0.1, 0.1], 0.5);
    const second = smoothReferenceColor(first, [0.2, 0.2, 0.2], 0.5);
    expect(second[0]).toBeCloseTo(0.15, 2);
  });

  it("treats light grays as background with gamma below 1 on white clips", () => {
    expect(isIgnoredBgPixel(220, 220, 220, WHITE, 0.08, 1)).toBe(false);
    expect(isIgnoredBgPixel(220, 220, 220, WHITE, 0.08, 0.55)).toBe(true);
  });

  it("treats any non-black pixel as background at gamma 0 on white clips", () => {
    expect(isIgnoredBgPixel(1, 0, 0, WHITE, 0.08, 0)).toBe(true);
    expect(isIgnoredBgPixel(0, 0, 0, WHITE, 0.08, 0)).toBe(false);
  });
});
