import type { ThemedEngineConfig } from "@necatikcl/stripes-engine";
import { findLibraryColor, LIBRARY_COLOR } from "../components/colorLibrary";
import { findPresetByName, loadBuiltinPresets } from "../presets";
import { normalizeTwizzlerMapSettings, type TwizzlerMapSettings } from "../twizzlerMapSource";
import { normalizeTwizzlerSettings, type TwizzlerRibbonColorMode, type TwizzlerSettings } from "../twizzler";
import { defaultTwizzlerGradientFieldStops } from "../twizzlerGradient";
import { sectionGridRainEngineConfig } from "./sectionGridRainDefaults";

export type ClientSizePresetId = "banner-5x1" | "wide-3x1" | "hero-16x9" | "square";
export type ClientLayoutPresetId = "classic" | "low-ribbon" | "high-fan" | "compact";
export type ClientColorPresetId =
  | "coral-classic"
  | "red"
  | "green"
  | "blue"
  | "purple"
  | "soft-gold"
  | "deep-ember"
  | "light";
/** Client stage look: light = orange Twizzler on white; dark = cream Twizzler on deep orange. */
export type ClientAppearanceId = "light" | "dark";
/** Client stack: Twizzler ribbon, section-grid Rain stripes, or both. */
export type ClientGraphicMode = "twizzler" | "rain" | "both";

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

export type ClientStripePaletteName = "Orange" | "Red" | "Green" | "Blue" | "Purple" | "Neutral" | "White";

export type ClientColorPreset = {
  id: ClientColorPresetId;
  label: string;
  /** Original stripes-shader hue profile applied to rain bands. */
  stripePalette: ClientStripePaletteName;
  twizzler: Pick<TwizzlerSettings, "color" | "colorFar" | "colorNear" | "colorEdge">;
};

function hueFamilyInk(
  group: "Red" | "Orange" | "Green" | "Blue" | "Purple",
): Pick<TwizzlerSettings, "color" | "colorFar" | "colorNear" | "colorEdge"> {
  const pair = findLibraryColor(group, "800 [Pair]")?.hex;
  const accent = findLibraryColor(group, "900 [Accent]")?.hex;
  const deep = findLibraryColor(group, "1000")?.hex;
  if (!pair || !accent || !deep) {
    throw new Error(`Missing ${group} library Pair/Accent/Deep tokens`);
  }
  return { color: accent, colorFar: pair, colorNear: accent, colorEdge: deep };
}

export type ClientAppearancePreset = {
  id: ClientAppearanceId;
  label: string;
  /** Solid stage background hex. */
  backgroundHex: string;
  twizzler: Pick<TwizzlerSettings, "color" | "colorFar" | "colorNear" | "colorEdge">;
  /** Ribbon color mode applied when Appearance is toggled. */
  ribbonColorMode: TwizzlerRibbonColorMode;
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
  appearanceId: ClientAppearanceId;
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
    label: "Default",
    stripePalette: "Orange",
    twizzler: {
      color: LIBRARY_COLOR.orangeAccent,
      colorFar: LIBRARY_COLOR.orangePair,
      colorNear: LIBRARY_COLOR.orangeAccent,
      colorEdge: LIBRARY_COLOR.redAccent,
    },
  },
  {
    id: "red",
    label: "Red",
    stripePalette: "Red",
    twizzler: hueFamilyInk("Red"),
  },
  {
    id: "green",
    label: "Green",
    stripePalette: "Green",
    twizzler: hueFamilyInk("Green"),
  },
  {
    id: "blue",
    label: "Blue",
    stripePalette: "Blue",
    twizzler: hueFamilyInk("Blue"),
  },
  {
    id: "purple",
    label: "Purple",
    stripePalette: "Purple",
    twizzler: hueFamilyInk("Purple"),
  },
  {
    id: "soft-gold",
    label: "Orange pair",
    stripePalette: "Orange",
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
    stripePalette: "Orange",
    twizzler: {
      color: LIBRARY_COLOR.orangeDeep,
      colorFar: LIBRARY_COLOR.orangePair,
      colorNear: LIBRARY_COLOR.orangeDeep,
      colorEdge: LIBRARY_COLOR.redAccent,
    },
  },
  {
    // Same cream ramp as Dark Appearance (stripes-settings-cf-base).
    id: "light",
    label: "Light",
    stripePalette: "Neutral",
    twizzler: {
      color: "#ffefd4",
      colorFar: "#ffd39e",
      colorNear: "#ffefd4",
      colorEdge: "#f0f0f0",
    },
  },
];

