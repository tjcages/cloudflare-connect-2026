/** Logical layout for icon-box instances (registry + Pixi agree on these numbers). */

import { ICON_BOX_TITLE_FONT_FAMILY } from "../../fonts/iconBoxTitle";
import { BASE_UNIT, LARGE_CELL_SIZE, type ComponentType } from "../../grid/types";

export type IconBoxLayoutVariant = "icon-box" | "icon-box-2x1";

export const isIconBoxComponentType = (type: ComponentType): type is "icon-box" | "icon-box-2x1" =>
  type === "icon-box" || type === "icon-box-2x1";

export const getIconBoxLayoutVariant = (type: ComponentType): IconBoxLayoutVariant | null =>
  isIconBoxComponentType(type) ? type : null;

export const ICON_BOX_INNER_OFFSET = 8;
export const ICON_BOX_INNER_SIZE = 64;
/** Merged inner width for 2×1 variant (two 80px columns; frame width 160). */
export const ICON_BOX_2X1_INNER_WIDTH = 144;
export const ICON_BOX_RADIUS = 10;

export const TITLE_BAR_HEIGHT = 16;
export const TITLE_TO_INNER_GAP = 20;
/** Reference width for centering the title strip (1×1); 2×1 uses `ICON_BOX_2X1_TITLE_REFERENCE_WIDTH`. */
export const TITLE_BAR_WIDTH = 80;
export const ICON_BOX_2X1_TITLE_REFERENCE_WIDTH = LARGE_CELL_SIZE * 2;
export const TITLE_TEXT_PADDING_X = 6;
export const TITLE_FONT_SIZE_PX = 10;

export const ICON_BOX_INNER_TOP = TITLE_BAR_HEIGHT + TITLE_TO_INNER_GAP;

/** Center of the padded inner card (1×1); grid snap aligns this point to the connector lattice. */
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

/** Outer stroke rect around the shadow card: inner size + padding on both sides (= 80×80 for 1×1). */
export const ICON_BOX_CARD_FRAME_SIZE = ICON_BOX_INNER_SIZE + ICON_BOX_SELECTION_PADDING * 2;

/** Frame width for 2×1 (144 inner + horizontal padding). */
export const ICON_BOX_2X1_CARD_FRAME_WIDTH = ICON_BOX_2X1_INNER_WIDTH + ICON_BOX_SELECTION_PADDING * 2;

export const ICON_BOX_CARD_FRAME_ORIGIN_X = ICON_BOX_INNER_OFFSET - ICON_BOX_SELECTION_PADDING;
export const ICON_BOX_CARD_FRAME_ORIGIN_Y = ICON_BOX_INNER_TOP - ICON_BOX_SELECTION_PADDING;

export const getIconBoxInnerWidth = (variant: IconBoxLayoutVariant): number =>
  variant === "icon-box-2x1" ? ICON_BOX_2X1_INNER_WIDTH : ICON_BOX_INNER_SIZE;

export const getIconBoxCardFrameWidth = (variant: IconBoxLayoutVariant): number =>
  variant === "icon-box-2x1" ? ICON_BOX_2X1_CARD_FRAME_WIDTH : ICON_BOX_CARD_FRAME_SIZE;

/** Instance-root rect: inner (shadowed) card ± padding — excludes title strip and bottom accent/glow. */
export const getIconBoxShadowCardBoundsInRootSpace = (
  variant: IconBoxLayoutVariant = "icon-box",
): { x: number; y: number; width: number; height: number } => ({
  x: ICON_BOX_CARD_FRAME_ORIGIN_X,
  y: ICON_BOX_CARD_FRAME_ORIGIN_Y,
  width: getIconBoxCardFrameWidth(variant),
  height: ICON_BOX_CARD_FRAME_SIZE,
});

/**
 * Outline rect for selection UI: title strip plus nominal body width, height through accent bar only (no accent glow pad).
 * Widens horizontally when titles overflow, matching Pixi barLeft/rectWidth.
 */
export const getIconBoxFullHighlightBoundsInRootSpace = (
  title: string,
  variant: IconBoxLayoutVariant = "icon-box",
): { x: number; y: number; width: number; height: number } => {
  const refWidth = variant === "icon-box-2x1" ? ICON_BOX_2X1_TITLE_REFERENCE_WIDTH : TITLE_BAR_WIDTH;
  const { rectWidth, barLeft } = getIconBoxTitleBarLayout(title, refWidth);
  const minX = Math.min(0, barLeft);
  const maxX = Math.max(refWidth, barLeft + rectWidth);
  return {
    x: minX,
    y: 0,
    width: maxX - minX,
    height: ICON_BOX_HIGHLIGHT_HEIGHT,
  };
};

/**
 * Center of the shadow-card rect in instance root space.
 * Used for connector layer endpoints for both variants. For 2×1, position snapping still uses
 * {@link ICON_BOX_2X1_SNAP_ANCHOR_X} (west frame edge) on the {@link LARGE_CELL_SIZE} lattice.
 */
export const getIconBoxConnectorAnchorInRootSpace = (variant: IconBoxLayoutVariant): { x: number; y: number } => {
  const r = getIconBoxShadowCardBoundsInRootSpace(variant);
  return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
};

