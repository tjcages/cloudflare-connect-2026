import { describe, expect, it } from "vitest";
import { DEFAULT_ENGINE_CONFIG, normalizeEngineConfig } from "./normalize";
import { createProductionConfig, serializeProductionConfig } from "./production";
import { resolveThemedConfig, type ThemedEngineConfig } from "./theme";

describe("production config", () => {
  it("keeps only render-active feature branches", () => {
    const config = normalizeEngineConfig({
      ...DEFAULT_ENGINE_CONFIG,
      background: {
        ...DEFAULT_ENGINE_CONFIG.background,
        transparent: false,
        gradient: { ...DEFAULT_ENGINE_CONFIG.background.gradient, enabled: true },
        grid: { ...DEFAULT_ENGINE_CONFIG.background.grid, enabled: false, opacity: 0.25 },
        stars: { ...DEFAULT_ENGINE_CONFIG.background.stars, enabled: true, density: 24 },
      },
      grid: {
        ...DEFAULT_ENGINE_CONFIG.grid,
        streamGapWave: { ...DEFAULT_ENGINE_CONFIG.grid.streamGapWave, enabled: false, squeeze: 0.9 },
      },
      reveal: {
        ...DEFAULT_ENGINE_CONFIG.reveal,
        enabled: true,
        type: "water",
        assembly: { ...DEFAULT_ENGINE_CONFIG.reveal.assembly, scatterPx: 222 },
        water: { ...DEFAULT_ENGINE_CONFIG.reveal.water, intensity: 2.1 },
      },
      sparkle: {
        ...DEFAULT_ENGINE_CONFIG.sparkle,
        gaps: { ...DEFAULT_ENGINE_CONFIG.sparkle.gaps, enabled: false, coverage: 0.8 },
        width: { ...DEFAULT_ENGINE_CONFIG.sparkle.width, enabled: true, coverage: 0.4 },
      },
      stripeDots: { ...DEFAULT_ENGINE_CONFIG.stripeDots, enabled: false, brightness: 0.9 },
      stripeBorder: { ...DEFAULT_ENGINE_CONFIG.stripeBorder, enabled: true, density: 0.4 },
      frames: { ...DEFAULT_ENGINE_CONFIG.frames, enabled: true, fontSizePx: 22 },
      flames: {
        ...DEFAULT_ENGINE_CONFIG.flames,
        enabled: true,
        direction: "left",
        vortexSingular: { ...DEFAULT_ENGINE_CONFIG.flames.vortexSingular, segCount: 70 },
      },
      cursorTrail: {
        ...DEFAULT_ENGINE_CONFIG.cursorTrail,
        enabled: true,
        type: "comet",
        constellation: { ...DEFAULT_ENGINE_CONFIG.cursorTrail.constellation, maxStars: 120 },
        comet: { ...DEFAULT_ENGINE_CONFIG.cursorTrail.comet, nodeCount: 17 },
      },
      clickWave: {
        ...DEFAULT_ENGINE_CONFIG.clickWave,
        enabled: true,
        type: "detonation",
        lifeMs: 4200,
        detonation: { ...DEFAULT_ENGINE_CONFIG.clickWave.detonation, debrisCount: 42 },
      },
      colors: {
        ...DEFAULT_ENGINE_CONFIG.colors,
        mode: "colors",
        gradient: { ...DEFAULT_ENGINE_CONFIG.colors.gradient, enabled: false, hueDriftDeg: 80 },
      },
      renderMode: "vhs",
      renderIntensity: 0.75,
    });

    const production = createProductionConfig(config);

    expect(production.frames).toMatchObject({ enabled: true, fontSizePx: 22 });
    expect(Object.keys(production.reveal ?? {})).toEqual(["enabled", "type", "water"]);
    expect(Object.keys(production.sparkle ?? {})).toEqual(["width"]);
    expect(production.background).toHaveProperty("gradient");
    expect(production.background).toHaveProperty("stars");
    expect(production.background).not.toHaveProperty("grid");
    expect(production.grid).not.toHaveProperty("streamGapWave");
    expect(production).not.toHaveProperty("stripeDots");
    expect(production).toHaveProperty("stripeBorder");
    expect(production.flames).not.toHaveProperty("vortexSingular");
    expect(Object.keys(production.cursorTrail ?? {})).toEqual(["enabled", "type", "comet"]);
    expect(Object.keys(production.clickWave ?? {})).toEqual(["enabled", "type", "detonation"]);
    expect(production.colors).not.toHaveProperty("gradient");
    expect(production.renderMode).toBe("vhs");
    expect(createProductionConfig(production)).toEqual(production);
  });

  it("omits disabled production features and the full Lab envelope", () => {
    const production = createProductionConfig(DEFAULT_ENGINE_CONFIG);
    const serialized = JSON.parse(serializeProductionConfig(DEFAULT_ENGINE_CONFIG)) as Record<string, unknown>;

    expect(production).not.toHaveProperty("reveal");
    expect(production).not.toHaveProperty("sparkle");
    expect(production).not.toHaveProperty("cursorTrail");
    expect(production).not.toHaveProperty("clickWave");
    expect(production).not.toHaveProperty("colors");
    expect(production).not.toHaveProperty("renderMode");
    expect(serialized).not.toHaveProperty("kind");
    expect(serialized).not.toHaveProperty("version");
    expect(serialized).not.toHaveProperty("lab");
  });

  it("keeps dark as a sparse override with only its active variants and required disables", () => {
    const light = normalizeEngineConfig({
      ...DEFAULT_ENGINE_CONFIG,
      background: {
        ...DEFAULT_ENGINE_CONFIG.background,
        transparent: false,
        gradient: { ...DEFAULT_ENGINE_CONFIG.background.gradient, enabled: true },
      },
      reveal: { ...DEFAULT_ENGINE_CONFIG.reveal, enabled: true, type: "wave" },
      cursorTrail: {
        ...DEFAULT_ENGINE_CONFIG.cursorTrail,
        enabled: true,
        type: "comet",
        comet: { ...DEFAULT_ENGINE_CONFIG.cursorTrail.comet, nodeCount: 18 },
      },
      colors: { ...DEFAULT_ENGINE_CONFIG.colors, mode: "colors" },
      renderMode: "vhs",
    });
    const darkConfig = normalizeEngineConfig({
      ...light,
      background: {
        ...light.background,
        gradient: { ...light.background.gradient, enabled: false },
      },
      reveal: {
        ...light.reveal,
        enabled: false,
        assembly: { ...light.reveal.assembly, scatterPx: 240 },
      },
      cursorTrail: {
        ...light.cursorTrail,
        type: "constellation",
        constellation: { ...light.cursorTrail.constellation, starSizePx: 5 },
      },
      colors: { ...light.colors, mode: "luminance" },
      renderMode: "sharp",
    });
    const config: ThemedEngineConfig = {
      ...light,
      dark: {
        background: { gradient: { enabled: false } },
        reveal: { enabled: false, assembly: { scatterPx: 240 } },
        cursorTrail: { type: "constellation", constellation: { starSizePx: 5 } },
        colors: { mode: "luminance" },
        renderMode: "sharp",
      },
    };

    const production = createProductionConfig(config);
    const dark = production.dark;
    const resolvedDark = normalizeEngineConfig(resolveThemedConfig(production, "dark"));

    expect(dark?.background).toEqual({ gradient: { enabled: false } });
    expect(dark?.reveal).toEqual({ enabled: false });
    expect(dark?.cursorTrail).toEqual({
      type: "constellation",
      constellation: { starSizePx: 5 },
    });
    expect(dark?.colors).toEqual({ mode: "luminance" });
    expect(dark?.renderMode).toBe("sharp");
    expect(dark?.reveal).not.toHaveProperty("assembly");
    expect(createProductionConfig(resolvedDark)).toEqual(createProductionConfig(darkConfig));
    expect(createProductionConfig(production)).toEqual(production);
  });

  it("drops dark overrides that only edit inactive branches", () => {
    const config: ThemedEngineConfig = {
      reveal: { enabled: true, type: "wave", wave: { durationMs: 900 } },
      dark: { reveal: { assembly: { scatterPx: 180 } } },
    };

    expect(createProductionConfig(config)).not.toHaveProperty("dark");
  });
});
