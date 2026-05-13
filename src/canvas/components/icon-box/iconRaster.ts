import type { IconDefinition } from "../../../components/iconRegistry";

export const ICON_RASTER_SCALE = 4;

type ViewBox = {
  minX: number;
  minY: number;
  width: number;
  height: number;
};

const parseViewBox = (viewBox: string): ViewBox => {
  const [minX, minY, width, height] = viewBox.split(/\s+/).map(Number);

  return { minX, minY, width, height };
};

export const rasterizeIcon = (
  icon: IconDefinition,
  fillStyle: string,
  scale = ICON_RASTER_SCALE,
): HTMLCanvasElement => {
  const { minX, minY, width, height } = parseViewBox(icon.viewBox);
  const canvas = document.createElement("canvas");
  canvas.width = width * scale;
  canvas.height = height * scale;

  const ctx = canvas.getContext("2d");
  if (!ctx) {
    return canvas;
  }

  ctx.scale(scale, scale);
  ctx.translate(minX === 0 ? 0 : -minX, minY === 0 ? 0 : -minY);

  if (icon.renderMode === "stroke") {
    ctx.strokeStyle = fillStyle;
    ctx.lineWidth = icon.strokeWidth ?? 1.25;
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    for (const d of icon.paths) {
      ctx.stroke(new Path2D(d));
    }
  } else {
    ctx.fillStyle = fillStyle;
    for (const d of icon.paths) {
      ctx.fill(new Path2D(d));
    }
  }

  return canvas;
};
