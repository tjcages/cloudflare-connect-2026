import { parseHexColor } from "../canvas/color";

export const PALETTE_THEMES = [
  {
    id: "orange",
    label: "Orange",
    fillHex: "#FF4802",
    fillTextHex: "#FFFFFF",
    fillDisplayP3: "color(display-p3 0.9216 0.3412 0.1608)",
  },
  {
    id: "purple",
    label: "Purple",
    fillHex: "#9C37FF",
    fillTextHex: "#FFFFFF",
    fillDisplayP3: "color(display-p3 0.5647 0.2431 0.9882)",
  },
  {
    id: "blue",
    label: "Blue",
    fillHex: "#007AFF",
    fillTextHex: "#FFFFFF",
    fillDisplayP3: "color(display-p3 0.0627 0.4627 0.9804)",
  },
  {
    id: "neutral",
    label: "Neutral",
    fillHex: "#F3F3F3",
    fillTextHex: "#1F1F1F",
    /** Separate icon glyph color on white card when title pill uses light gray fill. */
    iconFill: "#B3B3B3",
    fillDisplayP3: "color(display-p3 0.9542 0.9542 0.9542)",
    fillTextDisplayP3: "color(display-p3 0.12 0.12 0.12)",
  },
  {
    id: "forest",
    label: "Forest",
    fillHex: "#00BA79",
    fillTextHex: "#FFFFFF",
    fillDisplayP3: "color(display-p3 0.1697 0.705 0.5087)",
  },
] as const;

export type PaletteThemeId = (typeof PALETTE_THEMES)[number]["id"];

export type PaletteThemeEntry = (typeof PALETTE_THEMES)[number];

/** Packed RGB brushes derived from the palette entry (Pixi-friendly `.fill` / `.fillText` / `.iconFill`). */
export type PaletteBrush = {
  id: PaletteThemeId;
  /** Packed `0xRRGGBB` for Pixi fills (title strip background). */
  readonly fill: number;
  /** Packed `0xRRGGBB` for contrasting title text on `fill`. */
  readonly fillText: number;
  /** Packed `0xRRGGBB` for icon glyph on the card (defaults to title `fill` when theme omits `iconFill`). */
  readonly iconFill: number;
  readonly fillHex: string;
  readonly fillTextHex: string;
  readonly iconFillHex: string;
};

const FALLBACK_ID: PaletteThemeId = "purple";

export type PaletteBrushOptions = {
  /** For the neutral theme only: use this hex for fills (title strip, corners) so they track grid stroke color. */
  neutralFillSyncHex?: string;
};

export function paletteBrush(themeId: PaletteThemeId, options?: PaletteBrushOptions): PaletteBrush {
  const entry = PALETTE_THEMES.find((t) => t.id === themeId) ?? PALETTE_THEMES.find((t) => t.id === FALLBACK_ID)!;
  const syncedNeutralFill = entry.id === "neutral" ? options?.neutralFillSyncHex?.trim() : "";
  const fillHex = syncedNeutralFill || entry.fillHex;
  const iconFillHex = "iconFill" in entry && typeof entry.iconFill === "string" ? entry.iconFill : entry.fillHex;

  return {
    id: entry.id,
    fill: parseHexColor(fillHex),
    fillText: parseHexColor(entry.fillTextHex),
    iconFill: parseHexColor(iconFillHex),
    fillHex,
    fillTextHex: entry.fillTextHex,
    iconFillHex,
  };
}
