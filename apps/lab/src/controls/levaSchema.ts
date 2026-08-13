import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useControls, useCreateStore, folder, button, buttonGroup } from "leva";
import { normalizeEngineConfig, resolveThemedConfig } from "@necatikcl/stripes-engine";
import type { DeepPartial, EdgeMaskSides, EngineConfig, Stripe, ThemedEngineConfig } from "@necatikcl/stripes-engine";
import {
  consumeImportedConfigPristine,
  loadEditTheme,
  loadInitialConfig,
  loadLabSettings,
  loadStickyBackgroundColor,
  loadTextureId,
  saveStickyBackgroundColor,
} from "../persistence";
import type { LabEditTheme, LabSettings } from "../persistence";
import { fromEditable, type EditableStripe } from "./stripeAdapter";
import { stripeColorsTablePlugin, stripeColorsTableRuntime, stripeSyncKey } from "./stripeColorsTablePlugin";
import { colorLibraryInputPlugin } from "./colorLibraryInputPlugin";
import { gradientStopsPlugin } from "./gradientStopsPlugin";
import { timeTransportPlugin } from "./timeTransportPlugin";
import type { TimeTransportController } from "../components/TimeTransport";
import { DEFAULT_LAB_TEXTURE_ID, buildTextureEntries, findTextureEntry } from "../textures";
import { DEFAULT_LAB_ENGINE_CONFIG } from "../defaultLabConfig";
import { loadManifest } from "../uploads";
import { loadDefaultPreset } from "../presets";
import {
  CONNECT_CAMERA_DEFAULTS,
  buildConnectShaderLevaFolders,
  connectShaderParamsFromLevaValues,
  normalizeConnectShaderParams,
  type ConnectCameraState,
  type ConnectShaderParams,
} from "../connectShader";
import { SHADER_VIEW_DEFAULTS, type ShaderViewState } from "../shaderView";
import type { ShaderConfigKind } from "../shaderConfig";
import { CONNECT_SHADER_PRESET_ID, SHADER_LIBRARY } from "../shaderLibrary";
import { normalizeTwizzlerSettings, type TwizzlerSettings } from "../twizzler";
import {
  defaultTwizzlerGradientFieldStops,
  parseTwizzlerGradientStops,
  serializeTwizzlerGradientStops,
  withTwizzlerGradientEndpointColors,
} from "../twizzlerGradient";
import { normalizeTwizzlerMapSettings, type TwizzlerMapSettings } from "../twizzlerMapSource";
import { COMET_LOGO_DEFAULTS, normalizeCometLogoSettings, type CometLogoSettings } from "@necatikcl/stripes-engine";
import {
  applyStripePalette,
  BACKGROUND_RAMP_EASING_OPTIONS,
  BACKGROUND_RAMP_PALETTE_NAME,
  DEFAULT_BACKGROUND_RAMP_SETTINGS,
  WHITE_STRIPE_PALETTE_NAME,
  type BackgroundRampEasing,
  type BackgroundRampSettings,
  detectStripePalette,
  mapPaletteColor,
  normalizeBackgroundRampSettings,
  shuffleStripePalette,
  STRIPE_PALETTE_NAMES,
} from "./stripePalette";
import { reverseStripeColors } from "./stripeColorOrder";
import { EASING_OPTIONS, easeValue, parseCustomEasing, type EasingName } from "./easing";
import { loadControlDrawerOpen, loadControlDrawerSnapshot } from "./drawerState";
import {
  customStripePaletteValue,
  findCustomStripePalette,
  loadCustomStripePalettes,
  saveCustomStripePalettes,
  upsertCustomStripePalette,
  type CustomStripePalette,
} from "./customStripePalettes";
import {
  CLIENT_APPEARANCE_PRESETS,
  CLIENT_COLOR_PRESETS,
  CLIENT_GRAPHIC_MODES,
  CLIENT_LAYOUT_PRESETS,
  CLIENT_SIZE_PRESETS,
  DEFAULT_CLIENT_PREVIEW_STATE,
  clientGraphicFlags,
  findClientAppearancePreset,
  findClientColorPreset,
  findClientLayoutPreset,
  findClientSizePreset,
  matchClientSizePresetId,
  rainLevaFromAppearance,
  rainLevaFromColor,
  rainLevaFromLayout,
  resetTweaksForLayout,
  resolveClientGraphicMode,
  type ClientAppearanceId,
  type ClientColorPresetId,
  type ClientGraphicMode,
  type ClientLayoutPresetId,
  type ClientSizePresetId,
} from "../client/clientPresets";

/** Set during `useEngineControls` so drawerFolder can gate Default vs Advanced. */
let clientDefaultPanelActive = false;
/** True for the whole client / agency review app (Default + Advanced). */
let clientAppActive = false;
/** Client Hero → Graphic includes Rain (rain | both). */
let clientRainAuthoringActive = false;
/** Client Hero → Graphic includes Twizzler (twizzler | both). */
let clientTwizzlerAuthoringActive = false;

function drawerFolder<S extends Parameters<typeof folder>[0]>(
  id: string,
  schema: S,
  options: {
    defaultOpen?: boolean;
    /** Leva folder visibility. Receives `get` so gates can read sibling controls (e.g. Color mode). */
    render?: (get: (path: string) => unknown) => boolean;
    /** Hide this folder in client Default panel (still registered; shows in Advanced). */
    hideInClient?: boolean;
    /** Only show this folder in the client app (Default + Advanced). */
    clientOnly?: boolean;
    /**
     * Rain authoring folder: in the client app, only visible when Graphic is Rain/Both.
     * When rain is selected, also shows in Default (bypasses hideInClient).
     */
    rainInClient?: boolean;
    /** Twizzler authoring folder: in the client app, only visible when Graphic is Twizzler/Both. */
    twizzlerInClient?: boolean;
  } = {},
) {
  const {
    defaultOpen = false,
    hideInClient = false,
    clientOnly = false,
    rainInClient = false,
    twizzlerInClient = false,
    render,
    ...folderOptions
  } = options;
  return folder(schema, {
    ...folderOptions,
    collapsed: !loadControlDrawerOpen(id, loadLabSettings().drawerOpen[id] ?? defaultOpen),
    render: (get: (path: string) => unknown) => {
      if (clientOnly && !clientAppActive) return false;
      if (clientAppActive) {
        if (rainInClient && !clientRainAuthoringActive) return false;
        if (twizzlerInClient && !clientTwizzlerAuthoringActive) return false;
        if (rainInClient && clientRainAuthoringActive) {
          return render ? render(get) : true;
        }
        if (twizzlerInClient && clientTwizzlerAuthoringActive) {
          return render ? render(get) : true;
        }
      }
      if (hideInClient && clientDefaultPanelActive) return false;
      return render ? render(get) : true;
    },
  });
}

const SHADER_PANEL_ORDER = ["Hero", "Presets", "Twizzler", "Rain"] as const;

function orderShaderPanel<T extends Record<string, unknown>>(schema: T): T {
  const ordered: Record<string, unknown> = {};
  for (const key of SHADER_PANEL_ORDER) {
    if (key in schema) ordered[key] = schema[key];
  }
  for (const [key, value] of Object.entries(schema)) {
    if (!(key in ordered)) ordered[key] = value;
  }
  return ordered as T;
}

const OLD_DEFAULT_STRIPES: Stripe[] = [
  { color: 0xf3f3f3, startFrom: 0.12, width: 1, opacity: 1 },
  { color: 0xfada98, startFrom: 0.28, width: 1, opacity: 1 },
  { color: 0xf8bd70, startFrom: 0.44, width: 2, opacity: 1 },
  { color: 0xf69e4d, startFrom: 0.6, width: 3, opacity: 1 },
  { color: 0xf27c33, startFrom: 0.76, width: 4, opacity: 1 },
  { color: 0xeb5729, startFrom: 0.9, width: 5, opacity: 1 },
];

const DEFAULT_STRIPE_THRESHOLD_MIN = 0;
const DEFAULT_STRIPE_THRESHOLD_MAX = 0.8;
const DEFAULT_STRIPE_WIDTH_START = 0.5;
const DEFAULT_STRIPE_WIDTH_STEP = 0.5;
const THRESHOLD_DISTRIBUTION_EASING_OPTIONS = EASING_OPTIONS;
type ThresholdDistributionEasing = EasingName;

function isKnownEasing(value: string, options: Readonly<Record<string, string>>): boolean {
  return value.startsWith("custom:") && parseCustomEasing(value) !== null
    ? true
    : Object.values(options).includes(value);
}

function easeThresholdDistribution(t: number, easing: ThresholdDistributionEasing): number {
  return easeValue(t, easing);
}

function clampStripeThreshold(value: number): number {
  return Math.min(DEFAULT_STRIPE_THRESHOLD_MAX, Math.max(DEFAULT_STRIPE_THRESHOLD_MIN, value));
}

function defaultStripeThreshold(index: number, total: number, easing: ThresholdDistributionEasing = "linear"): number {
  if (total <= 1) return DEFAULT_STRIPE_THRESHOLD_MIN;
  const t = index / (total - 1);
  const eased = easeThresholdDistribution(t, easing);
  return Number(
    clampStripeThreshold(
      DEFAULT_STRIPE_THRESHOLD_MIN + (DEFAULT_STRIPE_THRESHOLD_MAX - DEFAULT_STRIPE_THRESHOLD_MIN) * eased,
    ).toFixed(4),
  );
}

function defaultStripeWidth(index: number): number {
  return Number((DEFAULT_STRIPE_WIDTH_START + index * DEFAULT_STRIPE_WIDTH_STEP).toFixed(4));
}

function sameStripeWidth(a: number, b: number): boolean {
  return Math.abs(a - b) < 0.0001;
}

function withDefaultStripeWidths<T extends { width: number }>(stripes: readonly T[]): T[] {
  return stripes.map((stripe, index) => ({
    ...stripe,
    width: defaultStripeWidth(index),
  }));
}

function hasDefaultStripeWidthDistribution(stripes: readonly { width: number }[]): boolean {
  return stripes.every((stripe, index) => sameStripeWidth(stripe.width, defaultStripeWidth(index)));
}

function hasLegacyStripeWidthDistribution(stripes: readonly { width: number }[]): boolean {
  const legacyHalfStepFromOne = stripes.every((stripe, index) => sameStripeWidth(stripe.width, 1 + index * 0.5));
  const legacySixStripeDefault = stripes.every((stripe, index) => sameStripeWidth(stripe.width, index < 2 ? 1 : index));
  const legacyEightStripeDefault = stripes.every((stripe, index) =>
    sameStripeWidth(stripe.width, index < 3 ? 1 : index - 1),
  );
  return legacyHalfStepFromOne || legacySixStripeDefault || legacyEightStripeDefault;
}

function hasAutomaticStripeWidthDistribution(stripes: readonly { width: number }[]): boolean {
  return hasDefaultStripeWidthDistribution(stripes) || hasLegacyStripeWidthDistribution(stripes);
}

function withDefaultStripeThresholdDistribution<T extends { startFrom: number }>(
  stripes: readonly T[],
  easing: ThresholdDistributionEasing = "linear",
): T[] {
  return stripes.map((stripe, index) => ({
    ...stripe,
    startFrom: defaultStripeThreshold(index, stripes.length, easing),
  }));
}

function withDefaultStripeDistribution<T extends { startFrom: number; width: number }>(
  stripes: readonly T[],
  easing: ThresholdDistributionEasing = "linear",
): T[] {
  return stripes.map((stripe, index) => ({
    ...stripe,
    startFrom: defaultStripeThreshold(index, stripes.length, easing),
    width: defaultStripeWidth(index),
  }));
}

const LAB_DEFAULT_STRIPES: Stripe[] = withDefaultStripeDistribution([
  { color: 0xfff8e8, startFrom: 0.08, width: 1, opacity: 1 },
  { color: 0xfeefd2, startFrom: 0.2, width: 1, opacity: 1 },
  { color: 0xffe3b5, startFrom: 0.32, width: 1, opacity: 1 },
  { color: 0xffd295, startFrom: 0.44, width: 2, opacity: 1 },
  { color: 0xffb970, startFrom: 0.56, width: 3, opacity: 1 },
  { color: 0xfe9c4c, startFrom: 0.68, width: 4, opacity: 1 },
  { color: 0xf67c3e, startFrom: 0.8, width: 5, opacity: 1 },
  { color: 0xeb5729, startFrom: 0.92, width: 6, opacity: 1 },
]);

function intToHex(value: number): string {
  return `#${(value & 0xffffff).toString(16).padStart(6, "0")}`;
}

