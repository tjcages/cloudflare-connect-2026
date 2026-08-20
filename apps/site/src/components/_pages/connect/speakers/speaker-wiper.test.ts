import { describe, expect, it } from "vitest";
import { defaultSpeakerFramePlacements, SPEAKER_FRAME_DEFAULTS } from "./speaker-frame-controls";
import { resolveAuthoredFrames } from "./speaker-shader-geometry";
import {
  armSpeakerWiper,
  commitPendingSpeakerWipers,
  parseSpeakerWiperOverride,
  replaySpeakerWiper,
  resetSpeakerWiper,
  resolveWipingFrames,
  speakerFrameOutlineColor,
  speakerFramePaintConfig,
  speakerFrameWiperRect,
  speakerPortraitOpacity,
  speakerWiperProgress,
  speakerWiperShouldEnter,
  speakerWiperStaggerMs,
  SPEAKER_IMAGE_FADE_END,
  SPEAKER_IMAGE_FADE_START,
  SPEAKER_OVERLAY_REST_WIDTH,
  SPEAKER_WIPER_DURATION_MS,
  SPEAKER_WIPER_REST_WIDTH,
  SPEAKER_WIPER_SHADER_DELAY_MS,
} from "./speaker-wiper";

const aperture = { x: 40, y: 10, width: 200, height: 180 };
const rest = { x: 40, y: 10, width: 40, height: 180 };

