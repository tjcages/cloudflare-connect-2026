import { afterEach, describe, expect, it } from "vitest";
import {
  defaultConfigForTexture,
  parsePlaygroundStateInput,
  PLAYGROUND_LS_KEY,
  resolveInitialTextureId,
  serializePlaygroundState,
} from "./playgroundPersistence";
import { DEFAULT_STRIPES } from "./stripeColors";

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

  it("uses default stripes for new uploads without persisted config", () => {
    const uploadId = "upload:test-upload" as const;
    const config = defaultConfigForTexture(uploadId);
    expect(config.duotoneEnabled).toBe(true);
    expect(config.stripes.map((s) => s.hex)).toEqual(DEFAULT_STRIPES.map((s) => s.hex));
  });

  it("migrates legacy v1/v2 distance configs to the default stripe palette", () => {
    const config = parsePlaygroundStateInput(
      JSON.stringify({ v: 1, d: true, c: "#ffffff", t: 0.12, g: 1.5, th: 0.8, de: 0.9, bp: [1, 2, 3, 4] }),
    );
    expect(config.duotoneEnabled).toBe(true);
    expect(config.stripes.map((s) => s.hex)).toEqual(DEFAULT_STRIPES.map((s) => s.hex));
    expect("ignoreTolerance" in config).toBe(false);
    expect("bandBreakpoints" in config).toBe(false);
  });

  it("round-trips v3 stripes through serialize/parse", () => {
    const text = serializePlaygroundState({
      duotoneEnabled: true,
      stripes: [
        { id: "a", hex: "#112233", p3Css: "color(display-p3 0.0667 0.1333 0.2)", startFrom: 0.2, width: 3 },
        { id: "b", hex: "#445566", p3Css: "color(display-p3 0.2667 0.3333 0.4)", startFrom: 0.7, width: 6 },
      ],
    });
    const parsed = parsePlaygroundStateInput(text);
    expect(parsed.stripes).toHaveLength(2);
    expect(parsed.stripes[0]!.hex).toBe("#112233");
    expect(parsed.stripes[0]!.startFrom).toBe(0.2);
    expect(parsed.stripes[1]!.width).toBe(6);
  });
});
