/**
 * Section-grid rain = this repo’s factoryDefaults (`DEFAULT_LAB_ENGINE_CONFIG` +
 * `DEFAULT_LAB_SETTINGS`). Same blob Factory reset / lab boot use — the
 * section-grid-generator lineage already in-tree.
 *
 * Do not hand-roll Leva key patches. Apply the factory config the same way
 * presets do: stagePendingConfig + saveLabSettings (+ reload).
 */
import type { ThemedEngineConfig } from "@necatikcl/stripes-engine";
import { DEFAULT_LAB_ENGINE_CONFIG } from "../defaultLabConfig";
import { DEFAULT_LAB_SETTINGS, type LabSettings } from "../persistence";
import { applyPresetToStorage, createPreset, type ConfigPreset } from "../presets";
import { clientGraphicFlags, type ClientGraphicMode } from "./clientPresets";

export type SectionGridRainGraphicMode = Extract<ClientGraphicMode, "rain" | "both">;

/** Factory engine with rain layer armed for client Graphic seeding. */
export function sectionGridRainEngineConfig(): ThemedEngineConfig {
  const config = structuredClone(DEFAULT_LAB_ENGINE_CONFIG) as ThemedEngineConfig & {
    sparkle?: { gaps?: { enabled?: boolean; coverage?: number; speed?: number } };
  };
  if (!config.sparkle) config.sparkle = {};
  if (!config.sparkle.gaps) config.sparkle.gaps = { enabled: true, coverage: 0, speed: 1 };
  // Client seeds Hero → Graphic from sparkle.gaps.enabled.
  config.sparkle.gaps.enabled = true;
  return config;
}

export function sectionGridRainStripes() {
  return structuredClone(DEFAULT_LAB_ENGINE_CONFIG.stripes);
}

/**
 * Build a preset from factoryDefaults — identical source as Factory reset,
 * with Graphic-mode flags for Rain / Both.
 */
export function buildSectionGridRainPreset(
  mode: SectionGridRainGraphicMode,
  keep?: Partial<Pick<LabSettings, "canvasWidth" | "canvasHeight" | "clientSizeId" | "backgroundColor">>,
): ConfigPreset {
  const flags = clientGraphicFlags(mode);
  const config = sectionGridRainEngineConfig();
  const lab: Partial<LabSettings> = {
    ...DEFAULT_LAB_SETTINGS,
    ...keep,
    textureSourceMode: "shader",
    shaderPresetId: DEFAULT_LAB_SETTINGS.shaderPresetId || "connect",
    twizzlerEnabled: flags.twizzlerEnabled,
    // Client Rain authoring uses texture sidebar (Camera / Tone) + shader sidebar.
    textureSidebarOpen: true,
    shaderSidebarOpen: true,
  };
  return createPreset(mode === "both" ? "Section-grid Rain + Twizzler" : "Section-grid Rain", config, lab, true);
}

/** Same storage path as Apply layout / Factory reset. Caller reloads. */
export function applySectionGridRainToStorage(
  mode: SectionGridRainGraphicMode,
  textureId: string,
  keep?: Partial<Pick<LabSettings, "canvasWidth" | "canvasHeight" | "clientSizeId" | "backgroundColor">>,
): void {
  applyPresetToStorage(buildSectionGridRainPreset(mode, keep), textureId);
}
