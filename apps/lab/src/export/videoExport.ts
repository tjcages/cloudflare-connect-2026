import type { TranscodeWebmToMp4Options } from "./ffmpeg";
import {
  createLabExportCompositor,
  type LabVideoBackgroundFrame,
  type LabVideoCompositorOptions,
  type LabVideoLayer,
} from "./videoCompositor";

export const LAB_IMAGE_EXPORT_DURATION_SEC = 5;
export const LAB_VIDEO_EXPORT_MAX_DURATION_SEC = 120;
export const LAB_VIDEO_EXPORT_CONFIRM_THRESHOLD_SEC = 60;
/** 60fps for max motion fidelity on stripe / Twizzler exports. */
export const LAB_VIDEO_EXPORT_FPS = 60;
/**
 * High MediaRecorder ceiling for retina graphic output.
 * Browsers may clamp; still request the top of the practical range.
 */
export const LAB_VIDEO_EXPORT_BITRATE = 80_000_000;
export const LAB_REALTIME_VIDEO_EXPORT_MAX_BITRATE = 50_000_000;
export const LAB_REALTIME_VIDEO_EXPORT_HIGH_RESOLUTION_PIXELS = 2_500_000;

const MP4_MIME_CANDIDATES = ["video/mp4;codecs=avc1", "video/mp4"] as const;
const WEBM_MIME_CANDIDATES = ["video/webm;codecs=vp8", "video/webm;codecs=vp9", "video/webm"] as const;

export type LabExportSourceKind = "video" | "image";

export type LabVideoExportPhase =
  | "idle"
  | "recording"
  | "finishing"
  | "loading-encoder"
  | "transcoding"
  | "done"
  | "failed";

export type MediaRecorderProfile = {
  mimeType: string;
  skipTranscode: boolean;
  extension: "mp4" | "webm";
};

export type RealtimeVideoExportProfile = { fps: 30 | 60; videoBitsPerSecond: number };

/** Keep smaller canvases at 60fps; favor stable 30fps once retina output exceeds ~1440p. */
export function resolveRealtimeVideoExportProfile(width: number, height: number): RealtimeVideoExportProfile {
  const pixels = Math.max(1, Math.round(width)) * Math.max(1, Math.round(height));
  const fps = pixels > LAB_REALTIME_VIDEO_EXPORT_HIGH_RESOLUTION_PIXELS ? 30 : 60;
  return {
    fps,
    videoBitsPerSecond: Math.round(
      Math.min(LAB_REALTIME_VIDEO_EXPORT_MAX_BITRATE, Math.max(12_000_000, pixels * fps * 0.16)),
    ),
  };
}

export function shouldCompositeVideoFrame(nowMs: number, lastFrameMs: number, fps: number): boolean {
  return nowMs - lastFrameMs >= 1000 / Math.max(1, fps) - 0.5;
}

type CanvasCaptureTrack = MediaStreamTrack & { requestFrame?: () => void };

export function formatExportEtaRemaining(remainingMs: number): string | null {
  if (!Number.isFinite(remainingMs) || remainingMs <= 0) {
    return null;
  }
  return `~${formatExportTime(Math.ceil(remainingMs / 1000))}`;
}

export function formatTranscodeEta(elapsedMs: number, percent: number): string | null {
  if (!Number.isFinite(elapsedMs) || elapsedMs <= 0 || percent <= 0 || percent >= 100) {
    return null;
  }
  return formatExportEtaRemaining((elapsedMs * (100 - percent)) / percent);
}

function appendEta(label: string, eta: string | null): string {
  return eta ? `${label} (${eta})` : label;
}

export function formatVideoExportStatusLabel(
  phase: LabVideoExportPhase,
  recording: { elapsedMs: number; totalMs: number },
  transcodePercent: number | null,
  transcodeElapsedMs = 0,
): string {
  if (phase === "recording") {
    const elapsedSec = recording.elapsedMs / 1000;
    if (recording.totalMs <= 0) {
      return `Stop Recording · ${formatExportTime(elapsedSec)}`;
    }
    const totalSec = recording.totalMs / 1000;
    return `Recording ${formatExportTime(elapsedSec)} / ${formatExportTime(totalSec)}`;
  }
  if (phase === "finishing") {
    return "Finishing recording…";
  }
  if (phase === "loading-encoder") {
    return "Loading encoder…";
  }
  if (phase === "transcoding") {
    const label =
      transcodePercent === null || transcodePercent <= 0 ? "Converting…" : `Converting ${transcodePercent}%`;
    const eta = transcodePercent === null ? null : formatTranscodeEta(transcodeElapsedMs, transcodePercent);
    return appendEta(label, eta);
  }
  if (phase === "done") {
    return "Exported";
  }
  if (phase === "failed") {
    return "Export failed";
  }
  return "Export Video";
}

function formatExportTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) {
    return "0:00";
  }
  const whole = Math.floor(seconds);
  const mins = Math.floor(whole / 60);
  const secs = whole % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

export function resolveExportDuration(kind: LabExportSourceKind, videoDuration: number): number {
  return resolveRequestedExportRange(kind, videoDuration).durationSec;
}

export function resolveRequestedExportRange(
  kind: LabExportSourceKind,
  videoDuration: number,
  requestedStartSec = 0,
  requestedDurationSec?: number,
): { startTimeSec: number; durationSec: number } {
  const requestedDuration =
    typeof requestedDurationSec === "number" && Number.isFinite(requestedDurationSec)
      ? requestedDurationSec
      : undefined;
  if (kind === "image") {
    return {
      startTimeSec: 0,
      durationSec: Math.max(
        0.1,
        Math.min(requestedDuration ?? LAB_IMAGE_EXPORT_DURATION_SEC, LAB_VIDEO_EXPORT_MAX_DURATION_SEC),
      ),
    };
  }
  if (!Number.isFinite(videoDuration) || videoDuration <= 0) {
    return { startTimeSec: 0, durationSec: 0 };
  }
  const startTimeSec = Math.max(0, Math.min(requestedStartSec, Math.max(0, videoDuration - 0.001)));
  const maxDuration = Math.max(0, videoDuration - startTimeSec);
  return {
    startTimeSec,
    durationSec: Math.max(
      0,
      Math.min(requestedDuration ?? maxDuration, maxDuration, LAB_VIDEO_EXPORT_MAX_DURATION_SEC),
    ),
  };
}

export function resolveExportFrameCount(durationSec: number): number {
  return Math.max(1, Math.ceil(durationSec * LAB_VIDEO_EXPORT_FPS));
}

export function shouldConfirmLongExport(durationSec: number): boolean {
  return durationSec > LAB_VIDEO_EXPORT_CONFIRM_THRESHOLD_SEC;
}

export function pickMediaRecorderProfile(
  isTypeSupported: (mimeType: string) => boolean = defaultIsTypeSupported,
): MediaRecorderProfile | null {
  for (const mimeType of MP4_MIME_CANDIDATES) {
    if (isTypeSupported(mimeType)) {
      return { mimeType, skipTranscode: true, extension: "mp4" };
    }
  }
  for (const mimeType of WEBM_MIME_CANDIDATES) {
    if (isTypeSupported(mimeType)) {
      return { mimeType, skipTranscode: false, extension: "webm" };
    }
  }
  return null;
}

/** @deprecated Use {@link pickMediaRecorderProfile}. */
export function pickMediaRecorderMimeType(
  isTypeSupported: (mimeType: string) => boolean = defaultIsTypeSupported,
): string | null {
  return pickMediaRecorderProfile(isTypeSupported)?.mimeType ?? null;
}

function defaultIsTypeSupported(mimeType: string): boolean {
  return typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(mimeType);
}

export function canUseFastVideoExport(canvas: HTMLCanvasElement, sourceKind: LabExportSourceKind): boolean {
  if (sourceKind !== "video" || !canvas.captureStream) {
    return false;
  }
  const stream = canvas.captureStream(0);
  const track = stream.getVideoTracks()[0] as CanvasCaptureTrack | undefined;
  const supported = typeof track?.requestFrame === "function";
  for (const mediaTrack of stream.getTracks()) {
    mediaTrack.stop();
  }
  return supported;
}

export function downloadLabVideo(blob: Blob, filename = "stripes-video.mp4"): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function waitNextPaint(): Promise<void> {
  return new Promise((resolve) => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => resolve());
    });
  });
}

