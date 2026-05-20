import { BoxShadowFilter, type BoxShadowOptions } from "pixi-box-shadow";
import { Container, Graphics, Sprite, Text } from "pixi.js";
import { ICON_BOX_TITLE_FONT_FAMILY } from "../../../fonts/iconBoxTitle";
import { LARGE_CELL_SIZE, type ComponentInstance } from "../../../grid/types";
import { getIconDefinition } from "../../../lib/iconRegistry";
import {
  ICON_BOX_2X1_TITLE_REFERENCE_WIDTH,
  ICON_BOX_ACCENT_BAR_GAP,
  ICON_BOX_ACCENT_BAR_HEIGHT,
  ICON_BOX_ACCENT_BAR_WIDTH,
  ICON_BOX_CARD_FRAME_ORIGIN_Y,
  ICON_BOX_CARD_FRAME_SIZE,
  ICON_BOX_INNER_OFFSET,
  ICON_BOX_INNER_SIZE,
  ICON_BOX_INNER_TOP,
  ICON_BOX_RADIUS,
  ICON_HOLD_OFFSET_X,
  ICON_HOLD_OFFSET_X_SECOND,
  ICON_HOLD_OFFSET_Y_INNER,
  MARKER_SIZE,
  TITLE_BAR_HEIGHT,
  TITLE_BAR_WIDTH,
  TITLE_FONT_SIZE_PX,
  TITLE_TEXT_PADDING_X,
  getIconBoxCardFrameWidth,
  getIconBoxContainerReticlePosition,
  getIconBox2x1IconDecorationSlots,
  getIconBoxDecorationInset,
  getIconBoxEdgeTickRects,
  type IconBoxDecorationSlot,
  getIconBoxInnerWidth,
  getIconBoxTitleBarLayout,
  type IconBoxContainerReticleCorner,
} from "../../../lib/icon-box/layout";
import { paletteBrush } from "../../../theme/palette";
import { buildIconBox2x1CenterStroke } from "./iconBox2x1CenterStroke";
import { rasterizeIcon } from "./iconRaster";
import type { IconBoxAnimHandles } from "./iconBoxLineEnableCoordinator";

const ICON_RASTER_WHITE = "#FFFFFF";

const CARD_SHADOW_CSS =
  "0 12px 24px rgba(0, 0, 0, 0.04), 0 6px 12px rgba(0, 0, 0, 0.02), 0 3px 6px rgba(0, 0, 0, 0.01)";

/** Accent underline glow: layers match design drop-shadow stack; RGB follows palette accent (`fillRgb`). */
const buildAccentBarShadowFilter = (fillRgb: number) =>
  new BoxShadowFilter({
    shapeMode: "box",
    borderRadius: 0,
    shadows: [
      { offsetX: 0, offsetY: 4, blur: 12, spread: 0, color: fillRgb, alpha: 0.48, inset: false },
      { offsetX: 0, offsetY: 2, blur: 4, spread: 0, color: fillRgb, alpha: 0.12, inset: false },
      { offsetX: 0, offsetY: 1, blur: 1, spread: 0, color: fillRgb, alpha: 0.16, inset: false },
      {
        offsetX: 0,
        offsetY: 0.5,
        blur: 0.5,
        spread: 0,
        color: fillRgb,
        alpha: 0.12,
        inset: false,
      },
    ] satisfies BoxShadowOptions[],
  });

/**
 * CSS `drop-shadow(0 oy blur ...)` analogue; blur uses box-shadow semantics (sigma = blur/2).
 * pixi-box-shadow texture mode skips the Gaussian pass when blur < 1 (sigma < 0.5), so the
 * sub-1px blur from design is bumped to >=1 while keeping offsets.
 */
const buildIconShadowFilter = (iconColorHex: number) =>
  new BoxShadowFilter({
    shapeMode: "texture",
    quality: 4,
    shadows: [
      {
        offsetX: 0,
        offsetY: 0.5,
        blur: 1,
        spread: 0,
        color: iconColorHex,
        alpha: 0.12,
        inset: false,
      },
      {
        offsetX: 0,
        offsetY: 1,
        blur: 2,
        spread: 0,
        color: iconColorHex,
        alpha: 0.12,
        inset: false,
      },
    ] satisfies BoxShadowOptions[],
  });

/** 22x22 focus reticle at local (0,0); matches reference SVG (Graphics fills, not SVG). */
const CONTAINER_RETICLE_PX = 22;

/** In chrome layer: above structural `cardFrame` (separate layer), below white shadow card. */
const CONTAINER_RETICLE_Z_INDEX = 18;

