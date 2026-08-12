import { hasStoredEngineConfig } from "../persistence";
import { applyPresetToStorage, findPresetByName, loadBuiltinPresets, loadPresets, type ConfigPreset } from "../presets";

const ACTIVE_CLIENT_LAYOUT_KEY = "stripes-engine-client-active-layout";
const BOOT_PRESET_KEY = "stripes-engine-lab-boot-preset";

/** Remember which named layout was last applied (UI selection only — not reapplied on refresh). */
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

export function loadBannerLayout(): ConfigPreset | undefined {
  return findPresetByName(loadBuiltinPresets(), "Banner 5:1");
}

/**
 * Resolve a layout to force-apply on client boot:
 * 1. `?preset=` query (one-shot)
 * 2. Nothing — keep live localStorage config/lab (refresh persistence)
 * 3. Banner 5:1 only on first visit (no stored engine config yet)
 *
 * Named "active" layouts are NOT re-applied on refresh; that wiped unsaved knobs.
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

  if (hasStoredEngineConfig()) return undefined;

  return loadBannerLayout();
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