/** Light = marketing orange on white; Dark = cream ribbon on deep orange. Both boot Shared/Fiber Field. */
export const CLIENT_APPEARANCE_PRESETS: readonly ClientAppearancePreset[] = [
  {
    id: "light",
    label: "Light",
    backgroundHex: LIBRARY_COLOR.white,
    twizzler: {
      color: LIBRARY_COLOR.orangeAccent,
      colorFar: LIBRARY_COLOR.orangePair,
      colorNear: LIBRARY_COLOR.orangeAccent,
      colorEdge: LIBRARY_COLOR.redAccent,
    },
    ribbonColorMode: "sharedGradient",
  },
  {
    id: "dark",
    label: "Dark",
    // From stripes-settings-cf-base.json (stage #f86a00; Orange 300→100 cream ramp).
    backgroundHex: "#f86a00",
    twizzler: {
      color: "#ffefd4",
      colorFar: "#ffd39e",
      colorNear: "#ffefd4",
      colorEdge: "#f0f0f0",
    },
    ribbonColorMode: "sharedGradient",
  },
];

export const CLIENT_GRAPHIC_MODES: readonly { id: ClientGraphicMode; label: string }[] = [
  { id: "twizzler", label: "Twizzler" },
  { id: "rain", label: "Rain" },
  { id: "both", label: "Both" },
];

/** Map Show + Rain flags → Graphic mode (neither → Twizzler). */
export function resolveClientGraphicMode(twizzlerEnabled: boolean, rainEnabled: boolean): ClientGraphicMode {
  if (rainEnabled && twizzlerEnabled) return "both";
  if (rainEnabled) return "rain";
  return "twizzler";
}

/**
 * Sync Hero → Graphic from Show/Rain flags only when those flags actually change
 * (Apply layout / Reset). Do not sync when Graphic changed first and flags are
 * still catching up — that race snaps Rain back to Twizzler (CF-67).
 */
export function shouldSyncHeroGraphicFromFlags(args: {
  prevFlags: { twizzlerEnabled: boolean; rainEnabled: boolean } | null;
  twizzlerEnabled: boolean;
  rainEnabled: boolean;
  heroGraphic: ClientGraphicMode;
}): {
  nextFlags: { twizzlerEnabled: boolean; rainEnabled: boolean };
  derived: ClientGraphicMode;
  sync: boolean;
} {
  const nextFlags = { twizzlerEnabled: args.twizzlerEnabled, rainEnabled: args.rainEnabled };
  const derived = resolveClientGraphicMode(args.twizzlerEnabled, args.rainEnabled);
  if (args.prevFlags === null) {
    return { nextFlags, derived, sync: false };
  }
  const flagsChanged =
    args.prevFlags.twizzlerEnabled !== nextFlags.twizzlerEnabled ||
    args.prevFlags.rainEnabled !== nextFlags.rainEnabled;
  return {
    nextFlags,
    derived,
    sync: flagsChanged && derived !== args.heroGraphic,
  };
}

export function clientGraphicFlags(mode: ClientGraphicMode): { twizzlerEnabled: boolean; rainEnabled: boolean } {
  switch (mode) {
    case "twizzler":
      return { twizzlerEnabled: true, rainEnabled: false };
    case "rain":
      return { twizzlerEnabled: false, rainEnabled: true };
    case "both":
      return { twizzlerEnabled: true, rainEnabled: true };
    default: {
      const _exhaustive: never = mode;
      throw new Error(`Unknown client graphic mode: ${String(_exhaustive)}`);
    }
  }
}

