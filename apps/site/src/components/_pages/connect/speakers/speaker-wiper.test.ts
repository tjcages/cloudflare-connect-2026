import { describe, expect, it } from "vitest";
import { SPEAKER_FRAME_DEFAULTS } from "./speaker-frame-controls";
import {
  parseSpeakerWiperOverride,
  resolveSpeakerWipers,
  speakerWiperEngineConfig,
  speakerWiperProgress,
  speakerWiperRect,
  SPEAKER_WIPER_DURATION_MS,
  SPEAKER_WIPER_REST_WIDTH,
  SPEAKER_WIPER_STAGGER_MS,
} from "./speaker-wiper";

const aperture = { x: 40, y: 10, width: 200, height: 180 };

describe("speaker wiper intro", () => {
  it("starts on the left edge with no coverage", () => {
    expect(speakerWiperRect(aperture, 0, 0)).toEqual({
      x: 40,
      y: 10,
      width: 0,
      height: 180,
    });
    expect(speakerWiperProgress(0, 0)).toBe(0);
  });

  it("wipes across the portrait from the left before settling", () => {
    const mid = speakerWiperRect(aperture, 0, 0.3);
    expect(mid.x).toBe(40);
    expect(mid.y).toBe(10);
    expect(mid.height).toBe(180);
    expect(mid.width).toBeGreaterThan(40);
    expect(mid.width).toBeLessThan(200);
  });

  it("settles each pane at 10% width, stacked from the left", () => {
    const inverted = speakerWiperRect(aperture, 0, 1);
    const white = speakerWiperRect(aperture, 1, 1);

    expect(inverted).toEqual({
      x: 40,
      y: 10,
      width: 20,
      height: 180,
    });
    expect(white).toEqual({
      x: 60,
      y: 10,
      width: 20,
      height: 180,
    });
    expect(inverted.width / aperture.width).toBe(SPEAKER_WIPER_REST_WIDTH);
    expect(white.x).toBe(inverted.x + inverted.width);
  });

  it("staggers the second pane so it starts later", () => {
    expect(speakerWiperProgress(0, 1)).toBe(0);
    expect(speakerWiperProgress(180, 1)).toBe(0);
    expect(speakerWiperProgress(180, 0)).toBeGreaterThan(0);
    expect(speakerWiperProgress(10_000, 1)).toBe(1);
  });

  it("resolves inverted then white panes only after an image has started", () => {
    const idle = resolveSpeakerWipers([aperture], [null], 1_000);
    expect(idle).toEqual([]);

    const playing = resolveSpeakerWipers([aperture], [0], 10_000);
    expect(playing.map((frame) => frame.pane)).toEqual(["inverted", "white"]);
    expect(playing[0]?.rect.width).toBe(20);
    expect(playing[1]?.rect.x).toBe(60);
  });

  it("jumps to rest strips when reduced motion is on", () => {
    const frames = resolveSpeakerWipers([aperture], [9_000], 9_010, { reducedMotion: true });
    expect(frames[0]?.rect.width).toBe(20);
    expect(frames[1]?.rect.width).toBe(20);
  });

  it("keeps the same stripe colors on both panes, with invert only on the first", () => {
    const inverted = speakerWiperEngineConfig(SPEAKER_FRAME_DEFAULTS, "inverted");
    const white = speakerWiperEngineConfig(SPEAKER_FRAME_DEFAULTS, "white");

    expect(inverted.stripes).toEqual(white.stripes);
    expect(inverted.adjustments?.invert).toBe(true);
    expect(white.adjustments?.invert).toBe(false);
    expect(inverted.background?.color).toBe(0xff_bf_14);
    expect(white.background?.color).toBe(0xff_ff_ff);
  });

  it("reads a preview override from the query string", () => {
    expect(parseSpeakerWiperOverride("?speakerWiper=0.35")).toBe(0.35);
    expect(parseSpeakerWiperOverride("?speakerWiper=2")).toBe(1);
    expect(parseSpeakerWiperOverride("")).toBeUndefined();
  });

  it("maps a preview override onto elapsed time so the second pane stays staggered", () => {
    const mid = resolveSpeakerWipers([aperture], [null], 0, { progressOverride: 0.35 });
    expect(mid).toHaveLength(2);
    expect(mid[0]?.rect.width).toBeGreaterThan(mid[1]?.rect.width ?? 0);
    expect(mid[0]?.rect.x).toBe(40);
    expect(mid[1]?.rect.x).toBe(40);

    const done = resolveSpeakerWipers([aperture], [null], 0, { progressOverride: 1 });
    expect(done[0]?.rect.width).toBe(20);
    expect(done[1]?.rect.x).toBe(60);
    expect(0.35 * (SPEAKER_WIPER_DURATION_MS + SPEAKER_WIPER_STAGGER_MS)).toBeGreaterThan(SPEAKER_WIPER_STAGGER_MS);
  });
});
