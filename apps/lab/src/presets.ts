import type { ThemedEngineConfig } from "@necatikcl/stripes-engine";
import { saveControlDrawerSnapshot } from "./controls/drawerState";
import type { LabSettings } from "./persistence";
import { loadTextureId, saveConfig, saveLabSettings, stagePendingConfig } from "./persistence";

const PRESET_KIND = "stripes-engine-lab-settings";
const PRESET_VERSION = 2;

export interface ConfigPreset {
  name: string;
  kind: typeof PRESET_KIND;
  version: number;
  config: ThemedEngineConfig;
  lab?: Partial<LabSettings>;
  builtin?: boolean;
}

const PRESETS_KEY = "stripes-engine-lab-presets";
const BOOT_PRESET_KEY = "stripes-engine-lab-boot-preset";

type BuiltinPresetFile = {
  name?: unknown;
  config?: unknown;
  lab?: unknown;
};

const builtinModules = import.meta.glob("./presets/builtin/*.json", {
  eager: true,
  import: "default",
}) as Record<string, BuiltinPresetFile>;

export function createPreset(
  name: string,
  config: ThemedEngineConfig,
  lab?: Partial<LabSettings>,
  builtin = false,
): ConfigPreset {
  return {
    name,
    kind: PRESET_KIND,
    version: PRESET_VERSION,
    config,
    ...(lab ? { lab } : {}),
    ...(builtin ? { builtin: true } : {}),
  };
}

export function addPreset(presets: ConfigPreset[], preset: ConfigPreset): ConfigPreset[] {
  return [...presets.filter((p) => p.name !== preset.name), preset];
}

export function removePreset(presets: ConfigPreset[], name: string): ConfigPreset[] {
  return presets.filter((p) => p.name !== name || p.builtin);
}

export function findPresetByName(presets: readonly ConfigPreset[], name: string): ConfigPreset | undefined {
  const normalized = name.trim().toLocaleLowerCase();
  return presets.find((preset) => preset.name.trim().toLocaleLowerCase() === normalized);
}

function normalizeStoredPreset(item: unknown): ConfigPreset | null {
  if (!item || typeof item !== "object") return null;
  const record = item as Partial<ConfigPreset>;
  if (typeof record.name !== "string" || !record.config) return null;
  return createPreset(record.name, record.config as ThemedEngineConfig, record.lab, false);
}

export function loadBuiltinPresets(): ConfigPreset[] {
  return Object.values(builtinModules)
    .map((file) => {
      if (!file || typeof file !== "object") return null;
      if (typeof file.name !== "string" || !file.config) return null;
      return createPreset(
        file.name,
        file.config as ThemedEngineConfig,
        file.lab as Partial<LabSettings> | undefined,
        true,
      );
    })
    .filter((preset): preset is ConfigPreset => preset !== null)
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function mergePresets(builtin: readonly ConfigPreset[], stored: readonly ConfigPreset[]): ConfigPreset[] {
  const byName = new Map<string, ConfigPreset>();
  for (const preset of stored) {
    byName.set(preset.name.trim().toLocaleLowerCase(), preset);
  }
  // Builtin names win / stay restore-safe.
  for (const preset of builtin) {
    byName.set(preset.name.trim().toLocaleLowerCase(), preset);
  }
  return [...byName.values()].sort((a, b) => {
    if (a.builtin !== b.builtin) return a.builtin ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
}

export function loadStoredPresets(): ConfigPreset[] {
  try {
    const raw = localStorage.getItem(PRESETS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.map(normalizeStoredPreset).filter((preset): preset is ConfigPreset => preset !== null);
  } catch {
    return [];
  }
}

export function loadPresets(): ConfigPreset[] {
  return mergePresets(loadBuiltinPresets(), loadStoredPresets());
}

export function loadDefaultPreset(): ConfigPreset | undefined {
  return findPresetByName(loadPresets(), "default");
}

export function savePresets(presets: ConfigPreset[]): void {
  try {
    const storedOnly = presets.filter((preset) => !preset.builtin).map(({ builtin: _builtin, ...rest }) => rest);
    localStorage.setItem(PRESETS_KEY, JSON.stringify(storedOnly));
  } catch {
    /* ignore quota errors */
  }
}

function preparePresetConfig(config: ThemedEngineConfig, builtin = false): ThemedEngineConfig {
  // Builtin banner presets must win Frames debug + opaque fill or the still
  // looks nothing like the ref. User-authored layouts keep their saved values.
  if (!builtin) return structuredClone(config) as ThemedEngineConfig;
  const next = structuredClone(config) as ThemedEngineConfig & {
    background?: { color?: number; transparent?: boolean };
    frames?: { enabled?: boolean };
  };
  if (next.frames) next.frames.enabled = false;
  if (next.background) {
    next.background.transparent = false;
    if (typeof next.background.color !== "number") next.background.color = 0xffffff;
  }
  return next;
}

export function applyPresetToStorage(preset: ConfigPreset, textureId = loadTextureId() ?? "cf-base"): void {
  if (preset.config) {
    const config = preparePresetConfig(preset.config as ThemedEngineConfig, preset.builtin === true);
    stagePendingConfig(config);
    saveConfig(textureId, config);
  }
  if (preset.lab) {
    saveLabSettings({
      ...preset.lab,
      textureId,
      ...(preset.lab.backgroundColor !== undefined ? { backgroundColor: preset.lab.backgroundColor } : {}),
      ...(preset.lab.backgroundFillMode !== undefined ? { backgroundFillMode: preset.lab.backgroundFillMode } : {}),
    });
    if (preset.lab.drawerOpen) saveControlDrawerSnapshot(preset.lab.drawerOpen);
  }
}

/** One-shot URL apply: `?preset=Banner%205:1` loads a builtin/stored preset then strips the param. */
export function consumePresetQuery(): void {
  try {
    const url = new URL(window.location.href);
    const name = url.searchParams.get("preset");
    if (!name) return;
    const preset = findPresetByName(loadPresets(), name);
    if (!preset) return;
    applyPresetToStorage(preset);
    sessionStorage.setItem(BOOT_PRESET_KEY, preset.name);
    url.searchParams.delete("preset");
    window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
  } catch {
    /* ignore */
  }
}

export function consumeBootPresetName(): string | null {
  try {
    const name = sessionStorage.getItem(BOOT_PRESET_KEY);
    sessionStorage.removeItem(BOOT_PRESET_KEY);
    return name;
  } catch {
    return null;
  }
}
