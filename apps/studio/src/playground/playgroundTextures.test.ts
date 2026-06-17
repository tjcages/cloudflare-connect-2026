import { describe, expect, it } from "vitest";
import {
  DEFAULT_PLAYGROUND_TEXTURE_ID,
  detectUploadMediaKind,
  formatTextureLoadErrorMessage,
  formatUploadRejectionMessage,
  PLAYGROUND_TEXTURES,
} from "./playgroundTextures";

describe("playgroundTextures", () => {
  it("defaults to example 5 video and lists example 10 first in the catalog", () => {
    expect(DEFAULT_PLAYGROUND_TEXTURE_ID).toBe("example5");
    expect(PLAYGROUND_TEXTURES[0]?.id).toBe("example10");
  });

  it("detects media kind from MIME type", () => {
    expect(detectUploadMediaKind(new File([], "photo.jpg", { type: "image/jpeg" }))).toBe("image");
    expect(detectUploadMediaKind(new File([], "clip.mp4", { type: "video/mp4" }))).toBe("video");
  });

  it("detects media kind from extension when MIME is empty", () => {
    expect(detectUploadMediaKind(new File([], "export.heic", { type: "" }))).toBe("image");
    expect(detectUploadMediaKind(new File([], "screen.mov", { type: "" }))).toBe("video");
    expect(detectUploadMediaKind(new File([], "clip.MP4", { type: "" }))).toBe("video");
  });

  it("rejects unknown extensions with a helpful message", () => {
    expect(detectUploadMediaKind(new File([], "notes.pdf", { type: "application/pdf" }))).toBeNull();
    expect(formatUploadRejectionMessage("notes.pdf")).toContain("notes.pdf");
    expect(formatUploadRejectionMessage("notes.pdf")).toContain("image or video");
  });

  it("explains decode and missing load failures", () => {
    expect(formatTextureLoadErrorMessage({ label: "hero", mediaKind: "video", reason: "decode" })).toContain("codec");
    expect(formatTextureLoadErrorMessage({ label: "hero", mediaKind: "image", reason: "missing" })).toContain(
      "browser storage",
    );
  });
});
