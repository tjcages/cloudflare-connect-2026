import { describe, expect, it } from "vitest";
import { normalizeDebugStage, resolveDisplayPlan } from "./playgroundDisplayPlan";

describe("normalizeDebugStage", () => {
  it("passes through valid stages", () => {
    expect(normalizeDebugStage("normal")).toBe("normal");
    expect(normalizeDebugStage("source")).toBe("source");
    expect(normalizeDebugStage("processed")).toBe("processed");
  });
  it("falls back to normal for anything else", () => {
    expect(normalizeDebugStage(undefined)).toBe("normal");
    expect(normalizeDebugStage("stripes")).toBe("normal");
    expect(normalizeDebugStage(42)).toBe("normal");
  });
});

describe("resolveDisplayPlan", () => {
  it("normal + stripes → processed texture, stripe filter on, overlays visible", () => {
    expect(resolveDisplayPlan("normal", "stripes")).toEqual({
      textureSource: "processed",
      useStripeFilter: true,
      overlaysVisible: true,
    });
  });
  it("normal + preview (stripes off) → processed texture, no stripe filter, overlays visible", () => {
    expect(resolveDisplayPlan("normal", "preview")).toEqual({
      textureSource: "processed",
      useStripeFilter: false,
      overlaysVisible: true,
    });
  });
  it("normal + off → processed texture, no stripe filter, overlays visible", () => {
    expect(resolveDisplayPlan("normal", "off")).toEqual({
      textureSource: "processed",
      useStripeFilter: false,
      overlaysVisible: true,
    });
  });
  it("source stage → raw source, no stripe filter, overlays hidden (any mode)", () => {
    for (const mode of ["off", "preview", "stripes"] as const) {
      expect(resolveDisplayPlan("source", mode)).toEqual({
        textureSource: "source",
        useStripeFilter: false,
        overlaysVisible: false,
      });
    }
  });
  it("processed stage → processed texture, no stripe filter, overlays hidden (any mode)", () => {
    for (const mode of ["off", "preview", "stripes"] as const) {
      expect(resolveDisplayPlan("processed", mode)).toEqual({
        textureSource: "processed",
        useStripeFilter: false,
        overlaysVisible: false,
      });
    }
  });
});
