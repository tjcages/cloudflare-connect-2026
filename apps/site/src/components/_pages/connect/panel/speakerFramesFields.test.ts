import { describe, expect, it } from "vitest";
import { SPEAKER_FRAME_DEFAULTS } from "../speakers/speaker-frame-controls";
import type { EditableStripe } from "./stripeAdapter";
import { seedSpeakerFramesPanelValues, speakerFramesFromPanelValues } from "./speakerFramesFields";

describe("speaker frame panel mapping", () => {
  it("round-trips independent orange and overlay stripe palettes", () => {
    const seeded = seedSpeakerFramesPanelValues({
      ...SPEAKER_FRAME_DEFAULTS,
      orange: {
        ...SPEAKER_FRAME_DEFAULTS.orange,
        brightness: 0.21,
        stripes: SPEAKER_FRAME_DEFAULTS.orange.stripes.map((stripe, index) =>
          index === 0 ? { ...stripe, color: "#ff0000", width: 0.31 } : stripe,
        ),
      },
      grey: {
        ...SPEAKER_FRAME_DEFAULTS.grey,
        invert: true,
        brightness: 0.12,
        stripes: SPEAKER_FRAME_DEFAULTS.grey.stripes.map((stripe, index) =>
          index === 0 ? { ...stripe, color: "#112233", width: 0.42 } : stripe,
        ),
      },
    });
    const orangeStripes = seeded.stripes as EditableStripe[];
    const greyStripes = seeded.greyStripes as EditableStripe[];

    expect(orangeStripes[0]?.hex).toBe("#ff0000");
    expect(greyStripes[0]?.hex).toBe("#112233");
    expect(seeded.greyInvert).toBe(true);

    const next = speakerFramesFromPanelValues({
      ...seeded,
      greyStripes: greyStripes.map((stripe, index) =>
        index === 0 ? { ...stripe, hex: "#abcdef", width: 0.5 } : stripe,
      ),
      greyBrightness: 0.08,
    });

    expect(next.orange.stripes[0]?.color).toBe("#ff0000");
    expect(next.orange.brightness).toBe(0.21);
    expect(next.grey.stripes[0]?.color).toBe("#abcdef");
    expect(next.grey.stripes[0]?.width).toBe(0.5);
    expect(next.grey.brightness).toBe(0.08);
    expect(next.grey.invert).toBe(true);
    expect(next.dark).toEqual(SPEAKER_FRAME_DEFAULTS.dark);
  });

  it("round-trips the orange pane's own grid geometry", () => {
    const seeded = seedSpeakerFramesPanelValues({
      ...SPEAKER_FRAME_DEFAULTS,
      orange: {
        ...SPEAKER_FRAME_DEFAULTS.orange,
        grid: {
          cellWidth: 11,
          cellHeight: 8,
          gapX: 1,
          gapY: 2,
          cornerRadius: 0.5,
          overlapAmount: 0.4,
          orientation: "horizontal",
          angleDeg: 12,
          fieldScale: 1.4,
        },
      },
    });

    expect(seeded.orangeGridCellWidth).toBe(11);
    expect(seeded.orangeGridOrientation).toBe("horizontal");
    expect(seeded.orangeFieldScale).toBe(1.4);

    const next = speakerFramesFromPanelValues({
      ...seeded,
      orangeGridCellWidth: 6,
      orangeGridAngle: -15,
      orangeFieldScale: 0.9,
    });

    expect(next.orange.grid).toMatchObject({
      cellWidth: 6,
      cellHeight: 8,
      angleDeg: -15,
      fieldScale: 0.9,
      orientation: "horizontal",
    });
    expect(next.gridCellWidth).toBe(SPEAKER_FRAME_DEFAULTS.gridCellWidth);
  });

  it("round-trips orange and overlay frame background colors", () => {
    const seeded = seedSpeakerFramesPanelValues({
      ...SPEAKER_FRAME_DEFAULTS,
      orange: { ...SPEAKER_FRAME_DEFAULTS.orange, bgColor: "#112233" },
      grey: { ...SPEAKER_FRAME_DEFAULTS.grey, bgColor: "#abcdef" },
    });

    expect(seeded.bgColor).toBe("#112233");
    expect(seeded.greyBgColor).toBe("#abcdef");

    const next = speakerFramesFromPanelValues({
      ...seeded,
      bgColor: "#ff00aa",
      greyBgColor: "#00ffaa",
    });

    expect(next.orange.bgColor).toBe("#ff00aa");
    expect(next.grey.bgColor).toBe("#00ffaa");
    expect(next.dark.bgColor).toBe(SPEAKER_FRAME_DEFAULTS.dark.bgColor);
  });
});
