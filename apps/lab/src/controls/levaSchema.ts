import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useControls, useCreateStore } from "leva";
import { normalizeEngineConfig } from "@necatikcl/stripes-engine";
import type { EngineConfig, Stripe } from "@necatikcl/stripes-engine";
import {
  loadInitialConfig,
  loadLabSettings,
  loadStickyBackgroundColor,
  loadTextureId,
  saveStickyBackgroundColor,
} from "../persistence";
import type { LabSettings } from "../persistence";
import { toEditable } from "./stripeAdapter";
import type { EditableStripe } from "./stripeAdapter";
import { hexToInt, intToHex, normalizeHexString } from "../lib/color";
import { stripeColorsTableRuntime, stripeSyncKey } from "./stripeColorsTablePlugin";
import { DEFAULT_LAB_TEXTURE_ID, buildTextureEntries, findTextureEntry } from "../textures";
import { loadManifest } from "../uploads";
import {
  applyStripePalette,
  BACKGROUND_RAMP_EASING_OPTIONS,
  BACKGROUND_RAMP_PALETTE_NAME,
  WHITE_STRIPE_PALETTE_NAME,
  type BackgroundRampEasing,
  detectStripePalette,
  mapPaletteColor,
  shuffleStripePalette,
  STRIPE_PALETTE_NAMES,
} from "./stripePalette";
import { reverseStripeColors } from "./stripeColorOrder";
import { EASING_OPTIONS, easeValue, parseCustomEasing, type EasingName } from "./easing";
import { loadControlDrawerSnapshot } from "./drawerState";
import { buildTextureSchema } from "./schema/textureSchema";
import { buildShaderSchema } from "./schema/shaderSchema";
import { initialImageColorWidthSource } from "./schema/stripesSchema";
import type { ImageColorWidthSource } from "./schema/stripesSchema";
import { buildEngineConfig } from "./engineConfigAssembly";

const OLD_DEFAULT_STRIPES: Stripe[] = [
  { color: 0xf3f3f3, startFrom: 0.12, width: 1, opacity: 1 },
  { color: 0xfada98, startFrom: 0.28, width: 1, opacity: 1 },
  { color: 0xf8bd70, startFrom: 0.44, width: 2, opacity: 1 },
  { color: 0xf69e4d, startFrom: 0.6, width: 3, opacity: 1 },
  { color: 0xf27c33, startFrom: 0.76, width: 4, opacity: 1 },
  { color: 0xeb5729, startFrom: 0.9, width: 5, opacity: 1 },
];

const DEFAULT_STRIPE_THRESHOLD_MAX = 0.9;
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

