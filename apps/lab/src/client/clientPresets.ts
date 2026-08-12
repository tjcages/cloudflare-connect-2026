import type { ThemedEngineConfig } from "@necatikcl/stripes-engine";
import { findPresetByName, loadBuiltinPresets } from "../presets";
import { normalizeTwizzlerMapSettings, type TwizzlerMapSettings } from "../twizzlerMapSource";
import { normalizeTwizzlerSettings, type TwizzlerSettings } from "../twizzler";

export type ClientSizePresetId = "banner-5x1" | "wide-3x1" | "hero-16x9" | "square";
export type ClientLayoutPresetId = "classic" | "low-ribbon" | "high-fan" | "compact";
export type ClientColorPresetId = "coral-classic" | "soft-gold" | "deep-ember" | "graphite";

export type ClientSizePreset = {
  id: ClientSizePresetId;
  label: string;
  width: number;
  height: number;
};

export type ClientLayoutPreset = {
  id: ClientLayoutPresetId;
  label: string;
  /** Partial overrides applied on top of the Banner 5:1 Twizzler baseline. */
  twizzler: Partial<TwizzlerSettings>;
};

export type ClientColorPreset = {
  id: ClientColorPresetId;
  label: string;
  twizzler: Pick<TwizzlerSettings, "color" | "colorFar" | "colorNear" | "colorEdge">;
};

/** Tunable knobs exposed in client preview (no camera). */
export type ClientTwizzlerTweaks = {
  opacity: number;
  scale: number;
  twist: number;
  amplitude: number;
  centerY: number;
  speed: number;
};

export type ClientPreviewState = {
  sizeId: ClientSizePresetId;
  layoutId: ClientLayoutPresetId;
  colorId: ClientColorPresetId;
  twizzlerEnabled: boolean;
  rainEnabled: boolean;
  tweaks: ClientTwizzlerTweaks;
};

export const CLIENT_SIZE_PRESETS: readonly ClientSizePreset[] = [
  { id: "banner-5x1", label: "Banner 5:1", width: 1600, height: 320 },
  { id: "wide-3x1", label: "Wide 3:1", width: 1440, height: 480 },
  { id: "hero-16x9", label: "Hero 16:9", width: 1280, height: 720 },
  { id: "square", label: "Square", width: 800, height: 800 },
];

export const CLIENT_LAYOUT_PRESETS: readonly ClientLayoutPreset[] = [
  {
    id: "classic",
    label: "Classic",
    twizzler: {},
  },
  {
    id: "low-ribbon",
    label: "Low ribbon",
    twizzler: {
      centerY: 0.58,
      amplitude: 0.85,
      depthLift: 0.55,
      depthSpread: 1.05,
    },
  },
  {
    id: "high-fan",
    label: "High fan",
    twizzler: {
      centerY: 0.32,
      amplitude: 1.15,
      depthSpread: 1.35,
      depthLift: 1.05,
      twist: 1.55,
      rightHeight: 0.42,
    },
  },
  {
    id: "compact",
    label: "Compact",
    twizzler: {
      scale: 0.92,
      amplitude: 0.78,
      depthSpread: 0.95,
      leftHeight: 0.5,
      rightHeight: 0.28,
    },
  },
];

export const CLIENT_COLOR_PRESETS: readonly ClientColorPreset[] = [
  {
    id: "coral-classic",
    label: "Coral classic",
    twizzler: {
      color: "#e8481c",
      colorFar: "#ffd89a",
      colorNear: "#e8481c",
      colorEdge: "#ffc857",
    },
  },
  {
    id: "soft-gold",
    label: "Soft gold",
    twizzler: {
      color: "#f0a030",
      colorFar: "#ffe9b8",
      colorNear: "#e88820",
      colorEdge: "#ffd76a",
    },
  },
  {
    id: "deep-ember",
    label: "Deep ember",
    twizzler: {
      color: "#c4320f",
      colorFar: "#f0c080",
      colorNear: "#a8280c",
      colorEdge: "#f0a040",
    },
  },
  {
    id: "graphite",
    label: "Graphite",
    twizzler: {
      color: "#4a4a4a",
      colorFar: "#c8c8c8",
      colorNear: "#2e2e2e",
      colorEdge: "#9a9a9a",
    },
  },
];

export const DEFAULT_CLIENT_PREVIEW_STATE: ClientPreviewState = {
  sizeId: "banner-5x1",
  layoutId: "classic",
  colorId: "coral-classic",
  twizzlerEnabled: true,
  // Rain stays off by default until the Twizzler match is accepted (CF-16).
  rainEnabled: false,
  tweaks: {
    opacity: 0.88,
    scale: 1.15,
    twist: 1.35,
    amplitude: 1,
    centerY: 0.4,
    speed: 0,
  },
};

export type ClientPreviewBundle = {
  engineConfig: ThemedEngineConfig;
  twizzler: TwizzlerSettings;
  twizzlerMap: TwizzlerMapSettings;
  canvasWidth: number;
  canvasHeight: number;
  shaderSourceWidth: number;
  shaderSourceHeight: number;
};

