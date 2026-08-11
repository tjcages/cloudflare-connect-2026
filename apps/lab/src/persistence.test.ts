import { DEFAULT_ENGINE_CONFIG } from "@necatikcl/stripes-engine";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  clearStickyBackgroundColor,
  consumeImportedConfigPristine,
  deleteConfig,
  importConfig,
  importSettingsFile,
  DEFAULT_LAB_SETTINGS,
  factoryResetSettings,
  loadEditTheme,
  loadInitialConfig,
  loadLabSettings,
  loadStickyBackgroundColor,
  markImportedConfigPristine,
  resumePersistenceWritesForTests,
  saveConfig,
  saveEditTheme,
  saveLabSettings,
  saveStickyBackgroundColor,
  serializeConfigFile,
  stagePendingConfig,
} from "./persistence";
import type { EngineConfig } from "@necatikcl/stripes-engine";
import { COMET_LOGO_DEFAULTS } from "@necatikcl/stripes-engine";
import { DEFAULT_LAB_ENGINE_CONFIG } from "./defaultLabConfig";

function stubLocalStorage() {
  const items = new Map<string, string>();
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => items.get(key) ?? null,
    setItem: (key: string, value: string) => {
      items.set(key, value);
    },
    removeItem: (key: string) => {
      items.delete(key);
    },
    clear: () => {
      items.clear();
    },
  });
  return items;
}

function stubSessionStorage() {
  const items = new Map<string, string>();
  vi.stubGlobal("sessionStorage", {
    getItem: (key: string) => items.get(key) ?? null,
    setItem: (key: string, value: string) => {
      items.set(key, value);
    },
    removeItem: (key: string) => {
      items.delete(key);
    },
    clear: () => {
      items.clear();
    },
  });
  return items;
}

