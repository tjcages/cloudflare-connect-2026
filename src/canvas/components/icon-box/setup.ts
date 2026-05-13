import { BoxShadowFilter, type BoxShadowOptions } from "pixi-box-shadow";
import { Container, Graphics, Sprite, Text } from "pixi.js";
import type { Ticker } from "../../../components/pixi";
import { ICON_BOX_TITLE_FONT_FAMILY } from "../../../fonts/iconBoxTitle";
import { getIconDefinition } from "../../../components/iconRegistry";
import type { ComponentInstance } from "../../../grid/types";
import { paletteBrush } from "../../../theme/palette";
import { parseHexColor } from "../../color";
import { useAppStore } from "../../../store";
import { rasterizeIcon } from "./iconRaster";
import {
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
  TITLE_TEXT_INNER_MAX_WIDTH,
  TITLE_TEXT_PADDING_X,
} from "../../../components/iconBoxLayout";

const CARD_SHADOW_CSS =
  "0 12px 24px rgba(0, 0, 0, 0.04), 0 6px 12px rgba(0, 0, 0, 0.02), 0 3px 6px rgba(0, 0, 0, 0.01)";

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

const buildIconBox = (instance: ComponentInstance) => {
  const root = new Container();
  root.position.set(instance.x, instance.y);

  const brush = paletteBrush(instance.props.theme);
  const titleLabel = new Text({
    text: instance.props.titleText.toUpperCase(),
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

  const rawTextWidth = titleLabel.width;
  const maxInner = TITLE_TEXT_INNER_MAX_WIDTH;
  /** Scale down single-line titles instead of masking — Graphics masks often hide Canvas Text incorrectly in Pixi v8. */
  const scale = rawTextWidth > maxInner ? maxInner / rawTextWidth : 1;
  titleLabel.scale.set(scale);

  const fittedInnerWidth = rawTextWidth * scale;
  const rectWidth = Math.min(Math.ceil(fittedInnerWidth + TITLE_TEXT_PADDING_X * 2), TITLE_BAR_WIDTH);
  const barLeft = (TITLE_BAR_WIDTH - rectWidth) / 2;

  const titleBg = new Graphics();
  titleBg.rect(barLeft, 0, rectWidth, TITLE_BAR_HEIGHT).fill({ color: brush.fill });
  root.addChild(titleBg);

  titleLabel.position.set(barLeft + rectWidth / 2, TITLE_BAR_HEIGHT / 2);
  root.addChild(titleLabel);

  const shadowFilter = new BoxShadowFilter({
    boxShadow: CARD_SHADOW_CSS,
    borderRadius: ICON_BOX_RADIUS,
  });

  const cardFill = new Graphics();
  cardFill
    .roundRect(ICON_BOX_INNER_OFFSET, ICON_BOX_INNER_TOP, ICON_BOX_INNER_SIZE, ICON_BOX_INNER_SIZE, ICON_BOX_RADIUS)
    .fill({ color: 0xffffff });
  cardFill.filters = [shadowFilter];

  const cardStroke = new Graphics();
  cardStroke
    .roundRect(ICON_BOX_INNER_OFFSET, ICON_BOX_INNER_TOP, ICON_BOX_INNER_SIZE, ICON_BOX_INNER_SIZE, ICON_BOX_RADIUS)
    .stroke({ width: 1, color: 0x000000, alpha: 0.04 });

  root.addChild(cardFill);
  root.addChild(cardStroke);

  const markers = new Graphics();
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

  const cornerColor = parseHexColor(instance.props.cornerColor);
  for (const [mx, my] of corners) {
    markers.roundRect(mx, my, MARKER_SIZE, MARKER_SIZE, 1).fill({ color: cornerColor });
  }
  root.addChild(markers);

  const icon = getIconDefinition(instance.props.iconId);
  const iconRgb = brush.iconFill;
  const iconSprite = Sprite.from(rasterizeIcon(icon, brush.iconFillHex), true);
  iconSprite.width = 24;
  iconSprite.height = 24;

  const iconHold = new Container();
  iconHold.position.set(ICON_HOLD_OFFSET_X, ICON_BOX_INNER_TOP + ICON_HOLD_OFFSET_Y_INNER);
  iconHold.filters = [buildIconShadowFilter(iconRgb)];
  iconHold.addChild(iconSprite);

  root.addChild(iconHold);

  return root;
};

export const setupIconBoxLayer: Ticker = ({ app, cleanup }) => {
  const layer = new Container();
  app.stage.addChild(layer);

  const rebuild = () => {
    for (const child of [...layer.children]) {
      child.destroy({ children: true });
    }

    const { instances, dragState } = useAppStore.getState();
    const previewInstance = dragState?.mode === "create" ? dragState.preview : null;
    const toDraw = previewInstance === null ? instances : [...instances, previewInstance];

    for (const instance of toDraw) {
      layer.addChild(buildIconBox(instance));
    }

    app.render();
  };

  rebuild();

  const unsub = useAppStore.subscribe((state, prev) => {
    if (state.instances !== prev.instances || state.dragState !== prev.dragState) {
      rebuild();
    }
  });

  cleanup(() => {
    unsub();
    layer.destroy(true);
  });
};
