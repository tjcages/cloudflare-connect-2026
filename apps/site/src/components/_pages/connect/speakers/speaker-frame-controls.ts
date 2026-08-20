import type { EngineConfig } from "@necatikcl/stripes-engine";
import { connectSpeakers } from "../data";
import { SPEAKER_SHADER_CONFIG } from "./speaker-shader-config";

export const SPEAKER_FRAME_VARIANT_IDS = ["grey", "orange"] as const;
export type SpeakerFrameVariantId = (typeof SPEAKER_FRAME_VARIANT_IDS)[number];
/** The pointer-owned viewfinder clips and distorts this look only. */
export const SPEAKER_POINTER_VARIANT: SpeakerFrameVariantId = "grey";

export type SpeakerStripeControl = {
  id: string;
  color: string;
  startFrom: number;
  width: number;
  opacity: number;
};

export type SpeakerFramePlacement = {
  id: string;
  imageIndex: number;
  variant: SpeakerFrameVariantId;
  x: number;
  y: number;
  width: number;
  height: number;
  span: boolean;
};

export type SpeakerFrameGridLook = {
  cellWidth: number;
  cellHeight: number;
  gapX: number;
  gapY: number;
  cornerRadius: number;
  overlapAmount: number;
  orientation: "vertical" | "horizontal";
  angleDeg: number;
  fieldScale: number;
};

export type SpeakerFrameVariantLook = {
  stripes: SpeakerStripeControl[];
  brightness: number;
  exposure: number;
  contrast: number;
  blackPoint: number;
  whitePoint: number;
  gamma: number;
  invert: boolean;
  bgColor: string;
  /** When set, this look uses its own stripe grid instead of the shared overlay geometry. */
  grid?: SpeakerFrameGridLook;
};

export type SpeakerFrameSettings = {
  placements: SpeakerFramePlacement[];
  cursorWidth: number;
  cursorHeight: number;
  cursorFollow: number;
  shaderOpacity: number;
  gridCellWidth: number;
  gridCellHeight: number;
  gridGapX: number;
  gridGapY: number;
  gridCornerRadius: number;
  gridOverlap: number;
  gridOrientation: "vertical" | "horizontal";
  gridAngle: number;
  stripesEnabled: boolean;
  fieldScale: number;
  orange: SpeakerFrameVariantLook;
  dark: SpeakerFrameVariantLook;
  grey: SpeakerFrameVariantLook;
  posterizeLevels: number;
  thresholdBias: number;
  noiseAmount: number;
  blurRadius: number;
  sharpenAmount: number;
  sparkleWidthEnabled: boolean;
  sparkleWidthCoverage: number;
  sparkleSwing: number;
  sparkleStripeEnabled: boolean;
  sparkleStripeCoverage: number;
  sparkleBrightness: number;
  sparkleSpeed: number;
  sparkleHueDrift: number;
  sparkleSaturation: number;
  dotsEnabled: boolean;
  dotsDensity: number;
  dotsVisibility: number;
  dotsSize: number;
  dotsBrightness: number;
  dotsHueDrift: number;
  dotsSaturation: number;
  borderEnabled: boolean;
  borderMinWidth: number;
  borderDensity: number;
  gridLinesEnabled: boolean;
  gridLinesBrightness: number;
  gridLinesDensity: number;
  engineFramesEnabled: boolean;
  engineFrameThreshold: number;
  engineFrameStripeCount: number;
  engineFrameDistance: number;
  engineFrameColor: string;
  trailEnabled: boolean;
  trailRadius: number;
  trailAlpha: number;
  trailLife: number;
  trailPush: number;
  colorMode: "luminance" | "colors";
  stripeBlendMode: string;
  imageColorLightness: number;
  imageColorDensity: number;
  imageColorRemoveThin: number;
  imageColorBoostThick: number;
  renderMode: string;
  renderIntensity: number;
  renderParamA: number;
  renderParamB: number;
  renderParamC: number;
  renderParamD: number;
  renderColorA: string;
  renderColorB: string;
};

export const SPEAKER_IMAGE_COUNT = connectSpeakers.length;
export const MAX_SPEAKER_FRAME_PLACEMENTS = 48;
export const SPEAKER_FRAME_PANEL_ID = "connect-speaker-frames-v7";
export const LEGACY_SPEAKER_FRAME_PANEL_IDS = [
  "connect-speaker-frames-v6",
  "connect-speaker-frames-v5",
  "connect-speaker-frames-v4",
  "connect-speaker-frames-v3",
  "connect-speaker-frames-v2",
  "connect-speaker-frames-v1",
] as const;
export const SPEAKER_FRAME_SETTINGS_EVENT = "connect:speaker-frame-settings";

