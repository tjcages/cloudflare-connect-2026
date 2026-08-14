import type { ClientSizeUnit } from "./client/clientPresets";

export const SHARED_SIZE_PRESET_PREFIX = "shared:";

export type SharedSizePreset = {
  id: string;
  name: string;
  unit: ClientSizeUnit;
  width: number;
  height: number;
  ppi: number;
  createdAt: string;
  updatedAt: string;
};

export type SharedSizePresetInput = Pick<SharedSizePreset, "name" | "unit" | "width" | "height" | "ppi">;

export type SharedSizePresetStatus = "loading" | "ready" | "saving" | "deleting" | "error";

export type SharedSizePresetValidation = { ok: true; value: SharedSizePresetInput } | { ok: false; message: string };

export function sharedSizePresetId(id: string): `${typeof SHARED_SIZE_PRESET_PREFIX}${string}` {
  return `${SHARED_SIZE_PRESET_PREFIX}${id}`;
}

export function parseSharedSizePresetId(value: string): string | null {
  if (!value.startsWith(SHARED_SIZE_PRESET_PREFIX)) return null;
  const id = value.slice(SHARED_SIZE_PRESET_PREFIX.length).trim();
  return id || null;
}

export function resolveSharedSizeSelectorValue(
  value: string,
  presets: readonly SharedSizePreset[],
  status: SharedSizePresetStatus,
  customValue: string,
): string {
  if (status === "loading" || !value.startsWith(SHARED_SIZE_PRESET_PREFIX)) return value;
  return presets.some((preset) => sharedSizePresetId(preset.id) === value) ? value : customValue;
}

export function showSharedSizeActions(value: string, status: SharedSizePresetStatus, customValue: string): boolean {
  return (status === "ready" || status === "error") && value === customValue;
}

export function validateSharedSizePresetInput(input: unknown): SharedSizePresetValidation {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return { ok: false, message: "A size preset object is required." };
  }
  const record = input as Record<string, unknown>;
  const name = typeof record.name === "string" ? record.name.trim().replace(/\s+/g, " ") : "";
  if (!name) return { ok: false, message: "Name is required." };
  if (name.length > 80) return { ok: false, message: "Name must be 80 characters or fewer." };

  const unit = record.unit === "inches" ? "inches" : record.unit === "pixels" ? "pixels" : null;
  if (!unit) return { ok: false, message: "Unit must be pixels or inches." };

  const width = typeof record.width === "number" ? record.width : Number.NaN;
  const height = typeof record.height === "number" ? record.height : Number.NaN;
  const maxDimension = unit === "inches" ? 1000 : 8192;
  if (!Number.isFinite(width) || width <= 0 || width > maxDimension) {
    return { ok: false, message: `Width must be between 0 and ${maxDimension} ${unit}.` };
  }
  if (!Number.isFinite(height) || height <= 0 || height > maxDimension) {
    return { ok: false, message: `Height must be between 0 and ${maxDimension} ${unit}.` };
  }

  const ppi = typeof record.ppi === "number" ? Math.round(record.ppi) : Number.NaN;
  if (!Number.isFinite(ppi) || ppi < 1 || ppi > 1200) {
    return { ok: false, message: "PPI must be between 1 and 1200." };
  }
  return { ok: true, value: { name, unit, width, height, ppi } };
}
