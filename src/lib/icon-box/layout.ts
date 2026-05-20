/** Logical layout for icon-box instances (registry + Pixi agree on these numbers). */

import { ICON_BOX_TITLE_FONT_FAMILY } from "../../fonts/iconBoxTitle";
import {
  BASE_UNIT,
  LARGE_CELL_SIZE,
  type ComponentInstance,
  type IconBoxDirection,
  type IconBoxProps,
} from "../../grid/types";

export type IconBoxLayoutSpec = { length: number; direction: IconBoxDirection };

export type IconBoxInstanceUnion = Extract<ComponentInstance, { type: "icon-box" }>;

export const isIconBoxInstance = (instance: ComponentInstance): instance is IconBoxInstanceUnion =>
  instance.type === "icon-box";

export const normalizeIconBoxLength = (n: number): number => Math.max(1, Math.floor(Number.isFinite(n) ? n : 1));

export const resolveIconBoxLayout = (props: Pick<IconBoxProps, "length" | "direction">): IconBoxLayoutSpec => {
  const length = normalizeIconBoxLength(props.length ?? 1);
  return {
    length,
    direction: length <= 1 ? "horizontal" : (props.direction ?? "horizontal"),
  };
};

/** Maps legacy persisted types to layout spec (migration). */
export const layoutSpecFromLegacyType = (type: string): IconBoxLayoutSpec | null => {
  if (type === "icon-box-2x1") {
    return { length: 2, direction: "horizontal" };
  }
  if (type === "icon-box-1x2") {
    return { length: 2, direction: "vertical" };
  }
  return null;
};

export const isLegacyIconBoxType = (type: string): type is "icon-box-2x1" | "icon-box-1x2" =>
  type === "icon-box-2x1" || type === "icon-box-1x2";

export const normalizeIconBoxProps = (props: Partial<IconBoxProps>, defaults: IconBoxProps): IconBoxProps => {
  const merged = { ...defaults, ...props };
  const length = normalizeIconBoxLength(merged.length ?? defaults.length ?? 1);
  const direction = merged.direction ?? defaults.direction;
  return { ...merged, length, direction: length <= 1 ? "horizontal" : direction };
};

/** Converts legacy variant type strings to unified icon-box + layout props. */
export const migrateLegacyIconBoxRaw = (
  type: string,
  props: IconBoxProps,
): { type: "icon-box"; props: IconBoxProps } => {
  const legacySpec = layoutSpecFromLegacyType(type);
  if (legacySpec) {
    return {
      type: "icon-box",
      props: { ...props, length: legacySpec.length, direction: legacySpec.direction },
    };
  }
  return { type: "icon-box", props };
};

export const ICON_BOX_INNER_OFFSET = 8;
export const ICON_BOX_INNER_SIZE = 64;
export const ICON_BOX_RADIUS = 10;

export const TITLE_BAR_HEIGHT = 16;
export const TITLE_TO_INNER_GAP = 20;
export const TITLE_BAR_WIDTH = 80;
export const TITLE_TEXT_PADDING_X = 6;
export const TITLE_FONT_SIZE_PX = 10;

export const ICON_BOX_INNER_TOP = TITLE_BAR_HEIGHT + TITLE_TO_INNER_GAP;

/** Center of the padded inner card (1×1 cross-axis reference). */
export const ICON_BOX_INNER_CENTER_X = ICON_BOX_INNER_OFFSET + ICON_BOX_INNER_SIZE / 2;

/** Animated center dash dimensions (axis follows layout direction). */
export const ICON_BOX_CENTER_STROKE_LONG = 12;
export const ICON_BOX_CENTER_STROKE_SHORT = 1;
export const ICON_BOX_CENTER_STROKE_TRAVEL_PX = 12;

/** Gap between inner card bottom edge and bottom accent bar (logical px). */
export const ICON_BOX_ACCENT_BAR_GAP = 8;
export const ICON_BOX_ACCENT_BAR_WIDTH = 33;
export const ICON_BOX_ACCENT_BAR_HEIGHT = 2;
/** Space below accent bar so warm glow isn’t clipped by bounds / PNG extract. */
export const ICON_BOX_ACCENT_SHADOW_PAD = 20;

