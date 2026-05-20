import { BASE_UNIT, type GridConfig, type NormalizedGridConfig } from "./types";
import { resizeGapMask } from "./mask";

export const DEFAULT_CONFIG: GridConfig = {
  seed: "b44ba25d",
  width: 640,
  height: 560,
  density: 0.36,
  smallCellRatio: 0.2,
  strokeColor: "#f3f3f3",
  gapMask: [],
};

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, Number.isFinite(value) ? value : min));

export const roundToBaseUnit = (value: number): number => {
  const rounded = Math.round(value / BASE_UNIT) * BASE_UNIT;
  return Math.max(BASE_UNIT, rounded);
};

/** `1` grows only 40×40 cells; otherwise density fills with 80×80 then replaces by ratio. */
export const prefersAllSmallCells = (smallCellRatio: number) => smallCellRatio >= 1;

/** Mixed large/small layout rules (diagonal tips, small isolation). */
export const usesMixedCellRules = (smallCellRatio: number) => smallCellRatio > 0 && smallCellRatio < 1;

export const updateSmallRatio = (smallCellRatio: number) => ({
  smallCellRatio: Number(clamp(smallCellRatio, 0, 1).toFixed(4)),
});

/** Base-grid slots that are not blocked by the gap mask. */
export const getPlaceableSlotCount = (config: Pick<NormalizedGridConfig, "columns" | "rows" | "gapMask">) => {
  const blocked = config.gapMask.flat().filter(Boolean).length;
  return config.columns * config.rows - blocked;
};

export const normalizeConfig = (config: GridConfig): NormalizedGridConfig => {
  const logicalWidth = roundToBaseUnit(config.width);
  const logicalHeight = roundToBaseUnit(config.height);
  const columns = logicalWidth / BASE_UNIT;
  const rows = logicalHeight / BASE_UNIT;
  const density = Number(clamp(config.density, 0, 1).toFixed(4));
  const smallCellRatio = Number(clamp(config.smallCellRatio, 0, 1).toFixed(4));

  return {
    ...config,
    smallCellRatio,
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
