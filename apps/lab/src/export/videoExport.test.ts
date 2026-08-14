import { afterEach, describe, expect, it, vi } from "vitest";
import { resolveTranscodeProgressPercent } from "./ffmpeg";
import {
  canUseFastVideoExport,
  exportLabVideo,
  formatExportEtaRemaining,
  formatTranscodeEta,
  formatVideoExportStatusLabel,
  LAB_IMAGE_EXPORT_DURATION_SEC,
  LAB_VIDEO_EXPORT_BITRATE,
  LAB_VIDEO_EXPORT_FPS,
  LAB_VIDEO_EXPORT_MAX_DURATION_SEC,
  pickMediaRecorderMimeType,
  pickMediaRecorderProfile,
  resolveExportDuration,
  resolveExportFrameCount,
  resolveRealtimeVideoExportProfile,
  resolveRequestedExportRange,
  shouldConfirmLongExport,
  shouldCompositeVideoFrame,
} from "./videoExport";

describe("resolveExportDuration", () => {
  it("returns fixed image duration", () => {
    expect(resolveExportDuration("image", 0)).toBe(LAB_IMAGE_EXPORT_DURATION_SEC);
  });

  it("returns capped video duration", () => {
    expect(resolveExportDuration("video", 45)).toBe(45);
    expect(resolveExportDuration("video", 200)).toBe(LAB_VIDEO_EXPORT_MAX_DURATION_SEC);
  });

  it("returns zero for invalid video duration", () => {
    expect(resolveExportDuration("video", 0)).toBe(0);
    expect(resolveExportDuration("video", Number.NaN)).toBe(0);
  });
});

describe("resolveRequestedExportRange", () => {
  it("resolves custom image duration", () => {
    expect(resolveRequestedExportRange("image", 0, 4, 8)).toEqual({ startTimeSec: 0, durationSec: 8 });
  });

  it("clamps custom video start and duration to source bounds", () => {
    expect(resolveRequestedExportRange("video", 10, 7, 8)).toEqual({ startTimeSec: 7, durationSec: 3 });
  });
});

