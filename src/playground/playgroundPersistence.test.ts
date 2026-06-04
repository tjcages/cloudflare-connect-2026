import { afterEach, describe, expect, it } from "vitest";
import {
  defaultConfigForTexture,
  parsePlaygroundStateInput,
  PLAYGROUND_LS_KEY,
  resolveInitialTextureId,
} from "./playgroundPersistence";
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
    expect(config.ignoreTolerance).toBe(DEFAULT_PLAYGROUND_UPLOAD_DUOTONE.ignoreTolerance);
    expect(config.gamma).toBe(DEFAULT_PLAYGROUND_UPLOAD_DUOTONE.gamma);
    expect(config.threshold).toBe(DEFAULT_PLAYGROUND_UPLOAD_DUOTONE.threshold);
    expect(config.density).toBe(DEFAULT_PLAYGROUND_UPLOAD_DUOTONE.density);
  });

  it("ignores legacy wire ignore color field c", () => {
    const config = parsePlaygroundStateInput(
      JSON.stringify({ v: 1, d: true, c: "#ffffff", t: 0.12, g: 1.5, th: 0.8, de: 0.9 }),
    );
    expect(config.ignoreTolerance).toBe(0.12);
    expect(config.gamma).toBe(1.5);
    expect(config.threshold).toBe(0.8);
    expect(config.density).toBe(0.9);
    expect("ignoreColorHex" in config).toBe(false);
  });
});
