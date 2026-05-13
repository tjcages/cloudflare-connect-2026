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

/** Logical padding around the shadowed inner card for selection outline and pointer hits. */
export const ICON_BOX_SELECTION_PADDING = 8;

/** Instance-root rect: inner (shadowed) card ± padding — excludes title strip and bottom accent/glow. */
export const getIconBoxShadowCardBoundsInRootSpace = (): { x: number; y: number; width: number; height: number } => {
  const p = ICON_BOX_SELECTION_PADDING;
  return {
    x: ICON_BOX_INNER_OFFSET - p,
    y: ICON_BOX_INNER_TOP - p,
    width: ICON_BOX_INNER_SIZE + p * 2,
    height: ICON_BOX_INNER_SIZE + p * 2,
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
