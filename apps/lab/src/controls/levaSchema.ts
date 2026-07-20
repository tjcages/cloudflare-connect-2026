import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useControls, useCreateStore, folder, button, buttonGroup } from "leva";
import { normalizeEngineConfig } from "@necatikcl/stripes-engine";
import type { EngineConfig, Stripe } from "@necatikcl/stripes-engine";
import {
  consumeImportedConfigPristine,
  loadInitialConfig,
  loadLabSettings,
  loadStickyBackgroundColor,
  loadTextureId,
  saveStickyBackgroundColor,
} from "../persistence";
import type { LabSettings } from "../persistence";
import { fromEditable } from "./stripeAdapter";
import type { EditableStripe } from "./stripeAdapter";
import { stripeColorsTablePlugin, stripeColorsTableRuntime, stripeSyncKey } from "./stripeColorsTablePlugin";
import { colorLibraryInputPlugin } from "./colorLibraryInputPlugin";
import { DEFAULT_LAB_TEXTURE_ID, buildTextureEntries, findTextureEntry } from "../textures";
import { loadManifest } from "../uploads";
import {
  CONNECT_CAMERA_DEFAULTS,
  buildConnectShaderLevaFolders,
  connectShaderParamsFromLevaValues,
  normalizeConnectShaderParams,
  type ConnectCameraState,
  type ConnectShaderParams,
} from "../connectShader";
import { SHADER_VIEW_DEFAULTS, type ShaderViewState } from "../shaderView";
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

function drawerFolder<S extends Parameters<typeof folder>[0]>(id: string, schema: S) {
  return folder(schema, { collapsed: !loadControlDrawerOpen(id, loadLabSettings().drawerOpen[id] ?? false) });
}

const SHADER_PANEL_ORDER = [
  "Connect Wave",
  "Connect Shape",
  "Connect Fill",
  "Connect Lines",
  "Connect Hatch",
  "Connect Particles",
  "Connect Colors",
  "Background",
  "Stripes",
  "Grid",
  "Background Stars",
  "Background Flames",
  "Edge Mask",
  "Cursor Trail",
  "Click Wave",
  "Sparkle",
  "Letters",
] as const;

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

function visibleStripeWidthLevelCount(stripes: readonly { width: number; opacity: number }[]): number {
  const levels = new Set<number>();
  for (const stripe of stripes) {
    if (stripe.opacity <= 0.001 || stripe.width < 0.5) continue;
    levels.add(Math.round(stripe.width * 1000) / 1000);
  }
  return Math.max(1, levels.size);
}

