/// <reference types="@figma/plugin-typings" />

import { CONFIG_PLUGIN_DATA_KEY, encodeMetadata, isValidOutputSize, type UiToPluginMessage } from "../shared/messages";

figma.showUI(__html__, {
  width: 440,
  height: 720,
  themeColors: true,
});

function placeAtViewportCenter(node: SceneNode): void {
  const center = figma.viewport.center;
  node.x = Math.round(center.x - node.width / 2);
  node.y = Math.round(center.y - node.height / 2);
  figma.currentPage.selection = [node];
  figma.viewport.scrollAndZoomIntoView([node]);
}

async function selectionImage(): Promise<{ bytes: Uint8Array; name: string }> {
  const selected = figma.currentPage.selection[0];
  if (!selected) throw new Error("Select a Figma layer with an image fill first.");
  if (!("fills" in selected) || selected.fills === figma.mixed) {
    throw new Error("The selected layer does not have an image fill.");
  }
  const imagePaint = selected.fills.find((paint): paint is ImagePaint => paint.type === "IMAGE" && !!paint.imageHash);
  if (!imagePaint?.imageHash) throw new Error("The selected layer does not have an image fill.");
  const image = figma.getImageByHash(imagePaint.imageHash);
  if (!image) throw new Error("Figma could not read the selected image.");
  return { bytes: await image.getBytesAsync(), name: selected.name || "Figma selection" };
}

figma.ui.onmessage = async (message: UiToPluginMessage) => {
  try {
    if (message.type === "request-selection-image") {
      const image = await selectionImage();
      figma.ui.postMessage({ type: "selection-image", ...image });
      return;
    }

    if (!isValidOutputSize(message.metadata.outputWidth, message.metadata.outputHeight)) {
      throw new Error("Output dimensions must be between 1 and 4096 pixels.");
    }

    if (message.type === "insert-svg") {
      const node = figma.createNodeFromSvg(message.svg);
      node.name = "Connect Shader · Editable";
      node.setPluginData(CONFIG_PLUGIN_DATA_KEY, encodeMetadata(message.metadata));
      placeAtViewportCenter(node);
      figma.notify("Editable Connect Shader inserted");
      figma.ui.postMessage({ type: "insert-complete", format: "SVG", nodeName: node.name });
      return;
    }

    if (message.type === "insert-png") {
      const image = figma.createImage(message.bytes);
      const node = figma.createRectangle();
      node.name = "Connect Shader · Render";
      node.resize(message.metadata.outputWidth, message.metadata.outputHeight);
      node.fills = [{ type: "IMAGE", imageHash: image.hash, scaleMode: "FILL" }];
      node.setPluginData(CONFIG_PLUGIN_DATA_KEY, encodeMetadata(message.metadata));
      placeAtViewportCenter(node);
      figma.notify("Rendered Connect Shader inserted");
      figma.ui.postMessage({ type: "insert-complete", format: "PNG", nodeName: node.name });
    }
  } catch (error) {
    const messageText = error instanceof Error ? error.message : "The plugin could not complete that action.";
    const type = message.type === "request-selection-image" ? "selection-error" : "insert-error";
    figma.ui.postMessage({ type, message: messageText });
    figma.notify(messageText, { error: true });
  }
};
