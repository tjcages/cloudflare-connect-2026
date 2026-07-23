import { describe, expect, it } from "vitest";
import { resolveSvgExportBackground } from "./svgExportBackground";

describe("resolveSvgExportBackground", () => {
  it("omits background when the engine background is transparent", () => {
    expect(
      resolveSvgExportBackground({
        backgroundTransparent: true,
        backgroundGradientEnabled: false,
        backgroundColorHex: "#ff0000",
      }),
    ).toEqual({});
  });

  it("includes the active solid background", () => {
    expect(
      resolveSvgExportBackground({
        backgroundTransparent: false,
        backgroundGradientEnabled: false,
        backgroundColorHex: "#112233",
      }),
    ).toEqual({
      backgroundHex: "#112233",
    });
  });

  it("prefers the active engine background gradient over its solid fallback", () => {
    const gradient = {
      direction: "topToBottom" as const,
      stopCount: 2,
      stops: ["#fff", "#000"],
    };
    expect(
      resolveSvgExportBackground({
        backgroundTransparent: false,
        backgroundGradientEnabled: true,
        backgroundColorHex: "#112233",
        backgroundGradient: gradient,
      }),
    ).toEqual({
      backgroundGradient: gradient,
    });
  });
});