function waitVideoSeek(video: HTMLVideoElement, timeSec: number): Promise<void> {
  if (Math.abs(video.currentTime - timeSec) < 0.001) {
    return Promise.resolve();
  }
  return new Promise((resolve) => {
    const onSeeked = () => {
      video.removeEventListener("seeked", onSeeked);
      resolve();
    };
    video.addEventListener("seeked", onSeeked);
    video.currentTime = timeSec;
  });
}

type RecordCanvasOptions = {
  fps: number;
  durationMs?: number;
  mimeType: string;
  videoBitsPerSecond?: number;
  signal?: AbortSignal;
  stopSignal?: AbortSignal;
  video?: HTMLVideoElement;
  startTimeSec?: number;
  onProgress?: (elapsedMs: number, totalMs: number) => void;
  onStart?: () => void | Promise<void>;
  compositeFrame?: () => void;
};

async function waitForRecordingEnd(options: RecordCanvasOptions): Promise<void> {
  const { durationMs, signal, stopSignal, video, onProgress } = options;
  const start = performance.now();

  await new Promise<void>((resolve) => {
    let settled = false;
    const finish = () => {
      if (settled) {
        return;
      }
      settled = true;
      video?.removeEventListener("ended", finish);
      signal?.removeEventListener("abort", finish);
      stopSignal?.removeEventListener("abort", finish);
      resolve();
    };

    video?.addEventListener("ended", finish);
    signal?.addEventListener("abort", finish);
    stopSignal?.addEventListener("abort", finish);

    const tick = () => {
      if (settled) {
        return;
      }
      const elapsed = performance.now() - start;
      onProgress?.(elapsed, durationMs ?? 0);
      if ((durationMs !== undefined && elapsed >= durationMs) || signal?.aborted || stopSignal?.aborted) {
        finish();
        return;
      }
      requestAnimationFrame(tick);
    };

    requestAnimationFrame(tick);
  });
}

export async function recordCanvasToWebm(canvas: HTMLCanvasElement, options: RecordCanvasOptions): Promise<Blob> {
  if (!canvas.captureStream) {
    throw new Error("Canvas captureStream is unavailable.");
  }

  const stream = canvas.captureStream(options.fps);
  const recorder = new MediaRecorder(stream, {
    mimeType: options.mimeType,
    videoBitsPerSecond: options.videoBitsPerSecond,
  });
  const chunks: BlobPart[] = [];

  recorder.addEventListener("dataavailable", (event) => {
    if (event.data.size > 0) {
      chunks.push(event.data);
    }
  });

  const blobPromise = new Promise<Blob>((resolve, reject) => {
    recorder.addEventListener("stop", () => {
      const baseMime = options.mimeType.split(";")[0] ?? "video/webm";
      resolve(new Blob(chunks, { type: baseMime }));
    });
    recorder.addEventListener("error", () => {
      reject(new Error("MediaRecorder failed."));
    });
  });

  let compositorRaf = 0;
  let lastCompositeAt = performance.now();
  const runCompositor = (now: number) => {
    if (shouldCompositeVideoFrame(now, lastCompositeAt, options.fps)) {
      options.compositeFrame?.();
      lastCompositeAt = now;
    }
    compositorRaf = requestAnimationFrame(runCompositor);
  };
  if (options.compositeFrame) {
    options.compositeFrame();
    compositorRaf = requestAnimationFrame(runCompositor);
  }

  recorder.start(100);
  try {
    await options.onStart?.();
    await waitForRecordingEnd(options);
  } finally {
    if (compositorRaf) {
      cancelAnimationFrame(compositorRaf);
    }
  }

  if (recorder.state !== "inactive") {
    recorder.stop();
  }

  for (const track of stream.getTracks()) {
    track.stop();
  }

  return blobPromise;
}

type FastRecordOptions = {
  fps: number;
  frameCount: number;
  durationMs: number;
  mimeType: string;
  videoBitsPerSecond?: number;
  signal?: AbortSignal;
  video: HTMLVideoElement;
  startTimeSec?: number;
  onProgress?: (elapsedMs: number, totalMs: number) => void;
  compositeFrame?: () => void;
};

