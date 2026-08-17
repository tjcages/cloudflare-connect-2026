import { describe, expect, it } from "vitest";
import { normalizeEngineConfig } from "../config/normalize";
import { resolveEdgeMaskPlacement } from "./edgeMaskPlacement";

describe("resolveEdgeMaskPlacement", () => {
  it("tapers the stripe width in luminance mode", () => {
    const config = normalizeEngineConfig({
      colors: { mode: "luminance" },
      edgeMask: { enabled: true },
    });

    expect(resolveEdgeMaskPlacement(config)).toBe("stripe");
  });

  it("tapers the stripe width in colors mode too", () => {
    const config = normalizeEngineConfig({
      colors: { mode: "colors" },
      edgeMask: { enabled: true },
    });

    expect(resolveEdgeMaskPlacement(config)).toBe("stripe");
  });

  it("does not branch on the colour mode", () => {
    const luminance = normalizeEngineConfig({ colors: { mode: "luminance" }, edgeMask: { enabled: true } });
    const colors = normalizeEngineConfig({ colors: { mode: "colors" }, edgeMask: { enabled: true } });

    expect(resolveEdgeMaskPlacement(luminance)).toBe(resolveEdgeMaskPlacement(colors));
  });

  it("skips the mask when it is disabled", () => {
    const config = normalizeEngineConfig({
      colors: { mode: "colors" },
      edgeMask: { enabled: false },
    });

    expect(resolveEdgeMaskPlacement(config)).toBe("none");
  });
});
