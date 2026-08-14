import { describe, expect, it } from "vitest";
import {
  parseSharedSizePresetId,
  resolveSharedSizeSelectorValue,
  sharedSizePresetId,
  showSharedSizeActions,
  validateSharedSizePresetInput,
  type SharedSizePreset,
} from "./sharedSizePresets";

const teamSize: SharedSizePreset = {
  id: "size-1",
  name: "Lobby wall",
  unit: "inches",
  width: 20,
  height: 10,
  ppi: 300,
  createdAt: "2026-08-14T00:00:00.000Z",
  updatedAt: "2026-08-14T00:00:00.000Z",
};

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

  it("only keeps a shared selection after loading when that preset exists", () => {
    const sharedId = sharedSizePresetId(teamSize.id);
    expect(resolveSharedSizeSelectorValue(sharedId, [], "loading", "custom")).toBe(sharedId);
    expect(resolveSharedSizeSelectorValue(sharedId, [teamSize], "ready", "custom")).toBe(sharedId);
    expect(resolveSharedSizeSelectorValue(sharedId, [], "ready", "custom")).toBe("custom");
  });

  it("only shows shared size actions for a ready custom selection", () => {
    expect(showSharedSizeActions("custom", "ready", "custom")).toBe(true);
    expect(showSharedSizeActions("custom", "loading", "custom")).toBe(false);
    expect(showSharedSizeActions(sharedSizePresetId(teamSize.id), "ready", "custom")).toBe(false);
  });
});
