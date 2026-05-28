import { describe, expect, it } from "vitest";
import { DEFAULT_PLAYGROUND_TEXTURE_ID, PLAYGROUND_TEXTURES } from "./playgroundTextures";

describe("playgroundTextures", () => {
  it("defaults to example 5 and lists it first in the catalog", () => {
    expect(DEFAULT_PLAYGROUND_TEXTURE_ID).toBe("example5");
    expect(PLAYGROUND_TEXTURES[0]?.id).toBe("example5");
  });
});