export const ICON_BOX_BOTTOM_MARGIN = ICON_BOX_ACCENT_BAR_GAP + ICON_BOX_ACCENT_BAR_HEIGHT + ICON_BOX_ACCENT_SHADOW_PAD;

export const ICON_BOX_OUTER_HEIGHT = ICON_BOX_INNER_TOP + ICON_BOX_INNER_SIZE + ICON_BOX_BOTTOM_MARGIN;

/** Logical padding around the shadowed inner card for selection outline, outer frame, and pointer hits. */
export const ICON_BOX_SELECTION_PADDING = 8;

/** Outer stroke rect around the shadow card: inner size + padding on both sides (= 80×80 for 1×1). */
export const ICON_BOX_CARD_FRAME_SIZE = ICON_BOX_INNER_SIZE + ICON_BOX_SELECTION_PADDING * 2;

export const ICON_BOX_CARD_FRAME_ORIGIN_X = ICON_BOX_INNER_OFFSET - ICON_BOX_SELECTION_PADDING;
export const ICON_BOX_CARD_FRAME_ORIGIN_Y = ICON_BOX_INNER_TOP - ICON_BOX_SELECTION_PADDING;

/** 1×1 instance-root snap point: center of the shadow-card interaction rect. */
export const ICON_BOX_SNAP_ANCHOR_X = ICON_BOX_CARD_FRAME_ORIGIN_X + ICON_BOX_CARD_FRAME_SIZE / 2;
export const ICON_BOX_SNAP_ANCHOR_Y = ICON_BOX_CARD_FRAME_ORIGIN_Y + ICON_BOX_CARD_FRAME_SIZE / 2;

export const ICON_BOX_MIN_ROOT_Y = BASE_UNIT - ICON_BOX_SNAP_ANCHOR_Y;

export const getIconBoxExtendedInnerSize = (spec: IconBoxLayoutSpec): number =>
  ICON_BOX_INNER_SIZE + (spec.length - 1) * LARGE_CELL_SIZE;

export const getIconBoxInnerSize = (spec: IconBoxLayoutSpec): { width: number; height: number } => {
  const extended = getIconBoxExtendedInnerSize(spec);
  return spec.direction === "horizontal"
    ? { width: extended, height: ICON_BOX_INNER_SIZE }
    : { width: ICON_BOX_INNER_SIZE, height: extended };
};

export const getIconBoxInnerWidth = (spec: IconBoxLayoutSpec): number => getIconBoxInnerSize(spec).width;
export const getIconBoxInnerHeight = (spec: IconBoxLayoutSpec): number => getIconBoxInnerSize(spec).height;

export const getIconBoxCardFrameWidth = (spec: IconBoxLayoutSpec): number =>
  getIconBoxInnerWidth(spec) + ICON_BOX_SELECTION_PADDING * 2;

export const getIconBoxCardFrameHeight = (spec: IconBoxLayoutSpec): number =>
  getIconBoxInnerHeight(spec) + ICON_BOX_SELECTION_PADDING * 2;

export const getIconBoxOuterHeight = (spec: IconBoxLayoutSpec): number =>
  ICON_BOX_INNER_TOP + getIconBoxInnerHeight(spec) + ICON_BOX_BOTTOM_MARGIN;

export const getIconBoxHighlightHeight = (spec: IconBoxLayoutSpec): number =>
  ICON_BOX_INNER_TOP + getIconBoxInnerHeight(spec) + ICON_BOX_ACCENT_BAR_GAP + ICON_BOX_ACCENT_BAR_HEIGHT;

export const getIconBoxTitleReferenceWidth = (spec: IconBoxLayoutSpec): number =>
  spec.direction === "horizontal" && spec.length > 1 ? spec.length * LARGE_CELL_SIZE : TITLE_BAR_WIDTH;

/** Instance-root rect: inner (shadowed) card ± padding — excludes title strip and bottom accent/glow. */
export const getIconBoxShadowCardBoundsInRootSpace = (
  spec: IconBoxLayoutSpec,
): { x: number; y: number; width: number; height: number } => ({
  x: ICON_BOX_CARD_FRAME_ORIGIN_X,
  y: ICON_BOX_CARD_FRAME_ORIGIN_Y,
  width: getIconBoxCardFrameWidth(spec),
  height: getIconBoxCardFrameHeight(spec),
});

