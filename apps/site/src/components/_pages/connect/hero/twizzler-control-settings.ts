import {
  normalizeTwizzlerSettings,
  type TwizzlerSettings,
} from "@tjcages/connect-twizzler";
import { CONNECT_HERO_TWIZZLER_DEFAULTS } from "./twizzler-defaults";

export type TwizzlerControlSettings = Pick<
  TwizzlerSettings,
  | "gradientStops"
  | "opacity"
  | "scale"
  | "centerY"
  | "amplitude"
  | "lineCount"
  | "lineWidth"
  | "minLineWidth"
  | "maxLineWidth"
  | "pointSpacing"
  | "rotateXDeg"
  | "rotateYDeg"
  | "rotateZDeg"
  | "fov"
  | "camDist"
  | "perspectiveWidth"
  | "panX"
  | "panY"
  | "panZ"
  | "speed"
>;

export const CONNECT_TWIZZLER_CONTROL_DEFAULTS: TwizzlerControlSettings = {
  gradientStops: CONNECT_HERO_TWIZZLER_DEFAULTS.gradientStops,
  opacity: CONNECT_HERO_TWIZZLER_DEFAULTS.opacity,
  scale: CONNECT_HERO_TWIZZLER_DEFAULTS.scale,
  centerY: CONNECT_HERO_TWIZZLER_DEFAULTS.centerY,
  amplitude: CONNECT_HERO_TWIZZLER_DEFAULTS.amplitude,
  lineCount: CONNECT_HERO_TWIZZLER_DEFAULTS.lineCount,
  lineWidth: CONNECT_HERO_TWIZZLER_DEFAULTS.lineWidth,
  minLineWidth: CONNECT_HERO_TWIZZLER_DEFAULTS.minLineWidth,
  maxLineWidth: CONNECT_HERO_TWIZZLER_DEFAULTS.maxLineWidth,
  pointSpacing: CONNECT_HERO_TWIZZLER_DEFAULTS.pointSpacing,
  rotateXDeg: CONNECT_HERO_TWIZZLER_DEFAULTS.rotateXDeg,
  rotateYDeg: CONNECT_HERO_TWIZZLER_DEFAULTS.rotateYDeg,
  rotateZDeg: CONNECT_HERO_TWIZZLER_DEFAULTS.rotateZDeg,
  fov: CONNECT_HERO_TWIZZLER_DEFAULTS.fov,
  camDist: CONNECT_HERO_TWIZZLER_DEFAULTS.camDist,
  perspectiveWidth: CONNECT_HERO_TWIZZLER_DEFAULTS.perspectiveWidth,
  panX: CONNECT_HERO_TWIZZLER_DEFAULTS.panX,
  panY: CONNECT_HERO_TWIZZLER_DEFAULTS.panY,
  panZ: CONNECT_HERO_TWIZZLER_DEFAULTS.panZ,
  speed: CONNECT_HERO_TWIZZLER_DEFAULTS.speed,
};

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
