/** Logical layout for icon-box instances (registry + Pixi agree on these numbers). */

import { BASE_UNIT } from "../grid/types";
import { ICON_BOX_TITLE_FONT_FAMILY } from "../fonts/iconBoxTitle";

export const ICON_BOX_INNER_OFFSET = 8;
export const ICON_BOX_INNER_SIZE = 64;
export const ICON_BOX_RADIUS = 10;

export const TITLE_BAR_HEIGHT = 16;
export const TITLE_TO_INNER_GAP = 20;
/** Reference width for centering the title strip; the strip may extend wider than this. */
export const TITLE_BAR_WIDTH = 80;
export const TITLE_TEXT_PADDING_X = 6;
export const TITLE_FONT_SIZE_PX = 10;

export const ICON_BOX_INNER_TOP = TITLE_BAR_HEIGHT + TITLE_TO_INNER_GAP;

/** Center of the padded inner card (shadowed roundRect); grid snap aligns this point to BASE_UNIT. */
export const ICON_BOX_INNER_CENTER_X = ICON_BOX_INNER_OFFSET + ICON_BOX_INNER_SIZE / 2;
export const ICON_BOX_INNER_CENTER_Y = ICON_BOX_INNER_TOP + ICON_BOX_INNER_SIZE / 2;

/** Gap between inner card bottom edge and bottom accent bar (logical px). */
export const ICON_BOX_ACCENT_BAR_GAP = 8;
export const ICON_BOX_ACCENT_BAR_WIDTH = 33;
export const ICON_BOX_ACCENT_BAR_HEIGHT = 2;
/** Space below accent bar so warm glow isn’t clipped by bounds / PNG extract. */
export const ICON_BOX_ACCENT_SHADOW_PAD = 20;

export const ICON_BOX_BOTTOM_MARGIN = ICON_BOX_ACCENT_BAR_GAP + ICON_BOX_ACCENT_BAR_HEIGHT + ICON_BOX_ACCENT_SHADOW_PAD;
export const ICON_BOX_OUTER_HEIGHT = ICON_BOX_INNER_TOP + ICON_BOX_INNER_SIZE + ICON_BOX_BOTTOM_MARGIN;

/**
 * Selection outline bottom: through accent bar geometry only.
 * Omit `ICON_BOX_ACCENT_SHADOW_PAD` so the stroke does not encompass glow/filter bleed reserved for PNG export.
 */
export const ICON_BOX_HIGHLIGHT_HEIGHT =
  ICON_BOX_INNER_TOP + ICON_BOX_INNER_SIZE + ICON_BOX_ACCENT_BAR_GAP + ICON_BOX_ACCENT_BAR_HEIGHT;

/** Logical padding around the shadowed inner card for selection outline, outer frame, and pointer hits. */
export const ICON_BOX_SELECTION_PADDING = 8;

/** Outer stroke rect around the shadow card: inner size + padding on both sides (= 80×80). */
export const ICON_BOX_CARD_FRAME_SIZE = ICON_BOX_INNER_SIZE + ICON_BOX_SELECTION_PADDING * 2;

export const ICON_BOX_CARD_FRAME_ORIGIN_X = ICON_BOX_INNER_OFFSET - ICON_BOX_SELECTION_PADDING;
export const ICON_BOX_CARD_FRAME_ORIGIN_Y = ICON_BOX_INNER_TOP - ICON_BOX_SELECTION_PADDING;

/** Instance-root rect: inner (shadowed) card ± padding — excludes title strip and bottom accent/glow. */
export const getIconBoxShadowCardBoundsInRootSpace = (): { x: number; y: number; width: number; height: number } => ({
  x: ICON_BOX_CARD_FRAME_ORIGIN_X,
  y: ICON_BOX_CARD_FRAME_ORIGIN_Y,
  width: ICON_BOX_CARD_FRAME_SIZE,
  height: ICON_BOX_CARD_FRAME_SIZE,
});

/**
 * Outline rect for selection UI: title strip plus nominal body width, height through accent bar only (no accent glow pad).
 * Widens horizontally when titles overflow (`TITLE_BAR_WIDTH`), matching Pixi barLeft/rectWidth.
 * Pointer bounds and snapping still use shadow-card/`COMPONENT_REGISTRY`; this is visuals only.
 */
export const getIconBoxFullHighlightBoundsInRootSpace = (
  title: string,
): { x: number; y: number; width: number; height: number } => {
  const { rectWidth, barLeft } = getIconBoxTitleBarLayout(title);
  const minX = Math.min(0, barLeft);
  const maxX = Math.max(TITLE_BAR_WIDTH, barLeft + rectWidth);
  return {
    x: minX,
    y: 0,
    width: maxX - minX,
    height: ICON_BOX_HIGHLIGHT_HEIGHT,
  };
};

/** Instance-root snap point: center of the shadow-card interaction rect (matches `ICON_BOX_INNER_CENTER_X` / `Y` with current padding). */
const _iconBoxSnapAnchorInRoot = (() => {
  const r = getIconBoxShadowCardBoundsInRootSpace();
  return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
})();
export const ICON_BOX_SNAP_ANCHOR_X = _iconBoxSnapAnchorInRoot.x;
export const ICON_BOX_SNAP_ANCHOR_Y = _iconBoxSnapAnchorInRoot.y;

/**
 * Lowest snapped `instance.y`: one grid step above the legacy `y >= 0` floor so the title can extend past the
 * canvas top while `ICON_BOX_SNAP_ANCHOR_Y` stays on the BASE_UNIT grid (`k === 1` vs `k === 2`).
 */
export const ICON_BOX_MIN_ROOT_Y = BASE_UNIT - ICON_BOX_SNAP_ANCHOR_Y;

let measureCanvas: HTMLCanvasElement | null = null;

const getTitleMeasureContext = (): CanvasRenderingContext2D | null => {
  if (typeof document === "undefined") {
    return null;
  }
  if (!measureCanvas) {
    measureCanvas = document.createElement("canvas");
  }
  return measureCanvas.getContext("2d");
};

/** Pixel width of the uppercased title in the icon-box title font (kept in sync with Pixi `Text` style). */
export const measureIconBoxTitleTextWidthPx = (title: string): number => {
  const ctx = getTitleMeasureContext();
  if (!ctx) {
    return 0;
  }
  ctx.font = `400 ${TITLE_FONT_SIZE_PX}px "${ICON_BOX_TITLE_FONT_FAMILY}"`;
  return ctx.measureText(title.toUpperCase()).width;
};

export type IconBoxTitleBarLayout = { rectWidth: number; barLeft: number };

export const getIconBoxTitleBarLayout = (title: string): IconBoxTitleBarLayout => {
  const rawTextWidth = measureIconBoxTitleTextWidthPx(title);
  const rectWidth = Math.ceil(rawTextWidth + TITLE_TEXT_PADDING_X * 2);
  const barLeft = (TITLE_BAR_WIDTH - rectWidth) / 2;
  return { rectWidth, barLeft };
};

export const MARKER_SIZE = 2;
export const MARKER_INSET = 8;

/** Icon hold X inside root (inner left + centered inset). */
export const ICON_HOLD_OFFSET_X = ICON_BOX_INNER_OFFSET + 20;

/** Vertical offset of icon pivot from inner rect top (legacy centered layout). */
export const ICON_HOLD_OFFSET_Y_INNER = 20;
