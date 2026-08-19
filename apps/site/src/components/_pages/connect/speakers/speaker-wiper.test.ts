import { describe, expect, it } from "vitest";
import { defaultSpeakerFramePlacements, SPEAKER_FRAME_DEFAULTS } from "./speaker-frame-controls";
import { resolveAuthoredFrames } from "./speaker-shader-geometry";
import {
  armSpeakerWiper,
  commitPendingSpeakerWipers,
  parseSpeakerWiperOverride,
  resetSpeakerWiper,
  resolveWipingFrames,
  speakerFrameOutlineColor,
  speakerFramePaintConfig,
  speakerFrameWiperRect,
  speakerWiperProgress,
  speakerWiperShouldEnter,
  SPEAKER_OVERLAY_REST_WIDTH,
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

  it("defaults to an 80% image overlay plus two 10% frames on the right edge", () => {
    const placements = defaultSpeakerFramePlacements();
    const byImage = new Map<number, typeof placements>();
    for (const placement of placements) {
      const list = byImage.get(placement.imageIndex) ?? [];
      list.push(placement);
      byImage.set(placement.imageIndex, list);
    }

    expect(byImage.size).toBe(6);
    for (const frames of byImage.values()) {
      expect(frames).toHaveLength(3);
      expect(frames[0]?.variant).toBe("grey");
      expect(frames[1]?.variant).toBe("orange");
      expect(frames[2]?.variant).toBe("dark");
      expect(frames[0]?.x).toBe(0);
      expect(frames[0]?.width).toBe(SPEAKER_OVERLAY_REST_WIDTH);
      expect(frames[1]?.width).toBe(SPEAKER_WIPER_REST_WIDTH);
      expect(frames[2]?.width).toBe(SPEAKER_WIPER_REST_WIDTH);
      expect(frames[1]?.x).toBe(0.8);
      expect(frames[2]?.x).toBe(0.9);
    }
  });

  it("animates authored frames only after that image has started", () => {
    const authored = resolveAuthoredFrames(
      [
        { imageIndex: 0, x: 0, y: 0, width: 0.1, height: 1, span: false, variant: "orange" as const },
        { imageIndex: 0, x: 0.1, y: 0, width: 0.1, height: 1, span: false, variant: "dark" as const },
      ],
      [aperture],
    );

    expect(resolveWipingFrames(authored, [aperture], [null], 1_000)).toEqual([]);

    const playing = resolveWipingFrames(authored, [aperture], [0], 10_000);
    expect(playing.map((frame) => frame.variant)).toEqual(["orange", "dark"]);
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

  it("paints orange and dark uninverted, with independent stripe palettes", () => {
    const orange = speakerFramePaintConfig(SPEAKER_FRAME_DEFAULTS, "orange");
    const dark = speakerFramePaintConfig(SPEAKER_FRAME_DEFAULTS, "dark");

    expect(orange.adjustments?.invert).toBe(false);
    expect(dark.adjustments?.invert).toBe(false);
    expect(orange.background?.color).toBe(0xf4_60_21);
    expect(dark.background?.color).toBe(0x14_14_14);

    const customDark = {
      ...SPEAKER_FRAME_DEFAULTS,
      dark: {
        ...SPEAKER_FRAME_DEFAULTS.dark,
        invert: true,
        brightness: 0.12,
        stripes: SPEAKER_FRAME_DEFAULTS.dark.stripes.map((stripe, index) =>
          index === 0 ? { ...stripe, color: "#112233", width: 0.42 } : stripe,
        ),
      },
    };
    const painted = speakerFramePaintConfig(customDark, "dark");
    expect(painted.adjustments?.invert).toBe(true);
    expect(painted.adjustments?.brightness).toBe(0.12);
    expect(painted.stripes?.[0]?.color).toBe(0x11_22_33);
    expect(speakerFramePaintConfig(customDark, "orange").stripes?.[0]?.color).not.toBe(0x11_22_33);
  });

  it("paints orange and dark panes on the lab 7×7 grid", () => {
    const dark = speakerFramePaintConfig(SPEAKER_FRAME_DEFAULTS, "dark");
    const orange = speakerFramePaintConfig(SPEAKER_FRAME_DEFAULTS, "orange");
    const overlay = speakerFramePaintConfig(SPEAKER_FRAME_DEFAULTS, "grey");

    expect(dark.grid).toMatchObject({ cellWidth: 7, cellHeight: 7, angleDeg: 0, overlapAmount: 1.2 });
    expect(dark.fieldScale).toBe(1);
    expect(dark.stripes?.[0]).toMatchObject({ color: 0x26_11_06, startFrom: 0, width: 0.5 });
    expect(orange.grid).toMatchObject({ cellWidth: 7, cellHeight: 7, angleDeg: 0, overlapAmount: 1.2 });
    expect(orange.fieldScale).toBe(1);
    expect(orange.stripes?.[0]).toMatchObject({ color: 0xfc_68_2b, startFrom: 0, width: 0.5 });
    expect(overlay.grid).toMatchObject({
      cellWidth: SPEAKER_FRAME_DEFAULTS.gridCellWidth,
      cellHeight: SPEAKER_FRAME_DEFAULTS.gridCellHeight,
      angleDeg: 45,
    });
  });

  it("paints the overlay frame with a transparent background so the photo shows through", () => {
    const overlay = speakerFramePaintConfig(SPEAKER_FRAME_DEFAULTS, "grey");
    expect(overlay.background?.transparent).toBe(true);
    expect(overlay.background?.stars?.enabled).toBe(false);
    expect(overlay.adjustments?.invert).toBe(false);
    expect(speakerFramePaintConfig(SPEAKER_FRAME_DEFAULTS, "orange").background?.stars?.enabled).toBe(false);
    expect(speakerFramePaintConfig(SPEAKER_FRAME_DEFAULTS, "dark").background?.stars?.enabled).toBe(false);
  });

  it("paints orange and dark fields from each look's background color", () => {
    const settings = {
      ...SPEAKER_FRAME_DEFAULTS,
      orange: { ...SPEAKER_FRAME_DEFAULTS.orange, bgColor: "#00ffaa" },
      dark: { ...SPEAKER_FRAME_DEFAULTS.dark, bgColor: "#aa00ff" },
    };
    expect(speakerFramePaintConfig(settings, "orange").background?.color).toBe(0x00_ff_aa);
    expect(speakerFramePaintConfig(settings, "dark").background?.color).toBe(0xaa_00_ff);
    expect(speakerFrameOutlineColor("#00ffaa", 1)).toBe("rgba(0, 255, 170, 1)");
  });

  it("reads a preview override from the query string", () => {
    expect(parseSpeakerWiperOverride("?speakerWiper=0.35")).toBe(0.35);
    expect(parseSpeakerWiperOverride("?speakerWiper=2")).toBe(1);
    expect(parseSpeakerWiperOverride("")).toBeUndefined();
  });

  it("holds the wipe until the portrait can be painted, then starts on the next frame", () => {
    const clock = { startedAtMs: [null, null], pending: new Set<number>() };

    expect(
      armSpeakerWiper(clock, 0, { imageReady: false, reducedMotion: false, nowMs: 50 }),
    ).toBe("pending-image");
    expect(clock.startedAtMs[0]).toBeNull();

    expect(
      armSpeakerWiper(clock, 0, { imageReady: true, reducedMotion: false, nowMs: 80 }),
    ).toBe("armed");
    expect(clock.pending.has(0)).toBe(true);
    expect(clock.startedAtMs[0]).toBeNull();

    commitPendingSpeakerWipers(clock, 120);
    expect(clock.startedAtMs[0]).toBe(120);
    expect(clock.pending.size).toBe(0);

    expect(
      armSpeakerWiper(clock, 0, { imageReady: true, reducedMotion: false, nowMs: 200 }),
    ).toBe("already-started");

    resetSpeakerWiper(clock, 0);
    expect(clock.startedAtMs[0]).toBeNull();
    expect(
      armSpeakerWiper(clock, 0, { imageReady: true, reducedMotion: true, nowMs: 400 }),
    ).toBe("rest");
    expect(clock.startedAtMs[0]).toBe(400);
  });

  it("enters a wipe at 28% visibility and resets only when fully off-screen", () => {
    expect(speakerWiperShouldEnter(0.27)).toBe(false);
    expect(speakerWiperShouldEnter(0.28)).toBe(true);
  });
});
