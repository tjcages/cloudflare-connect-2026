import type { TwizzlerSettings } from "@tjcages/connect-twizzler";
import { defaultTwizzlerGradientFieldStops } from "@tjcages/connect-twizzler/gradient";
import { CONNECT_HERO_RAIN_CONFIG } from "../hero/hero-rain-config";
import {
  CONNECT_HERO_RAIN_DEFAULT,
  type ConnectHeroRain,
} from "../hero/rain-control-settings";
import type { ShaderTarget } from "../hero/shader-targets";
import { CONNECT_HERO_TWIZZLER_DEFAULTS } from "../hero/twizzler-defaults";

/** Login starts on the same Twizzler + rain combo as the homepage hero. */
export const LOGIN_PANEL_TARGETS: readonly ShaderTarget[] = [
  "twizzler",
  "rain",
];

/**
 * Lab Dark Appearance (stripes-settings-cf-base): cream ribbon on deep
 * orange. Geometry stays the homepage hero moth; only the stage/ink swap.
 */
export const LOGIN_DARK_APPEARANCE = {
  backgroundColor: "#f86a00",
  color: "#ffefd4",
  colorFar: "#ffd39e",
  colorNear: "#ffefd4",
  colorEdge: "#f0f0f0",
} as const;

export const LOGIN_TWIZZLER_DEFAULTS: TwizzlerSettings = {
  ...CONNECT_HERO_TWIZZLER_DEFAULTS,
  ...LOGIN_DARK_APPEARANCE,
  gradientStops: defaultTwizzlerGradientFieldStops(
    LOGIN_DARK_APPEARANCE.colorFar,
    LOGIN_DARK_APPEARANCE.colorNear,
    LOGIN_DARK_APPEARANCE.colorEdge
  ),
};

/** Tall promo pane: cover so rain fills height and width, not just width. */
export const LOGIN_RAIN_DEFAULT: ConnectHeroRain = {
  ...CONNECT_HERO_RAIN_DEFAULT,
  config: {
    ...CONNECT_HERO_RAIN_CONFIG,
    transform: { fit: "cover", zoom: 1, panX: 0, panY: 0 },
  },
};

/**
 * Short banner crop. `scale` is the panel Zoom; `camDist` sizes the moth in
 * frame; pan parks it on the right so copy sits on the orange field.
 */
export const LOGIN_MOBILE_TWIZZLER_CROP = {
  scale: 5.5,
  camDist: 10.8,
  panX: 240,
  panY: 8,
} as const;

export const LOGIN_MOBILE_TWIZZLER_DEFAULTS: TwizzlerSettings = {
  ...LOGIN_TWIZZLER_DEFAULTS,
  ...LOGIN_MOBILE_TWIZZLER_CROP,
};

/**
 * Ease-in (1 − t³) left → right scrim in Dark Appearance orange so banner
 * type stays readable while the moth remains visible on the right.
 */
export const LOGIN_MOBILE_SCRIM =
  "linear-gradient(to right, #f86a00 0%, rgb(248 106 0 / 0.99) 20%, rgb(248 106 0 / 0.94) 40%, rgb(248 106 0 / 0.78) 60%, rgb(248 106 0 / 0.49) 80%, rgb(248 106 0 / 0) 100%)";
