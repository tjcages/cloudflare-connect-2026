import { getIconDefinition } from "../components/iconRegistry";
import type { ComponentInstance, GeneratedGrid, GridCell } from "../grid/types";

export type DocumentRenderInput = {
  grid: GeneratedGrid;
  instances: ComponentInstance[];
  selectedInstanceId?: string | null;
  scale?: number;
};

const resetShadow = (context: CanvasRenderingContext2D) => {
  context.shadowColor = "transparent";
  context.shadowBlur = 0;
  context.shadowOffsetX = 0;
  context.shadowOffsetY = 0;
};

export const hexToRgba = (hex: string, alpha: number) => {
  const normalized = hex.replace("#", "");
  const value = normalized.length === 3 ? normalized.replace(/(.)/g, "$1$1") : normalized;
  const red = Number.parseInt(value.slice(0, 2), 16);
  const green = Number.parseInt(value.slice(2, 4), 16);
  const blue = Number.parseInt(value.slice(4, 6), 16);

  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
};

const drawRoundedRect = (
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
) => {
  context.beginPath();
  context.roundRect(x, y, width, height, radius);
};

const fillRoundedRect = (
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
) => {
  drawRoundedRect(context, x, y, width, height, radius);
  context.fill();
};

const strokeRoundedRect = (
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
) => {
  drawRoundedRect(context, x, y, width, height, radius);
  context.stroke();
};

const fillIconPaths = (context: CanvasRenderingContext2D, paths: string[]) => {
  paths.forEach((path) => {
    if ("Path2D" in globalThis) {
      context.fill(new Path2D(path));
      return;
    }

    context.fill();
  });
};

const fillIconShadowFallback = (context: CanvasRenderingContext2D, paths: string[], shadowColor: string) => {
  [
    { offsetY: 0.5 },
    { offsetY: 1 },
  ].forEach((shadow) => {
    context.save();
    context.translate(0, shadow.offsetY);
    context.fillStyle = shadowColor;
    fillIconPaths(context, paths);
    context.restore();
  });
};

const drawIcon = (context: CanvasRenderingContext2D, instance: ComponentInstance) => {
  const icon = getIconDefinition(instance.props.iconId);
  const shadowColor = hexToRgba(instance.props.iconColor, 0.12);

  context.save();
  context.translate(instance.x + 28, instance.y + 28);

  if ("filter" in context) {
    context.filter = `drop-shadow(0 0.5px 0.5px ${shadowColor}) drop-shadow(0 1px 1px ${shadowColor})`;
    context.fillStyle = instance.props.iconColor;
    fillIconPaths(context, icon.paths);
    context.filter = "none";
  } else {
    fillIconShadowFallback(context, icon.paths, shadowColor);
  }

  context.fillStyle = instance.props.iconColor;
  fillIconPaths(context, icon.paths);
  context.restore();
};

export const drawGridLayer = (context: CanvasRenderingContext2D, grid: GeneratedGrid) => {
  context.fillStyle = "#FFFFFF";
  context.fillRect(0, 0, grid.config.logicalWidth, grid.config.logicalHeight);

  context.strokeStyle = grid.config.strokeColor;
  context.lineWidth = 1;
  grid.cells.forEach((cell: GridCell) => {
    context.strokeRect(cell.x + 0.5, cell.y + 0.5, cell.width, cell.height);
  });
};

export const drawIconBox = (context: CanvasRenderingContext2D, instance: ComponentInstance) => {
  const rectX = instance.x + 8;
  const rectY = instance.y + 8;
  const rectSize = 64;
  const radius = 10;
  const shadowPasses = [
    { offsetY: 12, blur: 24, color: "rgba(0, 0, 0, 0.04)" },
    { offsetY: 6, blur: 12, color: "rgba(0, 0, 0, 0.02)" },
    { offsetY: 3, blur: 6, color: "rgba(0, 0, 0, 0.01)" },
  ];

  context.fillStyle = "#FFFFFF";
  shadowPasses.forEach((shadow) => {
    context.shadowColor = shadow.color;
    context.shadowBlur = shadow.blur;
    context.shadowOffsetX = 0;
    context.shadowOffsetY = shadow.offsetY;
    fillRoundedRect(context, rectX, rectY, rectSize, rectSize, radius);
  });

  resetShadow(context);
  context.strokeStyle = "rgba(0, 0, 0, 0.04)";
  context.lineWidth = 1;
  strokeRoundedRect(context, rectX, rectY, rectSize, rectSize, radius);

  context.fillStyle = instance.props.cornerColor;
  const markerSize = 2;
  const markerInset = 8;
  const markerMax = rectSize - markerInset - markerSize;
  const markerPoints = [
    [rectX + markerInset, rectY + markerInset],
    [rectX + markerMax, rectY + markerInset],
    [rectX + markerInset, rectY + markerMax],
    [rectX + markerMax, rectY + markerMax],
  ];

  markerPoints.forEach(([x, y]) => {
    fillRoundedRect(context, x, y, markerSize, markerSize, 1);
  });

  drawIcon(context, instance);
};

export const drawComponentInstance = (context: CanvasRenderingContext2D, instance: ComponentInstance) => {
  if (instance.type === "icon-box") {
    drawIconBox(context, instance);
  }
};

export const drawSelectionOutline = (context: CanvasRenderingContext2D, instance: ComponentInstance) => {
  resetShadow(context);
  context.strokeStyle = "#9FC8FF";
  context.lineWidth = 1;
  context.strokeRect(instance.x + 0.5, instance.y + 0.5, 79, 79);
};

export const drawDocument = (
  context: CanvasRenderingContext2D,
  { grid, instances, selectedInstanceId = null, scale = 1 }: DocumentRenderInput,
) => {
  context.save();
  context.clearRect(0, 0, grid.config.logicalWidth * scale, grid.config.logicalHeight * scale);
  context.scale(scale, scale);
  drawGridLayer(context, grid);
  instances.forEach((instance) => {
    drawComponentInstance(context, instance);
    if (instance.id === selectedInstanceId) {
      drawSelectionOutline(context, instance);
    }
  });
  resetShadow(context);
  context.restore();
};