describe("config file import/export", () => {
  beforeEach(() => {
    stubLocalStorage();
    stubSessionStorage();
  });

  afterEach(() => {
    resumePersistenceWritesForTests();
    vi.unstubAllGlobals();
  });

  it("exports a lab settings file with full engine and lab UI settings", () => {
    const exported = JSON.parse(
      serializeConfigFile(
        {
          ...DEFAULT_ENGINE_CONFIG,
          grid: { ...DEFAULT_ENGINE_CONFIG.grid, cellWidth: 12 },
        },
        {
          canvasMode: "manual",
          canvasScale: 2,
          canvasWidth: 1200,
          canvasHeight: 800,
          exportDurationSec: 9,
          textureId: "cf-base",
          backgroundFillMode: "source",
          stripePalette: "Background Ramp",
          backgroundRampEasing: "custom:0.1,0,0.2,1",
          thresholdDistributionEasing: "easeOutQuad",
          autoStripeWidths: false,
          drawerOpen: { Stripes: true, Grid: false },
        },
      ),
    ) as Record<string, unknown>;
    const exportedConfig = exported.config as Record<string, unknown>;
    const exportedLab = exported.lab as Record<string, unknown>;

    expect(exported.kind).toBe("stripes-engine-lab-settings");
    expect(exported.version).toBe(2);
    expect((exportedConfig.grid as EngineConfig["grid"]).cellWidth).toBe(12);
    expect(exportedLab.canvasMode).toBe("manual");
    expect(exportedLab.canvasScale).toBe(2);
    expect(exportedLab.canvasWidth).toBe(1200);
    expect(exportedLab.canvasHeight).toBe(800);
    expect(exportedLab.exportDurationSec).toBe(9);
    expect(exportedLab.textureId).toBe("cf-base");
    expect(exportedLab.backgroundFillMode).toBe("source");
    expect(exportedLab.stripePalette).toBe("Background Ramp");
    expect(exportedLab.backgroundRampEasing).toBe("custom:0.1,0,0.2,1");
    expect(exportedLab.thresholdDistributionEasing).toBe("easeOutQuad");
    expect(exportedLab.autoStripeWidths).toBe(false);
    expect(exportedLab.drawerOpen).toEqual({ Stripes: true, Grid: false });
  });

  it("uses the Cloudflare marketing palette and Connect shader as factory defaults", () => {
    expect(DEFAULT_LAB_ENGINE_CONFIG.stripeDots).toEqual({
      enabled: true,
      density: 0.8,
      randomVisibility: 1,
      sizePx: 1.5,
      brightness: 0.13,
      hueDriftDeg: 0,
      saturationBoost: 0,
    });
    expect(DEFAULT_LAB_ENGINE_CONFIG.stripeBorder).toEqual({
      enabled: true,
      minWidthPx: 4,
      density: 0.02,
    });
    expect(DEFAULT_LAB_ENGINE_CONFIG.gridLines).toEqual({
      enabled: false,
      brightness: 0,
      density: 0.01,
    });
    expect(DEFAULT_LAB_ENGINE_CONFIG.frames).toEqual({
      enabled: true,
      luminanceThreshold: 0.56,
      highlightedStripeCount: 7,
      groupDistanceCells: 7,
      color: 16760596,
      fontSizePx: 8,
      coordinateColor: 16777215,
    });
    expect(DEFAULT_LAB_ENGINE_CONFIG.background.color).toBe(0xf46021);
    expect(DEFAULT_LAB_ENGINE_CONFIG.stripes.map(({ color }) => color)).toEqual([
      0xf46021, 0xf86a00, 0xff8839, 0xffa05b, 0xffbb7d, 0xffd39e, 0xffe3bb, 0xffefd4, 0xfff8ea, 0xf5f5f5,
    ]);
    expect(DEFAULT_LAB_ENGINE_CONFIG.dark?.background?.color).toBe(0x141414);
    expect(DEFAULT_LAB_ENGINE_CONFIG.dark?.stripes?.[0]?.color).toBe(0x261106);
    expect(DEFAULT_LAB_SETTINGS).toMatchObject({
      canvasWidth: 1400,
      canvasHeight: 998,
      textureId: "cf-base",
      textureSourceMode: "shader",
      shaderPresetId: "connect",
      stripePalette: "Background Ramp",
      backgroundRampEasing: "custom:0.417,0.335,0.58,0.911",
      thresholdDistributionEasing: "custom:0.431,0.147,0.556,0.409",
    });
  });

  it("imports exported settings files", () => {
    const text = serializeConfigFile({
      ...DEFAULT_ENGINE_CONFIG,
      grid: { ...DEFAULT_ENGINE_CONFIG.grid, gapX: 3, gapY: 4 },
    });

    const imported = importConfig(text);

    expect(imported.grid?.gapX).toBe(3);
    expect(imported.grid?.gapY).toBe(4);
  });

  it("imports exported lab UI settings when present", () => {
    const text = serializeConfigFile(DEFAULT_ENGINE_CONFIG, {
      canvasMode: "manual",
      canvasWidth: 1400,
      canvasHeight: 900,
      exportStartSec: 2,
      exportDurationSec: 4,
      exportSvgIncludeBackground: true,
      backgroundFillMode: "gradient",
      stripePalette: "Orange",
    });

    const imported = importSettingsFile(text);

    expect(imported.lab).toMatchObject({
      canvasMode: "manual",
      canvasWidth: 1400,
      canvasHeight: 900,
      exportStartSec: 2,
      exportDurationSec: 4,
      exportSvgIncludeBackground: true,
      backgroundFillMode: "gradient",
      stripePalette: "Orange",
    });
  });

  it("defaults exportSvgIncludeBackground to false", () => {
    expect(DEFAULT_LAB_SETTINGS.exportSvgIncludeBackground).toBe(false);
    expect(loadLabSettings().exportSvgIncludeBackground).toBe(false);
  });

  it("still imports raw engine config JSON", () => {
    const imported = importConfig(JSON.stringify({ grid: { cellWidth: 11 } }));

    expect(imported.grid?.cellWidth).toBe(11);
  });

  it("persists lab UI settings separately", () => {
    saveLabSettings({
      canvasMode: "manual",
      canvasScale: 4,
      canvasWidth: 1111,
      canvasHeight: 777,
      exportDurationSec: 12,
      backgroundColor: 0x112233,
    });

    expect(loadLabSettings()).toMatchObject({
      canvasMode: "manual",
      canvasScale: 4,
      canvasWidth: 1111,
      canvasHeight: 777,
      exportDurationSec: 12,
      backgroundColor: 0x112233,
    });
  });

  it("keeps Comet Logo controls out of local storage", () => {
    const customizedCometLogo = {
      ...COMET_LOGO_DEFAULTS,
      fireScale: 2.4,
      formationDuration: 4,
    };

    saveLabSettings({ cometLogo: customizedCometLogo });

    const stored = JSON.parse(localStorage.getItem("stripes-engine-lab-ui-settings") ?? "{}") as Record<
      string,
      unknown
    >;
    expect(stored).not.toHaveProperty("cometLogo");
    expect(loadLabSettings().cometLogo).toEqual(COMET_LOGO_DEFAULTS);

    localStorage.setItem("stripes-engine-lab-ui-settings", JSON.stringify({ cometLogo: customizedCometLogo }));
    expect(loadLabSettings().cometLogo).toEqual(COMET_LOGO_DEFAULTS);
  });

  it("retains current-session Comet Logo controls in explicit exports", () => {
    const customizedCometLogo = {
      ...COMET_LOGO_DEFAULTS,
      fireScale: 2.4,
      formationDuration: 4,
    };

    const exported = JSON.parse(serializeConfigFile(DEFAULT_ENGINE_CONFIG, { cometLogo: customizedCometLogo })) as {
      lab: { cometLogo: typeof customizedCometLogo };
    };

    expect(exported.lab.cometLogo).toMatchObject({
      fireScale: 2.4,
      formationDuration: 4,
    });
  });

  it("persists sidebar open state and widths", () => {
    saveLabSettings({
      textureSidebarOpen: false,
      shaderSidebarOpen: true,
      textureSidebarWidth: 280,
      shaderSidebarWidth: 420,
    });

    expect(loadLabSettings()).toMatchObject({
      textureSidebarOpen: false,
      shaderSidebarOpen: true,
      textureSidebarWidth: 280,
      shaderSidebarWidth: 420,
    });

    saveLabSettings({ textureSidebarWidth: 100, shaderSidebarWidth: 900 });
    expect(loadLabSettings()).toMatchObject({
      textureSidebarWidth: 240,
      shaderSidebarWidth: 640,
    });
  });

  it("does not persist canvas scale above the default 1x", () => {
    saveLabSettings({ canvasScale: 3 });

    expect(loadLabSettings().canvasScale).toBe(3);
    const exported = JSON.parse(serializeConfigFile(DEFAULT_ENGINE_CONFIG, { canvasScale: 3 })) as Record<
      string,
      unknown
    >;
    expect((exported.lab as Record<string, unknown>).canvasScale).toBe(3);
  });

  it("factory reset clears lab UI settings back to defaults", () => {
    saveLabSettings({ canvasMode: "manual", canvasWidth: 1111, backgroundColor: 0x334455 });

    factoryResetSettings();

    expect(loadLabSettings()).toEqual(DEFAULT_LAB_SETTINGS);
  });
});

