import type { ThemedEngineConfig } from "@necatikcl/stripes-engine";
import type { LabSettings } from "./persistence";

const PRESET_KIND = "stripes-engine-lab-settings";
const PRESET_VERSION = 2;

export interface ConfigPreset {
  name: string;
  kind: typeof PRESET_KIND;
  version: number;
  config: ThemedEngineConfig;
  lab?: Partial<LabSettings>;
}

const PRESETS_KEY = "stripes-engine-lab-presets";

export function createPreset(name: string, config: ThemedEngineConfig, lab?: Partial<LabSettings>): ConfigPreset {
  return {
    name,
    kind: PRESET_KIND,
    version: PRESET_VERSION,
    config,
    ...(lab ? { lab } : {}),
  };
}

export function addPreset(presets: ConfigPreset[], preset: ConfigPreset): ConfigPreset[] {
  return [...presets.filter((p) => p.name !== preset.name), preset];
}

export function removePreset(presets: ConfigPreset[], name: string): ConfigPreset[] {
  return presets.filter((p) => p.name !== name);
}

export function loadPresets(): ConfigPreset[] {
  try {
    const raw = localStorage.getItem(PRESETS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((item) => {
        if (!item || typeof item !== "object") return null;
        const record = item as Partial<ConfigPreset>;
        if (typeof record.name !== "string" || !record.config) return null;
        return createPreset(record.name, record.config, record.lab);
      })
      .filter((preset): preset is ConfigPreset => preset !== null);
  } catch {
    return [];
  }
}

export function savePresets(presets: ConfigPreset[]): void {
  try {
    localStorage.setItem(PRESETS_KEY, JSON.stringify(presets));
  } catch {
    /* ignore quota errors */
  }
}
