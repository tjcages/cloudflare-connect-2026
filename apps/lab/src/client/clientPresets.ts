import type { ThemedEngineConfig } from "@necatikcl/stripes-engine";
import { LIBRARY_COLOR } from "../components/colorLibrary";
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
  rotateXDeg: number;
  rotateYDeg: number;
  rotateZDeg: number;
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
      centerY: 0.62,
      amplitude: 0.9,
      rotateXDeg: 18,
      rotateYDeg: -12,
    },
  },
  {
    id: "high-fan",
    label: "High fan",
    twizzler: {
      centerY: 0.38,
      amplitude: 1.15,
      rotateXDeg: 8,
      rotateYDeg: -28,
      rotateZDeg: 6,
      scale: 1.08,
    },
  },
  {
    id: "compact",
    label: "Compact",
    twizzler: {
      scale: 0.82,
      amplitude: 0.85,
      rotateXDeg: 10,
      rotateYDeg: -14,
    },
  },
];

export const CLIENT_COLOR_PRESETS: readonly ClientColorPreset[] = [
  {
    id: "coral-classic",
    label: "Orange accent",
    twizzler: {
      color: LIBRARY_COLOR.orangeAccent,
      colorFar: LIBRARY_COLOR.orangePair,
      colorNear: LIBRARY_COLOR.orangeAccent,
      colorEdge: LIBRARY_COLOR.redAccent,
    },
  },
  {
    id: "soft-gold",
    label: "Orange pair",
    twizzler: {
      color: LIBRARY_COLOR.orangePair,
      colorFar: LIBRARY_COLOR.orangePair,
      colorNear: LIBRARY_COLOR.orangePair,
      colorEdge: LIBRARY_COLOR.orangeAccent,
    },
  },
  {
    id: "deep-ember",
    label: "Orange deep",
    twizzler: {
      color: LIBRARY_COLOR.orangeDeep,
      colorFar: LIBRARY_COLOR.orangePair,
      colorNear: LIBRARY_COLOR.orangeDeep,
      colorEdge: LIBRARY_COLOR.redAccent,
    },
  },
  {
    id: "graphite",
    label: "Graphite",
    twizzler: {
      color: LIBRARY_COLOR.graphite,
      colorFar: LIBRARY_COLOR.graphite,
      colorNear: LIBRARY_COLOR.graphite,
      colorEdge: LIBRARY_COLOR.graphite,
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
    opacity: 1,
    scale: 1,
    twist: 1.15,
    rotateXDeg: 12,
    rotateYDeg: -18,
    rotateZDeg: 0,
    amplitude: 1,
    centerY: 0.5,
    speed: 1,
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

/** Map canvas dimensions back to the nearest Size catalog entry. */
export function matchClientSizePresetId(width: number, height: number): ClientSizePresetId {
  const exact = CLIENT_SIZE_PRESETS.find((preset) => preset.width === width && preset.height === height);
  return exact?.id ?? DEFAULT_CLIENT_PREVIEW_STATE.sizeId;
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
    rotateXDeg: settings.rotateXDeg,
    rotateYDeg: settings.rotateYDeg,
    rotateZDeg: settings.rotateZDeg,
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
    rotateXDeg: state.tweaks.rotateXDeg,
    rotateYDeg: state.tweaks.rotateYDeg,
    rotateZDeg: state.tweaks.rotateZDeg,
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

  // Solid library white stage behind Twizzler (Neutral / White).
  if (!engineConfig.background) engineConfig.background = {};
  engineConfig.background.transparent = false;
  engineConfig.background.color = 0xffffff;
  if (engineConfig.frames) engineConfig.frames.enabled = false;

  if (!engineConfig.sparkle) engineConfig.sparkle = {};
  if (!engineConfig.sparkle.gaps) engineConfig.sparkle.gaps = { enabled: false, coverage: 1, speed: 0.1 };
  // Rain checkbox gates the whole stripe/rain layer (not just gap patterning).
  engineConfig.stripesEnabled = state.rainEnabled;
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