/** Which SVG groups to emit for the live Graphic selector. */
export function resolveClientSvgExportLayers(mode: ClientGraphicMode): {
  includeTwizzler: boolean;
  includeRain: boolean;
} {
  const flags = clientGraphicFlags(mode);
  return { includeTwizzler: flags.twizzlerEnabled, includeRain: flags.rainEnabled };
}

/**
 * Twizzler-only Graphic: hide rain FX for render without mutating Leva / stored knobs.
 * Rain + Both keep the live enabled flags as authored.
 */
export function withClientRainFxVisibility<T extends ThemedEngineConfig>(config: T, rainEnabled: boolean): T {
  if (rainEnabled) return config;
  const background = config.background;
  const sparkle = config.sparkle;
  return {
    ...config,
    ...(config.frames ? { frames: { ...config.frames, enabled: false } } : {}),
    ...(config.letters ? { letters: { ...config.letters, enabled: false } } : {}),
    ...(config.flames ? { flames: { ...config.flames, enabled: false } } : {}),
    ...(background
      ? {
          background: {
            ...background,
            ...(background.stars ? { stars: { ...background.stars, enabled: false } } : {}),
            ...(background.meteors ? { meteors: { ...background.meteors, enabled: false } } : {}),
          },
        }
      : {}),
    ...(sparkle
      ? {
          sparkle: {
            ...sparkle,
            ...(sparkle.gaps ? { gaps: { ...sparkle.gaps, enabled: false } } : {}),
            ...(sparkle.stripe ? { stripe: { ...sparkle.stripe, enabled: false } } : {}),
            ...(sparkle.width ? { width: { ...sparkle.width, enabled: false } } : {}),
            ...(sparkle.motion ? { motion: { ...sparkle.motion, enabled: false } } : {}),
          },
        }
      : {}),
  };
}

