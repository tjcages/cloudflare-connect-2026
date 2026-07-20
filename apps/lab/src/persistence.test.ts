import { DEFAULT_ENGINE_CONFIG } from "@necatikcl/stripes-engine";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  clearStickyBackgroundColor,
  consumeImportedConfigPristine,
  importConfig,
  importSettingsFile,
  DEFAULT_LAB_SETTINGS,
  factoryResetSettings,
  loadInitialConfig,
  loadLabSettings,
  loadStickyBackgroundColor,
  markImportedConfigPristine,
  resumePersistenceWritesForTests,
  saveLabSettings,
  saveStickyBackgroundColor,
  serializeConfigFile,
  stagePendingConfig,
} from "./persistence";
import type { EngineConfig } from "@necatikcl/stripes-engine";
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

describe("engine config never persists across a boot", () => {
  beforeEach(() => {
    stubLocalStorage();
    stubSessionStorage();
  });

  afterEach(() => {
    resumePersistenceWritesForTests();
    vi.unstubAllGlobals();
  });

  it("always boots from the default engine config when nothing is staged", () => {
    expect(loadInitialConfig()).toEqual(DEFAULT_LAB_ENGINE_CONFIG);
  });

  it("ignores stale legacy per-texture / last-config / sticky-background keys and removes them", () => {
    localStorage.setItem("stripes-engine-lab-by-texture", JSON.stringify({ "texture-a": { grid: { gapX: 3 } } }));
    localStorage.setItem("stripes-engine-lab-last-config", JSON.stringify({ grid: { gapX: 9 } }));
    localStorage.setItem("stripes-engine-lab-last-background-color", String(0x778899));

    expect(loadInitialConfig()).toEqual(DEFAULT_LAB_ENGINE_CONFIG);
    expect(localStorage.getItem("stripes-engine-lab-by-texture")).toBeNull();
    expect(localStorage.getItem("stripes-engine-lab-last-config")).toBeNull();
    expect(localStorage.getItem("stripes-engine-lab-last-background-color")).toBeNull();
  });

  it("applies a staged pending config exactly once, then reverts to default", () => {
    const staged: EngineConfig = {
      ...DEFAULT_ENGINE_CONFIG,
      grid: { ...DEFAULT_ENGINE_CONFIG.grid, gapX: 7 },
    };
    stagePendingConfig(staged);

    expect(loadInitialConfig().grid?.gapX).toBe(7);
    expect(loadInitialConfig()).toEqual(DEFAULT_LAB_ENGINE_CONFIG);
  });

  it("does not stage a pending config once persistence writes are frozen by a factory reset", () => {
    factoryResetSettings();
    stagePendingConfig({
      ...DEFAULT_ENGINE_CONFIG,
      grid: { ...DEFAULT_ENGINE_CONFIG.grid, gapX: 7 },
    });

    expect(loadInitialConfig()).toEqual(DEFAULT_LAB_ENGINE_CONFIG);
  });

  it("factory reset clears saved configs and sticky background", () => {
    saveLabSettings({ canvasMode: "manual", canvasWidth: 1111, backgroundColor: 0x334455 });

    factoryResetSettings();

    expect(loadInitialConfig()).toEqual(DEFAULT_LAB_ENGINE_CONFIG);
    expect(loadLabSettings()).toEqual(DEFAULT_LAB_SETTINGS);
  });

  it("never sticks a background color across boots, even after picking one live", () => {
    saveStickyBackgroundColor(0x445566);

    expect(loadStickyBackgroundColor()).toBeNull();
    expect(loadInitialConfig().background?.color).toBe(DEFAULT_LAB_ENGINE_CONFIG.background.color);

    clearStickyBackgroundColor();
    expect(loadStickyBackgroundColor()).toBeNull();
  });

  it("import-pristine flag is one-shot", () => {
    expect(consumeImportedConfigPristine()).toBe(false);
    markImportedConfigPristine();
    expect(consumeImportedConfigPristine()).toBe(true);
    expect(consumeImportedConfigPristine()).toBe(false);
  });
});
