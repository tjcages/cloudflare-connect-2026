/** Logical layout for icon-box instances (registry + Pixi agree on these numbers). */

import { ICON_BOX_TITLE_FONT_FAMILY } from "../../fonts/iconBoxTitle";
import { BASE_UNIT, LARGE_CELL_SIZE, type ComponentInstance, type ComponentType } from "../../grid/types";

export type IconBoxLayoutVariant = "icon-box" | "icon-box-2x1" | "icon-box-1x2";

export type IconBoxInstanceUnion = Extract<ComponentInstance, { type: "icon-box" | "icon-box-2x1" | "icon-box-1x2" }>;

export const isIconBoxComponentType = (type: ComponentType): type is "icon-box" | "icon-box-2x1" | "icon-box-1x2" =>
  type === "icon-box" || type === "icon-box-2x1" || type === "icon-box-1x2";

export const isIconBoxInstance = (instance: ComponentInstance): instance is IconBoxInstanceUnion =>
  isIconBoxComponentType(instance.type);

export const getIconBoxLayoutVariant = (type: ComponentType): IconBoxLayoutVariant | null =>
  isIconBoxComponentType(type) ? type : null;

export const ICON_BOX_INNER_OFFSET = 8;
export const ICON_BOX_INNER_SIZE = 64;
/** Merged inner width for 2×1 variant (two 80px columns; frame width 160). */
export const ICON_BOX_2X1_INNER_WIDTH = 144;
/** Merged inner height for 1×2 variant (two 80px rows; frame height 160). */
export const ICON_BOX_1X2_INNER_HEIGHT = 144;
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

/** Animated center dash on 2×1 inner card (between icon columns). */
export const ICON_BOX_2X1_CENTER_STROKE_WIDTH = 12;
export const ICON_BOX_2X1_CENTER_STROKE_HEIGHT = 1;
export const ICON_BOX_2X1_CENTER_STROKE_TRAVEL_PX = 12;

/** Pivot for 2×1 center stroke in instance root space (horizontal center of merged inner card). */
export const getIconBox2x1CenterStrokeAnchor = (): { x: number; y: number } => ({
  x: ICON_BOX_INNER_OFFSET + ICON_BOX_2X1_INNER_WIDTH / 2,
  y: ICON_BOX_INNER_CENTER_Y,
});

/** Animated center dash on 1×2 inner card (between icon rows). */
export const ICON_BOX_1X2_CENTER_STROKE_WIDTH = 1;
export const ICON_BOX_1X2_CENTER_STROKE_HEIGHT = 12;
export const ICON_BOX_1X2_CENTER_STROKE_TRAVEL_PX = 12;

/** Pivot for 1×2 center stroke in instance root space (vertical center of merged inner card). */
export const getIconBox1x2CenterStrokeAnchor = (): { x: number; y: number } => ({
  x: ICON_BOX_INNER_CENTER_X,
  y: ICON_BOX_INNER_TOP + ICON_BOX_1X2_INNER_HEIGHT / 2,
});

/** Gap between inner card bottom edge and bottom accent bar (logical px). */
export const ICON_BOX_ACCENT_BAR_GAP = 8;
export const ICON_BOX_ACCENT_BAR_WIDTH = 33;
export const ICON_BOX_ACCENT_BAR_HEIGHT = 2;
/** Space below accent bar so warm glow isn’t clipped by bounds / PNG extract. */
export const ICON_BOX_ACCENT_SHADOW_PAD = 20;

export const ICON_BOX_BOTTOM_MARGIN = ICON_BOX_ACCENT_BAR_GAP + ICON_BOX_ACCENT_BAR_HEIGHT + ICON_BOX_ACCENT_SHADOW_PAD;
export const ICON_BOX_OUTER_HEIGHT = ICON_BOX_INNER_TOP + ICON_BOX_INNER_SIZE + ICON_BOX_BOTTOM_MARGIN;
export const ICON_BOX_1X2_OUTER_HEIGHT = ICON_BOX_INNER_TOP + ICON_BOX_1X2_INNER_HEIGHT + ICON_BOX_BOTTOM_MARGIN;

/**
 * Selection outline bottom: through accent bar geometry only.
 * Omit `ICON_BOX_ACCENT_SHADOW_PAD` so the stroke does not encompass glow/filter bleed reserved for PNG export.
 */
export const ICON_BOX_HIGHLIGHT_HEIGHT =
  ICON_BOX_INNER_TOP + ICON_BOX_INNER_SIZE + ICON_BOX_ACCENT_BAR_GAP + ICON_BOX_ACCENT_BAR_HEIGHT;
