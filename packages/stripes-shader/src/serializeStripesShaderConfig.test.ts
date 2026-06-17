import { describe, expect, it } from "vitest";
import { normalizeStripesShaderConfig } from "./StripesShaderConfig";
import { serializeStripesShaderConfig } from "./serializeStripesShaderConfig";

describe("serializeStripesShaderConfig", () => {
  it("produces valid JSON that round-trips through normalize to an equivalent config", () => {
    const cfg = normalizeStripesShaderConfig({ duotoneEnabled: true, displayWidth: 848, displayHeight: 480 });
    const text = serializeStripesShaderConfig(cfg);
    const parsed = JSON.parse(text);
    const round = normalizeStripesShaderConfig(parsed);
    expect(round.displayWidth).toBe(848);
    expect(round.displayHeight).toBe(480);
    expect(round.stripes.length).toBe(cfg.stripes.length);
  });

  it("is pretty-printed (multi-line) and includes the meaningful fields", () => {
    const cfg = normalizeStripesShaderConfig({ displayWidth: 640 });
    const text = serializeStripesShaderConfig(cfg);
    expect(text).toContain("\n");
    expect(text).toContain("displayWidth");
  });
});
