import { describe, expect, it } from "vitest";
import { paletteBrush } from "./palette";

describe("paletteBrush", () => {
  it("returns Pixi-packed colors with hex accessors", () => {
    const b = paletteBrush("purple");
    expect(b.fillHex).toBe("#9C37FF");
    expect(b.fillTextHex).toBe("#FFFFFF");
    expect(b.iconFillHex).toBe("#9C37FF");
    expect(b.fill).toBeGreaterThan(0);
    expect(b.fillText).toBeGreaterThan(0);
    expect(b.iconFill).toBe(b.fill);
  });

  it("uses theme iconFill when provided", () => {
    const b = paletteBrush("neutral");
    expect(b.fillHex).toBe("#F3F3F3");
    expect(b.iconFillHex).toBe("#B3B3B3");
    expect(b.iconFill).not.toBe(b.fill);
  });

  it("syncs neutral fill to grid stroke hex when provided", () => {
    const b = paletteBrush("neutral", { neutralFillSyncHex: "#aabbcc" });
    expect(b.fillHex).toBe("#aabbcc");
    expect(b.iconFillHex).toBe("#B3B3B3");
  });

  it("does not apply neutral fill sync to accent themes", () => {
    const b = paletteBrush("orange", { neutralFillSyncHex: "#aabbcc" });
    expect(b.fillHex).toBe("#FF4802");
  });
});