function hexToInt(hex: string | null | undefined): number {
  if (typeof hex !== "string") return 0;
  const parsed = Number.parseInt(hex.replace(/^#/, ""), 16);
  return Number.isFinite(parsed) ? parsed & 0xffffff : 0;
}

function colorLuminance(color: number): number {
  const r = ((color >> 16) & 255) / 255;
  const g = ((color >> 8) & 255) / 255;
  const b = (color & 255) / 255;
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function rgbToHsl(color: number): { h: number; s: number; l: number } {
  const r = ((color >> 16) & 255) / 255;
  const g = ((color >> 8) & 255) / 255;
  const b = (color & 255) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return { h: 0, s: 0, l };
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  const h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return { h: h / 6, s, l };
}

function hueToRgb(p: number, q: number, t: number): number {
  let next = t;
  if (next < 0) next += 1;
  if (next > 1) next -= 1;
  if (next < 1 / 6) return p + (q - p) * 6 * next;
  if (next < 1 / 2) return q;
  if (next < 2 / 3) return p + (q - p) * (2 / 3 - next) * 6;
  return p;
}

function hslToInt(h: number, s: number, l: number): number {
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const r = s === 0 ? l : hueToRgb(p, q, h + 1 / 3);
  const g = s === 0 ? l : hueToRgb(p, q, h);
  const b = s === 0 ? l : hueToRgb(p, q, h - 1 / 3);
  return (Math.round(r * 255) << 16) | (Math.round(g * 255) << 8) | Math.round(b * 255);
}

function boostedBrightestStripeColor(stripes: readonly Stripe[]): number {
  let brightestColor = 0xffffff;
  let brightestLuminance = -1;
  for (const stripe of stripes) {
    const luminance = colorLuminance(stripe.color);
    if (luminance > brightestLuminance) {
      brightestLuminance = luminance;
      brightestColor = stripe.color;
    }
  }
  const hsl = rgbToHsl(brightestColor);
  return hslToInt(hsl.h, hsl.s, Math.min(1, hsl.l + 0.1));
}

function normalizeHexString(value: unknown, fallback: string | null = null): string | null {
  if (typeof value !== "string") return fallback;
  const raw = value.trim().replace(/^#/, "");
  if (!/^[0-9a-fA-F]{6}$/.test(raw)) return fallback;
  return `#${raw.toLowerCase()}`;
}

function mixHexColors(hexes: readonly (string | null | undefined)[]): string | null {
  const colors = hexes.map((hex) => normalizeHexString(hex)).filter((hex): hex is string => hex !== null);
  if (colors.length === 0) return null;
  const rgb = colors.reduce(
    (acc, hex) => {
      const value = hexToInt(hex);
      acc.r += (value >> 16) & 255;
      acc.g += (value >> 8) & 255;
      acc.b += value & 255;
      return acc;
    },
    { r: 0, g: 0, b: 0 },
  );
  const count = colors.length;
  return `#${[rgb.r / count, rgb.g / count, rgb.b / count]
    .map((channel) => Math.round(channel).toString(16).padStart(2, "0"))
    .join("")}`;
}

type ImageColorWidthSource = "bright" | "dark";

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function grayLevelFromColor(color: number): number {
  const r = (color >> 16) & 255;
  const g = (color >> 8) & 255;
  const b = color & 255;
  return clamp01((r + g + b) / (255 * 3));
}

function initialImageColorWidthSource(colors: EngineConfig["colors"]): ImageColorWidthSource {
  if (!colors.autoDetectBackground && colors.mode === "colors" && grayLevelFromColor(colors.backgroundColor) > 0.5)
    return "dark";
  return "bright";
}

function sameStripeSet(a: Stripe[], b: Stripe[]): boolean {
  if (a.length !== b.length) return false;
  return a.every(
    (stripe, index) =>
      stripe.color === b[index].color &&
      Math.abs(stripe.startFrom - b[index].startFrom) < 0.0001 &&
      stripe.width === b[index].width &&
      Math.abs(stripe.opacity - b[index].opacity) < 0.0001,
  );
}

function upgradeDefaultStripes(config: EngineConfig): EngineConfig {
  if (!sameStripeSet(config.stripes, OLD_DEFAULT_STRIPES)) return config;
  return { ...config, stripes: LAB_DEFAULT_STRIPES.map((stripe) => ({ ...stripe })) };
}

let nextStripeId = 0;
function newStripeId(): string {
  return `s${nextStripeId++}`;
}

export interface TextureOption {
  id: string;
  label: string;
}

type BackgroundFillMode = "transparent" | "solid" | "gradient";

export interface EngineControlsResult {
  config: EngineConfig;
  backgroundFillMode: BackgroundFillMode;
  backgroundSourceOpacity: number;
  initialThemed: {
    editTheme: LabEditTheme;
    lightBase: Partial<EngineConfig>;
    darkDiff: DeepPartial<EngineConfig>;
  };
  setControl: (values: Record<string, unknown>) => void;
  getLabSettingsSnapshot: () => Partial<LabSettings>;
  textureId: string;
  setTextureId: (id: string) => void;
  textureOptions: TextureOption[];
  textureStore: ReturnType<typeof useCreateStore>;
  shaderStore: ReturnType<typeof useCreateStore>;
  connectCamera: ConnectCameraState | null;
  shaderView: ShaderViewState | null;
  connectShaderParams: ConnectShaderParams | null;
  connectGradientUnderlay: boolean | null;
  twizzler: { enabled: boolean } & TwizzlerSettings;
  twizzlerMap: TwizzlerMapSettings;
  cometLogo: CometLogoSettings;
  /** Present in client mode when a size preset is selected. */
  clientCanvasSize: { width: number; height: number } | null;
  /** Client Hero → Graphic mode (twizzler / rain / both). */
  clientGraphicMode: ClientGraphicMode | null;
  /** Client rain shader preset id when Graphic includes Rain. */
  clientRainShaderPreset: string | null;
}

function paletteForBackgroundFillMode(mode: BackgroundFillMode): string {
  switch (mode) {
    case "gradient":
      return BACKGROUND_RAMP_PALETTE_NAME;
    case "solid":
      return BACKGROUND_RAMP_PALETTE_NAME;
    case "transparent":
      return "Orange";
  }
}

function applyPaletteForBackgroundFillMode(
  stripes: readonly EditableStripe[],
  mode: BackgroundFillMode,
  backgroundHex: string | null,
  backgroundRampEasing: BackgroundRampEasing,
  backgroundRampSettings: BackgroundRampSettings,
): EditableStripe[] {
  const palette = paletteForBackgroundFillMode(mode);
  return applyStripePalette(stripes, palette, backgroundHex, backgroundRampEasing, backgroundRampSettings);
}

function applyCustomStripePalette(stripes: readonly EditableStripe[], colors: readonly string[]): EditableStripe[] {
  if (colors.length === 0) return [...stripes];
  return stripes.map((stripe, index) => ({
    ...stripe,
    hex: colors[index] ?? colors[colors.length - 1] ?? stripe.hex,
  }));
}

function engineStripeHexes(config: Partial<EngineConfig>): string[] {
  return normalizeEngineConfig(config).stripes.map((stripe) => intToHex(stripe.color));
}

function visibleStripeWidthLevelCount(stripes: readonly { width: number; opacity: number }[]): number {
  const levels = new Set<number>();
  for (const stripe of stripes) {
    if (stripe.opacity <= 0.001 || stripe.width < 0.5) continue;
    levels.add(Math.round(stripe.width * 1000) / 1000);
  }
  return Math.max(1, levels.size);
}

const EDGE_MASK_SIDE_OPTIONS = {
  All: "all",
  Top: "top",
  Bottom: "bottom",
  Left: "left",
  Right: "right",
  Custom: "custom",
} as const;

type EdgeMaskSidePreset = (typeof EDGE_MASK_SIDE_OPTIONS)[keyof typeof EDGE_MASK_SIDE_OPTIONS];

function edgeMaskSidePreset(sides: EdgeMaskSides): EdgeMaskSidePreset {
  const on = (["top", "right", "bottom", "left"] as const).filter((side) => sides[side]);
  if (on.length === 4) return "all";
  if (on.length === 1) return on[0];
  return "custom";
}

function edgeMaskSidesFromPreset(preset: EdgeMaskSidePreset, custom: EdgeMaskSides): EdgeMaskSides {
  if (preset === "custom") return custom;
  if (preset === "all") return { top: true, right: true, bottom: true, left: true };
  return {
    top: preset === "top",
    right: preset === "right",
    bottom: preset === "bottom",
    left: preset === "left",
  };
}

export function useEngineControls(
  onReplay: () => void,
  options: {
    showShaderCamera?: boolean;
    showConnectCamera?: boolean;
    activeShaderConfig?: ShaderConfigKind | null;
    showTwizzlerRibbon?: boolean;
    twizzlerTransport?: TimeTransportController;
    initialConfig?: ThemedEngineConfig;
    initialEditTheme?: LabEditTheme;
    configScope?: "global" | "surface";
    /** Agency / client review: curated Twizzler + presets + rain (Default panel). */
    clientMode?: boolean;
    /**
     * Client Default vs Advanced. Advanced reveals hideInClient folders without
     * rebuilding the Leva schema (so knob values are not wiped on toggle).
     */
    clientPanelMode?: "default" | "advanced";
    /** Notify LabApp when client Hero → Graphic changes (for shader bootstrap). */
    onClientGraphicModeChange?: (mode: ClientGraphicMode) => void;
  } = {},
): EngineControlsResult {
  const surfaceConfig = options.configScope === "surface";
  const clientApp = options.clientMode === true;
  const clientPanelMode = options.clientPanelMode === "advanced" ? "advanced" : "default";
  const clientDefaultPanel = clientApp && clientPanelMode === "default";
  clientDefaultPanelActive = clientDefaultPanel;
  clientAppActive = clientApp;
  const showShaderCamera = options.showShaderCamera === true && !clientDefaultPanel;
  const showConnectCamera = options.showConnectCamera === true;
  const activeShaderConfig = options.activeShaderConfig ?? null;
  const showTwizzlerRibbon = options.showTwizzlerRibbon === true;
  const showShaderToyCamera = showShaderCamera && !showConnectCamera;
  const showShaderCameraRef = useRef(showShaderCamera);
  showShaderCameraRef.current = showShaderCamera;
  const showConnectCameraRef = useRef(showConnectCamera);
  showConnectCameraRef.current = showConnectCamera;
  const activeShaderConfigRef = useRef(activeShaderConfig);
  activeShaderConfigRef.current = activeShaderConfig;
  const showTwizzlerRibbonRef = useRef(showTwizzlerRibbon);
  showTwizzlerRibbonRef.current = showTwizzlerRibbon;
  const clientDefaultPanelRef = useRef(clientDefaultPanel);
  clientDefaultPanelRef.current = clientDefaultPanel;
  const clientAppRef = useRef(clientApp);
  clientAppRef.current = clientApp;
  const showCometLogoShaderConfig = () =>
    activeShaderConfigRef.current === "comet-logo" &&
    (!clientAppRef.current || clientRainAuthoringActive) &&
    (!clientDefaultPanelRef.current || clientRainAuthoringActive);
  const showTwizzlerMapShaderConfig = () =>
    activeShaderConfigRef.current === "twizzler-map" &&
    (!clientAppRef.current || clientRainAuthoringActive) &&
    (!clientDefaultPanelRef.current || clientRainAuthoringActive);
  const showTwizzlerRibbonConfig = () => showTwizzlerRibbonRef.current;
  const showTwizzlerAuthoring = () =>
    showTwizzlerRibbonRef.current &&
    (!clientAppRef.current || clientTwizzlerAuthoringActive) &&
    (!clientDefaultPanelRef.current || clientTwizzlerAuthoringActive);
  const showFullLab = () => !clientDefaultPanelRef.current;
  const showSpiralShaderConfigRef = useRef(activeShaderConfig === "spiral");
  showSpiralShaderConfigRef.current = activeShaderConfig === "spiral" && (!clientApp || clientRainAuthoringActive);
  const showShaderToyCameraRef = useRef(showShaderToyCamera);
  showShaderToyCameraRef.current = showShaderToyCamera;
  const startupPreset = useMemo(() => loadDefaultPreset(), []);
  const initialLabSettings = useMemo(() => {
    const stored = loadLabSettings();
    if (clientApp) {
      // Client boot already applied Banner / saved layout into storage — keep live values.
      // Do not merge loadDefaultPreset().lab (would clobber Speed / Move / etc. on refresh).
      return {
        ...stored,
        canvasMode: "manual" as const,
        canvasAspectLocked: true,
        twizzlerEnabled: stored.twizzlerEnabled ?? true,
        textureSourceMode: "shader" as const,
        shaderPresetId: stored.shaderPresetId || "twizzler-map",
        cometLogo: { ...COMET_LOGO_DEFAULTS },
      };
    }
    return {
      ...stored,
      ...(startupPreset?.lab ?? {}),
      cometLogo: { ...COMET_LOGO_DEFAULTS },
    };
  }, [clientApp, startupPreset]);
  const initialTextureId = useMemo(() => {
    const stored = loadTextureId() ?? initialLabSettings.textureId;
    return stored && findTextureEntry(stored, loadManifest()) ? stored : DEFAULT_LAB_TEXTURE_ID;
  }, [initialLabSettings.textureId]);
  const [providedInitialConfig] = useState(options.initialConfig);
  const [providedInitialEditTheme] = useState(options.initialEditTheme);
  const initialThemed = useMemo(() => {
    const themed = providedInitialConfig ?? startupPreset?.config ?? loadInitialConfig(initialTextureId);
    const editTheme = providedInitialEditTheme ?? loadEditTheme();
    return {
      editTheme,
      lightBase: resolveThemedConfig(themed, "light"),
      darkDiff: (themed.dark ?? {}) as DeepPartial<EngineConfig>,
      effective: resolveThemedConfig(themed, editTheme),
    };
  }, [initialTextureId, providedInitialConfig, providedInitialEditTheme, startupPreset]);
  const d = useMemo(() => {
    const loaded = normalizeEngineConfig(initialThemed.effective);
    const importedPristine = consumeImportedConfigPristine();
    const upgraded = importedPristine ? loaded : upgradeDefaultStripes(loaded);
    const fitUpgraded =
      upgraded.transform.fit === "stretch"
        ? { ...upgraded, transform: { ...upgraded.transform, fit: "width" as const } }
        : upgraded;
    if (importedPristine || !hasAutomaticStripeWidthDistribution(fitUpgraded.stripes)) return fitUpgraded;
    return { ...fitUpgraded, stripes: withDefaultStripeWidths(fitUpgraded.stripes) };
  }, [initialThemed]);
  // Gate client folders from the stored Graphic *before* useControls registers
  // render callbacks (module flags must be correct on first Leva paint).
  {
    const bootGraphic = resolveClientGraphicMode(
      initialLabSettings.twizzlerEnabled ?? true,
      d.sparkle?.gaps?.enabled ?? DEFAULT_CLIENT_PREVIEW_STATE.rainEnabled,
    );
    clientRainAuthoringActive = !clientApp || bootGraphic === "rain" || bootGraphic === "both";
    clientTwizzlerAuthoringActive = !clientApp || bootGraphic === "twizzler" || bootGraphic === "both";
    showSpiralShaderConfigRef.current = activeShaderConfig === "spiral" && (!clientApp || clientRainAuthoringActive);
  }
  // Pin the store across HMR. React Fast Refresh recomputes useMemo (and thus
  // useCreateStore's store) while preserving useState/useRef. leva's useControls
  // captures its store via useState, so it keeps writing to the original store;
  // if LevaPanel received a freshly-recomputed store it would render empty until
  // a full reload. Preserving the first store here keeps both sides in sync.
  const [textureStore] = useState(useCreateStore());
  const [shaderStore] = useState(useCreateStore());
  // Texture selection is a plain React control (rendered as a stacked label +
  // <select> in the sidebar), not a leva folder.
  const [textureId, setTextureId] = useState(initialTextureId);
  const textureOptions = useMemo<TextureOption[]>(
    () => buildTextureEntries(loadManifest()).map((t) => ({ id: t.id, label: t.label })),
    [],
  );
  const initialCustomStripePalettes = useMemo(() => loadCustomStripePalettes(), []);
  const [customStripePalettes, setCustomStripePalettes] = useState<CustomStripePalette[]>(initialCustomStripePalettes);
  const initialCustomStripePalette = findCustomStripePalette(
    initialCustomStripePalettes,
    initialLabSettings.stripePalette,
  );
  const initialCustomStripeColors = surfaceConfig
    ? undefined
    : initialThemed.editTheme === "dark"
      ? initialCustomStripePalette?.dark
      : initialCustomStripePalette?.light;

  const [stripes, setStripes] = useState<EditableStripe[]>(() => {
    const editable = d.stripes.map((s, i) => ({
      id: String(i),
      hex: "#" + s.color.toString(16).padStart(6, "0"),
      startFrom: s.startFrom,
      width: s.width,
      opacity: s.opacity,
    }));
    return initialCustomStripeColors ? applyCustomStripePalette(editable, initialCustomStripeColors) : editable;
  });
  const [autoStripeWidths, setAutoStripeWidths] = useState(
    () =>
      (surfaceConfig ? undefined : initialLabSettings.autoStripeWidths) ??
      hasAutomaticStripeWidthDistribution(d.stripes),
  );
  const [preShuffleStripes, setPreShuffleStripes] = useState<EditableStripe[] | null>(null);
  const [activeGeneratedPalette, setActiveGeneratedPalette] = useState<string | null>(() => {
    if (surfaceConfig) return null;
    const initialPalette = initialLabSettings.stripePalette;
    if (!initialPalette) return null;
    if (
      initialPalette === "Custom" ||
      STRIPE_PALETTE_NAMES.some((palette) => palette === initialPalette) ||
      findCustomStripePalette(initialCustomStripePalettes, initialPalette)
    ) {
      return initialPalette;
    }
    return null;
  });
  const [backgroundRampEasing, setBackgroundRampEasing] = useState<BackgroundRampEasing>(() =>
    !surfaceConfig && isKnownEasing(initialLabSettings.backgroundRampEasing ?? "", BACKGROUND_RAMP_EASING_OPTIONS)
      ? (initialLabSettings.backgroundRampEasing as BackgroundRampEasing)
      : "easeInOutQuad",
  );
  const [backgroundRampSettings, setBackgroundRampSettings] = useState<BackgroundRampSettings>(() =>
    normalizeBackgroundRampSettings(
      surfaceConfig ? DEFAULT_BACKGROUND_RAMP_SETTINGS : initialLabSettings.backgroundRampSettings,
    ),
  );
  const [thresholdDistributionEasing, setThresholdDistributionEasing] = useState<ThresholdDistributionEasing>(() =>
    !surfaceConfig &&
    isKnownEasing(initialLabSettings.thresholdDistributionEasing ?? "", THRESHOLD_DISTRIBUTION_EASING_OPTIONS)
      ? (initialLabSettings.thresholdDistributionEasing as ThresholdDistributionEasing)
      : "linear",
  );
  const initialStickyBackground = useMemo(() => (surfaceConfig ? null : loadStickyBackgroundColor()), [surfaceConfig]);
  const [backgroundHex, setBackgroundHex] = useState<string | null>(() => {
    if (initialStickyBackground !== null) return intToHex(initialStickyBackground);
    // Prefer last user/lab background over engine/Appearance defaults (CF-44).
    if (!surfaceConfig && typeof initialLabSettings.backgroundColor === "number") {
      return intToHex(initialLabSettings.backgroundColor);
    }
    if (d.background.transparent) return null;
    return intToHex(d.background.color);
  });
  /**
   * Schema rebuilds (stripeKey etc.) re-seed Leva from `value:` fields. Keep these
   * refs current so rebuilds do not snap Appearance/Background back to mount defaults
   * and re-apply Appearance stage colors over a user Background Color (CF-44).
   */
  const levaSchemaSeedRef = useRef({
    clientSizeId: (initialLabSettings.clientSizeId ??
      matchClientSizePresetId(initialLabSettings.canvasWidth, initialLabSettings.canvasHeight)) as ClientSizePresetId,
    clientLayoutId: (initialLabSettings.clientLayoutId ??
      DEFAULT_CLIENT_PREVIEW_STATE.layoutId) as ClientLayoutPresetId,
    clientAppearanceId: (initialLabSettings.clientAppearanceId ??
      DEFAULT_CLIENT_PREVIEW_STATE.appearanceId) as ClientAppearanceId,
    clientColorId: (initialLabSettings.clientColorId ?? DEFAULT_CLIENT_PREVIEW_STATE.colorId) as ClientColorPresetId,
    clientHeroGraphic: resolveClientGraphicMode(
      initialLabSettings.twizzlerEnabled,
      d.sparkle?.gaps?.enabled ?? DEFAULT_CLIENT_PREVIEW_STATE.rainEnabled,
    ),
    backgroundHex,
  });
  levaSchemaSeedRef.current.backgroundHex = backgroundHex;

  const stripePaletteOptions = useMemo(
    () =>
      Object.fromEntries([
        ["Custom", "Custom"],
        ...customStripePalettes.map((palette) => [`${palette.name} (Saved)`, customStripePaletteValue(palette.id)]),
        ...STRIPE_PALETTE_NAMES.map((palette) => [palette, palette]),
      ]),
    [customStripePalettes],
  );
  const stripePaletteOptionsKey = JSON.stringify(stripePaletteOptions);
  const stripePaletteValue =
    activeGeneratedPalette ??
    detectStripePalette(stripes, backgroundHex, backgroundRampEasing, backgroundRampSettings) ??
    "Custom";
  const stripeKey = stripeSyncKey(stripes);
  const controlSetterRef = useRef<((next: { backgroundColor?: string | null }) => void) | null>(null);
  const backgroundColorRef = useRef<string | null>(backgroundHex);
  const backgroundRampBaseHexRef = useRef<string | null>(backgroundHex);
  const stripePaletteValueRef = useRef(stripePaletteValue);
  const activeGeneratedPaletteRef = useRef(activeGeneratedPalette);
  const backgroundRampEasingRef = useRef(backgroundRampEasing);
  const backgroundRampSettingsRef = useRef(backgroundRampSettings);
  const backgroundFillModeRef = useRef<BackgroundFillMode | null>(null);
  const lastStickyBackgroundRef = useRef(backgroundHex);
  const shaderControlSetterRef = useRef<((values: Record<string, unknown>) => void) | null>(null);
  const textureControlSetterRef = useRef<((values: Record<string, unknown>) => void) | null>(null);

  stripePaletteValueRef.current = stripePaletteValue;
  activeGeneratedPaletteRef.current = activeGeneratedPalette;
  backgroundRampEasingRef.current = backgroundRampEasing;
  backgroundRampSettingsRef.current = backgroundRampSettings;

  const handlePaletteChange = useCallback(
    (palette: string) => {
      setPreShuffleStripes(null);
      if (palette === "Custom") {
        setActiveGeneratedPalette("Custom");
        return;
      }
      const savedPalette = findCustomStripePalette(customStripePalettes, palette);
      if (savedPalette) {
        setActiveGeneratedPalette(palette);
        setStripes((prev) =>
          applyCustomStripePalette(prev, initialThemed.editTheme === "dark" ? savedPalette.dark : savedPalette.light),
        );
        return;
      }
      setActiveGeneratedPalette(palette);
      setStripes((prev) =>
        applyStripePalette(
          prev,
          palette,
          backgroundRampBaseHexRef.current,
          backgroundRampEasing,
          backgroundRampSettingsRef.current,
        ),
      );
      const mappedBackground = backgroundColorRef.current ? mapPaletteColor(backgroundColorRef.current, palette) : null;
      if (mappedBackground) {
        setBackgroundHex(mappedBackground);
        if (!surfaceConfig) saveStickyBackgroundColor(hexToInt(mappedBackground));
        controlSetterRef.current?.({ backgroundColor: mappedBackground });
      }
    },
    [backgroundRampEasing, customStripePalettes, initialThemed.editTheme, surfaceConfig],
  );

  const handleRampEasingChange = useCallback((easing: string) => {
    if (!isKnownEasing(easing, BACKGROUND_RAMP_EASING_OPTIONS)) return;
    const next = easing as BackgroundRampEasing;
    const palette =
      stripePaletteValueRef.current === WHITE_STRIPE_PALETTE_NAME
        ? WHITE_STRIPE_PALETTE_NAME
        : BACKGROUND_RAMP_PALETTE_NAME;
    setBackgroundRampEasing(next);
    setActiveGeneratedPalette(palette);
    setPreShuffleStripes(null);
    setStripes((prev) =>
      applyStripePalette(prev, palette, backgroundRampBaseHexRef.current, next, backgroundRampSettingsRef.current),
    );
  }, []);

  const handleThresholdEasingChange = useCallback((easing: string) => {
    if (!isKnownEasing(easing, THRESHOLD_DISTRIBUTION_EASING_OPTIONS)) return;
    const next = easing as ThresholdDistributionEasing;
    setThresholdDistributionEasing(next);
    setPreShuffleStripes(null);
    setStripes((prev) => withDefaultStripeThresholdDistribution(prev, next));
  }, []);

  const handleBackgroundColorLiveChange = useCallback(
    (hex: string | null) => {
      const next = normalizeHexString(hex);
      lastStickyBackgroundRef.current = next;
      levaSchemaSeedRef.current.backgroundHex = next;
      setBackgroundHex(next);
      const shouldUpdateBackgroundRamp =
        activeGeneratedPaletteRef.current === BACKGROUND_RAMP_PALETTE_NAME ||
        stripePaletteValueRef.current === BACKGROUND_RAMP_PALETTE_NAME;
      if (shouldUpdateBackgroundRamp) {
        setActiveGeneratedPalette(BACKGROUND_RAMP_PALETTE_NAME);
        setStripes((prev) =>
          applyStripePalette(
            prev,
            BACKGROUND_RAMP_PALETTE_NAME,
            next,
            backgroundRampEasingRef.current,
            backgroundRampSettingsRef.current,
          ),
        );
        return;
      }
      const palette = stripePaletteValueRef.current;
      if (
        palette &&
        palette !== "Custom" &&
        palette !== WHITE_STRIPE_PALETTE_NAME &&
        !findCustomStripePalette(customStripePalettes, palette)
      ) {
        setStripes((prev) =>
          applyStripePalette(prev, palette, next, backgroundRampEasingRef.current, backgroundRampSettingsRef.current),
        );
      }
    },
    [customStripePalettes],
  );

  const handleColorChange = useCallback((id: string, hex: string) => {
    setPreShuffleStripes(null);
    setActiveGeneratedPalette("Custom");
    setStripes((prev) => prev.map((s) => (s.id === id ? { ...s, hex } : s)));
  }, []);

  const handleThresholdChange = useCallback((id: string, value: number) => {
    setPreShuffleStripes(null);
    setStripes((prev) => prev.map((s) => (s.id === id ? { ...s, startFrom: clampStripeThreshold(value) } : s)));
  }, []);

  const handleWidthChange = useCallback((id: string, value: number) => {
    setPreShuffleStripes(null);
    setAutoStripeWidths(false);
    setStripes((prev) => prev.map((s) => (s.id === id ? { ...s, width: value } : s)));
  }, []);

  const handleOpacityChange = useCallback((id: string, value: number) => {
    setPreShuffleStripes(null);
    setActiveGeneratedPalette("Custom");
    setStripes((prev) => prev.map((s) => (s.id === id ? { ...s, opacity: Math.min(1, Math.max(0, value)) } : s)));
  }, []);

  const handleColorReorder = useCallback((orderedIds: string[]) => {
    setPreShuffleStripes(null);
    setActiveGeneratedPalette("Custom");
    setStripes((prev) => {
      const byId = new Map(prev.map((s) => [s.id, s]));
      return orderedIds.map((id) => byId.get(id)!).filter(Boolean);
    });
  }, []);

  const handleAdd = useCallback(() => {
    setPreShuffleStripes(null);
    setActiveGeneratedPalette("Custom");
    setStripes((prev) => {
      const next = [
        ...prev,
        { id: newStripeId(), hex: "#888888", startFrom: 0, width: defaultStripeWidth(prev.length), opacity: 1 },
      ];
      return autoStripeWidths
        ? withDefaultStripeDistribution(next, thresholdDistributionEasing)
        : withDefaultStripeThresholdDistribution(next, thresholdDistributionEasing);
    });
  }, [autoStripeWidths, thresholdDistributionEasing]);

  const handleRemove = useCallback(
    (id: string) => {
      setPreShuffleStripes(null);
      setActiveGeneratedPalette("Custom");
      setStripes((prev) => {
        const next = prev.filter((s) => s.id !== id);
        return autoStripeWidths ? withDefaultStripeWidths(next) : next;
      });
    },
    [autoStripeWidths],
  );

  const handleShufflePalette = useCallback(() => {
    setActiveGeneratedPalette("Custom");
    setPreShuffleStripes(stripes);
    setStripes(shuffleStripePalette(stripes));
  }, [stripes]);

  const handleUndoShuffle = useCallback(() => {
    if (!preShuffleStripes) return;
    setStripes(preShuffleStripes);
    setPreShuffleStripes(null);
  }, [preShuffleStripes]);

  const handleReverseColorOrder = useCallback(() => {
    setPreShuffleStripes(null);
    setActiveGeneratedPalette("Custom");
    setStripes((prev) => reverseStripeColors(prev));
  }, []);

  const handleSavePalette = useCallback(() => {
    const name = window.prompt("Palette name:", `Palette ${customStripePalettes.length + 1}`);
    if (!name?.trim()) return;

    const currentColors = stripes.map((stripe) => stripe.hex);
    const lightConfig = normalizeEngineConfig(initialThemed.lightBase);
    const darkConfig = normalizeEngineConfig(
      resolveThemedConfig(
        Object.keys(initialThemed.darkDiff).length > 0 ? { ...lightConfig, dark: initialThemed.darkDiff } : lightConfig,
        "dark",
      ),
    );
    const darkHasStripeOverride = Array.isArray(initialThemed.darkDiff.stripes);
    const lightColors = initialThemed.editTheme === "light" ? currentColors : engineStripeHexes(lightConfig);
    const darkColors =
      initialThemed.editTheme === "dark"
        ? currentColors
        : darkHasStripeOverride
          ? engineStripeHexes(darkConfig)
          : currentColors;
    const saved = upsertCustomStripePalette(customStripePalettes, {
      name,
      light: lightColors,
      dark: darkColors,
    });
    if (!saved) return;
    saveCustomStripePalettes(saved.palettes);
    setCustomStripePalettes(saved.palettes);
    setActiveGeneratedPalette(customStripePaletteValue(saved.palette.id));
  }, [customStripePalettes, initialThemed, stripes]);

  stripeColorsTableRuntime.stripes = stripes;
  stripeColorsTableRuntime.disabled = false;
  stripeColorsTableRuntime.rampEasingOptions = BACKGROUND_RAMP_EASING_OPTIONS;
  stripeColorsTableRuntime.rampEasingValue = backgroundRampEasing;
  stripeColorsTableRuntime.showRampEasing =
    stripePaletteValue === BACKGROUND_RAMP_PALETTE_NAME || stripePaletteValue === WHITE_STRIPE_PALETTE_NAME;
  stripeColorsTableRuntime.showSavePalette = stripePaletteValue === "Custom";
  stripeColorsTableRuntime.thresholdEasingOptions = THRESHOLD_DISTRIBUTION_EASING_OPTIONS;
  stripeColorsTableRuntime.thresholdEasingValue = thresholdDistributionEasing;
  stripeColorsTableRuntime.canUndoShuffle = preShuffleStripes !== null;
  stripeColorsTableRuntime.handlers = {
    onRampEasingChange: handleRampEasingChange,
    onThresholdEasingChange: handleThresholdEasingChange,
    onShufflePalette: handleShufflePalette,
    onUndoShuffle: handleUndoShuffle,
    onReverseColorOrder: handleReverseColorOrder,
    onSavePalette: handleSavePalette,
    onColorChange: handleColorChange,
    onOpacityChange: handleOpacityChange,
    onThresholdChange: handleThresholdChange,
    onWidthChange: handleWidthChange,
    onColorReorder: handleColorReorder,
    onAdd: handleAdd,
    onRemove: handleRemove,
  };

  const [textureValues, setTextureControl] = useControls(
    () => ({
      Camera: folder(
        {
          connectCameraDistance: {
            value: initialLabSettings.connectCameraDistance,
            min: 0.5,
            max: 60,
            step: 0.5,
            label: "Distance",
            render: () => showConnectCameraRef.current,
          },
          connectCameraRotateX: {
            value: initialLabSettings.connectCameraRotateX,
            min: -89,
            max: 89,
            step: 1,
            label: "Rotate X °",
            render: () => showConnectCameraRef.current,
          },
          connectCameraRotateY: {
            value: initialLabSettings.connectCameraRotateY,
            min: -180,
            max: 180,
            step: 1,
            label: "Rotate Y °",
            render: () => showConnectCameraRef.current,
          },
          connectCameraRotateZ: {
            value: initialLabSettings.connectCameraRotateZ,
            min: -180,
            max: 180,
            step: 1,
            label: "Rotate Z °",
            render: () => showConnectCameraRef.current,
          },
          connectCameraPanX: {
            value: initialLabSettings.connectCameraPanX,
            min: -40,
            max: 40,
            step: 0.25,
            label: "Pan X",
            render: () => showConnectCameraRef.current,
          },
          connectCameraPanY: {
            value: initialLabSettings.connectCameraPanY,
            min: -40,
            max: 40,
            step: 0.25,
            label: "Pan Y",
            render: () => showConnectCameraRef.current,
          },
          connectCameraFov: {
            value: initialLabSettings.connectCameraFov,
            min: 20,
            max: 110,
            step: 1,
            label: "FOV",
            render: () => showConnectCameraRef.current,
          },
          connectGradientUnderlay: {
            value: initialLabSettings.connectGradientUnderlay,
            label: "Gradient underlay",
            render: () => showConnectCameraRef.current,
          },
          shaderViewDistance: {
            value: initialLabSettings.shaderViewDistance,
            min: 0.5,
            max: 120,
            step: 0.5,
            label: "Distance",
            render: () => showShaderToyCameraRef.current,
          },
          shaderViewRotateX: {
            value: initialLabSettings.shaderViewRotateX,
            min: -89,
            max: 89,
            step: 1,
            label: "Rotate X °",
            render: () => showShaderToyCameraRef.current,
          },
          shaderViewRotateY: {
            value: initialLabSettings.shaderViewRotateY,
            min: -180,
            max: 180,
            step: 1,
            label: "Rotate Y °",
            render: () => showShaderToyCameraRef.current,
          },
          shaderViewRotateZ: {
            value: initialLabSettings.shaderViewRotateZ,
            min: -180,
            max: 180,
            step: 1,
            label: "Rotate Z °",
            render: () => showShaderToyCameraRef.current,
          },
          shaderViewPanX: {
            value: initialLabSettings.shaderViewPanX,
            min: -40,
            max: 40,
            step: 0.25,
            label: "Pan X",
            render: () => showShaderToyCameraRef.current,
          },
          shaderViewPanY: {
            value: initialLabSettings.shaderViewPanY,
            min: -40,
            max: 40,
            step: 0.25,
            label: "Pan Y",
            render: () => showShaderToyCameraRef.current,
          },
          shaderViewFov: {
            value: initialLabSettings.shaderViewFov,
            min: 20,
            max: 110,
            step: 1,
            label: "FOV",
            render: () => showShaderToyCameraRef.current,
          },
          "Reset view": button(() => {
            if (showConnectCameraRef.current) {
              textureControlSetterRef.current?.({
                connectCameraDistance: CONNECT_CAMERA_DEFAULTS.distance,
                connectCameraRotateX: CONNECT_CAMERA_DEFAULTS.rotateXDeg,
                connectCameraRotateY: CONNECT_CAMERA_DEFAULTS.rotateYDeg,
                connectCameraRotateZ: CONNECT_CAMERA_DEFAULTS.rotateZDeg,
                connectCameraPanX: CONNECT_CAMERA_DEFAULTS.panX,
                connectCameraPanY: CONNECT_CAMERA_DEFAULTS.panY,
                connectCameraFov: CONNECT_CAMERA_DEFAULTS.fov,
              });
              return;
            }
            textureControlSetterRef.current?.({
              shaderViewDistance: SHADER_VIEW_DEFAULTS.distance,
              shaderViewRotateX: SHADER_VIEW_DEFAULTS.rotateXDeg,
              shaderViewRotateY: SHADER_VIEW_DEFAULTS.rotateYDeg,
              shaderViewRotateZ: SHADER_VIEW_DEFAULTS.rotateZDeg,
              shaderViewPanX: SHADER_VIEW_DEFAULTS.panX,
              shaderViewPanY: SHADER_VIEW_DEFAULTS.panY,
              shaderViewFov: SHADER_VIEW_DEFAULTS.fov,
            });
          }),
        },
        {
          collapsed: !loadControlDrawerOpen("Camera", initialLabSettings.drawerOpen["Camera"] ?? false),
          // Client Rain: show Connect camera even in Default (showShaderCamera is Advanced-only).
          render: () =>
            showConnectCameraRef.current || showShaderToyCameraRef.current
              ? !clientAppRef.current || clientRainAuthoringActive || showFullLab()
              : false,
        },
      ),
      General: drawerFolder(
        "General",
        {
          stripesEnabled: { value: d.stripesEnabled, label: "Stripes enabled" },
          textureDpr: { value: d.fieldScale, min: 0.25, max: 2, step: 0.25, label: "Texture DPR" },
        },
        { hideInClient: true, rainInClient: true },
      ),
      "Texture Tone": drawerFolder(
        "Texture Tone",
        {
          exposure: { value: d.adjustments.exposure, min: -2, max: 2, step: 0.05, label: "Exposure" },
          brightness: { value: d.adjustments.brightness, min: -0.5, max: 0.5, step: 0.01, label: "Brightness" },
          contrast: { value: d.adjustments.contrast, min: 0, max: 2, step: 0.01, label: "Contrast" },
          gamma: { value: d.adjustments.gamma, min: 0.05, max: 5, step: 0.05, label: "Gamma" },
          invert: {
            value: d.adjustments.invert,
            label: "Invert luminance",
            render: (get) => get("Rain.Stripes.colorsMode") !== "colors",
          },
        },
        { hideInClient: true, rainInClient: true },
      ),
      "Texture Levels": drawerFolder(
        "Texture Levels",
        {
          blackPoint: { value: d.adjustments.blackPoint, min: 0, max: 1, step: 0.01, label: "Black point" },
          whitePoint: { value: d.adjustments.whitePoint, min: 0, max: 1, step: 0.01, label: "White point" },
          thresholdBias: {
            value: d.adjustments.thresholdBias,
            min: -0.5,
            max: 0.5,
            step: 0.01,
            label: "Threshold bias",
          },
          posterizeLevels: { value: d.adjustments.posterizeLevels, min: 0, max: 16, step: 1, label: "Posterize" },
          noiseAmount: { value: d.adjustments.noiseAmount, min: 0, max: 0.5, step: 0.01, label: "Noise" },
          blurRadius: { value: d.adjustments.blurRadius, min: 0, max: 4, step: 1, label: "Blur" },
          sharpenAmount: { value: d.adjustments.sharpenAmount, min: 0, max: 4, step: 0.1, label: "Sharpen" },
        },
        { hideInClient: true, rainInClient: true },
      ),
      "Texture Source": drawerFolder(
        "Texture Source",
        {
          backgroundSourceOpacity: {
            value: surfaceConfig ? 0 : Math.round((initialLabSettings.backgroundSourceOpacity ?? 0) * 100),
            min: 0,
            max: 100,
            step: 1,
            label: "Preview opacity",
            render: () => !surfaceConfig,
          },
          fit: {
            value: d.transform.fit,
            options: {
              "Fit width": "width",
              "Fit height": "height",
              Cover: "cover",
              Contain: "contain",
              Stretch: "stretch",
            } as const,
            label: "Fit",
          },
          zoom: { value: d.transform.zoom, min: 0.5, max: 4, step: 0.01, label: "Zoom" },
          panX: { value: d.transform.panX, min: -1, max: 1, step: 0.01, label: "Pan X" },
          panY: { value: d.transform.panY, min: -1, max: 1, step: 0.01, label: "Pan Y" },
        },
        { hideInClient: true, rainInClient: true },
      ),
    }),
    { store: textureStore },
    [],
  );
  textureControlSetterRef.current = setTextureControl as (values: Record<string, unknown>) => void;

  const clientSizeOptions = Object.fromEntries(
    CLIENT_SIZE_PRESETS.map((preset) => [preset.label, preset.id]),
  ) as Record<string, ClientSizePresetId>;
  const clientLayoutOptions = Object.fromEntries(
    CLIENT_LAYOUT_PRESETS.map((preset) => [preset.label, preset.id]),
  ) as Record<string, ClientLayoutPresetId>;
  const clientColorOptions = Object.fromEntries(
    CLIENT_COLOR_PRESETS.map((preset) => [preset.label, preset.id]),
  ) as Record<string, ClientColorPresetId>;
  const clientAppearanceOptions = Object.fromEntries(
    CLIENT_APPEARANCE_PRESETS.map((preset) => [preset.label, preset.id]),
  ) as Record<string, ClientAppearanceId>;
  const clientGraphicOptions = Object.fromEntries(CLIENT_GRAPHIC_MODES.map((mode) => [mode.label, mode.id])) as Record<
    string,
    ClientGraphicMode
  >;
  const rainShaderOptions = Object.fromEntries(SHADER_LIBRARY.map((entry) => [entry.label, entry.id])) as Record<
    string,
    string
  >;

  const [shaderValues, setShaderControl] = useControls(
    () =>
      orderShaderPanel({
        Hero: drawerFolder(
          "Hero",
          {
            heroGraphic: {
              value: levaSchemaSeedRef.current.clientHeroGraphic,
              options: clientGraphicOptions,
              label: "Graphic",
            },
            rainShaderPreset: {
              value: initialLabSettings.shaderPresetId || CONNECT_SHADER_PRESET_ID,
              options: rainShaderOptions,
              label: "Shader",
              render: () => clientAppRef.current && clientRainAuthoringActive,
            },
          },
          { defaultOpen: true, clientOnly: true },
        ),
        Presets: drawerFolder(
          "Presets",
          {
            clientSize: {
              value: levaSchemaSeedRef.current.clientSizeId,
              options: clientSizeOptions,
              label: "Size",
            },
            clientLayout: {
              value: levaSchemaSeedRef.current.clientLayoutId,
              options: clientLayoutOptions,
              label: "Layout",
            },
            clientAppearance: {
              value: levaSchemaSeedRef.current.clientAppearanceId,
              options: clientAppearanceOptions,
              label: "Appearance",
            },
            clientColor: {
              value: levaSchemaSeedRef.current.clientColorId,
              options: clientColorOptions,
              label: "Color",
            },
          },
          { defaultOpen: true, clientOnly: true },
        ),
        Twizzler: drawerFolder(
          "Twizzler",
          {
            General: drawerFolder(
              "Twizzler General",
              {
                twizzlerEnabled: {
                  value: initialLabSettings.twizzlerEnabled,
                  label: "Show",
                  // Client uses Hero → Graphic instead.
                  render: () => showTwizzlerRibbonConfig() && !clientAppRef.current,
                },
                rainEnabled: {
                  value: d.sparkle?.gaps?.enabled ?? DEFAULT_CLIENT_PREVIEW_STATE.rainEnabled,
                  label: "Rain",
                  // Kept in schema for setControl / persistence; UI is Hero → Graphic.
                  render: () => false,
                },
                twizzlerRibbonColorMode: {
                  value: initialLabSettings.twizzler.ribbonColorMode ?? "sharedGradient",
                  label: "Color mode",
                  options: {
                    Solid: "solid",
                    "Shared gradient": "sharedGradient",
                    "Fiber gradient": "fiberGradient",
                    "Baked segments": "baked",
                  },
                },
                twizzlerColor: {
                  ...colorLibraryInputPlugin({
                    value: initialLabSettings.twizzler.colorNear ?? initialLabSettings.twizzler.color,
                    label: "Color",
                  }),
                  // Solid: sole ink swatch. Baked: near/right endpoint (paired with Color left).
                  render: (get) => {
                    if (!showTwizzlerRibbonConfig()) return false;
                    const mode = get("Twizzler.General.twizzlerRibbonColorMode");
                    return mode === "solid" || mode === "baked";
                  },
                },
                twizzlerColorFar: {
                  ...colorLibraryInputPlugin({
                    value: initialLabSettings.twizzler.colorFar,
                    label: "Color left (X)",
                  }),
                  render: (get) =>
                    showTwizzlerRibbonConfig() && get("Twizzler.General.twizzlerRibbonColorMode") === "baked",
                },
                twizzlerGradientStops: {
                  ...gradientStopsPlugin({
                    value: serializeTwizzlerGradientStops(
                      parseTwizzlerGradientStops(
                        initialLabSettings.twizzler.gradientStops,
                        initialLabSettings.twizzler.colorFar,
                        initialLabSettings.twizzler.colorNear ?? initialLabSettings.twizzler.color,
                      ),
                    ),
                    colorFar: initialLabSettings.twizzler.colorFar,
                    colorNear: initialLabSettings.twizzler.colorNear ?? initialLabSettings.twizzler.color,
                  }),
                  render: (get) => {
                    if (!showTwizzlerRibbonConfig()) return false;
                    const mode = get("Twizzler.General.twizzlerRibbonColorMode");
                    return mode === "sharedGradient" || mode === "fiberGradient";
                  },
                },
                twizzlerColorEdge: {
                  ...colorLibraryInputPlugin({
                    value: initialLabSettings.twizzler.colorEdge ?? "#e92e28",
                    label: "Color peaks (Y)",
                  }),
                  render: (get) =>
                    showTwizzlerRibbonConfig() && get("Twizzler.General.twizzlerRibbonColorMode") === "baked",
                },
                ...(options.twizzlerTransport && !clientApp
                  ? {
                      twizzlerTransport: timeTransportPlugin({
                        label: "Time",
                        controller: options.twizzlerTransport,
                      }),
                    }
                  : {}),
                twizzlerOpacity: {
                  value: initialLabSettings.twizzler.opacity,
                  min: 0,
                  max: 1,
                  step: 0.01,
                  label: "Opacity",
                },
                twizzlerScale: {
                  value: initialLabSettings.twizzler.scale,
                  min: 0.05,
                  max: 20,
                  step: 0.05,
                  label: "Zoom",
                },
              },
              { render: showTwizzlerRibbonConfig, defaultOpen: true },
            ),
            Shape: drawerFolder(
              "Twizzler Shape",
              {
                twizzlerCenterY: {
                  value: initialLabSettings.twizzler.centerY,
                  min: -1,
                  max: 2,
                  step: 0.01,
                  label: "Center Y",
                },
                twizzlerPanX: {
                  value: initialLabSettings.twizzler.panX ?? 0,
                  min: -800,
                  max: 800,
                  step: 1,
                  label: "Move X",
                },
                twizzlerPanY: {
                  value: initialLabSettings.twizzler.panY ?? 0,
                  min: -800,
                  max: 800,
                  step: 1,
                  label: "Move Y",
                },
                twizzlerPanZ: {
                  value: initialLabSettings.twizzler.panZ ?? 0,
                  min: -10,
                  max: 10,
                  step: 0.05,
                  label: "Move Z",
                },
                twizzlerAmplitude: {
                  value: initialLabSettings.twizzler.amplitude,
                  min: 0,
                  max: 10,
                  step: 0.05,
                  label: "Amplitude",
                },
                twizzlerRotateXDeg: {
                  value: initialLabSettings.twizzler.rotateXDeg ?? 12,
                  min: -720,
                  max: 720,
                  step: 0.5,
                  label: "Rotate X",
                },
                twizzlerRotateYDeg: {
                  value: initialLabSettings.twizzler.rotateYDeg ?? -18,
                  min: -720,
                  max: 720,
                  step: 0.5,
                  label: "Rotate Y",
                },
                twizzlerRotateZDeg: {
                  value: initialLabSettings.twizzler.rotateZDeg ?? 0,
                  min: -720,
                  max: 720,
                  step: 0.5,
                  label: "Rotate Z",
                },
                twizzlerFov: {
                  value: initialLabSettings.twizzler.fov ?? 1.05,
                  min: 0.05,
                  max: 12,
                  step: 0.02,
                  label: "FOV",
                },
                twizzlerCamDist: {
                  value: initialLabSettings.twizzler.camDist ?? 10.5,
                  min: 0.5,
                  max: 120,
                  step: 0.1,
                  label: "Cam Z",
                },
                twizzlerWrinkles: {
                  value: initialLabSettings.twizzler.wrinkles,
                  min: 0,
                  max: 100,
                  step: 0.25,
                  label: "Wrinkles",
                  render: showTwizzlerAuthoring,
                },
                twizzlerWrinkleStrength: {
                  value: initialLabSettings.twizzler.wrinkleStrength,
                  min: 0,
                  max: 5,
                  step: 0.01,
                  label: "Wrinkle strength",
                  render: showTwizzlerAuthoring,
                },
                twizzlerBendPosition: {
                  value: initialLabSettings.twizzler.bendPosition,
                  min: 0,
                  max: 1,
                  step: 0.01,
                  label: "Bend 1 position",
                  render: showTwizzlerAuthoring,
                },
                twizzlerBendAmount: {
                  value: initialLabSettings.twizzler.bendAmount,
                  min: -10,
                  max: 10,
                  step: 0.01,
                  label: "Bend 1 amount",
                  render: showTwizzlerAuthoring,
                },
                twizzlerBend2Position: {
                  value: initialLabSettings.twizzler.bend2Position,
                  min: 0,
                  max: 1,
                  step: 0.01,
                  label: "Bend 2 position",
                  render: showTwizzlerAuthoring,
                },
                twizzlerBend2Amount: {
                  value: initialLabSettings.twizzler.bend2Amount,
                  min: -10,
                  max: 10,
                  step: 0.01,
                  label: "Bend 2 amount",
                  render: showTwizzlerAuthoring,
                },
                twizzlerBend3Position: {
                  value: initialLabSettings.twizzler.bend3Position,
                  min: 0,
                  max: 1,
                  step: 0.01,
                  label: "Bend 3 position",
                  render: showTwizzlerAuthoring,
                },
                twizzlerBend3Amount: {
                  value: initialLabSettings.twizzler.bend3Amount,
                  min: -10,
                  max: 10,
                  step: 0.01,
                  label: "Bend 3 amount",
                  render: showTwizzlerAuthoring,
                },
                twizzlerDepthPosition: {
                  value: initialLabSettings.twizzler.depthPosition,
                  min: 0,
                  max: 1,
                  step: 0.01,
                  label: "Depth position",
                  render: showTwizzlerAuthoring,
                },
                twizzlerDepthAmount: {
                  value: initialLabSettings.twizzler.depthAmount,
                  min: 0,
                  max: 20,
                  step: 0.01,
                  label: "Depth amount",
                  render: showTwizzlerAuthoring,
                },
                twizzlerDepthWidth: {
                  value: initialLabSettings.twizzler.depthWidth,
                  min: 0.01,
                  max: 5,
                  step: 0.01,
                  label: "Depth width",
                  render: showTwizzlerAuthoring,
                },
                twizzlerDepthSpread: {
                  value: initialLabSettings.twizzler.depthSpread,
                  min: 0,
                  max: 20,
                  step: 0.01,
                  label: "Depth widen",
                  render: showTwizzlerAuthoring,
                },
                twizzlerDepthLift: {
                  value: initialLabSettings.twizzler.depthLift,
                  min: 0,
                  max: 10,
                  step: 0.01,
                  label: "Depth Y lift",
                  render: showTwizzlerAuthoring,
                },
                twizzlerDepthTerrain: {
                  value: initialLabSettings.twizzler.depthTerrain ?? 0,
                  min: 0,
                  max: 5,
                  step: 1,
                  label: "Z terrain (0-2 classic / 3-5 exact sine)",
                  render: showTwizzlerAuthoring,
                },
                twizzlerTwist: {
                  value: initialLabSettings.twizzler.twist,
                  min: 0,
                  max: 40,
                  step: 0.05,
                  label: "Twist (legacy)",
                  render: showTwizzlerAuthoring,
                },
              },
              { render: showTwizzlerRibbonConfig, defaultOpen: true },
            ),
            Gradients: drawerFolder(
              "Twizzler Gradients",
              {
                twizzlerGradientXEnabled: {
                  value: initialLabSettings.twizzler.gradientXEnabled ?? true,
                  label: "X color",
                },
                twizzlerGradientXMix: {
                  value: initialLabSettings.twizzler.gradientXMix ?? 1,
                  min: 0,
                  max: 1,
                  step: 0.02,
                  label: "X mix",
                },
                twizzlerGradientYEnabled: {
                  value: initialLabSettings.twizzler.gradientYEnabled ?? true,
                  label: "Y accents",
                },
                twizzlerGradientYMix: {
                  value: initialLabSettings.twizzler.gradientYMix ?? 0.85,
                  min: 0,
                  max: 1,
                  step: 0.02,
                  label: "Y mix",
                },
                twizzlerGradientZEnabled: {
                  value: initialLabSettings.twizzler.gradientZEnabled ?? true,
                  label: "Z → background",
                },
                twizzlerGradientZStrength: {
                  value: initialLabSettings.twizzler.gradientZStrength ?? 0.75,
                  min: 0,
                  max: 5,
                  step: 0.02,
                  label: "Z fade strength",
                },
                twizzlerGradientZCenter: {
                  value: initialLabSettings.twizzler.gradientZCenter ?? 0,
                  min: -5,
                  max: 5,
                  step: 0.02,
                  label: "Z center",
                  render: showTwizzlerAuthoring,
                },
                twizzlerGradientZWidth: {
                  value: initialLabSettings.twizzler.gradientZWidth ?? 0.95,
                  min: 0.05,
                  max: 10,
                  step: 0.02,
                  label: "Z width",
                  render: showTwizzlerAuthoring,
                },
              },
              // Axis X/Y/Z mixes only drive Baked segments (Color mode).
              // Shared/Fiber use the 2D hotspot field editor (twizzlerGradientStops).
              {
                render: (get) =>
                  showTwizzlerRibbonConfig() && get("Twizzler.General.twizzlerRibbonColorMode") === "baked",
                defaultOpen: true,
              },
            ),
            Stroke: drawerFolder(
              "Twizzler Stroke",
              {
                twizzlerLineWidth: {
                  value: initialLabSettings.twizzler.lineWidth,
                  min: 0.05,
                  max: 40,
                  step: 0.05,
                  label: "Base width",
                },
                twizzlerPerspectiveWidth: {
                  value: initialLabSettings.twizzler.perspectiveWidth ?? 1.8,
                  min: 0,
                  max: 20,
                  step: 0.05,
                  label: "Persp width",
                },
                twizzlerMinLineWidth: {
                  value: initialLabSettings.twizzler.minLineWidth ?? 0.4,
                  min: 0.01,
                  max: 20,
                  step: 0.05,
                  label: "Min width",
                },
                twizzlerMaxLineWidth: {
                  value: initialLabSettings.twizzler.maxLineWidth ?? 3.2,
                  min: 0.05,
                  max: 80,
                  step: 0.1,
                  label: "Max width",
                },
                twizzlerLineCount: {
                  value: initialLabSettings.twizzler.lineCount,
                  min: 1,
                  max: 400,
                  step: 1,
                  label: "Layers",
                },
                twizzlerPointSpacing: {
                  value: initialLabSettings.twizzler.pointSpacing,
                  min: 1,
                  max: 200,
                  step: 1,
                  label: "Point spacing",
                },
                twizzlerStippleSize: {
                  value: initialLabSettings.twizzler.stippleSize ?? 0,
                  min: 0,
                  max: 40,
                  step: 0.1,
                  label: "Stipple size",
                },
                twizzlerStippleGap: {
                  value: initialLabSettings.twizzler.stippleGap ?? 0.8,
                  min: 0,
                  max: 40,
                  step: 0.1,
                  label: "Stipple gap",
                },
              },
              // Stroke width / layers available in Default.
              { render: showTwizzlerRibbonConfig },
            ),
            View: drawerFolder(
              "Twizzler View",
              {
                twizzlerViewDistance: {
                  value: initialLabSettings.twizzler.viewDistance ?? 30,
                  min: 0.1,
                  max: 500,
                  step: 0.5,
                  label: "Distance",
                },
                twizzlerRotateX: {
                  value: initialLabSettings.twizzler.rotateX ?? 0,
                  min: -89,
                  max: 89,
                  step: 1,
                  label: "Rotate X °",
                },
                twizzlerRotateY: {
                  value: initialLabSettings.twizzler.rotateY ?? 0,
                  min: -180,
                  max: 180,
                  step: 1,
                  label: "Rotate Y °",
                },
                twizzlerRotateZ: {
                  value: initialLabSettings.twizzler.rotateZ ?? 0,
                  min: -720,
                  max: 720,
                  step: 1,
                  label: "Rotate Z °",
                },
              },
              // Legacy sine-map View knobs — unused by orange-wave Canvas2D path.
              // Move X/Y/Z live under Shape for Default + orange-wave.
              { render: showTwizzlerAuthoring },
            ),
            Edges: drawerFolder(
              "Twizzler Edges",
              {
                twizzlerLeftHeight: {
                  value: initialLabSettings.twizzler.leftHeight,
                  min: -5,
                  max: 5,
                  step: 0.01,
                  label: "Left height",
                },
                twizzlerRightHeight: {
                  value: initialLabSettings.twizzler.rightHeight,
                  min: -5,
                  max: 5,
                  step: 0.01,
                  label: "Right height",
                },
                twizzlerEdgeFluctuation: {
                  value: initialLabSettings.twizzler.edgeFluctuation,
                  min: 0,
                  max: 5,
                  step: 0.01,
                  label: "Fluctuation",
                },
                twizzlerEdgeSpeed: {
                  value: initialLabSettings.twizzler.edgeSpeed,
                  min: 0,
                  max: 20,
                  step: 0.05,
                  label: "Fluctuation speed",
                },
                twizzlerEdgeTaper: {
                  value: initialLabSettings.twizzler.edgeTaper,
                  min: 0,
                  max: 1,
                  step: 0.01,
                  label: "Edge taper",
                },
              },
              { render: showTwizzlerAuthoring },
            ),
            Noise: drawerFolder(
              "Twizzler Noise",
              {
                twizzlerNoiseScaleX: {
                  value: initialLabSettings.twizzler.noiseScaleX,
                  min: 0.00001,
                  max: 0.5,
                  step: 0.0001,
                  label: "Horizontal scale",
                },
                twizzlerNoiseScaleY: {
                  value: initialLabSettings.twizzler.noiseScaleY,
                  min: 0.0001,
                  max: 1,
                  step: 0.001,
                  label: "Line separation",
                },
              },
              { render: showTwizzlerAuthoring },
            ),
            Motion: drawerFolder(
              "Twizzler Motion",
              {
                twizzlerSpeed: {
                  value: initialLabSettings.twizzler.speed,
                  min: 0,
                  max: 20,
                  step: 0.05,
                  label: "Speed",
                },
                twizzlerDrift: {
                  value: initialLabSettings.twizzler.drift,
                  min: 0,
                  max: 10,
                  step: 0.01,
                  label: "Vertical drift",
                  render: showTwizzlerAuthoring,
                },
              },
              { render: showTwizzlerRibbonConfig, defaultOpen: true },
            ),
            Field: drawerFolder(
              "Twizzler Map Field",
              {
                twizzlerMapBackgroundLevel: {
                  value: initialLabSettings.twizzlerMap.backgroundLevel,
                  min: 0,
                  max: 1,
                  step: 0.01,
                  label: "Background level",
                },
                twizzlerMapRibbonLevel: {
                  value: initialLabSettings.twizzlerMap.ribbonLevel,
                  min: 0,
                  max: 1,
                  step: 0.01,
                  label: "Ribbon level",
                },
                twizzlerMapShoulderLevel: {
                  value: initialLabSettings.twizzlerMap.shoulderLevel,
                  min: 0,
                  max: 1,
                  step: 0.01,
                  label: "Side level",
                },
                twizzlerMapShoulderWidth: {
                  value: initialLabSettings.twizzlerMap.shoulderWidth,
                  min: 0,
                  max: 20,
                  step: 0.25,
                  label: "Side width",
                },
                twizzlerMapTopOffsetPx: {
                  value: initialLabSettings.twizzlerMap.topOffsetPx,
                  min: 0,
                  max: 400,
                  step: 1,
                  label: "Top offset",
                },
                twizzlerMapBottomOffsetPx: {
                  value: initialLabSettings.twizzlerMap.bottomOffsetPx,
                  min: 0,
                  max: 400,
                  step: 1,
                  label: "Bottom offset",
                },
                twizzlerMapTopSpread: {
                  value: initialLabSettings.twizzlerMap.topSpread,
                  min: 0,
                  max: 4,
                  step: 0.05,
                  label: "Top spread",
                },
                twizzlerMapBottomSpread: {
                  value: initialLabSettings.twizzlerMap.bottomSpread,
                  min: 0,
                  max: 4,
                  step: 0.05,
                  label: "Bottom spread",
                },
              },
              { render: showTwizzlerMapShaderConfig },
            ),
            Animation: drawerFolder(
              "Twizzler Map Animation",
              {
                twizzlerMapFlowEnabled: { value: initialLabSettings.twizzlerMap.flowEnabled, label: "Animate" },
                twizzlerMapFlowDirection: {
                  value: initialLabSettings.twizzlerMap.flowDirection,
                  options: {
                    "Top → bottom": "topToBottom",
                    "Bottom → top": "bottomToTop",
                    "Left → right": "leftToRight",
                    "Right → left": "rightToLeft",
                    "Top left → bottom right": "topLeftToBottomRight",
                    "Top right → bottom left": "topRightToBottomLeft",
                    "Bottom left → top right": "bottomLeftToTopRight",
                    "Bottom right → top left": "bottomRightToTopLeft",
                  } as const,
                  label: "Direction",
                },
                twizzlerMapFlowAmplitude: {
                  value: initialLabSettings.twizzlerMap.flowAmplitude,
                  min: -1,
                  max: 1,
                  step: 0.01,
                  label: "Amplitude",
                },
                twizzlerMapFlowSpeed: {
                  value: initialLabSettings.twizzlerMap.flowSpeed,
                  min: -3,
                  max: 3,
                  step: 0.05,
                  label: "Speed",
                },
                twizzlerMapFlowSpacing: {
                  value: initialLabSettings.twizzlerMap.flowSpacing,
                  min: 0.02,
                  max: 0.75,
                  step: 0.005,
                  label: "Spacing",
                },
                twizzlerMapFlowBandWidth: {
                  value: initialLabSettings.twizzlerMap.flowBandWidth,
                  min: 0.002,
                  max: 0.3,
                  step: 0.002,
                  label: "Band width",
                },
                twizzlerMapFlowSoftness: {
                  value: initialLabSettings.twizzlerMap.flowSoftness,
                  min: 0,
                  max: 1,
                  step: 0.01,
                  label: "Softness",
                },
                twizzlerMapFlowOpacity: {
                  value: initialLabSettings.twizzlerMap.flowOpacity,
                  min: 0,
                  max: 1,
                  step: 0.01,
                  label: "Opacity",
                },
                twizzlerMapFlowPhase: {
                  value: initialLabSettings.twizzlerMap.flowPhase,
                  min: 0,
                  max: 1,
                  step: 0.01,
                  label: "Phase",
                },
              },
              { render: showTwizzlerMapShaderConfig },
            ),
          },
          {
            defaultOpen: false,
            twizzlerInClient: true,
            render: () => showTwizzlerRibbonRef.current && (!clientAppRef.current || clientTwizzlerAuthoringActive),
          },
        ),
        Rain: drawerFolder(
          "Rain",
          {
            "Shader config": drawerFolder(
              "Shader config",
              {
                ...buildConnectShaderLevaFolders(
                  normalizeConnectShaderParams(initialLabSettings.connectShaderParams),
                  showSpiralShaderConfigRef,
                ),
                "Field & logo": drawerFolder(
                  "Comet Logo Field & logo",
                  {
                    cometLogoFieldSpeed: {
                      value: initialLabSettings.cometLogo.fieldSpeed,
                      min: 0,
                      max: 4,
                      step: 0.01,
                      label: "Field speed",
                    },
                    cometLogoFieldDepth: {
                      value: initialLabSettings.cometLogo.fieldDepth,
                      min: 2,
                      max: 12,
                      step: 0.01,
                      label: "Field depth",
                    },
                    cometLogoFieldSpread: {
                      value: initialLabSettings.cometLogo.fieldSpread,
                      min: 0.5,
                      max: 5,
                      step: 0.01,
                      label: "Field spread",
                    },
                    cometLogoCenterClearRadius: {
                      value: initialLabSettings.cometLogo.centerClearRadius,
                      min: 0,
                      max: 400,
                      step: 1,
                      label: "Center clearance",
                    },
                    cometLogoFieldTrailLength: {
                      value: initialLabSettings.cometLogo.fieldTrailLength,
                      min: 0,
                      max: 3,
                      step: 0.01,
                      label: "Field trails",
                    },
                    cometLogoFieldParticleSize: {
                      value: initialLabSettings.cometLogo.fieldParticleSize,
                      min: 0.25,
                      max: 3,
                      step: 0.01,
                      label: "Field particle size",
                    },
                    cometLogoLogoScale: {
                      value: initialLabSettings.cometLogo.logoScale,
                      min: 0.35,
                      max: 1.5,
                      step: 0.01,
                      label: "Logo scale",
                    },
                    cometLogoLogoParticleSize: {
                      value: initialLabSettings.cometLogo.logoParticleSize,
                      min: 0.25,
                      max: 3,
                      step: 0.01,
                      label: "Logo particle size",
                    },
                    cometLogoLogoTrailLength: {
                      value: initialLabSettings.cometLogo.logoTrailLength,
                      min: 0,
                      max: 3,
                      step: 0.01,
                      label: "Logo trails",
                    },
                    cometLogoLogoMotion: {
                      value: initialLabSettings.cometLogo.logoMotion,
                      min: 0,
                      max: 3,
                      step: 0.01,
                      label: "Logo motion",
                    },
                  },
                  { render: showCometLogoShaderConfig },
                ),
                Formation: drawerFolder(
                  "Comet Logo Formation",
                  {
                    cometLogoFormationDuration: {
                      value: initialLabSettings.cometLogo.formationDuration,
                      min: 0.2,
                      max: 6,
                      step: 0.05,
                      label: "Form duration",
                    },
                    cometLogoRejoinDuration: {
                      value: initialLabSettings.cometLogo.rejoinDuration,
                      min: 0.2,
                      max: 6,
                      step: 0.05,
                      label: "Release duration",
                    },
                    cometLogoFormationStagger: {
                      value: initialLabSettings.cometLogo.formationStagger,
                      min: 0,
                      max: 0.9,
                      step: 0.01,
                      label: "Stagger",
                    },
                    cometLogoCenterPreference: {
                      value: initialLabSettings.cometLogo.centerPreference,
                      min: 0,
                      max: 1,
                      step: 0.01,
                      label: "Center preference",
                    },
                  },
                  { render: showCometLogoShaderConfig },
                ),
                Sparks: drawerFolder(
                  "Comet Logo Sparks",
                  {
                    cometLogoSparkFrequency: {
                      value: initialLabSettings.cometLogo.sparkFrequency,
                      min: 0.1,
                      max: 4,
                      step: 0.05,
                      label: "Frequency",
                    },
                    cometLogoSparkSize: {
                      value: initialLabSettings.cometLogo.sparkSize,
                      min: 0.2,
                      max: 3,
                      step: 0.01,
                      label: "Size",
                    },
                    cometLogoSparkBrightness: {
                      value: initialLabSettings.cometLogo.sparkBrightness,
                      min: 0,
                      max: 3,
                      step: 0.01,
                      label: "Brightness",
                    },
                    cometLogoSparkTrailLength: {
                      value: initialLabSettings.cometLogo.sparkTrailLength,
                      min: 0,
                      max: 3,
                      step: 0.01,
                      label: "Trail length",
                    },
                    cometLogoBurstProbability: {
                      value: initialLabSettings.cometLogo.burstProbability,
                      min: 0,
                      max: 1,
                      step: 0.01,
                      label: "Burst chance",
                    },
                    cometLogoWaveProbability: {
                      value: initialLabSettings.cometLogo.waveProbability,
                      min: 0,
                      max: 1,
                      step: 0.01,
                      label: "Wave chance",
                    },
                    cometLogoSurfaceEffects: {
                      value: initialLabSettings.cometLogo.surfaceEffects,
                      min: 0,
                      max: 3,
                      step: 0.01,
                      label: "Surface flashes",
                    },
                  },
                  { render: showCometLogoShaderConfig },
                ),
                "Solar fire": drawerFolder(
                  "Comet Logo Solar fire",
                  {
                    cometLogoFireScale: {
                      value: initialLabSettings.cometLogo.fireScale,
                      min: 0.25,
                      max: 3,
                      step: 0.01,
                      label: "Scale",
                    },
                    cometLogoFireIntensity: {
                      value: initialLabSettings.cometLogo.fireIntensity,
                      min: 0,
                      max: 3,
                      step: 0.01,
                      label: "Intensity",
                    },
                    cometLogoFireSpeed: {
                      value: initialLabSettings.cometLogo.fireSpeed,
                      min: 0,
                      max: 3,
                      step: 0.01,
                      label: "Flow speed",
                    },
                    cometLogoFireTurbulence: {
                      value: initialLabSettings.cometLogo.fireTurbulence,
                      min: 0,
                      max: 3,
                      step: 0.01,
                      label: "Turbulence",
                    },
                    cometLogoFlameHeight: {
                      value: initialLabSettings.cometLogo.flameHeight,
                      min: 0.2,
                      max: 3,
                      step: 0.01,
                      label: "Flame height",
                    },
                    cometLogoWeatherSpeed: {
                      value: initialLabSettings.cometLogo.weatherSpeed,
                      min: 0,
                      max: 3,
                      step: 0.01,
                      label: "Weather speed",
                    },
                    cometLogoWeatherVariation: {
                      value: initialLabSettings.cometLogo.weatherVariation,
                      min: 0,
                      max: 2,
                      step: 0.01,
                      label: "Weather variation",
                    },
                    cometLogoCoronaMist: {
                      value: initialLabSettings.cometLogo.coronaMist,
                      min: 0,
                      max: 3,
                      step: 0.01,
                      label: "Corona mist",
                    },
                    cometLogoCurlingWisps: {
                      value: initialLabSettings.cometLogo.curlingWisps,
                      min: 0,
                      max: 3,
                      step: 0.01,
                      label: "Curling wisps",
                    },
                    cometLogoHotRim: {
                      value: initialLabSettings.cometLogo.hotRim,
                      min: 0,
                      max: 3,
                      step: 0.01,
                      label: "Hot rim",
                    },
                  },
                  { render: showCometLogoShaderConfig },
                ),
                Eruptions: drawerFolder(
                  "Comet Logo Eruptions",
                  {
                    cometLogoEruptionFrequency: {
                      value: initialLabSettings.cometLogo.eruptionFrequency,
                      min: 0,
                      max: 1,
                      step: 0.01,
                      label: "Chance",
                    },
                    cometLogoEruptionScale: {
                      value: initialLabSettings.cometLogo.eruptionScale,
                      min: 0.2,
                      max: 3,
                      step: 0.01,
                      label: "Scale",
                    },
                    cometLogoEruptionIntensity: {
                      value: initialLabSettings.cometLogo.eruptionIntensity,
                      min: 0,
                      max: 3,
                      step: 0.01,
                      label: "Intensity",
                    },
                    cometLogoEruptionParticles: {
                      value: initialLabSettings.cometLogo.eruptionParticles,
                      min: 0,
                      max: 3,
                      step: 0.01,
                      label: "Embers",
                    },
                    cometLogoEruptionCycleSpeed: {
                      value: initialLabSettings.cometLogo.eruptionCycleSpeed,
                      min: 0.1,
                      max: 4,
                      step: 0.05,
                      label: "Cycle speed",
                    },
                  },
                  { render: showCometLogoShaderConfig },
                ),
              },
              {
                defaultOpen: true,
                hideInClient: true,
                rainInClient: true,
                render: () =>
                  activeShaderConfigRef.current !== null || (clientAppRef.current && clientRainAuthoringActive),
              },
            ),
            Stripes: drawerFolder(
              "Stripes",
              {
                colorsMode: {
                  value: d.colors.mode === "colors" ? "colors" : "luminance",
                  options: { Luminance: "luminance", "Image colors": "colors" } as const,
                  label: "Color mode",
                },
                stripeBlendMode: {
                  value: d.colors.stripeBlendMode,
                  options: {
                    Normal: "normal",
                    Multiply: "multiply",
                    Screen: "screen",
                    Overlay: "overlay",
                    Darken: "darken",
                    Lighten: "lighten",
                    Difference: "difference",
                    Exclusion: "exclusion",
                  } as const,
                  label: "Blend mode",
                },
                stripePalette: {
                  value: stripePaletteValue,
                  options: stripePaletteOptions,
                  label: "Palette",
                  onChange: (value: string, _path: string, context: { initial: boolean }) => {
                    if (!context.initial) handlePaletteChange(value);
                  },
                  render: (get) => get("Rain.Stripes.colorsMode") !== "colors",
                },
                stripeColorsTable: stripeColorsTablePlugin({
                  value: stripeKey,
                }),
                "Detailed settings": folder(
                  {
                    backgroundRampBrightnessAdd: {
                      value: backgroundRampSettings.brightnessAdd,
                      min: 0,
                      max: 100,
                      step: 1,
                      label: "+ Brightness",
                    },
                    backgroundRampHueDriftDeg: {
                      value: backgroundRampSettings.hueDriftDeg,
                      min: -180,
                      max: 180,
                      step: 0.5,
                      label: "Hue drift",
                    },
                    backgroundRampSaturationBoost: {
                      value: backgroundRampSettings.saturationBoost,
                      min: 0,
                      max: 100,
                      step: 1,
                      label: "Saturation boost",
                    },
                  },
                  {
                    collapsed: !loadControlDrawerOpen(
                      "Detailed settings",
                      loadLabSettings().drawerOpen["Detailed settings"] ?? false,
                    ),
                    render: (get) =>
                      get("Rain.Stripes.colorsMode") !== "colors" &&
                      stripePaletteValue === BACKGROUND_RAMP_PALETTE_NAME,
                  },
                ),
                "Stripe Dots": folder(
                  {
                    stripeDotsEnabled: {
                      value: d.stripeDots.enabled,
                      label: "Enabled",
                    },
                    stripeDotsDensity: {
                      value: d.stripeDots.density * 100,
                      min: 0,
                      max: 100,
                      step: 1,
                      label: "Density",
                      render: (get) => get("Rain.Stripes.Stripe Dots.stripeDotsEnabled") === true,
                    },
                    stripeDotsRandomVisibility: {
                      value: d.stripeDots.randomVisibility * 100,
                      min: 0,
                      max: 100,
                      step: 1,
                      label: "Random visibility",
                      render: (get) => get("Rain.Stripes.Stripe Dots.stripeDotsEnabled") === true,
                    },
                    stripeDotsSizePx: {
                      value: d.stripeDots.sizePx,
                      min: 1,
                      max: 2,
                      step: 0.5,
                      label: "Size",
                      render: (get) => get("Rain.Stripes.Stripe Dots.stripeDotsEnabled") === true,
                    },
                    stripeDotsBrightness: {
                      value: d.stripeDots.brightness * 100,
                      min: 0,
                      max: 100,
                      step: 1,
                      label: "+ Brightness",
                      render: (get) => get("Rain.Stripes.Stripe Dots.stripeDotsEnabled") === true,
                    },
                    stripeDotsHueDriftDeg: {
                      value: d.stripeDots.hueDriftDeg,
                      min: -180,
                      max: 180,
                      step: 0.5,
                      label: "Hue drift",
                      render: (get) => get("Rain.Stripes.Stripe Dots.stripeDotsEnabled") === true,
                    },
                    stripeDotsSaturationBoost: {
                      value: d.stripeDots.saturationBoost * 100,
                      min: 0,
                      max: 100,
                      step: 1,
                      label: "Saturation boost",
                      render: (get) => get("Rain.Stripes.Stripe Dots.stripeDotsEnabled") === true,
                    },
                  },
                  {
                    collapsed: !loadControlDrawerOpen(
                      "Stripe Dots",
                      loadLabSettings().drawerOpen["Stripe Dots"] ?? false,
                    ),
                  },
                ),
                "Stripe Border": folder(
                  {
                    stripeBorderEnabled: {
                      value: d.stripeBorder.enabled,
                      label: "Enabled",
                    },
                    stripeBorderMinWidthPx: {
                      value: d.stripeBorder.minWidthPx,
                      min: 2,
                      max: 64,
                      step: 0.5,
                      label: "Min stripe width",
                      render: (get) => get("Rain.Stripes.Stripe Border.stripeBorderEnabled") === true,
                    },
                    stripeBorderDensity: {
                      value: d.stripeBorder.density * 100,
                      min: 0,
                      max: 100,
                      step: 1,
                      label: "Density",
                      render: (get) => get("Rain.Stripes.Stripe Border.stripeBorderEnabled") === true,
                    },
                  },
                  {
                    collapsed: !loadControlDrawerOpen(
                      "Stripe Border",
                      loadLabSettings().drawerOpen["Stripe Border"] ?? false,
                    ),
                  },
                ),
                imageColorWidthSource: {
                  value: initialImageColorWidthSource(d.colors),
                  options: { "Highest luminance": "bright", "Lowest luminance": "dark" } as const,
                  label: "Thickest",
                  render: (get) => get("Rain.Stripes.colorsMode") === "colors",
                },
                imageColorRemoveThin: {
                  value: d.colors.imageColorRemoveThin ?? 0,
                  min: 0,
                  max: 0.95,
                  step: 0.01,
                  label: "Remove thin",
                  render: (get) => get("Rain.Stripes.colorsMode") === "colors",
                },
                imageColorBoostThick: {
                  value: d.colors.imageColorBoostThick ?? 0,
                  min: 0,
                  max: 2,
                  step: 0.01,
                  label: "Boost thick",
                  render: (get) => get("Rain.Stripes.colorsMode") === "colors",
                },
                imageColorLightness: {
                  value: (d.colors.imageColorLightness ?? 0) * 100,
                  min: -100,
                  max: 100,
                  step: 1,
                  label: "Extra lightness",
                  render: (get) => get("Rain.Stripes.colorsMode") === "colors",
                },
                imageColorDensity: {
                  value: (d.colors.imageColorDensity ?? 1) * 100,
                  min: 0,
                  max: 100,
                  step: 1,
                  label: "Random density",
                  render: (get) => get("Rain.Stripes.colorsMode") === "colors",
                },
              },
              { hideInClient: true, rainInClient: true },
            ),
            Grid: drawerFolder(
              "Grid",
              {
                cellWidth: { value: d.grid.cellWidth, min: 1, max: 24, step: 1, label: "Cell width" },
                cellHeight: { value: d.grid.cellHeight, min: 1, max: 24, step: 1, label: "Cell height" },
                gapX: { value: d.grid.gapX, min: 0, max: 24, step: 0.5, label: "Gap X" },
                gapY: { value: d.grid.gapY, min: 0, max: 24, step: 0.5, label: "Gap Y" },
                cornerRadius: { value: d.grid.cornerRadius, min: 0, max: 24, step: 0.5, label: "Corner radius" },
                "Grid Lines": folder({
                  gridLinesEnabled: {
                    value: d.gridLines.enabled,
                    label: "Enabled",
                  },
                  gridLinesBrightness: {
                    value: d.gridLines.brightness * 100,
                    min: 0,
                    max: 100,
                    step: 1,
                    label: "+ Brightness",
                    render: (get) => get("Rain.Grid.Grid Lines.gridLinesEnabled") === true,
                  },
                  gridLinesDensity: {
                    value: d.gridLines.density * 100,
                    min: 0,
                    max: 100,
                    step: 1,
                    label: "Random density",
                    render: (get) => get("Rain.Grid.Grid Lines.gridLinesEnabled") === true,
                  },
                }),
                orientationStackMode: {
                  value: d.grid.orientation,
                  options: { Columns: "vertical", Rows: "horizontal" } as const,
                  label: "Rotate stacks",
                },
                orientationAngleDeg: { value: d.grid.angleDeg, min: -180, max: 180, step: 1, label: "Orientation °" },
                orientationRotationMode: {
                  value: d.grid.rotationMode === "overlap" ? "overlap" : "cell",
                  options: { Cell: "cell", Overlap: "overlap" } as const,
                  label: "Rotation mode",
                },
                orientationOverlapAmount: {
                  value: d.grid.overlapAmount,
                  min: 0,
                  max: 4,
                  step: 0.05,
                  label: "Overlap amount",
                  render: (get) => get("Rain.Grid.orientationRotationMode") === "overlap",
                },
                streamGapWaveEnabled: { value: d.grid.streamGapWave.enabled, label: "Gap wave" },
                streamGapWaveSqueeze: {
                  value: d.grid.streamGapWave.squeeze,
                  min: 0,
                  max: 1,
                  step: 0.01,
                  label: "Gap squeeze",
                  render: (get) => get("Rain.Grid.streamGapWaveEnabled"),
                },
                streamGapWaveWavelengthCells: {
                  value: d.grid.streamGapWave.wavelengthCells,
                  min: 2,
                  max: 32,
                  step: 1,
                  label: "Wave length",
                  render: (get) => get("Rain.Grid.streamGapWaveEnabled"),
                },
                streamGapWaveSpeed: {
                  value: d.grid.streamGapWave.speed,
                  min: -4,
                  max: 4,
                  step: 0.01,
                  label: "Wave speed",
                  render: (get) => get("Rain.Grid.streamGapWaveEnabled"),
                },
                streamGapWavePhaseDeg: {
                  value: d.grid.streamGapWave.phaseDeg,
                  min: -180,
                  max: 180,
                  step: 1,
                  label: "Wave phase °",
                  render: (get) => get("Rain.Grid.streamGapWaveEnabled"),
                },
                orientationShortcuts: buttonGroup({
                  label: "Shortcuts",
                  opts: {
                    "0°": () => shaderControlSetterRef.current?.({ orientationAngleDeg: 0 }),
                    "45°": () => shaderControlSetterRef.current?.({ orientationAngleDeg: 45 }),
                    "90°": () => shaderControlSetterRef.current?.({ orientationAngleDeg: 90 }),
                    "135°": () => shaderControlSetterRef.current?.({ orientationAngleDeg: 135 }),
                    "180°": () => shaderControlSetterRef.current?.({ orientationAngleDeg: 180 }),
                  },
                }),
              },
              { hideInClient: true, rainInClient: true },
            ),
            Frames: drawerFolder(
              "Frames",
              {
                framesEnabled: {
                  value: d.frames.enabled,
                  label: "Enabled",
                },
                framesLuminanceThreshold: {
                  value: d.frames.luminanceThreshold * 100,
                  min: 0,
                  max: 100,
                  step: 1,
                  label: "Min luminance",
                  render: (get) => get("Rain.Frames.framesEnabled") === true,
                },
                framesHighlightedStripeCount: {
                  value: d.frames.highlightedStripeCount,
                  min: 1,
                  max: 16,
                  step: 1,
                  label: "Highlighted stripes",
                  render: (get) => get("Rain.Frames.framesEnabled") === true,
                },
                framesGroupDistanceCells: {
                  value: d.frames.groupDistanceCells,
                  min: 0,
                  max: 8,
                  step: 1,
                  label: "Group distance",
                  render: (get) => get("Rain.Frames.framesEnabled") === true,
                },
                framesColor: {
                  ...colorLibraryInputPlugin({
                    value: intToHex(d.frames.color),
                    label: "Frame color",
                  }),
                  render: (get) => get("Rain.Frames.framesEnabled") === true,
                },
                framesFontSizePx: {
                  value: d.frames.fontSizePx,
                  min: 6,
                  max: 48,
                  step: 1,
                  label: "Font size",
                  render: (get) => get("Rain.Frames.framesEnabled") === true,
                },
                framesCoordinateColor: {
                  ...colorLibraryInputPlugin({
                    value: intToHex(d.frames.coordinateColor),
                    label: "Coordinate color",
                  }),
                  render: (get) => get("Rain.Frames.framesEnabled") === true,
                },
              },
              { hideInClient: true, rainInClient: true },
            ),
            Background: drawerFolder(
              "Background",
              {
                backgroundFillMode: {
                  value: (() => {
                    const fromSettings =
                      !surfaceConfig &&
                      (initialLabSettings.backgroundFillMode === "transparent" ||
                        initialLabSettings.backgroundFillMode === "gradient" ||
                        initialLabSettings.backgroundFillMode === "solid")
                        ? initialLabSettings.backgroundFillMode
                        : d.background.transparent
                          ? "transparent"
                          : d.background.gradient.enabled
                            ? "gradient"
                            : "solid";
                    return fromSettings;
                  })(),
                  // Always register Gradient so Default↔Advanced does not rebuild schema / wipe values.
                  options: {
                    Transparent: "transparent",
                    Solid: "solid",
                    Gradient: "gradient",
                  } as const,
                  label: "Fill",
                },
                backgroundColor: {
                  ...colorLibraryInputPlugin({
                    value: levaSchemaSeedRef.current.backgroundHex,
                    label: "Color",
                    persist: surfaceConfig ? undefined : "backgroundColor",
                    onLiveChange: handleBackgroundColorLiveChange,
                  }),
                  render: (get) => get("Rain.Background.backgroundFillMode") === "solid",
                },
                backgroundGradientDirection: {
                  value: d.background.gradient.direction,
                  options: {
                    "Top to bottom": "topToBottom",
                    "Left to right": "leftToRight",
                    "Right to left": "rightToLeft",
                    "Bottom to top": "bottomToTop",
                  } as const,
                  label: "Gradient direction",
                  render: (get) => get("Rain.Background.backgroundFillMode") === "gradient",
                },
                backgroundGradientStopCount: {
                  value: d.background.gradient.stopCount,
                  min: 2,
                  max: 4,
                  step: 1,
                  label: "Gradient stops",
                  render: (get) => get("Rain.Background.backgroundFillMode") === "gradient",
                },
                backgroundGradientStop0: {
                  ...colorLibraryInputPlugin({ value: intToHex(d.background.gradient.stops[0]), label: "Stop 1" }),
                  label: "Stop 1",
                  render: (get) => get("Rain.Background.backgroundFillMode") === "gradient",
                },
                backgroundGradientStop1: {
                  ...colorLibraryInputPlugin({ value: intToHex(d.background.gradient.stops[1]), label: "Stop 2" }),
                  label: "Stop 2",
                  render: (get) => get("Rain.Background.backgroundFillMode") === "gradient",
                },
                backgroundGradientStop2: {
                  ...colorLibraryInputPlugin({ value: intToHex(d.background.gradient.stops[2]), label: "Stop 3" }),
                  label: "Stop 3",
                  render: (get) =>
                    get("Rain.Background.backgroundFillMode") === "gradient" &&
                    Number(get("Rain.Background.backgroundGradientStopCount")) >= 3,
                },
                backgroundGradientStop3: {
                  ...colorLibraryInputPlugin({ value: intToHex(d.background.gradient.stops[3]), label: "Stop 4" }),
                  label: "Stop 4",
                  render: (get) =>
                    get("Rain.Background.backgroundFillMode") === "gradient" &&
                    Number(get("Rain.Background.backgroundGradientStopCount")) >= 4,
                },
              },
              {
                // Client Default: Fill + Color / Gradient direction + stops.
                defaultOpen: true,
              },
            ),
            "Background Stars": drawerFolder(
              "Background Stars",
              {
                backgroundStarsEnabled: { value: d.background.stars.enabled, label: "Enabled" },
                backgroundStarsDensity: {
                  value: d.background.stars.density,
                  min: 0,
                  max: 100,
                  step: 1,
                  label: "Sparkle %",
                  render: (get) => !!get("Rain.Background Stars.backgroundStarsEnabled"),
                },
                backgroundStarsSizePx: {
                  value: d.background.stars.sizePx,
                  min: 0.25,
                  max: 64,
                  step: 0.25,
                  label: "Star size",
                  render: (get) => !!get("Rain.Background Stars.backgroundStarsEnabled"),
                },
                backgroundStarsSizeRandomness: {
                  value: d.background.stars.sizeRandomness,
                  min: 0,
                  max: 1,
                  step: 0.01,
                  label: "Random size",
                  render: (get) => !!get("Rain.Background Stars.backgroundStarsEnabled"),
                },
                backgroundStarsTiltAngleDeg: {
                  value: d.background.stars.tiltAngleDeg,
                  min: -89,
                  max: 89,
                  step: 1,
                  label: "Tilt angle",
                  render: (get) => !!get("Rain.Background Stars.backgroundStarsEnabled"),
                },
                backgroundStarsTwinkleSpeed: {
                  value: d.background.stars.twinkleSpeed,
                  min: 0,
                  max: 10,
                  step: 0.05,
                  label: "Twinkle speed",
                  render: (get) => !!get("Rain.Background Stars.backgroundStarsEnabled"),
                },
                backgroundStarsTwinkleAmount: {
                  value: d.background.stars.twinkleAmount,
                  min: 0,
                  max: 1,
                  step: 0.01,
                  label: "Twinkle amount",
                  render: (get) => !!get("Rain.Background Stars.backgroundStarsEnabled"),
                },
                backgroundStarsOpacity: {
                  value: d.background.stars.opacity,
                  min: 0,
                  max: 1,
                  step: 0.01,
                  label: "Star opacity",
                  render: (get) => !!get("Rain.Background Stars.backgroundStarsEnabled"),
                },
                backgroundStarsColor: {
                  ...colorLibraryInputPlugin({ value: intToHex(d.background.stars.color), label: "Star color" }),
                  label: "Star color",
                  render: (get) => !!get("Rain.Background Stars.backgroundStarsEnabled"),
                },
              },
              { hideInClient: true, rainInClient: true },
            ),
            "Background Meteors": drawerFolder(
              "Background Meteors",
              {
                backgroundMeteorsEnabled: { value: d.background.meteors.enabled, label: "Enabled" },
                backgroundMeteorsRatePerSec: {
                  value: d.background.meteors.ratePerSec,
                  min: 0.02,
                  max: 40,
                  step: 0.02,
                  label: "Meteors / sec",
                  render: (get) => !!get("Rain.Background Meteors.backgroundMeteorsEnabled"),
                },
                backgroundMeteorsMaxActive: {
                  value: d.background.meteors.maxActive,
                  min: 1,
                  max: 64,
                  step: 1,
                  label: "Max in flight",
                  render: (get) => !!get("Rain.Background Meteors.backgroundMeteorsEnabled"),
                },
                backgroundMeteorsRadiantAngleDeg: {
                  value: d.background.meteors.radiantAngleDeg,
                  min: -180,
                  max: 180,
                  step: 1,
                  label: "Radiant angle",
                  render: (get) => !!get("Rain.Background Meteors.backgroundMeteorsEnabled"),
                },
                backgroundMeteorsAngleJitterDeg: {
                  value: d.background.meteors.angleJitterDeg,
                  min: 0,
                  max: 90,
                  step: 1,
                  label: "Angle spread",
                  render: (get) => !!get("Rain.Background Meteors.backgroundMeteorsEnabled"),
                },
                backgroundMeteorsSpeedScale: {
                  value: d.background.meteors.speedScale,
                  min: 0.05,
                  max: 4,
                  step: 0.01,
                  label: "Speed",
                  render: (get) => !!get("Rain.Background Meteors.backgroundMeteorsEnabled"),
                },
                backgroundMeteorsSpeedVariation: {
                  value: d.background.meteors.speedVariation,
                  min: 0,
                  max: 1,
                  step: 0.01,
                  label: "Speed variation",
                  render: (get) => !!get("Rain.Background Meteors.backgroundMeteorsEnabled"),
                },
                backgroundMeteorsTailLengthScale: {
                  value: d.background.meteors.tailLengthScale,
                  min: 0.05,
                  max: 4,
                  step: 0.01,
                  label: "Tail length",
                  render: (get) => !!get("Rain.Background Meteors.backgroundMeteorsEnabled"),
                },
                backgroundMeteorsTailLengthVariation: {
                  value: d.background.meteors.tailLengthVariation,
                  min: 0,
                  max: 1,
                  step: 0.01,
                  label: "Tail variation",
                  render: (get) => !!get("Rain.Background Meteors.backgroundMeteorsEnabled"),
                },
                backgroundMeteorsThicknessScale: {
                  value: d.background.meteors.thicknessScale,
                  min: 0.05,
                  max: 4,
                  step: 0.01,
                  label: "Thickness",
                  render: (get) => !!get("Rain.Background Meteors.backgroundMeteorsEnabled"),
                },
                backgroundMeteorsThicknessVariation: {
                  value: d.background.meteors.thicknessVariation,
                  min: 0,
                  max: 1,
                  step: 0.01,
                  label: "Thickness variation",
                  render: (get) => !!get("Rain.Background Meteors.backgroundMeteorsEnabled"),
                },
                backgroundMeteorsLifetimeMinMs: {
                  value: d.background.meteors.lifetimeMinMs,
                  min: 60,
                  max: 10000,
                  step: 10,
                  label: "Life min (ms)",
                  render: (get) => !!get("Rain.Background Meteors.backgroundMeteorsEnabled"),
                },
                backgroundMeteorsLifetimeMaxMs: {
                  value: d.background.meteors.lifetimeMaxMs,
                  min: 60,
                  max: 10000,
                  step: 10,
                  label: "Life max (ms)",
                  render: (get) => !!get("Rain.Background Meteors.backgroundMeteorsEnabled"),
                },
                backgroundMeteorsBrightness: {
                  value: d.background.meteors.brightness,
                  min: 0,
                  max: 4,
                  step: 0.01,
                  label: "Streak brightness",
                  render: (get) => !!get("Rain.Background Meteors.backgroundMeteorsEnabled"),
                },
                backgroundMeteorsHeadGlow: {
                  value: d.background.meteors.headGlow,
                  min: 0,
                  max: 4,
                  step: 0.01,
                  label: "Head glow",
                  render: (get) => !!get("Rain.Background Meteors.backgroundMeteorsEnabled"),
                },
                backgroundMeteorsPushPx: {
                  value: d.background.meteors.pushPx,
                  min: 0,
                  max: 40,
                  step: 0.1,
                  label: "Stripe push (px)",
                  render: (get) => !!get("Rain.Background Meteors.backgroundMeteorsEnabled"),
                },
                backgroundMeteorsPushFalloffScale: {
                  value: d.background.meteors.pushFalloffScale,
                  min: 0.05,
                  max: 4,
                  step: 0.01,
                  label: "Push falloff",
                  render: (get) => !!get("Rain.Background Meteors.backgroundMeteorsEnabled"),
                },
                backgroundMeteorsFadeInMs: {
                  value: d.background.meteors.fadeInMs,
                  min: 0,
                  max: 3000,
                  step: 10,
                  label: "Fade in (ms)",
                  render: (get) => !!get("Rain.Background Meteors.backgroundMeteorsEnabled"),
                },
                backgroundMeteorsFadeOutMs: {
                  value: d.background.meteors.fadeOutMs,
                  min: 0,
                  max: 3000,
                  step: 10,
                  label: "Fade out (ms)",
                  render: (get) => !!get("Rain.Background Meteors.backgroundMeteorsEnabled"),
                },
                backgroundMeteorsSeed: {
                  value: d.background.meteors.seed,
                  min: 0,
                  max: 9999,
                  step: 1,
                  label: "Seed",
                  render: (get) => !!get("Rain.Background Meteors.backgroundMeteorsEnabled"),
                },
              },
              { hideInClient: true, rainInClient: true },
            ),
            "Background Flames": drawerFolder(
              "Background Flames",
              {
                flamesEnabled: { value: d.flames.enabled, label: "Enabled" },
                flamesDirection: {
                  value: d.flames.direction,
                  options: {
                    Up: "up",
                    Down: "down",
                    Left: "left",
                    Right: "right",
                    "Up - Down": "upDown",
                    "Left - Right": "leftRight",
                    "Vortex Singular": "vortexSingular",
                  } as const,
                  label: "Direction",
                  render: (get) => get("Rain.Background Flames.flamesEnabled") === true,
                },
                flamesVsSegCount: {
                  value: d.flames.vortexSingular.segCount,
                  min: 2,
                  max: 80,
                  step: 1,
                  label: "VS Segments",
                  render: (get) =>
                    get("Rain.Background Flames.flamesEnabled") === true &&
                    get("Rain.Background Flames.flamesDirection") === "vortexSingular",
                },
                flamesVsSegSpacing: {
                  value: d.flames.vortexSingular.segSpacingPx,
                  min: 2,
                  max: 60,
                  step: 1,
                  label: "VS Spacing (px)",
                  render: (get) =>
                    get("Rain.Background Flames.flamesEnabled") === true &&
                    get("Rain.Background Flames.flamesDirection") === "vortexSingular",
                },
                flamesVsTurnRate: {
                  value: d.flames.vortexSingular.turnRate,
                  min: 0.05,
                  max: 6,
                  step: 0.05,
                  label: "VS Turn Rate",
                  render: (get) =>
                    get("Rain.Background Flames.flamesEnabled") === true &&
                    get("Rain.Background Flames.flamesDirection") === "vortexSingular",
                },
                flamesVsTurnVariation: {
                  value: d.flames.vortexSingular.turnVariation,
                  min: 0,
                  max: 1,
                  step: 0.01,
                  label: "VS Turn Variation",
                  render: (get) =>
                    get("Rain.Background Flames.flamesEnabled") === true &&
                    get("Rain.Background Flames.flamesDirection") === "vortexSingular",
                },
                flamesVsVisibleMinSec: {
                  value: d.flames.vortexSingular.visibleMinMs / 1000,
                  min: 0.5,
                  max: 60,
                  step: 0.5,
                  label: "VS Visible Min (s)",
                  render: (get) =>
                    get("Rain.Background Flames.flamesEnabled") === true &&
                    get("Rain.Background Flames.flamesDirection") === "vortexSingular",
                },
                flamesVsVisibleMaxSec: {
                  value: d.flames.vortexSingular.visibleMaxMs / 1000,
                  min: 0.5,
                  max: 120,
                  step: 0.5,
                  label: "VS Visible Max (s)",
                  render: (get) =>
                    get("Rain.Background Flames.flamesEnabled") === true &&
                    get("Rain.Background Flames.flamesDirection") === "vortexSingular",
                },
                flamesVsHiddenMinSec: {
                  value: d.flames.vortexSingular.hiddenMinMs / 1000,
                  min: 0,
                  max: 30,
                  step: 0.1,
                  label: "VS Hidden Min (s)",
                  render: (get) =>
                    get("Rain.Background Flames.flamesEnabled") === true &&
                    get("Rain.Background Flames.flamesDirection") === "vortexSingular",
                },
                flamesVsHiddenMaxSec: {
                  value: d.flames.vortexSingular.hiddenMaxMs / 1000,
                  min: 0,
                  max: 60,
                  step: 0.1,
                  label: "VS Hidden Max (s)",
                  render: (get) =>
                    get("Rain.Background Flames.flamesEnabled") === true &&
                    get("Rain.Background Flames.flamesDirection") === "vortexSingular",
                },
                flamesVsLifeMinSec: {
                  value: d.flames.vortexSingular.lifeMinMs / 1000,
                  min: 0.5,
                  max: 60,
                  step: 0.5,
                  label: "VS Life Min (s)",
                  render: (get) =>
                    get("Rain.Background Flames.flamesEnabled") === true &&
                    get("Rain.Background Flames.flamesDirection") === "vortexSingular",
                },
                flamesVsLifeMaxSec: {
                  value: d.flames.vortexSingular.lifeMaxMs / 1000,
                  min: 0.5,
                  max: 120,
                  step: 0.5,
                  label: "VS Life Max (s)",
                  render: (get) =>
                    get("Rain.Background Flames.flamesEnabled") === true &&
                    get("Rain.Background Flames.flamesDirection") === "vortexSingular",
                },
                flamesVsEdgeMargin: {
                  value: d.flames.vortexSingular.edgeMarginRatio,
                  min: 0,
                  max: 0.4,
                  step: 0.01,
                  label: "VS Edge Margin",
                  render: (get) =>
                    get("Rain.Background Flames.flamesEnabled") === true &&
                    get("Rain.Background Flames.flamesDirection") === "vortexSingular",
                },
                flamesMinWidthPct: {
                  value: d.flames.minWidthRatio * 100,
                  min: 0.1,
                  max: 50,
                  step: 0.1,
                  label: "Width min %",
                  render: (get) => get("Rain.Background Flames.flamesEnabled") === true,
                },
                flamesMaxWidthPct: {
                  value: d.flames.maxWidthRatio * 100,
                  min: 0.1,
                  max: 50,
                  step: 0.1,
                  label: "Width max %",
                  render: (get) => get("Rain.Background Flames.flamesEnabled") === true,
                },
                flamesMinHeightPct: {
                  value: d.flames.minHeightRatio * 100,
                  min: 0.1,
                  max: 50,
                  step: 0.1,
                  label: "Height min %",
                  render: (get) => get("Rain.Background Flames.flamesEnabled") === true,
                },
                flamesMaxHeightPct: {
                  value: d.flames.maxHeightRatio * 100,
                  min: 0.1,
                  max: 50,
                  step: 0.1,
                  label: "Height max %",
                  render: (get) => get("Rain.Background Flames.flamesEnabled") === true,
                },
                flamesBaseSpeed: {
                  value: d.flames.baseSpeedPxPerSec,
                  min: 1,
                  max: 500,
                  step: 1,
                  label: "Base speed (px/s)",
                  render: (get) => get("Rain.Background Flames.flamesEnabled") === true,
                },
                flamesSpeedVariation: {
                  value: d.flames.speedVariation,
                  min: 0,
                  max: 1,
                  step: 0.01,
                  label: "Speed variation",
                  render: (get) => get("Rain.Background Flames.flamesEnabled") === true,
                },
                flamesSpawnInterval: {
                  value: d.flames.spawnIntervalMs,
                  min: 20,
                  max: 5000,
                  step: 10,
                  label: "Spawn interval (ms)",
                  render: (get) => get("Rain.Background Flames.flamesEnabled") === true,
                },
                flamesSpawnJitter: {
                  value: d.flames.spawnJitterMs,
                  min: 0,
                  max: 2000,
                  step: 10,
                  label: "Spawn jitter (ms)",
                  render: (get) => get("Rain.Background Flames.flamesEnabled") === true,
                },
                flamesMaxActive: {
                  value: d.flames.maxActive,
                  min: 1,
                  max: 200,
                  step: 1,
                  label: "Max active",
                  render: (get) => get("Rain.Background Flames.flamesEnabled") === true,
                },
                flamesEdgeSharpness: {
                  value: d.flames.edgeSharpness,
                  min: 0,
                  max: 1,
                  step: 0.01,
                  label: "Edge sharpness",
                  render: (get) => get("Rain.Background Flames.flamesEnabled") === true,
                },
                flamesOpacityMin: {
                  value: d.flames.opacityMin,
                  min: 0,
                  max: 1,
                  step: 0.01,
                  label: "Opacity min",
                  render: (get) => get("Rain.Background Flames.flamesEnabled") === true,
                },
                flamesOpacityMax: {
                  value: d.flames.opacityMax,
                  min: 0,
                  max: 1,
                  step: 0.01,
                  label: "Opacity max",
                  render: (get) => get("Rain.Background Flames.flamesEnabled") === true,
                },
              },
              { hideInClient: true, rainInClient: true },
            ),
            Sparkle: drawerFolder(
              "Sparkle",
              {
                sparkleGapsCoverage: {
                  value: d.sparkle.gaps.coverage * 100,
                  min: 0,
                  max: 100,
                  step: 1,
                  label: "Rain gaps %",
                },
                sparkleGapsSpeed: {
                  value: d.sparkle.gaps.speed,
                  min: 0.05,
                  max: 5,
                  step: 0.05,
                  label: "Rain gaps speed",
                },
                sparkleStripeEnabled: { value: d.sparkle.stripe.enabled, label: "Stripe sparkle enabled" },
                sparkleStripeCoverage: {
                  value: d.sparkle.stripe.coverage * 100,
                  min: 0,
                  max: 100,
                  step: 1,
                  label: "Stripe sparkle %",
                  render: (get) => get("Rain.Sparkle.sparkleStripeEnabled") === true,
                },
                sparkleStripeThickestCount: {
                  value: Math.min(d.sparkle.stripe.thickestCount, visibleStripeWidthLevelCount(d.stripes)),
                  min: 1,
                  max: visibleStripeWidthLevelCount(d.stripes),
                  step: 1,
                  label: "Thickest levels",
                  render: (get) => get("Rain.Sparkle.sparkleStripeEnabled") === true,
                },
                sparkleStripeMaxBrightness: {
                  value: d.sparkle.stripe.maxBrightness * 100,
                  min: 0,
                  max: 100,
                  step: 1,
                  label: "+ Brightness",
                  render: (get) => get("Rain.Sparkle.sparkleStripeEnabled") === true,
                },
                sparkleStripeSpeed: {
                  value: d.sparkle.stripe.speed,
                  min: 0.05,
                  max: 10,
                  step: 0.05,
                  label: "Sparkle speed",
                  render: (get) => get("Rain.Sparkle.sparkleStripeEnabled") === true,
                },
                sparkleStripeHueDriftDeg: {
                  value: d.sparkle.stripe.hueDriftDeg,
                  min: -180,
                  max: 180,
                  step: 1,
                  label: "Spectrum hue °",
                  render: (get) => get("Rain.Sparkle.sparkleStripeEnabled") === true,
                },
                sparkleStripeSaturationBoost: {
                  value: d.sparkle.stripe.saturationBoost * 100,
                  min: 0,
                  max: 100,
                  step: 1,
                  label: "Spectrum sat %",
                  render: (get) => get("Rain.Sparkle.sparkleStripeEnabled") === true,
                },
                sparkleWidthEnabled: { value: d.sparkle.width.enabled, label: "Width shuffle enabled" },
                sparkleWidthCoverage: {
                  value: d.sparkle.width.coverage,
                  min: 0,
                  max: 1,
                  step: 0.01,
                  label: "Width active %",
                  render: (get) => get("Rain.Sparkle.sparkleWidthEnabled") === true,
                },
                sparkleWidthSwingPx: {
                  value: d.sparkle.width.swingPx,
                  min: 0,
                  max: 40,
                  step: 0.25,
                  label: "Width swing (px)",
                  render: (get) => get("Rain.Sparkle.sparkleWidthEnabled") === true,
                },
                sparkleWidthSwingPeriodMin: {
                  value: d.sparkle.width.swingPeriodMin,
                  min: 0.02,
                  max: 5,
                  step: 0.01,
                  label: "Swing period min",
                  render: (get) => get("Rain.Sparkle.sparkleWidthEnabled") === true,
                },
                sparkleWidthSwingPeriodMax: {
                  value: d.sparkle.width.swingPeriodMax,
                  min: 0.02,
                  max: 5,
                  step: 0.01,
                  label: "Swing period max",
                  render: (get) => get("Rain.Sparkle.sparkleWidthEnabled") === true,
                },
                sparkleMotionEnabled: { value: d.sparkle.motion.enabled, label: "Column motion enabled" },
                sparkleMotionAmplitudePx: {
                  value: d.sparkle.motion.amplitudePx,
                  min: 0,
                  max: 64,
                  step: 0.5,
                  label: "Move amount (px)",
                  render: (get) => get("Rain.Sparkle.sparkleMotionEnabled") === true,
                },
                sparkleMotionStaggerPx: {
                  value: d.sparkle.motion.staggerPx,
                  min: 1,
                  max: 512,
                  step: 1,
                  label: "Random pattern",
                  render: (get) => get("Rain.Sparkle.sparkleMotionEnabled") === true,
                },
                sparkleMotionMaxOffsetPx: {
                  value: d.sparkle.motion.maxOffsetPx,
                  min: 0,
                  max: 128,
                  step: 0.5,
                  label: "Max offset (px)",
                  render: (get) => get("Rain.Sparkle.sparkleMotionEnabled") === true,
                },
                sparkleMotionSpeed: {
                  value: d.sparkle.motion.speed,
                  min: 0.05,
                  max: 5,
                  step: 0.05,
                  label: "Motion speed",
                  render: (get) => get("Rain.Sparkle.sparkleMotionEnabled") === true,
                },
                sparkleMotionDirection: {
                  value: d.sparkle.motion.direction,
                  options: {
                    "Left → Right": "leftToRight",
                    "Right → Left": "rightToLeft",
                    "Top → Bottom": "topToBottom",
                    "Bottom → Top": "bottomToTop",
                  } as const,
                  label: "Sweep direction",
                  render: () => false,
                },
              },
              { hideInClient: true, rainInClient: true },
            ),
            Letters: drawerFolder(
              "Letters",
              {
                lettersEnabled: { value: d.letters.enabled, label: "Enabled" },
                lettersMode: {
                  value: d.letters.mode,
                  options: {
                    "Random letters": "random",
                    Text: "text",
                  } as const,
                  label: "Mode",
                  render: (get) => get("Rain.Letters.lettersEnabled") === true,
                },
                lettersColorMode: {
                  value: d.letters.colorMode,
                  options: {
                    White: "white",
                    Colorful: "colorful",
                  } as const,
                  label: "Color",
                  render: (get) => get("Rain.Letters.lettersEnabled") === true,
                },
                lettersFontFamily: {
                  value: d.letters.fontFamily,
                  options: {
                    "Geist Mono Medium": "Geist Mono Medium",
                    Monospace: "monospace",
                    Sans: "Arial, sans-serif",
                    Serif: "Georgia, serif",
                    Courier: '"Courier New", monospace',
                    "Times New Roman": '"Times New Roman", serif',
                    Impact: "Impact, fantasy",
                  } as const,
                  label: "Font",
                  render: (get) => get("Rain.Letters.lettersEnabled") === true,
                },
                lettersText: {
                  value: d.letters.text,
                  label: "Text",
                  render: (get) =>
                    get("Rain.Letters.lettersEnabled") === true && get("Rain.Letters.lettersMode") === "text",
                },
                lettersTextCopies: {
                  value: d.letters.textCopies,
                  min: 1,
                  max: 100,
                  step: 1,
                  label: "Text copies",
                  render: (get) =>
                    get("Rain.Letters.lettersEnabled") === true && get("Rain.Letters.lettersMode") === "text",
                },
                coverage: {
                  value: d.letters.coverage,
                  min: 0,
                  max: 1,
                  step: 0.01,
                  label: "Random density",
                  render: (get) =>
                    get("Rain.Letters.lettersEnabled") === true && get("Rain.Letters.lettersMode") === "random",
                },
                lettersPositionX: {
                  value: d.letters.positionX,
                  min: 0,
                  max: 1,
                  step: 0.01,
                  label: "Position X",
                  render: (get) =>
                    get("Rain.Letters.lettersEnabled") === true && get("Rain.Letters.lettersMode") === "random",
                },
                lettersPositionY: {
                  value: d.letters.positionY,
                  min: 0,
                  max: 1,
                  step: 0.01,
                  label: "Position Y",
                  render: (get) =>
                    get("Rain.Letters.lettersEnabled") === true && get("Rain.Letters.lettersMode") === "random",
                },
                lettersAreaWidth: {
                  value: d.letters.areaWidth,
                  min: 0.01,
                  max: 1,
                  step: 0.01,
                  label: "Random area W",
                  render: (get) =>
                    get("Rain.Letters.lettersEnabled") === true && get("Rain.Letters.lettersMode") === "random",
                },
                lettersAreaHeight: {
                  value: d.letters.areaHeight,
                  min: 0.01,
                  max: 1,
                  step: 0.01,
                  label: "Random area H",
                  render: (get) =>
                    get("Rain.Letters.lettersEnabled") === true && get("Rain.Letters.lettersMode") === "random",
                },
                sizeScale: {
                  value: d.letters.sizeScale,
                  min: 0.1,
                  max: 1,
                  step: 0.05,
                  label: "Font size",
                  render: (get) => get("Rain.Letters.lettersEnabled") === true,
                },
                shuffleSpeed: {
                  value: d.letters.shuffleSpeed,
                  min: 0.05,
                  max: 3,
                  step: 0.05,
                  label: "Shuffle speed",
                  render: (get) => get("Rain.Letters.lettersEnabled") === true,
                },
              },
              { hideInClient: true, rainInClient: true },
            ),
            Reveal: drawerFolder(
              "Reveal",
              {
                revealType: {
                  value: d.reveal.type,
                  options: {
                    Wave: "wave",
                    Assembly: "assembly",
                    Turbulence: "turbulence",
                    Glitch: "glitch",
                    Vortex: "vortex",
                    Blackhole: "blackhole",
                    Whirlpool: "whirlpool",
                    Water: "water",
                  } as const,
                  label: "Type",
                },
                revealPosition: {
                  value: d.reveal.wave.position,
                  options: {
                    Center: "center",
                    "Left Top": "left top",
                    "Center Top": "center top",
                    "Right Top": "right top",
                    "Left Center": "left center",
                    "Right Center": "right center",
                    "Left Bottom": "left bottom",
                    "Center Bottom": "center bottom",
                    "Right Bottom": "right bottom",
                  } as const,
                  label: "Position",
                  render: (get) => get("Rain.Reveal.revealType") === "wave",
                },
                revealDurationMs: {
                  value: d.reveal.wave.durationMs,
                  min: 100,
                  max: 30000,
                  step: 50,
                  label: "Duration (ms)",
                  render: (get) => get("Rain.Reveal.revealType") === "wave",
                },
                revealSoftness: {
                  value: d.reveal.wave.softness,
                  min: 0,
                  max: 1,
                  step: 0.01,
                  label: "Softness",
                  render: (get) => get("Rain.Reveal.revealType") === "wave",
                },
                revealWaviness: {
                  value: d.reveal.wave.waviness,
                  min: 0,
                  max: 1,
                  step: 0.01,
                  label: "Waviness",
                  render: (get) => get("Rain.Reveal.revealType") === "wave",
                },
                revealSliceSizePx: {
                  value: d.reveal.assembly.sliceSizePx,
                  min: 8,
                  max: 200,
                  step: 1,
                  label: "Slice size (px)",
                  render: (get) => get("Rain.Reveal.revealType") === "assembly",
                },
                revealSpeedMinMs: {
                  value: d.reveal.assembly.speedMinMs,
                  min: 100,
                  max: 30000,
                  step: 50,
                  label: "Speed min (ms)",
                  render: (get) => get("Rain.Reveal.revealType") === "assembly",
                },
                revealSpeedMaxMs: {
                  value: d.reveal.assembly.speedMaxMs,
                  min: 100,
                  max: 30000,
                  step: 50,
                  label: "Speed max (ms)",
                  render: (get) => get("Rain.Reveal.revealType") === "assembly",
                },
                revealStaggerMs: {
                  value: d.reveal.assembly.staggerMs,
                  min: 0,
                  max: 30000,
                  step: 50,
                  label: "Stagger (ms)",
                  render: (get) => get("Rain.Reveal.revealType") === "assembly",
                },
                revealScatterPx: {
                  value: d.reveal.assembly.scatterPx,
                  min: 0,
                  max: 300,
                  step: 1,
                  label: "Scatter (px)",
                  render: (get) => get("Rain.Reveal.revealType") === "assembly",
                },
                revealAngleJitterDeg: {
                  value: d.reveal.assembly.angleJitterDeg,
                  min: 0,
                  max: 90,
                  step: 1,
                  label: "Angle jitter (°)",
                  render: (get) => get("Rain.Reveal.revealType") === "assembly",
                },
                revealTurbSpeedMinMs: {
                  value: d.reveal.turbulence.speedMinMs,
                  min: 50,
                  max: 30000,
                  step: 10,
                  label: "Speed min (ms)",
                  render: (get) => get("Rain.Reveal.revealType") === "turbulence",
                },
                revealTurbSpeedMaxMs: {
                  value: d.reveal.turbulence.speedMaxMs,
                  min: 50,
                  max: 30000,
                  step: 10,
                  label: "Speed max (ms)",
                  render: (get) => get("Rain.Reveal.revealType") === "turbulence",
                },
                revealTurbStaggerMs: {
                  value: d.reveal.turbulence.staggerMs,
                  min: 0,
                  max: 30000,
                  step: 10,
                  label: "Stagger (ms)",
                  render: (get) => get("Rain.Reveal.revealType") === "turbulence",
                },
                revealTurbIntensity: {
                  value: d.reveal.turbulence.intensity,
                  min: 0,
                  max: 2,
                  step: 0.05,
                  label: "Intensity",
                  render: (get) => get("Rain.Reveal.revealType") === "turbulence",
                },
                revealTurbDetail: {
                  value: d.reveal.turbulence.detail,
                  min: 0,
                  max: 1,
                  step: 0.05,
                  label: "Detail",
                  render: (get) => get("Rain.Reveal.revealType") === "turbulence",
                },
                revealTurbGlow: {
                  value: d.reveal.turbulence.glow,
                  min: 0,
                  max: 1,
                  step: 0.05,
                  label: "Glow",
                  render: (get) => get("Rain.Reveal.revealType") === "turbulence",
                },
                revealGlitchSpeedMinMs: {
                  value: d.reveal.glitch.speedMinMs,
                  min: 50,
                  max: 30000,
                  step: 10,
                  label: "Speed min (ms)",
                  render: (get) => get("Rain.Reveal.revealType") === "glitch",
                },
                revealGlitchSpeedMaxMs: {
                  value: d.reveal.glitch.speedMaxMs,
                  min: 50,
                  max: 30000,
                  step: 10,
                  label: "Speed max (ms)",
                  render: (get) => get("Rain.Reveal.revealType") === "glitch",
                },
                revealGlitchStaggerMs: {
                  value: d.reveal.glitch.staggerMs,
                  min: 0,
                  max: 30000,
                  step: 10,
                  label: "Stagger (ms)",
                  render: (get) => get("Rain.Reveal.revealType") === "glitch",
                },
                revealGlitchIntensity: {
                  value: d.reveal.glitch.intensity,
                  min: 0,
                  max: 2,
                  step: 0.05,
                  label: "Intensity",
                  render: (get) => get("Rain.Reveal.revealType") === "glitch",
                },
                revealGlitchDetail: {
                  value: d.reveal.glitch.detail,
                  min: 0,
                  max: 1,
                  step: 0.05,
                  label: "Detail",
                  render: (get) => get("Rain.Reveal.revealType") === "glitch",
                },
                revealGlitchGlow: {
                  value: d.reveal.glitch.glow,
                  min: 0,
                  max: 1,
                  step: 0.05,
                  label: "Glow",
                  render: (get) => get("Rain.Reveal.revealType") === "glitch",
                },
                revealVorSpeedMinMs: {
                  value: d.reveal.vortex.speedMinMs,
                  min: 50,
                  max: 30000,
                  step: 10,
                  label: "Speed min (ms)",
                  render: (get) => get("Rain.Reveal.revealType") === "vortex",
                },
                revealVorSpeedMaxMs: {
                  value: d.reveal.vortex.speedMaxMs,
                  min: 50,
                  max: 30000,
                  step: 10,
                  label: "Speed max (ms)",
                  render: (get) => get("Rain.Reveal.revealType") === "vortex",
                },
                revealVorStaggerMs: {
                  value: d.reveal.vortex.staggerMs,
                  min: 0,
                  max: 30000,
                  step: 10,
                  label: "Stagger (ms)",
                  render: (get) => get("Rain.Reveal.revealType") === "vortex",
                },
                revealVorIntensity: {
                  value: d.reveal.vortex.intensity,
                  min: 0,
                  max: 2,
                  step: 0.05,
                  label: "Intensity",
                  render: (get) => get("Rain.Reveal.revealType") === "vortex",
                },
                revealVorDetail: {
                  value: d.reveal.vortex.detail,
                  min: 0,
                  max: 1,
                  step: 0.05,
                  label: "Detail",
                  render: (get) => get("Rain.Reveal.revealType") === "vortex",
                },
                revealVorSwirl: {
                  value: d.reveal.vortex.swirl,
                  min: 0,
                  max: 3,
                  step: 0.05,
                  label: "Swirl",
                  render: (get) => get("Rain.Reveal.revealType") === "vortex",
                },
                revealVorGlow: {
                  value: d.reveal.vortex.glow,
                  min: 0,
                  max: 1,
                  step: 0.05,
                  label: "Glow",
                  render: (get) => get("Rain.Reveal.revealType") === "vortex",
                },
                revealWaterDurationMs: {
                  value: d.reveal.water.durationMs,
                  min: 400,
                  max: 8000,
                  step: 50,
                  label: "Sweep ms",
                  render: (get) => get("Rain.Reveal.revealType") === "water",
                },
                revealWaterSettleMs: {
                  value: d.reveal.water.settleMs,
                  min: 0,
                  max: 4000,
                  step: 50,
                  label: "Settle ms",
                  render: (get) => get("Rain.Reveal.revealType") === "water",
                },
                revealWaterRows: {
                  value: d.reveal.water.rows,
                  min: 1,
                  max: 12,
                  step: 1,
                  label: "Rows",
                  render: (get) => get("Rain.Reveal.revealType") === "water",
                },
                revealWaterIntensity: {
                  value: d.reveal.water.intensity,
                  min: 0,
                  max: 1.5,
                  step: 0.01,
                  label: "Intensity",
                  render: (get) => get("Rain.Reveal.revealType") === "water",
                },
                revealWaterWobble: {
                  value: d.reveal.water.wobble,
                  min: 0,
                  max: 1,
                  step: 0.01,
                  label: "Wobble",
                  render: (get) => get("Rain.Reveal.revealType") === "water",
                },
                revealWaterRefraction: {
                  value: d.reveal.water.refraction,
                  min: 0,
                  max: 2,
                  step: 0.01,
                  label: "Refraction",
                  render: (get) => get("Rain.Reveal.revealType") === "water",
                },
                revealWaterSoftness: {
                  value: d.reveal.water.softness,
                  min: 0,
                  max: 1,
                  step: 0.01,
                  label: "Softness",
                  render: (get) => get("Rain.Reveal.revealType") === "water",
                },
                revealBhFormMs: {
                  value: d.reveal.blackhole.formMs,
                  min: 0,
                  max: 10000,
                  step: 10,
                  label: "Form (ms)",
                  render: (get) => get("Rain.Reveal.revealType") === "blackhole",
                },
                revealBhSpeedMinMs: {
                  value: d.reveal.blackhole.speedMinMs,
                  min: 50,
                  max: 30000,
                  step: 10,
                  label: "Speed min (ms)",
                  render: (get) => get("Rain.Reveal.revealType") === "blackhole",
                },
                revealBhSpeedMaxMs: {
                  value: d.reveal.blackhole.speedMaxMs,
                  min: 50,
                  max: 30000,
                  step: 10,
                  label: "Speed max (ms)",
                  render: (get) => get("Rain.Reveal.revealType") === "blackhole",
                },
                revealBhStaggerMs: {
                  value: d.reveal.blackhole.staggerMs,
                  min: 0,
                  max: 30000,
                  step: 10,
                  label: "Stagger (ms)",
                  render: (get) => get("Rain.Reveal.revealType") === "blackhole",
                },
                revealBhCollapseMs: {
                  value: d.reveal.blackhole.collapseMs,
                  min: 0,
                  max: 10000,
                  step: 10,
                  label: "Collapse (ms)",
                  render: (get) => get("Rain.Reveal.revealType") === "blackhole",
                },
                revealBhHorizon: {
                  value: d.reveal.blackhole.horizon,
                  min: 0.02,
                  max: 0.3,
                  step: 0.005,
                  label: "Horizon",
                  render: (get) => get("Rain.Reveal.revealType") === "blackhole",
                },
                revealBhSwirl: {
                  value: d.reveal.blackhole.swirl,
                  min: 0,
                  max: 3,
                  step: 0.05,
                  label: "Swirl",
                  render: (get) => get("Rain.Reveal.revealType") === "blackhole",
                },
                revealBhArms: {
                  value: d.reveal.blackhole.arms,
                  min: 1,
                  max: 8,
                  step: 1,
                  label: "Arms",
                  render: (get) => get("Rain.Reveal.revealType") === "blackhole",
                },
                revealBhLensing: {
                  value: d.reveal.blackhole.lensing,
                  min: 0,
                  max: 2,
                  step: 0.05,
                  label: "Lensing",
                  render: (get) => get("Rain.Reveal.revealType") === "blackhole",
                },
                revealBhIntensity: {
                  value: d.reveal.blackhole.intensity,
                  min: 0,
                  max: 2,
                  step: 0.05,
                  label: "Intensity",
                  render: (get) => get("Rain.Reveal.revealType") === "blackhole",
                },
                revealBhDetail: {
                  value: d.reveal.blackhole.detail,
                  min: 0,
                  max: 1,
                  step: 0.05,
                  label: "Detail",
                  render: (get) => get("Rain.Reveal.revealType") === "blackhole",
                },
                revealBhGlow: {
                  value: d.reveal.blackhole.glow,
                  min: 0,
                  max: 1,
                  step: 0.05,
                  label: "Glow",
                  render: (get) => get("Rain.Reveal.revealType") === "blackhole",
                },
                revealWpDurationMs: {
                  value: d.reveal.whirlpool.durationMs,
                  min: 100,
                  max: 30000,
                  step: 50,
                  label: "Duration (ms)",
                  render: (get) => get("Rain.Reveal.revealType") === "whirlpool",
                },
                revealWpTurns: {
                  value: d.reveal.whirlpool.turns,
                  min: 0,
                  max: 6,
                  step: 0.1,
                  label: "Turns",
                  render: (get) => get("Rain.Reveal.revealType") === "whirlpool",
                },
                revealWpTightness: {
                  value: d.reveal.whirlpool.tightness,
                  min: 0.05,
                  max: 0.5,
                  step: 0.005,
                  label: "Tightness",
                  render: (get) => get("Rain.Reveal.revealType") === "whirlpool",
                },
                revealWpStreak: {
                  value: d.reveal.whirlpool.streak,
                  min: 0,
                  max: 1,
                  step: 0.05,
                  label: "Streak",
                  render: (get) => get("Rain.Reveal.revealType") === "whirlpool",
                },
                revealWpGlow: {
                  value: d.reveal.whirlpool.glow,
                  min: 0,
                  max: 1,
                  step: 0.05,
                  label: "Glow",
                  render: (get) => get("Rain.Reveal.revealType") === "whirlpool",
                },
                Replay: button(() => onReplay()),
                Reset: button(() => {
                  const dr = DEFAULT_LAB_ENGINE_CONFIG.reveal;
                  shaderControlSetterRef.current?.({
                    revealType: dr.type,
                    revealPosition: dr.wave.position,
                    revealDurationMs: dr.wave.durationMs,
                    revealSoftness: dr.wave.softness,
                    revealWaviness: dr.wave.waviness,
                    revealSliceSizePx: dr.assembly.sliceSizePx,
                    revealSpeedMinMs: dr.assembly.speedMinMs,
                    revealSpeedMaxMs: dr.assembly.speedMaxMs,
                    revealStaggerMs: dr.assembly.staggerMs,
                    revealScatterPx: dr.assembly.scatterPx,
                    revealAngleJitterDeg: dr.assembly.angleJitterDeg,
                    revealTurbSpeedMinMs: dr.turbulence.speedMinMs,
                    revealTurbSpeedMaxMs: dr.turbulence.speedMaxMs,
                    revealTurbStaggerMs: dr.turbulence.staggerMs,
                    revealTurbIntensity: dr.turbulence.intensity,
                    revealTurbDetail: dr.turbulence.detail,
                    revealTurbGlow: dr.turbulence.glow,
                    revealGlitchSpeedMinMs: dr.glitch.speedMinMs,
                    revealGlitchSpeedMaxMs: dr.glitch.speedMaxMs,
                    revealGlitchStaggerMs: dr.glitch.staggerMs,
                    revealGlitchIntensity: dr.glitch.intensity,
                    revealGlitchDetail: dr.glitch.detail,
                    revealGlitchGlow: dr.glitch.glow,
                    revealVorSpeedMinMs: dr.vortex.speedMinMs,
                    revealVorSpeedMaxMs: dr.vortex.speedMaxMs,
                    revealVorStaggerMs: dr.vortex.staggerMs,
                    revealVorIntensity: dr.vortex.intensity,
                    revealVorDetail: dr.vortex.detail,
                    revealVorSwirl: dr.vortex.swirl,
                    revealVorGlow: dr.vortex.glow,
                    revealWaterDurationMs: dr.water.durationMs,
                    revealWaterSettleMs: dr.water.settleMs,
                    revealWaterRows: dr.water.rows,
                    revealWaterIntensity: dr.water.intensity,
                    revealWaterWobble: dr.water.wobble,
                    revealWaterRefraction: dr.water.refraction,
                    revealWaterSoftness: dr.water.softness,
                  });
                }),
              },
              { hideInClient: true, rainInClient: true },
            ),
            "Edge Mask": drawerFolder(
              "Edge Mask",
              {
                edgeMaskEnabled: { value: d.edgeMask.enabled, label: "Enabled" },
                edgeMaskStart: {
                  value: d.edgeMask.start,
                  min: 0,
                  max: 0.5,
                  step: 0.005,
                  label: "Start inset",
                  render: (get) => get("Rain.Edge Mask.edgeMaskEnabled") === true,
                },
                edgeMaskEnd: {
                  value: d.edgeMask.end,
                  min: 0,
                  max: 0.5,
                  step: 0.005,
                  label: "End inset",
                  render: (get) => get("Rain.Edge Mask.edgeMaskEnabled") === true,
                },
                edgeMaskPower: {
                  value: d.edgeMask.power,
                  min: 0.1,
                  max: 4,
                  step: 0.05,
                  label: "Power",
                  render: (get) => get("Rain.Edge Mask.edgeMaskEnabled") === true,
                },
                edgeMaskSides: {
                  value: edgeMaskSidePreset(d.edgeMask.sides),
                  options: EDGE_MASK_SIDE_OPTIONS,
                  label: "Sides",
                  render: (get) => get("Rain.Edge Mask.edgeMaskEnabled") === true,
                },
                edgeMaskSideTop: {
                  value: d.edgeMask.sides.top,
                  label: "Top",
                  render: (get) =>
                    get("Rain.Edge Mask.edgeMaskEnabled") === true && get("Rain.Edge Mask.edgeMaskSides") === "custom",
                },
                edgeMaskSideRight: {
                  value: d.edgeMask.sides.right,
                  label: "Right",
                  render: (get) =>
                    get("Rain.Edge Mask.edgeMaskEnabled") === true && get("Rain.Edge Mask.edgeMaskSides") === "custom",
                },
                edgeMaskSideBottom: {
                  value: d.edgeMask.sides.bottom,
                  label: "Bottom",
                  render: (get) =>
                    get("Rain.Edge Mask.edgeMaskEnabled") === true && get("Rain.Edge Mask.edgeMaskSides") === "custom",
                },
                edgeMaskSideLeft: {
                  value: d.edgeMask.sides.left,
                  label: "Left",
                  render: (get) =>
                    get("Rain.Edge Mask.edgeMaskEnabled") === true && get("Rain.Edge Mask.edgeMaskSides") === "custom",
                },
              },
              { hideInClient: true, rainInClient: true },
            ),
            "Cursor Trail": drawerFolder(
              "Cursor Trail",
              {
                cursorTrailEnabled: { value: d.cursorTrail.enabled, label: "Enabled" },
                cursorTrailType: {
                  value: d.cursorTrail.type,
                  options: {
                    Default: "default",
                    Wave: "wave",
                    Constellation: "constellation",
                    Comet: "comet",
                  } as const,
                  label: "Type",
                  render: (get) => get("Rain.Cursor Trail.cursorTrailEnabled") === true,
                },
                particleRadius: {
                  value: d.cursorTrail.particleRadius,
                  min: 0.5,
                  max: 80,
                  step: 0.5,
                  label: "Particle radius",
                  render: (get) =>
                    get("Rain.Cursor Trail.cursorTrailEnabled") === true &&
                    get("Rain.Cursor Trail.cursorTrailType") === "default",
                },
                particleAlpha: {
                  value: d.cursorTrail.particleAlpha,
                  min: 0,
                  max: 1,
                  step: 0.005,
                  label: "Particle alpha",
                  render: (get) =>
                    get("Rain.Cursor Trail.cursorTrailEnabled") === true &&
                    get("Rain.Cursor Trail.cursorTrailType") === "default",
                },
                particleLifeMs: {
                  value: d.cursorTrail.particleLifeMs,
                  min: 50,
                  max: 10000,
                  step: 10,
                  label: "Particle life (ms)",
                  render: (get) =>
                    get("Rain.Cursor Trail.cursorTrailEnabled") === true &&
                    get("Rain.Cursor Trail.cursorTrailType") === "default",
                },
                particleSpacingPx: {
                  value: d.cursorTrail.particleSpacingPx,
                  min: 0.5,
                  max: 80,
                  step: 0.5,
                  label: "Particle spacing (px)",
                  render: (get) =>
                    get("Rain.Cursor Trail.cursorTrailEnabled") === true &&
                    get("Rain.Cursor Trail.cursorTrailType") === "default",
                },
                maxEmitPerTick: {
                  value: d.cursorTrail.maxEmitPerTick,
                  min: 1,
                  max: 200,
                  step: 1,
                  label: "Max emit/tick",
                  render: (get) =>
                    get("Rain.Cursor Trail.cursorTrailEnabled") === true &&
                    get("Rain.Cursor Trail.cursorTrailType") === "default",
                },
                spreadMinPx: {
                  value: d.cursorTrail.spreadMinPx,
                  min: 0,
                  max: 80,
                  step: 0.5,
                  label: "Spread min (px)",
                  render: (get) =>
                    get("Rain.Cursor Trail.cursorTrailEnabled") === true &&
                    get("Rain.Cursor Trail.cursorTrailType") === "default",
                },
                spreadMaxPx: {
                  value: d.cursorTrail.spreadMaxPx,
                  min: 0,
                  max: 120,
                  step: 0.5,
                  label: "Spread max (px)",
                  render: (get) =>
                    get("Rain.Cursor Trail.cursorTrailEnabled") === true &&
                    get("Rain.Cursor Trail.cursorTrailType") === "default",
                },
                spinStrength: {
                  value: d.cursorTrail.spinStrength,
                  min: 0,
                  max: 0.2,
                  step: 0.001,
                  label: "Spin strength",
                  render: (get) =>
                    get("Rain.Cursor Trail.cursorTrailEnabled") === true &&
                    get("Rain.Cursor Trail.cursorTrailType") === "default",
                },
                pushStrengthPx: {
                  value: d.cursorTrail.pushStrengthPx,
                  min: 0,
                  max: 120,
                  step: 1,
                  label: "Push strength (px)",
                  render: (get) =>
                    get("Rain.Cursor Trail.cursorTrailEnabled") === true &&
                    get("Rain.Cursor Trail.cursorTrailType") === "default",
                },
                pushRadiusScale: {
                  value: d.cursorTrail.pushRadiusScale,
                  min: 0,
                  max: 8,
                  step: 0.05,
                  label: "Push radius scale",
                  render: (get) =>
                    get("Rain.Cursor Trail.cursorTrailEnabled") === true &&
                    get("Rain.Cursor Trail.cursorTrailType") === "default",
                },
                pushWobblePx: {
                  value: d.cursorTrail.pushWobblePx,
                  min: 0,
                  max: 80,
                  step: 1,
                  label: "Push wobble (px)",
                  render: (get) =>
                    get("Rain.Cursor Trail.cursorTrailEnabled") === true &&
                    get("Rain.Cursor Trail.cursorTrailType") === "default",
                },
                constellationRadiusScale: {
                  value: d.cursorTrail.constellation.radiusScale,
                  min: 0.02,
                  max: 2,
                  step: 0.005,
                  label: "Cursor radius (scale)",
                  render: (get) =>
                    get("Rain.Cursor Trail.cursorTrailEnabled") === true &&
                    get("Rain.Cursor Trail.cursorTrailType") === "constellation",
                },
                constellationStarDensity: {
                  value: d.cursorTrail.constellation.starDensity,
                  min: 0.05,
                  max: 4,
                  step: 0.05,
                  label: "Star density",
                  render: (get) =>
                    get("Rain.Cursor Trail.cursorTrailEnabled") === true &&
                    get("Rain.Cursor Trail.cursorTrailType") === "constellation",
                },
                constellationStarSizePx: {
                  value: d.cursorTrail.constellation.starSizePx,
                  min: 0.2,
                  max: 20,
                  step: 0.05,
                  label: "Star size (px)",
                  render: (get) =>
                    get("Rain.Cursor Trail.cursorTrailEnabled") === true &&
                    get("Rain.Cursor Trail.cursorTrailType") === "constellation",
                },
                constellationStarSizeRandomness: {
                  value: d.cursorTrail.constellation.starSizeRandomness,
                  min: 0,
                  max: 1,
                  step: 0.01,
                  label: "Star size randomness",
                  render: (get) =>
                    get("Rain.Cursor Trail.cursorTrailEnabled") === true &&
                    get("Rain.Cursor Trail.cursorTrailType") === "constellation",
                },
                constellationStarGrowScale: {
                  value: d.cursorTrail.constellation.starGrowScale,
                  min: 0,
                  max: 6,
                  step: 0.05,
                  label: "Star grow scale",
                  render: (get) =>
                    get("Rain.Cursor Trail.cursorTrailEnabled") === true &&
                    get("Rain.Cursor Trail.cursorTrailType") === "constellation",
                },
                constellationStarPushPx: {
                  value: d.cursorTrail.constellation.starPushPx,
                  min: 0,
                  max: 40,
                  step: 0.1,
                  label: "Star push (px)",
                  render: (get) =>
                    get("Rain.Cursor Trail.cursorTrailEnabled") === true &&
                    get("Rain.Cursor Trail.cursorTrailType") === "constellation",
                },
                constellationTwinkleAmount: {
                  value: d.cursorTrail.constellation.twinkleAmount,
                  min: 0,
                  max: 1,
                  step: 0.01,
                  label: "Twinkle amount",
                  render: (get) =>
                    get("Rain.Cursor Trail.cursorTrailEnabled") === true &&
                    get("Rain.Cursor Trail.cursorTrailType") === "constellation",
                },
                constellationTwinkleSpeed: {
                  value: d.cursorTrail.constellation.twinkleSpeed,
                  min: 0,
                  max: 10,
                  step: 0.05,
                  label: "Twinkle speed",
                  render: (get) =>
                    get("Rain.Cursor Trail.cursorTrailEnabled") === true &&
                    get("Rain.Cursor Trail.cursorTrailType") === "constellation",
                },
                constellationLinkThicknessPx: {
                  value: d.cursorTrail.constellation.linkThicknessPx,
                  min: 0.2,
                  max: 20,
                  step: 0.05,
                  label: "Link thickness (px)",
                  render: (get) =>
                    get("Rain.Cursor Trail.cursorTrailEnabled") === true &&
                    get("Rain.Cursor Trail.cursorTrailType") === "constellation",
                },
                constellationLinkBrightness: {
                  value: d.cursorTrail.constellation.linkBrightness,
                  min: 0,
                  max: 4,
                  step: 0.05,
                  label: "Link brightness",
                  render: (get) =>
                    get("Rain.Cursor Trail.cursorTrailEnabled") === true &&
                    get("Rain.Cursor Trail.cursorTrailType") === "constellation",
                },
                constellationLinkGrooveDepth: {
                  value: d.cursorTrail.constellation.linkGrooveDepth,
                  min: 0,
                  max: 4,
                  step: 0.05,
                  label: "Link groove depth",
                  render: (get) =>
                    get("Rain.Cursor Trail.cursorTrailEnabled") === true &&
                    get("Rain.Cursor Trail.cursorTrailType") === "constellation",
                },
                constellationLinkShearPx: {
                  value: d.cursorTrail.constellation.linkShearPx,
                  min: 0,
                  max: 80,
                  step: 0.5,
                  label: "Link shear (px)",
                  render: (get) =>
                    get("Rain.Cursor Trail.cursorTrailEnabled") === true &&
                    get("Rain.Cursor Trail.cursorTrailType") === "constellation",
                },
                constellationLinkMaxDistScale: {
                  value: d.cursorTrail.constellation.linkMaxDistScale,
                  min: 0.02,
                  max: 1,
                  step: 0.002,
                  label: "Link max distance (scale)",
                  render: (get) =>
                    get("Rain.Cursor Trail.cursorTrailEnabled") === true &&
                    get("Rain.Cursor Trail.cursorTrailType") === "constellation",
                },
                constellationLinkFormMs: {
                  value: d.cursorTrail.constellation.linkFormMs,
                  min: 10,
                  max: 5000,
                  step: 10,
                  label: "Link form (ms)",
                  render: (get) =>
                    get("Rain.Cursor Trail.cursorTrailEnabled") === true &&
                    get("Rain.Cursor Trail.cursorTrailType") === "constellation",
                },
                constellationLinkHoldMs: {
                  value: d.cursorTrail.constellation.linkHoldMs,
                  min: 0,
                  max: 10000,
                  step: 10,
                  label: "Link hold (ms)",
                  render: (get) =>
                    get("Rain.Cursor Trail.cursorTrailEnabled") === true &&
                    get("Rain.Cursor Trail.cursorTrailType") === "constellation",
                },
                constellationLinkDissolveMs: {
                  value: d.cursorTrail.constellation.linkDissolveMs,
                  min: 10,
                  max: 10000,
                  step: 10,
                  label: "Link dissolve (ms)",
                  render: (get) =>
                    get("Rain.Cursor Trail.cursorTrailEnabled") === true &&
                    get("Rain.Cursor Trail.cursorTrailType") === "constellation",
                },
                constellationMaxLinks: {
                  value: d.cursorTrail.constellation.maxLinks,
                  min: 4,
                  max: 80,
                  step: 1,
                  label: "Max links",
                  render: (get) =>
                    get("Rain.Cursor Trail.cursorTrailEnabled") === true &&
                    get("Rain.Cursor Trail.cursorTrailType") === "constellation",
                },
                constellationMaxStars: {
                  value: d.cursorTrail.constellation.maxStars,
                  min: 4,
                  max: 160,
                  step: 1,
                  label: "Max stars",
                  render: (get) =>
                    get("Rain.Cursor Trail.cursorTrailEnabled") === true &&
                    get("Rain.Cursor Trail.cursorTrailType") === "constellation",
                },
                constellationPulseEnabled: {
                  value: d.cursorTrail.constellation.pulseEnabled,
                  label: "Pulses",
                  render: (get) =>
                    get("Rain.Cursor Trail.cursorTrailEnabled") === true &&
                    get("Rain.Cursor Trail.cursorTrailType") === "constellation",
                },
                constellationPulseDurationMs: {
                  value: d.cursorTrail.constellation.pulseDurationMs,
                  min: 60,
                  max: 10000,
                  step: 10,
                  label: "Pulse duration (ms)",
                  render: (get) =>
                    get("Rain.Cursor Trail.cursorTrailEnabled") === true &&
                    get("Rain.Cursor Trail.cursorTrailType") === "constellation" &&
                    get("Rain.Cursor Trail.constellationPulseEnabled") === true,
                },
                constellationPulseCoreLenPx: {
                  value: d.cursorTrail.constellation.pulseCoreLenPx,
                  min: 0.5,
                  max: 60,
                  step: 0.1,
                  label: "Pulse core length (px)",
                  render: (get) =>
                    get("Rain.Cursor Trail.cursorTrailEnabled") === true &&
                    get("Rain.Cursor Trail.cursorTrailType") === "constellation" &&
                    get("Rain.Cursor Trail.constellationPulseEnabled") === true,
                },
                constellationPulseTailLenPx: {
                  value: d.cursorTrail.constellation.pulseTailLenPx,
                  min: 0.5,
                  max: 240,
                  step: 0.5,
                  label: "Pulse tail length (px)",
                  render: (get) =>
                    get("Rain.Cursor Trail.cursorTrailEnabled") === true &&
                    get("Rain.Cursor Trail.cursorTrailType") === "constellation" &&
                    get("Rain.Cursor Trail.constellationPulseEnabled") === true,
                },
                constellationPulseBrightness: {
                  value: d.cursorTrail.constellation.pulseBrightness,
                  min: 0,
                  max: 4,
                  step: 0.05,
                  label: "Pulse brightness",
                  render: (get) =>
                    get("Rain.Cursor Trail.cursorTrailEnabled") === true &&
                    get("Rain.Cursor Trail.cursorTrailType") === "constellation" &&
                    get("Rain.Cursor Trail.constellationPulseEnabled") === true,
                },
                constellationPulseRelayHops: {
                  value: d.cursorTrail.constellation.pulseRelayHops,
                  min: 0,
                  max: 6,
                  step: 1,
                  label: "Pulse relay hops",
                  render: (get) =>
                    get("Rain.Cursor Trail.cursorTrailEnabled") === true &&
                    get("Rain.Cursor Trail.cursorTrailType") === "constellation" &&
                    get("Rain.Cursor Trail.constellationPulseEnabled") === true,
                },
                constellationPulseCooldownMs: {
                  value: d.cursorTrail.constellation.pulseCooldownMs,
                  min: 0,
                  max: 20000,
                  step: 10,
                  label: "Pulse cooldown (ms)",
                  render: (get) =>
                    get("Rain.Cursor Trail.cursorTrailEnabled") === true &&
                    get("Rain.Cursor Trail.cursorTrailType") === "constellation" &&
                    get("Rain.Cursor Trail.constellationPulseEnabled") === true,
                },
                constellationFlareMs: {
                  value: d.cursorTrail.constellation.flareMs,
                  min: 30,
                  max: 5000,
                  step: 10,
                  label: "Flare (ms)",
                  render: (get) =>
                    get("Rain.Cursor Trail.cursorTrailEnabled") === true &&
                    get("Rain.Cursor Trail.cursorTrailType") === "constellation",
                },
                constellationFlareScale: {
                  value: d.cursorTrail.constellation.flareScale,
                  min: 0,
                  max: 6,
                  step: 0.05,
                  label: "Flare scale",
                  render: (get) =>
                    get("Rain.Cursor Trail.cursorTrailEnabled") === true &&
                    get("Rain.Cursor Trail.cursorTrailType") === "constellation",
                },
                constellationPolygonFlashEnabled: {
                  value: d.cursorTrail.constellation.polygonFlashEnabled,
                  label: "Polygon flash",
                  render: (get) =>
                    get("Rain.Cursor Trail.cursorTrailEnabled") === true &&
                    get("Rain.Cursor Trail.cursorTrailType") === "constellation",
                },
                constellationPolygonFlashStrength: {
                  value: d.cursorTrail.constellation.polygonFlashStrength,
                  min: 0,
                  max: 4,
                  step: 0.05,
                  label: "Polygon flash strength",
                  render: (get) =>
                    get("Rain.Cursor Trail.cursorTrailEnabled") === true &&
                    get("Rain.Cursor Trail.cursorTrailType") === "constellation" &&
                    get("Rain.Cursor Trail.constellationPolygonFlashEnabled") === true,
                },
                cometEmbersEnabled: {
                  value: d.cursorTrail.comet.embersEnabled,
                  label: "Embers",
                  render: (get) =>
                    get("Rain.Cursor Trail.cursorTrailEnabled") === true &&
                    get("Rain.Cursor Trail.cursorTrailType") === "comet",
                },
                cometNodeCount: {
                  value: d.cursorTrail.comet.nodeCount,
                  min: 2,
                  max: 48,
                  step: 1,
                  label: "Body nodes",
                  render: (get) =>
                    get("Rain.Cursor Trail.cursorTrailEnabled") === true &&
                    get("Rain.Cursor Trail.cursorTrailType") === "comet",
                },
                cometHeadStiffness: {
                  value: d.cursorTrail.comet.headStiffness,
                  min: 100,
                  max: 40000,
                  step: 50,
                  label: "Head stiffness",
                  render: (get) =>
                    get("Rain.Cursor Trail.cursorTrailEnabled") === true &&
                    get("Rain.Cursor Trail.cursorTrailType") === "comet",
                },
                cometHeadDamping: {
                  value: d.cursorTrail.comet.headDamping,
                  min: 1,
                  max: 600,
                  step: 1,
                  label: "Head damping",
                  render: (get) =>
                    get("Rain.Cursor Trail.cursorTrailEnabled") === true &&
                    get("Rain.Cursor Trail.cursorTrailType") === "comet",
                },
                cometChainStiffness: {
                  value: d.cursorTrail.comet.chainStiffness,
                  min: 100,
                  max: 40000,
                  step: 50,
                  label: "Chain stiffness",
                  render: (get) =>
                    get("Rain.Cursor Trail.cursorTrailEnabled") === true &&
                    get("Rain.Cursor Trail.cursorTrailType") === "comet",
                },
                cometChainDamping: {
                  value: d.cursorTrail.comet.chainDamping,
                  min: 1,
                  max: 600,
                  step: 1,
                  label: "Chain damping",
                  render: (get) =>
                    get("Rain.Cursor Trail.cursorTrailEnabled") === true &&
                    get("Rain.Cursor Trail.cursorTrailType") === "comet",
                },
                cometMaxLinkPx: {
                  value: d.cursorTrail.comet.maxLinkPx,
                  min: 2,
                  max: 200,
                  step: 1,
                  label: "Max link (px)",
                  render: (get) =>
                    get("Rain.Cursor Trail.cursorTrailEnabled") === true &&
                    get("Rain.Cursor Trail.cursorTrailType") === "comet",
                },
                cometHeadRadiusPx: {
                  value: d.cursorTrail.comet.headRadiusPx,
                  min: 0.5,
                  max: 60,
                  step: 0.1,
                  label: "Head radius (px)",
                  render: (get) =>
                    get("Rain.Cursor Trail.cursorTrailEnabled") === true &&
                    get("Rain.Cursor Trail.cursorTrailType") === "comet",
                },
                cometTailRadiusPx: {
                  value: d.cursorTrail.comet.tailRadiusPx,
                  min: 0,
                  max: 40,
                  step: 0.1,
                  label: "Tail radius (px)",
                  render: (get) =>
                    get("Rain.Cursor Trail.cursorTrailEnabled") === true &&
                    get("Rain.Cursor Trail.cursorTrailType") === "comet",
                },
                cometStretchThinning: {
                  value: d.cursorTrail.comet.stretchThinning,
                  min: 0,
                  max: 1,
                  step: 0.01,
                  label: "Stretch thinning",
                  render: (get) =>
                    get("Rain.Cursor Trail.cursorTrailEnabled") === true &&
                    get("Rain.Cursor Trail.cursorTrailType") === "comet",
                },
                cometSmoothUnionPx: {
                  value: d.cursorTrail.comet.smoothUnionPx,
                  min: 0.1,
                  max: 40,
                  step: 0.1,
                  label: "Smooth union (px)",
                  render: (get) =>
                    get("Rain.Cursor Trail.cursorTrailEnabled") === true &&
                    get("Rain.Cursor Trail.cursorTrailType") === "comet",
                },
                cometBodyBrightness: {
                  value: d.cursorTrail.comet.bodyBrightness,
                  min: 0,
                  max: 2,
                  step: 0.01,
                  label: "Body brightness",
                  render: (get) =>
                    get("Rain.Cursor Trail.cursorTrailEnabled") === true &&
                    get("Rain.Cursor Trail.cursorTrailType") === "comet",
                },
                cometAuraStrength: {
                  value: d.cursorTrail.comet.auraStrength,
                  min: 0,
                  max: 3,
                  step: 0.01,
                  label: "Aura strength",
                  render: (get) =>
                    get("Rain.Cursor Trail.cursorTrailEnabled") === true &&
                    get("Rain.Cursor Trail.cursorTrailType") === "comet",
                },
                cometBodyPushPx: {
                  value: d.cursorTrail.comet.bodyPushPx,
                  min: 0,
                  max: 60,
                  step: 0.5,
                  label: "Body push (px)",
                  render: (get) =>
                    get("Rain.Cursor Trail.cursorTrailEnabled") === true &&
                    get("Rain.Cursor Trail.cursorTrailType") === "comet",
                },
                cometPresenceRiseRate: {
                  value: d.cursorTrail.comet.presenceRiseRate,
                  min: 0.5,
                  max: 60,
                  step: 0.1,
                  label: "Presence rise rate",
                  render: (get) =>
                    get("Rain.Cursor Trail.cursorTrailEnabled") === true &&
                    get("Rain.Cursor Trail.cursorTrailType") === "comet",
                },
                cometPresenceFallRate: {
                  value: d.cursorTrail.comet.presenceFallRate,
                  min: 0.2,
                  max: 60,
                  step: 0.1,
                  label: "Presence fall rate",
                  render: (get) =>
                    get("Rain.Cursor Trail.cursorTrailEnabled") === true &&
                    get("Rain.Cursor Trail.cursorTrailType") === "comet",
                },
                cometEmberRatePerSec: {
                  value: d.cursorTrail.comet.emberRatePerSec,
                  min: 0,
                  max: 400,
                  step: 1,
                  label: "Ember rate (/s)",
                  render: (get) =>
                    get("Rain.Cursor Trail.cursorTrailEnabled") === true &&
                    get("Rain.Cursor Trail.cursorTrailType") === "comet" &&
                    get("Rain.Cursor Trail.cometEmbersEnabled") === true,
                },
                cometEmberMaxCount: {
                  value: d.cursorTrail.comet.emberMaxCount,
                  min: 1,
                  max: 512,
                  step: 1,
                  label: "Ember max count",
                  render: (get) =>
                    get("Rain.Cursor Trail.cursorTrailEnabled") === true &&
                    get("Rain.Cursor Trail.cursorTrailType") === "comet" &&
                    get("Rain.Cursor Trail.cometEmbersEnabled") === true,
                },
                cometEmberSizePx: {
                  value: d.cursorTrail.comet.emberSizePx,
                  min: 0.2,
                  max: 40,
                  step: 0.1,
                  label: "Ember size (px)",
                  render: (get) =>
                    get("Rain.Cursor Trail.cursorTrailEnabled") === true &&
                    get("Rain.Cursor Trail.cursorTrailType") === "comet" &&
                    get("Rain.Cursor Trail.cometEmbersEnabled") === true,
                },
                cometEmberSpeedMinPxPerSec: {
                  value: d.cursorTrail.comet.emberSpeedMinPxPerSec,
                  min: 0,
                  max: 2000,
                  step: 1,
                  label: "Ember speed min (px/s)",
                  render: (get) =>
                    get("Rain.Cursor Trail.cursorTrailEnabled") === true &&
                    get("Rain.Cursor Trail.cursorTrailType") === "comet" &&
                    get("Rain.Cursor Trail.cometEmbersEnabled") === true,
                },
                cometEmberSpeedMaxPxPerSec: {
                  value: d.cursorTrail.comet.emberSpeedMaxPxPerSec,
                  min: 0,
                  max: 2000,
                  step: 1,
                  label: "Ember speed max (px/s)",
                  render: (get) =>
                    get("Rain.Cursor Trail.cursorTrailEnabled") === true &&
                    get("Rain.Cursor Trail.cursorTrailType") === "comet" &&
                    get("Rain.Cursor Trail.cometEmbersEnabled") === true,
                },
                cometEmberSpreadRad: {
                  value: d.cursorTrail.comet.emberSpreadRad,
                  min: 0,
                  max: 3.14159,
                  step: 0.01,
                  label: "Ember spread (rad)",
                  render: (get) =>
                    get("Rain.Cursor Trail.cursorTrailEnabled") === true &&
                    get("Rain.Cursor Trail.cursorTrailType") === "comet" &&
                    get("Rain.Cursor Trail.cometEmbersEnabled") === true,
                },
                cometEmberLifetimeMinMs: {
                  value: d.cursorTrail.comet.emberLifetimeMinMs,
                  min: 60,
                  max: 20000,
                  step: 10,
                  label: "Ember lifetime min (ms)",
                  render: (get) =>
                    get("Rain.Cursor Trail.cursorTrailEnabled") === true &&
                    get("Rain.Cursor Trail.cursorTrailType") === "comet" &&
                    get("Rain.Cursor Trail.cometEmbersEnabled") === true,
                },
                cometEmberLifetimeMaxMs: {
                  value: d.cursorTrail.comet.emberLifetimeMaxMs,
                  min: 60,
                  max: 20000,
                  step: 10,
                  label: "Ember lifetime max (ms)",
                  render: (get) =>
                    get("Rain.Cursor Trail.cursorTrailEnabled") === true &&
                    get("Rain.Cursor Trail.cursorTrailType") === "comet" &&
                    get("Rain.Cursor Trail.cometEmbersEnabled") === true,
                },
                cometEmberBrightness: {
                  value: d.cursorTrail.comet.emberBrightness,
                  min: 0,
                  max: 4,
                  step: 0.05,
                  label: "Ember brightness",
                  render: (get) =>
                    get("Rain.Cursor Trail.cursorTrailEnabled") === true &&
                    get("Rain.Cursor Trail.cursorTrailType") === "comet" &&
                    get("Rain.Cursor Trail.cometEmbersEnabled") === true,
                },
                cometEmberFadeInFraction: {
                  value: d.cursorTrail.comet.emberFadeInFraction,
                  min: 0,
                  max: 0.9,
                  step: 0.01,
                  label: "Ember fade-in fraction",
                  render: (get) =>
                    get("Rain.Cursor Trail.cursorTrailEnabled") === true &&
                    get("Rain.Cursor Trail.cursorTrailType") === "comet" &&
                    get("Rain.Cursor Trail.cometEmbersEnabled") === true,
                },
                cometSeed: {
                  value: d.cursorTrail.comet.seed,
                  min: 0,
                  max: 100000000,
                  step: 1,
                  label: "Seed",
                  render: (get) =>
                    get("Rain.Cursor Trail.cursorTrailEnabled") === true &&
                    get("Rain.Cursor Trail.cursorTrailType") === "comet",
                },
              },
              { hideInClient: true, rainInClient: true },
            ),
            "Click Wave": drawerFolder(
              "Click Wave",
              {
                clickWaveEnabled: { value: d.clickWave.enabled, label: "Enabled" },
                clickWaveType: {
                  value: d.clickWave.type,
                  options: { Default: "default", Detonation: "detonation" } as const,
                  label: "Type",
                  render: (get) => get("Rain.Click Wave.clickWaveEnabled") === true,
                },
                clickWaveLifeMs: {
                  value: d.clickWave.lifeMs,
                  min: 80,
                  max: 10000,
                  step: 10,
                  label: "Life (ms)",
                  render: (get) =>
                    get("Rain.Click Wave.clickWaveEnabled") === true &&
                    get("Rain.Click Wave.clickWaveType") === "default",
                },
                clickWaveStartRadiusPx: {
                  value: d.clickWave.startRadiusPx,
                  min: 1,
                  max: 120,
                  step: 1,
                  label: "Start radius (px)",
                  render: (get) =>
                    get("Rain.Click Wave.clickWaveEnabled") === true &&
                    get("Rain.Click Wave.clickWaveType") === "default",
                },
                clickWaveMaxRadiusPx: {
                  value: d.clickWave.maxRadiusPx,
                  min: 4,
                  max: 600,
                  step: 2,
                  label: "Max radius (px)",
                  render: (get) =>
                    get("Rain.Click Wave.clickWaveEnabled") === true &&
                    get("Rain.Click Wave.clickWaveType") === "default",
                },
                clickWaveStartStrokeWidthPx: {
                  value: d.clickWave.startStrokeWidthPx,
                  min: 0.5,
                  max: 80,
                  step: 0.5,
                  label: "Start stroke (px)",
                  render: (get) =>
                    get("Rain.Click Wave.clickWaveEnabled") === true &&
                    get("Rain.Click Wave.clickWaveType") === "default",
                },
                clickWaveEndStrokeWidthPx: {
                  value: d.clickWave.endStrokeWidthPx,
                  min: 0.25,
                  max: 40,
                  step: 0.25,
                  label: "End stroke (px)",
                  render: (get) =>
                    get("Rain.Click Wave.clickWaveEnabled") === true &&
                    get("Rain.Click Wave.clickWaveType") === "default",
                },
                clickWaveMaxWaves: {
                  value: d.clickWave.maxWaves,
                  min: 1,
                  max: 32,
                  step: 1,
                  label: "Max waves",
                  render: (get) =>
                    get("Rain.Click Wave.clickWaveEnabled") === true &&
                    get("Rain.Click Wave.clickWaveType") === "default",
                },
                clickWavePushStrengthPx: {
                  value: d.clickWave.pushStrengthPx,
                  min: 0,
                  max: 200,
                  step: 1,
                  label: "Push strength (px)",
                  render: (get) =>
                    get("Rain.Click Wave.clickWaveEnabled") === true &&
                    get("Rain.Click Wave.clickWaveType") === "default",
                },
                clickWavePushBandScale: {
                  value: d.clickWave.pushBandScale,
                  min: 1,
                  max: 8,
                  step: 0.1,
                  label: "Push band scale",
                  render: (get) =>
                    get("Rain.Click Wave.clickWaveEnabled") === true &&
                    get("Rain.Click Wave.clickWaveType") === "default",
                },
                clickWaveStripeWhiteAlpha: {
                  value: d.clickWave.stripeWhiteAlpha,
                  min: 0,
                  max: 1,
                  step: 0.01,
                  label: "Stripe white alpha",
                  render: (get) =>
                    get("Rain.Click Wave.clickWaveEnabled") === true &&
                    get("Rain.Click Wave.clickWaveType") === "default",
                },
                detonationMaxConcurrent: {
                  value: d.clickWave.detonation.maxConcurrent,
                  min: 1,
                  max: 16,
                  step: 1,
                  label: "Max concurrent",
                  render: (get) =>
                    get("Rain.Click Wave.clickWaveEnabled") === true &&
                    get("Rain.Click Wave.clickWaveType") === "detonation",
                },
                detonationRingReachPx: {
                  value: d.clickWave.detonation.ringReachPx,
                  min: 8,
                  max: 1200,
                  step: 2,
                  label: "Ring reach (px)",
                  render: (get) =>
                    get("Rain.Click Wave.clickWaveEnabled") === true &&
                    get("Rain.Click Wave.clickWaveType") === "detonation",
                },
                detonationRingDurationMs: {
                  value: d.clickWave.detonation.ringDurationMs,
                  min: 40,
                  max: 8000,
                  step: 10,
                  label: "Ring duration (ms)",
                  render: (get) =>
                    get("Rain.Click Wave.clickWaveEnabled") === true &&
                    get("Rain.Click Wave.clickWaveType") === "detonation",
                },
                detonationRingThicknessPx: {
                  value: d.clickWave.detonation.ringThicknessPx,
                  min: 1,
                  max: 200,
                  step: 0.5,
                  label: "Ring thickness (px)",
                  render: (get) =>
                    get("Rain.Click Wave.clickWaveEnabled") === true &&
                    get("Rain.Click Wave.clickWaveType") === "detonation",
                },
                detonationRingRefractionPx: {
                  value: d.clickWave.detonation.ringRefractionPx,
                  min: 0,
                  max: 160,
                  step: 0.5,
                  label: "Ring refraction (px)",
                  render: (get) =>
                    get("Rain.Click Wave.clickWaveEnabled") === true &&
                    get("Rain.Click Wave.clickWaveType") === "detonation",
                },
                detonationFlashRadiusPx: {
                  value: d.clickWave.detonation.flashRadiusPx,
                  min: 1,
                  max: 400,
                  step: 1,
                  label: "Flash radius (px)",
                  render: (get) =>
                    get("Rain.Click Wave.clickWaveEnabled") === true &&
                    get("Rain.Click Wave.clickWaveType") === "detonation",
                },
                detonationFlashDurationMs: {
                  value: d.clickWave.detonation.flashDurationMs,
                  min: 8,
                  max: 2000,
                  step: 2,
                  label: "Flash duration (ms)",
                  render: (get) =>
                    get("Rain.Click Wave.clickWaveEnabled") === true &&
                    get("Rain.Click Wave.clickWaveType") === "detonation",
                },
                detonationFlashBrightness: {
                  value: d.clickWave.detonation.flashBrightness,
                  min: 0,
                  max: 4,
                  step: 0.05,
                  label: "Flash brightness",
                  render: (get) =>
                    get("Rain.Click Wave.clickWaveEnabled") === true &&
                    get("Rain.Click Wave.clickWaveType") === "detonation",
                },
                detonationDebrisCount: {
                  value: d.clickWave.detonation.debrisCount,
                  min: 0,
                  max: 96,
                  step: 1,
                  label: "Debris count",
                  render: (get) =>
                    get("Rain.Click Wave.clickWaveEnabled") === true &&
                    get("Rain.Click Wave.clickWaveType") === "detonation",
                },
                detonationDebrisSpeedPxPerSec: {
                  value: d.clickWave.detonation.debrisSpeedPxPerSec,
                  min: 10,
                  max: 4000,
                  step: 5,
                  label: "Debris speed (px/s)",
                  render: (get) =>
                    get("Rain.Click Wave.clickWaveEnabled") === true &&
                    get("Rain.Click Wave.clickWaveType") === "detonation",
                },
                detonationDebrisSpeedVariation: {
                  value: d.clickWave.detonation.debrisSpeedVariation,
                  min: 0,
                  max: 1,
                  step: 0.01,
                  label: "Debris speed variation",
                  render: (get) =>
                    get("Rain.Click Wave.clickWaveEnabled") === true &&
                    get("Rain.Click Wave.clickWaveType") === "detonation",
                },
                detonationDebrisDrag: {
                  value: d.clickWave.detonation.debrisDrag,
                  min: 0.05,
                  max: 12,
                  step: 0.05,
                  label: "Debris drag",
                  render: (get) =>
                    get("Rain.Click Wave.clickWaveEnabled") === true &&
                    get("Rain.Click Wave.clickWaveType") === "detonation",
                },
                detonationDebrisGravityPxPerSec2: {
                  value: d.clickWave.detonation.debrisGravityPxPerSec2,
                  min: 0,
                  max: 4000,
                  step: 10,
                  label: "Debris gravity (px/s2)",
                  render: (get) =>
                    get("Rain.Click Wave.clickWaveEnabled") === true &&
                    get("Rain.Click Wave.clickWaveType") === "detonation",
                },
                detonationDebrisLifetimeMs: {
                  value: d.clickWave.detonation.debrisLifetimeMs,
                  min: 60,
                  max: 10000,
                  step: 10,
                  label: "Debris lifetime (ms)",
                  render: (get) =>
                    get("Rain.Click Wave.clickWaveEnabled") === true &&
                    get("Rain.Click Wave.clickWaveType") === "detonation",
                },
                detonationDebrisLifetimeVariation: {
                  value: d.clickWave.detonation.debrisLifetimeVariation,
                  min: 0,
                  max: 1,
                  step: 0.01,
                  label: "Debris lifetime variation",
                  render: (get) =>
                    get("Rain.Click Wave.clickWaveEnabled") === true &&
                    get("Rain.Click Wave.clickWaveType") === "detonation",
                },
                detonationDebrisSizePx: {
                  value: d.clickWave.detonation.debrisSizePx,
                  min: 0.2,
                  max: 40,
                  step: 0.1,
                  label: "Debris size (px)",
                  render: (get) =>
                    get("Rain.Click Wave.clickWaveEnabled") === true &&
                    get("Rain.Click Wave.clickWaveType") === "detonation",
                },
                detonationDebrisBrightness: {
                  value: d.clickWave.detonation.debrisBrightness,
                  min: 0,
                  max: 4,
                  step: 0.05,
                  label: "Debris brightness",
                  render: (get) =>
                    get("Rain.Click Wave.clickWaveEnabled") === true &&
                    get("Rain.Click Wave.clickWaveType") === "detonation",
                },
                detonationCraterRadiusPx: {
                  value: d.clickWave.detonation.craterRadiusPx,
                  min: 4,
                  max: 1200,
                  step: 2,
                  label: "Crater radius (px)",
                  render: (get) =>
                    get("Rain.Click Wave.clickWaveEnabled") === true &&
                    get("Rain.Click Wave.clickWaveType") === "detonation",
                },
                detonationCraterDepth: {
                  value: d.clickWave.detonation.craterDepth,
                  min: 0,
                  max: 4,
                  step: 0.05,
                  label: "Crater depth",
                  render: (get) =>
                    get("Rain.Click Wave.clickWaveEnabled") === true &&
                    get("Rain.Click Wave.clickWaveType") === "detonation",
                },
                detonationCraterRelaxFastMs: {
                  value: d.clickWave.detonation.craterRelaxFastMs,
                  min: 20,
                  max: 10000,
                  step: 10,
                  label: "Crater relax fast (ms)",
                  render: (get) =>
                    get("Rain.Click Wave.clickWaveEnabled") === true &&
                    get("Rain.Click Wave.clickWaveType") === "detonation",
                },
                detonationCraterRelaxSlowMs: {
                  value: d.clickWave.detonation.craterRelaxSlowMs,
                  min: 20,
                  max: 20000,
                  step: 10,
                  label: "Crater relax slow (ms)",
                  render: (get) =>
                    get("Rain.Click Wave.clickWaveEnabled") === true &&
                    get("Rain.Click Wave.clickWaveType") === "detonation",
                },
                detonationCraterLifeMs: {
                  value: d.clickWave.detonation.craterLifeMs,
                  min: 100,
                  max: 20000,
                  step: 10,
                  label: "Crater life (ms)",
                  render: (get) =>
                    get("Rain.Click Wave.clickWaveEnabled") === true &&
                    get("Rain.Click Wave.clickWaveType") === "detonation",
                },
                detonationCraterRimStrength: {
                  value: d.clickWave.detonation.craterRimStrength,
                  min: 0,
                  max: 4,
                  step: 0.05,
                  label: "Crater rim strength",
                  render: (get) =>
                    get("Rain.Click Wave.clickWaveEnabled") === true &&
                    get("Rain.Click Wave.clickWaveType") === "detonation",
                },
                detonationSeed: {
                  value: d.clickWave.detonation.seed,
                  min: 0,
                  max: 1000000,
                  step: 1,
                  label: "Seed",
                  render: (get) =>
                    get("Rain.Click Wave.clickWaveEnabled") === true &&
                    get("Rain.Click Wave.clickWaveType") === "detonation",
                },
              },
              { hideInClient: true, rainInClient: true },
            ),
          },
          {
            defaultOpen: false,
            rainInClient: true,
          },
        ),
      }),
    { store: shaderStore },
    // Do NOT depend on client Default/Advanced — rebuilding the schema overrides
    // live Leva values and breaks saved layouts / panel toggles.
    [stripeKey, stripePaletteOptionsKey, stripePaletteValue],
  );
  shaderControlSetterRef.current = setShaderControl;

  const clientLayoutId = String(
    (shaderValues as unknown as Record<string, unknown>).clientLayout ??
      initialLabSettings.clientLayoutId ??
      DEFAULT_CLIENT_PREVIEW_STATE.layoutId,
  ) as ClientLayoutPresetId;
  const clientColorId = String(
    (shaderValues as unknown as Record<string, unknown>).clientColor ??
      initialLabSettings.clientColorId ??
      DEFAULT_CLIENT_PREVIEW_STATE.colorId,
  ) as ClientColorPresetId;
  const clientSizeId = String(
    (shaderValues as unknown as Record<string, unknown>).clientSize ??
      initialLabSettings.clientSizeId ??
      DEFAULT_CLIENT_PREVIEW_STATE.sizeId,
  ) as ClientSizePresetId;
  const clientAppearanceId = String(
    (shaderValues as unknown as Record<string, unknown>).clientAppearance ??
      initialLabSettings.clientAppearanceId ??
      DEFAULT_CLIENT_PREVIEW_STATE.appearanceId,
  ) as ClientAppearanceId;
  const heroGraphicId = String(
    (shaderValues as unknown as Record<string, unknown>).heroGraphic ?? levaSchemaSeedRef.current.clientHeroGraphic,
  ) as ClientGraphicMode;
  levaSchemaSeedRef.current.clientLayoutId = clientLayoutId;
  levaSchemaSeedRef.current.clientColorId = clientColorId;
  levaSchemaSeedRef.current.clientSizeId = clientSizeId;
  levaSchemaSeedRef.current.clientAppearanceId = clientAppearanceId;
  levaSchemaSeedRef.current.clientHeroGraphic = heroGraphicId;
  clientRainAuthoringActive = !clientApp || heroGraphicId === "rain" || heroGraphicId === "both";
  clientTwizzlerAuthoringActive = !clientApp || heroGraphicId === "twizzler" || heroGraphicId === "both";
  showSpiralShaderConfigRef.current = activeShaderConfig === "spiral" && (!clientApp || clientRainAuthoringActive);
  /**
   * Hero → Graphic drives Twizzler Show + Rain layer flags and rain-capable defaults.
   */
  const lastHeroGraphicIdRef = useRef<string | null>(null);
  const onClientGraphicModeChangeRef = useRef(options.onClientGraphicModeChange);
  onClientGraphicModeChangeRef.current = options.onClientGraphicModeChange;
  useEffect(() => {
    if (!clientApp) return;
    const prev = lastHeroGraphicIdRef.current;
    if (prev === heroGraphicId) return;
    lastHeroGraphicIdRef.current = heroGraphicId;
    const flags = clientGraphicFlags(heroGraphicId);
    const wasRain = prev === "rain" || prev === "both";
    const enteringRain = flags.rainEnabled && !wasRain;
    const patch: Record<string, unknown> = {
      twizzlerEnabled: flags.twizzlerEnabled,
      rainEnabled: flags.rainEnabled,
    };
    if (enteringRain) {
      // Keep a rain-capable shader selected; do not factory-reset or reload on Graphic change.
      patch.rainShaderPreset =
        String((shaderValues as unknown as Record<string, unknown>).rainShaderPreset || "").trim() ||
        CONNECT_SHADER_PRESET_ID;
    }
    shaderControlSetterRef.current?.(patch);
    onClientGraphicModeChangeRef.current?.(heroGraphicId);
    setShaderControl({});
    try {
      setTextureControl({});
    } catch {
      /* ignore */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only react to graphic mode changes
  }, [clientApp, heroGraphicId, setShaderControl, setTextureControl]);

  /** Keep Hero → Graphic in sync when Show/Rain flags change (Apply layout / Reset). */
  const rainEnabledFlag = Boolean((shaderValues as unknown as Record<string, unknown>).rainEnabled);
  const twizzlerEnabledFlag = Boolean((shaderValues as unknown as Record<string, unknown>).twizzlerEnabled);
  useEffect(() => {
    if (!clientApp) return;
    const derived = resolveClientGraphicMode(twizzlerEnabledFlag, rainEnabledFlag);
    if (derived === heroGraphicId) return;
    lastHeroGraphicIdRef.current = derived;
    levaSchemaSeedRef.current.clientHeroGraphic = derived;
    shaderControlSetterRef.current?.({ heroGraphic: derived });
  }, [clientApp, twizzlerEnabledFlag, rainEnabledFlag, heroGraphicId, setShaderControl]);

  /**
   * Layout preset — ribbon geometry + motion only.
   * Never touches Twizzler colors (those belong to Color / Appearance).
   * Size is handled separately via `clientCanvasSize` (canvas W/H only).
   */
  const lastClientLayoutIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (!clientApp) return;
    // Skip mount so restored saved-layout twizzler values are not clobbered.
    if (lastClientLayoutIdRef.current === null) {
      lastClientLayoutIdRef.current = clientLayoutId;
      return;
    }
    if (lastClientLayoutIdRef.current === clientLayoutId) return;
    lastClientLayoutIdRef.current = clientLayoutId;
    const tweaks = resetTweaksForLayout(clientLayoutId);
    const layout = findClientLayoutPreset(clientLayoutId).twizzler;
    const flags = clientGraphicFlags(heroGraphicId);
    const patch: Record<string, unknown> = {};
    if (flags.twizzlerEnabled) {
      Object.assign(patch, {
        twizzlerOpacity: tweaks.opacity,
        twizzlerScale: tweaks.scale,
        twizzlerTwist: tweaks.twist,
        twizzlerRotateXDeg: tweaks.rotateXDeg,
        twizzlerRotateYDeg: tweaks.rotateYDeg,
        twizzlerRotateZDeg: tweaks.rotateZDeg,
        twizzlerAmplitude: tweaks.amplitude,
        twizzlerCenterY: tweaks.centerY,
        twizzlerSpeed: tweaks.speed,
        ...(layout.depthSpread !== undefined ? { twizzlerDepthSpread: layout.depthSpread } : {}),
        ...(layout.depthLift !== undefined ? { twizzlerDepthLift: layout.depthLift } : {}),
        ...(layout.rightHeight !== undefined ? { twizzlerRightHeight: layout.rightHeight } : {}),
        ...(layout.leftHeight !== undefined ? { twizzlerLeftHeight: layout.leftHeight } : {}),
      });
    }
    if (flags.rainEnabled) Object.assign(patch, rainLevaFromLayout(clientLayoutId));
    if (Object.keys(patch).length === 0) return;
    try {
      textureControlSetterRef.current?.(patch);
    } catch {
      /* texture keys only */
    }
    shaderControlSetterRef.current?.(patch);
  }, [clientApp, clientLayoutId, heroGraphicId, setShaderControl]);

  /** Color preset — Twizzler family ink and/or original rain stripe palettes. */
  const lastClientColorIdRef = useRef<string | null>(null);
  const lastHeroGraphicForColorRef = useRef<string | null>(null);
  useEffect(() => {
    if (!clientApp) return;
    const colorChanged = lastClientColorIdRef.current !== null && lastClientColorIdRef.current !== clientColorId;
    const graphicChanged =
      lastHeroGraphicForColorRef.current !== null && lastHeroGraphicForColorRef.current !== heroGraphicId;
    if (lastClientColorIdRef.current === null) {
      lastClientColorIdRef.current = clientColorId;
      lastHeroGraphicForColorRef.current = heroGraphicId;
      return;
    }
    lastClientColorIdRef.current = clientColorId;
    lastHeroGraphicForColorRef.current = heroGraphicId;
    if (!colorChanged && !graphicChanged) return;
    const color = findClientColorPreset(clientColorId).twizzler;
    const flags = clientGraphicFlags(heroGraphicId);
    const patch: Record<string, unknown> = {};
    if (flags.twizzlerEnabled) {
      Object.assign(patch, {
        twizzlerColor: color.colorNear ?? color.color,
        twizzlerColorFar: color.colorFar,
        twizzlerColorEdge: color.colorEdge,
        twizzlerGradientStops: serializeTwizzlerGradientStops(
          defaultTwizzlerGradientFieldStops(color.colorFar, color.colorNear ?? color.color, color.colorEdge),
        ),
      });
    }
    if (flags.rainEnabled) {
      const rain = rainLevaFromColor(clientColorId);
      Object.assign(patch, rain);
      const palette = rain.stripePalette;
      if (typeof palette === "string") handlePaletteChange(palette);
    }
    if (Object.keys(patch).length === 0) return;
    try {
      textureControlSetterRef.current?.(patch);
    } catch {
      /* ignore */
    }
    shaderControlSetterRef.current?.(patch);
  }, [clientApp, clientColorId, handlePaletteChange, heroGraphicId, setShaderControl]);

  // Keep Color left/right knobs and the Field editor on the same endpoint colors
  // so Shared ↔ Baked doesn't drop hotspot positions or endpoint ink (CF-55 / CF-58).
  const shaderTwizzlerRecord = shaderValues as unknown as Record<string, unknown>;
  const twizzlerRibbonColorModeValue = shaderTwizzlerRecord.twizzlerRibbonColorMode;
  const twizzlerGradientStopsValue = shaderTwizzlerRecord.twizzlerGradientStops;
  const twizzlerColorValue = shaderTwizzlerRecord.twizzlerColor;
  const twizzlerColorFarValue = shaderTwizzlerRecord.twizzlerColorFar;
  useEffect(() => {
    const colorFar = String(twizzlerColorFarValue ?? "");
    const colorNear = String(twizzlerColorValue ?? "");
    const parsed = parseTwizzlerGradientStops(twizzlerGradientStopsValue, colorFar, colorNear);
    if (parsed.length === 0) return;
    if (twizzlerRibbonColorModeValue === "sharedGradient" || twizzlerRibbonColorModeValue === "fiberGradient") {
      const far = parsed[0]!.color;
      const near = parsed[parsed.length - 1]!.color;
      if (far === colorFar.toLowerCase() && near === colorNear.toLowerCase()) return;
      shaderControlSetterRef.current?.({ twizzlerColorFar: far, twizzlerColor: near });
      return;
    }
    const patched = withTwizzlerGradientEndpointColors(parsed, colorFar, colorNear);
    const serialized = serializeTwizzlerGradientStops(patched);
    if (serialized === twizzlerGradientStopsValue) return;
    shaderControlSetterRef.current?.({ twizzlerGradientStops: serialized });
  }, [twizzlerRibbonColorModeValue, twizzlerGradientStopsValue, twizzlerColorValue, twizzlerColorFarValue]);

  // Nudge the store when Default↔Advanced flips so Leva recomputes visible paths
  // (render gates read refs; without a store tick folders stay stale).
  useEffect(() => {
    if (!clientApp) return;
    setShaderControl({});
  }, [clientApp, clientPanelMode, setShaderControl]);

  useEffect(() => {
    setTextureControl({});
    setShaderControl({});
  }, [
    activeShaderConfig,
    showShaderCamera,
    showConnectCamera,
    showTwizzlerRibbon,
    setTextureControl,
    setShaderControl,
  ]);

  const values = { ...textureValues, ...shaderValues };
  const imageColorsMode = values.colorsMode === "colors";
  const stripeTableKey = `${stripeKey}|colorMode:${imageColorsMode ? "image-colors" : "luminance"}`;
  stripeColorsTableRuntime.showColorControls = !imageColorsMode;
  stripeColorsTableRuntime.showSavePalette = !imageColorsMode && stripePaletteValue === "Custom";
  stripeColorsTableRuntime.showRampEasing =
    !imageColorsMode &&
    (stripePaletteValue === BACKGROUND_RAMP_PALETTE_NAME || stripePaletteValue === WHITE_STRIPE_PALETTE_NAME);
  const currentBackgroundRampSettings = normalizeBackgroundRampSettings({
    brightnessAdd: values.backgroundRampBrightnessAdd,
    hueDriftDeg: values.backgroundRampHueDriftDeg,
    saturationBoost: values.backgroundRampSaturationBoost,
  });
  const currentBackgroundRampSettingsKey = JSON.stringify(currentBackgroundRampSettings);
  backgroundRampSettingsRef.current = currentBackgroundRampSettings;
  const setControl = useCallback(
    (next: Record<string, unknown>) => {
      try {
        setTextureControl(next);
      } catch {
        // Some programmatic updates target only the shader panel.
      }
      try {
        setShaderControl(next);
      } catch {
        // Some programmatic updates target only the texture panel.
      }
    },
    [setTextureControl, setShaderControl],
  );

  const lastClientAppearanceRef = useRef<string | null>(null);
  useEffect(() => {
    if (!clientApp) return;
    // Skip mount so restored Dark layouts keep their ink/bg.
    if (lastClientAppearanceRef.current === null) {
      lastClientAppearanceRef.current = clientAppearanceId;
      return;
    }
    if (lastClientAppearanceRef.current === clientAppearanceId) return;
    lastClientAppearanceRef.current = clientAppearanceId;
    const appearance = findClientAppearancePreset(clientAppearanceId);
    levaSchemaSeedRef.current.clientAppearanceId = appearance.id;
    levaSchemaSeedRef.current.backgroundHex = appearance.backgroundHex;
    lastStickyBackgroundRef.current = appearance.backgroundHex;
    setBackgroundHex(appearance.backgroundHex);
    const flags = clientGraphicFlags(heroGraphicId);
    const patch: Record<string, unknown> = {
      backgroundFillMode: "solid",
      backgroundColor: appearance.backgroundHex,
    };
    if (flags.twizzlerEnabled) {
      Object.assign(patch, {
        twizzlerColor: appearance.twizzler.colorNear,
        twizzlerColorFar: appearance.twizzler.colorFar,
        twizzlerColorEdge: appearance.twizzler.colorEdge,
        twizzlerRibbonColorMode: appearance.ribbonColorMode,
        twizzlerGradientStops: serializeTwizzlerGradientStops(
          defaultTwizzlerGradientFieldStops(
            appearance.twizzler.colorFar,
            appearance.twizzler.colorNear,
            appearance.twizzler.colorEdge,
          ),
        ),
      });
    }
    if (flags.rainEnabled) Object.assign(patch, rainLevaFromAppearance(clientAppearanceId));
    setControl(patch);
  }, [clientApp, clientAppearanceId, heroGraphicId, setControl]);

  useEffect(() => {
    setShaderControl({ stripeColorsTable: stripeTableKey });
  }, [setShaderControl, stripeTableKey]);

  useEffect(() => {
    setBackgroundRampSettings((prev) =>
      JSON.stringify(prev) === currentBackgroundRampSettingsKey ? prev : currentBackgroundRampSettings,
    );
  }, [currentBackgroundRampSettings, currentBackgroundRampSettingsKey]);

  controlSetterRef.current = setShaderControl as (next: { backgroundColor?: string | null }) => void;
  backgroundColorRef.current = normalizeHexString(values.backgroundColor, backgroundHex) ?? backgroundHex;

  useEffect(() => {
    const next = normalizeHexString(values.backgroundColor);
    if (next === null) {
      if (lastStickyBackgroundRef.current === null) return;
      lastStickyBackgroundRef.current = null;
      levaSchemaSeedRef.current.backgroundHex = null;
      setBackgroundHex(null);
      return;
    }
    if (lastStickyBackgroundRef.current?.toLowerCase() === next.toLowerCase()) return;
    lastStickyBackgroundRef.current = next;
    levaSchemaSeedRef.current.backgroundHex = next;
    setBackgroundHex(next);
    if (!surfaceConfig) saveStickyBackgroundColor(hexToInt(next));
    const palette = activeGeneratedPaletteRef.current ?? stripePaletteValueRef.current;
    if (palette === BACKGROUND_RAMP_PALETTE_NAME) {
      setStripes((prev) =>
        applyStripePalette(
          prev,
          BACKGROUND_RAMP_PALETTE_NAME,
          next,
          backgroundRampEasingRef.current,
          backgroundRampSettingsRef.current,
        ),
      );
      return;
    }
    if (
      palette &&
      palette !== "Custom" &&
      palette !== WHITE_STRIPE_PALETTE_NAME &&
      !findCustomStripePalette(customStripePalettes, palette)
    ) {
      setStripes((prev) =>
        applyStripePalette(prev, palette, next, backgroundRampEasingRef.current, backgroundRampSettingsRef.current),
      );
    }
  }, [customStripePalettes, surfaceConfig, values.backgroundColor]);

  const baseStripes = fromEditable(stripes);
  const backgroundFillModeRaw =
    values.backgroundFillMode === "gradient" ||
    values.backgroundFillMode === "solid" ||
    values.backgroundFillMode === "transparent"
      ? (values.backgroundFillMode as BackgroundFillMode)
      : d.background.transparent
        ? "transparent"
        : d.background.gradient.enabled
          ? "gradient"
          : "solid";
  const backgroundFillMode = backgroundFillModeRaw;
  const sourcePreviewOpacity = Math.max(0, Math.min(1, Number(values.backgroundSourceOpacity ?? 0) / 100));
  const effectiveColorsMode = values.colorsMode === "colors" ? "colors" : "luminance";
  backgroundFillModeRef.current = backgroundFillMode;
  const normalizedBackgroundColor = normalizeHexString(values.backgroundColor, backgroundHex);
  const activeGradientStopCount = Math.max(2, Math.min(4, Math.round(Number(values.backgroundGradientStopCount) || 2)));
  const backgroundRampBaseHex =
    backgroundFillMode === "gradient"
      ? (mixHexColors(
          [
            values.backgroundGradientStop0 as string,
            values.backgroundGradientStop1 as string,
            values.backgroundGradientStop2 as string,
            values.backgroundGradientStop3 as string,
          ].slice(0, activeGradientStopCount),
        ) ?? normalizedBackgroundColor)
      : normalizedBackgroundColor;
  backgroundRampBaseHexRef.current = backgroundRampBaseHex;

  useEffect(() => {
    if (activeGeneratedPalette !== BACKGROUND_RAMP_PALETTE_NAME) return;
    setStripes((prev) =>
      applyStripePalette(
        prev,
        BACKGROUND_RAMP_PALETTE_NAME,
        backgroundRampBaseHex,
        backgroundRampEasing,
        currentBackgroundRampSettings,
      ),
    );
  }, [
    activeGeneratedPalette,
    backgroundRampBaseHex,
    backgroundRampEasing,
    currentBackgroundRampSettingsKey,
    stripes.length,
  ]);

  const lastAutomatedBackgroundFillModeRef = useRef<BackgroundFillMode | null>(null);

  useEffect(() => {
    if (lastAutomatedBackgroundFillModeRef.current === null) {
      lastAutomatedBackgroundFillModeRef.current = backgroundFillMode;
      return;
    }
    if (lastAutomatedBackgroundFillModeRef.current === backgroundFillMode) return;
    lastAutomatedBackgroundFillModeRef.current = backgroundFillMode;

    const palette = paletteForBackgroundFillMode(backgroundFillMode);
    setPreShuffleStripes(null);
    setActiveGeneratedPalette(palette);
    setStripes((prev) =>
      applyPaletteForBackgroundFillMode(
        prev,
        backgroundFillMode,
        backgroundRampBaseHexRef.current,
        backgroundRampEasingRef.current,
        backgroundRampSettingsRef.current,
      ),
    );
    setControl({
      colorsMode: "luminance",
      ...(palette === WHITE_STRIPE_PALETTE_NAME ? { stripeBlendMode: "normal" } : {}),
    });
  }, [backgroundFillMode, setControl]);

  const getLabSettingsSnapshot = useCallback(
    (): Partial<LabSettings> => ({
      textureId,
      backgroundFillMode,
      backgroundSourceOpacity: sourcePreviewOpacity,
      stripePalette: stripePaletteValue,
      backgroundRampEasing,
      backgroundRampSettings: {
        ...initialLabSettings.backgroundRampSettings,
        ...currentBackgroundRampSettings,
      },
      thresholdDistributionEasing,
      autoStripeWidths,
      drawerOpen: loadControlDrawerSnapshot(),
      ...(clientApp
        ? {
            clientSizeId,
            clientLayoutId,
            clientColorId,
            clientAppearanceId,
          }
        : {}),
    }),
    [
      autoStripeWidths,
      backgroundFillMode,
      backgroundRampEasing,
      clientApp,
      clientAppearanceId,
      clientColorId,
      clientLayoutId,
      clientSizeId,
      currentBackgroundRampSettingsKey,
      sourcePreviewOpacity,
      stripePaletteValue,
      textureId,
      thresholdDistributionEasing,
    ],
  );
  const config = normalizeEngineConfig({
    adjustments: {
      brightness: values.brightness,
      exposure: values.exposure,
      contrast: values.contrast,
      blackPoint: values.blackPoint,
      whitePoint: values.whitePoint,
      gamma: values.gamma,
      invert: effectiveColorsMode === "colors" ? false : values.invert,
      posterizeLevels: values.posterizeLevels,
      thresholdBias: values.thresholdBias,
      noiseAmount: values.noiseAmount,
      blurRadius: values.blurRadius,
      sharpenAmount: values.sharpenAmount,
    },
    transform: {
      fit: values.fit,
      zoom: values.zoom,
      panX: values.panX,
      panY: values.panY,
    },
    background: {
      color: hexToInt(normalizedBackgroundColor ?? intToHex(d.background.color)),
      transparent:
        backgroundFillMode === "transparent" || (backgroundFillMode === "solid" && normalizedBackgroundColor === null),
      gradient: {
        enabled: backgroundFillMode === "gradient",
        direction: values.backgroundGradientDirection,
        stopCount: values.backgroundGradientStopCount,
        stops: [
          hexToInt(values.backgroundGradientStop0),
          hexToInt(values.backgroundGradientStop1),
          hexToInt(values.backgroundGradientStop2),
          hexToInt(values.backgroundGradientStop3),
        ],
        hueDriftDeg: d.background.gradient.hueDriftDeg,
        saturationBoost: d.background.gradient.saturationBoost,
      },
      grid: {
        enabled: d.background.grid.enabled,
        cellWidth: d.background.grid.cellWidth,
        cellHeight: d.background.grid.cellHeight,
        gapX: d.background.grid.gapX,
        gapY: d.background.grid.gapY,
        cornerRadius: d.background.grid.cornerRadius,
        color: d.background.grid.color,
        opacity: d.background.grid.opacity,
      },
      stars: {
        enabled: values.backgroundStarsEnabled,
        density: values.backgroundStarsDensity,
        sizePx: values.backgroundStarsSizePx,
        sizeRandomness: values.backgroundStarsSizeRandomness,
        tiltAngleDeg: values.backgroundStarsTiltAngleDeg,
        twinkleSpeed: values.backgroundStarsTwinkleSpeed,
        twinkleAmount: values.backgroundStarsTwinkleAmount,
        opacity: values.backgroundStarsOpacity,
        color: hexToInt(values.backgroundStarsColor),
      },
      meteors: {
        enabled: values.backgroundMeteorsEnabled,
        ratePerSec: values.backgroundMeteorsRatePerSec,
        maxActive: values.backgroundMeteorsMaxActive,
        radiantAngleDeg: values.backgroundMeteorsRadiantAngleDeg,
        angleJitterDeg: values.backgroundMeteorsAngleJitterDeg,
        speedScale: values.backgroundMeteorsSpeedScale,
        speedVariation: values.backgroundMeteorsSpeedVariation,
        tailLengthScale: values.backgroundMeteorsTailLengthScale,
        tailLengthVariation: values.backgroundMeteorsTailLengthVariation,
        thicknessScale: values.backgroundMeteorsThicknessScale,
        thicknessVariation: values.backgroundMeteorsThicknessVariation,
        lifetimeMinMs: values.backgroundMeteorsLifetimeMinMs,
        lifetimeMaxMs: values.backgroundMeteorsLifetimeMaxMs,
        brightness: values.backgroundMeteorsBrightness,
        headGlow: values.backgroundMeteorsHeadGlow,
        pushPx: values.backgroundMeteorsPushPx,
        pushFalloffScale: values.backgroundMeteorsPushFalloffScale,
        fadeInMs: values.backgroundMeteorsFadeInMs,
        fadeOutMs: values.backgroundMeteorsFadeOutMs,
        seed: values.backgroundMeteorsSeed,
      },
    },
    grid: {
      cellWidth: values.cellWidth,
      cellHeight: values.cellHeight,
      gapX: values.gapX,
      gapY: values.gapY,
      cornerRadius: values.cornerRadius,
      orientation: values.orientationStackMode,
      angleDeg: values.orientationAngleDeg,
      rotationMode: values.orientationRotationMode === "overlap" ? "overlap" : "cell",
      overlapAmount: values.orientationOverlapAmount,
      streamGapWave: {
        enabled: values.streamGapWaveEnabled,
        squeeze: values.streamGapWaveSqueeze,
        wavelengthCells: values.streamGapWaveWavelengthCells,
        speed: values.streamGapWaveSpeed,
        phaseDeg: values.streamGapWavePhaseDeg,
      },
    },
    stripesEnabled: values.stripesEnabled,
    renderMode: d.renderMode,
    renderIntensity: d.renderIntensity,
    renderParams: d.renderParams,
    renderColorA: d.renderColorA,
    renderColorB: d.renderColorB,
    fieldScale: values.textureDpr,
    stripes: baseStripes,
    stripeDots: {
      enabled: values.stripeDotsEnabled,
      density: values.stripeDotsDensity / 100,
      randomVisibility: values.stripeDotsRandomVisibility / 100,
      sizePx: values.stripeDotsSizePx,
      brightness: values.stripeDotsBrightness / 100,
      hueDriftDeg: values.stripeDotsHueDriftDeg,
      saturationBoost: values.stripeDotsSaturationBoost / 100,
    },
    stripeBorder: {
      enabled: values.stripeBorderEnabled,
      minWidthPx: values.stripeBorderMinWidthPx,
      density: values.stripeBorderDensity / 100,
    },
    gridLines: {
      enabled: values.gridLinesEnabled,
      brightness: values.gridLinesBrightness / 100,
      density: values.gridLinesDensity / 100,
    },
    frames: {
      enabled: values.framesEnabled,
      luminanceThreshold: values.framesLuminanceThreshold / 100,
      highlightedStripeCount: values.framesHighlightedStripeCount,
      groupDistanceCells: values.framesGroupDistanceCells,
      color: hexToInt(values.framesColor),
      fontSizePx: values.framesFontSizePx,
      coordinateColor: hexToInt(values.framesCoordinateColor),
    },
    reveal: {
      enabled: d.reveal.enabled,
      type: values.revealType,
      wave: {
        position: values.revealPosition,
        durationMs: values.revealDurationMs,
        softness: values.revealSoftness,
        waviness: values.revealWaviness,
      },
      assembly: {
        sliceSizePx: values.revealSliceSizePx,
        scatterPx: values.revealScatterPx,
        angleJitterDeg: values.revealAngleJitterDeg,
        speedMinMs: values.revealSpeedMinMs,
        speedMaxMs: values.revealSpeedMaxMs,
        staggerMs: values.revealStaggerMs,
      },
      turbulence: {
        speedMinMs: values.revealTurbSpeedMinMs,
        speedMaxMs: values.revealTurbSpeedMaxMs,
        staggerMs: values.revealTurbStaggerMs,
        intensity: values.revealTurbIntensity,
        detail: values.revealTurbDetail,
        glow: values.revealTurbGlow,
      },
      glitch: {
        speedMinMs: values.revealGlitchSpeedMinMs,
        speedMaxMs: values.revealGlitchSpeedMaxMs,
        staggerMs: values.revealGlitchStaggerMs,
        intensity: values.revealGlitchIntensity,
        detail: values.revealGlitchDetail,
        glow: values.revealGlitchGlow,
      },
      vortex: {
        speedMinMs: values.revealVorSpeedMinMs,
        speedMaxMs: values.revealVorSpeedMaxMs,
        staggerMs: values.revealVorStaggerMs,
        intensity: values.revealVorIntensity,
        detail: values.revealVorDetail,
        glow: values.revealVorGlow,
        swirl: values.revealVorSwirl,
      },
      blackhole: {
        speedMinMs: values.revealBhSpeedMinMs,
        speedMaxMs: values.revealBhSpeedMaxMs,
        staggerMs: values.revealBhStaggerMs,
        intensity: values.revealBhIntensity,
        detail: values.revealBhDetail,
        glow: values.revealBhGlow,
        swirl: values.revealBhSwirl,
        formMs: values.revealBhFormMs,
        collapseMs: values.revealBhCollapseMs,
        arms: values.revealBhArms,
        lensing: values.revealBhLensing,
        horizon: values.revealBhHorizon,
      },
      whirlpool: {
        durationMs: values.revealWpDurationMs,
        turns: values.revealWpTurns,
        tightness: values.revealWpTightness,
        streak: values.revealWpStreak,
        glow: values.revealWpGlow,
      },
      water: {
        durationMs: values.revealWaterDurationMs,
        settleMs: values.revealWaterSettleMs,
        rows: values.revealWaterRows,
        intensity: values.revealWaterIntensity,
        wobble: values.revealWaterWobble,
        refraction: values.revealWaterRefraction,
        softness: values.revealWaterSoftness,
      },
    },
    sparkle: {
      gaps: {
        enabled: clientApp
          ? Boolean((shaderValues as unknown as Record<string, unknown>).rainEnabled)
          : d.sparkle.gaps.enabled,
        coverage: Math.max(
          0,
          Math.min(
            1,
            Number(
              (shaderValues as unknown as Record<string, unknown>).sparkleGapsCoverage ?? d.sparkle.gaps.coverage * 100,
            ) / 100,
          ),
        ),
        speed: Math.max(
          0.05,
          Number((shaderValues as unknown as Record<string, unknown>).sparkleGapsSpeed ?? d.sparkle.gaps.speed),
        ),
      },
      stripe: {
        enabled: values.sparkleStripeEnabled,
        coverage: values.sparkleStripeCoverage / 100,
        thickestCount: values.sparkleStripeThickestCount,
        maxBrightness: values.sparkleStripeMaxBrightness / 100,
        speed: values.sparkleStripeSpeed,
        hueDriftDeg: values.sparkleStripeHueDriftDeg,
        saturationBoost: values.sparkleStripeSaturationBoost / 100,
      },
      width: {
        enabled: values.sparkleWidthEnabled,
        coverage: values.sparkleWidthCoverage,
        swingPx: values.sparkleWidthSwingPx,
        swingPeriodMin: values.sparkleWidthSwingPeriodMin,
        swingPeriodMax: values.sparkleWidthSwingPeriodMax,
      },
      motion: {
        enabled: values.sparkleMotionEnabled,
        amplitudePx: values.sparkleMotionAmplitudePx,
        staggerPx: values.sparkleMotionStaggerPx,
        maxOffsetPx: values.sparkleMotionMaxOffsetPx,
        speed: values.sparkleMotionSpeed,
        direction: values.sparkleMotionDirection,
      },
    },
    letters: {
      enabled: values.lettersEnabled,
      mode: values.lettersMode,
      colorMode: values.lettersColorMode,
      color: values.lettersColorMode === "colorful" ? boostedBrightestStripeColor(baseStripes) : 0xffffff,
      coverage: values.coverage,
      positionX: values.lettersPositionX,
      positionY: values.lettersPositionY,
      areaWidth: values.lettersAreaWidth,
      areaHeight: values.lettersAreaHeight,
      text: values.lettersText,
      textCopies: values.lettersTextCopies,
      fontFamily: values.lettersFontFamily,
      sizeScale: values.sizeScale,
      shuffleSpeed: values.shuffleSpeed,
    },
    flames: {
      enabled: values.flamesEnabled,
      direction: values.flamesDirection,
      minWidthRatio: values.flamesMinWidthPct / 100,
      maxWidthRatio: values.flamesMaxWidthPct / 100,
      minHeightRatio: values.flamesMinHeightPct / 100,
      maxHeightRatio: values.flamesMaxHeightPct / 100,
      baseSpeedPxPerSec: values.flamesBaseSpeed,
      speedVariation: values.flamesSpeedVariation,
      spawnIntervalMs: values.flamesSpawnInterval,
      spawnJitterMs: values.flamesSpawnJitter,
      maxActive: values.flamesMaxActive,
      edgeSharpness: values.flamesEdgeSharpness,
      opacityMin: values.flamesOpacityMin,
      opacityMax: values.flamesOpacityMax,
      vortexSingular: {
        segCount: values.flamesVsSegCount,
        segSpacingPx: values.flamesVsSegSpacing,
        turnRate: values.flamesVsTurnRate,
        turnVariation: values.flamesVsTurnVariation,
        visibleMinMs: values.flamesVsVisibleMinSec * 1000,
        visibleMaxMs: values.flamesVsVisibleMaxSec * 1000,
        hiddenMinMs: values.flamesVsHiddenMinSec * 1000,
        hiddenMaxMs: values.flamesVsHiddenMaxSec * 1000,
        lifeMinMs: values.flamesVsLifeMinSec * 1000,
        lifeMaxMs: values.flamesVsLifeMaxSec * 1000,
        edgeMarginRatio: values.flamesVsEdgeMargin,
      },
    },
    edgeMask: {
      enabled: values.edgeMaskEnabled,
      start: values.edgeMaskStart,
      end: values.edgeMaskEnd,
      power: values.edgeMaskPower,
      sides: edgeMaskSidesFromPreset(values.edgeMaskSides, {
        top: values.edgeMaskSideTop,
        right: values.edgeMaskSideRight,
        bottom: values.edgeMaskSideBottom,
        left: values.edgeMaskSideLeft,
      }),
    },
    cursorTrail: {
      enabled: values.cursorTrailEnabled,
      type: values.cursorTrailType,
      particleRadius: values.particleRadius,
      particleAlpha: values.particleAlpha,
      particleLifeMs: values.particleLifeMs,
      particleLifeJitterMs: d.cursorTrail.particleLifeJitterMs,
      emitterVelocitySmoothing: d.cursorTrail.emitterVelocitySmoothing,
      particleVelocityScale: d.cursorTrail.particleVelocityScale,
      particleTangentVelocity: d.cursorTrail.particleTangentVelocity,
      particleDamping: d.cursorTrail.particleDamping,
      particleSpacingPx: values.particleSpacingPx,
      maxEmitPerTick: values.maxEmitPerTick,
      spreadMinPx: values.spreadMinPx,
      spreadMaxPx: values.spreadMaxPx,
      spinStrength: values.spinStrength,
      densityRadiusMinScale: d.cursorTrail.densityRadiusMinScale,
      densityRadiusLifeScale: d.cursorTrail.densityRadiusLifeScale,
      pushRadiusScale: values.pushRadiusScale,
      pushStrengthPx: values.pushStrengthPx,
      pushLagPx: d.cursorTrail.pushLagPx,
      pushWobblePx: values.pushWobblePx,
      pushLeadBlackAlpha: d.cursorTrail.pushLeadBlackAlpha,
      constellation: {
        radiusScale: values.constellationRadiusScale,
        starDensity: values.constellationStarDensity,
        starSizePx: values.constellationStarSizePx,
        starSizeRandomness: values.constellationStarSizeRandomness,
        starGrowScale: values.constellationStarGrowScale,
        starPushPx: values.constellationStarPushPx,
        twinkleAmount: values.constellationTwinkleAmount,
        twinkleSpeed: values.constellationTwinkleSpeed,
        linkThicknessPx: values.constellationLinkThicknessPx,
        linkBrightness: values.constellationLinkBrightness,
        linkGrooveDepth: values.constellationLinkGrooveDepth,
        linkShearPx: values.constellationLinkShearPx,
        linkMaxDistScale: values.constellationLinkMaxDistScale,
        linkFormMs: values.constellationLinkFormMs,
        linkHoldMs: values.constellationLinkHoldMs,
        linkDissolveMs: values.constellationLinkDissolveMs,
        maxLinks: values.constellationMaxLinks,
        maxStars: values.constellationMaxStars,
        pulseEnabled: values.constellationPulseEnabled,
        pulseDurationMs: values.constellationPulseDurationMs,
        pulseCoreLenPx: values.constellationPulseCoreLenPx,
        pulseTailLenPx: values.constellationPulseTailLenPx,
        pulseBrightness: values.constellationPulseBrightness,
        pulseRelayHops: values.constellationPulseRelayHops,
        pulseCooldownMs: values.constellationPulseCooldownMs,
        flareMs: values.constellationFlareMs,
        flareScale: values.constellationFlareScale,
        polygonFlashEnabled: values.constellationPolygonFlashEnabled,
        polygonFlashStrength: values.constellationPolygonFlashStrength,
      },
      comet: {
        nodeCount: values.cometNodeCount,
        headStiffness: values.cometHeadStiffness,
        headDamping: values.cometHeadDamping,
        chainStiffness: values.cometChainStiffness,
        chainDamping: values.cometChainDamping,
        maxLinkPx: values.cometMaxLinkPx,
        headRadiusPx: values.cometHeadRadiusPx,
        tailRadiusPx: values.cometTailRadiusPx,
        stretchThinning: values.cometStretchThinning,
        smoothUnionPx: values.cometSmoothUnionPx,
        bodyBrightness: values.cometBodyBrightness,
        auraStrength: values.cometAuraStrength,
        bodyPushPx: values.cometBodyPushPx,
        presenceRiseRate: values.cometPresenceRiseRate,
        presenceFallRate: values.cometPresenceFallRate,
        emberRatePerSec: values.cometEmberRatePerSec,
        emberMaxCount: values.cometEmberMaxCount,
        emberSizePx: values.cometEmberSizePx,
        emberSpeedMinPxPerSec: values.cometEmberSpeedMinPxPerSec,
        emberSpeedMaxPxPerSec: values.cometEmberSpeedMaxPxPerSec,
        emberSpreadRad: values.cometEmberSpreadRad,
        emberLifetimeMinMs: values.cometEmberLifetimeMinMs,
        emberLifetimeMaxMs: values.cometEmberLifetimeMaxMs,
        emberBrightness: values.cometEmberBrightness,
        emberFadeInFraction: values.cometEmberFadeInFraction,
        seed: values.cometSeed,
        embersEnabled: values.cometEmbersEnabled,
      },
    },
    clickWave: {
      enabled: values.clickWaveEnabled,
      type: values.clickWaveType as EngineConfig["clickWave"]["type"],
      lifeMs: values.clickWaveLifeMs,
      startRadiusPx: values.clickWaveStartRadiusPx,
      maxRadiusPx: values.clickWaveMaxRadiusPx,
      startStrokeWidthPx: values.clickWaveStartStrokeWidthPx,
      endStrokeWidthPx: values.clickWaveEndStrokeWidthPx,
      maxWaves: values.clickWaveMaxWaves,
      pushStrengthPx: values.clickWavePushStrengthPx,
      pushBandScale: values.clickWavePushBandScale,
      stripeWhiteAlpha: values.clickWaveStripeWhiteAlpha,
      detonation: {
        maxConcurrent: values.detonationMaxConcurrent,
        ringReachPx: values.detonationRingReachPx,
        ringDurationMs: values.detonationRingDurationMs,
        ringThicknessPx: values.detonationRingThicknessPx,
        ringRefractionPx: values.detonationRingRefractionPx,
        flashRadiusPx: values.detonationFlashRadiusPx,
        flashDurationMs: values.detonationFlashDurationMs,
        flashBrightness: values.detonationFlashBrightness,
        debrisCount: values.detonationDebrisCount,
        debrisSpeedPxPerSec: values.detonationDebrisSpeedPxPerSec,
        debrisSpeedVariation: values.detonationDebrisSpeedVariation,
        debrisDrag: values.detonationDebrisDrag,
        debrisGravityPxPerSec2: values.detonationDebrisGravityPxPerSec2,
        debrisLifetimeMs: values.detonationDebrisLifetimeMs,
        debrisLifetimeVariation: values.detonationDebrisLifetimeVariation,
        debrisSizePx: values.detonationDebrisSizePx,
        debrisBrightness: values.detonationDebrisBrightness,
        craterRadiusPx: values.detonationCraterRadiusPx,
        craterDepth: values.detonationCraterDepth,
        craterRelaxFastMs: values.detonationCraterRelaxFastMs,
        craterRelaxSlowMs: values.detonationCraterRelaxSlowMs,
        craterLifeMs: values.detonationCraterLifeMs,
        craterRimStrength: values.detonationCraterRimStrength,
        seed: values.detonationSeed,
      },
    },
    colors: {
      mode: effectiveColorsMode,
      stripeBlendMode: values.stripeBlendMode,
      imageColorLightness: Math.max(-1, Math.min(1, Number(values.imageColorLightness ?? 0) / 100)),
      imageColorDensity: Math.max(0, Math.min(1, Number(values.imageColorDensity ?? 100) / 100)),
      imageColorRemoveThin: Math.max(0, Math.min(0.95, Number(values.imageColorRemoveThin ?? 0))),
      imageColorBoostThick: Math.max(0, Math.min(2, Number(values.imageColorBoostThick ?? 0))),
      autoDetectBackground: effectiveColorsMode === "colors" ? false : d.colors.autoDetectBackground,
      backgroundColor:
        effectiveColorsMode === "colors"
          ? (values.imageColorWidthSource as ImageColorWidthSource) === "dark"
            ? 0xffffff
            : 0x000000
          : d.colors.backgroundColor,
      gradient:
        backgroundFillMode === "gradient" && stripePaletteValue === BACKGROUND_RAMP_PALETTE_NAME
          ? {
              enabled: true,
              direction: values.backgroundGradientDirection,
              stopCount: values.backgroundGradientStopCount,
              stops: [
                hexToInt(values.backgroundGradientStop0),
                hexToInt(values.backgroundGradientStop1),
                hexToInt(values.backgroundGradientStop2),
                hexToInt(values.backgroundGradientStop3),
              ] as [number, number, number, number],
              hueDriftDeg: currentBackgroundRampSettings.hueDriftDeg,
              saturationBoost: currentBackgroundRampSettings.saturationBoost / 100,
            }
          : { ...d.colors.gradient, enabled: false },
    },
  });
  const shaderValueRecord = shaderValues as unknown as Record<string, unknown>;

  return {
    config,
    backgroundFillMode,
    backgroundSourceOpacity: sourcePreviewOpacity,
    initialThemed,
    setControl,
    getLabSettingsSnapshot,
    textureId,
    setTextureId,
    textureOptions,
    textureStore,
    shaderStore,
    connectCamera: showConnectCamera
      ? {
          distance: Number(textureValues.connectCameraDistance),
          rotateXDeg: Number(textureValues.connectCameraRotateX),
          rotateYDeg: Number(textureValues.connectCameraRotateY),
          rotateZDeg: Number(textureValues.connectCameraRotateZ),
          panX: Number(textureValues.connectCameraPanX),
          panY: Number(textureValues.connectCameraPanY),
          fov: Number(textureValues.connectCameraFov),
        }
      : null,
    shaderView: showShaderToyCamera
      ? {
          distance: Number(textureValues.shaderViewDistance),
          rotateXDeg: Number(textureValues.shaderViewRotateX),
          rotateYDeg: Number(textureValues.shaderViewRotateY),
          rotateZDeg: Number(textureValues.shaderViewRotateZ),
          panX: Number(textureValues.shaderViewPanX),
          panY: Number(textureValues.shaderViewPanY),
          fov: Number(textureValues.shaderViewFov),
        }
      : null,
    connectShaderParams: showConnectCamera
      ? normalizeConnectShaderParams(connectShaderParamsFromLevaValues(shaderValues as Record<string, unknown>))
      : null,
    connectGradientUnderlay: showConnectCamera ? Boolean(textureValues.connectGradientUnderlay) : null,
    twizzler: {
      enabled: Boolean(shaderValueRecord.twizzlerEnabled),
      ...normalizeTwizzlerSettings({
        color: shaderValueRecord.twizzlerColor,
        colorNear: shaderValueRecord.twizzlerColor,
        colorFar: shaderValueRecord.twizzlerColorFar,
        colorEdge: shaderValueRecord.twizzlerColorEdge,
        gradientStops: (() => {
          const colorFar = String(shaderValueRecord.twizzlerColorFar ?? "");
          const colorNear = String(shaderValueRecord.twizzlerColor ?? "");
          const parsed = parseTwizzlerGradientStops(shaderValueRecord.twizzlerGradientStops, colorFar, colorNear);
          const mode = shaderValueRecord.twizzlerRibbonColorMode;
          if (mode === "sharedGradient" || mode === "fiberGradient") return parsed;
          return withTwizzlerGradientEndpointColors(parsed, colorFar, colorNear);
        })(),
        opacity: shaderValueRecord.twizzlerOpacity,
        scale: shaderValueRecord.twizzlerScale,
        centerY: shaderValueRecord.twizzlerCenterY,
        amplitude: shaderValueRecord.twizzlerAmplitude,
        lineCount: shaderValueRecord.twizzlerLineCount,
        lineWidth: shaderValueRecord.twizzlerLineWidth,
        pointSpacing: shaderValueRecord.twizzlerPointSpacing,
        leftHeight: shaderValueRecord.twizzlerLeftHeight,
        rightHeight: shaderValueRecord.twizzlerRightHeight,
        edgeFluctuation: shaderValueRecord.twizzlerEdgeFluctuation,
        edgeSpeed: shaderValueRecord.twizzlerEdgeSpeed,
        edgeTaper: shaderValueRecord.twizzlerEdgeTaper,
        wrinkles: shaderValueRecord.twizzlerWrinkles,
        wrinkleStrength: shaderValueRecord.twizzlerWrinkleStrength,
        bendPosition: shaderValueRecord.twizzlerBendPosition,
        bendAmount: shaderValueRecord.twizzlerBendAmount,
        bend2Position: shaderValueRecord.twizzlerBend2Position,
        bend2Amount: shaderValueRecord.twizzlerBend2Amount,
        bend3Position: shaderValueRecord.twizzlerBend3Position,
        bend3Amount: shaderValueRecord.twizzlerBend3Amount,
        depthPosition: shaderValueRecord.twizzlerDepthPosition,
        depthAmount: shaderValueRecord.twizzlerDepthAmount,
        depthWidth: shaderValueRecord.twizzlerDepthWidth,
        depthSpread: shaderValueRecord.twizzlerDepthSpread,
        depthLift: shaderValueRecord.twizzlerDepthLift,
        depthTerrain: shaderValueRecord.twizzlerDepthTerrain,
        twist: shaderValueRecord.twizzlerTwist,
        rotateXDeg: shaderValueRecord.twizzlerRotateXDeg,
        rotateYDeg: shaderValueRecord.twizzlerRotateYDeg,
        rotateZDeg: shaderValueRecord.twizzlerRotateZDeg,
        fov: shaderValueRecord.twizzlerFov,
        camDist: shaderValueRecord.twizzlerCamDist,
        perspectiveWidth: shaderValueRecord.twizzlerPerspectiveWidth,
        minLineWidth: shaderValueRecord.twizzlerMinLineWidth,
        maxLineWidth: shaderValueRecord.twizzlerMaxLineWidth,
        ribbonColorMode: shaderValueRecord.twizzlerRibbonColorMode,
        gradientXEnabled: shaderValueRecord.twizzlerGradientXEnabled,
        gradientXMix: shaderValueRecord.twizzlerGradientXMix,
        gradientYEnabled: shaderValueRecord.twizzlerGradientYEnabled,
        gradientYMix: shaderValueRecord.twizzlerGradientYMix,
        gradientZEnabled: shaderValueRecord.twizzlerGradientZEnabled,
        gradientZStrength: shaderValueRecord.twizzlerGradientZStrength,
        gradientZCenter: shaderValueRecord.twizzlerGradientZCenter,
        gradientZWidth: shaderValueRecord.twizzlerGradientZWidth,
        // Live stage color — Appearance defaults only until Background Color overrides (CF-44).
        backgroundColor: normalizedBackgroundColor ?? initialLabSettings.twizzler.backgroundColor,
        noiseScaleX: shaderValueRecord.twizzlerNoiseScaleX,
        noiseScaleY: shaderValueRecord.twizzlerNoiseScaleY,
        speed: shaderValueRecord.twizzlerSpeed,
        drift: shaderValueRecord.twizzlerDrift,
        stippleSize: shaderValueRecord.twizzlerStippleSize,
        stippleGap: shaderValueRecord.twizzlerStippleGap,
        rotateX: shaderValueRecord.twizzlerRotateX,
        rotateY: shaderValueRecord.twizzlerRotateY,
        rotateZ: shaderValueRecord.twizzlerRotateZ,
        panX: shaderValueRecord.twizzlerPanX,
        panY: shaderValueRecord.twizzlerPanY,
        panZ: shaderValueRecord.twizzlerPanZ,
        viewDistance: shaderValueRecord.twizzlerViewDistance,
      }),
    },
    twizzlerMap: normalizeTwizzlerMapSettings({
      backgroundLevel: shaderValues.twizzlerMapBackgroundLevel,
      ribbonLevel: shaderValues.twizzlerMapRibbonLevel,
      shoulderLevel: shaderValues.twizzlerMapShoulderLevel,
      shoulderWidth: shaderValues.twizzlerMapShoulderWidth,
      topOffsetPx: shaderValues.twizzlerMapTopOffsetPx,
      bottomOffsetPx: shaderValues.twizzlerMapBottomOffsetPx,
      topSpread: shaderValues.twizzlerMapTopSpread,
      bottomSpread: shaderValues.twizzlerMapBottomSpread,
      flowEnabled: shaderValues.twizzlerMapFlowEnabled,
      flowDirection: shaderValues.twizzlerMapFlowDirection,
      flowAmplitude: shaderValues.twizzlerMapFlowAmplitude,
      flowSpeed: shaderValues.twizzlerMapFlowSpeed,
      flowSpacing: shaderValues.twizzlerMapFlowSpacing,
      flowBandWidth: shaderValues.twizzlerMapFlowBandWidth,
      flowSoftness: shaderValues.twizzlerMapFlowSoftness,
      flowOpacity: shaderValues.twizzlerMapFlowOpacity,
      flowPhase: shaderValues.twizzlerMapFlowPhase,
    }),
    cometLogo: normalizeCometLogoSettings({
      version: initialLabSettings.cometLogo.version,
      fieldSpeed: shaderValueRecord.cometLogoFieldSpeed,
      fieldDepth: shaderValueRecord.cometLogoFieldDepth,
      fieldSpread: shaderValueRecord.cometLogoFieldSpread,
      centerClearRadius: shaderValueRecord.cometLogoCenterClearRadius,
      fieldTrailLength: shaderValueRecord.cometLogoFieldTrailLength,
      fieldParticleSize: shaderValueRecord.cometLogoFieldParticleSize,
      logoScale: shaderValueRecord.cometLogoLogoScale,
      logoParticleSize: shaderValueRecord.cometLogoLogoParticleSize,
      logoTrailLength: shaderValueRecord.cometLogoLogoTrailLength,
      logoMotion: shaderValueRecord.cometLogoLogoMotion,
      formationDuration: shaderValueRecord.cometLogoFormationDuration,
      rejoinDuration: shaderValueRecord.cometLogoRejoinDuration,
      formationStagger: shaderValueRecord.cometLogoFormationStagger,
      centerPreference: shaderValueRecord.cometLogoCenterPreference,
      sparkFrequency: shaderValueRecord.cometLogoSparkFrequency,
      sparkSize: shaderValueRecord.cometLogoSparkSize,
      sparkBrightness: shaderValueRecord.cometLogoSparkBrightness,
      sparkTrailLength: shaderValueRecord.cometLogoSparkTrailLength,
      burstProbability: shaderValueRecord.cometLogoBurstProbability,
      waveProbability: shaderValueRecord.cometLogoWaveProbability,
      surfaceEffects: shaderValueRecord.cometLogoSurfaceEffects,
      fireScale: shaderValueRecord.cometLogoFireScale,
      fireIntensity: shaderValueRecord.cometLogoFireIntensity,
      fireSpeed: shaderValueRecord.cometLogoFireSpeed,
      fireTurbulence: shaderValueRecord.cometLogoFireTurbulence,
      flameHeight: shaderValueRecord.cometLogoFlameHeight,
      weatherSpeed: shaderValueRecord.cometLogoWeatherSpeed,
      weatherVariation: shaderValueRecord.cometLogoWeatherVariation,
      coronaMist: shaderValueRecord.cometLogoCoronaMist,
      curlingWisps: shaderValueRecord.cometLogoCurlingWisps,
      hotRim: shaderValueRecord.cometLogoHotRim,
      eruptionFrequency: shaderValueRecord.cometLogoEruptionFrequency,
      eruptionScale: shaderValueRecord.cometLogoEruptionScale,
      eruptionIntensity: shaderValueRecord.cometLogoEruptionIntensity,
      eruptionParticles: shaderValueRecord.cometLogoEruptionParticles,
      eruptionCycleSpeed: shaderValueRecord.cometLogoEruptionCycleSpeed,
    }),
    clientCanvasSize: clientApp
      ? {
          width: findClientSizePreset(clientSizeId).width,
          height: findClientSizePreset(clientSizeId).height,
        }
      : null,
    clientGraphicMode: clientApp ? heroGraphicId : null,
    clientRainShaderPreset: clientApp
      ? String((shaderValues as unknown as Record<string, unknown>).rainShaderPreset || CONNECT_SHADER_PRESET_ID)
      : null,
  };
}