/** 1×1 instance-root snap point: center of the shadow-card interaction rect. */
export const ICON_BOX_SNAP_ANCHOR_X = getIconBoxConnectorAnchorInRootSpace("icon-box").x;
export const ICON_BOX_SNAP_ANCHOR_Y = getIconBoxConnectorAnchorInRootSpace("icon-box").y;

/**
 * 2×1 horizontal snap: aligns the shadow-card west edge (`instance.x` + this) to the
 * {@link LARGE_CELL_SIZE} lattice (80px steps, large-cell column boundaries).
 */
export const ICON_BOX_2X1_SNAP_ANCHOR_X = ICON_BOX_CARD_FRAME_ORIGIN_X;

/**
 * Lowest snapped `instance.y`: one grid step above the legacy `y >= 0` floor so the title can extend past the
 * canvas top while the snap anchor Y stays on the BASE_UNIT grid.
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

export const getIconBoxTitleBarLayout = (
  title: string,
  referenceBodyWidthPx: number = TITLE_BAR_WIDTH,
): IconBoxTitleBarLayout => {
  const rawTextWidth = measureIconBoxTitleTextWidthPx(title);
  const rectWidth = Math.ceil(rawTextWidth + TITLE_TEXT_PADDING_X * 2);
  const barLeft = (referenceBodyWidthPx - rectWidth) / 2;
  return { rectWidth, barLeft };
};

export const MARKER_SIZE = 2;
export const MARKER_INSET = 8;

/** Edge-center tick sizes (top/bottom vertical, left/right horizontal). */
export const ICON_BOX_EDGE_TICK_V = { width: 1, height: 2 } as const;
export const ICON_BOX_EDGE_TICK_H = { width: 2, height: 1 } as const;

export type IconBoxEdgeTickRect = { x: number; y: number; width: number; height: number };

/** Half-pixel nudge shared by edge ticks and container reticles (grid stroke alignment). */
export const ICON_BOX_STROKE_ALIGN_NUDGE = 0.5;

/**
 * In `buildContainerCornerReticle`, edge ticks sit at 4px from the reticle origin; right/bottom at 16px.
 * Position the 22×22 reticle so those ticks line up with {@link getIconBoxEdgeTickRects}.
 */
export const ICON_BOX_CONTAINER_RETICLE_ART_TICK_NEAR = 4;
export const ICON_BOX_CONTAINER_RETICLE_ART_TICK_FAR = 16;

export type IconBoxContainerReticleCorner = "tl" | "tr" | "bl" | "br";

/** Top-left of the 22×22 container reticle in instance-root space. */
export const getIconBoxContainerReticlePosition = (
  corner: IconBoxContainerReticleCorner,
  ox: number,
  oy: number,
  w: number,
  h: number,
): { x: number; y: number } => {
  const inset = MARKER_INSET;
  const near = ICON_BOX_CONTAINER_RETICLE_ART_TICK_NEAR;
  const far = ICON_BOX_CONTAINER_RETICLE_ART_TICK_FAR;
  switch (corner) {
    case "tl":
      return { x: ox + inset - near, y: oy + inset - near };
    case "tr":
      return { x: ox + w - inset - ICON_BOX_EDGE_TICK_H.width - far, y: oy + inset - near };
    case "bl":
      return { x: ox + inset - near, y: oy + h - inset - ICON_BOX_EDGE_TICK_V.height - far };
    case "br":
      return {
        x: ox + w - inset - ICON_BOX_EDGE_TICK_H.width - far,
        y: oy + h - inset - ICON_BOX_EDGE_TICK_V.height - far,
      };
  }
};

/** Four edge-center ticks per inner slot (top/bottom 1×2, left/right 2×1), 8px inset from edges. */
export const getIconBoxEdgeTickRects = (ox: number, oy: number, w: number, h: number): IconBoxEdgeTickRect[] => {
  const cx = ox + w / 2 - ICON_BOX_STROKE_ALIGN_NUDGE;
  const cy = oy + h / 2 - ICON_BOX_STROKE_ALIGN_NUDGE;
  const { width: vW, height: vH } = ICON_BOX_EDGE_TICK_V;
  const { width: hW, height: hH } = ICON_BOX_EDGE_TICK_H;
  return [
    { x: cx, y: oy + MARKER_INSET, width: vW, height: vH },
    { x: cx, y: oy + h - MARKER_INSET - vH, width: vW, height: vH },
    { x: ox + MARKER_INSET, y: cy, width: hW, height: hH },
    { x: ox + w - MARKER_INSET - hW, y: cy, width: hW, height: hH },
  ];
};

/** Icon hold X inside root for first column (1×1 and 2×1 left cell). */
export const ICON_HOLD_OFFSET_X = ICON_BOX_INNER_OFFSET + 20;

/** Horizontal offset from instance root for the second icon column (2×1). */
export const ICON_HOLD_OFFSET_X_SECOND = LARGE_CELL_SIZE + ICON_HOLD_OFFSET_X;

/** Vertical offset of icon pivot from inner rect top. */
export const ICON_HOLD_OFFSET_Y_INNER = 20;