export async function recordCanvasFast(canvas: HTMLCanvasElement, options: FastRecordOptions): Promise<Blob> {
  if (!canvas.captureStream) {
    throw new Error("Canvas captureStream is unavailable.");
  }

  const stream = canvas.captureStream(0);
  const track = stream.getVideoTracks()[0] as CanvasCaptureTrack | undefined;
  if (!track?.requestFrame) {
    for (const mediaTrack of stream.getTracks()) {
      mediaTrack.stop();
    }
    throw new Error("Canvas requestFrame is unavailable.");
  }

  const recorder = new MediaRecorder(new MediaStream([track]), {
    mimeType: options.mimeType,
    videoBitsPerSecond: options.videoBitsPerSecond,
  });
  const chunks: BlobPart[] = [];

  recorder.addEventListener("dataavailable", (event) => {
    if (event.data.size > 0) {
      chunks.push(event.data);
    }
  });

  const blobPromise = new Promise<Blob>((resolve, reject) => {
    recorder.addEventListener("stop", () => {
      const baseMime = options.mimeType.split(";")[0] ?? "video/webm";
      resolve(new Blob(chunks, { type: baseMime }));
    });
    recorder.addEventListener("error", () => {
      reject(new Error("MediaRecorder failed."));
    });
  });

  const savedRate = options.video.playbackRate;
  options.video.pause();
  options.video.playbackRate = 1;

  recorder.start();
  try {
    for (let frame = 0; frame < options.frameCount; frame += 1) {
      if (options.signal?.aborted) {
        break;
      }
      const timeSec = Math.min(
        options.video.duration || Number.POSITIVE_INFINITY,
        (options.startTimeSec ?? 0) + frame / options.fps,
      );
      await waitVideoSeek(options.video, timeSec);
      await waitNextPaint();
      options.compositeFrame?.();
      track.requestFrame?.();
      options.onProgress?.(((frame + 1) / options.frameCount) * options.durationMs, options.durationMs);
    }
  } finally {
    options.video.playbackRate = savedRate;
  }

  if (recorder.state !== "inactive") {
    recorder.stop();
  }

  for (const mediaTrack of stream.getTracks()) {
    mediaTrack.stop();
  }

  return blobPromise;
}

type SavedVideoState = {
  loop: boolean;
  currentTime: number;
  paused: boolean;
  playbackRate: number;
};

function saveVideoState(video: HTMLVideoElement): SavedVideoState {
  return {
    loop: video.loop,
    currentTime: video.currentTime,
    paused: video.paused,
    playbackRate: video.playbackRate,
  };
}

function restoreVideoState(video: HTMLVideoElement, saved: SavedVideoState): void {
  video.loop = saved.loop;
  video.currentTime = saved.currentTime;
  video.playbackRate = saved.playbackRate;
  if (!saved.paused) {
    void video.play().catch(() => {});
  } else {
    video.pause();
  }
}

export type ExportLabVideoOptions = {
  canvas: HTMLCanvasElement;
  sourceKind: LabExportSourceKind;
  video?: HTMLVideoElement;
  backgroundColor?: number;
  getBackground?: () => LabVideoBackgroundFrame;
  isSourceVisible?: () => boolean;
  underlayLayers?: readonly LabVideoLayer[];
  underlayCanvases?: readonly HTMLCanvasElement[];
  overlayLayers?: readonly LabVideoLayer[];
  overlayCanvases?: readonly HTMLCanvasElement[];
  fps?: number;
  videoBitsPerSecond?: number;
  startTimeSec?: number;
  durationSec?: number;
  signal?: AbortSignal;
  /** Ends recording and continues through conversion/download. Unlike `signal`, this is not a cancellation. */
  stopSignal?: AbortSignal;
  onPhase?: (phase: LabVideoExportPhase) => void;
  onProgress?: (elapsedMs: number, totalMs: number) => void;
  onTranscodeProgress?: (percent: number) => void;
  download?: boolean;
  filename?: string;
  transcode?: (webmBlob: Blob, options: TranscodeWebmToMp4Options) => Promise<Blob>;
  createCompositor?: (
    canvas: HTMLCanvasElement,
    options: LabVideoCompositorOptions,
  ) => Promise<{ canvas: HTMLCanvasElement; compositeFrame: () => void }>;
};

