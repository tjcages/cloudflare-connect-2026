import { describe, expect, it } from "vitest";
import { INTRO_ANGLE, INTRO_YAW, introRopePoint } from "./badge-intro";

describe("badge intro pose", () => {
  it("starts almost 90 degrees to the right of hanging rest", () => {
    expect(INTRO_ANGLE).toBeCloseTo(Math.PI * 0.48, 5);
    expect(INTRO_YAW).toBeCloseTo(Math.PI * 0.48, 5);
    expect(INTRO_ANGLE).toBeGreaterThan(Math.PI / 2 - 0.12);
    expect(INTRO_ANGLE).toBeLessThan(Math.PI / 2);
  });

  it("places the tip out to the right instead of dropping it from above", () => {
    const pin = { x: 0, y: 0.16, z: 0 };
    const length = 0.16;
    const tip = introRopePoint(pin, length, 1);
    const mid = introRopePoint(pin, length, 0.5);
    expect(tip.x).toBeGreaterThan(length * 0.9);
    expect(tip.y).toBeGreaterThan(pin.y - 0.03);
    expect(tip.y).toBeLessThan(pin.y);
    expect(mid.x).toBeCloseTo(tip.x / 2, 5);
    expect(mid.y).toBeGreaterThan(tip.y);
  });
});
