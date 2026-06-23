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
    expect(out.background).toEqual({ color: 0x222222 });
  });
  it("converts hex-string stripe colors to numeric", () => {
    const out = migrateLegacyConfig({ stripes: [{ hex: "#ff8833", startFrom: 0.5, width: 6 }] });
    expect(out.stripes).toEqual([{ color: 0xff8833, startFrom: 0.5, width: 6 }]);
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
      assembly: { order: "center", sliceSizePx: 40, speedMinMs: 400, speedMaxMs: 1800, staggerMs: 1000 },
    });
  });
  it("defaults assembly.order to center when old shape has no order", () => {
    const out = migrateLegacyConfig({
      reveal: {
        enabled: false,
        type: "wave",
        wave: { position: "center", durationMs: 1300, softness: 0.16, waviness: 0.35, noiseScale: 14.5 },
        assembly: { speedMinMs: 300, speedMaxMs: 1600, staggerMs: 900 },
      },
    });
    expect(out.reveal?.assembly?.order).toBe("center");
  });
});
