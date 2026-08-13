import { describe, expect, it } from "vitest";
import { DEFAULT_ENGINE_CONFIG } from "@necatikcl/stripes-engine";
import { encodeMetadata, isValidOutputSize } from "./messages";

describe("Figma plugin messages", () => {
  it("keeps inserted shader metadata round-trippable", () => {
    const metadata = {
      config: structuredClone(DEFAULT_ENGINE_CONFIG),
      outputWidth: 800,
      outputHeight: 600,
      sourceName: "hero.png",
    };
    expect(JSON.parse(encodeMetadata(metadata))).toEqual(metadata);
  });

  it("enforces Figma's supported image dimensions", () => {
    expect(isValidOutputSize(4096, 4096)).toBe(true);
    expect(isValidOutputSize(4097, 800)).toBe(false);
    expect(isValidOutputSize(0, 800)).toBe(false);
  });
});
