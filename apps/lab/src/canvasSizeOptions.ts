import type { LabCanvasMode } from "./persistence";

export const CANVAS_SCALE_PRESETS = [0.25, 0.5, 1, 2, 3] as const;
export const CANVAS_SIZE_OPTION_VALUES = [
  "original",
  ...CANVAS_SCALE_PRESETS.map((scale) => `scale:${scale}` as const),
  "custom",
] as const;

export type CanvasSizeOption = "original" | `scale:${number}` | "custom";

export function canvasSizeOptionFor(mode: LabCanvasMode, scale: number): CanvasSizeOption {
  if (mode === "original") return "original";
  if (mode === "manual") return "custom";
  const matchedScale = CANVAS_SCALE_PRESETS.find((option) => Math.abs(option - scale) < 0.001);
  return matchedScale === undefined ? "custom" : `scale:${matchedScale}`;
}

export function parseCanvasSizeOption(
  value: string,
): { kind: "original" } | { kind: "scale"; scale: number } | { kind: "custom" } {
  if (value === "original") return { kind: "original" };
  if (value === "custom") return { kind: "custom" };
  if (value.startsWith("scale:")) {
    const scale = Number(value.slice("scale:".length));
    if (CANVAS_SCALE_PRESETS.some((option) => option === scale)) return { kind: "scale", scale };
  }
  return { kind: "custom" };
}

export function canvasScaleLabel(scale: number): string {
  return `${Math.round(scale * 100)}%`;
}