describe("engine config persistence", () => {
  beforeEach(() => {
    stubLocalStorage();
    stubSessionStorage();
    resumePersistenceWritesForTests();
  });

  afterEach(() => {
    resumePersistenceWritesForTests();
    vi.unstubAllGlobals();
  });

  it("returns the lab defaults when nothing is stored", () => {
    expect(loadInitialConfig("tex-a")).toEqual(DEFAULT_LAB_ENGINE_CONFIG);
  });

  it("round-trips a per-texture config", () => {
    const config = { ...DEFAULT_LAB_ENGINE_CONFIG, fieldScale: 0.42 } as EngineConfig;
    saveConfig("tex-a", config);
    expect(loadInitialConfig("tex-a").fieldScale).toBe(0.42);
  });

  it("falls back to the last saved config for an unknown texture", () => {
    const config = { ...DEFAULT_LAB_ENGINE_CONFIG, fieldScale: 0.31 } as EngineConfig;
    saveConfig("tex-a", config);
    expect(loadInitialConfig("tex-b").fieldScale).toBe(0.31);
  });

  it("prefers a staged pending config over stored state", () => {
    saveConfig("tex-a", { ...DEFAULT_LAB_ENGINE_CONFIG, fieldScale: 0.31 } as EngineConfig);
    stagePendingConfig({ fieldScale: 0.77 });
    expect(loadInitialConfig("tex-a").fieldScale).toBe(0.77);
  });

  it("consumes the pending config exactly once", () => {
    saveConfig("tex-a", { ...DEFAULT_LAB_ENGINE_CONFIG, fieldScale: 0.31 } as EngineConfig);
    stagePendingConfig({ fieldScale: 0.77 });
    loadInitialConfig("tex-a");
    expect(loadInitialConfig("tex-a").fieldScale).toBe(0.31);
  });

  it("does not write after a factory reset until reload", () => {
    factoryResetSettings();
    saveConfig("tex-a", { ...DEFAULT_LAB_ENGINE_CONFIG, fieldScale: 0.42 } as EngineConfig);
    expect(localStorage.getItem("stripes-engine-lab-by-texture")).toBeNull();
  });

  it("factory reset clears an already-saved engine config", () => {
    const config = { ...DEFAULT_LAB_ENGINE_CONFIG, fieldScale: 0.42 } as EngineConfig;
    saveConfig("tex-a", config);
    expect(loadInitialConfig("tex-a").fieldScale).toBe(0.42);

    factoryResetSettings();

    expect(loadInitialConfig("tex-a")).toEqual(DEFAULT_LAB_ENGINE_CONFIG);
  });

  it("deletes a stored per-texture config", () => {
    saveConfig("tex-a", DEFAULT_LAB_ENGINE_CONFIG as EngineConfig);
    deleteConfig("tex-a");
    const raw = localStorage.getItem("stripes-engine-lab-by-texture");
    expect(raw === null || JSON.parse(raw)["tex-a"] === undefined).toBe(true);
  });

  it("does not stage a pending config once persistence writes are frozen by a factory reset", () => {
    factoryResetSettings();
    stagePendingConfig({
      ...DEFAULT_ENGINE_CONFIG,
      grid: { ...DEFAULT_ENGINE_CONFIG.grid, gapX: 7 },
    });

    expect(loadInitialConfig("tex-a")).toEqual(DEFAULT_LAB_ENGINE_CONFIG);
  });

  it("never sticks a background color across boots, even after picking one live", () => {
    saveStickyBackgroundColor(0x445566);

    expect(loadStickyBackgroundColor()).toBeNull();
    expect(loadInitialConfig("tex-a").background?.color).toBe(DEFAULT_LAB_ENGINE_CONFIG.background.color);

    clearStickyBackgroundColor();
    expect(loadStickyBackgroundColor()).toBeNull();
  });

  it("factory reset clears lab UI settings even though engine config persists", () => {
    saveLabSettings({ canvasMode: "manual", canvasWidth: 1111, backgroundColor: 0x334455 });

    factoryResetSettings();

    expect(loadLabSettings()).toEqual(DEFAULT_LAB_SETTINGS);
  });

  it("import-pristine flag is one-shot", () => {
    expect(consumeImportedConfigPristine()).toBe(false);
    markImportedConfigPristine();
    expect(consumeImportedConfigPristine()).toBe(true);
    expect(consumeImportedConfigPristine()).toBe(false);
  });
});

