import { TEXT_FAINT } from "../../theme/accents";
import { paletteBrush, type PaletteBrushOptions, type PaletteThemeId } from "../../theme/palette";

/** Pairs each layer theme with a second palette id for string literals. */
export const STRING_THEME_PAIR: Record<PaletteThemeId, PaletteThemeId> = {
  orange: "purple",
  purple: "orange",
  blue: "purple",
  forest: "blue",
  neutral: "neutral",
};

export type CodeSnippetSyntaxColors = {
  accentHex: string;
  stringHex: string;
  mutedHex: string;
};

export function getCodeSnippetSyntaxColors(
  themeId: PaletteThemeId,
  options?: PaletteBrushOptions,
): CodeSnippetSyntaxColors {
  const primary = paletteBrush(themeId, options);
  const strings = paletteBrush(STRING_THEME_PAIR[themeId], options);
  return {
    accentHex: primary.fillHex,
    stringHex: strings.fillHex,
    mutedHex: TEXT_FAINT.hex,
  };
}
