export type SvgExportBackgroundLayers = {
  /** Solid fill behind everything (optional). */
  backgroundHex?: string;
  /** Engine Background gradient fill (optional). */
  backgroundGradient?: {
    direction: "topToBottom" | "leftToRight" | "rightToLeft" | "bottomToTop";
    stopCount: number;
    stops: string[];
  };
  /** Connect fill underlay raster (preferred when present). */
  backgroundImageHref?: string;
};

/**
 * Resolve SVG backdrop layers.
 * Connect gradient underlay always wins when available; solid/engine-gradient
 * background is only included when explicitly requested.
 */
export function resolveSvgExportBackground(input: {
  includeSolidBackground: boolean;
  backgroundTransparent: boolean;
  backgroundGradientEnabled: boolean;
  backgroundColorHex: string;
  backgroundGradient?: SvgExportBackgroundLayers["backgroundGradient"];
  connectUnderlayHref?: string;
}): SvgExportBackgroundLayers {
  const underlay =
    typeof input.connectUnderlayHref === "string" && input.connectUnderlayHref.length > 0
      ? input.connectUnderlayHref
      : undefined;

  if (!input.includeSolidBackground || input.backgroundTransparent) {
    return { backgroundImageHref: underlay };
  }

  if (input.backgroundGradientEnabled && input.backgroundGradient) {
    return {
      backgroundGradient: input.backgroundGradient,
      backgroundImageHref: underlay,
    };
  }

  return {
    backgroundHex: input.backgroundColorHex,
    backgroundImageHref: underlay,
  };
}
