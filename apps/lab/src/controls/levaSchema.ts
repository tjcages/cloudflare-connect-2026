import { useMemo } from "react";
import { useControls, folder } from "leva";
import { normalizeEngineConfig } from "@necatikcl/stripes-engine";
import type { EngineConfig } from "@necatikcl/stripes-engine";
import { loadInitialConfig } from "../persistence";

function intToHex(value: number): string {
  return `#${(value & 0xffffff).toString(16).padStart(6, "0")}`;
}

function hexToInt(hex: string): number {
  const parsed = Number.parseInt(hex.replace(/^#/, ""), 16);
  return Number.isFinite(parsed) ? parsed & 0xffffff : 0;
}

export function useEngineControls(): EngineConfig {
  const d = useMemo(() => normalizeEngineConfig(loadInitialConfig()), []);

  const values = useControls({
    General: folder({
      stripesEnabled: { value: d.stripesEnabled, label: "Stripes enabled" },
    }),
    "Texture Tone": folder({
      exposure: { value: d.adjustments.exposure, min: -2, max: 2, step: 0.05, label: "Exposure" },
      brightness: { value: d.adjustments.brightness, min: -0.5, max: 0.5, step: 0.01, label: "Brightness" },
      contrast: { value: d.adjustments.contrast, min: 0, max: 2, step: 0.01, label: "Contrast" },
      gamma: { value: d.adjustments.gamma, min: 0.05, max: 5, step: 0.05, label: "Gamma" },
      invert: { value: d.adjustments.invert, label: "Invert luminance" },
    }),
    "Texture Levels": folder({
      blackPoint: { value: d.adjustments.blackPoint, min: 0, max: 1, step: 0.01, label: "Black point" },
      whitePoint: { value: d.adjustments.whitePoint, min: 0, max: 1, step: 0.01, label: "White point" },
      thresholdBias: { value: d.adjustments.thresholdBias, min: -0.5, max: 0.5, step: 0.01, label: "Threshold bias" },
      posterizeLevels: { value: d.adjustments.posterizeLevels, min: 0, max: 16, step: 1, label: "Posterize" },
      noiseAmount: { value: d.adjustments.noiseAmount, min: 0, max: 0.5, step: 0.01, label: "Noise" },
      blurRadius: { value: d.adjustments.blurRadius, min: 0, max: 4, step: 1, label: "Blur" },
      sharpenAmount: { value: d.adjustments.sharpenAmount, min: 0, max: 4, step: 0.1, label: "Sharpen" },
    }),
    "Texture Source": folder({
      fit: {
        value: d.transform.fit,
        options: { Stretch: "stretch", Cover: "cover", Contain: "contain" } as const,
        label: "Fit",
      },
      zoom: { value: d.transform.zoom, min: 0.5, max: 4, step: 0.01, label: "Zoom" },
      panX: { value: d.transform.panX, min: -1, max: 1, step: 0.01, label: "Pan X" },
      panY: { value: d.transform.panY, min: -1, max: 1, step: 0.01, label: "Pan Y" },
    }),
    Background: folder({
      backgroundColor: { value: intToHex(d.background.color), label: "Color" },
    }),
    Grid: folder({
      cellWidth: { value: d.grid.cellWidth, min: 1, max: 24, step: 1, label: "Cell width" },
      cellHeight: { value: d.grid.cellHeight, min: 1, max: 24, step: 1, label: "Cell height" },
      gapX: { value: d.grid.gapX, min: 0, max: 24, step: 0.5, label: "Gap X" },
      gapY: { value: d.grid.gapY, min: 0, max: 24, step: 0.5, label: "Gap Y" },
      cornerRadius: { value: d.grid.cornerRadius, min: 0, max: 24, step: 0.5, label: "Corner radius" },
      orientation: {
        value: d.grid.orientation,
        options: { Vertical: "vertical", Horizontal: "horizontal" } as const,
        label: "Orientation",
      },
    }),
    Quality: folder({
      textureDpr: { value: d.fieldScale, min: 0.25, max: 2, step: 0.25, label: "Texture DPR" },
    }),
    Stripes: folder({}),
  });

  return normalizeEngineConfig({
    adjustments: {
      brightness: values.brightness,
      exposure: values.exposure,
      contrast: values.contrast,
      blackPoint: values.blackPoint,
      whitePoint: values.whitePoint,
      gamma: values.gamma,
      invert: values.invert,
      posterizeLevels: values.posterizeLevels,
      thresholdBias: values.thresholdBias,
      noiseAmount: values.noiseAmount,
      blurRadius: values.blurRadius,
      sharpenAmount: values.sharpenAmount,
    },
    transform: {
      fit: values.fit,
      zoom: values.zoom,
      panX: values.panX,
      panY: values.panY,
    },
    background: { color: hexToInt(values.backgroundColor) },
    grid: {
      cellWidth: values.cellWidth,
      cellHeight: values.cellHeight,
      gapX: values.gapX,
      gapY: values.gapY,
      cornerRadius: values.cornerRadius,
      orientation: values.orientation,
    },
    stripesEnabled: values.stripesEnabled,
    fieldScale: values.textureDpr,
  });
}