describe("speaker frame wipers", () => {
  it("starts covering the portrait at full width", () => {
    expect(speakerFrameWiperRect(aperture, rest, 0)).toEqual({
      x: 40,
      y: 10,
      width: 200,
      height: 180,
    });
    expect(speakerWiperProgress(0, 0)).toBe(0);
  });

  it("keeps full coverage while the start is still in the future", () => {
    expect(speakerWiperProgress(-50, 0)).toBe(0);
    const authored = resolveAuthoredFrames(
      [{ imageIndex: 0, x: 0.8, y: 0, width: 0.2, height: 1, span: false, variant: "orange" as const }],
      [aperture],
    );
    expect(resolveWipingFrames(authored, [aperture], [1_000], 500)[0]?.rect.width).toBe(200);
  });

  it("collapses the authored frame from full width into its rest rect", () => {
    const mid = speakerFrameWiperRect(aperture, { x: 200, y: 10, width: 40, height: 180 }, 0.5);
    expect(mid.y).toBe(rest.y);
    expect(mid.height).toBe(rest.height);
    expect(mid.x).toBeGreaterThan(40);
    expect(mid.x).toBeLessThan(200);
    expect(mid.width).toBeGreaterThan(40);
    expect(mid.width).toBeLessThan(200);
  });

  it("settles into the authored rest rect", () => {
    expect(speakerFrameWiperRect(aperture, rest, 1)).toEqual(rest);
    expect(speakerFrameWiperRect(aperture, { x: 60, y: 10, width: 40, height: 180 }, 1)).toEqual({
      x: 60,
      y: 10,
      width: 40,
      height: 180,
    });
  });

  it("defaults to an 80% overlay plus a 20% orange pane on the right edge", () => {
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
      expect(frames[0]?.variant).toBe("grey");
      expect(frames[1]?.variant).toBe("orange");
      expect(frames[0]?.x).toBe(0);
      expect(frames[0]?.width).toBe(SPEAKER_OVERLAY_REST_WIDTH);
      expect(frames[1]?.x).toBe(0.8);
      expect(frames[1]?.width).toBe(SPEAKER_WIPER_REST_WIDTH);
    }
  });

  it("animates authored frames only after that image has started", () => {
    const authored = resolveAuthoredFrames(
      [
        { imageIndex: 0, x: 0, y: 0, width: 0.8, height: 1, span: false, variant: "grey" as const },
        { imageIndex: 0, x: 0.8, y: 0, width: 0.2, height: 1, span: false, variant: "orange" as const },
      ],
      [aperture],
    );

    expect(resolveWipingFrames(authored, [aperture], [null], 1_000)).toEqual([]);

    const playing = resolveWipingFrames(authored, [aperture], [0], 20_000);
    expect(playing.map((frame) => frame.variant)).toEqual(["grey", "orange"]);
    expect(playing[0]?.rect).toEqual({ x: 40, y: 10, width: 160, height: 180 });
    expect(playing[1]?.rect).toEqual({ x: 200, y: 10, width: 40, height: 180 });
  });

  it("opens from full coverage into the rest rect while the clip plays", () => {
    const authored = resolveAuthoredFrames(
      [{ imageIndex: 0, x: 0.8, y: 0, width: 0.2, height: 1, span: false, variant: "orange" as const }],
      [aperture],
    );
    expect(resolveWipingFrames(authored, [aperture], [0], 0)[0]?.rect.width).toBe(200);
    const mid = resolveWipingFrames(authored, [aperture], [0], 300)[0]?.rect;
    expect(mid?.width).toBeGreaterThan(40);
    expect(mid?.width).toBeLessThan(180);
    expect(mid?.x).toBeGreaterThan(40);
    expect(resolveWipingFrames(authored, [aperture], [0], 20_000)[0]?.rect.width).toBe(40);
  });

  it("starts collapsing every pane together so opaque strips do not sit at full width", () => {
    expect(speakerWiperStaggerMs("grey")).toBe(0);
    expect(speakerWiperStaggerMs("orange")).toBe(0);
    expect(speakerWiperProgress(16, 0)).toBeGreaterThan(0);
  });

  it("fades portraits in through the middle of the wipe", () => {
    expect(speakerPortraitOpacity(0)).toBe(0);
    expect(speakerPortraitOpacity(SPEAKER_IMAGE_FADE_START)).toBe(0);
    expect(speakerPortraitOpacity(SPEAKER_IMAGE_FADE_END)).toBe(1);
    expect(speakerPortraitOpacity(1)).toBe(1);
    const mid = (SPEAKER_IMAGE_FADE_START + SPEAKER_IMAGE_FADE_END) / 2;
    const opacity = speakerPortraitOpacity(mid);
    expect(opacity).toBeGreaterThan(0);
    expect(opacity).toBeLessThan(1);
  });

  it("jumps authored frames to rest when reduced motion is on", () => {
    const authored = resolveAuthoredFrames(
      [{ imageIndex: 0, x: 0.8, y: 0, width: 0.2, height: 1, span: false, variant: "orange" as const }],
      [aperture],
    );
    const frames = resolveWipingFrames(authored, [aperture], [9_000], 9_010, { reducedMotion: true });
    expect(frames[0]?.rect.width).toBe(40);
  });

  it("paints orange uninverted, with an independent overlay palette", () => {
    const orange = speakerFramePaintConfig(SPEAKER_FRAME_DEFAULTS, "orange");
    const overlay = speakerFramePaintConfig(SPEAKER_FRAME_DEFAULTS, "grey");

    expect(orange.adjustments?.invert).toBe(false);
    expect(overlay.adjustments?.invert).toBe(false);
    expect(orange.background?.color).toBe(0xf4_60_21);
  });

  it("paints the orange pane on the lab 7×7 grid", () => {
    const orange = speakerFramePaintConfig(SPEAKER_FRAME_DEFAULTS, "orange");
    const overlay = speakerFramePaintConfig(SPEAKER_FRAME_DEFAULTS, "grey");

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
  });

  it("paints the orange field from the look's background color", () => {
    const settings = {
      ...SPEAKER_FRAME_DEFAULTS,
      orange: { ...SPEAKER_FRAME_DEFAULTS.orange, bgColor: "#00ffaa" },
    };
    expect(speakerFramePaintConfig(settings, "orange").background?.color).toBe(0x00_ff_aa);
    expect(speakerFrameOutlineColor("#00ffaa", 1)).toBe("rgba(0, 255, 170, 1)");
  });

  it("reads a preview override from the query string", () => {
    expect(parseSpeakerWiperOverride("?speakerWiper=0.35")).toBe(0.35);
    expect(parseSpeakerWiperOverride("?speakerWiper=2")).toBe(1);
    expect(parseSpeakerWiperOverride("")).toBeUndefined();
  });

  it("holds the wipe until the portrait can be painted, then starts on the next frame", () => {
    const clock = { startedAtMs: [null, null], pending: new Set<number>() };

    expect(armSpeakerWiper(clock, 0, { imageReady: false, reducedMotion: false, nowMs: 50 })).toBe("pending-image");
    expect(clock.startedAtMs[0]).toBeNull();

    expect(armSpeakerWiper(clock, 0, { imageReady: true, reducedMotion: false, nowMs: 80 })).toBe("armed");
    expect(clock.pending.has(0)).toBe(true);
    expect(clock.startedAtMs[0]).toBeNull();

    commitPendingSpeakerWipers(clock, 120);
    expect(clock.startedAtMs[0]).toBe(120);
    expect(clock.pending.size).toBe(0);

    expect(armSpeakerWiper(clock, 0, { imageReady: true, reducedMotion: false, nowMs: 200 })).toBe("already-started");

    resetSpeakerWiper(clock, 0);
    expect(clock.startedAtMs[0]).toBeNull();
    expect(armSpeakerWiper(clock, 0, { imageReady: true, reducedMotion: true, nowMs: 400 })).toBe("rest");
    expect(clock.startedAtMs[0]).toBe(400);
  });

  it("delays the committed start until after the shader reveal", () => {
    const clock = { startedAtMs: [null], pending: new Set<number>() };
    armSpeakerWiper(clock, 0, { imageReady: true, reducedMotion: false, nowMs: 80 });
    commitPendingSpeakerWipers(clock, 120, SPEAKER_WIPER_SHADER_DELAY_MS);
    expect(clock.startedAtMs[0]).toBe(120 + SPEAKER_WIPER_SHADER_DELAY_MS);
    expect(SPEAKER_WIPER_SHADER_DELAY_MS).toBe(950);
  });

  it("replays the same full-width settle from the start", () => {
    const clock = { startedAtMs: [0], pending: new Set<number>() };
    expect(replaySpeakerWiper(clock, 0, { imageReady: true, reducedMotion: false, nowMs: 800 })).toBe("armed");
    expect(clock.startedAtMs[0]).toBeNull();
    expect(clock.pending.has(0)).toBe(true);
    commitPendingSpeakerWipers(clock, 840);
    expect(clock.startedAtMs[0]).toBe(840);
  });

  it("enters a wipe at 28% visibility and resets when it drops back below that", () => {
    expect(speakerWiperShouldEnter(0.27)).toBe(false);
    expect(speakerWiperShouldEnter(0.28)).toBe(true);
  });

  it("runs the settle clip in 900ms", () => {
    expect(SPEAKER_WIPER_DURATION_MS).toBe(900);
    expect(speakerWiperProgress(450, 0)).toBe(0.5);
  });
});
