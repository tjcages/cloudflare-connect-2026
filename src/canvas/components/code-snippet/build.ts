import { Container, Graphics, Text } from "pixi.js";
import { CODE_SNIPPET_FONT_FAMILY } from "../../../fonts/codeSnippet";
import type { ComponentInstance } from "../../../grid/types";
import { ICON_BOX_STROKE_ALIGN_NUDGE } from "../../../lib/icon-box/layout";
import { getCodeSnippetMetrics } from "../../../lib/code-snippet/layout";
import { tokenizeCodeSnippet } from "../../../lib/code-snippet/highlight";
import {
  CODE_SNIPPET_LINE_HEIGHT_PX,
  CODE_SNIPPET_PADDING_PX,
  layoutCodeSnippetTokens,
} from "../../../lib/code-snippet/textLayout";
import { paletteBrush } from "../../../theme/palette";
import {
  buildContainerCornerReticle,
  getContainerReticlePosition,
  type ContainerReticleCorner,
} from "../shared/containerReticle";

const CONTAINER_RETICLE_Z_INDEX = 18;
const CONTAINER_RETICLE_CHROME_Z = 20;

export type CodeSnippetRenderableInstance = Extract<ComponentInstance, { type: "code-snippet" }>;

export type CodeSnippetDisplayParts = {
  structureRoot: Container;
  chromeRoot: Container;
};

export const buildCodeSnippet = (
  instance: CodeSnippetRenderableInstance,
  gridStrokeColor: number,
  gridStrokeHex: string,
): CodeSnippetDisplayParts => {
  const metrics = getCodeSnippetMetrics(instance.props);
  const { width, height } = metrics;
  const brush = paletteBrush(instance.props.theme, { neutralFillSyncHex: gridStrokeHex });

  const structureRoot = new Container();
  structureRoot.position.set(instance.x, instance.y);

  const chromeRoot = new Container();
  chromeRoot.sortableChildren = true;
  chromeRoot.position.set(instance.x, instance.y);

  // Match icon-box cardFill + cardFrame: white body, grid-aligned 1px frame (no interior lattice).
  const panelFill = new Graphics();
  panelFill.rect(0, 0, width, height).fill({ color: 0xffffff });
  structureRoot.addChild(panelFill);

  const panelFrame = new Graphics();
  panelFrame
    .rect(ICON_BOX_STROKE_ALIGN_NUDGE, ICON_BOX_STROKE_ALIGN_NUDGE, width, height)
    .stroke({ width: 1, color: gridStrokeColor });
  structureRoot.addChild(panelFrame);

  const innerWidth = width - CODE_SNIPPET_PADDING_PX * 2;
  const innerHeight = height - CODE_SNIPPET_PADDING_PX * 2;
  const tokens = tokenizeCodeSnippet(instance.props.code, instance.props.language, instance.props.theme, gridStrokeHex);
  const spans = layoutCodeSnippetTokens({ tokens, innerWidth, innerHeight });

  const textRoot = new Container();
  textRoot.position.set(CODE_SNIPPET_PADDING_PX, CODE_SNIPPET_PADDING_PX);
  for (const span of spans) {
    const label = new Text({
      text: span.text,
      style: {
        fontFamily: CODE_SNIPPET_FONT_FAMILY,
        fontSize: 12,
        fontWeight: "400",
        lineHeight: CODE_SNIPPET_LINE_HEIGHT_PX,
        fill: span.colorHex,
      },
    });
    label.position.set(span.x, span.y);
    textRoot.addChild(label);
  }
  structureRoot.addChild(textRoot);

  const outerReticlesRoot = new Container();
  outerReticlesRoot.zIndex = CONTAINER_RETICLE_CHROME_Z;
  const corners: ContainerReticleCorner[] = ["tl", "tr", "bl", "br"];
  for (const corner of corners) {
    const reticle = buildContainerCornerReticle(gridStrokeColor, brush.fill);
    reticle.zIndex = CONTAINER_RETICLE_Z_INDEX;
    const pos = getContainerReticlePosition(corner, width, height);
    reticle.position.set(pos.x, pos.y);
    outerReticlesRoot.addChild(reticle);
  }
  chromeRoot.addChild(outerReticlesRoot);

  return { structureRoot, chromeRoot };
};
