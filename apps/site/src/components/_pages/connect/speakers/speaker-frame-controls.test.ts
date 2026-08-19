import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import {
  defaultSpeakerFramePlacements,
  loadSpeakerFrameSettings,
  sanitizeSpeakerFramePlacements,
  SPEAKER_FRAME_DEFAULTS,
  SPEAKER_FRAME_PANEL_ID,
  speakerVariantEngineConfig,
} from "./speaker-frame-controls";

const memory = new Map<string, string>();

beforeAll(() => {
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => memory.get(key) ?? null,
    setItem: (key: string, value: string) => {
      memory.set(key, value);
    },
    removeItem: (key: string) => {
      memory.delete(key);
    },
    clear: () => {
      memory.clear();
    },
  });
});

describe("speaker frame controls", () => {
  afterEach(() => {
    memory.clear();
  });

  it("authors two 10% frames per image, resting on the right edge", () => {
    const placements = defaultSpeakerFramePlacements();
    const byImage = new Map<number, number>();
    for (const placement of placements) {
      byImage.set(placement.imageIndex, (byImage.get(placement.imageIndex) ?? 0) + 1);
    }

    expect(placements.some((placement) => placement.variant === "orange")).toBe(true);
    expect(placements.some((placement) => placement.variant === "white")).toBe(true);
    expect([...byImage.values()].every((count) => count === 2)).toBe(true);
    expect(placements[0]).toMatchObject({ variant: "orange", x: 0.8, width: 0.1, y: 0, height: 1 });
    expect(placements[1]).toMatchObject({ variant: "white", x: 0.9, width: 0.1, y: 0, height: 1 });
  });

  it("keeps the grey palette distinct from the orange production stripes", () => {
    expect(SPEAKER_FRAME_DEFAULTS.grey.stripes[2].color).not.toBe(SPEAKER_FRAME_DEFAULTS.orange.stripes[2].color);
    expect(speakerVariantEngineConfig(SPEAKER_FRAME_DEFAULTS, "grey").stripes).not.toEqual(
      speakerVariantEngineConfig(SPEAKER_FRAME_DEFAULTS, "orange").stripes,
    );
  });

  it("drops invalid placements and restores defaults when the list is empty", () => {
    expect(
      sanitizeSpeakerFramePlacements([
        { id: "", imageIndex: 0, variant: "orange", x: 0, y: 0, width: 0.2, height: 0.2, span: false },
        { id: "ok", imageIndex: 0, variant: "grey", x: 0.1, y: 0.2, width: 0.3, height: 0.4, span: true },
        { id: "bad-image", imageIndex: 99, variant: "orange", x: 0, y: 0, width: 0.2, height: 0.2, span: false },
      ]),
    ).toEqual([
      {
        id: "ok",
        imageIndex: 0,
        variant: "grey",
        x: 0.1,
        y: 0.2,
        width: 0.3,
        height: 0.4,
        span: true,
      },
    ]);
    expect(sanitizeSpeakerFramePlacements([])).toEqual(defaultSpeakerFramePlacements());
  });

  it("loads v3 placements and falls back to authored frames for a v2 blob", () => {
    localStorage.setItem(
      `panels:${SPEAKER_FRAME_PANEL_ID}`,
      JSON.stringify({
        placements: [
          {
            id: "custom",
            imageIndex: 2,
            variant: "grey",
            x: 0.2,
            y: 0.3,
            width: 0.4,
            height: 0.5,
            span: false,
          },
        ],
        orange: SPEAKER_FRAME_DEFAULTS.orange,
        grey: SPEAKER_FRAME_DEFAULTS.grey,
      }),
    );
    expect(loadSpeakerFrameSettings().placements).toEqual([
      {
        id: "custom",
        imageIndex: 2,
        variant: "grey",
        x: 0.2,
        y: 0.3,
        width: 0.4,
        height: 0.5,
        span: false,
      },
    ]);

    localStorage.clear();
    localStorage.setItem(
      "panels:connect-speaker-frames-v2",
      JSON.stringify({
        frameCount: 3,
        stripes: SPEAKER_FRAME_DEFAULTS.orange.stripes,
        brightness: 0.11,
      }),
    );
    const migrated = loadSpeakerFrameSettings();
    expect(migrated.placements).toEqual(defaultSpeakerFramePlacements());
    expect(migrated.orange.brightness).toBe(0.11);
    expect(migrated.grey.stripes.length).toBeGreaterThan(0);
    expect(migrated.white.invert).toBe(false);
    expect(migrated.white.stripes[0]?.color).toBe(migrated.orange.stripes[0]?.color);
  });

  it("loads an authored white look without sharing the orange stripe table", () => {
    const white = {
      ...SPEAKER_FRAME_DEFAULTS.white,
      invert: true,
      brightness: 0.12,
      stripes: SPEAKER_FRAME_DEFAULTS.white.stripes.map((stripe, index) =>
        index === 0 ? { ...stripe, color: "#112233", width: 0.42 } : stripe,
      ),
    };
    localStorage.setItem(
      `panels:${SPEAKER_FRAME_PANEL_ID}`,
      JSON.stringify({
        placements: defaultSpeakerFramePlacements(),
        orange: SPEAKER_FRAME_DEFAULTS.orange,
        white,
        grey: SPEAKER_FRAME_DEFAULTS.grey,
      }),
    );

    const loaded = loadSpeakerFrameSettings();
    expect(loaded.white.invert).toBe(true);
    expect(loaded.white.brightness).toBe(0.12);
    expect(loaded.white.stripes[0]?.color).toBe("#112233");
    expect(loaded.orange.stripes[0]?.color).not.toBe("#112233");
    expect(speakerVariantEngineConfig(loaded, "white").stripes?.[0]).not.toEqual(
      speakerVariantEngineConfig(loaded, "orange").stripes?.[0],
    );
  });

  it("rewrites leftover left-edge factory wipers onto the right edge", () => {
    localStorage.setItem(
      "panels:connect-speaker-frames-v4",
      JSON.stringify({
        placements: [
          { id: "0-inverted", imageIndex: 0, variant: "orange", x: 0, y: 0, width: 0.1, height: 1, span: false },
          { id: "0-white", imageIndex: 0, variant: "white", x: 0.1, y: 0, width: 0.1, height: 1, span: false },
          { id: "1-inverted", imageIndex: 1, variant: "orange", x: 0, y: 0, width: 0.1, height: 1, span: false },
          { id: "1-white", imageIndex: 1, variant: "white", x: 0.1, y: 0, width: 0.1, height: 1, span: false },
          { id: "2-inverted", imageIndex: 2, variant: "orange", x: 0, y: 0, width: 0.1, height: 1, span: false },
          { id: "2-white", imageIndex: 2, variant: "white", x: 0.1, y: 0, width: 0.1, height: 1, span: false },
          { id: "3-inverted", imageIndex: 3, variant: "orange", x: 0, y: 0, width: 0.1, height: 1, span: false },
          { id: "3-white", imageIndex: 3, variant: "white", x: 0.1, y: 0, width: 0.1, height: 1, span: false },
          { id: "4-inverted", imageIndex: 4, variant: "orange", x: 0, y: 0, width: 0.1, height: 1, span: false },
          { id: "4-white", imageIndex: 4, variant: "white", x: 0.1, y: 0, width: 0.1, height: 1, span: false },
          { id: "5-inverted", imageIndex: 5, variant: "orange", x: 0, y: 0, width: 0.1, height: 1, span: false },
          { id: "5-white", imageIndex: 5, variant: "white", x: 0.1, y: 0, width: 0.1, height: 1, span: false },
        ],
        orange: SPEAKER_FRAME_DEFAULTS.orange,
        grey: SPEAKER_FRAME_DEFAULTS.grey,
      }),
    );

    const loaded = loadSpeakerFrameSettings();
    expect(loaded.placements[0]).toMatchObject({ variant: "orange", x: 0.8 });
    expect(loaded.placements[1]).toMatchObject({ variant: "white", x: 0.9 });
  });
});
