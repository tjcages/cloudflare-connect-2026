import { Container, Graphics } from "pixi.js";
import type { ComponentInstance } from "../../../grid/types";
import { paletteBrush } from "../../../theme/palette";

/** Logical 40×40 cell; centered 6×6 plus with 1px stroke (matches SVG reference layout). */
const CX = 20;
const HALF_SPAN = 3;

export const buildPlusMarker = (
  instance: Extract<ComponentInstance, { type: "plus-marker" }>,
  gridStrokeHex: string,
): { structureRoot: Container; chromeRoot: Container } => {
  const neutralSync = { neutralFillSyncHex: gridStrokeHex };
  const brush = paletteBrush(instance.props.theme, neutralSync);
  const strokeColor = brush.fill;

  const structureRoot = new Container();
  const chromeRoot = new Container();

  const g = new Graphics();
  g.moveTo(CX, CX - HALF_SPAN)
    .lineTo(CX, CX + HALF_SPAN)
    .moveTo(CX - HALF_SPAN, CX)
    .lineTo(CX + HALF_SPAN, CX);
  g.stroke({ width: 1, color: strokeColor, cap: "butt", join: "miter" });

  structureRoot.addChild(g);

  return { structureRoot, chromeRoot };
};
