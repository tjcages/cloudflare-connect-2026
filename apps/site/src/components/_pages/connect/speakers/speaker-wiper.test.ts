import { describe, expect, it } from "vitest";
import { defaultSpeakerFramePlacements, SPEAKER_FRAME_DEFAULTS } from "./speaker-frame-controls";
import { resolveAuthoredFrames } from "./speaker-shader-geometry";
import {
  parseSpeakerWiperOverride,
  resolveWipingFrames,
  speakerFramePaintConfig,
  speakerFrameWiperRect,
  speakerWiperProgress,
  SPEAKER_WIPER_REST_WIDTH,
} from "./speaker-wiper";

const aperture = { x: 40, y: 10, width: 200, height: 180 };
const rest = { x: 40, y: 10, width: 20, height: 180 };

describe("speaker frame wipers", () => {
  it("starts on the left edge with no coverage", () => {
    expect(speakerFrameWiperRect(aperture, rest, 0)).toEqual({
      x: 40,
      y: 10,
      width: 0,
      height: 180,
    });
    expect(speakerWiperProgress(0, 0)).toBe(0);
  });

  it("wipes the authored frame across the portrait from the left", () => {
    const mid = speakerFrameWiperRect(aperture, rest, 0.3);
    expect(mid.x).toBe(40);
    expect(mid.y).toBe(rest.y);
    expect(mid.height).toBe(rest.height);
    expect(mid.width).toBeGreaterThan(40);
    expect(mid.width).toBeLessThan(200);
  });

  it("settles into the authored rest rect", () => {
    expect(speakerFrameWiperRect(aperture, rest, 1)).toEqual(rest);
    expect(speakerFrameWiperRect(aperture, { x: 60, y: 10, width: 20, height: 180 }, 1)).toEqual({
      x: 60,
      y: 10,
      width: 20,
      height: 180,
    });
  });

  it("defaults to two 10% frames per image, resting on the right edge", () => {
    const placements = defaultSpeakerFramePlacements();
    const byImage = new Map<number, typeof placements>();
    for (const placement of placements) {
      const list = byImage.get(placement.imageIndex) ?? [];
      list.push(placement);
      byImage.set(placement.imageIndex, list);
    }

    expect(byImage.size).toBe(6);
    for (const frames of byImage.values()) {
      expect(frames).toHaveLength(2);
      expect(frames[0]?.variant).toBe("orange");
      expect(frames[1]?.variant).toBe("white");
      expect(frames[0]?.width).toBe(SPEAKER_WIPER_REST_WIDTH);
      expect(frames[1]?.width).toBe(SPEAKER_WIPER_REST_WIDTH);
      expect(frames[0]?.height).toBe(1);
      expect(frames[0]?.x).toBe(0.8);
      expect(frames[1]?.x).toBe(0.9);
    }
  });

  it("animates authored frames only after that image has started", () => {
    const authored = resolveAuthoredFrames(
      [
        { imageIndex: 0, x: 0, y: 0, width: 0.1, height: 1, span: false, variant: "orange" as const },
        { imageIndex: 0, x: 0.1, y: 0, width: 0.1, height: 1, span: false, variant: "white" as const },
      ],
      [aperture],
    );

    expect(resolveWipingFrames(authored, [aperture], [null], 1_000)).toEqual([]);

    const playing = resolveWipingFrames(authored, [aperture], [0], 10_000);
    expect(playing.map((frame) => frame.variant)).toEqual(["orange", "white"]);
    expect(playing[0]?.rect).toEqual({ x: 40, y: 10, width: 20, height: 180 });
    expect(playing[1]?.rect).toEqual({ x: 60, y: 10, width: 20, height: 180 });
  });

  it("jumps authored frames to rest when reduced motion is on", () => {
    const authored = resolveAuthoredFrames(
      [{ imageIndex: 0, x: 0, y: 0, width: 0.1, height: 1, span: false, variant: "orange" as const }],
      [aperture],
    );
    const frames = resolveWipingFrames(authored, [aperture], [9_000], 9_010, { reducedMotion: true });
    expect(frames[0]?.rect.width).toBe(20);
  });

  it("paints orange inverted and white uninverted, with independent stripe palettes", () => {
    const inverted = speakerFramePaintConfig(SPEAKER_FRAME_DEFAULTS, "orange");
    const white = speakerFramePaintConfig(SPEAKER_FRAME_DEFAULTS, "white");

    expect(inverted.adjustments?.invert).toBe(true);
    expect(white.adjustments?.invert).toBe(false);
    expect(inverted.background?.color).toBe(0xff_bf_14);
    expect(white.background?.color).toBe(0xff_ff_ff);

    const customWhite = {
      ...SPEAKER_FRAME_DEFAULTS,
      white: {
        ...SPEAKER_FRAME_DEFAULTS.white,
        invert: true,
        brightness: 0.12,
        stripes: SPEAKER_FRAME_DEFAULTS.white.stripes.map((stripe, index) =>
          index === 0 ? { ...stripe, color: "#112233", width: 0.42 } : stripe,
        ),
      },
    };
    const painted = speakerFramePaintConfig(customWhite, "white");
    expect(painted.adjustments?.invert).toBe(true);
    expect(painted.adjustments?.brightness).toBe(0.12);
    expect(painted.stripes?.[0]?.color).toBe(0x11_22_33);
    expect(speakerFramePaintConfig(customWhite, "orange").stripes?.[0]?.color).not.toBe(0x11_22_33);
  });

  it("reads a preview override from the query string", () => {
    expect(parseSpeakerWiperOverride("?speakerWiper=0.35")).toBe(0.35);
    expect(parseSpeakerWiperOverride("?speakerWiper=2")).toBe(1);
    expect(parseSpeakerWiperOverride("")).toBeUndefined();
  });
});
