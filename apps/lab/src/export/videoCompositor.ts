export const DEFAULT_LAB_BACKGROUND_COLOR = 0x000000;

export type LabVideoBackgroundOptions = {
  backgroundColor?: number;
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
  background: LabVideoBackgroundOptions = {},
): Promise<LabExportCompositor> {
  const width = sourceCanvas.width || 1;
  const height = sourceCanvas.height || 1;
  const backgroundColor = background.backgroundColor ?? DEFAULT_LAB_BACKGROUND_COLOR;

  const exportCanvas = document.createElement("canvas");
  exportCanvas.width = width;
  exportCanvas.height = height;
  const ctx = exportCanvas.getContext("2d", { alpha: false });
  if (!ctx) {
    throw new Error("2D canvas context is unavailable.");
  }

  const fillStyle = backgroundColorToHex(backgroundColor);

  const compositeFrame = () => {
    ctx.fillStyle = fillStyle;
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(sourceCanvas, 0, 0, width, height);
  };

  return { canvas: exportCanvas, compositeFrame };
}
