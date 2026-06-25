import type { EngineConfig } from "@necatikcl/stripes-engine";

export interface ConfigPreset {
  name: string;
  config: EngineConfig;
}

const PRESETS_KEY = "stripes-engine-lab-presets";

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
    return Array.isArray(parsed) ? (parsed as ConfigPreset[]) : [];
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
