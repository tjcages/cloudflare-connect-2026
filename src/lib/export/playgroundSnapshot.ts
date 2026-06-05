import { DEFAULT_TEXTURE_GAMMA } from "../../playground/colorWhiteness";
import type { PlaygroundPersistedConfig } from "../../playground/playgroundPersistence";
import {
  resolvePersistedSourceTransform,
  resolvePersistedTextureAdjustments,
  resolvePersistedTextureGamma,
} from "../../playground/playgroundPersistence";
import {
  DEFAULT_PLAYGROUND_SOURCE_TRANSFORM,
  isDefaultPlaygroundSourceTransform,
} from "../../playground/playgroundSourceTransform";
import {
  DEFAULT_PLAYGROUND_TEXTURE_ADJUSTMENTS,
  isDefaultPlaygroundTextureAdjustments,
} from "../../playground/playgroundTextureAdjustments";
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
  const textureAdjustments = resolvePersistedTextureAdjustments(config);
  const sourceTransform = resolvePersistedSourceTransform(config);
  return [
    `- Duotone: ${config.duotoneEnabled ? "on" : "off"}`,
    ...(config.stripesEnabled === false ? ["- Stripes: off"] : []),
    ...(textureGamma !== DEFAULT_TEXTURE_GAMMA ? [`- Gamma: ${textureGamma}`] : []),
    ...(!isDefaultPlaygroundTextureAdjustments(textureAdjustments) ? ["- Texture adjustments: custom"] : []),
    ...(!isDefaultPlaygroundSourceTransform(sourceTransform) ? [`- Source transform: ${sourceTransform.fit}`] : []),
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
  stripesEnabled?: boolean;
  textureGamma?: number;
  textureAdjustments?: typeof DEFAULT_PLAYGROUND_TEXTURE_ADJUSTMENTS;
  sourceTransform?: typeof DEFAULT_PLAYGROUND_SOURCE_TRANSFORM;
  sparkleGapsActivePercent?: number;
  sparkleGapsSpeed?: number;
  displayWidth?: number;
  displayHeight?: number;
  stripes: ExportStripe[];
};

export function snapshotToAsciiVideoConfig(snapshot: ReactExportSnapshot): AsciiVideoConfigWire {
  const textureGamma = resolvePersistedTextureGamma(snapshot.config);
  const textureAdjustments = resolvePersistedTextureAdjustments(snapshot.config);
  const sourceTransform = resolvePersistedSourceTransform(snapshot.config);
  return {
    duotoneEnabled: snapshot.config.duotoneEnabled,
    stripesEnabled: snapshot.config.stripesEnabled === false ? false : undefined,
    textureGamma: textureGamma !== DEFAULT_TEXTURE_GAMMA ? textureGamma : undefined,
    textureAdjustments: !isDefaultPlaygroundTextureAdjustments(textureAdjustments) ? textureAdjustments : undefined,
    sourceTransform: !isDefaultPlaygroundSourceTransform(sourceTransform) ? sourceTransform : undefined,
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
