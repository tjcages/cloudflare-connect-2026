import {
  applyPresetToStorage,
  findPresetByName,
  loadBuiltinPresets,
  loadPresets,
  type ConfigPreset,
} from "../presets";

const ACTIVE_CLIENT_LAYOUT_KEY = "stripes-engine-client-active-layout";
const BOOT_PRESET_KEY = "stripes-engine-lab-boot-preset";

/** Remember which named layout the client preview should restore next boot. */
export function loadActiveClientLayoutName(): string | null {
  try {
    const name = localStorage.getItem(ACTIVE_CLIENT_LAYOUT_KEY);
    return name && name.trim() ? name.trim() : null;
  } catch {
    return null;
  }
}

export function saveActiveClientLayoutName(name: string | null): void {
  try {
    if (!name || !name.trim()) {
      localStorage.removeItem(ACTIVE_CLIENT_LAYOUT_KEY);
      return;
    }
    localStorage.setItem(ACTIVE_CLIENT_LAYOUT_KEY, name.trim());
  } catch {
    /* ignore quota */
  }
}

/** User-authored presets only (excludes builtins like Banner 5:1). */
export function listSavedLayouts(presets: readonly ConfigPreset[] = loadPresets()): ConfigPreset[] {
  return presets.filter((preset) => !preset.builtin).sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Resolve the layout to apply on client boot:
 * 1. `?preset=` query (one-shot)
 * 2. Last active saved layout
 * 3. Banner 5:1 builtin
 */
export function resolveClientBootPreset(): ConfigPreset | undefined {
  try {
    const url = new URL(window.location.href);
    const queryName = url.searchParams.get("preset");
    if (queryName) {
      const fromQuery = findPresetByName(loadPresets(), queryName);
      if (fromQuery) {
        url.searchParams.delete("preset");
        window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
        return fromQuery;
      }
    }
  } catch {
    /* ignore */
  }

  const activeName = loadActiveClientLayoutName();
  if (activeName) {
    const active = findPresetByName(loadPresets(), activeName);
    if (active) return active;
  }

  return findPresetByName(loadBuiltinPresets(), "Banner 5:1");
}

/** Apply a layout into storage and mark it as the active client layout. */
export function applyClientLayout(preset: ConfigPreset, textureId?: string): void {
  applyPresetToStorage(preset, textureId);
  saveActiveClientLayoutName(preset.name);
  try {
    sessionStorage.setItem(BOOT_PRESET_KEY, preset.name);
  } catch {
    /* ignore */
  }
}
