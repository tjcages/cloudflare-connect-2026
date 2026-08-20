import type { Rect } from "./speaker-shader-geometry";

export type SpeakerFaceMaskSettings = {
  enabled: boolean;
  /** Horizontal center of the hole, as a fraction of the portrait width. */
  x: number;
  /** Vertical center of the hole, as a fraction of the portrait height. */
  y: number;
  /** Outer radius as a fraction of the portrait's shorter side. */
  radius: number;
  /** Share of the radius that fades from clear to full overlay (0 = hard edge). */
  softness: number;
  /** Extra Gaussian blur on the mask edge, in CSS pixels. */
  blurPx: number;
  /** How completely the overlay is removed in the hole (1 = photo only). */
  strength: number;
};

/** Object-top headshots: hole sits on the face, with a wide soft falloff. */
export const SPEAKER_FACE_MASK_DEFAULTS: SpeakerFaceMaskSettings = {
  enabled: true,
  x: 0.5,
  y: 0.32,
  radius: 0.3,
  softness: 0.68,
  blurPx: 14,
  strength: 1,
};

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

export const speakerFaceMaskCircle = (aperture: Rect, mask: SpeakerFaceMaskSettings) => {
  const radius = Math.max(0, mask.radius) * Math.min(aperture.width, aperture.height);
  return {
    cx: aperture.x + clamp01(mask.x) * aperture.width,
    cy: aperture.y + clamp01(mask.y) * aperture.height,
    radius,
    innerRadius: radius * (1 - clamp01(mask.softness)),
  };
};

/**
 * Punch a soft radial hole through the current overlay so the photo reads
 * on the face. `destination-out` plus a radial gradient is the falloff;
 * `filter: blur` feathers that edge.
 */
export const punchSpeakerFaceMask = (
  context: CanvasRenderingContext2D,
  aperture: Rect,
  mask: SpeakerFaceMaskSettings,
) => {
  if (!mask.enabled || mask.strength <= 0) return;
  const { cx, cy, radius, innerRadius } = speakerFaceMaskCircle(aperture, mask);
  if (radius < 0.5) return;

  const strength = clamp01(mask.strength);
  const blurPx = Math.max(0, mask.blurPx);
  const gradient = context.createRadialGradient(cx, cy, innerRadius, cx, cy, Math.max(innerRadius + 0.5, radius));
  gradient.addColorStop(0, `rgba(0, 0, 0, ${strength})`);
  gradient.addColorStop(0.45, `rgba(0, 0, 0, ${strength * 0.72})`);
  gradient.addColorStop(1, "rgba(0, 0, 0, 0)");

  context.save();
  context.beginPath();
  context.rect(aperture.x, aperture.y, aperture.width, aperture.height);
  context.clip();
  context.globalCompositeOperation = "destination-out";
  if (blurPx > 0) context.filter = `blur(${blurPx}px)`;
  context.fillStyle = gradient;
  context.beginPath();
  context.arc(cx, cy, radius + blurPx, 0, Math.PI * 2);
  context.fill();
  context.restore();
};
