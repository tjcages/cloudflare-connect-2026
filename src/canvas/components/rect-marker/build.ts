import { Container, Graphics } from "pixi.js";
import type { ComponentInstance } from "../../../grid/types";
import { getComponentDefinition } from "../../../lib/componentRegistry";
import { paletteBrush } from "../../../theme/palette";

export const buildRectMarker = (
  instance: Extract<ComponentInstance, { type: "rect-marker" }>,
  gridStrokeHex: string,
): { structureRoot: Container; chromeRoot: Container } => {
  const neutralSync = { neutralFillSyncHex: gridStrokeHex };
  const brush = paletteBrush(instance.props.theme, neutralSync);
  const { width, height } = getComponentDefinition("rect-marker");

  const structureRoot = new Container();
  const chromeRoot = new Container();

  const g = new Graphics();
  g.rect(0, 0, width, height).fill({ color: brush.fill });

  structureRoot.addChild(g);
  structureRoot.cacheAsTexture(true);
  chromeRoot.cacheAsTexture(true);

  return { structureRoot, chromeRoot };
};
