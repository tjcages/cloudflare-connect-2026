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

  it("authors multiple frames per image across both variants", () => {
    const placements = defaultSpeakerFramePlacements();
    const byImage = new Map<number, number>();
    for (const placement of placements) {
      byImage.set(placement.imageIndex, (byImage.get(placement.imageIndex) ?? 0) + 1);
    }

    expect(placements.some((placement) => placement.variant === "orange")).toBe(true);
    expect(placements.some((placement) => placement.variant === "grey")).toBe(true);
    expect(placements.some((placement) => placement.span)).toBe(true);
    expect([...byImage.values()].some((count) => count > 1)).toBe(true);
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
  });
});
