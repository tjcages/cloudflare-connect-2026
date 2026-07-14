import type { EngineConfig } from "@necatikcl/stripes-engine";
import { drawerFolder } from "./drawerFolder";

export function buildTextureSchema(d: EngineConfig) {
  return {
    General: drawerFolder("General", {
      stripesEnabled: { value: d.stripesEnabled, label: "Stripes enabled" },
      textureDpr: { value: d.fieldScale, min: 0.25, max: 2, step: 0.25, label: "Texture DPR" },
    }),
    "Texture Tone": drawerFolder("Texture Tone", {
      exposure: { value: d.adjustments.exposure, min: -2, max: 2, step: 0.05, label: "Exposure" },
      brightness: { value: d.adjustments.brightness, min: -0.5, max: 0.5, step: 0.01, label: "Brightness" },
      contrast: { value: d.adjustments.contrast, min: 0, max: 2, step: 0.01, label: "Contrast" },
      gamma: { value: d.adjustments.gamma, min: 0.05, max: 5, step: 0.05, label: "Gamma" },
      invert: {
        value: d.adjustments.invert,
        label: "Invert luminance",
        render: (get) => get("colorsModeMirror") !== "colors",
      },
    }),
    "Texture Levels": drawerFolder("Texture Levels", {
      blackPoint: { value: d.adjustments.blackPoint, min: 0, max: 1, step: 0.01, label: "Black point" },
      whitePoint: { value: d.adjustments.whitePoint, min: 0, max: 1, step: 0.01, label: "White point" },
      thresholdBias: { value: d.adjustments.thresholdBias, min: -0.5, max: 0.5, step: 0.01, label: "Threshold bias" },
      posterizeLevels: { value: d.adjustments.posterizeLevels, min: 0, max: 16, step: 1, label: "Posterize" },
      noiseAmount: { value: d.adjustments.noiseAmount, min: 0, max: 0.5, step: 0.01, label: "Noise" },
      blurRadius: { value: d.adjustments.blurRadius, min: 0, max: 4, step: 1, label: "Blur" },
      sharpenAmount: { value: d.adjustments.sharpenAmount, min: 0, max: 4, step: 0.1, label: "Sharpen" },
    }),
    "Texture Source": drawerFolder("Texture Source", {
      fit: {
        value: d.transform.fit,
        options: { Stretch: "stretch", Cover: "cover", Contain: "contain" } as const,
        label: "Fit",
      },
      zoom: { value: d.transform.zoom, min: 0.5, max: 4, step: 0.01, label: "Zoom" },
      panX: { value: d.transform.panX, min: -1, max: 1, step: 0.01, label: "Pan X" },
      panY: { value: d.transform.panY, min: -1, max: 1, step: 0.01, label: "Pan Y" },
    }),
    colorsModeMirror: {
      value: d.colors.mode === "colors" ? "colors" : "luminance",
      render: () => false,
    },
  };
}
