export {
  COMET_LOGO_FORMATION_DURATION_SEC,
  advanceCometLogoAnimation,
  createCometLogoAnimationState,
  type CometLogoAnimationState,
} from "./animation";
export {
  COMET_LOGO_BACKGROUND_POINT_COUNT,
  COMET_LOGO_IDLE_BACKGROUND_POINT_COUNT,
  COMET_LOGO_IDLE_RENDER_POINT_COUNT,
  COMET_LOGO_POINT_COUNT,
  COMET_LOGO_POINTS,
  COMET_LOGO_RENDER_POINT_COUNT,
  COMET_LOGO_TRAIL_SEGMENT_COUNT,
} from "./points";
export {
  COMET_LOGO_CONFIG_VERSION,
  COMET_LOGO_DEFAULTS,
  normalizeCometLogoSettings,
  type CometLogoSettings,
} from "./config";
export { createCometLogoTextureRenderer, type CometLogoPointer, type CometLogoTextureRenderer } from "./renderer";
