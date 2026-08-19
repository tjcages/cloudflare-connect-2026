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
});
