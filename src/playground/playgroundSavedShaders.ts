/**
 * User-saved custom shader equations. Built-in presets live in {@link ./playgroundShaderSource},
 * while these are arbitrary edited equations the designer chose to keep so they can be recovered
 * later. They surface in the shader Preset dropdown next to the built-in presets.
 */

// Type-only import: avoids a runtime cycle with playgroundPersistence (which imports this module
// for normalization). A saved shader can carry a full look snapshot (colors, sizing, zoom, etc.).
import type { PlaygroundPersistedConfig } from "./playgroundPersistence";

export type PlaygroundSavedShader = {
  /** Stable id used for the dropdown value, dedupe, and delete. */
  id: string;
  /** Display name shown in the Preset dropdown. */
  label: string;
  /** ShaderToy-style mainImage body. */
  source: string;
  /** Creation timestamp; used to order the list oldest-first. */
  createdAt: number;
  /**
   * Optional full-look snapshot captured at save time (stripes, canvas size, zoom/transform, tone,
   * grid, effects). Restored when the shader is selected. Omitted for shaders saved before this
   * existed — those just restore the equation.
   */
  config?: PlaygroundPersistedConfig;
};

/** Preset dropdown values for saved shaders are namespaced to avoid clashing with built-in ids. */
export const SAVED_SHADER_PRESET_PREFIX = "saved:";

export function savedShaderPresetId(id: string): string {
  return `${SAVED_SHADER_PRESET_PREFIX}${id}`;
}

/** Return the saved-shader id when `presetId` is a saved-shader dropdown value, else null. */
export function parseSavedShaderPresetId(presetId: string): string | null {
  return presetId.startsWith(SAVED_SHADER_PRESET_PREFIX) ? presetId.slice(SAVED_SHADER_PRESET_PREFIX.length) : null;
}

export const SAVED_SHADER_LABEL_MAX_LENGTH = 60;

export function normalizeSavedShaderLabel(raw: unknown): string {
  const text = typeof raw === "string" ? raw.trim().replace(/\s+/g, " ") : "";
  if (text.length === 0) {
    return "Saved shader";
  }
  return text.slice(0, SAVED_SHADER_LABEL_MAX_LENGTH);
}

export function normalizeSavedShader(raw: unknown): PlaygroundSavedShader | null {
  if (!raw || typeof raw !== "object") {
    return null;
  }
  const entry = raw as Partial<PlaygroundSavedShader>;
  const source = typeof entry.source === "string" ? entry.source : "";
  if (source.trim().length === 0) {
    return null;
  }
  const id = typeof entry.id === "string" && entry.id.length > 0 ? entry.id : createSavedShaderId();
  const createdAt =
    typeof entry.createdAt === "number" && Number.isFinite(entry.createdAt) ? entry.createdAt : Date.now();
  const config = entry.config && typeof entry.config === "object" ? entry.config : undefined;
  return {
    id,
    label: normalizeSavedShaderLabel(entry.label),
    source,
    createdAt,
    ...(config ? { config } : {}),
  };
}

export function normalizeSavedShaders(raw: unknown): PlaygroundSavedShader[] {
  if (!Array.isArray(raw)) {
    return [];
  }
  const seen = new Set<string>();
  const result: PlaygroundSavedShader[] = [];
  for (const item of raw) {
    const normalized = normalizeSavedShader(item);
    if (!normalized || seen.has(normalized.id)) {
      continue;
    }
    seen.add(normalized.id);
    result.push(normalized);
  }
  return result;
}

let savedShaderIdCounter = 0;

export function createSavedShaderId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  savedShaderIdCounter += 1;
  return `shader-${Date.now().toString(36)}-${savedShaderIdCounter}`;
}

/**
 * Merge incoming saved shaders into an existing list. Entries matching an existing id are replaced;
 * entries whose (label, source) already exist under a different id are skipped so repeated imports
 * do not pile up duplicates. Order is preserved with existing entries first.
 */
export function mergeSavedShaderLists(
  existing: readonly PlaygroundSavedShader[],
  incoming: readonly PlaygroundSavedShader[],
): PlaygroundSavedShader[] {
  const byId = new Map<string, PlaygroundSavedShader>();
  const order: string[] = [];
  for (const entry of existing) {
    if (!byId.has(entry.id)) {
      order.push(entry.id);
    }
    byId.set(entry.id, entry);
  }
  const fingerprint = (entry: PlaygroundSavedShader) => `${entry.label}\u0000${entry.source.trim()}`;
  const fingerprints = new Set(existing.map(fingerprint));
  for (const entry of incoming) {
    if (byId.has(entry.id)) {
      byId.set(entry.id, entry);
      continue;
    }
    if (fingerprints.has(fingerprint(entry))) {
      continue;
    }
    byId.set(entry.id, entry);
    order.push(entry.id);
    fingerprints.add(fingerprint(entry));
  }
  return order.map((id) => byId.get(id)!).filter(Boolean);
}

/** Resolve the saved shader whose source matches `source` (trimmed), if any. */
export function findSavedShaderBySource(
  savedShaders: readonly PlaygroundSavedShader[],
  source: string,
): PlaygroundSavedShader | undefined {
  const trimmed = source.trim();
  return savedShaders.find((entry) => entry.source.trim() === trimmed);
}
