import { BoxShadowFilter, type BoxShadowOptions } from "pixi-box-shadow";
import { Container, Graphics, GraphicsPath } from "pixi.js";
import type { Ticker } from "../../../components/pixi";
import { getIconDefinition } from "../../../components/iconRegistry";
import type { ComponentInstance } from "../../../grid/types";
import { parseHexColor } from "../../color";
import { useAppStore } from "../../../store";
import {
  ICON_BOX_INNER_OFFSET,
  ICON_BOX_INNER_SIZE,
  ICON_BOX_RADIUS,
  ICON_ORIGIN_OFFSET,
  MARKER_INSET,
  MARKER_SIZE,
} from "./definition";

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

  const shadowFilter = new BoxShadowFilter({
    boxShadow: CARD_SHADOW_CSS,
    borderRadius: ICON_BOX_RADIUS,
  });

  const cardFill = new Graphics();
  cardFill
    .roundRect(ICON_BOX_INNER_OFFSET, ICON_BOX_INNER_OFFSET, ICON_BOX_INNER_SIZE, ICON_BOX_INNER_SIZE, ICON_BOX_RADIUS)
    .fill({ color: 0xffffff });
  cardFill.filters = [shadowFilter];

  const cardStroke = new Graphics();
  cardStroke
    .roundRect(ICON_BOX_INNER_OFFSET, ICON_BOX_INNER_OFFSET, ICON_BOX_INNER_SIZE, ICON_BOX_INNER_SIZE, ICON_BOX_RADIUS)
    .stroke({ width: 1, color: 0x000000, alpha: 0.04 });

  root.addChild(cardFill);
  root.addChild(cardStroke);

  const markers = new Graphics();
  const rectOrigin = ICON_BOX_INNER_OFFSET;
  const rectSize = ICON_BOX_INNER_SIZE;
  const markerMax = rectSize - MARKER_INSET - MARKER_SIZE;
  const corners: [number, number][] = [
    [rectOrigin + MARKER_INSET, rectOrigin + MARKER_INSET],
    [rectOrigin + markerMax, rectOrigin + MARKER_INSET],
    [rectOrigin + MARKER_INSET, rectOrigin + markerMax],
    [rectOrigin + markerMax, rectOrigin + markerMax],
  ];

  const cornerColor = parseHexColor(instance.props.cornerColor);
  for (const [mx, my] of corners) {
    markers.roundRect(mx, my, MARKER_SIZE, MARKER_SIZE, 1).fill({ color: cornerColor });
  }
  root.addChild(markers);

  const iconPaths = getIconDefinition(instance.props.iconId).paths;
  const iconGfx = new Graphics();
  for (const d of iconPaths) {
    iconGfx.path(new GraphicsPath(d));
  }
  const iconRgb = parseHexColor(instance.props.iconColor);
  iconGfx.fill({ color: iconRgb });

  const iconHold = new Container();
  iconHold.position.set(ICON_ORIGIN_OFFSET, ICON_ORIGIN_OFFSET);
  iconHold.filters = [buildIconShadowFilter(iconRgb)];
  iconHold.addChild(iconGfx);

  iconHold.cacheAsTexture({ resolution: 2, antialias: true });

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
