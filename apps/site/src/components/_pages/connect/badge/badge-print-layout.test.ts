import { describe, expect, it } from "vitest";
import { badgePrintFieldRect } from "./badge-print-layout";

describe("badge print field layout", () => {
  it("keeps a white margin around the shader and a footer below it", () => {
    expect(badgePrintFieldRect(1000, 1000, 0.1, 0.08, 0.2)).toEqual({
      x: 100,
      y: 80,
      w: 800,
      h: 720,
    });
  });
});
