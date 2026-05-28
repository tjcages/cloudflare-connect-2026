import type { StripeBandBreakpoints } from "../../playground/stripeBandThresholds";
import type { StripeBandEnabled } from "../../playground/stripeColors";
import { PLAYGROUND_STRIPE_BAND_HEX, PLAYGROUND_STRIPE_BAND_SWATCH_P3 } from "../../playground/stripeColors";
import type { PlaygroundPersistedConfig } from "../../playground/playgroundPersistence";
import type { PlaygroundMediaKind } from "../../playground/playgroundTextures";

export type ReactExportSnapshot = {
  config: PlaygroundPersistedConfig;
  bandEnabled: StripeBandEnabled;
  bandHex: readonly [string, string, string, string, string];
  bandDisplayP3Css: readonly [string, string, string, string, string];
  displayWidth: number;
  displayHeight: number;
  mediaKind: PlaygroundMediaKind;
};

export function buildPlaygroundExportSnapshot(input: {
  config: PlaygroundPersistedConfig;
  bandEnabled: StripeBandEnabled;
  displayWidth: number;
  displayHeight: number;
  mediaKind: PlaygroundMediaKind;
}): ReactExportSnapshot {
  return {
    config: input.config,
    bandEnabled: [...input.bandEnabled] as StripeBandEnabled,
    bandHex: [...PLAYGROUND_STRIPE_BAND_HEX],
    bandDisplayP3Css: [...PLAYGROUND_STRIPE_BAND_SWATCH_P3],
    displayWidth: input.displayWidth,
    displayHeight: input.displayHeight,
    mediaKind: input.mediaKind,
  };
}

export function formatSnapshotSummary(snapshot: ReactExportSnapshot): string {
  const { config } = snapshot;
  return [
    `- Duotone: ${config.duotoneEnabled ? "on" : "off"}`,
    `- Ignore color: ${config.ignoreColorHex}, tolerance: ${config.ignoreTolerance}`,
    `- Gamma: ${config.gamma}, threshold: ${config.threshold}, density: ${config.density}`,
    `- Display: ${snapshot.displayWidth}×${snapshot.displayHeight}px`,
    `- Band breakpoints: ${(config.bandBreakpoints ?? []).join(", ")}`,
    `- Bands enabled: ${snapshot.bandEnabled.map((on, i) => `${i + 1}:${on ? "yes" : "no"}`).join(", ")}`,
    `- Band colors: ${snapshot.bandHex.join(", ")}`,
    `- Media: ${snapshot.mediaKind}`,
  ].join("\n");
}

export type AsciiVideoConfigWire = {
  duotoneEnabled: boolean;
  ignoreColorHex: string;
  ignoreTolerance: number;
  gamma: number;
  threshold: number;
  density: number;
  displayWidth?: number;
  displayHeight?: number;
  bandBreakpoints: StripeBandBreakpoints;
  bandEnabled: StripeBandEnabled;
  bandHex: readonly [string, string, string, string, string];
  bandDisplayP3Css: readonly [string, string, string, string, string];
};

export function snapshotToAsciiVideoConfig(snapshot: ReactExportSnapshot): AsciiVideoConfigWire {
  return {
    duotoneEnabled: snapshot.config.duotoneEnabled,
    ignoreColorHex: snapshot.config.ignoreColorHex,
    ignoreTolerance: snapshot.config.ignoreTolerance,
    gamma: snapshot.config.gamma,
    threshold: snapshot.config.threshold,
    density: snapshot.config.density,
    displayWidth: snapshot.config.displayWidth ?? snapshot.displayWidth,
    displayHeight: snapshot.config.displayHeight ?? snapshot.displayHeight,
    bandBreakpoints: snapshot.config.bandBreakpoints ?? [1, 2, 3, 4],
    bandEnabled: snapshot.bandEnabled,
    bandHex: snapshot.bandHex,
    bandDisplayP3Css: snapshot.bandDisplayP3Css,
  };
}