/** 22x22 reticle; white disk; center dot uses theme fill; ticks use grid stroke. */
const buildContainerCornerReticle = (tickColor: number, centerDotColor: number): Graphics => {
  const g = new Graphics();
  g.roundRect(0, 0, CONTAINER_RETICLE_PX, CONTAINER_RETICLE_PX, 11).fill({ color: 0xffffff });
  g.rect(10.5, 4, 1, 2).fill({ color: tickColor });
  g.rect(10.5, 16, 1, 2).fill({ color: tickColor });
  g.rect(4, 10.5, 2, 1).fill({ color: tickColor });
  g.rect(16, 10.5, 2, 1).fill({ color: tickColor });
  g.roundRect(10, 10, 2, 2, 1).fill({ color: centerDotColor });
  return g;
};

export type IconBoxDisplayParts = {
  structureRoot: Container;
  chromeRoot: Container;
  /**
   * Moves on connector pulses: shadow card, inner corner squares, icons only —
   * title strip, outer selection reticles (chrome), and shiny accent bars stay fixed.
   */
  innerBodyMotionRoot: Container;
  animHandles: IconBoxAnimHandles;
  disposeCenterStrokeAnim?: () => void;
};

export type IconBoxRenderableInstance = Extract<ComponentInstance, { type: "icon-box" | "icon-box-2x1" }>;

