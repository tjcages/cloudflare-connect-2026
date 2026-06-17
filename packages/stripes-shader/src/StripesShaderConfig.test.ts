import { describe, expect, it } from "vitest";
import { DEFAULT_STRIPES_SHADER_CONFIG, normalizeStripesShaderConfig } from "./StripesShaderConfig";
import { DEFAULT_PLAYGROUND_SPARKLE_GAPS_SPEED } from "./playgroundSparkle";
import {
  DEFAULT_PLAYGROUND_SPARKLE_WIDTH_ACTIVE_PERCENT,
  DEFAULT_PLAYGROUND_SPARKLE_WIDTH_SPEED,
} from "./playgroundWidthShuffle";

describe("StripesShaderConfig", () => {
  it("the clean type/default carries no deprecated fields", () => {
    const c = DEFAULT_STRIPES_SHADER_CONFIG as Record<string, unknown>;
    expect("textureGamma" in c).toBe(false);
    expect("sparkleRate" in c).toBe(false);
    expect("sparkleEnabled" in c).toBe(false);
    expect(c.duotoneEnabled).toBe(true);
    expect(Array.isArray(c.stripes)).toBe(true);
    expect((c.stripes as unknown[]).length).toBeGreaterThan(0);
  });

  it("normalizes an empty partial into a complete config with defaults", () => {
    const n = normalizeStripesShaderConfig({});
    expect(n.duotoneEnabled).toBe(true);
    expect(n.stripes.length).toBeGreaterThan(0);
    // sub-configs are filled by their own normalizers
    expect(n.grid).toBeDefined();
    expect(n.reveal).toBeDefined();
    expect(n.cursorTrail).toBeDefined();
    expect(n.clickWave).toBeDefined();
    // flames must be defined (filled by normalizePlaygroundFlamesConfig)
    expect(n.flames).toBeDefined();
  });

  it("passes provided sub-config values through their normalizers (clamping)", () => {
    const n = normalizeStripesShaderConfig({ sparkleGapsActivePercent: 5 });
    expect(n.sparkleGapsActivePercent).toBeLessThanOrEqual(1); // clamp 0..1
  });

  describe("absent sparkle fields match studio resolver semantics", () => {
    // Authority: resolvePersistedSparkleGapsActivePercent (playgroundSparkle.ts:113-129)
    // When sparkleGapsActivePercent is absent (and no legacy sparkleRate/sparkleEnabled),
    // the studio resolver returns 0 (sparkle OFF). The normalizer must match this.
    it("sparkleGapsActivePercent absent → 0 (OFF, matching resolvePersistedSparkleGapsActivePercent)", () => {
      const n = normalizeStripesShaderConfig({});
      expect(n.sparkleGapsActivePercent).toBe(0);
    });

    // Authority: resolvePersistedSparkleGapsSpeed (playgroundSparkle.ts:131-147)
    // When sparkleGapsSpeed is absent, the studio resolver returns DEFAULT_PLAYGROUND_SPARKLE_GAPS_SPEED (1).
    it("sparkleGapsSpeed absent → DEFAULT_PLAYGROUND_SPARKLE_GAPS_SPEED (matching resolvePersistedSparkleGapsSpeed)", () => {
      const n = normalizeStripesShaderConfig({});
      expect(n.sparkleGapsSpeed).toBe(DEFAULT_PLAYGROUND_SPARKLE_GAPS_SPEED);
    });

    // Authority: resolvePersistedSparkleWidthActivePercent (playgroundWidthShuffle.ts:244-249)
    // When sparkleWidthActivePercent is absent, the studio resolver returns
    // DEFAULT_PLAYGROUND_SPARKLE_WIDTH_ACTIVE_PERCENT (0.3). serializePlaygroundState omits the
    // field when it equals 0.3, so absent-on-wire round-trips cleanly as 0.3.
    it("sparkleWidthActivePercent absent → DEFAULT_PLAYGROUND_SPARKLE_WIDTH_ACTIVE_PERCENT (matching resolvePersistedSparkleWidthActivePercent)", () => {
      const n = normalizeStripesShaderConfig({});
      expect(n.sparkleWidthActivePercent).toBe(DEFAULT_PLAYGROUND_SPARKLE_WIDTH_ACTIVE_PERCENT);
    });

    // Authority: resolvePersistedSparkleWidthSpeed (playgroundWidthShuffle.ts:251-256)
    // When sparkleWidthSpeed is absent, the studio resolver returns DEFAULT_PLAYGROUND_SPARKLE_WIDTH_SPEED (1).
    it("sparkleWidthSpeed absent → DEFAULT_PLAYGROUND_SPARKLE_WIDTH_SPEED (matching resolvePersistedSparkleWidthSpeed)", () => {
      const n = normalizeStripesShaderConfig({});
      expect(n.sparkleWidthSpeed).toBe(DEFAULT_PLAYGROUND_SPARKLE_WIDTH_SPEED);
    });

    // Clamping still works for width active percent (0–1 range enforced)
    it("sparkleWidthActivePercent explicit value is clamped to 0–1", () => {
      const n = normalizeStripesShaderConfig({ sparkleWidthActivePercent: 5 });
      expect(n.sparkleWidthActivePercent).toBeLessThanOrEqual(1);
      expect(n.sparkleWidthActivePercent).toBeGreaterThanOrEqual(0);
    });

    // Clamping still works for width speed (min 0.05)
    it("sparkleWidthSpeed explicit value is normalized (min 0.05)", () => {
      const n = normalizeStripesShaderConfig({ sparkleWidthSpeed: -1 });
      expect(n.sparkleWidthSpeed).toBeGreaterThanOrEqual(0.05);
    });

    // Explicit sparkleGapsActivePercent is passed through the normalizer
    it("explicit sparkleGapsActivePercent is normalized and clamped", () => {
      const n = normalizeStripesShaderConfig({ sparkleGapsActivePercent: 0.5 });
      expect(n.sparkleGapsActivePercent).toBe(0.5);
    });
  });
});
