import { BoxShadowFilter, type BoxShadowOptions } from "pixi-box-shadow";
import { Container, Graphics, Sprite, Text } from "pixi.js";
import { ICON_BOX_TITLE_FONT_FAMILY } from "../../../fonts/iconBoxTitle";
import type { ComponentInstance } from "../../../grid/types";
import { getIconDefinition } from "../../../lib/iconRegistry";
import {
  ICON_BOX_ACCENT_BAR_GAP,
  ICON_BOX_ACCENT_BAR_HEIGHT,
  ICON_BOX_ACCENT_BAR_WIDTH,
  ICON_BOX_CARD_FRAME_ORIGIN_Y,
  ICON_BOX_INNER_OFFSET,
  ICON_BOX_INNER_SIZE,
  ICON_BOX_INNER_TOP,
  ICON_BOX_RADIUS,
  MARKER_SIZE,
  TITLE_BAR_HEIGHT,
  TITLE_FONT_SIZE_PX,
  TITLE_TEXT_PADDING_X,
  getIconBoxCardFrameWidth,
  getIconBoxCardFrameHeight,
  getIconBoxContainerReticlePosition,
  getIconBoxHorizontalAccentCenterX,
  getIconBoxIconDecorationSlots,
  getIconBoxIconHolds,
  getIconBoxDecorationInset,
  getIconBoxEdgeTickRects,
  getIconBoxInnerWidth,
  getIconBoxInnerHeight,
  getIconBoxTitleReferenceWidth,
  getIconBoxTitleBarLayout,
  resolveIconBoxLayout,
  type IconBoxContainerReticleCorner,
} from "../../../lib/icon-box/layout";
import { paletteBrush } from "../../../theme/palette";
import { buildIconBoxCenterStrokes } from "./iconBoxCenterStroke";
import { rasterizeIcon } from "./iconRaster";
import type { IconBoxAnimHandles } from "./iconBoxLineEnableCoordinator";

const ICON_RASTER_WHITE = "#FFFFFF";

const CARD_SHADOW_CSS =
  "0 12px 24px rgba(0, 0, 0, 0.04), 0 6px 12px rgba(0, 0, 0, 0.02), 0 3px 6px rgba(0, 0, 0, 0.01)";

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

const CONTAINER_RETICLE_PX = 22;
const CONTAINER_RETICLE_Z_INDEX = 18;

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
  innerBodyMotionRoot: Container;
  animHandles: IconBoxAnimHandles;
  disposeCenterStrokeAnim?: () => void;
};

export type IconBoxRenderableInstance = Extract<ComponentInstance, { type: "icon-box" }>;

export const buildIconBox = (
  instance: IconBoxRenderableInstance,
  gridStrokeColor: number,
  gridStrokeHex: string,
): IconBoxDisplayParts => {
  const spec = resolveIconBoxLayout(instance.props);
  const titleRefWidth = getIconBoxTitleReferenceWidth(spec);
  const innerW = getIconBoxInnerWidth(spec);
  const innerH = getIconBoxInnerHeight(spec);
  const frameW = getIconBoxCardFrameWidth(spec);
  const frameH = getIconBoxCardFrameHeight(spec);
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

  const outerReticlesRoot = new Container();
  outerReticlesRoot.sortableChildren = true;
  outerReticlesRoot.zIndex = 22;

  const accentBarsRoot = new Container();
  accentBarsRoot.sortableChildren = true;
  accentBarsRoot.zIndex = 24;

  const cardFill = new Graphics();
  cardFill.zIndex = 25;
  cardFill
    .roundRect(ICON_BOX_INNER_OFFSET, ICON_BOX_INNER_TOP, innerW, innerH, ICON_BOX_RADIUS)
    .fill({ color: 0xffffff });
  cardFill.filters = [shadowFilter];

  const cardStroke = new Graphics();
  cardStroke.zIndex = 26;
  cardStroke
    .roundRect(ICON_BOX_INNER_OFFSET, ICON_BOX_INNER_TOP, innerW, innerH, ICON_BOX_RADIUS)
    .stroke({ width: 1, color: 0x000000, alpha: 0.04 });

  innerBodyMotionRoot.addChild(cardFill);
  innerBodyMotionRoot.addChild(cardStroke);

  const cardFrame = new Graphics();
  cardFrame
    .rect(frameOriginX + 0.5, ICON_BOX_CARD_FRAME_ORIGIN_Y + 0.5, frameW, frameH)
    .stroke({ width: 1, color: gridStrokeColor });
  structureRoot.addChild(cardFrame);

  chromeRoot.addChild(outerReticlesRoot);
  chromeRoot.addChild(innerBodyMotionRoot);

  const markers = new Graphics();
  markers.zIndex = 40;
  const rectOriginX = ICON_BOX_INNER_OFFSET;
  const rectOriginY = ICON_BOX_INNER_TOP;
  const rectInnerW = innerW;
  const rectInnerH = innerH;

  const decorationSlots = getIconBoxIconDecorationSlots(spec);

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
  if (spec.length >= 2) {
    const { strokeRoots, disposeCenterStrokeAnim: disposeStroke } = buildIconBoxCenterStrokes(
      spec,
      spec.direction,
      brush.fill,
    );
    for (const strokeRoot of strokeRoots) {
      innerBodyMotionRoot.addChild(strokeRoot);
    }
    disposeCenterStrokeAnim = disposeStroke;
  }

  const icon = getIconDefinition(instance.props.iconId);
  const iconRgb = brush.iconFill;
  const iconSprites: Sprite[] = [];

  const addIconAt = (holdX: number, holdY: number) => {
    const iconSprite = Sprite.from(rasterizeIcon(icon, ICON_RASTER_WHITE), true);
    iconSprite.width = 24;
    iconSprite.height = 24;
    iconSprite.tint = iconRgb;

    const iconHold = new Container();
    iconHold.zIndex = 50;
    iconHold.position.set(holdX, holdY);

    const iconFiltered = new Container();
    iconFiltered.filters = [buildIconShadowFilter(iconRgb)];
    iconFiltered.addChild(iconSprite);
    iconHold.addChild(iconFiltered);

    innerBodyMotionRoot.addChild(iconHold);
    iconSprites.push(iconSprite);
  };

  for (const { holdX, holdY } of getIconBoxIconHolds(spec)) {
    addIconAt(holdX, holdY);
  }

  const accentScaleRoots: IconBoxAnimHandles["accentScaleRoots"] = [];

  if (instance.props.theme !== "neutral") {
    const accentFillRgb = brush.fill;
    const accentTop = ICON_BOX_INNER_TOP + innerH + ICON_BOX_ACCENT_BAR_GAP;

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
        .fill({ color: accentFillRgb, alpha: 1 });
      gfx.filters = [buildAccentBarShadowFilter(accentFillRgb)];
      scaleRoot.addChild(gfx);
      gfx.cacheAsTexture(true);
      accentBarsRoot.addChild(scaleRoot);
      accentScaleRoots.push({ scaleRoot });
    };

    if (spec.direction === "horizontal" && spec.length > 1) {
      for (let i = 0; i < spec.length; i++) {
        mkAccent(getIconBoxHorizontalAccentCenterX(i));
      }
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
      const pos = getIconBoxContainerReticlePosition(corner, rectOriginX, rectOriginY, rectInnerW, rectInnerH);
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
