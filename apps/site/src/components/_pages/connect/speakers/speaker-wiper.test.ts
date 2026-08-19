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
  speakerPaneWiggleRects,
  speakerPaneWiggleShift,
  speakerWiperProgress,
  speakerWiperShouldEnter,
  speakerWiperStaggerMs,
  SPEAKER_OVERLAY_REST_WIDTH,
  SPEAKER_PANE_WIGGLE_DURATION_MS,
  SPEAKER_WIPER_DARK_STAGGER_MS,
  SPEAKER_WIPER_DURATION_MS,
  SPEAKER_WIPER_REST_WIDTH,
  SPEAKER_WIPER_STAGGER_MS,
} from "./speaker-wiper";

const aperture = { x: 40, y: 10, width: 200, height: 180 };
const rest = { x: 40, y: 10, width: 20, height: 180 };

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

  it("collapses the authored frame from full width into its rest rect", () => {
    const mid = speakerFrameWiperRect(aperture, { x: 220, y: 10, width: 20, height: 180 }, 0.5);
    expect(mid.y).toBe(rest.y);
    expect(mid.height).toBe(rest.height);
    expect(mid.x).toBeGreaterThan(40);
    expect(mid.x).toBeLessThan(220);
    expect(mid.width).toBeGreaterThan(20);
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

    const playing = resolveWipingFrames(authored, [aperture], [0], 20_000);
    expect(playing.map((frame) => frame.variant)).toEqual(["orange", "dark"]);
    expect(playing[0]?.rect).toEqual({ x: 40, y: 10, width: 20, height: 180 });
    expect(playing[1]?.rect).toEqual({ x: 60, y: 10, width: 20, height: 180 });
  });

  it("lets the dark pane rest before orange, without the old extra stagger", () => {
    expect(speakerWiperStaggerMs("dark")).toBe(SPEAKER_WIPER_DARK_STAGGER_MS);
    expect(speakerWiperStaggerMs("dark")).toBeLessThan(speakerWiperStaggerMs("orange"));
    const bothClosedMs = SPEAKER_WIPER_DURATION_MS + SPEAKER_WIPER_STAGGER_MS;
    expect(SPEAKER_WIPER_DARK_STAGGER_MS + SPEAKER_WIPER_DURATION_MS).toBeLessThan(bothClosedMs);
    expect(speakerWiperProgress(bothClosedMs - 50, SPEAKER_WIPER_DARK_STAGGER_MS)).toBe(1);
    expect(speakerWiperProgress(bothClosedMs - 50, SPEAKER_WIPER_STAGGER_MS)).toBeLessThan(1);
  });

  it("trades orange and dark rest widths after both panes have closed", () => {
    const orange = { x: 200, y: 10, width: 20, height: 180 };
    const dark = { x: 220, y: 10, width: 20, height: 180 };
    expect(speakerPaneWiggleShift(-10, 20)).toBe(0);
    expect(speakerPaneWiggleShift(SPEAKER_PANE_WIGGLE_DURATION_MS + 50, 20)).toBe(0);
    const shift = speakerPaneWiggleShift(600, 20);
    expect(Math.abs(shift)).toBeGreaterThan(1);

    const wiggled = speakerPaneWiggleRects(orange, dark, 6);
    expect(wiggled.orange.width + wiggled.dark.width).toBe(40);
    expect(wiggled.dark.x).toBe(wiggled.orange.x + wiggled.orange.width);
    expect(wiggled.orange.width).toBe(26);
    expect(wiggled.dark.width).toBe(14);

    const authored = resolveAuthoredFrames(
      [
        { imageIndex: 0, x: 0.8, y: 0, width: 0.1, height: 1, span: false, variant: "orange" as const },
        { imageIndex: 0, x: 0.9, y: 0, width: 0.1, height: 1, span: false, variant: "dark" as const },
      ],
      [aperture],
    );
    const bothClosedMs = SPEAKER_WIPER_DURATION_MS + SPEAKER_WIPER_STAGGER_MS;
    const wiggling = resolveWipingFrames(authored, [aperture], [0], bothClosedMs + 600);
    expect(wiggling).toHaveLength(2);
    expect(wiggling[0]?.rect.width + wiggling[1]?.rect.width).toBeCloseTo(40);
    expect(wiggling[0]?.rect.width).not.toBe(20);
    expect(wiggling[1]?.rect.x).toBeCloseTo(wiggling[0]!.rect.x + wiggling[0]!.rect.width);

    const frozen = resolveWipingFrames(authored, [aperture], [0], bothClosedMs + 600, { progressOverride: 1 });
    expect(frozen[0]?.rect.width).toBe(20);
    expect(frozen[1]?.rect.width).toBe(20);
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

  it("replays the same full-width settle from the start", () => {
    const clock = { startedAtMs: [0], pending: new Set<number>() };
    expect(
      replaySpeakerWiper(clock, 0, { imageReady: true, reducedMotion: false, nowMs: 800 }),
    ).toBe("armed");
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