const GREY_STRIPE_COLORS = [
  "#f5f5f5",
  "#e6e6e6",
  "#cfcfcf",
  "#b3b3b3",
  "#7a7a7a",
  "#3d3d3d",
  "#2a2a2a",
  "#d0d0d0",
  "#d0d0d0",
  "#b8b8b8",
] as const;

const toHex = (color: number) => `#${color.toString(16).padStart(6, "0")}`;

export const hexToColorNumber = (value: string, fallback: number) => {
  const normalized = value.trim().replace(/^#/, "");
  if (!/^[\da-f]{6}$/i.test(normalized)) return fallback;
  return Number.parseInt(normalized, 16);
};

export const SPEAKER_ORANGE_BG = "#f46021";
export const SPEAKER_DARK_BG = "#141414";
export const SPEAKER_OVERLAY_BG = "#d6d6d6";

type SpeakerLabStripeStop = {
  color: number;
  startFrom: number;
  width: number;
  opacity: number;
};

/** Lab-authored pane stripe shape (orange and dark share this geometry). */
const SPEAKER_ORANGE_STRIPE_STOPS: readonly SpeakerLabStripeStop[] = [
  { color: 16_541_739, startFrom: 0, width: 0.5, opacity: 1 },
  { color: 16_738_304, startFrom: 0.0195, width: 0.5, opacity: 1 },
  { color: 16_738_816, startFrom: 0.047, width: 1, opacity: 1 },
  { color: 16_740_352, startFrom: 0.086, width: 1.5, opacity: 1 },
  { color: 16_742_912, startFrom: 0.1408, width: 1.5, opacity: 1 },
  { color: 16_746_240, startFrom: 0.2167, width: 2, opacity: 1 },
  { color: 16_749_824, startFrom: 0.3191, width: 2.5, opacity: 1 },
  { color: 16_753_664, startFrom: 0.4512, width: 3, opacity: 1 },
  { color: 16_759_829, startFrom: 0.6129, width: 3.5, opacity: 1 },
  { color: 16_764_259, startFrom: 0.8, width: 4, opacity: 1 },
];

const SPEAKER_DARK_STRIPE_STOPS: readonly SpeakerLabStripeStop[] = [
  { color: 2_494_726, startFrom: 0, width: 0.5, opacity: 1 },
  { color: 3_347_975, startFrom: 0.0195, width: 0.5, opacity: 1 },
  { color: 4_464_653, startFrom: 0.047, width: 1, opacity: 1 },
  { color: 5_973_518, startFrom: 0.086, width: 1.5, opacity: 1 },
  { color: 9_054_977, startFrom: 0.1408, width: 1.5, opacity: 1 },
  { color: 11_745_286, startFrom: 0.2167, width: 2, opacity: 1 },
  { color: 16_015_393, startFrom: 0.3191, width: 2.5, opacity: 1 },
  { color: 16_280_064, startFrom: 0.4512, width: 3, opacity: 1 },
  { color: 16_746_553, startFrom: 0.6129, width: 3.5, opacity: 1 },
  { color: 16_752_731, startFrom: 0.8, width: 4, opacity: 1 },
];

export const SPEAKER_PANE_GRID: SpeakerFrameGridLook = {
  cellWidth: 7,
  cellHeight: 7,
  gapX: 0,
  gapY: 0,
  cornerRadius: 0,
  overlapAmount: 1.2,
  orientation: "vertical",
  angleDeg: 0,
  fieldScale: 1,
};

const stripesFromStops = (stops: readonly SpeakerLabStripeStop[], idPrefix: string): SpeakerStripeControl[] =>
  stops.map((stripe, index) => ({
    id: `${idPrefix}-${index + 1}`,
    color: toHex(stripe.color),
    startFrom: stripe.startFrom,
    width: stripe.width,
    opacity: stripe.opacity,
  }));

const defaultOrangeStripes = (): SpeakerStripeControl[] => stripesFromStops(SPEAKER_ORANGE_STRIPE_STOPS, "stripe");

const defaultDarkStripes = (): SpeakerStripeControl[] => stripesFromStops(SPEAKER_DARK_STRIPE_STOPS, "dark-stripe");

const defaultGreyStripes = (): SpeakerStripeControl[] =>
  SPEAKER_SHADER_CONFIG.stripes.map((stripe, index) => ({
    id: `grey-stripe-${index + 1}`,
    color: GREY_STRIPE_COLORS[index % GREY_STRIPE_COLORS.length],
    startFrom: stripe.startFrom,
    width: stripe.width,
    opacity: stripe.opacity,
  }));

const defaultOrangeLook = (): SpeakerFrameVariantLook => ({
  stripes: defaultOrangeStripes(),
  brightness: SPEAKER_SHADER_CONFIG.adjustments.brightness,
  exposure: SPEAKER_SHADER_CONFIG.adjustments.exposure,
  contrast: SPEAKER_SHADER_CONFIG.adjustments.contrast,
  blackPoint: SPEAKER_SHADER_CONFIG.adjustments.blackPoint,
  whitePoint: SPEAKER_SHADER_CONFIG.adjustments.whitePoint,
  gamma: SPEAKER_SHADER_CONFIG.adjustments.gamma,
  invert: false,
  bgColor: SPEAKER_ORANGE_BG,
  grid: { ...SPEAKER_PANE_GRID },
});

const defaultDarkLook = (): SpeakerFrameVariantLook => ({
  stripes: defaultDarkStripes(),
  brightness: 0.55,
  exposure: 1.05,
  contrast: SPEAKER_SHADER_CONFIG.adjustments.contrast,
  blackPoint: SPEAKER_SHADER_CONFIG.adjustments.blackPoint,
  whitePoint: SPEAKER_SHADER_CONFIG.adjustments.whitePoint,
  gamma: SPEAKER_SHADER_CONFIG.adjustments.gamma,
  invert: false,
  bgColor: SPEAKER_DARK_BG,
  grid: { ...SPEAKER_PANE_GRID },
});

const defaultGreyLook = (): SpeakerFrameVariantLook => ({
  stripes: defaultGreyStripes(),
  brightness: 0.42,
  exposure: 0.95,
  contrast: 1.12,
  blackPoint: SPEAKER_SHADER_CONFIG.adjustments.blackPoint,
  whitePoint: SPEAKER_SHADER_CONFIG.adjustments.whitePoint,
  gamma: 0.88,
  invert: false,
  bgColor: SPEAKER_OVERLAY_BG,
});

const placement = (
  id: string,
  imageIndex: number,
  variant: SpeakerFrameVariantId,
  x: number,
  y: number,
  width: number,
  height: number,
  span = false,
): SpeakerFramePlacement => ({
  id,
  imageIndex,
  variant,
  x,
  y,
  width,
  height,
  span,
});

export const defaultSpeakerFramePlacements = (): SpeakerFramePlacement[] =>
  connectSpeakers.flatMap((_, imageIndex) => [
    placement(`${imageIndex}-overlay`, imageIndex, "grey", 0, 0, 0.8, 1),
    placement(`${imageIndex}-inverted`, imageIndex, "orange", 0.8, 0, 0.2, 1),
  ]);

export const createSpeakerFramePlacement = (imageIndex = 0): SpeakerFramePlacement =>
  placement(
    `frame-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    imageIndex,
    "orange",
    0.8,
    0,
    0.2,
    1,
  );

const parseSpeakerFrameVariant = (value: unknown): SpeakerFrameVariantId | null => {
  if (value === "orange" || value === "grey") return value;
  return null;
};

export const isSpeakerFrameVariant = (value: unknown): value is SpeakerFrameVariantId =>
  value === "orange" || value === "grey";

const unusedVariant = (value: never): never => {
  throw new Error(`Unhandled speaker frame variant: ${String(value)}`);
};

export const speakerVariantLook = (
  settings: SpeakerFrameSettings,
  variant: SpeakerFrameVariantId,
): SpeakerFrameVariantLook => {
  switch (variant) {
    case "orange":
      return settings.orange;
    case "grey":
      return settings.grey;
    default:
      return unusedVariant(variant);
  }
};

export const speakerVariantBgNumber = (
  settings: SpeakerFrameSettings,
  variant: SpeakerFrameVariantId,
): number => {
  const hex = speakerVariantLook(settings, variant).bgColor;
  switch (variant) {
    case "orange":
      return hexToColorNumber(hex, 0xf4_60_21);
    case "grey":
      return hexToColorNumber(hex, 0xd6_d6_d6);
    default:
      return unusedVariant(variant);
  }
};

export const SPEAKER_FRAME_DEFAULTS: SpeakerFrameSettings = {
  placements: defaultSpeakerFramePlacements(),
  cursorWidth: 1,
  cursorHeight: 1,
  cursorFollow: 0.22,
  shaderOpacity: 0.56,
  gridCellWidth: SPEAKER_SHADER_CONFIG.grid.cellWidth,
  gridCellHeight: SPEAKER_SHADER_CONFIG.grid.cellHeight,
  gridGapX: SPEAKER_SHADER_CONFIG.grid.gapX,
  gridGapY: SPEAKER_SHADER_CONFIG.grid.gapY,
  gridCornerRadius: SPEAKER_SHADER_CONFIG.grid.cornerRadius,
  gridOverlap: SPEAKER_SHADER_CONFIG.grid.overlapAmount,
  gridOrientation: SPEAKER_SHADER_CONFIG.grid.orientation,
  gridAngle: SPEAKER_SHADER_CONFIG.grid.angleDeg,
  stripesEnabled: SPEAKER_SHADER_CONFIG.stripesEnabled,
  fieldScale: SPEAKER_SHADER_CONFIG.fieldScale,
  orange: defaultOrangeLook(),
  dark: defaultDarkLook(),
  grey: defaultGreyLook(),
  posterizeLevels: SPEAKER_SHADER_CONFIG.adjustments.posterizeLevels,
  thresholdBias: SPEAKER_SHADER_CONFIG.adjustments.thresholdBias,
  noiseAmount: SPEAKER_SHADER_CONFIG.adjustments.noiseAmount,
  blurRadius: SPEAKER_SHADER_CONFIG.adjustments.blurRadius,
  sharpenAmount: SPEAKER_SHADER_CONFIG.adjustments.sharpenAmount,
  sparkleWidthEnabled: SPEAKER_SHADER_CONFIG.sparkle.width.enabled,
  sparkleWidthCoverage: SPEAKER_SHADER_CONFIG.sparkle.width.coverage,
  sparkleSwing: SPEAKER_SHADER_CONFIG.sparkle.width.swingPx,
  sparkleStripeEnabled: SPEAKER_SHADER_CONFIG.sparkle.stripe.enabled,
  sparkleStripeCoverage: SPEAKER_SHADER_CONFIG.sparkle.stripe.coverage,
  sparkleBrightness: SPEAKER_SHADER_CONFIG.sparkle.stripe.maxBrightness,
  sparkleSpeed: SPEAKER_SHADER_CONFIG.sparkle.stripe.speed,
  sparkleHueDrift: SPEAKER_SHADER_CONFIG.sparkle.stripe.hueDriftDeg,
  sparkleSaturation: SPEAKER_SHADER_CONFIG.sparkle.stripe.saturationBoost,
  dotsEnabled: SPEAKER_SHADER_CONFIG.stripeDots.enabled,
  dotsDensity: SPEAKER_SHADER_CONFIG.stripeDots.density,
  dotsVisibility: SPEAKER_SHADER_CONFIG.stripeDots.randomVisibility,
  dotsSize: SPEAKER_SHADER_CONFIG.stripeDots.sizePx,
  dotsBrightness: SPEAKER_SHADER_CONFIG.stripeDots.brightness,
  dotsHueDrift: SPEAKER_SHADER_CONFIG.stripeDots.hueDriftDeg,
  dotsSaturation: SPEAKER_SHADER_CONFIG.stripeDots.saturationBoost,
  borderEnabled: SPEAKER_SHADER_CONFIG.stripeBorder.enabled,
  borderMinWidth: SPEAKER_SHADER_CONFIG.stripeBorder.minWidthPx,
  borderDensity: SPEAKER_SHADER_CONFIG.stripeBorder.density,
  gridLinesEnabled: SPEAKER_SHADER_CONFIG.gridLines.enabled,
  gridLinesBrightness: SPEAKER_SHADER_CONFIG.gridLines.brightness,
  gridLinesDensity: SPEAKER_SHADER_CONFIG.gridLines.density,
  engineFramesEnabled: SPEAKER_SHADER_CONFIG.frames.enabled,
  engineFrameThreshold: SPEAKER_SHADER_CONFIG.frames.luminanceThreshold,
  engineFrameStripeCount: SPEAKER_SHADER_CONFIG.frames.highlightedStripeCount,
  engineFrameDistance: SPEAKER_SHADER_CONFIG.frames.groupDistanceCells,
  engineFrameColor: toHex(SPEAKER_SHADER_CONFIG.frames.color),
  trailEnabled: SPEAKER_SHADER_CONFIG.cursorTrail.enabled,
  trailRadius: SPEAKER_SHADER_CONFIG.cursorTrail.particleRadius,
  trailAlpha: SPEAKER_SHADER_CONFIG.cursorTrail.particleAlpha,
  trailLife: SPEAKER_SHADER_CONFIG.cursorTrail.particleLifeMs,
  trailPush: SPEAKER_SHADER_CONFIG.cursorTrail.pushStrengthPx,
  colorMode: SPEAKER_SHADER_CONFIG.colors.mode,
  stripeBlendMode: SPEAKER_SHADER_CONFIG.colors.stripeBlendMode,
  imageColorLightness: SPEAKER_SHADER_CONFIG.colors.imageColorLightness,
  imageColorDensity: SPEAKER_SHADER_CONFIG.colors.imageColorDensity,
  imageColorRemoveThin: SPEAKER_SHADER_CONFIG.colors.imageColorRemoveThin,
  imageColorBoostThick: SPEAKER_SHADER_CONFIG.colors.imageColorBoostThick,
  renderMode: SPEAKER_SHADER_CONFIG.renderMode,
  renderIntensity: SPEAKER_SHADER_CONFIG.renderIntensity,
  renderParamA: SPEAKER_SHADER_CONFIG.renderParams[0],
  renderParamB: SPEAKER_SHADER_CONFIG.renderParams[1],
  renderParamC: SPEAKER_SHADER_CONFIG.renderParams[2],
  renderParamD: SPEAKER_SHADER_CONFIG.renderParams[3],
  renderColorA: toHex(SPEAKER_SHADER_CONFIG.renderColorA),
  renderColorB: toHex(SPEAKER_SHADER_CONFIG.renderColorB),
};

const cloneVariantLook = (look: SpeakerFrameVariantLook): SpeakerFrameVariantLook => ({
  ...look,
  stripes: look.stripes.map((stripe) => ({ ...stripe })),
  grid: look.grid ? { ...look.grid } : undefined,
});

const cloneDefaults = (): SpeakerFrameSettings => ({
  ...SPEAKER_FRAME_DEFAULTS,
  placements: defaultSpeakerFramePlacements(),
  orange: cloneVariantLook(SPEAKER_FRAME_DEFAULTS.orange),
  dark: cloneVariantLook(SPEAKER_FRAME_DEFAULTS.dark),
  grey: cloneVariantLook(SPEAKER_FRAME_DEFAULTS.grey),
});

const isStripe = (value: unknown): value is SpeakerStripeControl => {
  if (!value || typeof value !== "object") return false;
  const stripe = value as Partial<SpeakerStripeControl>;
  return (
    typeof stripe.id === "string" &&
    typeof stripe.color === "string" &&
    typeof stripe.startFrom === "number" &&
    typeof stripe.width === "number" &&
    typeof stripe.opacity === "number"
  );
};

const sanitizeStripes = (value: unknown, fallback: SpeakerStripeControl[]): SpeakerStripeControl[] => {
  if (!Array.isArray(value)) return fallback.map((stripe) => ({ ...stripe }));
  const stripes = value.filter(isStripe).slice(0, 24);
  return stripes.length > 0 ? stripes.map((stripe) => ({ ...stripe })) : fallback.map((stripe) => ({ ...stripe }));
};

const sanitizeNumber = (value: unknown, fallback: number) =>
  typeof value === "number" && Number.isFinite(value) ? value : fallback;

const sanitizeOrientation = (
  value: unknown,
  fallback: SpeakerFrameGridLook["orientation"],
): SpeakerFrameGridLook["orientation"] => {
  if (value === "vertical" || value === "horizontal") return value;
  return fallback;
};

const sharedGridLook = (settings: SpeakerFrameSettings): SpeakerFrameGridLook => ({
  cellWidth: settings.gridCellWidth,
  cellHeight: settings.gridCellHeight,
  gapX: settings.gridGapX,
  gapY: settings.gridGapY,
  cornerRadius: settings.gridCornerRadius,
  overlapAmount: settings.gridOverlap,
  orientation: settings.gridOrientation,
  angleDeg: settings.gridAngle,
  fieldScale: settings.fieldScale,
});

const sanitizeGridLook = (
  value: unknown,
  fallback: SpeakerFrameGridLook | undefined,
): SpeakerFrameGridLook | undefined => {
  if (!value || typeof value !== "object") {
    return fallback ? { ...fallback } : undefined;
  }
  const parsed = value as Partial<SpeakerFrameGridLook>;
  const defaults = fallback ?? SPEAKER_PANE_GRID;
  return {
    cellWidth: sanitizeNumber(parsed.cellWidth, defaults.cellWidth),
    cellHeight: sanitizeNumber(parsed.cellHeight, defaults.cellHeight),
    gapX: sanitizeNumber(parsed.gapX, defaults.gapX),
    gapY: sanitizeNumber(parsed.gapY, defaults.gapY),
    cornerRadius: sanitizeNumber(parsed.cornerRadius, defaults.cornerRadius),
    overlapAmount: sanitizeNumber(parsed.overlapAmount, defaults.overlapAmount),
    orientation: sanitizeOrientation(parsed.orientation, defaults.orientation),
    angleDeg: sanitizeNumber(parsed.angleDeg, defaults.angleDeg),
    fieldScale: sanitizeNumber(parsed.fieldScale, defaults.fieldScale),
  };
};

export const speakerVariantGridLook = (
  settings: SpeakerFrameSettings,
  look: SpeakerFrameVariantLook,
): SpeakerFrameGridLook => look.grid ?? sharedGridLook(settings);

const sanitizeHex = (value: unknown, fallback: string) => {
  if (typeof value !== "string") return fallback;
  const normalized = value.trim().replace(/^#/, "");
  if (!/^[\da-f]{6}$/i.test(normalized)) return fallback;
  return `#${normalized.toLowerCase()}`;
};

const sanitizeVariantLook = (value: unknown, fallback: SpeakerFrameVariantLook): SpeakerFrameVariantLook => {
  const parsed = value && typeof value === "object" ? (value as Partial<SpeakerFrameVariantLook>) : {};
  const grid = sanitizeGridLook(parsed.grid, fallback.grid);
  return {
    stripes: sanitizeStripes(parsed.stripes, fallback.stripes),
    brightness: sanitizeNumber(parsed.brightness, fallback.brightness),
    exposure: sanitizeNumber(parsed.exposure, fallback.exposure),
    contrast: sanitizeNumber(parsed.contrast, fallback.contrast),
    blackPoint: sanitizeNumber(parsed.blackPoint, fallback.blackPoint),
    whitePoint: sanitizeNumber(parsed.whitePoint, fallback.whitePoint),
    gamma: sanitizeNumber(parsed.gamma, fallback.gamma),
    invert: typeof parsed.invert === "boolean" ? parsed.invert : fallback.invert,
    bgColor: sanitizeHex(parsed.bgColor, fallback.bgColor),
    ...(grid ? { grid } : {}),
  };
};

const sanitizePlacement = (value: unknown): SpeakerFramePlacement | null => {
  if (!value || typeof value !== "object") return null;
  const parsed = value as Partial<SpeakerFramePlacement>;
  if (typeof parsed.id !== "string" || parsed.id.length === 0) return null;
  const variant = parseSpeakerFrameVariant(parsed.variant);
  if (!variant) return null;
  const imageIndex = Math.round(sanitizeNumber(parsed.imageIndex, 0));
  if (imageIndex < 0 || imageIndex >= SPEAKER_IMAGE_COUNT) return null;
  const width = sanitizeNumber(parsed.width, 0);
  const height = sanitizeNumber(parsed.height, 0);
  if (width <= 0 || height <= 0) return null;
  return {
    id: parsed.id,
    imageIndex,
    variant,
    x: sanitizeNumber(parsed.x, 0),
    y: sanitizeNumber(parsed.y, 0),
    width,
    height,
    span: parsed.span === true,
  };
};

export const sanitizeSpeakerFramePlacements = (value: unknown): SpeakerFramePlacement[] => {
  if (!Array.isArray(value)) return defaultSpeakerFramePlacements();
  const placements = value
    .map(sanitizePlacement)
    .filter((placement): placement is SpeakerFramePlacement => placement !== null)
    .slice(0, MAX_SPEAKER_FRAME_PLACEMENTS);
  return placements.length > 0 ? placements : defaultSpeakerFramePlacements();
};

const isStripRecord = (value: unknown, x: number, variant: string) => {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  return (
    record.variant === variant &&
    record.x === x &&
    record.y === 0 &&
    record.width === 0.1 &&
    record.height === 1 &&
    record.span !== true
  );
};

/** Factory two-pane wipers (left or right rest) before the 80% image overlay existed. */
const isRawFactoryTwoPaneWipers = (value: unknown) => {
  if (!Array.isArray(value) || value.length !== SPEAKER_IMAGE_COUNT * 2) return false;
  return connectSpeakers.every((_, imageIndex) => {
    const pair = value.filter((item) => item && typeof item === "object" && (item as { imageIndex?: number }).imageIndex === imageIndex);
    if (pair.length !== 2) return false;
    const orange = pair.find((item) => (item as { variant?: string }).variant === "orange");
    const edge = pair.find((item) => {
      const variant = (item as { variant?: string }).variant;
      return variant === "dark" || variant === "white";
    });
    if (!orange || !edge) return false;
    return (
      (isStripRecord(orange, 0, "orange") && (isStripRecord(edge, 0.1, "dark") || isStripRecord(edge, 0.1, "white"))) ||
      (isStripRecord(orange, 0.8, "orange") && (isStripRecord(edge, 0.9, "dark") || isStripRecord(edge, 0.9, "white")))
    );
  });
};

const isRawThreeFrameWithDark = (value: unknown) => {
  if (!Array.isArray(value) || value.length !== SPEAKER_IMAGE_COUNT * 3) return false;
  return connectSpeakers.every((_, imageIndex) => {
    const frames = value.filter((item) => item && typeof item === "object" && (item as { imageIndex?: number }).imageIndex === imageIndex);
    if (frames.length !== 3) return false;
    const variants = frames.map((item) => (item as { variant?: string }).variant);
    return variants.includes("grey") && variants.includes("orange") && (variants.includes("dark") || variants.includes("white"));
  });
};

const expandOrangeAfterDroppedDark = (placements: SpeakerFramePlacement[]) => {
  const byImage = new Map<number, SpeakerFramePlacement[]>();
  for (const placement of placements) {
    const list = byImage.get(placement.imageIndex) ?? [];
    list.push(placement);
    byImage.set(placement.imageIndex, list);
  }
  if (![...byImage.values()].every((list) => list.length === 2)) return placements;
  return placements.map((placement) => {
    if (placement.variant !== "orange" || placement.x !== 0.8 || placement.width !== 0.1) return placement;
    if (placement.y !== 0 || placement.height !== 1 || placement.span) return placement;
    return { ...placement, width: 0.2 };
  });
};

export const speakerSharedEngineConfig = (settings: SpeakerFrameSettings): Partial<EngineConfig> => ({
  grid: {
    ...SPEAKER_SHADER_CONFIG.grid,
    cellWidth: settings.gridCellWidth,
    cellHeight: settings.gridCellHeight,
    gapX: settings.gridGapX,
    gapY: settings.gridGapY,
    cornerRadius: settings.gridCornerRadius,
    overlapAmount: settings.gridOverlap,
    orientation: settings.gridOrientation,
    angleDeg: settings.gridAngle,
  },
  stripesEnabled: settings.stripesEnabled,
  fieldScale: settings.fieldScale,
  sparkle: {
    ...SPEAKER_SHADER_CONFIG.sparkle,
    width: {
      ...SPEAKER_SHADER_CONFIG.sparkle.width,
      enabled: settings.sparkleWidthEnabled,
      coverage: settings.sparkleWidthCoverage,
      swingPx: settings.sparkleSwing,
    },
    stripe: {
      ...SPEAKER_SHADER_CONFIG.sparkle.stripe,
      enabled: settings.sparkleStripeEnabled,
      coverage: settings.sparkleStripeCoverage,
      maxBrightness: settings.sparkleBrightness,
      speed: settings.sparkleSpeed,
      hueDriftDeg: settings.sparkleHueDrift,
      saturationBoost: settings.sparkleSaturation,
    },
  },
  stripeDots: {
    ...SPEAKER_SHADER_CONFIG.stripeDots,
    enabled: settings.dotsEnabled,
    density: settings.dotsDensity,
    randomVisibility: settings.dotsVisibility,
    sizePx: settings.dotsSize,
    brightness: settings.dotsBrightness,
    hueDriftDeg: settings.dotsHueDrift,
    saturationBoost: settings.dotsSaturation,
  },
  stripeBorder: {
    ...SPEAKER_SHADER_CONFIG.stripeBorder,
    enabled: settings.borderEnabled,
    minWidthPx: settings.borderMinWidth,
    density: settings.borderDensity,
  },
  gridLines: {
    ...SPEAKER_SHADER_CONFIG.gridLines,
    enabled: settings.gridLinesEnabled,
    brightness: settings.gridLinesBrightness,
    density: settings.gridLinesDensity,
  },
  frames: {
    ...SPEAKER_SHADER_CONFIG.frames,
    enabled: settings.engineFramesEnabled,
    luminanceThreshold: settings.engineFrameThreshold,
    highlightedStripeCount: settings.engineFrameStripeCount,
    groupDistanceCells: settings.engineFrameDistance,
    color: hexToColorNumber(settings.engineFrameColor, SPEAKER_SHADER_CONFIG.frames.color),
  },
  cursorTrail: {
    ...SPEAKER_SHADER_CONFIG.cursorTrail,
    enabled: settings.trailEnabled,
    particleRadius: settings.trailRadius,
    particleAlpha: settings.trailAlpha,
    particleLifeMs: settings.trailLife,
    pushStrengthPx: settings.trailPush,
  },
  colors: {
    ...SPEAKER_SHADER_CONFIG.colors,
    mode: settings.colorMode,
    stripeBlendMode: settings.stripeBlendMode as EngineConfig["colors"]["stripeBlendMode"],
    imageColorLightness: settings.imageColorLightness,
    imageColorDensity: settings.imageColorDensity,
    imageColorRemoveThin: settings.imageColorRemoveThin,
    imageColorBoostThick: settings.imageColorBoostThick,
  },
  renderMode: settings.renderMode as EngineConfig["renderMode"],
  renderIntensity: settings.renderIntensity,
  renderParams: [settings.renderParamA, settings.renderParamB, settings.renderParamC, settings.renderParamD],
  renderColorA: hexToColorNumber(settings.renderColorA, SPEAKER_SHADER_CONFIG.renderColorA),
  renderColorB: hexToColorNumber(settings.renderColorB, SPEAKER_SHADER_CONFIG.renderColorB),
  background: {
    ...SPEAKER_SHADER_CONFIG.background,
    stars: { ...SPEAKER_SHADER_CONFIG.background.stars, enabled: false },
    meteors: { ...SPEAKER_SHADER_CONFIG.background.meteors, enabled: false },
  },
});

export const speakerVariantEngineConfig = (
  settings: SpeakerFrameSettings,
  variant: SpeakerFrameVariantId,
): Partial<EngineConfig> => {
  const look = speakerVariantLook(settings, variant);
  const grid = speakerVariantGridLook(settings, look);
  return {
    stripes: look.stripes.map((stripe) => ({
      color: hexToColorNumber(stripe.color, SPEAKER_SHADER_CONFIG.stripes[0].color),
      startFrom: stripe.startFrom,
      width: stripe.width,
      opacity: stripe.opacity,
    })),
    grid: {
      ...SPEAKER_SHADER_CONFIG.grid,
      cellWidth: grid.cellWidth,
      cellHeight: grid.cellHeight,
      gapX: grid.gapX,
      gapY: grid.gapY,
      cornerRadius: grid.cornerRadius,
      overlapAmount: grid.overlapAmount,
      orientation: grid.orientation,
      angleDeg: grid.angleDeg,
    },
    fieldScale: grid.fieldScale,
    adjustments: {
      ...SPEAKER_SHADER_CONFIG.adjustments,
      brightness: look.brightness,
      exposure: look.exposure,
      contrast: look.contrast,
      blackPoint: look.blackPoint,
      whitePoint: look.whitePoint,
      gamma: look.gamma,
      invert: look.invert,
      posterizeLevels: settings.posterizeLevels,
      thresholdBias: settings.thresholdBias,
      noiseAmount: settings.noiseAmount,
      blurRadius: settings.blurRadius,
      sharpenAmount: settings.sharpenAmount,
    },
  };
};

const readStoredSettings = (): unknown => {
  const keys = [`panels:${SPEAKER_FRAME_PANEL_ID}`, ...LEGACY_SPEAKER_FRAME_PANEL_IDS.map((id) => `panels:${id}`)];
  for (const key of keys) {
    const raw = localStorage.getItem(key);
    if (raw) return JSON.parse(raw);
  }
  return null;
};

const mergeSharedSettings = (settings: SpeakerFrameSettings, parsed: Record<string, unknown>) => {
  const skip = new Set([
    "placements",
    "orange",
    "dark",
    "white",
    "grey",
    "stripes",
    "brightness",
    "exposure",
    "contrast",
    "blackPoint",
    "whitePoint",
    "gamma",
    "invert",
    "frameCount",
    "frameWidth",
    "frameHeight",
    "horizontalSpeed",
    "verticalSpeed",
  ]);
  for (const key of Object.keys(settings) as (keyof SpeakerFrameSettings)[]) {
    if (skip.has(key)) continue;
    const value = parsed[key];
    const fallback = settings[key];
    if (typeof value === typeof fallback) {
      (settings as Record<string, unknown>)[key] = value;
    }
  }
};

export const loadSpeakerFrameSettings = (): SpeakerFrameSettings => {
  const settings = cloneDefaults();
  try {
    const parsed = readStoredSettings();
    if (!parsed || typeof parsed !== "object") return settings;
    const record = parsed as Record<string, unknown>;
    mergeSharedSettings(settings, record);
    const resetPlacements = isRawFactoryTwoPaneWipers(record.placements) || isRawThreeFrameWithDark(record.placements);
    if (resetPlacements) {
      settings.placements = defaultSpeakerFramePlacements();
    } else {
      settings.placements = expandOrangeAfterDroppedDark(sanitizeSpeakerFramePlacements(record.placements));
    }
    if (record.orange && typeof record.orange === "object") {
      settings.orange = sanitizeVariantLook(record.orange, settings.orange);
    } else {
      settings.orange = sanitizeVariantLook(
        {
          stripes: record.stripes,
          brightness: record.brightness,
          exposure: record.exposure,
          contrast: record.contrast,
          blackPoint: record.blackPoint,
          whitePoint: record.whitePoint,
          gamma: record.gamma,
          invert: record.invert,
        },
        settings.orange,
      );
    }
    if (record.grey && typeof record.grey === "object") {
      settings.grey = sanitizeVariantLook(record.grey, settings.grey);
    }
    if (resetPlacements) {
      settings.grey = cloneVariantLook(SPEAKER_FRAME_DEFAULTS.grey);
    }
    const storedDark = [record.dark, record.white].find((value) => value && typeof value === "object");
    if (storedDark) {
      settings.dark = sanitizeVariantLook(storedDark, settings.dark);
    } else {
      settings.dark = sanitizeVariantLook(
        {
          stripes: settings.orange.stripes.map((stripe, index) => ({
            ...stripe,
            id: `dark-stripe-${index + 1}`,
          })),
          invert: false,
        },
        settings.dark,
      );
    }
    return settings;
  } catch {
    return cloneDefaults();
  }
};

export const publishSpeakerFrameSettings = (settings: SpeakerFrameSettings) => {
  window.dispatchEvent(
    new CustomEvent<SpeakerFrameSettings>(SPEAKER_FRAME_SETTINGS_EVENT, {
      detail: settings,
    }),
  );
};