export function useEngineControls(
  onReplay: () => void,
  options: { showShaderCamera?: boolean; showConnectCamera?: boolean } = {},
): EngineControlsResult {
  const showShaderCamera = options.showShaderCamera === true;
  const showConnectCamera = options.showConnectCamera === true;
  const showShaderToyCamera = showShaderCamera && !showConnectCamera;
  const showShaderCameraRef = useRef(showShaderCamera);
  showShaderCameraRef.current = showShaderCamera;
  const showConnectCameraRef = useRef(showConnectCamera);
  showConnectCameraRef.current = showConnectCamera;
  const showShaderToyCameraRef = useRef(showShaderToyCamera);
  showShaderToyCameraRef.current = showShaderToyCamera;
  const initialLabSettings = useMemo(() => loadLabSettings(), []);
  const initialTextureId = useMemo(() => {
    const stored = loadTextureId() ?? initialLabSettings.textureId;
    return stored && findTextureEntry(stored, loadManifest()) ? stored : DEFAULT_LAB_TEXTURE_ID;
  }, [initialLabSettings.textureId]);
  const d = useMemo(() => {
    const loaded = normalizeEngineConfig(loadInitialConfig(initialTextureId));
    const importedPristine = consumeImportedConfigPristine();
    const upgraded = importedPristine ? loaded : upgradeDefaultStripes(loaded);
    const fitUpgraded =
      upgraded.transform.fit === "stretch"
        ? { ...upgraded, transform: { ...upgraded.transform, fit: "width" as const } }
        : upgraded;
    if (importedPristine || !hasAutomaticStripeWidthDistribution(fitUpgraded.stripes)) return fitUpgraded;
    return { ...fitUpgraded, stripes: withDefaultStripeWidths(fitUpgraded.stripes) };
  }, [initialTextureId]);
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

  const [stripes, setStripes] = useState<EditableStripe[]>(() =>
    d.stripes.map((s, i) => ({
      id: String(i),
      hex: "#" + s.color.toString(16).padStart(6, "0"),
      startFrom: s.startFrom,
      width: s.width,
      opacity: s.opacity,
    })),
  );
  const [autoStripeWidths, setAutoStripeWidths] = useState(
    () => initialLabSettings.autoStripeWidths ?? hasAutomaticStripeWidthDistribution(d.stripes),
  );
  const [preShuffleStripes, setPreShuffleStripes] = useState<EditableStripe[] | null>(null);
  const [activeGeneratedPalette, setActiveGeneratedPalette] = useState<string | null>(() =>
    initialLabSettings.stripePalette && initialLabSettings.stripePalette !== "Custom"
      ? initialLabSettings.stripePalette
      : null,
  );
  const [backgroundRampEasing, setBackgroundRampEasing] = useState<BackgroundRampEasing>(() =>
    isKnownEasing(initialLabSettings.backgroundRampEasing ?? "", BACKGROUND_RAMP_EASING_OPTIONS)
      ? (initialLabSettings.backgroundRampEasing as BackgroundRampEasing)
      : "easeInOutQuad",
  );
  const [backgroundRampSettings, setBackgroundRampSettings] = useState<BackgroundRampSettings>(() =>
    normalizeBackgroundRampSettings(initialLabSettings.backgroundRampSettings ?? DEFAULT_BACKGROUND_RAMP_SETTINGS),
  );
  const [thresholdDistributionEasing, setThresholdDistributionEasing] = useState<ThresholdDistributionEasing>(() =>
    isKnownEasing(initialLabSettings.thresholdDistributionEasing ?? "", THRESHOLD_DISTRIBUTION_EASING_OPTIONS)
      ? (initialLabSettings.thresholdDistributionEasing as ThresholdDistributionEasing)
      : "linear",
  );
  const initialStickyBackground = useMemo(() => loadStickyBackgroundColor(), []);
  const [backgroundHex, setBackgroundHex] = useState<string | null>(() =>
    initialStickyBackground !== null
      ? intToHex(initialStickyBackground)
      : d.background.transparent
        ? null
        : intToHex(d.background.color),
  );

  const stripePaletteOptions = useMemo(() => ["Custom", ...STRIPE_PALETTE_NAMES], []);
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
      if (palette === "Custom") return;
      setPreShuffleStripes(null);
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
        saveStickyBackgroundColor(hexToInt(mappedBackground));
        controlSetterRef.current?.({ backgroundColor: mappedBackground });
      }
    },
    [backgroundRampEasing],
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

  const handleBackgroundColorLiveChange = useCallback((hex: string | null) => {
    const next = normalizeHexString(hex);
    lastStickyBackgroundRef.current = next;
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
    if (palette && palette !== "Custom" && palette !== WHITE_STRIPE_PALETTE_NAME) {
      setStripes((prev) =>
        applyStripePalette(prev, palette, next, backgroundRampEasingRef.current, backgroundRampSettingsRef.current),
      );
    }
  }, []);

  const handleColorChange = useCallback((id: string, hex: string) => {
    setPreShuffleStripes(null);
    setActiveGeneratedPalette(null);
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
    setActiveGeneratedPalette(null);
    setStripes((prev) => prev.map((s) => (s.id === id ? { ...s, opacity: Math.min(1, Math.max(0, value)) } : s)));
  }, []);

  const handleColorReorder = useCallback((orderedIds: string[]) => {
    setPreShuffleStripes(null);
    setActiveGeneratedPalette(null);
    setStripes((prev) => {
      const byId = new Map(prev.map((s) => [s.id, s]));
      return orderedIds.map((id) => byId.get(id)!).filter(Boolean);
    });
  }, []);

  const handleAdd = useCallback(() => {
    setPreShuffleStripes(null);
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
      setStripes((prev) => {
        const next = prev.filter((s) => s.id !== id);
        return autoStripeWidths ? withDefaultStripeWidths(next) : next;
      });
    },
    [autoStripeWidths],
  );

  const handleShufflePalette = useCallback(() => {
    setActiveGeneratedPalette(null);
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
    setActiveGeneratedPalette(null);
    setStripes((prev) => reverseStripeColors(prev));
  }, []);

  stripeColorsTableRuntime.stripes = stripes;
  stripeColorsTableRuntime.disabled = false;
  stripeColorsTableRuntime.paletteOptions = stripePaletteOptions;
  stripeColorsTableRuntime.paletteValue = stripePaletteValue;
  stripeColorsTableRuntime.rampEasingOptions = BACKGROUND_RAMP_EASING_OPTIONS;
  stripeColorsTableRuntime.rampEasingValue = backgroundRampEasing;
  stripeColorsTableRuntime.showRampEasing =
    stripePaletteValue === BACKGROUND_RAMP_PALETTE_NAME || stripePaletteValue === WHITE_STRIPE_PALETTE_NAME;
  stripeColorsTableRuntime.thresholdEasingOptions = THRESHOLD_DISTRIBUTION_EASING_OPTIONS;
  stripeColorsTableRuntime.thresholdEasingValue = thresholdDistributionEasing;
  stripeColorsTableRuntime.canUndoShuffle = preShuffleStripes !== null;
  stripeColorsTableRuntime.handlers = {
    onPaletteChange: handlePaletteChange,
    onRampEasingChange: handleRampEasingChange,
    onThresholdEasingChange: handleThresholdEasingChange,
    onShufflePalette: handleShufflePalette,
    onUndoShuffle: handleUndoShuffle,
    onReverseColorOrder: handleReverseColorOrder,
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
          render: () => showShaderCameraRef.current,
        },
      ),
      General: drawerFolder("General", {
        stripesEnabled: { value: d.stripesEnabled, label: "Stripes enabled" },
        textureDpr: { value: d.fieldScale, min: 0.25, max: 2, step: 0.25, label: "Texture DPR" },
      }),
      "Texture Tone": drawerFolder("Texture Tone", {
        exposure: { value: d.adjustments.exposure, min: -2, max: 2, step: 0.05, label: "Exposure" },
        brightness: { value: d.adjustments.brightness, min: -0.5, max: 0.5, step: 0.01, label: "Brightness" },
        contrast: { value: d.adjustments.contrast, min: 0, max: 2, step: 0.01, label: "Contrast" },
        gamma: { value: d.adjustments.gamma, min: 0.05, max: 5, step: 0.05, label: "Gamma" },
        invert: {
          value: d.adjustments.invert,
          label: "Invert luminance",
          render: (get) => get("Stripes.colorsMode") !== "colors",
        },
      }),
      "Texture Levels": drawerFolder("Texture Levels", {
        blackPoint: { value: d.adjustments.blackPoint, min: 0, max: 1, step: 0.01, label: "Black point" },
        whitePoint: { value: d.adjustments.whitePoint, min: 0, max: 1, step: 0.01, label: "White point" },
        thresholdBias: { value: d.adjustments.thresholdBias, min: -0.5, max: 0.5, step: 0.01, label: "Threshold bias" },
        posterizeLevels: { value: d.adjustments.posterizeLevels, min: 0, max: 16, step: 1, label: "Posterize" },
        noiseAmount: { value: d.adjustments.noiseAmount, min: 0, max: 0.5, step: 0.01, label: "Noise" },
        blurRadius: { value: d.adjustments.blurRadius, min: 0, max: 4, step: 1, label: "Blur" },
        sharpenAmount: { value: d.adjustments.sharpenAmount, min: 0, max: 4, step: 0.1, label: "Sharpen" },
      }),
      "Texture Source": drawerFolder("Texture Source", {
        backgroundSourceOpacity: {
          value: Math.round((initialLabSettings.backgroundSourceOpacity ?? 0) * 100),
          min: 0,
          max: 100,
          step: 1,
          label: "Preview opacity",
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
      }),
    }),
    { store: textureStore },
    [],
  );
  textureControlSetterRef.current = setTextureControl as (values: Record<string, unknown>) => void;

  const [shaderValues, setShaderControl] = useControls(
    () =>
      orderShaderPanel({
        ...buildConnectShaderLevaFolders(
          normalizeConnectShaderParams(initialLabSettings.connectShaderParams),
          showConnectCameraRef,
        ),
        Stripes: drawerFolder("Stripes", {
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
                get("Stripes.colorsMode") !== "colors" && stripePaletteValue === BACKGROUND_RAMP_PALETTE_NAME,
            },
          ),
          imageColorWidthSource: {
            value: initialImageColorWidthSource(d.colors),
            options: { "Highest luminance": "bright", "Lowest luminance": "dark" } as const,
            label: "Thickest",
            render: (get) => get("Stripes.colorsMode") === "colors",
          },
          imageColorRemoveThin: {
            value: d.colors.imageColorRemoveThin ?? 0,
            min: 0,
            max: 0.95,
            step: 0.01,
            label: "Remove thin",
            render: (get) => get("Stripes.colorsMode") === "colors",
          },
          imageColorBoostThick: {
            value: d.colors.imageColorBoostThick ?? 0,
            min: 0,
            max: 2,
            step: 0.01,
            label: "Boost thick",
            render: (get) => get("Stripes.colorsMode") === "colors",
          },
          imageColorLightness: {
            value: (d.colors.imageColorLightness ?? 0) * 100,
            min: -100,
            max: 100,
            step: 1,
            label: "Extra lightness",
            render: (get) => get("Stripes.colorsMode") === "colors",
          },
          imageColorDensity: {
            value: (d.colors.imageColorDensity ?? 1) * 100,
            min: 0,
            max: 100,
            step: 1,
            label: "Random density",
            render: (get) => get("Stripes.colorsMode") === "colors",
          },
        }),
        Grid: drawerFolder("Grid", {
          cellWidth: { value: d.grid.cellWidth, min: 1, max: 24, step: 1, label: "Cell width" },
          cellHeight: { value: d.grid.cellHeight, min: 1, max: 24, step: 1, label: "Cell height" },
          gapX: { value: d.grid.gapX, min: 0, max: 24, step: 0.5, label: "Gap X" },
          gapY: { value: d.grid.gapY, min: 0, max: 24, step: 0.5, label: "Gap Y" },
          cornerRadius: { value: d.grid.cornerRadius, min: 0, max: 24, step: 0.5, label: "Corner radius" },
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
            render: (get) => get("Grid.orientationRotationMode") === "overlap",
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
        }),
        Background: drawerFolder("Background", {
          backgroundFillMode: {
            value:
              initialLabSettings.backgroundFillMode === "transparent" ||
              initialLabSettings.backgroundFillMode === "gradient" ||
              initialLabSettings.backgroundFillMode === "solid"
                ? initialLabSettings.backgroundFillMode
                : d.background.transparent
                  ? "transparent"
                  : d.background.gradient.enabled
                    ? "gradient"
                    : "solid",
            options: { Transparent: "transparent", Solid: "solid", Gradient: "gradient" } as const,
            label: "Fill",
          },
          backgroundColor: {
            ...colorLibraryInputPlugin({
              value: backgroundHex,
              label: "Color",
              persist: "backgroundColor",
              onLiveChange: handleBackgroundColorLiveChange,
            }),
            render: (get) => get("Background.backgroundFillMode") === "solid",
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
            render: (get) => get("Background.backgroundFillMode") === "gradient",
          },
          backgroundGradientStopCount: {
            value: d.background.gradient.stopCount,
            min: 2,
            max: 4,
            step: 1,
            label: "Gradient stops",
            render: (get) => get("Background.backgroundFillMode") === "gradient",
          },
          backgroundGradientStop0: {
            ...colorLibraryInputPlugin({ value: intToHex(d.background.gradient.stops[0]), label: "Stop 1" }),
            label: "Stop 1",
            render: (get) => get("Background.backgroundFillMode") === "gradient",
          },
          backgroundGradientStop1: {
            ...colorLibraryInputPlugin({ value: intToHex(d.background.gradient.stops[1]), label: "Stop 2" }),
            label: "Stop 2",
            render: (get) => get("Background.backgroundFillMode") === "gradient",
          },
          backgroundGradientStop2: {
            ...colorLibraryInputPlugin({ value: intToHex(d.background.gradient.stops[2]), label: "Stop 3" }),
            label: "Stop 3",
            render: (get) =>
              get("Background.backgroundFillMode") === "gradient" &&
              Number(get("Background.backgroundGradientStopCount")) >= 3,
          },
          backgroundGradientStop3: {
            ...colorLibraryInputPlugin({ value: intToHex(d.background.gradient.stops[3]), label: "Stop 4" }),
            label: "Stop 4",
            render: (get) =>
              get("Background.backgroundFillMode") === "gradient" &&
              Number(get("Background.backgroundGradientStopCount")) >= 4,
          },
        }),
        "Background Stars": drawerFolder("Background Stars", {
          backgroundStarsEnabled: { value: d.background.stars.enabled, label: "Enabled" },
          backgroundStarsDensity: {
            value: d.background.stars.density,
            min: 0,
            max: 100,
            step: 1,
            label: "Sparkle %",
            render: (get) => !!get("Background Stars.backgroundStarsEnabled"),
          },
          backgroundStarsSizePx: {
            value: d.background.stars.sizePx,
            min: 0.25,
            max: 64,
            step: 0.25,
            label: "Star size",
            render: (get) => !!get("Background Stars.backgroundStarsEnabled"),
          },
          backgroundStarsSizeRandomness: {
            value: d.background.stars.sizeRandomness,
            min: 0,
            max: 1,
            step: 0.01,
            label: "Random size",
            render: (get) => !!get("Background Stars.backgroundStarsEnabled"),
          },
          backgroundStarsTiltAngleDeg: {
            value: d.background.stars.tiltAngleDeg,
            min: -89,
            max: 89,
            step: 1,
            label: "Tilt angle",
            render: (get) => !!get("Background Stars.backgroundStarsEnabled"),
          },
          backgroundStarsTwinkleSpeed: {
            value: d.background.stars.twinkleSpeed,
            min: 0,
            max: 10,
            step: 0.05,
            label: "Twinkle speed",
            render: (get) => !!get("Background Stars.backgroundStarsEnabled"),
          },
          backgroundStarsTwinkleAmount: {
            value: d.background.stars.twinkleAmount,
            min: 0,
            max: 1,
            step: 0.01,
            label: "Twinkle amount",
            render: (get) => !!get("Background Stars.backgroundStarsEnabled"),
          },
          backgroundStarsOpacity: {
            value: d.background.stars.opacity,
            min: 0,
            max: 1,
            step: 0.01,
            label: "Star opacity",
            render: (get) => !!get("Background Stars.backgroundStarsEnabled"),
          },
          backgroundStarsColor: {
            ...colorLibraryInputPlugin({ value: intToHex(d.background.stars.color), label: "Star color" }),
            label: "Star color",
            render: (get) => !!get("Background Stars.backgroundStarsEnabled"),
          },
        }),
        "Background Flames": drawerFolder("Background Flames", {
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
            } as const,
            label: "Direction",
            render: (get) => get("Background Flames.flamesEnabled") === true,
          },
          flamesMinWidthPct: {
            value: d.flames.minWidthRatio * 100,
            min: 0.1,
            max: 50,
            step: 0.1,
            label: "Width min %",
            render: (get) => get("Background Flames.flamesEnabled") === true,
          },
          flamesMaxWidthPct: {
            value: d.flames.maxWidthRatio * 100,
            min: 0.1,
            max: 50,
            step: 0.1,
            label: "Width max %",
            render: (get) => get("Background Flames.flamesEnabled") === true,
          },
          flamesMinHeightPct: {
            value: d.flames.minHeightRatio * 100,
            min: 0.1,
            max: 50,
            step: 0.1,
            label: "Height min %",
            render: (get) => get("Background Flames.flamesEnabled") === true,
          },
          flamesMaxHeightPct: {
            value: d.flames.maxHeightRatio * 100,
            min: 0.1,
            max: 50,
            step: 0.1,
            label: "Height max %",
            render: (get) => get("Background Flames.flamesEnabled") === true,
          },
          flamesBaseSpeed: {
            value: d.flames.baseSpeedPxPerSec,
            min: 1,
            max: 500,
            step: 1,
            label: "Base speed (px/s)",
            render: (get) => get("Background Flames.flamesEnabled") === true,
          },
          flamesSpeedVariation: {
            value: d.flames.speedVariation,
            min: 0,
            max: 1,
            step: 0.01,
            label: "Speed variation",
            render: (get) => get("Background Flames.flamesEnabled") === true,
          },
          flamesSpawnInterval: {
            value: d.flames.spawnIntervalMs,
            min: 20,
            max: 5000,
            step: 10,
            label: "Spawn interval (ms)",
            render: (get) => get("Background Flames.flamesEnabled") === true,
          },
          flamesSpawnJitter: {
            value: d.flames.spawnJitterMs,
            min: 0,
            max: 2000,
            step: 10,
            label: "Spawn jitter (ms)",
            render: (get) => get("Background Flames.flamesEnabled") === true,
          },
          flamesMaxActive: {
            value: d.flames.maxActive,
            min: 1,
            max: 200,
            step: 1,
            label: "Max active",
            render: (get) => get("Background Flames.flamesEnabled") === true,
          },
          flamesEdgeSharpness: {
            value: d.flames.edgeSharpness,
            min: 0,
            max: 1,
            step: 0.01,
            label: "Edge sharpness",
            render: (get) => get("Background Flames.flamesEnabled") === true,
          },
          flamesOpacityMin: {
            value: d.flames.opacityMin,
            min: 0,
            max: 1,
            step: 0.01,
            label: "Opacity min",
            render: (get) => get("Background Flames.flamesEnabled") === true,
          },
          flamesOpacityMax: {
            value: d.flames.opacityMax,
            min: 0,
            max: 1,
            step: 0.01,
            label: "Opacity max",
            render: (get) => get("Background Flames.flamesEnabled") === true,
          },
        }),
        Sparkle: drawerFolder("Sparkle", {
          sparkleStripeEnabled: { value: d.sparkle.stripe.enabled, label: "Stripe sparkle enabled" },
          sparkleStripeCoverage: {
            value: d.sparkle.stripe.coverage * 100,
            min: 0,
            max: 100,
            step: 1,
            label: "Stripe sparkle %",
            render: (get) => get("Sparkle.sparkleStripeEnabled") === true,
          },
          sparkleStripeThickestCount: {
            value: Math.min(d.sparkle.stripe.thickestCount, visibleStripeWidthLevelCount(d.stripes)),
            min: 1,
            max: visibleStripeWidthLevelCount(d.stripes),
            step: 1,
            label: "Thickest levels",
            render: (get) => get("Sparkle.sparkleStripeEnabled") === true,
          },
          sparkleStripeMaxBrightness: {
            value: d.sparkle.stripe.maxBrightness * 100,
            min: 0,
            max: 100,
            step: 1,
            label: "+ Brightness",
            render: (get) => get("Sparkle.sparkleStripeEnabled") === true,
          },
          sparkleStripeSpeed: {
            value: d.sparkle.stripe.speed,
            min: 0.05,
            max: 10,
            step: 0.05,
            label: "Sparkle speed",
            render: (get) => get("Sparkle.sparkleStripeEnabled") === true,
          },
          sparkleWidthEnabled: { value: d.sparkle.width.enabled, label: "Width shuffle enabled" },
          sparkleWidthCoverage: {
            value: d.sparkle.width.coverage,
            min: 0,
            max: 1,
            step: 0.01,
            label: "Width active %",
            render: (get) => get("Sparkle.sparkleWidthEnabled") === true,
          },
          sparkleWidthSwingPx: {
            value: d.sparkle.width.swingPx,
            min: 0,
            max: 40,
            step: 0.25,
            label: "Width swing (px)",
            render: (get) => get("Sparkle.sparkleWidthEnabled") === true,
          },
          sparkleWidthSwingPeriodMin: {
            value: d.sparkle.width.swingPeriodMin,
            min: 0.02,
            max: 5,
            step: 0.01,
            label: "Swing period min",
            render: (get) => get("Sparkle.sparkleWidthEnabled") === true,
          },
          sparkleWidthSwingPeriodMax: {
            value: d.sparkle.width.swingPeriodMax,
            min: 0.02,
            max: 5,
            step: 0.01,
            label: "Swing period max",
            render: (get) => get("Sparkle.sparkleWidthEnabled") === true,
          },
          sparkleMotionEnabled: { value: d.sparkle.motion.enabled, label: "Row motion enabled" },
          sparkleMotionAmplitudePx: {
            value: d.sparkle.motion.amplitudePx,
            min: 0,
            max: 64,
            step: 0.5,
            label: "Move amount (px)",
            render: (get) => get("Sparkle.sparkleMotionEnabled") === true,
          },
          sparkleMotionStaggerPx: {
            value: d.sparkle.motion.staggerPx,
            min: 1,
            max: 512,
            step: 1,
            label: "Stagger distance",
            render: (get) => get("Sparkle.sparkleMotionEnabled") === true,
          },
          sparkleMotionMaxOffsetPx: {
            value: d.sparkle.motion.maxOffsetPx,
            min: 0,
            max: 128,
            step: 0.5,
            label: "Max offset (px)",
            render: (get) => get("Sparkle.sparkleMotionEnabled") === true,
          },
          sparkleMotionSpeed: {
            value: d.sparkle.motion.speed,
            min: 0.05,
            max: 5,
            step: 0.05,
            label: "Motion speed",
            render: (get) => get("Sparkle.sparkleMotionEnabled") === true,
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
            render: (get) => get("Sparkle.sparkleMotionEnabled") === true,
          },
        }),
        Letters: drawerFolder("Letters", {
          lettersEnabled: { value: d.letters.enabled, label: "Enabled" },
          lettersMode: {
            value: d.letters.mode,
            options: {
              "Random letters": "random",
              Text: "text",
            } as const,
            label: "Mode",
            render: (get) => get("Letters.lettersEnabled") === true,
          },
          lettersColorMode: {
            value: d.letters.colorMode,
            options: {
              White: "white",
              Colorful: "colorful",
            } as const,
            label: "Color",
            render: (get) => get("Letters.lettersEnabled") === true,
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
            render: (get) => get("Letters.lettersEnabled") === true,
          },
          lettersText: {
            value: d.letters.text,
            label: "Text",
            render: (get) => get("Letters.lettersEnabled") === true && get("Letters.lettersMode") === "text",
          },
          lettersTextCopies: {
            value: d.letters.textCopies,
            min: 1,
            max: 100,
            step: 1,
            label: "Text copies",
            render: (get) => get("Letters.lettersEnabled") === true && get("Letters.lettersMode") === "text",
          },
          coverage: {
            value: d.letters.coverage,
            min: 0,
            max: 1,
            step: 0.01,
            label: "Random density",
            render: (get) => get("Letters.lettersEnabled") === true && get("Letters.lettersMode") === "random",
          },
          lettersPositionX: {
            value: d.letters.positionX,
            min: 0,
            max: 1,
            step: 0.01,
            label: "Position X",
            render: (get) => get("Letters.lettersEnabled") === true && get("Letters.lettersMode") === "random",
          },
          lettersPositionY: {
            value: d.letters.positionY,
            min: 0,
            max: 1,
            step: 0.01,
            label: "Position Y",
            render: (get) => get("Letters.lettersEnabled") === true && get("Letters.lettersMode") === "random",
          },
          lettersAreaWidth: {
            value: d.letters.areaWidth,
            min: 0.01,
            max: 1,
            step: 0.01,
            label: "Random area W",
            render: (get) => get("Letters.lettersEnabled") === true && get("Letters.lettersMode") === "random",
          },
          lettersAreaHeight: {
            value: d.letters.areaHeight,
            min: 0.01,
            max: 1,
            step: 0.01,
            label: "Random area H",
            render: (get) => get("Letters.lettersEnabled") === true && get("Letters.lettersMode") === "random",
          },
          sizeScale: {
            value: d.letters.sizeScale,
            min: 0.1,
            max: 1,
            step: 0.05,
            label: "Font size",
            render: (get) => get("Letters.lettersEnabled") === true,
          },
          shuffleSpeed: {
            value: d.letters.shuffleSpeed,
            min: 0.05,
            max: 3,
            step: 0.05,
            label: "Shuffle speed",
            render: (get) => get("Letters.lettersEnabled") === true,
          },
        }),
        Reveal: drawerFolder("Reveal", {
          revealType: {
            value: d.reveal.type,
            options: {
              Wave: "wave",
              Assembly: "assembly",
              Turbulence: "turbulence",
              Glitch: "glitch",
              Hadouken: "hadouken",
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
            render: (get) => get("Reveal.revealType") === "wave",
          },
          revealDurationMs: {
            value: d.reveal.wave.durationMs,
            min: 100,
            max: 30000,
            step: 50,
            label: "Duration (ms)",
            render: (get) => get("Reveal.revealType") === "wave",
          },
          revealSoftness: {
            value: d.reveal.wave.softness,
            min: 0,
            max: 1,
            step: 0.01,
            label: "Softness",
            render: (get) => get("Reveal.revealType") === "wave",
          },
          revealWaviness: {
            value: d.reveal.wave.waviness,
            min: 0,
            max: 1,
            step: 0.01,
            label: "Waviness",
            render: (get) => get("Reveal.revealType") === "wave",
          },
          revealSliceSizePx: {
            value: d.reveal.assembly.sliceSizePx,
            min: 8,
            max: 200,
            step: 1,
            label: "Slice size (px)",
            render: (get) => get("Reveal.revealType") === "assembly",
          },
          revealSpeedMinMs: {
            value: d.reveal.assembly.speedMinMs,
            min: 100,
            max: 30000,
            step: 50,
            label: "Speed min (ms)",
            render: (get) => get("Reveal.revealType") === "assembly",
          },
          revealSpeedMaxMs: {
            value: d.reveal.assembly.speedMaxMs,
            min: 100,
            max: 30000,
            step: 50,
            label: "Speed max (ms)",
            render: (get) => get("Reveal.revealType") === "assembly",
          },
          revealStaggerMs: {
            value: d.reveal.assembly.staggerMs,
            min: 0,
            max: 30000,
            step: 50,
            label: "Stagger (ms)",
            render: (get) => get("Reveal.revealType") === "assembly",
          },
          revealScatterPx: {
            value: d.reveal.assembly.scatterPx,
            min: 0,
            max: 300,
            step: 1,
            label: "Scatter (px)",
            render: (get) => get("Reveal.revealType") === "assembly",
          },
          revealAngleJitterDeg: {
            value: d.reveal.assembly.angleJitterDeg,
            min: 0,
            max: 90,
            step: 1,
            label: "Angle jitter (°)",
            render: (get) => get("Reveal.revealType") === "assembly",
          },
          revealTurbSpeedMinMs: {
            value: d.reveal.turbulence.speedMinMs,
            min: 50,
            max: 30000,
            step: 10,
            label: "Speed min (ms)",
            render: (get) => get("Reveal.revealType") === "turbulence",
          },
          revealTurbSpeedMaxMs: {
            value: d.reveal.turbulence.speedMaxMs,
            min: 50,
            max: 30000,
            step: 10,
            label: "Speed max (ms)",
            render: (get) => get("Reveal.revealType") === "turbulence",
          },
          revealTurbStaggerMs: {
            value: d.reveal.turbulence.staggerMs,
            min: 0,
            max: 30000,
            step: 10,
            label: "Stagger (ms)",
            render: (get) => get("Reveal.revealType") === "turbulence",
          },
          revealTurbIntensity: {
            value: d.reveal.turbulence.intensity,
            min: 0,
            max: 2,
            step: 0.05,
            label: "Intensity",
            render: (get) => get("Reveal.revealType") === "turbulence",
          },
          revealTurbDetail: {
            value: d.reveal.turbulence.detail,
            min: 0,
            max: 1,
            step: 0.05,
            label: "Detail",
            render: (get) => get("Reveal.revealType") === "turbulence",
          },
          revealTurbGlow: {
            value: d.reveal.turbulence.glow,
            min: 0,
            max: 1,
            step: 0.05,
            label: "Glow",
            render: (get) => get("Reveal.revealType") === "turbulence",
          },
          revealGlitchSpeedMinMs: {
            value: d.reveal.glitch.speedMinMs,
            min: 50,
            max: 30000,
            step: 10,
            label: "Speed min (ms)",
            render: (get) => get("Reveal.revealType") === "glitch",
          },
          revealGlitchSpeedMaxMs: {
            value: d.reveal.glitch.speedMaxMs,
            min: 50,
            max: 30000,
            step: 10,
            label: "Speed max (ms)",
            render: (get) => get("Reveal.revealType") === "glitch",
          },
          revealGlitchStaggerMs: {
            value: d.reveal.glitch.staggerMs,
            min: 0,
            max: 30000,
            step: 10,
            label: "Stagger (ms)",
            render: (get) => get("Reveal.revealType") === "glitch",
          },
          revealGlitchIntensity: {
            value: d.reveal.glitch.intensity,
            min: 0,
            max: 2,
            step: 0.05,
            label: "Intensity",
            render: (get) => get("Reveal.revealType") === "glitch",
          },
          revealGlitchDetail: {
            value: d.reveal.glitch.detail,
            min: 0,
            max: 1,
            step: 0.05,
            label: "Detail",
            render: (get) => get("Reveal.revealType") === "glitch",
          },
          revealGlitchGlow: {
            value: d.reveal.glitch.glow,
            min: 0,
            max: 1,
            step: 0.05,
            label: "Glow",
            render: (get) => get("Reveal.revealType") === "glitch",
          },
          revealHadSpeedMinMs: {
            value: d.reveal.hadouken.speedMinMs,
            min: 50,
            max: 30000,
            step: 10,
            label: "Speed min (ms)",
            render: (get) => get("Reveal.revealType") === "hadouken",
          },
          revealHadSpeedMaxMs: {
            value: d.reveal.hadouken.speedMaxMs,
            min: 50,
            max: 30000,
            step: 10,
            label: "Speed max (ms)",
            render: (get) => get("Reveal.revealType") === "hadouken",
          },
          revealHadStaggerMs: {
            value: d.reveal.hadouken.staggerMs,
            min: 0,
            max: 30000,
            step: 10,
            label: "Stagger (ms)",
            render: (get) => get("Reveal.revealType") === "hadouken",
          },
          revealHadIntensity: {
            value: d.reveal.hadouken.intensity,
            min: 0,
            max: 2,
            step: 0.05,
            label: "Intensity",
            render: (get) => get("Reveal.revealType") === "hadouken",
          },
          revealHadDetail: {
            value: d.reveal.hadouken.detail,
            min: 0,
            max: 1,
            step: 0.05,
            label: "Detail",
            render: (get) => get("Reveal.revealType") === "hadouken",
          },
          revealHadGlow: {
            value: d.reveal.hadouken.glow,
            min: 0,
            max: 1,
            step: 0.05,
            label: "Glow",
            render: (get) => get("Reveal.revealType") === "hadouken",
          },
          Replay: button(() => onReplay()),
        }),
        "Edge Mask": drawerFolder("Edge Mask", {
          edgeMaskEnabled: { value: d.edgeMask.enabled, label: "Enabled" },
          edgeMaskStart: {
            value: d.edgeMask.start,
            min: 0,
            max: 0.5,
            step: 0.005,
            label: "Start inset",
            render: (get) => get("Edge Mask.edgeMaskEnabled") === true,
          },
          edgeMaskEnd: {
            value: d.edgeMask.end,
            min: 0,
            max: 0.5,
            step: 0.005,
            label: "End inset",
            render: (get) => get("Edge Mask.edgeMaskEnabled") === true,
          },
          edgeMaskPower: {
            value: d.edgeMask.power,
            min: 0.1,
            max: 4,
            step: 0.05,
            label: "Power",
            render: (get) => get("Edge Mask.edgeMaskEnabled") === true,
          },
        }),
        "Cursor Trail": drawerFolder("Cursor Trail", {
          cursorTrailEnabled: { value: d.cursorTrail.enabled, label: "Enabled" },
          particleRadius: {
            value: d.cursorTrail.particleRadius,
            min: 0.5,
            max: 80,
            step: 0.5,
            label: "Particle radius",
            render: (get) => get("Cursor Trail.cursorTrailEnabled") === true,
          },
          particleAlpha: {
            value: d.cursorTrail.particleAlpha,
            min: 0,
            max: 1,
            step: 0.005,
            label: "Particle alpha",
            render: (get) => get("Cursor Trail.cursorTrailEnabled") === true,
          },
          particleLifeMs: {
            value: d.cursorTrail.particleLifeMs,
            min: 50,
            max: 10000,
            step: 10,
            label: "Particle life (ms)",
            render: (get) => get("Cursor Trail.cursorTrailEnabled") === true,
          },
          particleSpacingPx: {
            value: d.cursorTrail.particleSpacingPx,
            min: 0.5,
            max: 80,
            step: 0.5,
            label: "Particle spacing (px)",
            render: (get) => get("Cursor Trail.cursorTrailEnabled") === true,
          },
          maxEmitPerTick: {
            value: d.cursorTrail.maxEmitPerTick,
            min: 1,
            max: 200,
            step: 1,
            label: "Max emit/tick",
            render: (get) => get("Cursor Trail.cursorTrailEnabled") === true,
          },
          spreadMinPx: {
            value: d.cursorTrail.spreadMinPx,
            min: 0,
            max: 80,
            step: 0.5,
            label: "Spread min (px)",
            render: (get) => get("Cursor Trail.cursorTrailEnabled") === true,
          },
          spreadMaxPx: {
            value: d.cursorTrail.spreadMaxPx,
            min: 0,
            max: 120,
            step: 0.5,
            label: "Spread max (px)",
            render: (get) => get("Cursor Trail.cursorTrailEnabled") === true,
          },
          spinStrength: {
            value: d.cursorTrail.spinStrength,
            min: 0,
            max: 0.2,
            step: 0.001,
            label: "Spin strength",
            render: (get) => get("Cursor Trail.cursorTrailEnabled") === true,
          },
          pushStrengthPx: {
            value: d.cursorTrail.pushStrengthPx,
            min: 0,
            max: 120,
            step: 1,
            label: "Push strength (px)",
            render: (get) => get("Cursor Trail.cursorTrailEnabled") === true,
          },
          pushRadiusScale: {
            value: d.cursorTrail.pushRadiusScale,
            min: 0,
            max: 8,
            step: 0.05,
            label: "Push radius scale",
            render: (get) => get("Cursor Trail.cursorTrailEnabled") === true,
          },
          pushWobblePx: {
            value: d.cursorTrail.pushWobblePx,
            min: 0,
            max: 80,
            step: 1,
            label: "Push wobble (px)",
            render: (get) => get("Cursor Trail.cursorTrailEnabled") === true,
          },
        }),
        "Click Wave": drawerFolder("Click Wave", {
          clickWaveEnabled: { value: d.clickWave.enabled, label: "Enabled" },
          clickWaveLifeMs: {
            value: d.clickWave.lifeMs,
            min: 80,
            max: 10000,
            step: 10,
            label: "Life (ms)",
            render: (get) => get("Click Wave.clickWaveEnabled") === true,
          },
          clickWaveStartRadiusPx: {
            value: d.clickWave.startRadiusPx,
            min: 1,
            max: 120,
            step: 1,
            label: "Start radius (px)",
            render: (get) => get("Click Wave.clickWaveEnabled") === true,
          },
          clickWaveMaxRadiusPx: {
            value: d.clickWave.maxRadiusPx,
            min: 4,
            max: 600,
            step: 2,
            label: "Max radius (px)",
            render: (get) => get("Click Wave.clickWaveEnabled") === true,
          },
          clickWaveStartStrokeWidthPx: {
            value: d.clickWave.startStrokeWidthPx,
            min: 0.5,
            max: 80,
            step: 0.5,
            label: "Start stroke (px)",
            render: (get) => get("Click Wave.clickWaveEnabled") === true,
          },
          clickWaveEndStrokeWidthPx: {
            value: d.clickWave.endStrokeWidthPx,
            min: 0.25,
            max: 40,
            step: 0.25,
            label: "End stroke (px)",
            render: (get) => get("Click Wave.clickWaveEnabled") === true,
          },
          clickWaveMaxWaves: {
            value: d.clickWave.maxWaves,
            min: 1,
            max: 32,
            step: 1,
            label: "Max waves",
            render: (get) => get("Click Wave.clickWaveEnabled") === true,
          },
          clickWavePushStrengthPx: {
            value: d.clickWave.pushStrengthPx,
            min: 0,
            max: 200,
            step: 1,
            label: "Push strength (px)",
            render: (get) => get("Click Wave.clickWaveEnabled") === true,
          },
          clickWavePushBandScale: {
            value: d.clickWave.pushBandScale,
            min: 1,
            max: 8,
            step: 0.1,
            label: "Push band scale",
            render: (get) => get("Click Wave.clickWaveEnabled") === true,
          },
          clickWaveStripeWhiteAlpha: {
            value: d.clickWave.stripeWhiteAlpha,
            min: 0,
            max: 1,
            step: 0.01,
            label: "Stripe white alpha",
            render: (get) => get("Click Wave.clickWaveEnabled") === true,
          },
        }),
      }),
    { store: shaderStore },
    [stripeKey, stripePaletteValue],
  );
  shaderControlSetterRef.current = setShaderControl;

  useEffect(() => {
    // Nudge stores so Camera / Connect folder `render()` re-evaluates visibility.
    setTextureControl({});
    setShaderControl({});
  }, [showShaderCamera, showConnectCamera, setTextureControl, setShaderControl]);

  const values = { ...textureValues, ...shaderValues };
  const imageColorsMode = values.colorsMode === "colors";
  const stripeTableKey = `${stripeKey}|colorMode:${imageColorsMode ? "image-colors" : "luminance"}`;
  stripeColorsTableRuntime.paletteOptions = imageColorsMode ? [] : stripePaletteOptions;
  stripeColorsTableRuntime.showColorControls = !imageColorsMode;
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
      setBackgroundHex(null);
      return;
    }
    if (lastStickyBackgroundRef.current?.toLowerCase() === next.toLowerCase()) return;
    lastStickyBackgroundRef.current = next;
    setBackgroundHex(next);
    saveStickyBackgroundColor(hexToInt(next));
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
    if (palette && palette !== "Custom" && palette !== WHITE_STRIPE_PALETTE_NAME) {
      setStripes((prev) =>
        applyStripePalette(prev, palette, next, backgroundRampEasingRef.current, backgroundRampSettingsRef.current),
      );
    }
  }, [values.backgroundColor]);

  const baseStripes = fromEditable(stripes);
  const backgroundFillMode =
    values.backgroundFillMode === "gradient" ||
    values.backgroundFillMode === "solid" ||
    values.backgroundFillMode === "transparent"
      ? (values.backgroundFillMode as BackgroundFillMode)
      : d.background.transparent
        ? "transparent"
        : d.background.gradient.enabled
          ? "gradient"
          : "solid";
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
      backgroundRampSettings: currentBackgroundRampSettings,
      thresholdDistributionEasing,
      autoStripeWidths,
      drawerOpen: loadControlDrawerSnapshot(),
    }),
    [
      autoStripeWidths,
      backgroundFillMode,
      backgroundRampEasing,
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
    },
    stripesEnabled: values.stripesEnabled,
    renderMode: d.renderMode,
    renderIntensity: d.renderIntensity,
    renderParams: d.renderParams,
    renderColorA: d.renderColorA,
    renderColorB: d.renderColorB,
    fieldScale: values.textureDpr,
    stripes: baseStripes,
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
      hadouken: {
        speedMinMs: values.revealHadSpeedMinMs,
        speedMaxMs: values.revealHadSpeedMaxMs,
        staggerMs: values.revealHadStaggerMs,
        intensity: values.revealHadIntensity,
        detail: values.revealHadDetail,
        glow: values.revealHadGlow,
      },
    },
    sparkle: {
      gaps: {
        enabled: d.sparkle.gaps.enabled,
        coverage: d.sparkle.gaps.coverage,
        speed: d.sparkle.gaps.speed,
      },
      stripe: {
        enabled: values.sparkleStripeEnabled,
        coverage: values.sparkleStripeCoverage / 100,
        thickestCount: values.sparkleStripeThickestCount,
        maxBrightness: values.sparkleStripeMaxBrightness / 100,
        speed: values.sparkleStripeSpeed,
        hueDriftDeg: currentBackgroundRampSettings.hueDriftDeg,
        saturationBoost: currentBackgroundRampSettings.saturationBoost / 100,
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
    },
    edgeMask: {
      enabled: values.edgeMaskEnabled,
      start: values.edgeMaskStart,
      end: values.edgeMaskEnd,
      power: values.edgeMaskPower,
    },
    cursorTrail: {
      enabled: values.cursorTrailEnabled,
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
    },
    clickWave: {
      enabled: values.clickWaveEnabled,
      lifeMs: values.clickWaveLifeMs,
      startRadiusPx: values.clickWaveStartRadiusPx,
      maxRadiusPx: values.clickWaveMaxRadiusPx,
      startStrokeWidthPx: values.clickWaveStartStrokeWidthPx,
      endStrokeWidthPx: values.clickWaveEndStrokeWidthPx,
      maxWaves: values.clickWaveMaxWaves,
      pushStrengthPx: values.clickWavePushStrengthPx,
      pushBandScale: values.clickWavePushBandScale,
      stripeWhiteAlpha: values.clickWaveStripeWhiteAlpha,
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

  return {
    config,
    backgroundFillMode,
    backgroundSourceOpacity: sourcePreviewOpacity,
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
  };
}
