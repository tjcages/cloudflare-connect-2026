import { describe, expect, it } from "vitest";
import {
  punchSpeakerFaceMask,
  speakerFaceMaskCircle,
  speakerFaceMaskFade,
  SPEAKER_FACE_MASK_DEFAULTS,
  SPEAKER_FACE_MASK_FADE_START,
} from "./speaker-face-mask";

const aperture = { x: 40, y: 10, width: 200, height: 180 };

describe("speaker face mask", () => {
  it("places a soft hole on the upper-center of an object-top portrait", () => {
    const circle = speakerFaceMaskCircle(aperture, SPEAKER_FACE_MASK_DEFAULTS);
    expect(SPEAKER_FACE_MASK_DEFAULTS.enabled).toBe(true);
    expect(circle.cx).toBe(40 + 200 * 0.5);
    expect(circle.cy).toBe(10 + 180 * 0.32);
    expect(circle.radius).toBe(180 * 0.36);
    expect(circle.innerRadius).toBeLessThan(circle.radius);
    expect(circle.innerRadius).toBeGreaterThan(0);
  });

  it("shrinks the solid core as softness increases", () => {
    const hard = speakerFaceMaskCircle(aperture, { ...SPEAKER_FACE_MASK_DEFAULTS, softness: 0, radius: 0.5 });
    const soft = speakerFaceMaskCircle(aperture, { ...SPEAKER_FACE_MASK_DEFAULTS, softness: 1, radius: 0.5 });
    expect(hard.innerRadius).toBe(hard.radius);
    expect(soft.innerRadius).toBe(0);
  });

  it("does not punch when the mask is disabled", () => {
    const context = {
      save: () => {
        throw new Error("should not draw");
      },
    } as unknown as CanvasRenderingContext2D;
    punchSpeakerFaceMask(context, aperture, { ...SPEAKER_FACE_MASK_DEFAULTS, enabled: false });
    punchSpeakerFaceMask(context, aperture, { ...SPEAKER_FACE_MASK_DEFAULTS, strength: 0 });
    punchSpeakerFaceMask(context, aperture, SPEAKER_FACE_MASK_DEFAULTS, []);
  });

  it("keeps the hole off until orange has mostly left, then fades it onto the overlay", () => {
    expect(speakerFaceMaskFade(0)).toBe(0);
    expect(speakerFaceMaskFade(SPEAKER_FACE_MASK_FADE_START)).toBe(0);
    expect(speakerFaceMaskFade((SPEAKER_FACE_MASK_FADE_START + 1) / 2)).toBeGreaterThan(0);
    expect(speakerFaceMaskFade((SPEAKER_FACE_MASK_FADE_START + 1) / 2)).toBeLessThan(1);
    expect(speakerFaceMaskFade(1)).toBe(1);
  });
});