describe("themed configs", () => {
  beforeEach(() => {
    stubLocalStorage();
    stubSessionStorage();
    resumePersistenceWritesForTests();
  });

  afterEach(() => {
    resumePersistenceWritesForTests();
    vi.unstubAllGlobals();
  });

  it("saveConfig/loadInitialConfig round-trips the dark diff", () => {
    const themed = { ...DEFAULT_LAB_ENGINE_CONFIG, dark: { renderColorA: 0x101010 } };
    saveConfig("tex-1", themed);
    expect(loadInitialConfig("tex-1").dark).toEqual({ renderColorA: 0x101010 });
  });

  it("serializeConfigFile embeds dark inside config and importSettingsFile preserves it", () => {
    const themed = { ...DEFAULT_LAB_ENGINE_CONFIG, dark: { renderColorA: 0x101010 } };
    const text = serializeConfigFile(themed);
    const parsed = JSON.parse(text) as Record<string, unknown>;
    expect((parsed.config as Record<string, unknown>).dark).toEqual({ renderColorA: 0x101010 });
    expect(importSettingsFile(text).config.dark).toEqual({ renderColorA: 0x101010 });
  });

  it("import sanitizes dark to a valid sparse diff and drops junk keys", () => {
    const file = serializeConfigFile({
      ...DEFAULT_LAB_ENGINE_CONFIG,
      dark: { junk: 1, renderColorA: 0x101010 },
    } as never);
    expect(importSettingsFile(file).config.dark).toEqual({ renderColorA: 0x101010 });
  });

  it("legacy and light-only files import without a dark key", () => {
    const { dark: _dark, ...lightOnly } = DEFAULT_LAB_ENGINE_CONFIG;
    const file = serializeConfigFile(lightOnly);
    expect(importSettingsFile(file).config).not.toHaveProperty("dark");
  });

  it("edit theme persists and defaults to light", () => {
    expect(loadEditTheme()).toBe("light");
    saveEditTheme("dark");
    expect(loadEditTheme()).toBe("dark");
  });
});
