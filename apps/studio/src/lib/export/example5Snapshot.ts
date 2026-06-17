import { cloneDefaultStripes } from "../../playground/stripeColors";
import { buildPlaygroundExportSnapshot, type ReactExportSnapshot } from "./playgroundSnapshot";

/** Catalog defaults for example5 @ 848×480 — reproducible export parity baseline. */
export function buildExample5ExportSnapshot(): ReactExportSnapshot {
  return buildPlaygroundExportSnapshot({
    config: {
      duotoneEnabled: true,
      displayWidth: 848,
      displayHeight: 480,
      stripes: cloneDefaultStripes(),
    },
    displayWidth: 848,
    displayHeight: 480,
    mediaKind: "video",
  });
}
