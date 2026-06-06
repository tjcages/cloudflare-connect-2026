import { describe, expect, test } from "vitest";
import {
  DEFAULT_PLAYGROUND_REVEAL_CONFIG,
  isDefaultPlaygroundRevealConfig,
  normalizePlaygroundRevealConfig,
} from "./playgroundRevealConfig";

describe("playground reveal config", () => {
  test("normalizes wave config values into supported ranges", () => {
    const config = normalizePlaygroundRevealConfig({
      preset: "wave",
      wave: {
        position: "right bottom",
        durationMs: 50,
        softness: 2,
        waviness: -1,
        noiseScale: 0,
      },
    });

    expect(config).toEqual({
      preset: "wave",
      wave: {
        position: "right bottom",
        durationMs: 100,
        softness: 1,
        waviness: 0,
        noiseScale: 0.1,
      },
      randomColumns: DEFAULT_PLAYGROUND_REVEAL_CONFIG.randomColumns,
    });
  });

  test("normalizes random-columns config values into supported ranges", () => {
    const config = normalizePlaygroundRevealConfig({
      preset: "randomColumns",
      randomColumns: {
        durationMs: 50,
        stagger: 2,
        yShift: 2,
      },
    });

    expect(config).toEqual({
      preset: "randomColumns",
      wave: DEFAULT_PLAYGROUND_REVEAL_CONFIG.wave,
      randomColumns: {
        durationMs: 100,
        stagger: 1,
        yShift: 1,
      },
    });
  });

  test("detects the default reveal config", () => {
    expect(isDefaultPlaygroundRevealConfig(DEFAULT_PLAYGROUND_REVEAL_CONFIG)).toBe(true);
    expect(
      isDefaultPlaygroundRevealConfig(
        normalizePlaygroundRevealConfig({
          preset: "wave",
          wave: { ...DEFAULT_PLAYGROUND_REVEAL_CONFIG.wave, position: "left top" },
        }),
      ),
    ).toBe(false);
  });
});
