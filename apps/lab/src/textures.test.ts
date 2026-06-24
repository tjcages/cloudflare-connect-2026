import { describe, it, expect } from "vitest";
import { buildTextureEntries, findTextureEntry, LAB_TEXTURES } from "./textures";
import type { UploadEntry } from "./uploads";

const upload: UploadEntry = {
  id: "upload-1",
  label: "mine.png",
  kind: "image",
  defaultScale: 1,
  createdAt: 0,
};

describe("texture entries", () => {
  it("buildTextureEntries lists built-ins first, then uploads", () => {
    const entries = buildTextureEntries([upload]);
    expect(entries).toHaveLength(LAB_TEXTURES.length + 1);
    expect(entries.slice(0, LAB_TEXTURES.length).every((e) => e.origin === "builtin")).toBe(true);
    const last = entries[entries.length - 1];
    expect(last.id).toBe("upload-1");
    expect(last.origin).toBe("upload");
    expect(last.url).toBeNull();
  });

  it("findTextureEntry resolves built-ins and uploads", () => {
    expect(findTextureEntry("cloudflare-footer", [upload])?.origin).toBe("builtin");
    expect(findTextureEntry("upload-1", [upload])?.label).toBe("mine.png");
    expect(findTextureEntry("nope", [upload])).toBeUndefined();
  });
});
