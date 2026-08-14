import type { ThemedEngineConfig } from "@necatikcl/stripes-engine";
import type { ClientSizeUnit } from "./client/clientPresets";
import type { LabSettings } from "./persistence";
import { createPreset, type ConfigPreset } from "./presets";
import type { SharedSizePreset, SharedSizePresetInput } from "./sharedSizePresets";

export const SHARED_PRESET_SCHEMA_VERSIONS = {
  size: 1,
  layout: 2,
  style: 1,
  color: 1,
} as const;

export const MAX_SHARED_PRESET_PAYLOAD_BYTES = 256 * 1024;

export type SharedPresetKind = keyof typeof SHARED_PRESET_SCHEMA_VERSIONS;

export type SharedSizePresetPayload = {
  unit: ClientSizeUnit;
  width: number;
  height: number;
  ppi: number;
};

/** A complete named layout. Applying it copies this snapshot into local working state. */
export type SharedLayoutPresetPayload = {
  config: ThemedEngineConfig;
  lab?: Partial<LabSettings>;
};

/** A reusable visual snapshot that deliberately does not include local UI state. */
export type SharedStylePresetPayload = {
  config: ThemedEngineConfig;
  lab?: Partial<LabSettings>;
};

export type SharedColorPresetPayload = {
  stripePalette: string | null;
  twizzler: {
    color: string;
    colorFar: string;
    colorNear: string;
    colorEdge: string;
  };
  backgroundColor?: number | null;
  stripeColors?: number[];
  darkStripeColors?: number[];
  darkBackgroundColor?: number | null;
};

export const LOCAL_WORKSPACE_LAB_KEYS = [
  "drawerOpen",
  "previewZoom",
  "textureSidebarOpen",
  "shaderSidebarOpen",
  "textureSidebarWidth",
  "shaderSidebarWidth",
  "exportStartSec",
  "exportDurationSec",
  "exportSvgIncludeBackground",
] as const satisfies readonly (keyof LabSettings)[];

export const STYLE_EXCLUDED_LAB_KEYS = [
  ...LOCAL_WORKSPACE_LAB_KEYS,
  "canvasMode",
  "canvasScale",
  "canvasWidth",
  "canvasHeight",
  "canvasAspectLocked",
  "clientSizeId",
  "clientSizeUnit",
  "clientSizePpi",
  "clientSizeWidth",
  "clientSizeHeight",
] as const satisfies readonly (keyof LabSettings)[];

function omitLabKeys(
  lab: Partial<LabSettings> | undefined,
  keys: readonly (keyof LabSettings)[],
): Partial<LabSettings> | undefined {
  if (!lab) return undefined;
  const copy = structuredClone(lab) as Record<string, unknown>;
  for (const key of keys) delete copy[key];
  return copy as Partial<LabSettings>;
}

function preserveLabKeys(
  incoming: Partial<LabSettings> | undefined,
  current: Partial<LabSettings>,
  keys: readonly (keyof LabSettings)[],
): Partial<LabSettings> {
  const merged = { ...(incoming ? structuredClone(incoming) : {}) } as Record<string, unknown>;
  const local = current as unknown as Record<string, unknown>;
  for (const key of keys) {
    if (key in local) merged[key] = structuredClone(local[key]);
  }
  return merged as Partial<LabSettings>;
}

export function sharedLayoutLabFromSnapshot(lab: Partial<LabSettings>): Partial<LabSettings> {
  return omitLabKeys(lab, LOCAL_WORKSPACE_LAB_KEYS) ?? {};
}

export function mergeSharedLayoutLab(
  lab: Partial<LabSettings> | undefined,
  current: Partial<LabSettings>,
): Partial<LabSettings> {
  return preserveLabKeys(lab, current, LOCAL_WORKSPACE_LAB_KEYS);
}

export function sharedStyleLabFromSnapshot(lab: Partial<LabSettings>): Partial<LabSettings> {
  return omitLabKeys(lab, STYLE_EXCLUDED_LAB_KEYS) ?? {};
}

export function mergeSharedStyleLab(
  lab: Partial<LabSettings> | undefined,
  current: Partial<LabSettings>,
): Partial<LabSettings> {
  return preserveLabKeys(lab, current, STYLE_EXCLUDED_LAB_KEYS);
}

export type SharedPresetPayloadMap = {
  size: SharedSizePresetPayload;
  layout: SharedLayoutPresetPayload;
  style: SharedStylePresetPayload;
  color: SharedColorPresetPayload;
};

export type SharedPresetEnvelope<K extends SharedPresetKind> = {
  id: string;
  kind: K;
  name: string;
  payload: SharedPresetPayloadMap[K];
  schemaVersion: (typeof SHARED_PRESET_SCHEMA_VERSIONS)[K];
  revision: number;
  createdAt: string;
  updatedAt: string;
  createdBy?: string;
};

