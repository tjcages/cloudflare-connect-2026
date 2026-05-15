import { BASE_UNIT, STROKE_COLOR, type GridConfig, type NormalizedGridConfig } from "./types";
import { resizeGapMask } from "./mask";

export const DEFAULT_CONFIG: GridConfig = {
  seed: "grid-001",
  width: 800,
  height: 560,
  density: 0.36,
  smallCellRatio: 0.2,
  largeCellRatio: 0.8,
  strokeColor: STROKE_COLOR,
  gapMask: [],
};

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, Number.isFinite(value) ? value : min));

export const roundToBaseUnit = (value: number): number => {
  const rounded = Math.round(value / BASE_UNIT) * BASE_UNIT;
  return Math.max(BASE_UNIT, rounded);
};

export const normalizeRatios = (
  smallCellRatio: number,
  largeCellRatio: number,
): Pick<GridConfig, "smallCellRatio" | "largeCellRatio"> => {
  const small = clamp(smallCellRatio, 0, 1);
  const large = clamp(largeCellRatio, 0, 1);
  const total = small + large;

  if (total === 0) {
    return {
      smallCellRatio: DEFAULT_CONFIG.smallCellRatio,
      largeCellRatio: DEFAULT_CONFIG.largeCellRatio,
    };
  }

  const normalizedSmall = Number((small / total).toFixed(4));

  return {
    smallCellRatio: normalizedSmall,
    largeCellRatio: Number((1 - normalizedSmall).toFixed(4)),
  };
};

export const updateSmallRatio = (smallCellRatio: number) => {
  const small = clamp(smallCellRatio, 0, 1);

  return {
    smallCellRatio: Number(small.toFixed(4)),
    largeCellRatio: Number((1 - small).toFixed(4)),
  };
};

export const updateLargeRatio = (largeCellRatio: number) => {
  const large = clamp(largeCellRatio, 0, 1);

  return {
    smallCellRatio: Number((1 - large).toFixed(4)),
    largeCellRatio: Number(large.toFixed(4)),
  };
};

export const normalizeConfig = (config: GridConfig): NormalizedGridConfig => {
  const logicalWidth = roundToBaseUnit(config.width);
  const logicalHeight = roundToBaseUnit(config.height);
  const columns = logicalWidth / BASE_UNIT;
  const rows = logicalHeight / BASE_UNIT;
  const ratios = normalizeRatios(config.smallCellRatio, config.largeCellRatio);
  const density = Number(clamp(config.density, 0, 1).toFixed(4));

  return {
    ...config,
    ...ratios,
    width: logicalWidth,
    height: logicalHeight,
    density,
    seed: config.seed.trim() || DEFAULT_CONFIG.seed,
    strokeColor: config.strokeColor?.trim() || DEFAULT_CONFIG.strokeColor,
    logicalWidth,
    logicalHeight,
    renderWidth: logicalWidth + 1,
    renderHeight: logicalHeight + 1,
    columns,
    rows,
    gapMask: resizeGapMask(config.gapMask, rows, columns),
  };
};
