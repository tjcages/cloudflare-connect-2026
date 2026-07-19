import { describe, it, expect } from "vitest";
import { migrateLegacyConfig } from "./migrateLegacyConfig";

describe("migrateLegacyConfig", () => {
  it("maps adjustments/transform/mode/grid/background", () => {
    const out = migrateLegacyConfig({
      textureAdjustments: { contrast: 2, gamma: 1.5 },
      sourceTransform: { fit: "cover", zoom: 1.5, panX: 0.2, panY: 0 },
      textureLuminanceMode: "overlay",
      grid: { cellWidth: 9, cellHeight: 9, gapX: 1, gapY: 1, cornerRadius: 2, orientation: "horizontal" },
      backgroundColor: 0x222222,
    });
    expect(out.adjustments).toMatchObject({ contrast: 2, gamma: 1.5 });
    expect(out.transform).toMatchObject({ fit: "cover", zoom: 1.5, panX: 0.2 });
    expect(out.grid).toMatchObject({ cellWidth: 9, orientation: "horizontal" });
    expect(out.background).toMatchObject({ color: 0x222222, transparent: false });
  });
  it("converts hex-string stripe colors to numeric", () => {
    const out = migrateLegacyConfig({ stripes: [{ hex: "#ff8833", startFrom: 0.5, width: 6 }] });
    expect(out.stripes).toEqual([{ color: 0xff8833, startFrom: 0.5, width: 6, opacity: 1 }]);
  });
  it("ignores unknown / missing input safely", () => {
    expect(migrateLegacyConfig({})).toEqual({});
    expect(migrateLegacyConfig(null)).toEqual({});
    expect(migrateLegacyConfig("garbage")).toEqual({});
  });
  it("maps old reveal shape into reveal config (noiseScale ignored)", () => {
    const out = migrateLegacyConfig({
      reveal: {
        enabled: true,
        type: "assembly",
        wave: { position: "left top", durationMs: 2000, softness: 0.5, waviness: 0.7, noiseScale: 20 },
        assembly: { speedMinMs: 400, speedMaxMs: 1800, staggerMs: 1000 },
      },
    });
    expect(out.reveal).toEqual({
      enabled: true,
      type: "assembly",
      wave: { position: "left top", durationMs: 2000, softness: 0.5, waviness: 0.7 },
      assembly: {
        style: "scatter",
        sliceSizePx: 40,
        speedMinMs: 400,
        speedMaxMs: 1800,
        staggerMs: 1000,
        scatterPx: 50,
        angleJitterDeg: 22,
        intensity: 1,
        detail: 0.5,
        glow: 0.6,
        blurPx: 8,
        blurStart: 0,
      },
    });
  });
});
