import { describe, expect, it } from "vitest";
import { resolveSvgExportBackground } from "./svgExportBackground";

describe("resolveSvgExportBackground", () => {
  it("always includes Connect underlay when provided", () => {
    expect(
      resolveSvgExportBackground({
        includeSolidBackground: false,
        backgroundTransparent: false,
        backgroundGradientEnabled: false,
        backgroundColorHex: "#ffffff",
        connectUnderlayHref: "data:image/png;base64,abc",
      }),
    ).toEqual({
      backgroundImageHref: "data:image/png;base64,abc",
    });
  });

  it("omits solid background when includeSolidBackground is false", () => {
    expect(
      resolveSvgExportBackground({
        includeSolidBackground: false,
        backgroundTransparent: false,
        backgroundGradientEnabled: false,
        backgroundColorHex: "#ff0000",
      }),
    ).toEqual({});
  });

  it("includes solid background when requested and no underlay", () => {
    expect(
      resolveSvgExportBackground({
        includeSolidBackground: true,
        backgroundTransparent: false,
        backgroundGradientEnabled: false,
        backgroundColorHex: "#112233",
      }),
    ).toEqual({
      backgroundHex: "#112233",
    });
  });

  it("keeps underlay on top of an optional solid background", () => {
    expect(
      resolveSvgExportBackground({
        includeSolidBackground: true,
        backgroundTransparent: false,
        backgroundGradientEnabled: false,
        backgroundColorHex: "#000000",
        connectUnderlayHref: "data:image/png;base64,grad",
      }),
    ).toEqual({
      backgroundHex: "#000000",
      backgroundImageHref: "data:image/png;base64,grad",
    });
  });

  it("prefers engine background gradient over solid when include is on", () => {
    const gradient = {
      direction: "topToBottom" as const,
      stopCount: 2,
      stops: ["#fff", "#000"],
    };
    expect(
      resolveSvgExportBackground({
        includeSolidBackground: true,
        backgroundTransparent: false,
        backgroundGradientEnabled: true,
        backgroundColorHex: "#112233",
        backgroundGradient: gradient,
        connectUnderlayHref: "data:image/png;base64,grad",
      }),
    ).toEqual({
      backgroundGradient: gradient,
      backgroundImageHref: "data:image/png;base64,grad",
    });
  });
});
