import { describe, expect, it } from "vitest";
import { DEFAULT_PLAYGROUND_TEXTURE_ID, PLAYGROUND_TEXTURES } from "./playgroundTextures";

describe("playgroundTextures", () => {
  it("defaults to example 5 video and lists example 10 first in the catalog", () => {
    expect(DEFAULT_PLAYGROUND_TEXTURE_ID).toBe("example5");
    expect(PLAYGROUND_TEXTURES[0]?.id).toBe("example10");
  });
});