/**
 * Outline rect for selection UI: title strip plus nominal body width, height through accent bar only (no accent glow pad).
 * Widens horizontally when titles overflow, matching Pixi barLeft/rectWidth.
 */
export const getIconBoxFullHighlightBoundsInRootSpace = (
  title: string,
  spec: IconBoxLayoutSpec,
): { x: number; y: number; width: number; height: number } => {
  const refWidth = getIconBoxTitleReferenceWidth(spec);
  const { rectWidth, barLeft } = getIconBoxTitleBarLayout(title, refWidth);
  const minX = Math.min(0, barLeft);
  const maxX = Math.max(refWidth, barLeft + rectWidth);
  return {
    x: minX,
    y: 0,
    width: maxX - minX,
    height: getIconBoxHighlightHeight(spec),
  };
};

/** Center of the shadow-card rect in instance root space (connector layer endpoints). */
export const getIconBoxConnectorAnchorInRootSpace = (spec: IconBoxLayoutSpec): { x: number; y: number } => {
  const r = getIconBoxShadowCardBoundsInRootSpace(spec);
  return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
};

export type IconBoxSnapBehavior = {
  snapAnchorX: number;
  snapAnchorY: number;
  minRootY: number;
  edgeSnapX: boolean;
  edgeSnapY: boolean;
};

export const getIconBoxSnapBehavior = (spec: IconBoxLayoutSpec): IconBoxSnapBehavior => {
  const connector = getIconBoxConnectorAnchorInRootSpace(spec);
  if (spec.length <= 1) {
    return {
      snapAnchorX: connector.x,
      snapAnchorY: connector.y,
      minRootY: ICON_BOX_MIN_ROOT_Y,
      edgeSnapX: false,
      edgeSnapY: false,
    };
  }
  if (spec.direction === "horizontal") {
    return {
      snapAnchorX: ICON_BOX_CARD_FRAME_ORIGIN_X,
      snapAnchorY: connector.y,
      minRootY: ICON_BOX_MIN_ROOT_Y,
      edgeSnapX: true,
      edgeSnapY: false,
    };
  }
  const northSnapY = ICON_BOX_CARD_FRAME_ORIGIN_Y;
  return {
    snapAnchorX: connector.x,
    snapAnchorY: northSnapY,
    minRootY: BASE_UNIT - northSnapY,
    edgeSnapX: false,
    edgeSnapY: true,
  };
};

export type IconBoxMetrics = {
  spec: IconBoxLayoutSpec;
  width: number;
  height: number;
  snapAnchorX: number;
  snapAnchorY: number;
  minRootY: number;
  edgeSnapX: boolean;
  edgeSnapY: boolean;
  shadowCardBounds: { x: number; y: number; width: number; height: number };
};

export const getIconBoxMetrics = (props: IconBoxProps): IconBoxMetrics => {
  const spec = resolveIconBoxLayout(props);
  const snap = getIconBoxSnapBehavior(spec);
  const shadowCardBounds = getIconBoxShadowCardBoundsInRootSpace(spec);
  return {
    spec,
    width: shadowCardBounds.width,
    height: getIconBoxOuterHeight(spec),
    snapAnchorX: snap.snapAnchorX,
    snapAnchorY: snap.snapAnchorY,
    minRootY: snap.minRootY,
    edgeSnapX: snap.edgeSnapX,
    edgeSnapY: snap.edgeSnapY,
    shadowCardBounds,
  };
};

/** Pivot for center stroke in instance root space (center of merged inner card). @deprecated use getIconBoxCenterStrokeAnchors */
export const getIconBoxCenterStrokeAnchor = (spec: IconBoxLayoutSpec): { x: number; y: number } => {
  const inner = getIconBoxInnerSize(spec);
  return {
    x: ICON_BOX_INNER_OFFSET + inner.width / 2,
    y: ICON_BOX_INNER_TOP + inner.height / 2,
  };
};

/** Center X of icon glyph at a hold position. */
export const getIconBoxIconCenterX = (holdX: number): number => holdX + ICON_BOX_ICON_DISPLAY_SIZE / 2;

/** Center Y of icon glyph at a hold position. */
export const getIconBoxIconCenterY = (holdY: number): number => holdY + ICON_BOX_ICON_DISPLAY_SIZE / 2;