describe("export quality defaults", () => {
  it("targets high frame rate and bitrate for graphic exports", () => {
    expect(LAB_VIDEO_EXPORT_FPS).toBeGreaterThanOrEqual(60);
    expect(LAB_VIDEO_EXPORT_BITRATE).toBeGreaterThanOrEqual(50_000_000);
  });

  it("adapts real-time recording load to the canvas resolution", () => {
    expect(resolveRealtimeVideoExportProfile(1920, 1080)).toEqual({
      fps: 60,
      videoBitsPerSecond: 19_906_560,
    });
    expect(resolveRealtimeVideoExportProfile(3840, 2160)).toEqual({
      fps: 30,
      videoBitsPerSecond: 39_813_120,
    });
  });

  it("only composites when the recorder needs another frame", () => {
    expect(shouldCompositeVideoFrame(16, 0, 30)).toBe(false);
    expect(shouldCompositeVideoFrame(34, 0, 30)).toBe(true);
    expect(shouldCompositeVideoFrame(17, 0, 60)).toBe(true);
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

  it("shows an open-ended recording as a stop action with elapsed time", () => {
    expect(formatVideoExportStatusLabel("recording", { elapsedMs: 65_000, totalMs: 0 }, null)).toBe(
      "Stop Recording · 1:05",
    );
    expect(formatVideoExportStatusLabel("finishing", { elapsedMs: 65_000, totalMs: 0 }, null)).toBe(
      "Finishing recording…",
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
    expect(resolveExportFrameCount(5)).toBe(5 * LAB_VIDEO_EXPORT_FPS);
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

describe("exportLabVideo", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("records, transcodes, and downloads mp4", async () => {
    let mockNow = 0;
    const cancelled = new Set<number>();
    let nextRafId = 0;
    vi.spyOn(performance, "now").mockImplementation(() => mockNow);
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
      mockNow += 1000;
      const id = ++nextRafId;
      queueMicrotask(() => {
        if (!cancelled.has(id)) callback(mockNow);
      });
      return id;
    });
    vi.stubGlobal("cancelAnimationFrame", (id: number) => cancelled.add(id));

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
    const overlayCanvas = { width: 2, height: 2 } as HTMLCanvasElement;
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

    const blob = await exportLabVideo({
      canvas,
      sourceKind: "image",
      download: false,
      transcode,
      createCompositor,
      backgroundColor: 0xffffff,
      overlayCanvases: [overlayCanvas],
      onPhase: (phase) => phases.push(phase),
      onTranscodeProgress: (percent) => transcodePercents.push(percent),
    });

    expect(blob.type).toBe("video/mp4");
    expect(createCompositor).toHaveBeenCalledWith(canvas, {
      backgroundColor: 0xffffff,
      overlayCanvases: [overlayCanvas],
    });
    expect(transcode).toHaveBeenCalledTimes(1);
    expect(phases).toEqual(["recording", "loading-encoder", "transcoding", "done"]);
    expect(transcodePercents).toEqual([25, 100]);
  });

  it("records until the stop signal and then completes the export", async () => {
    let mockNow = 0;
    let nextRafId = 0;
    const cancelled = new Set<number>();
    vi.spyOn(performance, "now").mockImplementation(() => mockNow);
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
      mockNow += 1000;
      const id = ++nextRafId;
      queueMicrotask(() => {
        if (!cancelled.has(id)) callback(mockNow);
      });
      return id;
    });
    vi.stubGlobal("cancelAnimationFrame", (id: number) => cancelled.add(id));

    let recorderOptions: { mimeType: string; videoBitsPerSecond?: number } | undefined;
    class MockMediaRecorder {
      static isTypeSupported(mimeType: string) {
        return mimeType === "video/mp4";
      }

      state: "inactive" | "recording" = "inactive";
      private listeners = new Map<string, Array<() => void>>();

      constructor(_stream: MediaStream, options: { mimeType: string; videoBitsPerSecond?: number }) {
        recorderOptions = options;
      }

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
        for (const listener of this.listeners.get("stop") ?? []) listener();
      }
    }

    vi.stubGlobal("MediaRecorder", MockMediaRecorder);
    const canvas = {
      width: 2,
      height: 2,
      captureStream: vi.fn(() => ({ getTracks: () => [{ stop: vi.fn() }] })),
    } as unknown as HTMLCanvasElement;
    const createCompositor = vi.fn(async () => ({ canvas, compositeFrame: vi.fn() }));
    const stopController = new AbortController();
    const progress: Array<[number, number]> = [];
    const phases: string[] = [];

    const blob = await exportLabVideo({
      canvas,
      sourceKind: "image",
      stopSignal: stopController.signal,
      fps: 30,
      videoBitsPerSecond: 24_000_000,
      download: false,
      createCompositor,
      onPhase: (phase) => phases.push(phase),
      onProgress: (elapsed, total) => {
        progress.push([elapsed, total]);
        if (elapsed >= 2000) stopController.abort();
      },
    });

    expect(blob.type).toBe("video/mp4");
    expect(canvas.captureStream).toHaveBeenCalledWith(30);
    expect(recorderOptions?.videoBitsPerSecond).toBe(24_000_000);
    expect(progress.at(-1)?.[1]).toBe(0);
    expect(phases).toEqual(["recording", "done"]);
  });

  it("throws when webm recording is unsupported", async () => {
    vi.stubGlobal("MediaRecorder", undefined);

    const canvas = {
      captureStream: vi.fn(),
    } as unknown as HTMLCanvasElement;

    await expect(
      exportLabVideo({
        canvas,
        sourceKind: "image",
        download: false,
        transcode: vi.fn(async () => new Blob(["mp4"], { type: "video/mp4" })),
      }),
    ).rejects.toThrow("Video recording is not supported");
  });

  it("skips transcode when the browser records mp4 directly", async () => {
    let mockNow = 0;
    const cancelled = new Set<number>();
    let nextRafId = 0;
    vi.spyOn(performance, "now").mockImplementation(() => mockNow);
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
      mockNow += 1000;
      const id = ++nextRafId;
      queueMicrotask(() => {
        if (!cancelled.has(id)) callback(mockNow);
      });
      return id;
    });
    vi.stubGlobal("cancelAnimationFrame", (id: number) => cancelled.add(id));

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

    const blob = await exportLabVideo({
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
      exportLabVideo({
        canvas,
        sourceKind: "video",
        video: { duration: 0 } as HTMLVideoElement,
        download: false,
        transcode: vi.fn(async () => new Blob(["mp4"], { type: "video/mp4" })),
      }),
    ).rejects.toThrow("Invalid export duration");
  });
});
