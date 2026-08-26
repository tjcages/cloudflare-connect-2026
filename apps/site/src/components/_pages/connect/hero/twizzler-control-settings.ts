import { normalizeTwizzlerSettings, type TwizzlerSettings } from "@tjcages/connect-twizzler";
import { defaultTwizzlerGradientFieldStops } from "@tjcages/connect-twizzler/gradient";
import { CONNECT_HERO_TWIZZLER_DEFAULTS } from "./twizzler-defaults";

export type ShaderAppearance = "light" | "dark";

export const CONNECT_TWIZZLER_DARK_APPEARANCE = {
  backgroundColor: "#f86a00",
  color: "#ffefd4",
  colorFar: "#ffd39e",
  colorNear: "#ffefd4",
  colorEdge: "#f0f0f0",
} as const;

// Exactly the Twizzler surface the lab's Leva panel exposes — Appearance
// (colors, ribbon color mode, hotspot editor, opacity, zoom) plus the Twizzler
// Shape / Gradients / Stroke / Motion folders. Everything else in
// `TwizzlerSettings` stays at the approved base.
export const TWIZZLER_CONTROL_KEYS = [
  "color",
  "colorFar",
  "colorNear",
  "colorEdge",
  "ribbonColorMode",
  "gradientStops",
  "backgroundColor",
  "opacity",
  "scale",
  "centerY",
  "panX",
  "panY",
  "panZ",
  "amplitude",
  "twist",
  "rotateXDeg",
  "rotateYDeg",
  "rotateZDeg",
  "fov",
  "camDist",
  "perspectiveWidth",
  "lineWidth",
  "minLineWidth",
  "maxLineWidth",
  "lineCount",
  "pointSpacing",
  "gradientXEnabled",
  "gradientXMix",
  "gradientYEnabled",
  "gradientYMix",
  "gradientZEnabled",
  "gradientZStrength",
  "gradientZCenter",
  "gradientZWidth",
  "speed",
] as const;

export type TwizzlerControlSettings = {
  enabled: boolean;
  appearance: ShaderAppearance;
} & Pick<TwizzlerSettings, (typeof TWIZZLER_CONTROL_KEYS)[number]>;

export type ConnectTwizzlerSettings = TwizzlerSettings & {
  enabled: boolean;
  appearance: ShaderAppearance;
};

const projectControlSettings = (source: TwizzlerSettings): TwizzlerControlSettings => {
  const projected = { enabled: true, appearance: "light" } as Record<string, unknown>;
  for (const key of TWIZZLER_CONTROL_KEYS) projected[key] = source[key];
  return projected as TwizzlerControlSettings;
};

export const CONNECT_TWIZZLER_CONTROL_DEFAULTS: TwizzlerControlSettings =
  projectControlSettings(CONNECT_HERO_TWIZZLER_DEFAULTS);

export const cloneTwizzlerControlSettings = (
  settings: TwizzlerControlSettings = CONNECT_TWIZZLER_CONTROL_DEFAULTS,
): TwizzlerControlSettings => ({
  ...settings,
  gradientStops: settings.gradientStops.map((stop) => ({ ...stop })),
});

export const applyTwizzlerAppearance = (
  settings: TwizzlerControlSettings,
  appearance: ShaderAppearance,
): TwizzlerControlSettings => {
  const colors = appearance === "dark" ? CONNECT_TWIZZLER_DARK_APPEARANCE : CONNECT_HERO_TWIZZLER_DEFAULTS;
  return {
    ...settings,
    appearance,
    color: colors.color,
    colorFar: colors.colorFar,
    colorNear: colors.colorNear,
    colorEdge: colors.colorEdge,
    backgroundColor: colors.backgroundColor,
    gradientStops: defaultTwizzlerGradientFieldStops(colors.colorFar, colors.colorNear, colors.colorEdge),
    ribbonColorMode: "sharedGradient",
  };
};

export const resolveConnectTwizzlerSettings = (values: TwizzlerControlSettings): ConnectTwizzlerSettings => {
  const { enabled, appearance, ...settings } = values;
  return {
    ...normalizeTwizzlerSettings({
      ...CONNECT_HERO_TWIZZLER_DEFAULTS,
      ...settings,
    }),
    enabled,
    appearance,
  };
};

export const CONNECT_TWIZZLER_DEFAULT = resolveConnectTwizzlerSettings(CONNECT_TWIZZLER_CONTROL_DEFAULTS);

export const CONNECT_TWIZZLER_PANEL_ID = "connect-twizzler-hero-v3";

/**
 * Panel settings persisted by the dev panel, merged over the authored
 * defaults — or null when this browser has none. Client-only (localStorage).
 */
export const loadConnectTwizzlerControlSettings = (): TwizzlerControlSettings | null => {
  try {
    const raw = localStorage.getItem(`panels:${CONNECT_TWIZZLER_PANEL_ID}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<TwizzlerControlSettings>;
    if (!parsed || typeof parsed !== "object") return null;
    return { ...CONNECT_TWIZZLER_CONTROL_DEFAULTS, ...parsed };
  } catch {
    return null;
  }
};
