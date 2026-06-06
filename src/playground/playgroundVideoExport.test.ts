import { afterEach, describe, expect, it, vi } from "vitest";
import { resolveTranscodeProgressPercent } from "./playgroundFfmpeg";
import {
  canUseFastVideoExport,
  exportPlaygroundVideo,
  formatExportEtaRemaining,
  formatTranscodeEta,
  formatVideoExportStatusLabel,
  pickMediaRecorderMimeType,
  pickMediaRecorderProfile,
  PLAYGROUND_IMAGE_EXPORT_DURATION_SEC,
  PLAYGROUND_VIDEO_EXPORT_FPS,
  PLAYGROUND_VIDEO_EXPORT_MAX_DURATION_SEC,
  resolveExportDuration,
  resolveExportFrameCount,
  shouldConfirmLongExport,
} from "./playgroundVideoExport";

describe("resolveExportDuration", () => {
  it("returns fixed image duration", () => {
    expect(resolveExportDuration("image", 0)).toBe(PLAYGROUND_IMAGE_EXPORT_DURATION_SEC);
  });

  it("returns capped video duration", () => {
    expect(resolveExportDuration("video", 45)).toBe(45);
    expect(resolveExportDuration("video", 200)).toBe(PLAYGROUND_VIDEO_EXPORT_MAX_DURATION_SEC);
  });

  it("returns zero for invalid video duration", () => {
    expect(resolveExportDuration("video", 0)).toBe(0);
    expect(resolveExportDuration("video", Number.NaN)).toBe(0);
  });
});

describe("shouldConfirmLongExport", () => {
  it("requires confirmation above threshold", () => {
    expect(shouldConfirmLongExport(30)).toBe(false);
    expect(shouldConfirmLongExport(61)).toBe(true);
  });
});

describe("formatExportEtaRemaining", () => {
  it("formats rounded remaining seconds", () => {
    expect(formatExportEtaRemaining(4500)).toBe("~0:05");
    expect(formatExportEtaRemaining(0)).toBeNull();
  });
});

describe("formatTranscodeEta", () => {
  it("estimates remaining transcode time from elapsed progress", () => {
    expect(formatTranscodeEta(30_000, 50)).toBe("~0:30");
    expect(formatTranscodeEta(0, 50)).toBeNull();
  });
});

describe("formatVideoExportStatusLabel", () => {
  it("shows recording and converting progress with eta", () => {
    expect(formatVideoExportStatusLabel("recording", { elapsedMs: 1500, totalMs: 5000 }, null)).toBe(
      "Recording 0:01 / 0:05",
    );
    expect(formatVideoExportStatusLabel("transcoding", { elapsedMs: 0, totalMs: 0 }, 42, 25_000)).toBe(
      "Converting 42% (~0:35)",
    );
    expect(formatVideoExportStatusLabel("loading-encoder", { elapsedMs: 0, totalMs: 0 }, null)).toBe(
      "Loading encoder…",
    );
  });
});

describe("resolveTranscodeProgressPercent", () => {
  it("prefers duration-based progress when source duration is known", () => {
    expect(resolveTranscodeProgressPercent(0, 2_500_000, 5000)).toBe(50);
  });

  it("falls back to ffmpeg progress ratio", () => {
    expect(resolveTranscodeProgressPercent(0.37, 0, undefined)).toBe(37);
  });
});

describe("resolveExportFrameCount", () => {
  it("ceil duration times export fps", () => {
    expect(resolveExportFrameCount(5)).toBe(5 * PLAYGROUND_VIDEO_EXPORT_FPS);
  });
});

describe("pickMediaRecorderProfile", () => {
  it("prefers native mp4 when supported", () => {
    const supported = new Set(["video/mp4", "video/webm;codecs=vp8"]);
    const profile = pickMediaRecorderProfile((candidate) => supported.has(candidate));
    expect(profile).toEqual({ mimeType: "video/mp4", skipTranscode: true, extension: "mp4" });
  });

  it("falls back to vp8 webm", () => {
    const supported = new Set(["video/webm;codecs=vp8", "video/webm"]);
    const profile = pickMediaRecorderProfile((candidate) => supported.has(candidate));
    expect(profile).toEqual({ mimeType: "video/webm;codecs=vp8", skipTranscode: false, extension: "webm" });
    expect(pickMediaRecorderMimeType((candidate) => supported.has(candidate))).toBe("video/webm;codecs=vp8");
  });

  it("returns null when nothing is supported", () => {
    expect(pickMediaRecorderProfile(() => false)).toBeNull();
  });
});

describe("canUseFastVideoExport", () => {
  it("requires video source and requestFrame", () => {
    const canvas = {
      captureStream: vi.fn(() => ({
        getVideoTracks: () => [{ requestFrame: vi.fn() }],
        getTracks: () => [{ stop: vi.fn() }],
      })),
    } as unknown as HTMLCanvasElement;

    expect(canUseFastVideoExport(canvas, "video")).toBe(true);
    expect(canUseFastVideoExport(canvas, "image")).toBe(false);
  });
});

