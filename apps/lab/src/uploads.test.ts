import { describe, it, expect } from "vitest";
import { addUpload, removeUpload, setDarkUpload, type UploadEntry } from "./uploads";

const entry = (id: string): UploadEntry => ({
  id,
  label: `${id}.png`,
  kind: "image",
  defaultScale: 1,
  createdAt: 0,
});

describe("upload manifest transforms", () => {
  it("addUpload appends a new entry", () => {
    const next = addUpload([entry("a")], entry("b"));
    expect(next.map((e) => e.id)).toEqual(["a", "b"]);
  });

  it("addUpload replaces an entry with the same id", () => {
    const updated = { ...entry("a"), label: "renamed.png" };
    const next = addUpload([entry("a")], updated);
    expect(next).toHaveLength(1);
    expect(next[0].label).toBe("renamed.png");
  });

  it("removeUpload drops the matching id", () => {
    const next = removeUpload([entry("a"), entry("b")], "a");
    expect(next.map((e) => e.id)).toEqual(["b"]);
  });

  it("associates a dark texture with its base upload", () => {
    const next = setDarkUpload([entry("a")], "a", {
      id: "a-dark",
      label: "a-dark.png",
      kind: "image",
    });

    expect(next[0]?.dark).toEqual({
      id: "a-dark",
      label: "a-dark.png",
      kind: "image",
    });
  });

  it("transforms do not mutate the input array", () => {
    const input = [entry("a")];
    addUpload(input, entry("b"));
    removeUpload(input, "a");
    expect(input.map((e) => e.id)).toEqual(["a"]);
  });
});
