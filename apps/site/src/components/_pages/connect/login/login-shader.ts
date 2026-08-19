import type { TwizzlerSettings } from "@tjcages/connect-twizzler";
import { defaultTwizzlerGradientFieldStops } from "@tjcages/connect-twizzler/gradient";
import { CONNECT_HERO_RAIN_DEFAULT } from "../hero/rain-control-settings";
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

export const LOGIN_RAIN_DEFAULT = CONNECT_HERO_RAIN_DEFAULT;
