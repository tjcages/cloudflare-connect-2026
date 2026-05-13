import { BoxShadowFilter, type BoxShadowOptions } from "pixi-box-shadow";
import { Container, Graphics, Sprite, Text } from "pixi.js";
import type { Ticker } from "../../../components/pixi";
import { ICON_BOX_TITLE_FONT_FAMILY } from "../../../fonts/iconBoxTitle";
import { getIconDefinition } from "../../../components/iconRegistry";
import type { ComponentInstance } from "../../../grid/types";
import { parseHexColor } from "../../color";
import { paletteBrush } from "../../../theme/palette";
import { useAppStore } from "../../../store";
import { rasterizeIcon } from "./iconRaster";
import {
  ICON_BOX_ACCENT_BAR_GAP,
  ICON_BOX_ACCENT_BAR_HEIGHT,
  ICON_BOX_ACCENT_BAR_WIDTH,
  ICON_BOX_CARD_FRAME_ORIGIN_X,
  ICON_BOX_CARD_FRAME_ORIGIN_Y,
  ICON_BOX_CARD_FRAME_SIZE,
  ICON_BOX_INNER_OFFSET,
  ICON_BOX_INNER_SIZE,
  ICON_BOX_INNER_TOP,
  ICON_BOX_RADIUS,
  ICON_HOLD_OFFSET_X,
  ICON_HOLD_OFFSET_Y_INNER,
  MARKER_INSET,
  MARKER_SIZE,
  TITLE_BAR_HEIGHT,
  TITLE_BAR_WIDTH,
  TITLE_FONT_SIZE_PX,
  TITLE_TEXT_PADDING_X,
  getIconBoxTitleBarLayout,
} from "../../../components/iconBoxLayout";

const CARD_SHADOW_CSS =
  "0 12px 24px rgba(0, 0, 0, 0.04), 0 6px 12px rgba(0, 0, 0, 0.02), 0 3px 6px rgba(0, 0, 0, 0.01)";

/** Accent underline glow: layers and alphas match design rgba(); RGB follows palette accent (`fillRgb`). */
const buildAccentBarShadowFilter = (fillRgb: number) =>
  new BoxShadowFilter({
    shapeMode: "box",
    borderRadius: 0,
    shadows: [
      { offsetX: 0, offsetY: 4, blur: 12, spread: 0, color: fillRgb, alpha: 0.32, inset: false },
      { offsetX: 0, offsetY: 2, blur: 4, spread: 0, color: fillRgb, alpha: 0.12, inset: false },
      { offsetX: 0, offsetY: 1, blur: 1, spread: 0, color: fillRgb, alpha: 0.16, inset: false },
      {
        offsetX: 0,
        offsetY: 0.5,
        blur: 1,
        spread: 0,
        color: fillRgb,
        alpha: 0.12,
        inset: false,
      },
    ] satisfies BoxShadowOptions[],
  });

/** CSS `drop-shadow(0 oy blur …)` analogue; blur uses box-shadow semantics (sigma = blur/2).
 * pixi-box-shadow texture mode skips the Gaussian pass when blur < 1 (sigma < 0.5), so the
 * sub‑1px blur from design is bumped to ≥1 while keeping offsets. */
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

/** 22×22 focus reticle at local (0,0); matches reference SVG (Graphics fills, not SVG). */
const CONTAINER_RETICLE_PX = 22;
const CONTAINER_RETICLE_HALF = CONTAINER_RETICLE_PX / 2;
/** Offset from each selection-frame corner to reticle center along X/Y toward the frame interior. */
const CONTAINER_RETICLE_CORNER_INSET = 0;

/** Align reticle art with grid strokes (sub-pixel shift for all four corners). */
const CONTAINER_RETICLE_POSITION_NUDGE = 0.5;

/** Above outer grid frame stroke, below white shadow card (see `buildIconBox` zIndex tiers). */
const CONTAINER_RETICLE_Z_INDEX = 18;

/** 22×22 reticle; white disk; center dot uses theme fill; ticks use grid stroke. */
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

