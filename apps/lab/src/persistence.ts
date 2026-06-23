import { migrateLegacyConfig, parseEngineConfig } from "@necatikcl/stripes-engine";
import type { EngineConfig } from "@necatikcl/stripes-engine";

const NEW_KEY = "stripes-engine-lab";
const OLD_KEY = "section-grid-playground";

export function loadInitialConfig(): Partial<EngineConfig> {
  try {
    const fresh = localStorage.getItem(NEW_KEY);
    if (fresh) return JSON.parse(fresh) as Partial<EngineConfig>;
    const legacy = localStorage.getItem(OLD_KEY);
    if (legacy) return migrateLegacyConfig(JSON.parse(legacy));
  } catch {
    /* ignore corrupt storage */
  }
  return {};
}

export function saveConfig(c: EngineConfig): void {
  try {
    localStorage.setItem(NEW_KEY, JSON.stringify(c));
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
