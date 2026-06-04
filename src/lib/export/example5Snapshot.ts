import { DEFAULT_STRIPE_BAND_BREAKPOINTS } from "../../playground/stripeBandThresholds";
import { DEFAULT_STRIPE_BAND_ENABLED } from "../../playground/stripeColors";
import { getPlaygroundTextureOption } from "../../playground/playgroundTextures";
import { buildPlaygroundExportSnapshot, type ReactExportSnapshot } from "./playgroundSnapshot";

/** Catalog defaults for example5 @ 848×480 — reproducible export parity baseline. */
export function buildExample5ExportSnapshot(): ReactExportSnapshot {
  const texture = getPlaygroundTextureOption("example5");
  return buildPlaygroundExportSnapshot({
    config: {
      duotoneEnabled: true,
      ignoreColorHex: texture.duotone.ignoreColorHex,
      ignoreTolerance: texture.duotone.ignoreTolerance,
      gamma: texture.duotone.gamma,
      threshold: texture.duotone.threshold,
      density: texture.duotone.density,
      displayWidth: 848,
      displayHeight: 480,
      bandBreakpoints: DEFAULT_STRIPE_BAND_BREAKPOINTS,
    },
    bandEnabled: DEFAULT_STRIPE_BAND_ENABLED,
    displayWidth: 848,
    displayHeight: 480,
    mediaKind: "video",
  });
}
