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
  speakerOrangeMaskRects,
  speakerOverlayIrisRect,
  speakerWiperProgress,
  speakerWiperClockIsLive,
  speakerWiperNeedsLiveClock,
  speakerWiperShouldEnter,
  speakerWiperShouldLeave,
  speakerWiperStaggerMs,
  SPEAKER_OVERLAY_REST_WIDTH,
  SPEAKER_WIPER_DURATION_MS,
  SPEAKER_WIPER_SHADER_DELAY_MS,
} from "./speaker-wiper";

const aperture = { x: 40, y: 10, width: 200, height: 180 };
const rest = { x: 40, y: 10, width: 200, height: 180 };

describe("speaker frame wipers", () => {
  it("masks orange to the region around a hole", () => {
    expect(speakerOrangeMaskRects(aperture, null)).toEqual([aperture]);
    expect(speakerOrangeMaskRects(aperture, { x: 140, y: 100, width: 0, height: 0 })).toEqual([aperture]);
    expect(speakerOrangeMaskRects(aperture, aperture)).toEqual([]);

    const hole = { x: 90, y: 50, width: 80, height: 60 };
    const around = speakerOrangeMaskRects(aperture, hole);
    expect(around).toHaveLength(4);
    expect(around).toEqual(
      expect.arrayContaining([
        { x: 40, y: 10, width: 200, height: 40 },
        { x: 40, y: 110, width: 200, height: 80 },
        { x: 40, y: 50, width: 50, height: 60 },
        { x: 170, y: 50, width: 70, height: 60 },
      ]),
    );
  });

  it("grows the overlay iris from the center with a strong ease-out", () => {
    expect(speakerOverlayIrisRect(rest, 0)).toEqual({
      x: 140,
      y: 100,
      width: 0,
      height: 0,
    });
    const mid = speakerOverlayIrisRect(rest, 0.35);
    expect(mid.width).toBeGreaterThan(0);
    expect(mid.height).toBeGreaterThan(0);
    expect(mid.width).toBeLessThan(rest.width);
    expect(mid.height).toBeLessThan(rest.height);
    expect(mid.x).toBeGreaterThan(rest.x);
    expect(mid.y).toBeGreaterThan(rest.y);
    expect(mid.x + mid.width).toBeCloseTo(rest.x + rest.width - (mid.x - rest.x));
    expect(speakerOverlayIrisRect(rest, 1)).toEqual(rest);
  });

  it("settles into the authored rest rect", () => {
    expect(speakerOverlayIrisRect(rest, 1)).toEqual(rest);
    expect(speakerOverlayIrisRect({ x: 60, y: 20, width: 80, height: 40 }, 1)).toEqual({
      x: 60,
      y: 20,
      width: 80,
      height: 40,
    });
  });

  it("defaults to a full-bleed overlay with no rest orange pane", () => {
    const placements = defaultSpeakerFramePlacements();
    const byImage = new Map<number, typeof placements>();
    for (const placement of placements) {
      const list = byImage.get(placement.imageIndex) ?? [];
      list.push(placement);
      byImage.set(placement.imageIndex, list);
    }

    expect(byImage.size).toBe(6);
    for (const frames of byImage.values()) {
      expect(frames).toHaveLength(1);
      expect(frames[0]?.variant).toBe("grey");
      expect(frames[0]?.x).toBe(0);
      expect(frames[0]?.width).toBe(SPEAKER_OVERLAY_REST_WIDTH);
    }
  });

  it("covers with orange before the overlay iris exists", () => {
    const authored = resolveAuthoredFrames(
      [{ imageIndex: 0, x: 0, y: 0, width: 1, height: 1, span: false, variant: "grey" as const }],
      [aperture],
    );

    expect(resolveWipingFrames(authored, [aperture], [null], 1_000)).toEqual([]);

    const waiting = resolveWipingFrames(authored, [aperture], [1_000], 500);
    expect(waiting.map((frame) => frame.variant)).toEqual(["orange"]);
    expect(waiting[0]?.rect).toEqual(aperture);

    const playing = resolveWipingFrames(authored, [aperture], [0], 20_000);
    expect(playing.map((frame) => frame.variant)).toEqual(["grey"]);
    expect(playing[0]?.rect).toEqual(aperture);
  });

  it("grows the overlay from the center while orange stays around it", () => {
    const authored = resolveAuthoredFrames(
      [{ imageIndex: 0, x: 0, y: 0, width: 1, height: 1, span: false, variant: "grey" as const }],
      [aperture],
    );
    expect(resolveWipingFrames(authored, [aperture], [0], 0).map((frame) => frame.variant)).toEqual(["orange"]);
    const mid = resolveWipingFrames(authored, [aperture], [0], 300);
    const overlay = mid.find((frame) => frame.variant === "grey");
    const orange = mid.filter((frame) => frame.variant === "orange");
    expect(overlay).toBeDefined();
    expect(orange.length).toBeGreaterThan(1);
    expect(overlay?.rect.width).toBeGreaterThan(0);
    expect(overlay?.rect.width).toBeLessThan(aperture.width);
    expect(overlay?.rect.x).toBeGreaterThan(aperture.x);
    for (const frame of orange) {
      const overlayRight = overlay!.rect.x + overlay!.rect.width;
      const overlayBottom = overlay!.rect.y + overlay!.rect.height;
      const orangeRight = frame.rect.x + frame.rect.width;
      const orangeBottom = frame.rect.y + frame.rect.height;
      const overlaps =
        frame.rect.x < overlayRight &&
        orangeRight > overlay!.rect.x &&
        frame.rect.y < overlayBottom &&
        orangeBottom > overlay!.rect.y;
      expect(overlaps).toBe(false);
    }
    expect(resolveWipingFrames(authored, [aperture], [0], 20_000).map((frame) => frame.variant)).toEqual(["grey"]);
  });

  it("starts the overlay and orange iris together", () => {
    expect(speakerWiperStaggerMs("grey")).toBe(0);
    expect(speakerWiperStaggerMs("orange")).toBe(0);
    expect(speakerWiperProgress(16, 0)).toBeGreaterThan(0);
  });

  it("jumps authored frames to rest when reduced motion is on", () => {
    const authored = resolveAuthoredFrames(
      [{ imageIndex: 0, x: 0, y: 0, width: 1, height: 1, span: false, variant: "grey" as const }],
      [aperture],
    );
    const frames = resolveWipingFrames(authored, [aperture], [9_000], 9_010, { reducedMotion: true });
    expect(frames.map((frame) => frame.variant)).toEqual(["grey"]);
    expect(frames[0]?.rect).toEqual(aperture);
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

  it("delays the iris until after the shader reveal", () => {
    const clock = { startedAtMs: [null], pending: new Set<number>() };
    armSpeakerWiper(clock, 0, { imageReady: true, reducedMotion: false, nowMs: 80 });
    commitPendingSpeakerWipers(clock, 120, SPEAKER_WIPER_SHADER_DELAY_MS);
    expect(clock.startedAtMs[0]).toBe(120 + SPEAKER_WIPER_SHADER_DELAY_MS);
    expect(SPEAKER_WIPER_SHADER_DELAY_MS).toBe(950);
  });

  it("replays the same orange-then-iris settle from the start", () => {
    const clock = { startedAtMs: [0], pending: new Set<number>() };
    expect(replaySpeakerWiper(clock, 0, { imageReady: true, reducedMotion: false, nowMs: 800 })).toBe("armed");
    expect(clock.startedAtMs[0]).toBeNull();
    expect(clock.pending.has(0)).toBe(true);
    commitPendingSpeakerWipers(clock, 840);
    expect(clock.startedAtMs[0]).toBe(840);
  });

  it("enters a wipe at 28% visibility and only marks leave when fully gone", () => {
    expect(speakerWiperShouldEnter(0.27)).toBe(false);
    expect(speakerWiperShouldEnter(0.28)).toBe(true);
    expect(speakerWiperShouldLeave(0.01)).toBe(false);
    expect(speakerWiperShouldLeave(0)).toBe(true);
  });

  it("keeps a live clock through orange hold and iris, then rests", () => {
    expect(speakerWiperNeedsLiveClock(null, 100, true)).toBe(true);
    expect(speakerWiperNeedsLiveClock(1_000, 1_000, false)).toBe(true);
    expect(speakerWiperNeedsLiveClock(1_000, 1_000 + SPEAKER_WIPER_DURATION_MS - 1, false)).toBe(true);
    expect(speakerWiperNeedsLiveClock(1_000, 1_000 + SPEAKER_WIPER_DURATION_MS, false)).toBe(false);
    expect(speakerWiperNeedsLiveClock(null, 100, false)).toBe(false);

    const clock = { startedAtMs: [0, null], pending: new Set<number>() };
    expect(speakerWiperClockIsLive(clock, 100)).toBe(true);
    expect(speakerWiperClockIsLive(clock, 20_000)).toBe(false);
    clock.pending.add(1);
    expect(speakerWiperClockIsLive(clock, 20_000)).toBe(true);
  });

  it("runs the iris clip in 900ms", () => {
    expect(SPEAKER_WIPER_DURATION_MS).toBe(900);
    expect(speakerWiperProgress(450, 0)).toBe(0.5);
  });
});
