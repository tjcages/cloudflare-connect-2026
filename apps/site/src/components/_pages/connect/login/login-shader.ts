import type { ShaderTarget } from "../hero/shader-targets";
import { CONNECT_HERO_RAIN_DEFAULT } from "../hero/rain-control-settings";
import { CONNECT_HERO_TWIZZLER_DEFAULTS } from "../hero/twizzler-defaults";

/** Login starts on the same Twizzler + rain combo as the homepage hero. */
export const LOGIN_PANEL_TARGETS: readonly ShaderTarget[] = [
  "twizzler",
  "rain",
];

export const LOGIN_TWIZZLER_DEFAULTS = CONNECT_HERO_TWIZZLER_DEFAULTS;
export const LOGIN_RAIN_DEFAULT = CONNECT_HERO_RAIN_DEFAULT;