describe("exportPlaygroundVideo", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("records, transcodes, and downloads mp4", async () => {
    let mockNow = 0;
    vi.spyOn(performance, "now").mockImplementation(() => mockNow);
    vi.spyOn(globalThis, "requestAnimationFrame").mockImplementation((callback: FrameRequestCallback) => {
      mockNow += 1000;
      queueMicrotask(() => callback(mockNow));
      return 1;
    });

    const chunks: BlobPart[] = [];
    class MockMediaRecorder {
      static isTypeSupported(mimeType: string) {
        return mimeType.startsWith("video/webm");
      }

      state: "inactive" | "recording" = "inactive";
      private listeners = new Map<string, Array<() => void>>();

      constructor(_stream: MediaStream, _options: { mimeType: string }) {}

      addEventListener(type: string, listener: () => void) {
        const bucket = this.listeners.get(type) ?? [];
        bucket.push(listener);
        this.listeners.set(type, bucket);
      }

      start() {
        this.state = "recording";
      }

      stop() {
        this.state = "inactive";
        chunks.push(new Uint8Array([1, 2, 3]));
        for (const listener of this.listeners.get("stop") ?? []) {
          listener();
        }
      }
    }

    vi.stubGlobal("MediaRecorder", MockMediaRecorder);

    const canvas = {
      width: 2,
      height: 2,
      captureStream: vi.fn(() => ({
        getTracks: () => [{ stop: vi.fn() }],
      })),
    } as unknown as HTMLCanvasElement;
    const createCompositor = vi.fn(async () => ({
      canvas,
      compositeFrame: vi.fn(),
    }));

    const transcode = vi.fn(async (_webm: Blob, options) => {
      options.onStage?.("loading-encoder");
      options.onStage?.("transcoding");
      options.onProgress?.(25);
      options.onProgress?.(100);
      return new Blob(["mp4"], { type: "video/mp4" });
    });
    const phases: string[] = [];
    const transcodePercents: number[] = [];

    const blob = await exportPlaygroundVideo({
      canvas,
      sourceKind: "image",
      download: false,
      transcode,
      createCompositor,
      backgroundColor: 0xffffff,
      onPhase: (phase) => phases.push(phase),
      onTranscodeProgress: (percent) => transcodePercents.push(percent),
    });

    expect(blob.type).toBe("video/mp4");
    expect(createCompositor).toHaveBeenCalledWith(canvas, { backgroundCss: undefined, backgroundColor: 0xffffff });
    expect(transcode).toHaveBeenCalledTimes(1);
    expect(phases).toEqual(["recording", "loading-encoder", "transcoding", "done"]);
    expect(transcodePercents).toEqual([25, 100]);
  });

  it("throws when webm recording is unsupported", async () => {
    vi.stubGlobal("MediaRecorder", undefined);

    const canvas = {
      captureStream: vi.fn(),
    } as unknown as HTMLCanvasElement;

    await expect(
      exportPlaygroundVideo({
        canvas,
        sourceKind: "image",
        download: false,
        transcode: vi.fn(async () => new Blob(["mp4"], { type: "video/mp4" })),
      }),
    ).rejects.toThrow("Video recording is not supported");
  });

  it("skips transcode when the browser records mp4 directly", async () => {
    let mockNow = 0;
    vi.spyOn(performance, "now").mockImplementation(() => mockNow);
    vi.spyOn(globalThis, "requestAnimationFrame").mockImplementation((callback: FrameRequestCallback) => {
      mockNow += 1000;
      queueMicrotask(() => callback(mockNow));
      return 1;
    });

    class MockMediaRecorder {
      static isTypeSupported(mimeType: string) {
        return mimeType === "video/mp4";
      }

      private listeners = new Map<string, Array<() => void>>();

      addEventListener(type: string, listener: () => void) {
        const bucket = this.listeners.get(type) ?? [];
        bucket.push(listener);
        this.listeners.set(type, bucket);
      }

      start() {}

      stop() {
        for (const listener of this.listeners.get("stop") ?? []) {
          listener();
        }
      }
    }

    vi.stubGlobal("MediaRecorder", MockMediaRecorder);

    const canvas = {
      width: 2,
      height: 2,
      captureStream: vi.fn(() => ({
        getTracks: () => [{ stop: vi.fn() }],
      })),
    } as unknown as HTMLCanvasElement;
    const createCompositor = vi.fn(async () => ({
      canvas,
      compositeFrame: vi.fn(),
    }));

    const transcode = vi.fn();
    const phases: string[] = [];

    const blob = await exportPlaygroundVideo({
      canvas,
      sourceKind: "image",
      download: false,
      transcode,
      createCompositor,
      onPhase: (phase) => phases.push(phase),
    });

    expect(blob.type).toBe("video/mp4");
    expect(transcode).not.toHaveBeenCalled();
    expect(phases).toEqual(["recording", "done"]);
  });

  it("throws when export duration is invalid", async () => {
    const canvas = {
      captureStream: vi.fn(),
    } as unknown as HTMLCanvasElement;

    await expect(
      exportPlaygroundVideo({
        canvas,
        sourceKind: "video",
        video: { duration: 0 } as HTMLVideoElement,
        download: false,
        transcode: vi.fn(async () => new Blob(["mp4"], { type: "video/mp4" })),
      }),
    ).rejects.toThrow("Invalid export duration");
  });
});