function defaultStripeThreshold(index: number, total: number, easing: ThresholdDistributionEasing = "linear"): number {
  if (total <= 1) return 0;
  const t = index / (total - 1);
  return Number((DEFAULT_STRIPE_THRESHOLD_MAX * easeThresholdDistribution(t, easing)).toFixed(4));
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

export interface EngineControlsResult {
  config: EngineConfig;
  backgroundFillMode: "transparent" | "source" | "solid" | "gradient";
  setControl: (values: Record<string, unknown>) => void;
  getLabSettingsSnapshot: () => Partial<LabSettings>;
  textureId: string;
  setTextureId: (id: string) => void;
  textureOptions: TextureOption[];
  textureStore: ReturnType<typeof useCreateStore>;
  shaderStore: ReturnType<typeof useCreateStore>;
}

export function useEngineControls(onReplay: () => void): EngineControlsResult {
  const initialLabSettings = useMemo(() => loadLabSettings(), []);
  const initialTextureId = useMemo(() => {
    const stored = loadTextureId() ?? initialLabSettings.textureId;
    return stored && findTextureEntry(stored, loadManifest()) ? stored : DEFAULT_LAB_TEXTURE_ID;
  }, [initialLabSettings.textureId]);
  const d = useMemo(() => {
    const upgraded = upgradeDefaultStripes(normalizeEngineConfig(loadInitialConfig(initialTextureId)));
    if (!hasAutomaticStripeWidthDistribution(upgraded.stripes)) return upgraded;
    return { ...upgraded, stripes: withDefaultStripeWidths(upgraded.stripes) };
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

  const [stripes, setStripes] = useState<EditableStripe[]>(() => toEditable(d.stripes));
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
    activeGeneratedPalette ?? detectStripePalette(stripes, backgroundHex, backgroundRampEasing) ?? "Custom";
  const stripeKey = stripeSyncKey(stripes);
  const controlSetterRef = useRef<((next: { backgroundColor?: string | null }) => void) | null>(null);
  const backgroundColorRef = useRef<string | null>(backgroundHex);
  const stripePaletteValueRef = useRef(stripePaletteValue);
  const activeGeneratedPaletteRef = useRef(activeGeneratedPalette);
  const backgroundRampEasingRef = useRef(backgroundRampEasing);
  const lastStickyBackgroundRef = useRef(backgroundHex);
  const shaderControlSetterRef = useRef<((values: Record<string, unknown>) => void) | null>(null);

  stripePaletteValueRef.current = stripePaletteValue;
  activeGeneratedPaletteRef.current = activeGeneratedPalette;
  backgroundRampEasingRef.current = backgroundRampEasing;

  const handlePaletteChange = useCallback(
    (palette: string) => {
      if (palette === "Custom") return;
      setPreShuffleStripes(null);
      setActiveGeneratedPalette(palette);
      setStripes((prev) => applyStripePalette(prev, palette, backgroundColorRef.current, backgroundRampEasing));
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
    setBackgroundRampEasing(next);
    setActiveGeneratedPalette(BACKGROUND_RAMP_PALETTE_NAME);
    setPreShuffleStripes(null);
    setStripes((prev) => applyStripePalette(prev, BACKGROUND_RAMP_PALETTE_NAME, backgroundColorRef.current, next));
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
        applyStripePalette(prev, BACKGROUND_RAMP_PALETTE_NAME, next, backgroundRampEasingRef.current),
      );
      return;
    }
    const palette = stripePaletteValueRef.current;
    if (palette && palette !== "Custom" && palette !== WHITE_STRIPE_PALETTE_NAME) {
      setStripes((prev) => applyStripePalette(prev, palette, next, backgroundRampEasingRef.current));
    }
  }, []);

  const handleColorChange = useCallback((id: string, hex: string) => {
    setPreShuffleStripes(null);
    setActiveGeneratedPalette(null);
    setStripes((prev) => prev.map((s) => (s.id === id ? { ...s, hex } : s)));
  }, []);

  const handleThresholdChange = useCallback((id: string, value: number) => {
    setPreShuffleStripes(null);
    setStripes((prev) => prev.map((s) => (s.id === id ? { ...s, startFrom: value } : s)));
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

  useEffect(() => {
    if (activeGeneratedPalette !== BACKGROUND_RAMP_PALETTE_NAME) return;
    setStripes((prev) => applyStripePalette(prev, BACKGROUND_RAMP_PALETTE_NAME, backgroundHex, backgroundRampEasing));
  }, [activeGeneratedPalette, backgroundHex, backgroundRampEasing, stripes.length]);

  stripeColorsTableRuntime.stripes = stripes;
  stripeColorsTableRuntime.disabled = false;
  stripeColorsTableRuntime.paletteOptions = stripePaletteOptions;
  stripeColorsTableRuntime.paletteValue = stripePaletteValue;
  stripeColorsTableRuntime.rampEasingOptions = BACKGROUND_RAMP_EASING_OPTIONS;
  stripeColorsTableRuntime.rampEasingValue = backgroundRampEasing;
  stripeColorsTableRuntime.showRampEasing = stripePaletteValue === BACKGROUND_RAMP_PALETTE_NAME;
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

  const [textureValues, setTextureControl] = useControls(() => buildTextureSchema(d), { store: textureStore }, []);

  const [shaderValues, setShaderControl] = useControls(
    () =>
      buildShaderSchema({
        d,
        initialLabSettings,
        backgroundHex,
        handleBackgroundColorLiveChange,
        stripeKey,
        shaderControlSetterRef,
        onReplay,
      }),
    { store: shaderStore },
    [stripeKey],
  );
  shaderControlSetterRef.current = setShaderControl;
  const values = { ...textureValues, ...shaderValues };
  const textureValuesRef = useRef<Record<string, unknown>>(textureValues);
  textureValuesRef.current = textureValues;
  const shaderValuesRef = useRef<Record<string, unknown>>(shaderValues);
  shaderValuesRef.current = shaderValues;
  const setControl = useCallback(
    (next: Record<string, unknown>) => {
      const textureNext: Record<string, unknown> = {};
      const shaderNext: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(next)) {
        if (key in textureValuesRef.current) textureNext[key] = value;
        else if (key in shaderValuesRef.current) shaderNext[key] = value;
      }
      if (Object.keys(textureNext).length > 0) setTextureControl(textureNext);
      if (Object.keys(shaderNext).length > 0) setShaderControl(shaderNext);
    },
    [setTextureControl, setShaderControl],
  );

  useEffect(() => {
    setTextureControl({ colorsModeMirror: values.colorsMode === "colors" ? "colors" : "luminance" });
  }, [setTextureControl, values.colorsMode]);
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
        applyStripePalette(prev, BACKGROUND_RAMP_PALETTE_NAME, next, backgroundRampEasingRef.current),
      );
      return;
    }
    if (palette && palette !== "Custom" && palette !== WHITE_STRIPE_PALETTE_NAME) {
      setStripes((prev) => applyStripePalette(prev, palette, next, backgroundRampEasingRef.current));
    }
  }, [values.backgroundColor]);

  const lastImageColorWidthSourceRef = useRef<ImageColorWidthSource>(initialImageColorWidthSource(d.colors));
  const lastColorsModeRef = useRef(d.colors.mode);

  useEffect(() => {
    const source = values.imageColorWidthSource as ImageColorWidthSource;
    const mode = values.colorsMode === "colors" ? "colors" : "luminance";
    const switchedIntoImageColors = lastColorsModeRef.current !== "colors" && mode === "colors";
    const switchedWidthSource = lastImageColorWidthSourceRef.current !== source;

    if (mode === "colors" && (switchedIntoImageColors || switchedWidthSource)) {
      setControl({ imageColorLevel: source === "dark" ? 1 : 0 });
    }

    lastColorsModeRef.current = mode;
    lastImageColorWidthSourceRef.current = source;
  }, [setControl, values.colorsMode, values.imageColorWidthSource]);

  const backgroundFillMode =
    values.backgroundFillMode === "gradient" ||
    values.backgroundFillMode === "solid" ||
    values.backgroundFillMode === "transparent" ||
    values.backgroundFillMode === "source"
      ? values.backgroundFillMode
      : d.background.transparent
        ? "transparent"
        : d.background.gradient.enabled
          ? "gradient"
          : "solid";
  const getLabSettingsSnapshot = useCallback(
    (): Partial<LabSettings> => ({
      textureId,
      backgroundFillMode,
      stripePalette: stripePaletteValue,
      backgroundRampEasing,
      thresholdDistributionEasing,
      autoStripeWidths,
      drawerOpen: loadControlDrawerSnapshot(),
    }),
    [
      autoStripeWidths,
      backgroundFillMode,
      backgroundRampEasing,
      stripePaletteValue,
      textureId,
      thresholdDistributionEasing,
    ],
  );
  const configKey = JSON.stringify([values, stripes, backgroundHex]);

  const config = useMemo(
    () => buildEngineConfig({ values, stripes, backgroundHex, backgroundFillMode, d }),
    [configKey],
  );

  return {
    config,
    backgroundFillMode,
    setControl,
    getLabSettingsSnapshot,
    textureId,
    setTextureId,
    textureOptions,
    textureStore,
    shaderStore,
  };
}
