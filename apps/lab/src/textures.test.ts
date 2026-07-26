import { describe, it, expect } from "vitest";
import {
  buildTextureEntries,
  DEFAULT_LAB_TEXTURE_ID,
  findTextureEntry,
  LAB_TEXTURES,
  resolveTextureVariant,
} from "./textures";
import type { UploadEntry } from "./uploads";

const upload: UploadEntry = {
  id: "upload-1",
  label: "mine.png",
  kind: "image",
  defaultScale: 1,
  createdAt: 0,
  dark: {
    id: "upload-1-dark",
    label: "mine-dark.png",
    kind: "image",
  },
};

describe("texture entries", () => {
  it("uses the first built-in texture as the default", () => {
    expect(DEFAULT_LAB_TEXTURE_ID).toBe(LAB_TEXTURES[0]?.id);
  });

  it("buildTextureEntries lists built-ins first, then uploads", () => {
    const entries = buildTextureEntries([upload]);
    expect(entries).toHaveLength(LAB_TEXTURES.length + 1);
    expect(entries.slice(0, LAB_TEXTURES.length).every((e) => e.origin === "builtin")).toBe(true);
    const last = entries[entries.length - 1];
    expect(last.id).toBe("upload-1");
    expect(last.origin).toBe("upload");
    expect(last.url).toBeNull();
    expect(last.dark?.id).toBe("upload-1-dark");
  });

  it("findTextureEntry resolves built-ins and uploads", () => {
    expect(findTextureEntry(DEFAULT_LAB_TEXTURE_ID, [upload])?.origin).toBe("builtin");
    expect(findTextureEntry("upload-1", [upload])?.label).toBe("mine.png");
    expect(findTextureEntry("nope", [upload])).toBeUndefined();
  });

  it("uses the base upload in light mode and its paired texture in dark mode", () => {
    const entry = findTextureEntry("upload-1", [upload]);
    expect(entry).toBeDefined();
    expect(resolveTextureVariant(entry!, "light")).toEqual({ id: "upload-1", kind: "image" });
    expect(resolveTextureVariant(entry!, "dark")).toEqual({ id: "upload-1-dark", kind: "image" });
  });
});