const buildIconBox = (instance: ComponentInstance, gridStrokeColor: number) => {
  const root = new Container();
  root.sortableChildren = true;
  root.position.set(instance.x, instance.y);

  const brush = paletteBrush(instance.props.theme);
  let { rectWidth, barLeft } = getIconBoxTitleBarLayout(instance.props.title);

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
    barLeft = (TITLE_BAR_WIDTH - rectWidth) / 2;
  }

  const titleBg = new Graphics();
  titleBg.zIndex = 30;
  titleBg.rect(barLeft, 0, rectWidth, TITLE_BAR_HEIGHT).fill({ color: brush.fill });
  root.addChild(titleBg);

  titleLabel.zIndex = 31;
  titleLabel.position.set(barLeft + rectWidth / 2, TITLE_BAR_HEIGHT / 2);
  root.addChild(titleLabel);

  const shadowFilter = new BoxShadowFilter({
    boxShadow: CARD_SHADOW_CSS,
    borderRadius: ICON_BOX_RADIUS,
  });

  const cardFill = new Graphics();
  cardFill.zIndex = 25;
  cardFill
    .roundRect(ICON_BOX_INNER_OFFSET, ICON_BOX_INNER_TOP, ICON_BOX_INNER_SIZE, ICON_BOX_INNER_SIZE, ICON_BOX_RADIUS)
    .fill({ color: 0xffffff });
  cardFill.filters = [shadowFilter];

  const cardStroke = new Graphics();
  cardStroke.zIndex = 26;
  cardStroke
    .roundRect(ICON_BOX_INNER_OFFSET, ICON_BOX_INNER_TOP, ICON_BOX_INNER_SIZE, ICON_BOX_INNER_SIZE, ICON_BOX_RADIUS)
    .stroke({ width: 1, color: 0x000000, alpha: 0.04 });

  /** Selection-frame stroke uses the same color as the logical grid (`grid.config.strokeColor`). */
  const cardFrame = new Graphics();
  cardFrame.zIndex = 15;
  cardFrame
    .rect(
      ICON_BOX_CARD_FRAME_ORIGIN_X + 0.5,
      ICON_BOX_CARD_FRAME_ORIGIN_Y + 0.5,
      ICON_BOX_CARD_FRAME_SIZE,
      ICON_BOX_CARD_FRAME_SIZE,
    )
    .stroke({ width: 1, color: gridStrokeColor });

  root.addChild(cardFill);
  root.addChild(cardStroke);
  root.addChild(cardFrame);

  const markers = new Graphics();
  markers.zIndex = 40;
  const rectOriginX = ICON_BOX_INNER_OFFSET;
  const rectOriginY = ICON_BOX_INNER_TOP;
  const rectSize = ICON_BOX_INNER_SIZE;
  const markerMax = rectSize - MARKER_INSET - MARKER_SIZE;
  const corners: [number, number][] = [
    [rectOriginX + MARKER_INSET, rectOriginY + MARKER_INSET],
    [rectOriginX + markerMax, rectOriginY + MARKER_INSET],
    [rectOriginX + MARKER_INSET, rectOriginY + markerMax],
    [rectOriginX + markerMax, rectOriginY + markerMax],
  ];

  const cornerBrush = instance.props.matchCornersWithTheme ? brush : paletteBrush("neutral");
  for (const [mx, my] of corners) {
    markers.roundRect(mx, my, MARKER_SIZE, MARKER_SIZE, 1).fill({ color: cornerBrush.fill });
  }
  root.addChild(markers);

  const icon = getIconDefinition(instance.props.iconId);
  const iconRgb = brush.iconFill;
  const iconSprite = Sprite.from(rasterizeIcon(icon, brush.iconFillHex), true);
  iconSprite.width = 24;
  iconSprite.height = 24;

  const iconHold = new Container();
  iconHold.zIndex = 50;
  iconHold.position.set(ICON_HOLD_OFFSET_X, ICON_BOX_INNER_TOP + ICON_HOLD_OFFSET_Y_INNER);
  iconHold.filters = [buildIconShadowFilter(iconRgb)];
  iconHold.addChild(iconSprite);

  root.addChild(iconHold);

  if (instance.props.theme !== "neutral") {
    const accentLeft = ICON_BOX_INNER_OFFSET + (ICON_BOX_INNER_SIZE - ICON_BOX_ACCENT_BAR_WIDTH) / 2;
    const accentTop = ICON_BOX_INNER_TOP + ICON_BOX_INNER_SIZE + ICON_BOX_ACCENT_BAR_GAP;
    const accentFillRgb = brush.fill;
    const accentBar = new Graphics();
    accentBar.zIndex = 60;
    accentBar
      .rect(accentLeft, accentTop, ICON_BOX_ACCENT_BAR_WIDTH, ICON_BOX_ACCENT_BAR_HEIGHT)
      .fill({ color: accentFillRgb, alpha: 1 });
    accentBar.filters = [buildAccentBarShadowFilter(accentFillRgb)];
    root.addChild(accentBar);
  }

  if (instance.props.containerHighlighted) {
    const ox = ICON_BOX_CARD_FRAME_ORIGIN_X;
    const oy = ICON_BOX_CARD_FRAME_ORIGIN_Y;
    const sz = ICON_BOX_CARD_FRAME_SIZE;
    const inset = CONTAINER_RETICLE_CORNER_INSET;
    const cornerCenters: [number, number][] = [
      [ox + inset, oy + inset],
      [ox + sz - inset, oy + inset],
      [ox + inset, oy + sz - inset],
      [ox + sz - inset, oy + sz - inset],
    ];
    for (const [cx, cy] of cornerCenters) {
      const reticle = buildContainerCornerReticle(gridStrokeColor, brush.fill);
      reticle.zIndex = CONTAINER_RETICLE_Z_INDEX;
      reticle.position.set(
        cx - CONTAINER_RETICLE_HALF + CONTAINER_RETICLE_POSITION_NUDGE,
        cy - CONTAINER_RETICLE_HALF + CONTAINER_RETICLE_POSITION_NUDGE,
      );
      root.addChild(reticle);
    }
  }

  return root;
};

export const setupIconBoxLayer: Ticker = ({ app, cleanup }) => {
  const layer = new Container();
  app.stage.addChild(layer);

  const rebuild = () => {
    for (const child of [...layer.children]) {
      child.destroy({ children: true });
    }

    const { instances, dragState, grid } = useAppStore.getState();
    const gridStrokeColor = parseHexColor(grid.config.strokeColor);
    const previewInstance = dragState?.mode === "create" ? dragState.preview : null;
    const toDraw = previewInstance === null ? instances : [...instances, previewInstance];

    for (const instance of toDraw) {
      layer.addChild(buildIconBox(instance, gridStrokeColor));
    }

    app.render();
  };

  rebuild();

  const unsub = useAppStore.subscribe((state, prev) => {
    if (state.instances !== prev.instances || state.dragState !== prev.dragState || state.grid !== prev.grid) {
      rebuild();
    }
  });

  cleanup(() => {
    unsub();
    layer.destroy(true);
  });
};
