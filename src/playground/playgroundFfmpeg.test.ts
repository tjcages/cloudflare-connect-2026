import { describe, expect, it } from "vitest";
import { buildPlaygroundFfmpegCdnCoreUrls, FFMPEG_CORE_VERSION } from "./playgroundFfmpeg";

describe("buildPlaygroundFfmpegCdnCoreUrls", () => {
  it("points at the pinned @ffmpeg/core release on jsDelivr", () => {
    expect(buildPlaygroundFfmpegCdnCoreUrls()).toEqual({
      coreURL: `https://cdn.jsdelivr.net/npm/@ffmpeg/core@${FFMPEG_CORE_VERSION}/dist/esm/ffmpeg-core.js`,
      wasmURL: `https://cdn.jsdelivr.net/npm/@ffmpeg/core@${FFMPEG_CORE_VERSION}/dist/esm/ffmpeg-core.wasm`,
    });
  });
});
