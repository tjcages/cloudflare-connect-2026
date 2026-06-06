import { DEFAULT_PLAYGROUND_BACKGROUND_COLOR, playgroundBackgroundColorToHex } from "./canvasBackgroundCss";
import { normalizePlaygroundBackgroundCss } from "./playgroundPersistence";

export type PlaygroundVideoBackgroundOptions = {
  backgroundCss?: string;
  backgroundColor?: number;
};

export type PlaygroundExportCompositor = {
  canvas: HTMLCanvasElement;
  compositeFrame: () => void;
};

function escapeSvgText(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}

async function rasterizePlaygroundBackgroundCss(
  css: string,
  width: number,
  height: number,
): Promise<CanvasImageSource> {
  const normalizedCss = css.replace(/\n/g, " ").trim();
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
<foreignObject width="100%" height="100%">
<div xmlns="http://www.w3.org/1999/xhtml" style="width:${width}px;height:${height}px;${escapeSvgText(normalizedCss)}"></div>
</foreignObject>
</svg>`;

  const blob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(blob);

  try {
    if (typeof createImageBitmap === "function") {
      const bitmap = await createImageBitmap(blob);
      const raster = document.createElement("canvas");
      raster.width = width;
      raster.height = height;
      const rasterCtx = raster.getContext("2d");
      if (!rasterCtx) {
        bitmap.close();
        throw new Error("2D canvas context is unavailable.");
      }
      rasterCtx.drawImage(bitmap, 0, 0, width, height);
      bitmap.close();
      return raster;
    }

    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error("Failed to rasterize playground background."));
      img.src = url;
    });
    const raster = document.createElement("canvas");
    raster.width = width;
    raster.height = height;
    const rasterCtx = raster.getContext("2d");
    if (!rasterCtx) {
      throw new Error("2D canvas context is unavailable.");
    }
    rasterCtx.drawImage(image, 0, 0, width, height);
    return raster;
  } finally {
    URL.revokeObjectURL(url);
  }
}

export async function createPlaygroundExportCompositor(
  sourceCanvas: HTMLCanvasElement,
  background: PlaygroundVideoBackgroundOptions = {},
): Promise<PlaygroundExportCompositor> {
  const width = sourceCanvas.width || 1;
  const height = sourceCanvas.height || 1;
  const backgroundColor = background.backgroundColor ?? DEFAULT_PLAYGROUND_BACKGROUND_COLOR;
  const backgroundCss = normalizePlaygroundBackgroundCss(background.backgroundCss);

  const exportCanvas = document.createElement("canvas");
  exportCanvas.width = width;
  exportCanvas.height = height;
  const ctx = exportCanvas.getContext("2d", { alpha: false });
  if (!ctx) {
    throw new Error("2D canvas context is unavailable.");
  }

  let backgroundLayer: CanvasImageSource | null = null;
  if (backgroundCss) {
    backgroundLayer = await rasterizePlaygroundBackgroundCss(backgroundCss, width, height);
  }

  const compositeFrame = () => {
    if (backgroundLayer) {
      ctx.drawImage(backgroundLayer, 0, 0, width, height);
    } else {
      ctx.fillStyle = playgroundBackgroundColorToHex(backgroundColor);
      ctx.fillRect(0, 0, width, height);
    }
    ctx.drawImage(sourceCanvas, 0, 0, width, height);
  };

  return { canvas: exportCanvas, compositeFrame };
}
