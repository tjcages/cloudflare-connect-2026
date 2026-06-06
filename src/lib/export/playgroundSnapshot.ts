import { DEFAULT_TEXTURE_GAMMA } from "../../playground/colorWhiteness";
import type { PlaygroundPersistedConfig } from "../../playground/playgroundPersistence";
import {
  resolvePersistedSourceTransform,
  resolvePersistedTextureAdjustments,
  resolvePersistedTextureGamma,
  resolvePersistedRevealConfig,
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
import {
  DEFAULT_PLAYGROUND_REVEAL_CONFIG,
  isDefaultPlaygroundRevealConfig,
} from "../../playground/playgroundRevealConfig";
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

function formatRevealSummary(config: PlaygroundPersistedConfig): string {
  const reveal = resolvePersistedRevealConfig(config);
  if (reveal.preset === "randomColumns") {
    return `random columns over ${reveal.randomColumns.durationMs}ms, y shift ${Math.round(
      reveal.randomColumns.yShift * 100,
    )}%`;
  }
  return `${reveal.preset} from ${reveal.wave.position} over ${reveal.wave.durationMs}ms`;
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
    `- Reveal: ${formatRevealSummary(config)}`,
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
  reveal?: typeof DEFAULT_PLAYGROUND_REVEAL_CONFIG;
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
    reveal: !isDefaultPlaygroundRevealConfig(resolvePersistedRevealConfig(snapshot.config))
      ? resolvePersistedRevealConfig(snapshot.config)
      : undefined,
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
