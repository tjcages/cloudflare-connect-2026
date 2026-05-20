import { describe, expect, it, vi } from "vitest";
import { DEFAULT_CONFIG } from "../grid/config";
import {
  copyBuilderDocumentSnapshotToClipboard,
  getBuilderDocumentSnapshot,
  parseBuilderDocumentSnapshotInput,
  serializeBuilderDocumentSnapshot,
  type BuilderDocumentSnapshot,
} from "./documentSnapshot";

const sampleSnapshot: BuilderDocumentSnapshot = {
  gridConfig: { ...DEFAULT_CONFIG, seed: "share-test" },
  instances: [],
  nextInstanceIndex: 2,
  selectedInstanceId: null,
  canvasPan: { x: 10, y: 20 },
};

describe("documentSnapshot", () => {
  it("getBuilderDocumentSnapshot mirrors persist partialize fields", () => {
    const snapshot = getBuilderDocumentSnapshot({
      gridConfig: sampleSnapshot.gridConfig,
      instances: sampleSnapshot.instances,
      nextInstanceIndex: 5,
      selectedInstanceId: "icon-box-1",
      canvasPan: { x: 1, y: 2 },
    });

    expect(snapshot).toEqual({
      gridConfig: sampleSnapshot.gridConfig,
      instances: [],
      nextInstanceIndex: 5,
      selectedInstanceId: "icon-box-1",
      canvasPan: { x: 1, y: 2 },
    });
  });

  it("serializeBuilderDocumentSnapshot round-trips through parse", () => {
    const text = serializeBuilderDocumentSnapshot(sampleSnapshot);
    const parsed = parseBuilderDocumentSnapshotInput(text);

    expect(parsed).toEqual(sampleSnapshot);
  });

  it("parseBuilderDocumentSnapshotInput unwraps zustand persist envelope", () => {
    const inner = { ...sampleSnapshot, gridConfig: { ...DEFAULT_CONFIG, seed: "envelope" } };
    const text = JSON.stringify({ state: inner, version: 2 });
    expect(parseBuilderDocumentSnapshotInput(text)).toEqual(inner);
  });

  it("parseBuilderDocumentSnapshotInput throws on invalid JSON", () => {
    expect(() => parseBuilderDocumentSnapshotInput("{")).toThrow();
  });

  it("copyBuilderDocumentSnapshotToClipboard writes serialized JSON", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", { clipboard: { writeText } });

    const ok = await copyBuilderDocumentSnapshotToClipboard(sampleSnapshot);

    expect(ok).toBe(true);
    expect(writeText).toHaveBeenCalledWith(serializeBuilderDocumentSnapshot(sampleSnapshot));
  });

  it("copyBuilderDocumentSnapshotToClipboard returns false when clipboard is unavailable", async () => {
    vi.stubGlobal("navigator", {});

    await expect(copyBuilderDocumentSnapshotToClipboard(sampleSnapshot)).resolves.toBe(false);
  });
});
