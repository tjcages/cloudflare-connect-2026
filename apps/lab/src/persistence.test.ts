import { DEFAULT_ENGINE_CONFIG } from "@necatikcl/stripes-engine";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  importSettingsFile,
  DEFAULT_LAB_SETTINGS,
  factoryResetSettings,
  loadInitialConfig,
  loadLabSettings,
  saveConfig,
  saveLabSettings,
  saveStickyBackgroundColor,
  serializeConfigFile,
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
}

describe("config file import/export", () => {
  beforeEach(() => {
    stubLocalStorage();
  });

  afterEach(() => {
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

    const imported = importSettingsFile(text).config;

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
      backgroundFillMode: "gradient",
      stripePalette: "Orange",
    });
  });

  it("still imports raw engine config JSON", () => {
    const imported = importSettingsFile(JSON.stringify({ grid: { cellWidth: 11 } })).config;

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

  it("does not persist canvas scale above the default 1x", () => {
    saveLabSettings({ canvasScale: 3 });

    expect(loadLabSettings().canvasScale).toBe(3);
    const exported = JSON.parse(serializeConfigFile(DEFAULT_ENGINE_CONFIG, { canvasScale: 3 })) as Record<
      string,
      unknown
    >;
    expect((exported.lab as Record<string, unknown>).canvasScale).toBe(3);
  });

  it("uses the last saved config as the fallback for new textures", () => {
    saveConfig("texture-a", {
      ...DEFAULT_ENGINE_CONFIG,
      grid: { ...DEFAULT_ENGINE_CONFIG.grid, gapX: 3, gapY: 4 },
    });

    const loaded = loadInitialConfig("new-upload");

    expect(loaded.grid?.gapX).toBe(3);
    expect(loaded.grid?.gapY).toBe(4);
  });

  it("keeps per-texture configs ahead of the global last-config fallback", () => {
    saveConfig("texture-a", {
      ...DEFAULT_ENGINE_CONFIG,
      grid: { ...DEFAULT_ENGINE_CONFIG.grid, gapX: 3 },
    });
    saveConfig("texture-b", {
      ...DEFAULT_ENGINE_CONFIG,
      grid: { ...DEFAULT_ENGINE_CONFIG.grid, gapX: 9 },
    });

    expect(loadInitialConfig("texture-a").grid?.gapX).toBe(3);
    expect(loadInitialConfig("new-upload").grid?.gapX).toBe(9);
  });

  it("keeps the last background color sticky across existing texture configs", () => {
    saveConfig("texture-a", {
      ...DEFAULT_ENGINE_CONFIG,
      background: { ...DEFAULT_ENGINE_CONFIG.background, color: 0x111111, transparent: false },
      grid: { ...DEFAULT_ENGINE_CONFIG.grid, gapX: 3 },
    });
    saveConfig("texture-b", {
      ...DEFAULT_ENGINE_CONFIG,
      background: { ...DEFAULT_ENGINE_CONFIG.background, color: 0x222222, transparent: false },
      grid: { ...DEFAULT_ENGINE_CONFIG.grid, gapX: 9 },
    });

    const loaded = loadInitialConfig("texture-a");

    expect(loaded.background?.color).toBe(0x222222);
    expect(loaded.grid?.gapX).toBe(3);
  });

  it("keeps sticky background when resetting a texture without updating sticky background", () => {
    saveConfig("texture-a", {
      ...DEFAULT_ENGINE_CONFIG,
      background: { ...DEFAULT_ENGINE_CONFIG.background, color: 0x334455, transparent: false },
      grid: { ...DEFAULT_ENGINE_CONFIG.grid, gapX: 3 },
    });
    saveConfig("texture-a", DEFAULT_ENGINE_CONFIG, { updateStickyBackground: false });

    const loaded = loadInitialConfig("texture-a");

    expect(loaded.background?.color).toBe(0x334455);
    expect(loaded.grid?.gapX).toBe(DEFAULT_ENGINE_CONFIG.grid.gapX);
  });

  it("applies sticky background even when there is no saved config for the texture", () => {
    saveLabSettings({ backgroundColor: 0x778899 });

    const loaded = loadInitialConfig("brand-new-texture");

    expect(loaded.background?.color).toBe(0x778899);
  });

  it("does not reset sticky background when saving partial lab settings", () => {
    saveLabSettings({ backgroundColor: 0x778899 });
    saveLabSettings({ canvasWidth: 1234 });

    expect(loadLabSettings().backgroundColor).toBe(0x778899);
    expect(loadInitialConfig("brand-new-texture").background?.color).toBe(0x778899);
  });

  it("prefers a non-default direct sticky background over default lab background on reload", () => {
    saveConfig("texture-a", {
      ...DEFAULT_ENGINE_CONFIG,
      background: { ...DEFAULT_ENGINE_CONFIG.background, color: 0x778899, transparent: false },
    });
    saveLabSettings({ backgroundColor: DEFAULT_ENGINE_CONFIG.background.color });

    expect(loadLabSettings().backgroundColor).toBe(0x778899);
    expect(loadInitialConfig("texture-a").background?.color).toBe(0x778899);
  });

  it("does not let an automatic default background config save clobber a non-default sticky background", () => {
    saveConfig("texture-a", {
      ...DEFAULT_ENGINE_CONFIG,
      background: { ...DEFAULT_ENGINE_CONFIG.background, color: 0x778899, transparent: false },
    });
    saveConfig("texture-a", {
      ...DEFAULT_ENGINE_CONFIG,
      background: { ...DEFAULT_ENGINE_CONFIG.background, color: DEFAULT_ENGINE_CONFIG.background.color },
    });

    expect(loadLabSettings().backgroundColor).toBe(0x778899);
    expect(loadInitialConfig("texture-a").background?.color).toBe(0x778899);
  });

  it("persists direct background picker changes immediately", () => {
    saveStickyBackgroundColor(0x445566);

    expect(loadLabSettings().backgroundColor).toBe(0x445566);
    expect(loadInitialConfig("texture-a").background?.color).toBe(0x445566);
  });

  it("keeps explicit picker background ahead of later automatic config saves", () => {
    saveStickyBackgroundColor(0x445566);
    saveConfig("texture-a", {
      ...DEFAULT_ENGINE_CONFIG,
      background: { ...DEFAULT_ENGINE_CONFIG.background, color: 0x112233 },
    });

    expect(loadLabSettings().backgroundColor).toBe(0x445566);
    expect(loadInitialConfig("texture-a").background?.color).toBe(0x445566);
  });

  it("does not let a default white bg query override a saved non-default background", () => {
    localStorage.setItem("stripes-engine-lab-last-background-color", String(0x778899));
    vi.stubGlobal("window", {
      location: { href: "http://127.0.0.1:5174/?bg=ffffff" },
      history: { replaceState: vi.fn() },
    });

    expect(loadLabSettings().backgroundColor).toBe(0x778899);
    expect(loadInitialConfig("texture-a").background?.color).toBe(0x778899);
  });

  it("ignores bg query params as a background source on refresh", () => {
    vi.stubGlobal("window", {
      location: { href: "http://127.0.0.1:5174/?bg=123456" },
      history: { replaceState: vi.fn() },
    });

    expect(loadLabSettings().backgroundColor).toBe(DEFAULT_LAB_SETTINGS.backgroundColor);
    expect(loadInitialConfig("texture-a").background?.color).toBe(DEFAULT_LAB_ENGINE_CONFIG.background.color);
  });

  it("does not let a stale default direct background override a saved non-default lab background", () => {
    saveLabSettings({ backgroundColor: 0x778899 });
    localStorage.setItem("stripes-engine-lab-last-background-color", String(DEFAULT_ENGINE_CONFIG.background.color));

    expect(loadLabSettings().backgroundColor).toBe(0x778899);
    expect(loadInitialConfig("texture-a").background?.color).toBe(0x778899);
  });

  it("recovers a non-default texture background when old sticky storage is corrupted to default white", () => {
    saveConfig("texture-a", {
      ...DEFAULT_ENGINE_CONFIG,
      background: { ...DEFAULT_ENGINE_CONFIG.background, color: 0x778899, transparent: false },
    });
    localStorage.setItem(
      "stripes-engine-lab-ui-settings",
      JSON.stringify({ ...loadLabSettings(), backgroundColor: DEFAULT_ENGINE_CONFIG.background.color }),
    );
    localStorage.setItem("stripes-engine-lab-last-background-color", String(DEFAULT_ENGINE_CONFIG.background.color));

    expect(loadInitialConfig("texture-a").background?.color).toBe(0x778899);
    expect(loadLabSettings().backgroundColor).toBe(0x778899);
  });

  it("factory reset clears saved configs and sticky background", () => {
    saveConfig("texture-a", {
      ...DEFAULT_ENGINE_CONFIG,
      background: { ...DEFAULT_ENGINE_CONFIG.background, color: 0x334455, transparent: false },
      grid: { ...DEFAULT_ENGINE_CONFIG.grid, gapX: 3 },
    });
    saveLabSettings({ canvasMode: "manual", canvasWidth: 1111, backgroundColor: 0x334455 });

    factoryResetSettings();

    expect(loadInitialConfig("texture-a")).toEqual(DEFAULT_LAB_ENGINE_CONFIG);
    expect(loadLabSettings()).toEqual(DEFAULT_LAB_SETTINGS);
  });
});
