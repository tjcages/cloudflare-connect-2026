export type SvgExportBackgroundLayers = {
  /** Solid fill behind everything (optional). */
  backgroundHex?: string;
  /** Engine Background gradient fill (optional). */
  backgroundGradient?: {
    direction: "topToBottom" | "leftToRight" | "rightToLeft" | "bottomToTop";
    stopCount: number;
    stops: string[];
  };
};

/**
 * Resolve the optional vector SVG backdrop. Shader source layers are
 * intentionally excluded from SVG export.
 */
export function resolveSvgExportBackground(input: {
  backgroundTransparent: boolean;
  backgroundGradientEnabled: boolean;
  backgroundColorHex: string;
  backgroundGradient?: SvgExportBackgroundLayers["backgroundGradient"];
}): SvgExportBackgroundLayers {
  if (input.backgroundTransparent) {
    return {};
  }

  if (input.backgroundGradientEnabled && input.backgroundGradient) {
    return {
      backgroundGradient: input.backgroundGradient,
    };
  }

  return {
    backgroundHex: input.backgroundColorHex,
  };
}
