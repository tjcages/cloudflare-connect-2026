import { describe, expect, it } from "vitest";
import { SPEAKER_FRAME_DEFAULTS } from "../speakers/speaker-frame-controls";
import type { EditableStripe } from "./stripeAdapter";
import { seedSpeakerFramesPanelValues, speakerFramesFromPanelValues } from "./speakerFramesFields";

describe("speaker frame panel mapping", () => {
  it("round-trips independent orange and white stripe palettes", () => {
    const seeded = seedSpeakerFramesPanelValues({
      ...SPEAKER_FRAME_DEFAULTS,
      orange: {
        ...SPEAKER_FRAME_DEFAULTS.orange,
        brightness: 0.21,
        stripes: SPEAKER_FRAME_DEFAULTS.orange.stripes.map((stripe, index) =>
          index === 0 ? { ...stripe, color: "#ff0000", width: 0.31 } : stripe,
        ),
      },
      white: {
        ...SPEAKER_FRAME_DEFAULTS.white,
        invert: true,
        brightness: 0.12,
        stripes: SPEAKER_FRAME_DEFAULTS.white.stripes.map((stripe, index) =>
          index === 0 ? { ...stripe, color: "#112233", width: 0.42 } : stripe,
        ),
      },
    });
    const orangeStripes = seeded.stripes as EditableStripe[];
    const whiteStripes = seeded.whiteStripes as EditableStripe[];

    expect(orangeStripes[0]?.hex).toBe("#ff0000");
    expect(whiteStripes[0]?.hex).toBe("#112233");
    expect(seeded.whiteInvert).toBe(true);

    const next = speakerFramesFromPanelValues({
      ...seeded,
      whiteStripes: whiteStripes.map((stripe, index) =>
        index === 0 ? { ...stripe, hex: "#abcdef", width: 0.5 } : stripe,
      ),
      whiteBrightness: 0.08,
    });

    expect(next.orange.stripes[0]?.color).toBe("#ff0000");
    expect(next.orange.brightness).toBe(0.21);
    expect(next.white.stripes[0]?.color).toBe("#abcdef");
    expect(next.white.stripes[0]?.width).toBe(0.5);
    expect(next.white.brightness).toBe(0.08);
    expect(next.white.invert).toBe(true);
  });

  it("round-trips the white pane's own grid geometry", () => {
    const seeded = seedSpeakerFramesPanelValues({
      ...SPEAKER_FRAME_DEFAULTS,
      white: {
        ...SPEAKER_FRAME_DEFAULTS.white,
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

    expect(seeded.whiteGridCellWidth).toBe(11);
    expect(seeded.whiteGridOrientation).toBe("horizontal");
    expect(seeded.whiteFieldScale).toBe(1.4);

    const next = speakerFramesFromPanelValues({
      ...seeded,
      whiteGridCellWidth: 6,
      whiteGridAngle: -15,
      whiteFieldScale: 0.9,
    });

    expect(next.white.grid).toMatchObject({
      cellWidth: 6,
      cellHeight: 8,
      angleDeg: -15,
      fieldScale: 0.9,
      orientation: "horizontal",
    });
    expect(next.gridCellWidth).toBe(SPEAKER_FRAME_DEFAULTS.gridCellWidth);
    expect(next.orange.grid).toBeUndefined();
  });

  it("round-trips orange and white frame background colors", () => {
    const seeded = seedSpeakerFramesPanelValues({
      ...SPEAKER_FRAME_DEFAULTS,
      orange: { ...SPEAKER_FRAME_DEFAULTS.orange, bgColor: "#112233" },
      white: { ...SPEAKER_FRAME_DEFAULTS.white, bgColor: "#abcdef" },
    });

    expect(seeded.bgColor).toBe("#112233");
    expect(seeded.whiteBgColor).toBe("#abcdef");

    const next = speakerFramesFromPanelValues({
      ...seeded,
      bgColor: "#ff00aa",
      whiteBgColor: "#00ffaa",
    });

    expect(next.orange.bgColor).toBe("#ff00aa");
    expect(next.white.bgColor).toBe("#00ffaa");
    expect(next.grey.bgColor).toBe(SPEAKER_FRAME_DEFAULTS.grey.bgColor);
  });
});