export const ICON_BOX_1X2_HIGHLIGHT_HEIGHT =
  ICON_BOX_INNER_TOP + ICON_BOX_1X2_INNER_HEIGHT + ICON_BOX_ACCENT_BAR_GAP + ICON_BOX_ACCENT_BAR_HEIGHT;

/** Logical padding around the shadowed inner card for selection outline, outer frame, and pointer hits. */
export const ICON_BOX_SELECTION_PADDING = 8;

/** Outer stroke rect around the shadow card: inner size + padding on both sides (= 80×80 for 1×1). */
export const ICON_BOX_CARD_FRAME_SIZE = ICON_BOX_INNER_SIZE + ICON_BOX_SELECTION_PADDING * 2;

/** Frame width for 2×1 (144 inner + horizontal padding). */
export const ICON_BOX_2X1_CARD_FRAME_WIDTH = ICON_BOX_2X1_INNER_WIDTH + ICON_BOX_SELECTION_PADDING * 2;
/** Frame height for 1×2 (144 inner + vertical padding). */
export const ICON_BOX_1X2_CARD_FRAME_HEIGHT = ICON_BOX_1X2_INNER_HEIGHT + ICON_BOX_SELECTION_PADDING * 2;

export const ICON_BOX_CARD_FRAME_ORIGIN_X = ICON_BOX_INNER_OFFSET - ICON_BOX_SELECTION_PADDING;
export const ICON_BOX_CARD_FRAME_ORIGIN_Y = ICON_BOX_INNER_TOP - ICON_BOX_SELECTION_PADDING;

export const getIconBoxInnerWidth = (variant: IconBoxLayoutVariant): number =>
  variant === "icon-box-2x1" ? ICON_BOX_2X1_INNER_WIDTH : ICON_BOX_INNER_SIZE;

export const getIconBoxInnerHeight = (variant: IconBoxLayoutVariant): number =>
  variant === "icon-box-1x2" ? ICON_BOX_1X2_INNER_HEIGHT : ICON_BOX_INNER_SIZE;

export const getIconBoxCardFrameWidth = (variant: IconBoxLayoutVariant): number =>
  variant === "icon-box-2x1" ? ICON_BOX_2X1_CARD_FRAME_WIDTH : ICON_BOX_CARD_FRAME_SIZE;

export const getIconBoxCardFrameHeight = (variant: IconBoxLayoutVariant): number =>
  variant === "icon-box-1x2" ? ICON_BOX_1X2_CARD_FRAME_HEIGHT : ICON_BOX_CARD_FRAME_SIZE;

export const getIconBoxHighlightHeight = (variant: IconBoxLayoutVariant): number =>
  variant === "icon-box-1x2" ? ICON_BOX_1X2_HIGHLIGHT_HEIGHT : ICON_BOX_HIGHLIGHT_HEIGHT;

