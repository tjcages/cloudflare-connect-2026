import { useControls, folder } from "leva";
import { normalizeEngineConfig, DEFAULT_ENGINE_CONFIG } from "@necatikcl/stripes-engine";
import type { EngineConfig } from "@necatikcl/stripes-engine";

export function useEngineControls(): EngineConfig {
  const d = DEFAULT_ENGINE_CONFIG;

  const values = useControls({
    Transform: folder({
      fit: {
        value: d.transform.fit,
        options: ["stretch", "contain", "cover"] as const,
      },
      zoom: { value: d.transform.zoom, min: 0.1, max: 8, step: 0.01 },
      panX: { value: d.transform.panX, min: -1, max: 1, step: 0.01 },
      panY: { value: d.transform.panY, min: -1, max: 1, step: 0.01 },
    }),
    Adjustments: folder({
      brightness: { value: d.adjustments.brightness, min: -1, max: 1, step: 0.01 },
      exposure: { value: d.adjustments.exposure, min: -5, max: 5, step: 0.1 },
      contrast: { value: d.adjustments.contrast, min: 0, max: 4, step: 0.01 },
      blackPoint: { value: d.adjustments.blackPoint, min: 0, max: 1, step: 0.01 },
      whitePoint: { value: d.adjustments.whitePoint, min: 0.01, max: 1, step: 0.01 },
      gamma: { value: d.adjustments.gamma, min: 0.05, max: 5, step: 0.05 },
      invert: d.adjustments.invert,
      posterizeLevels: { value: d.adjustments.posterizeLevels, min: 0, max: 16, step: 1 },
      thresholdBias: { value: d.adjustments.thresholdBias, min: -1, max: 1, step: 0.01 },
      noiseAmount: { value: d.adjustments.noiseAmount, min: 0, max: 1, step: 0.01 },
      blurRadius: { value: d.adjustments.blurRadius, min: 0, max: 4, step: 0.1 },
      sharpenAmount: { value: d.adjustments.sharpenAmount, min: 0, max: 4, step: 0.1 },
    }),
    Field: folder({
      fieldMode: {
        value: d.field.mode,
        options: ["luminance", "overlay"] as const,
      },
    }),
    Background: folder({
      backgroundColor: {
        value: "#" + d.background.color.toString(16).padStart(6, "0"),
      },
    }),
    stripesEnabled: d.stripesEnabled,
  });

  return normalizeEngineConfig({
    transform: {
      fit: values.fit,
      zoom: values.zoom,
      panX: values.panX,
      panY: values.panY,
    },
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
    field: { mode: values.fieldMode },
    background: { color: parseInt(values.backgroundColor.replace("#", ""), 16) },
    stripesEnabled: values.stripesEnabled,
  });
}
