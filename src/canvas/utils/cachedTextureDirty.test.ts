import { describe, expect, it } from "vitest";
import {
  classifyCachedTextureDirty,
  markerVisualContentKey,
  type CachedTextureLayoutSnapshot,
} from "./cachedTextureDirty";

describe("classifyCachedTextureDirty", () => {
  const layout = (x: number, y: number, zIndex: number): CachedTextureLayoutSnapshot => ({ x, y, zIndex });

  it("returns content when the content key changes", () => {
    expect(
      classifyCachedTextureDirty({
        priorLayout: layout(0, 0, 10),
        priorContentKey: "a",
        layout: layout(0, 0, 10),
        contentKey: "b",
      }),
    ).toBe("content");
  });

  it("returns layout when only position or z-index changes", () => {
    expect(
      classifyCachedTextureDirty({
        priorLayout: layout(0, 0, 10),
        priorContentKey: "k",
        layout: layout(1, 0, 10),
        contentKey: "k",
      }),
    ).toBe("layout");

    expect(
      classifyCachedTextureDirty({
        priorLayout: layout(0, 0, 10),
        priorContentKey: "k",
        layout: layout(0, 0, 11),
        contentKey: "k",
      }),
    ).toBe("layout");
  });

  it("returns none when layout and content match prior", () => {
    expect(
      classifyCachedTextureDirty({
        priorLayout: layout(3, 4, 9),
        priorContentKey: "k",
        layout: layout(3, 4, 9),
        contentKey: "k",
      }),
    ).toBe("none");
  });

  it("treats missing prior layout as layout work when content matches", () => {
    expect(
      classifyCachedTextureDirty({
        priorLayout: undefined,
        priorContentKey: "k",
        layout: layout(0, 0, 1),
        contentKey: "k",
      }),
    ).toBe("layout");
  });
});

describe("markerVisualContentKey", () => {
  it("separates props and stroke color", () => {
    expect(markerVisualContentKey({ theme: "a" }, "#fff")).not.toBe(markerVisualContentKey({ theme: "a" }, "#000"));
    expect(markerVisualContentKey({ theme: "a" }, "#fff")).not.toBe(markerVisualContentKey({ theme: "b" }, "#fff"));
  });
});
