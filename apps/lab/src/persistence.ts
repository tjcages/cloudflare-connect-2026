import { migrateLegacyConfig, parseEngineConfig } from "@necatikcl/stripes-engine";
import type { EngineConfig } from "@necatikcl/stripes-engine";

const NEW_KEY = "stripes-engine-lab"; // legacy: single global config (pre per-texture)
const OLD_KEY = "section-grid-playground"; // legacy v0
const MAP_KEY = "stripes-engine-lab-by-texture"; // per-texture configs, keyed by texture id
const TEXTURE_KEY = "stripes-engine-lab-texture";

function loadConfigMap(): Record<string, Partial<EngineConfig>> {
  try {
    const raw = localStorage.getItem(MAP_KEY);
    if (raw) return JSON.parse(raw) as Record<string, Partial<EngineConfig>>;
  } catch {
    /* ignore corrupt storage */
  }
  return {};
}

export function loadInitialConfig(textureId: string): Partial<EngineConfig> {
  try {
    const map = loadConfigMap();
    if (textureId in map) return map[textureId] ?? {};
    // Before any per-texture config exists, migrate the legacy single config
    // onto whichever texture loads first (the persisted / last-selected one).
    if (Object.keys(map).length === 0) {
      const fresh = localStorage.getItem(NEW_KEY);
      if (fresh) return JSON.parse(fresh) as Partial<EngineConfig>;
      const legacy = localStorage.getItem(OLD_KEY);
      if (legacy) return migrateLegacyConfig(JSON.parse(legacy));
    }
  } catch {
    /* ignore corrupt storage */
  }
  return {};
}

export function saveConfig(textureId: string, c: EngineConfig): void {
  try {
    const map = loadConfigMap();
    map[textureId] = c;
    localStorage.setItem(MAP_KEY, JSON.stringify(map));
  } catch {
    /* ignore quota errors */
  }
}

export function deleteConfig(textureId: string): void {
  try {
    const map = loadConfigMap();
    if (textureId in map) {
      delete map[textureId];
      localStorage.setItem(MAP_KEY, JSON.stringify(map));
    }
  } catch {
    /* ignore */
  }
}

export function loadTextureId(): string | null {
  try {
    return localStorage.getItem(TEXTURE_KEY);
  } catch {
    return null;
  }
}

export function saveTextureId(id: string): void {
  try {
    localStorage.setItem(TEXTURE_KEY, id);
  } catch {
    /* ignore quota errors */
  }
}

export function importConfig(text: string): Partial<EngineConfig> {
  const parsed = JSON.parse(text) as Record<string, unknown>;
  const looksLegacy = "textureAdjustments" in parsed || "sourceTransform" in parsed || "textureLuminanceMode" in parsed;
  if (looksLegacy) return migrateLegacyConfig(parsed);
  return parseEngineConfig(text);
}
