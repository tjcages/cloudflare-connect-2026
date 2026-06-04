import { afterEach, describe, expect, it } from "vitest";
import { defaultConfigForTexture, PLAYGROUND_LS_KEY, resolveInitialTextureId } from "./playgroundPersistence";
import { DEFAULT_PLAYGROUND_UPLOAD_DUOTONE } from "./playgroundTextures";

describe("playgroundPersistence envelope migration", () => {
  afterEach(() => {
    localStorage.removeItem(PLAYGROUND_LS_KEY);
  });

  it("reads lastVideoId when lastTextureId is absent", () => {
    localStorage.setItem(
      PLAYGROUND_LS_KEY,
      JSON.stringify({
        version: 1,
        lastVideoId: "example3",
        uploads: [],
        configs: {},
      }),
    );
    expect(resolveInitialTextureId()).toBe("example3");
  });

  it("uses upload duotone defaults for new uploads without persisted config", () => {
    const uploadId = "upload:test-upload" as const;
    const config = defaultConfigForTexture(uploadId);
    expect(config.duotoneEnabled).toBe(true);
    expect(config.ignoreColorHex).toBe(DEFAULT_PLAYGROUND_UPLOAD_DUOTONE.ignoreColorHex);
    expect(config.ignoreTolerance).toBe(DEFAULT_PLAYGROUND_UPLOAD_DUOTONE.ignoreTolerance);
    expect(config.gamma).toBe(DEFAULT_PLAYGROUND_UPLOAD_DUOTONE.gamma);
    expect(config.threshold).toBe(DEFAULT_PLAYGROUND_UPLOAD_DUOTONE.threshold);
    expect(config.density).toBe(DEFAULT_PLAYGROUND_UPLOAD_DUOTONE.density);
  });
});
