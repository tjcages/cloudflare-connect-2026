import { describe, expect, it, vi } from "vitest";
import { DEFAULT_CONFIG } from "../grid/config";
import {
  BUILDER_SHARE_BASE_URL,
  buildBuilderShareUrl,
  buildBuilderShareUrlFromSnapshot,
  copyBuilderShareLinkToClipboard,
  extractShareStateFromInput,
  readBuilderShareStateFromLocation,
} from "./builderShareLink";
import { parseBuilderDocumentSnapshotInput, serializeBuilderDocumentSnapshot } from "./documentSnapshot";
import type { BuilderDocumentSnapshot } from "./documentSnapshot";

const sampleSnapshot: BuilderDocumentSnapshot = {
  gridConfig: { ...DEFAULT_CONFIG, seed: "link-test" },
  instances: [],
  nextInstanceIndex: 2,
  selectedInstanceId: null,
  canvasPan: { x: 0, y: 0 },
};

describe("builderShareLink", () => {
  it("builds production share URLs with a state query param", () => {
    const url = buildBuilderShareUrl('{"v":5}');
    expect(url).toBe(`${BUILDER_SHARE_BASE_URL}?state=%7B%22v%22%3A5%7D`);
    expect(url).not.toContain("localhost");
  });

  it("extracts state payloads from pasted share URLs", () => {
    const payload = serializeBuilderDocumentSnapshot(sampleSnapshot);
    const url = buildBuilderShareUrl(payload);
    expect(extractShareStateFromInput(url)).toBe(payload);
  });

  it("reads state from location search params", () => {
    expect(readBuilderShareStateFromLocation({ search: "?state=abc123" })).toBe("abc123");
    expect(readBuilderShareStateFromLocation({ search: "" })).toBeNull();
  });

  it("buildBuilderShareUrlFromSnapshot round-trips through parse", async () => {
    const url = await buildBuilderShareUrlFromSnapshot(sampleSnapshot);
    expect(url.startsWith(`${BUILDER_SHARE_BASE_URL}?state=`)).toBe(true);
    const parsed = await parseBuilderDocumentSnapshotInput(url);
    expect(parsed).toEqual(sampleSnapshot);
  });

  it("copyBuilderShareLinkToClipboard writes the production share URL", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", { clipboard: { writeText } });

    const ok = await copyBuilderShareLinkToClipboard(sampleSnapshot);

    expect(ok).toBe(true);
    const written = writeText.mock.calls[0][0] as string;
    expect(written.startsWith(`${BUILDER_SHARE_BASE_URL}?state=`)).toBe(true);
    expect(written).not.toContain("localhost");
  });
});
