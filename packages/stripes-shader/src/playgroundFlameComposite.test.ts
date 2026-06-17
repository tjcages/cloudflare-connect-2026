import { describe, expect, it } from "vitest";
import { mergeFlameColorBytes } from "./playgroundFlameComposite";

describe("mergeFlameColorBytes", () => {
  it("returns source when flame cover is zero", () => {
    expect(mergeFlameColorBytes(255, 255, 255, 0, 0, 0, 1)).toEqual({
      r: 255,
      g: 255,
      b: 255,
      hasFlame: false,
    });
  });

  it("replaces white source with flame color at full cover", () => {
    expect(mergeFlameColorBytes(255, 255, 255, 255, 40, 20, 1)).toEqual({
      r: 255,
      g: 40,
      b: 20,
      hasFlame: true,
    });
  });

  it("leaves dark source unchanged when flame is weaker than max()", () => {
    const merged = mergeFlameColorBytes(10, 10, 10, 255, 40, 20, 1);
    expect(merged.r).toBe(255);
    expect(merged.g).toBe(40);
    expect(merged.b).toBe(20);
  });
});
