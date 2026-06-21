/** Which texture the on-stage display sprite shows, and how, for a given debug stage + filter mode. */
export type PlaygroundDebugStage = "normal" | "source" | "processed";

export type DisplayPlan = {
  /** Which texture the display sprite reads. */
  textureSource: "source" | "processed";
  /** Whether the stripe post-process filter is applied to the display sprite. */
  useStripeFilter: boolean;
  /** Whether the letter + glow overlays are shown (hidden in inspection stages). */
  overlaysVisible: boolean;
};

const DEBUG_STAGES = new Set<PlaygroundDebugStage>(["normal", "source", "processed"]);

export function normalizeDebugStage(value: unknown): PlaygroundDebugStage {
  return DEBUG_STAGES.has(value as PlaygroundDebugStage) ? (value as PlaygroundDebugStage) : "normal";
}

/**
 * Decide what the on-stage display sprite shows. `normal` reproduces the live behavior
 * (stripes when the mode says so, otherwise the processed image), always over the
 * processed texture. `source`/`processed` are unobstructed inspection views.
 */
export function resolveDisplayPlan(
  debugStage: PlaygroundDebugStage,
  textureFilterMode: "off" | "preview" | "stripes",
): DisplayPlan {
  if (debugStage === "source") {
    return { textureSource: "source", useStripeFilter: false, overlaysVisible: false };
  }
  if (debugStage === "processed") {
    return { textureSource: "processed", useStripeFilter: false, overlaysVisible: false };
  }
  return {
    textureSource: "processed",
    useStripeFilter: textureFilterMode === "stripes",
    overlaysVisible: true,
  };
}
