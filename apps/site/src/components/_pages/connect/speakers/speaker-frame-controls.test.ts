import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import {
  defaultSpeakerFramePlacements,
  loadSpeakerFrameSettings,
  sanitizeSpeakerFramePlacements,
  SPEAKER_FRAME_DEFAULTS,
  SPEAKER_FRAME_PANEL_ID,
  SPEAKER_POINTER_VARIANT,
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

  it("authors a full-bleed overlay with no rest orange pane", () => {
    const placements = defaultSpeakerFramePlacements();
    const byImage = new Map<number, number>();
    for (const placement of placements) {
      byImage.set(placement.imageIndex, (byImage.get(placement.imageIndex) ?? 0) + 1);
    }

    expect(placements.every((placement) => placement.variant === "grey")).toBe(true);
    expect([...byImage.values()].every((count) => count === 1)).toBe(true);
    expect(placements[0]).toMatchObject({ variant: "grey", x: 0, width: 1, y: 0, height: 1 });
  });

  it("routes the pointer viewfinder through the overlay look", () => {
    expect(SPEAKER_POINTER_VARIANT).toBe("grey");
  });

  it("keeps the grey palette distinct from the orange production stripes", () => {
    expect(SPEAKER_FRAME_DEFAULTS.grey.stripes[2].color).not.toBe(SPEAKER_FRAME_DEFAULTS.orange.stripes[2].color);
    expect(speakerVariantEngineConfig(SPEAKER_FRAME_DEFAULTS, "grey").stripes).not.toEqual(
      speakerVariantEngineConfig(SPEAKER_FRAME_DEFAULTS, "orange").stripes,
    );
  });

  it("authors the orange pane with a four-stop Cloudflare ramp on a 7×7 grid", () => {
    expect(SPEAKER_FRAME_DEFAULTS.orange.stripes.map((stripe) => stripe.color)).toEqual([
      "#f46021",
      "#fea700",
      "#fea700",
      "#fea700",
    ]);
    expect(SPEAKER_FRAME_DEFAULTS.orange.stripes[0]).toMatchObject({ startFrom: 0, width: 0.5, opacity: 1 });
    expect(SPEAKER_FRAME_DEFAULTS.orange.bgColor).toBe("#f46021");
    expect(SPEAKER_FRAME_DEFAULTS.orange.invert).toBe(true);

    const orange = speakerVariantEngineConfig(SPEAKER_FRAME_DEFAULTS, "orange");
    const overlay = speakerVariantEngineConfig(SPEAKER_FRAME_DEFAULTS, "grey");
    expect(orange.grid).toMatchObject({
      cellWidth: 7,
      cellHeight: 7,
      angleDeg: 45,
      overlapAmount: 1.2,
    });
    expect(orange.fieldScale).toBe(1);
    expect(overlay.grid).toMatchObject({
      cellWidth: SPEAKER_FRAME_DEFAULTS.gridCellWidth,
      cellHeight: SPEAKER_FRAME_DEFAULTS.gridCellHeight,
      angleDeg: SPEAKER_FRAME_DEFAULTS.gridAngle,
    });
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
    expect(
      sanitizeSpeakerFramePlacements([
        { id: "legacy", imageIndex: 0, variant: "white", x: 0.9, y: 0, width: 0.1, height: 1, span: false },
        { id: "retired", imageIndex: 0, variant: "dark", x: 0.9, y: 0, width: 0.1, height: 1, span: false },
      ]),
    ).toEqual(defaultSpeakerFramePlacements());
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
    expect(migrated.dark.invert).toBe(false);
    expect(migrated.dark.stripes[0]?.color).toBe(migrated.orange.stripes[0]?.color);
  });

  it("loads an authored dark look without sharing the orange stripe table", () => {
    const dark = {
      ...SPEAKER_FRAME_DEFAULTS.dark,
      invert: true,
      brightness: 0.12,
      stripes: SPEAKER_FRAME_DEFAULTS.dark.stripes.map((stripe, index) =>
        index === 0 ? { ...stripe, color: "#112233", width: 0.42 } : stripe,
      ),
    };
    localStorage.setItem(
      `panels:${SPEAKER_FRAME_PANEL_ID}`,
      JSON.stringify({
        placements: defaultSpeakerFramePlacements(),
        orange: SPEAKER_FRAME_DEFAULTS.orange,
        white: dark,
        grey: SPEAKER_FRAME_DEFAULTS.grey,
      }),
    );

    const loaded = loadSpeakerFrameSettings();
    expect(loaded.dark.invert).toBe(true);
    expect(loaded.dark.brightness).toBe(0.12);
    expect(loaded.dark.stripes[0]?.color).toBe("#112233");
    expect(loaded.orange.stripes[0]?.color).not.toBe("#112233");
  });

  it("rewrites leftover factory two-pane wipers onto a full-bleed overlay", () => {
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
    expect(loaded.placements).toEqual(defaultSpeakerFramePlacements());
    expect(loaded.placements[0]).toMatchObject({ variant: "grey", x: 0, width: 1 });
  });

  it("rewrites leftover overlay + orange + dark triples onto a full-bleed overlay", () => {
    localStorage.setItem(
      "panels:connect-speaker-frames-v6",
      JSON.stringify({
        placements: Array.from({ length: 6 }, (_, imageIndex) => [
          { id: `${imageIndex}-overlay`, imageIndex, variant: "grey", x: 0, y: 0, width: 0.8, height: 1, span: false },
          { id: `${imageIndex}-inverted`, imageIndex, variant: "orange", x: 0.8, y: 0, width: 0.1, height: 1, span: false },
          { id: `${imageIndex}-dark`, imageIndex, variant: "dark", x: 0.9, y: 0, width: 0.1, height: 1, span: false },
        ]).flat(),
        orange: SPEAKER_FRAME_DEFAULTS.orange,
        grey: SPEAKER_FRAME_DEFAULTS.grey,
      }),
    );

    expect(loadSpeakerFrameSettings().placements).toEqual(defaultSpeakerFramePlacements());
  });

  it("rewrites leftover 80/20 overlay-plus-orange strips onto a full-bleed overlay", () => {
    localStorage.setItem(
      "panels:connect-speaker-frames-v7",
      JSON.stringify({
        placements: Array.from({ length: 6 }, (_, imageIndex) => [
          { id: `${imageIndex}-overlay`, imageIndex, variant: "grey", x: 0, y: 0, width: 0.8, height: 1, span: false },
          { id: `${imageIndex}-inverted`, imageIndex, variant: "orange", x: 0.8, y: 0, width: 0.2, height: 1, span: false },
        ]).flat(),
        orange: SPEAKER_FRAME_DEFAULTS.orange,
        grey: SPEAKER_FRAME_DEFAULTS.grey,
      }),
    );

    expect(loadSpeakerFrameSettings().placements).toEqual(defaultSpeakerFramePlacements());
  });
});
