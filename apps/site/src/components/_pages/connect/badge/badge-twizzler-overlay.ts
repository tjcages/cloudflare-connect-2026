import type { TwizzlerSettings } from "@tjcages/connect-twizzler";
import { CONNECT_HERO_TWIZZLER_DEFAULTS } from "@/components/_pages/connect/hero/twizzler-defaults";

const hero = CONNECT_HERO_TWIZZLER_DEFAULTS;

export type BadgeTwizzlerOverlay = {
  twizzlerOpacity: number;
  twizzlerScale: number;
  twizzlerCenterY: number;
  twizzlerPanX: number;
  twizzlerPanY: number;
  twizzlerPanZ: number;
  twizzlerAmplitude: number;
  twizzlerTwist: number;
  twizzlerRotateX: number;
  twizzlerRotateY: number;
  twizzlerRotateZ: number;
  twizzlerFov: number;
  twizzlerCamDist: number;
  twizzlerLineWidth: number;
  twizzlerPerspectiveWidth: number;
  twizzlerMinLineWidth: number;
  twizzlerMaxLineWidth: number;
  twizzlerLineCount: number;
  twizzlerPointSpacing: number;
  twizzlerSpeed: number;
};

export const BADGE_TWIZZLER_OVERLAY_DEFAULTS: BadgeTwizzlerOverlay = {
  twizzlerOpacity: hero.opacity,
  twizzlerScale: hero.scale,
  twizzlerCenterY: hero.centerY,
  twizzlerPanX: hero.panX,
  twizzlerPanY: hero.panY,
  twizzlerPanZ: hero.panZ,
  twizzlerAmplitude: hero.amplitude,
  twizzlerTwist: hero.twist,
  twizzlerRotateX: hero.rotateXDeg,
  twizzlerRotateY: hero.rotateYDeg,
  twizzlerRotateZ: hero.rotateZDeg,
  twizzlerFov: hero.fov,
  twizzlerCamDist: hero.camDist,
  twizzlerLineWidth: hero.lineWidth,
  twizzlerPerspectiveWidth: hero.perspectiveWidth,
  twizzlerMinLineWidth: hero.minLineWidth,
  twizzlerMaxLineWidth: hero.maxLineWidth,
  twizzlerLineCount: hero.lineCount,
  twizzlerPointSpacing: hero.pointSpacing,
  twizzlerSpeed: hero.speed,
};

export function applyBadgeTwizzlerOverlay(
  base: TwizzlerSettings,
  overlay: BadgeTwizzlerOverlay
): TwizzlerSettings {
  return {
    ...base,
    opacity: overlay.twizzlerOpacity,
    scale: overlay.twizzlerScale,
    centerY: overlay.twizzlerCenterY,
    panX: overlay.twizzlerPanX,
    panY: overlay.twizzlerPanY,
    panZ: overlay.twizzlerPanZ,
    amplitude: overlay.twizzlerAmplitude,
    twist: overlay.twizzlerTwist,
    rotateXDeg: overlay.twizzlerRotateX,
    rotateYDeg: overlay.twizzlerRotateY,
    rotateZDeg: overlay.twizzlerRotateZ,
    fov: overlay.twizzlerFov,
    camDist: overlay.twizzlerCamDist,
    lineWidth: overlay.twizzlerLineWidth,
    perspectiveWidth: overlay.twizzlerPerspectiveWidth,
    minLineWidth: overlay.twizzlerMinLineWidth,
    maxLineWidth: overlay.twizzlerMaxLineWidth,
    lineCount: Math.round(overlay.twizzlerLineCount),
    pointSpacing: overlay.twizzlerPointSpacing,
    speed: overlay.twizzlerSpeed,
  };
}