export async function exportLabVideo(options: ExportLabVideoOptions): Promise<Blob> {
  const {
    canvas,
    sourceKind,
    video,
    backgroundColor,
    getBackground,
    isSourceVisible,
    underlayLayers,
    underlayCanvases,
    overlayLayers,
    overlayCanvases,
    fps = LAB_VIDEO_EXPORT_FPS,
    videoBitsPerSecond = LAB_VIDEO_EXPORT_BITRATE,
    startTimeSec: requestedStartTimeSec = 0,
    durationSec: requestedDurationSec,
    signal,
    stopSignal,
    onPhase,
    onProgress,
    onTranscodeProgress,
    download = true,
    filename,
    transcode,
    createCompositor = createLabExportCompositor,
  } = options;

  if (signal?.aborted) {
    throw new DOMException("Export aborted.", "AbortError");
  }

  const recordsUntilStopped = stopSignal !== undefined && requestedDurationSec === undefined;
  const range = resolveRequestedExportRange(
    sourceKind,
    video?.duration ?? 0,
    requestedStartTimeSec,
    requestedDurationSec,
  );
  const { startTimeSec, durationSec } = range;
  if (!recordsUntilStopped && durationSec <= 0) {
    throw new Error("Invalid export duration.");
  }

  const profile = pickMediaRecorderProfile();
  if (!profile) {
    throw new Error("Video recording is not supported in this browser.");
  }

  let durationMs = recordsUntilStopped ? 0 : durationSec * 1000;
  const frameCount = resolveExportFrameCount(durationSec);
  const outputFilename = filename ?? `stripes-video.${profile.extension}`;
  const useFastPath = !recordsUntilStopped && canUseFastVideoExport(canvas, sourceKind) && video !== undefined;

  let savedVideoState: SavedVideoState | null = null;
  if (video) {
    savedVideoState = saveVideoState(video);
    video.loop = recordsUntilStopped;
    video.currentTime = startTimeSec;
    video.pause();
    await waitVideoSeek(video, startTimeSec);
  }

  onPhase?.("recording");

  const compositor = await createCompositor(canvas, {
    backgroundColor,
    getBackground,
    isSourceVisible,
    underlayLayers,
    underlayCanvases,
    overlayLayers,
    overlayCanvases,
  });
  const recordCanvas = compositor.canvas;
  const compositeFrame = compositor.compositeFrame;

  let recordedBlob: Blob;
  try {
    const recorderOptions = {
      fps,
      durationMs: recordsUntilStopped ? undefined : durationMs,
      mimeType: profile.mimeType,
      videoBitsPerSecond,
      signal,
      stopSignal,
      onProgress,
      compositeFrame,
    };

    if (useFastPath && video) {
      recordedBlob = await recordCanvasFast(recordCanvas, {
        ...recorderOptions,
        durationMs,
        frameCount,
        video,
        startTimeSec,
      });
    } else {
      const recordingStartedAt = performance.now();
      recordedBlob = await recordCanvasToWebm(recordCanvas, {
        ...recorderOptions,
        video,
        startTimeSec,
        onStart: async () => {
          if (video) {
            await waitVideoSeek(video, startTimeSec);
            await video.play();
          }
        },
      });
      if (recordsUntilStopped) {
        durationMs = Math.max(1, performance.now() - recordingStartedAt);
      }
    }
  } finally {
    if (video && savedVideoState) {
      restoreVideoState(video, savedVideoState);
    }
  }

  if (signal?.aborted) {
    throw new DOMException("Export aborted.", "AbortError");
  }

  let outputBlob = recordedBlob;
  if (!profile.skipTranscode) {
    const transcodeFn = transcode ?? (await import("./ffmpeg")).transcodeWebmToMp4;
    outputBlob = await transcodeFn(recordedBlob, {
      onStage: (stage) => onPhase?.(stage),
      onProgress: onTranscodeProgress,
      sourceDurationMs: durationMs,
      signal,
    });
  }

  if (signal?.aborted) {
    throw new DOMException("Export aborted.", "AbortError");
  }

  if (download) {
    downloadLabVideo(outputBlob, outputFilename);
  }

  onPhase?.("done");
  return outputBlob;
}