/** Instance-root rect: inner (shadowed) card ± padding — excludes title strip and bottom accent/glow. */
export const getIconBoxShadowCardBoundsInRootSpace = (
  variant: IconBoxLayoutVariant = "icon-box",
): { x: number; y: number; width: number; height: number } => ({
  x: ICON_BOX_CARD_FRAME_ORIGIN_X,
  y: ICON_BOX_CARD_FRAME_ORIGIN_Y,
  width: getIconBoxCardFrameWidth(variant),
  height: getIconBoxCardFrameHeight(variant),
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
    height: getIconBoxHighlightHeight(variant),
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
 * 1×2 vertical snap: aligns the shadow-card north edge (`instance.y` + this) to the
 * {@link LARGE_CELL_SIZE} lattice (80px steps, large-cell row boundaries).
 */
export const ICON_BOX_1X2_SNAP_ANCHOR_Y = ICON_BOX_CARD_FRAME_ORIGIN_Y;

/**
 * Lowest snapped `instance.y`: one grid step above the legacy `y >= 0` floor so the title can extend past the
 * canvas top while the snap anchor Y stays on the BASE_UNIT grid.
 */
export const ICON_BOX_MIN_ROOT_Y = BASE_UNIT - ICON_BOX_SNAP_ANCHOR_Y;

/** Lowest snapped `instance.y` for 1×2 north-edge snap (mirror of {@link ICON_BOX_MIN_ROOT_Y}). */
export const ICON_BOX_1X2_MIN_ROOT_Y = BASE_UNIT - ICON_BOX_1X2_SNAP_ANCHOR_Y;

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

/** Icon hold X inside root for first column (1×1 and 2×1 left cell). */
export const ICON_HOLD_OFFSET_X = ICON_BOX_INNER_OFFSET + 20;

/** Horizontal offset from instance root for the second icon column (2×1). */
export const ICON_HOLD_OFFSET_X_SECOND = LARGE_CELL_SIZE + ICON_HOLD_OFFSET_X;

/** Vertical offset of icon pivot from inner rect top. */
export const ICON_HOLD_OFFSET_Y_INNER = 20;

/** Instance-root Y for first icon row (1×1 and 1×2 top cell). */
export const ICON_HOLD_OFFSET_Y = ICON_BOX_INNER_TOP + ICON_HOLD_OFFSET_Y_INNER;

/** Instance-root Y for second icon row (1×2). */
export const ICON_HOLD_OFFSET_Y_SECOND = ICON_HOLD_OFFSET_Y + LARGE_CELL_SIZE;

/** Canvas icon glyph size (matches Pixi `Sprite` width/height in `build.ts`). */
export const ICON_BOX_ICON_DISPLAY_SIZE = 24;

/**
 * Per-icon decoration slot (edge ticks + corner markers) for 2×1+.
 * 1×1 keeps the full 64×64 inner rect — 8px inset there already matches this footprint.
 */
export const ICON_BOX_ICON_SLOT_SIZE = 48;

/** 48×48 per-icon slots: ticks/markers sit flush on the box edge. 1×1 inner uses {@link MARKER_INSET}. */
export const getIconBoxDecorationInset = (w: number, h: number): number =>
  w === ICON_BOX_ICON_SLOT_SIZE && h === ICON_BOX_ICON_SLOT_SIZE ? 0 : MARKER_INSET;

export type IconBoxDecorationSlot = { ox: number; oy: number; w: number; h: number };

export const getIconBoxIconSlotOrigin = (holdX: number): { ox: number; oy: number } => {
  const cx = holdX + ICON_BOX_ICON_DISPLAY_SIZE / 2;
  const cy = ICON_BOX_INNER_TOP + ICON_HOLD_OFFSET_Y_INNER + ICON_BOX_ICON_DISPLAY_SIZE / 2;
  const half = ICON_BOX_ICON_SLOT_SIZE / 2;
  return { ox: cx - half, oy: cy - half };
};

/** 48×48 slots centered on each 2×1 icon (and future multi-icon layouts). */
export const getIconBox2x1IconDecorationSlots = (): IconBoxDecorationSlot[] =>
  [ICON_HOLD_OFFSET_X, ICON_HOLD_OFFSET_X_SECOND].map((holdX) => {
    const { ox, oy } = getIconBoxIconSlotOrigin(holdX);
    return { ox, oy, w: ICON_BOX_ICON_SLOT_SIZE, h: ICON_BOX_ICON_SLOT_SIZE };
  });

export const getIconBoxIconSlotOriginVertical = (holdY: number): { ox: number; oy: number } => {
  const cx = ICON_HOLD_OFFSET_X + ICON_BOX_ICON_DISPLAY_SIZE / 2;
  const cy = holdY + ICON_BOX_ICON_DISPLAY_SIZE / 2;
  const half = ICON_BOX_ICON_SLOT_SIZE / 2;
  return { ox: cx - half, oy: cy - half };
};

/** 48×48 slots centered on each 1×2 icon. */
export const getIconBox1x2IconDecorationSlots = (): IconBoxDecorationSlot[] =>
  [ICON_HOLD_OFFSET_Y, ICON_HOLD_OFFSET_Y_SECOND].map((holdY) => {
    const { ox, oy } = getIconBoxIconSlotOriginVertical(holdY);
    return { ox, oy, w: ICON_BOX_ICON_SLOT_SIZE, h: ICON_BOX_ICON_SLOT_SIZE };
  });

/** Four edge-center ticks for a logical rect (ox, oy, w, h). */
export const getIconBoxEdgeTickRects = (
  ox: number,
  oy: number,
  w: number,
  h: number,
  inset: number = getIconBoxDecorationInset(w, h),
): IconBoxEdgeTickRect[] => {
  const cx = ox + w / 2 - ICON_BOX_STROKE_ALIGN_NUDGE;
  const cy = oy + h / 2 - ICON_BOX_STROKE_ALIGN_NUDGE;
  const { width: vW, height: vH } = ICON_BOX_EDGE_TICK_V;
  const { width: hW, height: hH } = ICON_BOX_EDGE_TICK_H;
  return [
    { x: cx, y: oy + inset, width: vW, height: vH },
    { x: cx, y: oy + h - inset - vH, width: vW, height: vH },
    { x: ox + inset, y: cy, width: hW, height: hH },
    { x: ox + w - inset - hW, y: cy, width: hW, height: hH },
  ];
};