export const buildIconBox = (
  instance: IconBoxRenderableInstance,
  gridStrokeColor: number,
  gridStrokeHex: string,
): IconBoxDisplayParts => {
  const variant = instance.type;
  const titleRefWidth = variant === "icon-box-2x1" ? ICON_BOX_2X1_TITLE_REFERENCE_WIDTH : TITLE_BAR_WIDTH;
  const innerW = getIconBoxInnerWidth(variant);
  const frameW = getIconBoxCardFrameWidth(variant);
  /** Frame origin X aligns with padded outer stroke (matches 1×1: inner offset − selection padding). */
  const frameOriginX = ICON_BOX_INNER_OFFSET - 8;

  const structureRoot = new Container();
  structureRoot.position.set(instance.x, instance.y);

  const chromeRoot = new Container();
  chromeRoot.sortableChildren = true;
  chromeRoot.position.set(instance.x, instance.y);

  const neutralSync = { neutralFillSyncHex: gridStrokeHex };
  const brush = paletteBrush(instance.props.theme, neutralSync);
  let { rectWidth, barLeft } = getIconBoxTitleBarLayout(instance.props.title, titleRefWidth);

  const titleLabel = new Text({
    text: instance.props.title.toUpperCase(),
    style: {
      fontFamily: ICON_BOX_TITLE_FONT_FAMILY,
      fontSize: TITLE_FONT_SIZE_PX,
      fontWeight: "400",
      fill: brush.fillTextHex,
      align: "center",
      wordWrap: false,
    },
  });
  titleLabel.anchor.set(0.5);

  /** Prefer live Pixi metrics when they exceed canvas `measureText` (e.g. font substitutions). */
  const pixiInner = titleLabel.width;
  if (pixiInner + TITLE_TEXT_PADDING_X * 2 > rectWidth) {
    rectWidth = Math.ceil(pixiInner + TITLE_TEXT_PADDING_X * 2);
    barLeft = (titleRefWidth - rectWidth) / 2;
  }

  const titleBg = new Graphics();
  titleBg.zIndex = 30;
  titleBg.rect(barLeft, 0, rectWidth, TITLE_BAR_HEIGHT).fill({ color: brush.fill });
  chromeRoot.addChild(titleBg);

  titleLabel.zIndex = 31;
  titleLabel.position.set(barLeft + rectWidth / 2, TITLE_BAR_HEIGHT / 2);
  chromeRoot.addChild(titleLabel);

  const shadowFilter = new BoxShadowFilter({
    boxShadow: CARD_SHADOW_CSS,
    borderRadius: ICON_BOX_RADIUS,
  });

  const innerBodyMotionRoot = new Container();
  innerBodyMotionRoot.sortableChildren = true;
  innerBodyMotionRoot.zIndex = 23;

  /** Outer selection-frame corners: stacked under shadow card chrome, stationary on pulse hits. */
  const outerReticlesRoot = new Container();
  outerReticlesRoot.sortableChildren = true;
  outerReticlesRoot.zIndex = 22;

  /** Bottom accent shimmer bars: stationary under pulse tilt. Populated below when themed. */
  const accentBarsRoot = new Container();
  accentBarsRoot.sortableChildren = true;
  accentBarsRoot.zIndex = 24;

  /**
   * Filter + cache live on the **same leaf** (`cacheAsTexture` on this node, not on `chromeRoot`).
   * Placement uses draw coords at default `.position (0,0)`; grid translation is only `chromeRoot.position`,
   * so filter bounds stay in **local** space — avoids stacking filter offsets with `chromeRoot` translation.
   */
  const cardFill = new Graphics();
  cardFill.zIndex = 25;
  cardFill
    .roundRect(ICON_BOX_INNER_OFFSET, ICON_BOX_INNER_TOP, innerW, ICON_BOX_INNER_SIZE, ICON_BOX_RADIUS)
    .fill({ color: 0xffffff });
  cardFill.filters = [shadowFilter];

  const cardStroke = new Graphics();
  cardStroke.zIndex = 26;
  cardStroke
    .roundRect(ICON_BOX_INNER_OFFSET, ICON_BOX_INNER_TOP, innerW, ICON_BOX_INNER_SIZE, ICON_BOX_RADIUS)
    .stroke({ width: 1, color: 0x000000, alpha: 0.04 });

  innerBodyMotionRoot.addChild(cardFill);
  innerBodyMotionRoot.addChild(cardStroke);

  /** Selection-frame stroke uses the same color as the logical grid (`grid.config.strokeColor`). */
  const cardFrame = new Graphics();
  cardFrame
    .rect(frameOriginX + 0.5, ICON_BOX_CARD_FRAME_ORIGIN_Y + 0.5, frameW, ICON_BOX_CARD_FRAME_SIZE)
    .stroke({ width: 1, color: gridStrokeColor });
  structureRoot.addChild(cardFrame);

  chromeRoot.addChild(outerReticlesRoot);
  chromeRoot.addChild(innerBodyMotionRoot);

  const markers = new Graphics();
  markers.zIndex = 40;
  const rectOriginX = ICON_BOX_INNER_OFFSET;
  const rectOriginY = ICON_BOX_INNER_TOP;
  const rectInnerW = innerW;
  const rectSize = ICON_BOX_INNER_SIZE;

  const decorationSlots: IconBoxDecorationSlot[] =
    variant === "icon-box-2x1"
      ? getIconBox2x1IconDecorationSlots()
      : [{ ox: rectOriginX, oy: rectOriginY, w: rectInnerW, h: rectSize }];

  const paintCornerMarkers = (cornerPackedRgb: number) => {
    markers.clear();
    for (const { ox, oy, w, h } of decorationSlots) {
      const inset = getIconBoxDecorationInset(w, h);
      const markerMaxX = w - inset - MARKER_SIZE;
      const markerMaxY = h - inset - MARKER_SIZE;
      const cellCorners: [number, number][] = [
        [ox + inset, oy + inset],
        [ox + markerMaxX, oy + inset],
        [ox + inset, oy + markerMaxY],
        [ox + markerMaxX, oy + markerMaxY],
      ];
      for (const [mx, my] of cellCorners) {
        markers.roundRect(mx, my, MARKER_SIZE, MARKER_SIZE, 1).fill({ color: cornerPackedRgb });
      }
    }
  };

  const cornerBrush = instance.props.matchCornersWithTheme ? brush : paletteBrush("neutral", neutralSync);
  paintCornerMarkers(cornerBrush.fill);

  const edgeTicks = new Graphics();
  edgeTicks.zIndex = 39;
  for (const { ox, oy, w, h } of decorationSlots) {
    const inset = getIconBoxDecorationInset(w, h);
    for (const tick of getIconBoxEdgeTickRects(ox, oy, w, h, inset)) {
      edgeTicks.rect(tick.x, tick.y, tick.width, tick.height).fill({ color: gridStrokeColor });
    }
  }
  innerBodyMotionRoot.addChild(edgeTicks);
  innerBodyMotionRoot.addChild(markers);

  let disposeCenterStrokeAnim: (() => void) | undefined;
  if (variant === "icon-box-2x1") {
    const { strokeRoot, disposeCenterStrokeAnim: disposeStroke } = buildIconBox2x1CenterStroke(brush.fill);
    /** After markers so zIndex 41 stacks above ticks (39) when sortableChildren is on. */
    innerBodyMotionRoot.addChild(strokeRoot);
    disposeCenterStrokeAnim = disposeStroke;
  }

  const icon = getIconDefinition(instance.props.iconId);
  const iconRgb = brush.iconFill;
  const iconSprites: Sprite[] = [];

  const addIconAt = (holdX: number) => {
    const iconSprite = Sprite.from(rasterizeIcon(icon, ICON_RASTER_WHITE), true);
    iconSprite.width = 24;
    iconSprite.height = 24;
    iconSprite.tint = iconRgb;

    /** Grid / slot placement only — keep filters off this positioned node (see `iconFiltered`). */
    const iconHold = new Container();
    iconHold.zIndex = 50;
    iconHold.position.set(holdX, ICON_BOX_INNER_TOP + ICON_HOLD_OFFSET_Y_INNER);

    const iconFiltered = new Container();
    iconFiltered.filters = [buildIconShadowFilter(iconRgb)];
    iconFiltered.addChild(iconSprite);
    iconHold.addChild(iconFiltered);
    /** No `cacheAsTexture` here — line-enable tweens `sprite.tint`; cached parent would freeze the glyph gray. */

    innerBodyMotionRoot.addChild(iconHold);
    iconSprites.push(iconSprite);
  };

  if (variant === "icon-box-2x1") {
    addIconAt(ICON_HOLD_OFFSET_X);
    addIconAt(ICON_HOLD_OFFSET_X_SECOND);
  } else {
    addIconAt(ICON_HOLD_OFFSET_X);
  }

  const accentScaleRoots: IconBoxAnimHandles["accentScaleRoots"] = [];

  if (instance.props.theme !== "neutral") {
    const accentFillRgb = brush.fill;
    const accentTop = ICON_BOX_INNER_TOP + ICON_BOX_INNER_SIZE + ICON_BOX_ACCENT_BAR_GAP;

    const mkAccent = (centerX: number) => {
      const scaleRoot = new Container();
      scaleRoot.zIndex = 60;
      scaleRoot.position.set(centerX, accentTop + ICON_BOX_ACCENT_BAR_HEIGHT / 2);
      const gfx = new Graphics();
      gfx
        .rect(
          -ICON_BOX_ACCENT_BAR_WIDTH / 2,
          -ICON_BOX_ACCENT_BAR_HEIGHT / 2,
          ICON_BOX_ACCENT_BAR_WIDTH,
          ICON_BOX_ACCENT_BAR_HEIGHT,
        )
        .fill({
          color: accentFillRgb,
          alpha: 1,
        });
      gfx.filters = [buildAccentBarShadowFilter(accentFillRgb)];
      scaleRoot.addChild(gfx);
      gfx.cacheAsTexture(true);
      accentBarsRoot.addChild(scaleRoot);
      accentScaleRoots.push({ scaleRoot });
    };

    if (variant === "icon-box-2x1") {
      const l = LARGE_CELL_SIZE / 2 - ICON_BOX_ACCENT_BAR_WIDTH / 2;
      const r = LARGE_CELL_SIZE + LARGE_CELL_SIZE / 2 - ICON_BOX_ACCENT_BAR_WIDTH / 2;
      mkAccent(l + ICON_BOX_ACCENT_BAR_WIDTH / 2);
      mkAccent(r + ICON_BOX_ACCENT_BAR_WIDTH / 2);
    } else {
      const accentLeft = ICON_BOX_INNER_OFFSET + (ICON_BOX_INNER_SIZE - ICON_BOX_ACCENT_BAR_WIDTH) / 2;
      mkAccent(accentLeft + ICON_BOX_ACCENT_BAR_WIDTH / 2);
    }
    chromeRoot.addChild(accentBarsRoot);
  }

  cardFill.cacheAsTexture(true);

  if (instance.props.containerHighlighted) {
    const corners: IconBoxContainerReticleCorner[] = ["tl", "tr", "bl", "br"];
    for (const corner of corners) {
      const reticle = buildContainerCornerReticle(gridStrokeColor, brush.fill);
      reticle.zIndex = CONTAINER_RETICLE_Z_INDEX;
      const pos = getIconBoxContainerReticlePosition(corner, rectOriginX, rectOriginY, rectInnerW, rectSize);
      reticle.position.set(pos.x, pos.y);
      outerReticlesRoot.addChild(reticle);
    }
  }

  const animHandles: IconBoxAnimHandles = {
    instance,
    titleLabel,
    titleBg,
    titleBarLayout: { barLeft, rectWidth },
    iconSprites,
    markersRedraw: paintCornerMarkers,
    accentScaleRoots,
  };

  return { structureRoot, chromeRoot, innerBodyMotionRoot, animHandles, disposeCenterStrokeAnim };
};
