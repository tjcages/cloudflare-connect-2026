import { describe, expect, it } from "vitest";
import { canvasStackBackgroundCss } from "./canvasStackBackground";

describe("canvasStackBackgroundCss", () => {
  it("returns undefined when the engine background is transparent", () => {
    expect(canvasStackBackgroundCss({ transparent: true, color: 0xff0000 })).toBeUndefined();
  });

  it("returns a hex color for opaque backgrounds", () => {
    expect(canvasStackBackgroundCss({ transparent: false, color: 0x0a1b2c })).toBe("#0a1b2c");
    expect(canvasStackBackgroundCss({ transparent: false, color: 0 })).toBe("#000000");
    expect(canvasStackBackgroundCss({ transparent: false, color: 0xffffff })).toBe("#ffffff");
  });

  it("clamps out-of-range colors", () => {
    expect(canvasStackBackgroundCss({ transparent: false, color: -1 })).toBe("#000000");
    expect(canvasStackBackgroundCss({ transparent: false, color: 0x1ffffff })).toBe("#ffffff");
  });
});
