import { describe, expect, it } from "vitest";
import { FFMPEG_CORE_VERSION, buildFfmpegCdnCoreUrls } from "./ffmpeg";

describe("ffmpeg core urls", () => {
  it("builds jsDelivr URLs pinned to FFMPEG_CORE_VERSION", () => {
    const { coreURL, wasmURL } = buildFfmpegCdnCoreUrls();
    expect(coreURL).toContain(`@ffmpeg/core@${FFMPEG_CORE_VERSION}`);
    expect(wasmURL).toContain(`@ffmpeg/core@${FFMPEG_CORE_VERSION}`);
    expect(coreURL).toMatch(/ffmpeg-core\.js$/);
    expect(wasmURL).toMatch(/ffmpeg-core\.wasm$/);
  });
});
