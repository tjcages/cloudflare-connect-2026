import { describe, expect, it, vi } from "vitest";
import { DEFAULT_CONFIG } from "../grid/config";
import { createComponentInstance } from "./componentRegistry";
import { getDefaultDocumentSlice } from "../storePersist";
import {
  __testOnlySerializeV1,
  __testOnlySerializeV2,
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

  it("serializeBuilderDocumentSnapshot round-trips through parse", async () => {
    const text = serializeBuilderDocumentSnapshot(sampleSnapshot);
    const parsed = await parseBuilderDocumentSnapshotInput(text);

    expect(parsed).toEqual(sampleSnapshot);
    expect(text).not.toMatch(/\n\s+/);
    expect(text.startsWith('{"v":')).toBe(true);
  });

  it("v3 encoding is shorter than v2 for the default document", () => {
    const { gridConfig, instances, nextInstanceIndex, selectedInstanceId } = getDefaultDocumentSlice();
    const snapshot: BuilderDocumentSnapshot = {
      gridConfig,
      instances,
      nextInstanceIndex,
      selectedInstanceId,
      canvasPan: { x: 0, y: 0 },
    };

    expect(serializeBuilderDocumentSnapshot(snapshot).length).toBeLessThan(__testOnlySerializeV2(snapshot).length);
  });

  it("v2 encoding is shorter than v1 for the default document", () => {
    const { gridConfig, instances, nextInstanceIndex, selectedInstanceId } = getDefaultDocumentSlice();
    const snapshot: BuilderDocumentSnapshot = {
      gridConfig,
      instances,
      nextInstanceIndex,
      selectedInstanceId,
      canvasPan: { x: 0, y: 0 },
    };

    const v1 = __testOnlySerializeV1(snapshot);
    const v2 = serializeBuilderDocumentSnapshot(snapshot);

    expect(v2.length).toBeLessThan(v1.length);
  });

  it("serializeBuilderDocumentSnapshot round-trips icon-box-1x2 layers", async () => {
    const box = createComponentInstance("icon-box-1x2", 40, 52, 7, 800, 560);
    const snapshot: BuilderDocumentSnapshot = {
      ...sampleSnapshot,
      instances: [box],
      nextInstanceIndex: 8,
      selectedInstanceId: box.id,
    };
    const text = serializeBuilderDocumentSnapshot(snapshot);
    await expect(parseBuilderDocumentSnapshotInput(text)).resolves.toEqual(snapshot);
  });

  it("parseBuilderDocumentSnapshotInput accepts legacy full-key snapshots", async () => {
    const legacy = JSON.stringify(sampleSnapshot);
    await expect(parseBuilderDocumentSnapshotInput(legacy)).resolves.toEqual(sampleSnapshot);
  });

  it("parseBuilderDocumentSnapshotInput accepts compact v1 snapshots", async () => {
    const v1 = __testOnlySerializeV1(sampleSnapshot);
    await expect(parseBuilderDocumentSnapshotInput(v1)).resolves.toEqual(sampleSnapshot);
  });

  it("parseBuilderDocumentSnapshotInput unwraps zustand persist envelope", async () => {
    const inner = { ...sampleSnapshot, gridConfig: { ...DEFAULT_CONFIG, seed: "envelope" } };
    const text = JSON.stringify({ state: inner, version: 2 });
    await expect(parseBuilderDocumentSnapshotInput(text)).resolves.toEqual(inner);
  });

  it("parseBuilderDocumentSnapshotInput throws on invalid JSON", async () => {
    await expect(parseBuilderDocumentSnapshotInput("{")).rejects.toThrow();
  });

  it("gzip payload round-trips when CompressionStream is available", async () => {
    if (typeof CompressionStream === "undefined") {
      return;
    }

    const { gridConfig, instances, nextInstanceIndex, selectedInstanceId } = getDefaultDocumentSlice();
    const snapshot: BuilderDocumentSnapshot = {
      gridConfig,
      instances,
      nextInstanceIndex,
      selectedInstanceId,
      canvasPan: { x: 0, y: 0 },
    };

    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", { clipboard: { writeText } });

    await copyBuilderDocumentSnapshotToClipboard(snapshot);

    const written = writeText.mock.calls[0][0] as string;
    expect(written.startsWith("z:")).toBe(true);
    await expect(parseBuilderDocumentSnapshotInput(written)).resolves.toEqual(snapshot);
  });

  it("copyBuilderDocumentSnapshotToClipboard writes serialized JSON when gzip is unavailable", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", { clipboard: { writeText } });

    const gzipBackup = globalThis.CompressionStream;
    // @ts-expect-error test stub
    globalThis.CompressionStream = undefined;

    const ok = await copyBuilderDocumentSnapshotToClipboard(sampleSnapshot);

    globalThis.CompressionStream = gzipBackup;

    expect(ok).toBe(true);
    const written = writeText.mock.calls[0][0] as string;
    expect(written.startsWith("z:") || written.startsWith('{"v":')).toBe(true);
    await expect(parseBuilderDocumentSnapshotInput(written)).resolves.toEqual(sampleSnapshot);
  });

  it("copyBuilderDocumentSnapshotToClipboard returns false when clipboard is unavailable", async () => {
    vi.stubGlobal("navigator", {});

    await expect(copyBuilderDocumentSnapshotToClipboard(sampleSnapshot)).resolves.toBe(false);
  });
});