function requireBannerPreset(): {
  config: ThemedEngineConfig;
  lab: {
    twizzler?: unknown;
    twizzlerMap?: unknown;
    shaderSourceWidth?: number;
    shaderSourceHeight?: number;
  };
} {
  const preset = findPresetByName(loadBuiltinPresets(), "Banner 5:1");
  if (!preset?.config) {
    throw new Error('Builtin preset "Banner 5:1" is required for client preview');
  }
  return {
    config: structuredClone(preset.config) as ThemedEngineConfig,
    lab: (preset.lab ?? {}) as {
      twizzler?: unknown;
      twizzlerMap?: unknown;
      shaderSourceWidth?: number;
      shaderSourceHeight?: number;
    },
  };
}

export function findClientSizePreset(id: ClientSizePresetId): ClientSizePreset {
  switch (id) {
    case "banner-5x1":
    case "wide-3x1":
    case "hero-16x9":
    case "square": {
      const preset = CLIENT_SIZE_PRESETS.find((entry) => entry.id === id);
      if (!preset) throw new Error(`Missing client size preset: ${id}`);
      return preset;
    }
    default: {
      const _exhaustive: never = id;
      throw new Error(`Unknown client size preset: ${String(_exhaustive)}`);
    }
  }
}

export function findClientLayoutPreset(id: ClientLayoutPresetId): ClientLayoutPreset {
  switch (id) {
    case "classic":
    case "low-ribbon":
    case "high-fan":
    case "compact": {
      const preset = CLIENT_LAYOUT_PRESETS.find((entry) => entry.id === id);
      if (!preset) throw new Error(`Missing client layout preset: ${id}`);
      return preset;
    }
    default: {
      const _exhaustive: never = id;
      throw new Error(`Unknown client layout preset: ${String(_exhaustive)}`);
    }
  }
}

export function findClientColorPreset(id: ClientColorPresetId): ClientColorPreset {
  switch (id) {
    case "coral-classic":
    case "soft-gold":
    case "deep-ember":
    case "graphite": {
      const preset = CLIENT_COLOR_PRESETS.find((entry) => entry.id === id);
      if (!preset) throw new Error(`Missing client color preset: ${id}`);
      return preset;
    }
    default: {
      const _exhaustive: never = id;
      throw new Error(`Unknown client color preset: ${String(_exhaustive)}`);
    }
  }
}

export function tweaksFromTwizzler(settings: TwizzlerSettings): ClientTwizzlerTweaks {
  return {
    opacity: settings.opacity,
    scale: settings.scale,
    twist: settings.twist,
    amplitude: settings.amplitude,
    centerY: settings.centerY,
    speed: settings.speed,
  };
}

/** Build engine + Twizzler state for the limited client preview (no camera). */
export function buildClientPreviewBundle(state: ClientPreviewState): ClientPreviewBundle {
  const banner = requireBannerPreset();
  const size = findClientSizePreset(state.sizeId);
  const layout = findClientLayoutPreset(state.layoutId);
  const color = findClientColorPreset(state.colorId);

  const baseTwizzler = normalizeTwizzlerSettings(banner.lab.twizzler);
  const twizzler = normalizeTwizzlerSettings({
    ...baseTwizzler,
    ...layout.twizzler,
    ...color.twizzler,
    opacity: state.tweaks.opacity,
    scale: state.tweaks.scale,
    twist: state.tweaks.twist,
    amplitude: state.tweaks.amplitude,
    centerY: state.tweaks.centerY,
    speed: state.tweaks.speed,
  });

  const twizzlerMap = normalizeTwizzlerMapSettings(banner.lab.twizzlerMap);

  const engineConfig = structuredClone(banner.config) as ThemedEngineConfig & {
    background?: { transparent?: boolean; color?: number };
    sparkle?: { gaps?: { enabled?: boolean; coverage?: number; speed?: number } };
    frames?: { enabled?: boolean };
  };

  // Ribbon must show through WebGL clear — force transparent regardless of preset helpers.
  if (!engineConfig.background) engineConfig.background = {};
  engineConfig.background.transparent = true;
  if (typeof engineConfig.background.color !== "number") engineConfig.background.color = 0xffffff;
  if (engineConfig.frames) engineConfig.frames.enabled = false;

  if (!engineConfig.sparkle) engineConfig.sparkle = {};
  if (!engineConfig.sparkle.gaps) engineConfig.sparkle.gaps = { enabled: false, coverage: 1, speed: 0.1 };
  engineConfig.sparkle.gaps.enabled = state.rainEnabled;
  if (state.rainEnabled) {
    engineConfig.sparkle.gaps.coverage = engineConfig.sparkle.gaps.coverage ?? 1;
    engineConfig.sparkle.gaps.speed = engineConfig.sparkle.gaps.speed ?? 0.1;
  }

  const shaderSourceWidth = Math.max(1, Math.round(banner.lab.shaderSourceWidth ?? 1280));
  const shaderSourceHeight = Math.max(1, Math.round(banner.lab.shaderSourceHeight ?? 960));

  return {
    engineConfig,
    twizzler,
    twizzlerMap,
    canvasWidth: size.width,
    canvasHeight: size.height,
    shaderSourceWidth,
    shaderSourceHeight,
  };
}

export function resetTweaksForPresets(
  layoutId: ClientLayoutPresetId,
  colorId: ClientColorPresetId,
): ClientTwizzlerTweaks {
  const banner = requireBannerPreset();
  const layout = findClientLayoutPreset(layoutId);
  const color = findClientColorPreset(colorId);
  const merged = normalizeTwizzlerSettings({
    ...normalizeTwizzlerSettings(banner.lab.twizzler),
    ...layout.twizzler,
    ...color.twizzler,
  });
  return tweaksFromTwizzler(merged);
}
