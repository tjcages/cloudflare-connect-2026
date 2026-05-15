import type { PaletteThemeId } from "../theme/palette";
import { paletteBrush } from "../theme/palette";
import { SIDEBAR_LIST_ICON_PX } from "./iconTokens";

type PlusMarkerGlyphProps = {
  theme: PaletteThemeId;
  size?: number;
  /** When set, neutral theme stroke tracks grid stroke (same as icon-box). */
  gridStrokeColor?: string;
};

/** Sidebar/list preview: 10×10 plus centered in {@link SIDEBAR_LIST_ICON_PX} (canvas tile still draws 6×6 in 40×40). */
export const PlusMarkerGlyph = ({ theme, size = SIDEBAR_LIST_ICON_PX, gridStrokeColor }: PlusMarkerGlyphProps) => {
  const neutralOpts = gridStrokeColor !== undefined ? { neutralFillSyncHex: gridStrokeColor } : undefined;
  const strokeHex = paletteBrush(theme, neutralOpts).fillHex;
  /** Plus spans 10×10 centered in the 16×16 viewBox (3…13). */
  return (
    <svg className="component-icon" width={size} height={size} viewBox="0 0 16 16" fill="none">
      <path d="M8 3 L8 13 M3 8 L13 8" stroke={strokeHex} strokeWidth={1} strokeLinecap="butt" />
    </svg>
  );
};
