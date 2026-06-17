import { describe, expect, it } from "vitest";
import { DEFAULT_STRIPES_SHADER_CONFIG, normalizeStripesShaderConfig } from "./StripesShaderConfig";

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
  });

  it("passes provided sub-config values through their normalizers (clamping)", () => {
    const n = normalizeStripesShaderConfig({ sparkleGapsActivePercent: 5 });
    expect(n.sparkleGapsActivePercent).toBeLessThanOrEqual(1); // clamp 0..1
  });
});
