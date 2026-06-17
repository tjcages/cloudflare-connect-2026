import { describe, expect, test } from "vitest";
import {
  DEFAULT_PLAYGROUND_REVEAL_CONFIG,
  isDefaultPlaygroundRevealConfig,
  normalizePlaygroundRevealConfig,
} from "./playgroundRevealConfig";

describe("playground reveal config", () => {
  test("normalizes wave config values into supported ranges", () => {
    const config = normalizePlaygroundRevealConfig({
      wave: {
        position: "right bottom",
        durationMs: 50,
        softness: 2,
        waviness: -1,
        noiseScale: 0,
      },
    });

    expect(config).toEqual({
      enabled: false,
      wave: {
        position: "right bottom",
        durationMs: 100,
        softness: 1,
        waviness: 0,
        noiseScale: 0.1,
      },
    });
  });

  test("ignores legacy random-columns payload fields", () => {
    const config = normalizePlaygroundRevealConfig({
      enabled: true,
      preset: "randomColumns",
      randomColumns: { durationMs: 1800, stagger: 0.8, yShift: 0.35 },
    } as never);

    expect(config).toEqual({
      enabled: true,
      wave: { ...DEFAULT_PLAYGROUND_REVEAL_CONFIG.wave },
    });
  });

  test("detects the default reveal config", () => {
    expect(isDefaultPlaygroundRevealConfig(DEFAULT_PLAYGROUND_REVEAL_CONFIG)).toBe(true);
    expect(
      isDefaultPlaygroundRevealConfig(
        normalizePlaygroundRevealConfig({
          enabled: true,
          wave: { ...DEFAULT_PLAYGROUND_REVEAL_CONFIG.wave },
        }),
      ),
    ).toBe(false);
    expect(
      isDefaultPlaygroundRevealConfig(
        normalizePlaygroundRevealConfig({
          wave: { ...DEFAULT_PLAYGROUND_REVEAL_CONFIG.wave, position: "left top" },
        }),
      ),
    ).toBe(false);
  });
});
