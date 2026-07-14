import { cssColorForHex } from "../components/colorLibrary";
import { intToHex } from "../lib/color";

export const DEFAULT_LAB_BACKGROUND_COLOR = 0x000000;

export type LabVideoBackgroundOptions = {
  backgroundColor?: number;
};

export type LabExportCompositor = {
  canvas: HTMLCanvasElement;
  compositeFrame: () => void;
};

export async function createLabExportCompositor(
  sourceCanvas: HTMLCanvasElement,
  background: LabVideoBackgroundOptions = {},
): Promise<LabExportCompositor> {
  const width = sourceCanvas.width || 1;
  const height = sourceCanvas.height || 1;
  const hasBackgroundColor =
    typeof background.backgroundColor === "number" && Number.isFinite(background.backgroundColor);
  const backgroundColor = hasBackgroundColor ? background.backgroundColor! : DEFAULT_LAB_BACKGROUND_COLOR;

  const exportCanvas = document.createElement("canvas");
  exportCanvas.width = width;
  exportCanvas.height = height;
  const ctx = exportCanvas.getContext("2d", {
    alpha: !hasBackgroundColor,
    colorSpace: "display-p3",
  } as CanvasRenderingContext2DSettings);
  if (!ctx) {
    throw new Error("2D canvas context is unavailable.");
  }

  const fillStyle = cssColorForHex(intToHex(backgroundColor));

  const compositeFrame = () => {
    if (hasBackgroundColor) {
      ctx.fillStyle = fillStyle;
      ctx.fillRect(0, 0, width, height);
    } else {
      ctx.clearRect(0, 0, width, height);
    }
    ctx.drawImage(sourceCanvas, 0, 0, width, height);
  };

  return { canvas: exportCanvas, compositeFrame };
}