/** A distributive union by default; `SharedPreset<"layout">` narrows its payload. */
export type SharedPreset<K extends SharedPresetKind = SharedPresetKind> = {
  [P in K]: SharedPresetEnvelope<P>;
}[K];

export type SharedPresetInput<K extends SharedPresetKind = SharedPresetKind> = {
  [P in K]: {
    kind: P;
    name: string;
    payload: SharedPresetPayloadMap[P];
    schemaVersion: (typeof SHARED_PRESET_SCHEMA_VERSIONS)[P];
  };
}[K];

export type SharedPresetUpdateInput<K extends SharedPresetKind = SharedPresetKind> = {
  [P in K]: Omit<SharedPresetInput<P>, "kind"> & { expectedRevision: number };
}[K];

export type SharedPresetValidation<T> = { ok: true; value: T } | { ok: false; message: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function hasOnlyKeys(record: Record<string, unknown>, allowed: readonly string[]): boolean {
  const allowedKeys = new Set(allowed);
  return Object.keys(record).every((key) => allowedKeys.has(key));
}

function normalizeName(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const name = value.trim().replace(/\s+/g, " ");
  return name && name.length <= 80 ? name : null;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isIsoDate(value: unknown): value is string {
  return typeof value === "string" && value.trim() !== "" && Number.isFinite(Date.parse(value));
}

function isHexColor(value: unknown): value is string {
  return typeof value === "string" && /^#[0-9a-fA-F]{6}$/.test(value);
}

function serializedByteLength(value: unknown): number {
  try {
    return new TextEncoder().encode(JSON.stringify(value)).byteLength;
  } catch {
    return Number.POSITIVE_INFINITY;
  }
}

function validateSizePayload(value: unknown): value is SharedSizePresetPayload {
  if (!isRecord(value) || !hasOnlyKeys(value, ["unit", "width", "height", "ppi"])) return false;
  if (value.unit !== "pixels" && value.unit !== "inches") return false;
  const maxDimension = value.unit === "inches" ? 1000 : 8192;
  return (
    isFiniteNumber(value.width) &&
    value.width > 0 &&
    value.width <= maxDimension &&
    isFiniteNumber(value.height) &&
    value.height > 0 &&
    value.height <= maxDimension &&
    Number.isInteger(value.ppi) &&
    (value.ppi as number) >= 1 &&
    (value.ppi as number) <= 1200
  );
}

function validateConfigPayload(value: unknown, allowLocalUiState: boolean): boolean {
  if (!isRecord(value) || !hasOnlyKeys(value, ["config", "lab"])) return false;
  if (!isRecord(value.config)) return false;
  if (value.lab !== undefined && !isRecord(value.lab)) return false;
  const lab = value.lab;
  if (!allowLocalUiState && isRecord(lab)) {
    const localOnlyKeys = STYLE_EXCLUDED_LAB_KEYS;
    if (localOnlyKeys.some((key) => key in lab)) return false;
  }
  return true;
}

function validateColorPayload(value: unknown): value is SharedColorPresetPayload {
  if (
    !isRecord(value) ||
    !hasOnlyKeys(value, [
      "stripePalette",
      "twizzler",
      "backgroundColor",
      "stripeColors",
      "darkStripeColors",
      "darkBackgroundColor",
    ])
  )
    return false;
  if (value.stripePalette !== null && typeof value.stripePalette !== "string") return false;
  if (!isRecord(value.twizzler)) return false;
  const twizzler = value.twizzler;
  if (!hasOnlyKeys(twizzler, ["color", "colorFar", "colorNear", "colorEdge"])) return false;
  if (!["color", "colorFar", "colorNear", "colorEdge"].every((key) => isHexColor(twizzler[key]))) {
    return false;
  }
  const validRgb = (color: unknown) =>
    color === undefined ||
    color === null ||
    (Number.isInteger(color) && (color as number) >= 0 && (color as number) <= 0xffffff);
  const validStripeColors = (colors: unknown) =>
    colors === undefined ||
    (Array.isArray(colors) && colors.length <= 64 && colors.every((color) => validRgb(color) && color !== null));
  return (
    validRgb(value.backgroundColor) &&
    validRgb(value.darkBackgroundColor) &&
    validStripeColors(value.stripeColors) &&
    validStripeColors(value.darkStripeColors)
  );
}

export function isSharedPresetKind(value: unknown): value is SharedPresetKind {
  return value === "size" || value === "layout" || value === "style" || value === "color";
}

export function isSharedPresetPayload<K extends SharedPresetKind>(
  kind: K,
  value: unknown,
): value is SharedPresetPayloadMap[K] {
  switch (kind) {
    case "size":
      return validateSizePayload(value);
    case "layout":
      return validateConfigPayload(value, true);
    case "style":
      return validateConfigPayload(value, false);
    case "color":
      return validateColorPayload(value);
  }
}

export function validateSharedPresetInput<K extends SharedPresetKind>(
  value: unknown,
  expectedKind?: K,
): SharedPresetValidation<SharedPresetInput<K>> {
  if (!isRecord(value) || !hasOnlyKeys(value, ["kind", "name", "payload", "schemaVersion"])) {
    return { ok: false, message: "A valid shared preset object is required." };
  }
  if (!isSharedPresetKind(value.kind) || (expectedKind !== undefined && value.kind !== expectedKind)) {
    return { ok: false, message: "Preset kind is invalid." };
  }
  const kind = value.kind;
  const name = normalizeName(value.name);
  if (!name) return { ok: false, message: "Name is required and must be 80 characters or fewer." };
  if (value.schemaVersion !== SHARED_PRESET_SCHEMA_VERSIONS[kind]) {
    return { ok: false, message: `Unsupported ${kind} preset schema version.` };
  }
  if (!isSharedPresetPayload(kind, value.payload)) {
    return { ok: false, message: `Invalid ${kind} preset payload.` };
  }
  if (serializedByteLength(value.payload) > MAX_SHARED_PRESET_PAYLOAD_BYTES) {
    return { ok: false, message: "Preset data must be 256 KiB or smaller." };
  }
  return {
    ok: true,
    value: { kind, name, payload: value.payload, schemaVersion: value.schemaVersion } as SharedPresetInput<K>,
  };
}

export function validateSharedPreset<K extends SharedPresetKind>(
  value: unknown,
  expectedKind?: K,
): SharedPresetValidation<SharedPreset<K>> {
  if (
    !isRecord(value) ||
    !hasOnlyKeys(value, [
      "id",
      "kind",
      "name",
      "payload",
      "schemaVersion",
      "revision",
      "createdAt",
      "updatedAt",
      "createdBy",
    ])
  ) {
    return { ok: false, message: "The server returned an invalid shared preset." };
  }
  const input = validateSharedPresetInput(
    {
      kind: value.kind,
      name: value.name,
      payload: value.payload,
      schemaVersion: value.schemaVersion,
    },
    expectedKind,
  );
  if (!input.ok) return input;
  if (typeof value.id !== "string" || !value.id.trim() || value.id.length > 128) {
    return { ok: false, message: "The server returned an invalid preset id." };
  }
  if (!Number.isInteger(value.revision) || (value.revision as number) < 1) {
    return { ok: false, message: "The server returned an invalid preset revision." };
  }
  if (!isIsoDate(value.createdAt) || !isIsoDate(value.updatedAt)) {
    return { ok: false, message: "The server returned invalid preset timestamps." };
  }
  if (value.createdBy !== undefined && (typeof value.createdBy !== "string" || !value.createdBy.trim())) {
    return { ok: false, message: "The server returned an invalid preset owner." };
  }
  return {
    ok: true,
    value: {
      id: value.id,
      ...input.value,
      revision: value.revision,
      createdAt: value.createdAt,
      updatedAt: value.updatedAt,
      ...(value.createdBy ? { createdBy: value.createdBy } : {}),
    } as SharedPreset<K>,
  };
}

export function sharedLayoutInputFromConfigPreset(preset: ConfigPreset): SharedPresetInput<"layout"> {
  return {
    kind: "layout",
    name: preset.name.trim(),
    payload: {
      config: structuredClone(preset.config) as ThemedEngineConfig,
      ...(preset.lab ? { lab: structuredClone(preset.lab) as Partial<LabSettings> } : {}),
    },
    schemaVersion: SHARED_PRESET_SCHEMA_VERSIONS.layout,
  };
}

export function configPresetFromSharedLayout(preset: SharedPreset<"layout">): ConfigPreset {
  return createPreset(
    preset.name,
    structuredClone(preset.payload.config) as ThemedEngineConfig,
    preset.payload.lab ? (structuredClone(preset.payload.lab) as Partial<LabSettings>) : undefined,
  );
}

/** Adapter for the existing `/api/size-presets` request shape. */
export function sharedPresetInputFromLegacySize(input: SharedSizePresetInput): SharedPresetInput<"size"> {
  return {
    kind: "size",
    name: input.name,
    payload: { unit: input.unit, width: input.width, height: input.height, ppi: input.ppi },
    schemaVersion: SHARED_PRESET_SCHEMA_VERSIONS.size,
  };
}

/** Adapter that keeps the current Size selector/API working while catalogs converge. */
export function legacySizeFromSharedPreset(preset: SharedPreset<"size">): SharedSizePreset {
  return {
    id: preset.id,
    name: preset.name,
    ...preset.payload,
    createdAt: preset.createdAt,
    updatedAt: preset.updatedAt,
  };
}
