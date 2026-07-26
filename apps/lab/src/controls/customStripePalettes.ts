const CUSTOM_STRIPE_PALETTES_KEY = "stripes-engine-custom-stripe-palettes";
const CUSTOM_STRIPE_PALETTE_PREFIX = "saved-stripe-palette:";

export type CustomStripePalette = {
  id: string;
  name: string;
  light: string[];
  dark: string[];
};

function normalizeHex(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const raw = value.trim().replace(/^#/, "");
  return /^[0-9a-fA-F]{6}$/.test(raw) ? `#${raw.toLowerCase()}` : null;
}

function normalizeColors(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map(normalizeHex).filter((hex): hex is string => hex !== null);
}

function normalizePalette(value: unknown): CustomStripePalette | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Partial<CustomStripePalette>;
  const id = typeof record.id === "string" ? record.id.trim() : "";
  const name = typeof record.name === "string" ? record.name.trim() : "";
  const light = normalizeColors(record.light);
  const dark = normalizeColors(record.dark);
  if (!id || !name || light.length === 0) return null;
  return {
    id,
    name,
    light,
    dark: dark.length > 0 ? dark : [...light],
  };
}

function paletteIdBase(name: string): string {
  const normalized = name
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return normalized || "palette";
}

function uniquePaletteId(name: string, palettes: readonly CustomStripePalette[]): string {
  const base = paletteIdBase(name);
  const ids = new Set(palettes.map((palette) => palette.id));
  if (!ids.has(base)) return base;
  let suffix = 2;
  while (ids.has(`${base}-${suffix}`)) suffix += 1;
  return `${base}-${suffix}`;
}

export function customStripePaletteValue(id: string): string {
  return `${CUSTOM_STRIPE_PALETTE_PREFIX}${id}`;
}

export function customStripePaletteIdFromValue(value: string | null | undefined): string | null {
  if (!value?.startsWith(CUSTOM_STRIPE_PALETTE_PREFIX)) return null;
  const id = value.slice(CUSTOM_STRIPE_PALETTE_PREFIX.length).trim();
  return id || null;
}

export function findCustomStripePalette(
  palettes: readonly CustomStripePalette[],
  value: string | null | undefined,
): CustomStripePalette | undefined {
  const id = customStripePaletteIdFromValue(value);
  return id ? palettes.find((palette) => palette.id === id) : undefined;
}

export function upsertCustomStripePalette(
  palettes: readonly CustomStripePalette[],
  input: { name: string; light: readonly string[]; dark: readonly string[] },
): { palette: CustomStripePalette; palettes: CustomStripePalette[] } | null {
  const name = input.name.trim();
  const light = normalizeColors(input.light);
  const dark = normalizeColors(input.dark);
  if (!name || light.length === 0) return null;
  const existing = palettes.find((palette) => palette.name.toLocaleLowerCase() === name.toLocaleLowerCase());
  const palette: CustomStripePalette = {
    id: existing?.id ?? uniquePaletteId(name, palettes),
    name,
    light,
    dark: dark.length > 0 ? dark : [...light],
  };
  return {
    palette,
    palettes: [...palettes.filter((candidate) => candidate.id !== palette.id), palette],
  };
}

export function loadCustomStripePalettes(): CustomStripePalette[] {
  try {
    const raw = localStorage.getItem(CUSTOM_STRIPE_PALETTES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.map(normalizePalette).filter((palette): palette is CustomStripePalette => palette !== null);
  } catch {
    return [];
  }
}

export function saveCustomStripePalettes(palettes: readonly CustomStripePalette[]): void {
  try {
    localStorage.setItem(CUSTOM_STRIPE_PALETTES_KEY, JSON.stringify(palettes));
  } catch {
    /* ignore quota errors */
  }
}

export function clearCustomStripePalettes(): void {
  try {
    localStorage.removeItem(CUSTOM_STRIPE_PALETTES_KEY);
  } catch {
    /* ignore */
  }
}
