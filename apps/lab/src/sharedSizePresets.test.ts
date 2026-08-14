import { describe, expect, it } from "vitest";
import { parseSharedSizePresetId, sharedSizePresetId, validateSharedSizePresetInput } from "./sharedSizePresets";

describe("shared size presets", () => {
  it("round-trips a shared selector id", () => {
    expect(parseSharedSizePresetId(sharedSizePresetId("size-1"))).toBe("size-1");
    expect(parseSharedSizePresetId("custom")).toBeNull();
  });

  it("normalizes valid named print sizes", () => {
    expect(
      validateSharedSizePresetInput({ name: "  Lobby   wall  ", unit: "inches", width: 20, height: 10, ppi: 300 }),
    ).toEqual({
      ok: true,
      value: { name: "Lobby wall", unit: "inches", width: 20, height: 10, ppi: 300 },
    });
  });

  it("rejects invalid or excessive dimensions", () => {
    expect(validateSharedSizePresetInput({ name: "Bad", unit: "pixels", width: 9000, height: 10, ppi: 300 })).toEqual({
      ok: false,
      message: "Width must be between 0 and 8192 pixels.",
    });
  });
});
