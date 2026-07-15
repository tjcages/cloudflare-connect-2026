import { describe, expect, it } from "vitest";
import { clampPreviewZoom, computeFitPreviewZoom, estimateCanvasViewportSize } from "./canvasFitPreviewZoom";

describe("computeFitPreviewZoom", () => {
  it("fits a large canvas into a smaller viewport", () => {
    expect(
      computeFitPreviewZoom({
        canvasWidth: 1280,
        canvasHeight: 960,
        viewportWidth: 640,
        viewportHeight: 480,
      }),
    ).toBe(0.5);
  });

  it("scales up a small canvas to fill available space", () => {
    expect(
      computeFitPreviewZoom({
        canvasWidth: 400,
        canvasHeight: 300,
        viewportWidth: 800,
        viewportHeight: 600,
      }),
    ).toBe(2);
  });

  it("is limited by the tighter axis", () => {
    expect(
      computeFitPreviewZoom({
        canvasWidth: 1000,
        canvasHeight: 500,
        viewportWidth: 800,
        viewportHeight: 200,
      }),
    ).toBe(0.4);
  });

  it("clamps to the preview zoom range", () => {
    expect(clampPreviewZoom(0.1)).toBe(0.25);
    expect(clampPreviewZoom(10)).toBe(4);
    expect(
      computeFitPreviewZoom({
        canvasWidth: 100,
        canvasHeight: 100,
        viewportWidth: 2000,
        viewportHeight: 2000,
      }),
    ).toBe(4);
  });
});

describe("estimateCanvasViewportSize", () => {
  it("subtracts open panel widths and padding from the window", () => {
    expect(
      estimateCanvasViewportSize({
        windowWidth: 1440,
        windowHeight: 900,
        textureSidebarOpen: true,
        textureSidebarWidth: 272,
        shaderSidebarOpen: true,
        shaderSidebarWidth: 272,
        areaPaddingX: 48,
        areaPaddingY: 48,
        bottomBarHeight: 52,
      }),
    ).toEqual({
      width: 1440 - 272 - 272 - 48,
      height: 900 - 52 - 48,
    });
  });

  it("ignores closed sidebars", () => {
    expect(
      estimateCanvasViewportSize({
        windowWidth: 1000,
        windowHeight: 800,
        textureSidebarOpen: false,
        textureSidebarWidth: 272,
        shaderSidebarOpen: false,
        shaderSidebarWidth: 272,
        areaPaddingX: 0,
        areaPaddingY: 0,
        bottomBarHeight: 0,
      }),
    ).toEqual({ width: 1000, height: 800 });
  });
});
