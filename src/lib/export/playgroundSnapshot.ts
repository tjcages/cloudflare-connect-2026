import { DEFAULT_TEXTURE_GAMMA } from "../../playground/colorWhiteness";
import type { PlaygroundPersistedConfig } from "../../playground/playgroundPersistence";
import { resolvePersistedTextureGamma } from "../../playground/playgroundPersistence";
import {
  resolvePersistedSparkleGapsActivePercent,
  resolvePersistedSparkleGapsSpeed,
} from "../../playground/playgroundSparkle";
import type { PlaygroundMediaKind } from "../../playground/playgroundTextures";

/** Export-side stripe (no UI id). */
export type ExportStripe = {
  hex: string;
  p3Css: string;
  startFrom: number;
  width: number;
};

function toExportStripes(config: PlaygroundPersistedConfig): ExportStripe[] {
  return config.stripes.map((stripe) => ({
    hex: stripe.hex,
    p3Css: stripe.p3Css,
    startFrom: stripe.startFrom,
    width: stripe.width,
  }));
}

function formatSparkleGapsSummary(config: PlaygroundPersistedConfig): string {
  const activeRatio = resolvePersistedSparkleGapsActivePercent(config);
  if (activeRatio <= 0) {
    return "off";
  }
  const speed = resolvePersistedSparkleGapsSpeed(config);
  return `${activeRatio} @ ${speed}`;
}

export type ReactExportSnapshot = {
  config: PlaygroundPersistedConfig;
  stripes: ExportStripe[];
  displayWidth: number;
  displayHeight: number;
  mediaKind: PlaygroundMediaKind;
};

export function buildPlaygroundExportSnapshot(input: {
  config: PlaygroundPersistedConfig;
  displayWidth: number;
  displayHeight: number;
  mediaKind: PlaygroundMediaKind;
}): ReactExportSnapshot {
  return {
    config: input.config,
    stripes: toExportStripes(input.config),
    displayWidth: input.displayWidth,
    displayHeight: input.displayHeight,
    mediaKind: input.mediaKind,
  };
}

export function formatSnapshotSummary(snapshot: ReactExportSnapshot): string {
  const { config } = snapshot;
  const textureGamma = resolvePersistedTextureGamma(config);
  return [
    `- Duotone: ${config.duotoneEnabled ? "on" : "off"}`,
    ...(textureGamma !== DEFAULT_TEXTURE_GAMMA ? [`- Gamma: ${textureGamma}`] : []),
    `- Sparkle gaps: ${formatSparkleGapsSummary(config)}`,
    `- Display: ${snapshot.displayWidth}×${snapshot.displayHeight}px`,
    `- Stripes: ${snapshot.stripes.length}`,
    ...snapshot.stripes.map(
      (stripe, index) => `  ${index + 1}. ${stripe.hex} from ${stripe.startFrom} @ ${stripe.width}px`,
    ),
    `- Media: ${snapshot.mediaKind}`,
  ].join("\n");
}

export type AsciiVideoConfigWire = {
  duotoneEnabled: boolean;
  textureGamma?: number;
  sparkleGapsActivePercent?: number;
  sparkleGapsSpeed?: number;
  displayWidth?: number;
  displayHeight?: number;
  stripes: ExportStripe[];
};

export function snapshotToAsciiVideoConfig(snapshot: ReactExportSnapshot): AsciiVideoConfigWire {
  const textureGamma = resolvePersistedTextureGamma(snapshot.config);
  return {
    duotoneEnabled: snapshot.config.duotoneEnabled,
    textureGamma: textureGamma !== DEFAULT_TEXTURE_GAMMA ? textureGamma : undefined,
    sparkleGapsActivePercent: resolvePersistedSparkleGapsActivePercent(snapshot.config) || undefined,
    sparkleGapsSpeed:
      resolvePersistedSparkleGapsActivePercent(snapshot.config) > 0
        ? resolvePersistedSparkleGapsSpeed(snapshot.config)
        : undefined,
    displayWidth: snapshot.config.displayWidth ?? snapshot.displayWidth,
    displayHeight: snapshot.config.displayHeight ?? snapshot.displayHeight,
    stripes: snapshot.stripes,
  };
}
