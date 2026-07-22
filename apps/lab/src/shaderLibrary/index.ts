import { DEFAULT_SHADER_TEXTURE_SOURCE } from "../defaultShaderTextureSource";
import { CONNECT_SHADER_TEXTURE_SOURCE } from "../connectShaderTextureSource";

export type ShaderLibraryEntry = {
  id: string;
  label: string;
  source: string;
};

type SavedShaderFile = {
  id?: unknown;
  label?: unknown;
  source?: unknown;
  createdAt?: unknown;
};

export const CONNECT_SHADER_PRESET_ID = "connect";
export const SPIRAL_SHADER_PRESET_ID = "spiral";
export const NEBULA_SHADER_PRESET_ID = "nebula";
export const DEFAULT_SHADER_PRESET_ID = CONNECT_SHADER_PRESET_ID;
export const CUSTOM_SHADER_PRESET_ID = "custom";

const savedModules = import.meta.glob("./saved/*.json", {
  eager: true,
  import: "default",
}) as Record<string, SavedShaderFile>;

function normalizeSavedEntry(value: SavedShaderFile): ShaderLibraryEntry | null {
  const id = typeof value.id === "string" ? value.id.trim() : "";
  const label = typeof value.label === "string" ? value.label.trim() : "";
  const source = typeof value.source === "string" ? value.source : "";
  if (!id || !label || !source.trim()) return null;
  return { id, label, source };
}

const savedEntries = Object.values(savedModules)
  .map(normalizeSavedEntry)
  .filter((entry): entry is ShaderLibraryEntry => entry !== null)
  .sort((a, b) => a.label.localeCompare(b.label) || a.id.localeCompare(b.id));

export const CONNECT_SHADER_LIBRARY_ENTRY: ShaderLibraryEntry = {
  id: CONNECT_SHADER_PRESET_ID,
  label: "Connect",
  source: CONNECT_SHADER_TEXTURE_SOURCE,
};

export const SPIRAL_SHADER_LIBRARY_ENTRY: ShaderLibraryEntry = {
  id: SPIRAL_SHADER_PRESET_ID,
  label: "Spiral",
  source: "",
};

export const NEBULA_SHADER_LIBRARY_ENTRY: ShaderLibraryEntry = {
  id: NEBULA_SHADER_PRESET_ID,
  label: "Nebula",
  source: DEFAULT_SHADER_TEXTURE_SOURCE,
};

/** Connect first (default), then Spiral, Nebula, and saved library shaders. */
export const SHADER_LIBRARY: readonly ShaderLibraryEntry[] = [
  CONNECT_SHADER_LIBRARY_ENTRY,
  SPIRAL_SHADER_LIBRARY_ENTRY,
  NEBULA_SHADER_LIBRARY_ENTRY,
  ...savedEntries,
];

const ENTRY_BY_ID = new Map(SHADER_LIBRARY.map((entry) => [entry.id, entry]));

export function isSpiralShaderPreset(id: string): boolean {
  return id === SPIRAL_SHADER_PRESET_ID;
}

export function findShaderLibraryEntry(id: string): ShaderLibraryEntry | undefined {
  return ENTRY_BY_ID.get(id);
}

export function findShaderPresetIdBySource(source: string, preferredPresetId?: string | null): string {
  if (preferredPresetId && isSpiralShaderPreset(preferredPresetId)) return SPIRAL_SHADER_PRESET_ID;
  const normalized = source.trim();
  if (!normalized) {
    return preferredPresetId === SPIRAL_SHADER_PRESET_ID ? SPIRAL_SHADER_PRESET_ID : CUSTOM_SHADER_PRESET_ID;
  }
  if (normalized === DEFAULT_SHADER_TEXTURE_SOURCE.trim()) return NEBULA_SHADER_PRESET_ID;
  const match = SHADER_LIBRARY.find(
    (entry) => entry.id !== SPIRAL_SHADER_PRESET_ID && entry.source.trim() === normalized,
  );
  return match?.id ?? CUSTOM_SHADER_PRESET_ID;
}