export const DEFAULT_CLIENT_PREVIEW_STATE: ClientPreviewState = {
  sizeId: "hero-16x9",
  layoutId: "classic",
  colorId: "coral-classic",
  appearanceId: "light",
  twizzlerEnabled: true,
  // Graphic default = Twizzler (Rain off). Rain = section-grid stripe gaps overlay.
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
    case "red":
    case "green":
    case "blue":
    case "purple":
    case "soft-gold":
    case "deep-ember":
    case "light": {
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

export function findClientAppearancePreset(id: ClientAppearanceId): ClientAppearancePreset {
  switch (id) {
    case "light":
    case "dark": {
      const preset = CLIENT_APPEARANCE_PRESETS.find((entry) => entry.id === id);
      if (!preset) throw new Error(`Missing client appearance preset: ${id}`);
      return preset;
    }
    default: {
      const _exhaustive: never = id;
      throw new Error(`Unknown client appearance preset: ${String(_exhaustive)}`);
    }
  }
}

/**
 * Map Size/Layout/Color/Appearance presets onto Rain (Connect + stripe grid) Leva keys.
 * Same preset catalog as Twizzler — values target the rain shader when Graphic includes Rain.
 */
export function rainLevaFromLayout(layoutId: ClientLayoutPresetId): Record<string, unknown> {
  const layout = findClientLayoutPreset(layoutId).twizzler;
  const patch: Record<string, unknown> = {};
  if (layout.rotateXDeg !== undefined) patch.connectCameraRotateX = layout.rotateXDeg + 30;
  if (layout.rotateYDeg !== undefined) patch.connectCameraRotateY = layout.rotateYDeg - 90;
  if (layout.rotateZDeg !== undefined) {
    patch.connectCameraRotateZ = layout.rotateZDeg - 83;
    patch.orientationAngleDeg = layout.rotateZDeg;
  }
  if (layout.centerY !== undefined) patch.connectCameraPanY = (0.5 - layout.centerY) * 40;
  if (layout.scale !== undefined) {
    patch.textureDpr = Math.max(0.25, Math.min(2, layout.scale * 0.25));
    patch.zoom = layout.scale;
  }
  if (layout.amplitude !== undefined) {
    patch.connectDisplacement = layout.amplitude * 2.5;
    patch.connectShapeAmplitude = layout.amplitude * 20;
  }
  return patch;
}

export function rainLevaFromColor(colorId: ClientColorPresetId): Record<string, unknown> {
  const preset = findClientColorPreset(colorId);
  const color = preset.twizzler;
  const near = color.colorNear ?? color.color;
  const far = color.colorFar;
  const edge = color.colorEdge;
  return {
    stripePalette: preset.stripePalette,
    connectFillColor: near,
    connectFillColor2: far,
    connectOrangeColor: near,
    connectAmberColor: far,
    connectDeepColor: edge,
    connectEmitOrangeColor: near,
    connectEmitAmberColor: far,
    connectEmitDeepColor: edge,
    connectLineColor: edge,
    connectPaleColor: far,
    connectSalmonColor: near,
  };
}

export function rainLevaFromAppearance(appearanceId: ClientAppearanceId): Record<string, unknown> {
  const appearance = findClientAppearancePreset(appearanceId);
  const near = appearance.twizzler.colorNear ?? appearance.twizzler.color;
  const far = appearance.twizzler.colorFar;
  const edge = appearance.twizzler.colorEdge;
  return {
    backgroundFillMode: "solid",
    backgroundColor: appearance.backgroundHex,
    connectFillColor: near,
    connectFillColor2: far,
    connectOrangeColor: near,
    connectAmberColor: far,
    connectDeepColor: edge,
    connectEmitOrangeColor: near,
    connectEmitAmberColor: far,
    connectEmitDeepColor: edge,
    connectLineColor: edge,
    connectPaleColor: far,
    connectSalmonColor: near,
  };
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
  const appearance = findClientAppearancePreset(state.appearanceId);

  const baseTwizzler = normalizeTwizzlerSettings(banner.lab.twizzler);
  const twizzler = normalizeTwizzlerSettings({
    ...baseTwizzler,
    ...layout.twizzler,
    ...color.twizzler,
    ribbonColorMode: appearance.ribbonColorMode,
    gradientStops: defaultTwizzlerGradientFieldStops(
      color.twizzler.colorFar,
      color.twizzler.colorNear,
      color.twizzler.colorEdge,
    ),
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

  // Twizzler Graphic keeps Banner marketing config. Rain Graphic uses the
  // section-grid-generator factory engine (opaque stripes, 7×7 / 0°, factory tone).
  const engineConfig = (
    state.rainEnabled ? sectionGridRainEngineConfig() : structuredClone(banner.config)
  ) as ThemedEngineConfig & {
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
  // Rain = individual stripe rects overlay (gaps). Twizzler ribbon stays independent.
  // Keep stripesEnabled on so the engine output can composite; LabApp hides the rain
  // canvas when Rain is off so Twizzler is not covered by an opaque empty pass.
  engineConfig.stripesEnabled = true;
  engineConfig.sparkle.gaps.enabled = state.rainEnabled;
  if (state.rainEnabled) {
    // Factory coverage is 0 (continuous cells). Never inherit Banner's coverage=1 (blank).
    engineConfig.sparkle.gaps.coverage = engineConfig.sparkle.gaps.coverage ?? 0;
    engineConfig.sparkle.gaps.speed = engineConfig.sparkle.gaps.speed ?? 1;
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

export function resetTweaksForLayout(layoutId: ClientLayoutPresetId): ClientTwizzlerTweaks {
  const banner = requireBannerPreset();
  const layout = findClientLayoutPreset(layoutId);
  const merged = normalizeTwizzlerSettings({
    ...normalizeTwizzlerSettings(banner.lab.twizzler),
    ...layout.twizzler,
  });
  return tweaksFromTwizzler(merged);
}

/** @deprecated Prefer resetTweaksForLayout — color presets do not affect tweaks. */
export function resetTweaksForPresets(
  layoutId: ClientLayoutPresetId,
  _colorId: ClientColorPresetId,
): ClientTwizzlerTweaks {
  return resetTweaksForLayout(layoutId);
}
