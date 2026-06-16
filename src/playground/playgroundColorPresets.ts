/**
 * Reusable stripe-color palettes ("color presets"). Unlike the per-texture stripe state, these are
 * a global library the designer can save once and apply to any texture or shader. A preset captures
 * the full palette: the luminance stripe list plus the overlay-mode stripe list.
 */

import { normalizeStripe, type Stripe } from "./stripeColors";

export type PlaygroundColorPreset = {
  /** Stable id used for the dropdown value, dedupe, and delete. */
  id: string;
  /** Display name shown in the Color preset dropdown. */
  label: string;
  /** Ordered luminance stripes. */
  stripes: Stripe[];
  /** Overlay-mode stripes (loudest bands). Omitted = leave overlay stripes untouched on apply. */
  overlayStripes?: Stripe[];
  /** Creation timestamp; used to order the list oldest-first. */
  createdAt: number;
};

/** Dropdown sentinel selected when the current palette matches no saved preset. */
export const COLOR_PRESET_CUSTOM_ID = "custom";

export const COLOR_PRESET_LABEL_MAX_LENGTH = 60;

export function normalizeColorPresetLabel(raw: unknown): string {
  const text = typeof raw === "string" ? raw.trim().replace(/\s+/g, " ") : "";
  if (text.length === 0) {
    return "Color preset";
  }
  return text.slice(0, COLOR_PRESET_LABEL_MAX_LENGTH);
}

let colorPresetIdCounter = 0;

export function createColorPresetId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  colorPresetIdCounter += 1;
  return `palette-${Date.now().toString(36)}-${colorPresetIdCounter}`;
}

function normalizeStripeList(raw: unknown): Stripe[] {
  if (!Array.isArray(raw)) {
    return [];
  }
  return raw
    .filter((entry): entry is Partial<Stripe> => !!entry && typeof entry === "object")
    .map((entry) => normalizeStripe({ ...entry }));
}

export function normalizeColorPreset(raw: unknown): PlaygroundColorPreset | null {
  if (!raw || typeof raw !== "object") {
    return null;
  }
  const entry = raw as Partial<PlaygroundColorPreset>;
  const stripes = normalizeStripeList(entry.stripes);
  if (stripes.length === 0) {
    return null;
  }
  const overlayStripes = entry.overlayStripes !== undefined ? normalizeStripeList(entry.overlayStripes) : undefined;
  const id = typeof entry.id === "string" && entry.id.length > 0 ? entry.id : createColorPresetId();
  const createdAt =
    typeof entry.createdAt === "number" && Number.isFinite(entry.createdAt) ? entry.createdAt : Date.now();
  return {
    id,
    label: normalizeColorPresetLabel(entry.label),
    stripes,
    ...(overlayStripes && overlayStripes.length > 0 ? { overlayStripes } : {}),
    createdAt,
  };
}

export function normalizeColorPresets(raw: unknown): PlaygroundColorPreset[] {
  if (!Array.isArray(raw)) {
    return [];
  }
  const seen = new Set<string>();
  const result: PlaygroundColorPreset[] = [];
  for (const item of raw) {
    const normalized = normalizeColorPreset(item);
    if (!normalized || seen.has(normalized.id)) {
      continue;
    }
    seen.add(normalized.id);
    result.push(normalized);
  }
  return result;
}

function stripeListsEqual(a: readonly Stripe[] | undefined, b: readonly Stripe[] | undefined): boolean {
  const left = a ?? [];
  const right = b ?? [];
  if (left.length !== right.length) {
    return false;
  }
  return left.every((stripe, index) => {
    const other = right[index]!;
    return (
      stripe.hex.toLowerCase() === other.hex.toLowerCase() &&
      stripe.startFrom === other.startFrom &&
      stripe.width === other.width
    );
  });
}

/**
 * Resolve the preset whose palette matches the current stripes (and overlay stripes when the preset
 * stored them). Used to highlight the active preset in the dropdown and to target delete.
 */
export function findColorPreset(
  presets: readonly PlaygroundColorPreset[],
  stripes: readonly Stripe[],
  overlayStripes: readonly Stripe[],
): PlaygroundColorPreset | undefined {
  return presets.find((preset) => {
    if (!stripeListsEqual(preset.stripes, stripes)) {
      return false;
    }
    if (preset.overlayStripes === undefined) {
      return true;
    }
    return stripeListsEqual(preset.overlayStripes, overlayStripes);
  });
}

export function resolveColorPresetId(
  presets: readonly PlaygroundColorPreset[],
  stripes: readonly Stripe[],
  overlayStripes: readonly Stripe[],
): string {
  return findColorPreset(presets, stripes, overlayStripes)?.id ?? COLOR_PRESET_CUSTOM_ID;
}

/**
 * Merge incoming presets into an existing list. Entries matching an existing id are replaced; entries
 * whose palette already exists under a different id are skipped so repeated imports do not duplicate.
 */
export function mergeColorPresetLists(
  existing: readonly PlaygroundColorPreset[],
  incoming: readonly PlaygroundColorPreset[],
): PlaygroundColorPreset[] {
  const byId = new Map<string, PlaygroundColorPreset>();
  const order: string[] = [];
  for (const entry of existing) {
    if (!byId.has(entry.id)) {
      order.push(entry.id);
    }
    byId.set(entry.id, entry);
  }
  for (const entry of incoming) {
    if (byId.has(entry.id)) {
      byId.set(entry.id, entry);
      continue;
    }
    const duplicate = order.some((id) => {
      const current = byId.get(id)!;
      return (
        current.label === entry.label &&
        stripeListsEqual(current.stripes, entry.stripes) &&
        stripeListsEqual(current.overlayStripes, entry.overlayStripes)
      );
    });
    if (duplicate) {
      continue;
    }
    byId.set(entry.id, entry);
    order.push(entry.id);
  }
  return order.map((id) => byId.get(id)!).filter(Boolean);
}
