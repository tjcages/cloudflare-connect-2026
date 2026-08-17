import {
  normalizeTwizzlerSettings,
  type TwizzlerSettings,
} from "@tjcages/connect-twizzler";
import { CONNECT_HERO_TWIZZLER_DEFAULTS } from "./twizzler-defaults";

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

export type TwizzlerControlSettings = Pick<
  TwizzlerSettings,
  (typeof TWIZZLER_CONTROL_KEYS)[number]
>;

const projectControlSettings = (
  source: TwizzlerSettings
): TwizzlerControlSettings => {
  const projected = {} as Record<string, unknown>;
  for (const key of TWIZZLER_CONTROL_KEYS) projected[key] = source[key];
  return projected as TwizzlerControlSettings;
};

export const CONNECT_TWIZZLER_CONTROL_DEFAULTS: TwizzlerControlSettings =
  projectControlSettings(CONNECT_HERO_TWIZZLER_DEFAULTS);

export const cloneTwizzlerControlSettings = (
  settings: TwizzlerControlSettings = CONNECT_TWIZZLER_CONTROL_DEFAULTS
): TwizzlerControlSettings => ({
  ...settings,
  gradientStops: settings.gradientStops.map((stop) => ({ ...stop })),
});

export const resolveConnectTwizzlerSettings = (
  values: TwizzlerControlSettings
): TwizzlerSettings =>
  normalizeTwizzlerSettings({
    ...CONNECT_HERO_TWIZZLER_DEFAULTS,
    ...values,
  });
