import type { PaletteThemeId } from "../theme/palette";
import { paletteBrush } from "../theme/palette";
import { RECT_MARKER_LIST_GLYPH_PX } from "./iconTokens";

type RectMarkerGlyphProps = {
  theme: PaletteThemeId;
  size?: number;
  /** When set, neutral theme fill tracks grid stroke (same as icon-box). */
  gridStrokeColor?: string;
};

/** Sidebar list / layer preview: scaled 4×4 motif (canvas pixel rect is unchanged). */
export const RectMarkerGlyph = ({ theme, size = RECT_MARKER_LIST_GLYPH_PX, gridStrokeColor }: RectMarkerGlyphProps) => {
  const neutralOpts = gridStrokeColor !== undefined ? { neutralFillSyncHex: gridStrokeColor } : undefined;
  const fillHex = paletteBrush(theme, neutralOpts).fillHex;
  return (
    <svg className="block" width={size} height={size} viewBox="0 0 8 8">
      <rect x="2" y="2" width="4" height="4" fill={fillHex} rx="0.55" ry="0.55" />
    </svg>
  );
};
