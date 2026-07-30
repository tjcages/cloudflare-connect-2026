import { describe, expect, it } from "vitest";
import { normalizeEngineConfig } from "../config/normalize";
import { resolveEdgeMaskPlacement } from "./edgeMaskPlacement";

describe("resolveEdgeMaskPlacement", () => {
  it("applies the luminance mask to the field before stripe rendering", () => {
    const config = normalizeEngineConfig({
      colors: { mode: "luminance" },
      edgeMask: { enabled: true },
    });

    expect(resolveEdgeMaskPlacement(config)).toBe("field");
  });

  it("applies the colors mask to the rendered output", () => {
    const config = normalizeEngineConfig({
      colors: { mode: "colors" },
      edgeMask: { enabled: true },
    });

    expect(resolveEdgeMaskPlacement(config)).toBe("output");
  });

  it("skips the mask when it is disabled", () => {
    const config = normalizeEngineConfig({
      colors: { mode: "colors" },
      edgeMask: { enabled: false },
    });

    expect(resolveEdgeMaskPlacement(config)).toBe("none");
  });
});
