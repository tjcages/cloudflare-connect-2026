import { cssColorForHex } from "../components/colorLibrary";

export const DEFAULT_LAB_BACKGROUND_COLOR = 0x000000;

export type LabVideoBackgroundOptions = {
  backgroundColor?: number;
};

export type LabVideoCompositorOptions = LabVideoBackgroundOptions & {
  overlayCanvases?: readonly HTMLCanvasElement[];
};

export type LabExportCompositor = {
  canvas: HTMLCanvasElement;
  compositeFrame: () => void;
};

function backgroundColorToHex(color: number): string {
  return `#${(color & 0xffffff).toString(16).padStart(6, "0")}`;
}

export async function createLabExportCompositor(
  sourceCanvas: HTMLCanvasElement,
  options: LabVideoCompositorOptions = {},
): Promise<LabExportCompositor> {
  const width = sourceCanvas.width || 1;
  const height = sourceCanvas.height || 1;
  const hasBackgroundColor = typeof options.backgroundColor === "number" && Number.isFinite(options.backgroundColor);
  const backgroundColor = hasBackgroundColor ? options.backgroundColor! : DEFAULT_LAB_BACKGROUND_COLOR;

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

  const fillStyle = cssColorForHex(backgroundColorToHex(backgroundColor));

  const compositeFrame = () => {
    if (hasBackgroundColor) {
      ctx.fillStyle = fillStyle;
      ctx.fillRect(0, 0, width, height);
    } else {
      ctx.clearRect(0, 0, width, height);
    }
    ctx.drawImage(sourceCanvas, 0, 0, width, height);
    for (const overlayCanvas of options.overlayCanvases ?? []) {
      if (overlayCanvas.width > 0 && overlayCanvas.height > 0) {
        ctx.drawImage(overlayCanvas, 0, 0, width, height);
      }
    }
  };

  return { canvas: exportCanvas, compositeFrame };
}