/** One animated dash between each adjacent pair of icons (length − 1 anchors). */
export const getIconBoxCenterStrokeAnchors = (spec: IconBoxLayoutSpec): { x: number; y: number }[] => {
  if (spec.length < 2) {
    return [];
  }
  const holds = getIconBoxIconHolds(spec);
  const anchors: { x: number; y: number }[] = [];
  for (let i = 0; i < holds.length - 1; i++) {
    const a = holds[i]!;
    const b = holds[i + 1]!;
    if (spec.direction === "horizontal") {
      anchors.push({
        x: (a.holdX + b.holdX) / 2 + ICON_BOX_ICON_DISPLAY_SIZE / 2,
        y: getIconBoxIconCenterY(a.holdY),
      });
    } else {
      anchors.push({
        x: getIconBoxIconCenterX(a.holdX),
        y: (a.holdY + b.holdY) / 2 + ICON_BOX_ICON_DISPLAY_SIZE / 2,
      });
    }
  }
  return anchors;
};

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

/** Icon hold X inside root for first column. */
export const ICON_HOLD_OFFSET_X = ICON_BOX_INNER_OFFSET + 20;

/** Vertical offset of icon pivot from inner rect top. */
export const ICON_HOLD_OFFSET_Y_INNER = 20;

/** Instance-root Y for first icon row. */
export const ICON_HOLD_OFFSET_Y = ICON_BOX_INNER_TOP + ICON_HOLD_OFFSET_Y_INNER;

/** Canvas icon glyph size (matches Pixi `Sprite` width/height in `build.ts`). */
export const ICON_BOX_ICON_DISPLAY_SIZE = 24;

export const ICON_BOX_ICON_SLOT_SIZE = 48;

export const getIconBoxDecorationInset = (w: number, h: number): number =>
  w === ICON_BOX_ICON_SLOT_SIZE && h === ICON_BOX_ICON_SLOT_SIZE ? 0 : MARKER_INSET;

export type IconBoxDecorationSlot = { ox: number; oy: number; w: number; h: number };

export type IconBoxIconHold = { holdX: number; holdY: number };

/** Icon hold positions for each slot in the layout. */
export const getIconBoxIconHolds = (spec: IconBoxLayoutSpec): IconBoxIconHold[] =>
  Array.from({ length: spec.length }, (_, i) => ({
    holdX: spec.direction === "horizontal" ? ICON_HOLD_OFFSET_X + i * LARGE_CELL_SIZE : ICON_HOLD_OFFSET_X,
    holdY: spec.direction === "vertical" ? ICON_HOLD_OFFSET_Y + i * LARGE_CELL_SIZE : ICON_HOLD_OFFSET_Y,
  }));

const getIconBoxIconSlotOrigin = (holdX: number, holdY: number): { ox: number; oy: number } => {
  const cx = holdX + ICON_BOX_ICON_DISPLAY_SIZE / 2;
  const cy = holdY + ICON_BOX_ICON_DISPLAY_SIZE / 2;
  const half = ICON_BOX_ICON_SLOT_SIZE / 2;
  return { ox: cx - half, oy: cy - half };
};

/** Per-icon 48×48 decoration slots; 1×1 uses the full inner rect instead (see build.ts). */
export const getIconBoxIconDecorationSlots = (spec: IconBoxLayoutSpec): IconBoxDecorationSlot[] => {
  if (spec.length <= 1) {
    const inner = getIconBoxInnerSize(spec);
    return [{ ox: ICON_BOX_INNER_OFFSET, oy: ICON_BOX_INNER_TOP, w: inner.width, h: inner.height }];
  }
  return getIconBoxIconHolds(spec).map(({ holdX, holdY }) => {
    const { ox, oy } = getIconBoxIconSlotOrigin(holdX, holdY);
    return { ox, oy, w: ICON_BOX_ICON_SLOT_SIZE, h: ICON_BOX_ICON_SLOT_SIZE };
  });
};

/** Horizontal accent bar center X for column index `i` (0-based), aligned to icon center. */
export const getIconBoxHorizontalAccentCenterX = (index: number): number =>
  getIconBoxIconCenterX(ICON_HOLD_OFFSET_X + index * LARGE_CELL_SIZE);

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
