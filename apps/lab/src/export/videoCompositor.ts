import { cssColorForHex } from "../components/colorLibrary";

export const DEFAULT_LAB_BACKGROUND_COLOR = 0x000000;

export type LabVideoBackgroundOptions = {
  backgroundColor?: number;
};

export type LabVideoBackgroundFrame = {
  transparent: boolean;
  color: number;
  gradient?: {
    enabled: boolean;
    direction: "topToBottom" | "leftToRight" | "rightToLeft" | "bottomToTop";
    stopCount: number;
    stops: readonly number[];
  };
};

export type LabVideoLayer = {
  source: CanvasImageSource | (() => CanvasImageSource | null);
  isVisible?: () => boolean;
  opacity?: () => number;
  fit?: () => "fill" | "contain" | "cover" | "width" | "height";
};

type LabVideoGradientDirection = NonNullable<LabVideoBackgroundFrame["gradient"]>["direction"];

export type LabVideoCompositorOptions = LabVideoBackgroundOptions & {
  /** Read on every captured frame so timeline-driven background values remain live. */
  getBackground?: () => LabVideoBackgroundFrame;
  isSourceVisible?: () => boolean;
  underlayLayers?: readonly LabVideoLayer[];
  /** Drawn under the engine/source canvas (e.g. Twizzler ribbon). */
  underlayCanvases?: readonly HTMLCanvasElement[];
  overlayLayers?: readonly LabVideoLayer[];
  overlayCanvases?: readonly HTMLCanvasElement[];
};

export type LabExportCompositor = {
  canvas: HTMLCanvasElement;
  colorSpace: PredefinedColorSpace;
  compositeFrame: () => void;
};

function backgroundColorToHex(color: number): string {
  return `#${(color & 0xffffff).toString(16).padStart(6, "0")}`;
}

function layerSource(layer: LabVideoLayer): CanvasImageSource | null {
  return typeof layer.source === "function" ? layer.source() : layer.source;
}

function sourceSize(source: CanvasImageSource): { width: number; height: number } {
  const sized = source as CanvasImageSource & {
    videoWidth?: number;
    videoHeight?: number;
    naturalWidth?: number;
    naturalHeight?: number;
    width?: number;
    height?: number;
  };
  return {
    width: sized.videoWidth || sized.naturalWidth || sized.width || 1,
    height: sized.videoHeight || sized.naturalHeight || sized.height || 1,
  };
}

function drawLayer(ctx: CanvasRenderingContext2D, layer: LabVideoLayer, width: number, height: number): void {
  if (layer.isVisible && !layer.isVisible()) return;
  const source = layerSource(layer);
  if (!source) return;
  const opacity = Math.min(1, Math.max(0, layer.opacity?.() ?? 1));
  if (opacity <= 0) return;
  const fit = layer.fit?.() ?? "fill";
  if (opacity !== 1) {
    ctx.save();
    ctx.globalAlpha = opacity;
  }
  if (fit === "fill") {
    ctx.drawImage(source, 0, 0, width, height);
  } else {
    const size = sourceSize(source);
    const scaleX = width / Math.max(1, size.width);
    const scaleY = height / Math.max(1, size.height);
    const scale = fit === "cover" ? Math.max(scaleX, scaleY) : fit === "height" ? scaleY : scaleX;
    const drawWidth = size.width * (fit === "contain" ? Math.min(scaleX, scaleY) : scale);
    const drawHeight = size.height * (fit === "contain" ? Math.min(scaleX, scaleY) : scale);
    ctx.drawImage(source, (width - drawWidth) / 2, (height - drawHeight) / 2, drawWidth, drawHeight);
  }
  if (opacity !== 1) ctx.restore();
}

function gradientEndpoints(
  direction: LabVideoGradientDirection,
  width: number,
  height: number,
): [number, number, number, number] {
  if (direction === "leftToRight") return [0, 0, width, 0];
  if (direction === "rightToLeft") return [width, 0, 0, 0];
  if (direction === "bottomToTop") return [0, height, 0, 0];
  return [0, 0, 0, height];
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
    alpha: options.getBackground ? true : !hasBackgroundColor,
    colorSpace: "display-p3",
  } as CanvasRenderingContext2DSettings);
  if (!ctx) {
    throw new Error("2D canvas context is unavailable.");
  }
  const colorSpace = ctx.getContextAttributes?.().colorSpace === "display-p3" ? "display-p3" : "srgb";

  const staticFillStyle = cssColorForHex(backgroundColorToHex(backgroundColor));
  let gradientKey = "";
  let gradientFill: CanvasGradient | null = null;

  const compositeFrame = () => {
    const background = options.getBackground?.();
    if (background && !background.transparent && background.gradient?.enabled) {
      const stopCount = Math.max(2, Math.min(background.gradient.stopCount, background.gradient.stops.length));
      const nextGradientKey = `${background.gradient.direction}:${stopCount}:${background.gradient.stops
        .slice(0, stopCount)
        .join(",")}`;
      if (nextGradientKey !== gradientKey || !gradientFill) {
        gradientKey = nextGradientKey;
        gradientFill = ctx.createLinearGradient(...gradientEndpoints(background.gradient.direction, width, height));
        for (let index = 0; index < stopCount; index += 1) {
          gradientFill.addColorStop(
            index / Math.max(1, stopCount - 1),
            cssColorForHex(backgroundColorToHex(background.gradient.stops[index] ?? background.color)),
          );
        }
      }
      ctx.fillStyle = gradientFill;
      ctx.fillRect(0, 0, width, height);
    } else if (background && !background.transparent) {
      ctx.fillStyle = cssColorForHex(backgroundColorToHex(background.color));
      ctx.fillRect(0, 0, width, height);
    } else if (!background && hasBackgroundColor) {
      ctx.fillStyle = staticFillStyle;
      ctx.fillRect(0, 0, width, height);
    } else {
      ctx.clearRect(0, 0, width, height);
    }
    for (const layer of options.underlayLayers ?? []) drawLayer(ctx, layer, width, height);
    for (const underlayCanvas of options.underlayCanvases ?? []) {
      if (underlayCanvas.width > 0 && underlayCanvas.height > 0) {
        ctx.drawImage(underlayCanvas, 0, 0, width, height);
      }
    }
    if (options.isSourceVisible?.() !== false) ctx.drawImage(sourceCanvas, 0, 0, width, height);
    for (const layer of options.overlayLayers ?? []) drawLayer(ctx, layer, width, height);
    for (const overlayCanvas of options.overlayCanvases ?? []) {
      if (overlayCanvas.width > 0 && overlayCanvas.height > 0) {
        ctx.drawImage(overlayCanvas, 0, 0, width, height);
      }
    }
  };

  return { canvas: exportCanvas, colorSpace, compositeFrame };
}
