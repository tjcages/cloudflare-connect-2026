import { FFmpeg, type LogEventCallback, type ProgressEventCallback } from "@ffmpeg/ffmpeg";
import { fetchFile } from "@ffmpeg/util";

/** Keep in sync with the `@ffmpeg/core` version in package.json. */
export const FFMPEG_CORE_VERSION = "0.12.10";

export function buildFfmpegCdnCoreUrls(version = FFMPEG_CORE_VERSION): { coreURL: string; wasmURL: string } {
  const base = `https://cdn.jsdelivr.net/npm/@ffmpeg/core@${version}/dist/esm`;
  return {
    coreURL: `${base}/ffmpeg-core.js`,
    wasmURL: `${base}/ffmpeg-core.wasm`,
  };
}

async function resolveFfmpegCoreUrls(): Promise<{ coreURL: string; wasmURL: string }> {
  if (import.meta.env.PROD) {
    return buildFfmpegCdnCoreUrls();
  }

  const [coreModule, wasmModule] = await Promise.all([import("@ffmpeg/core?url"), import("@ffmpeg/core/wasm?url")]);
  return {
    coreURL: coreModule.default,
    wasmURL: wasmModule.default,
  };
}

let ffmpegInstance: FFmpeg | null = null;
let loadPromise: Promise<FFmpeg> | null = null;

export type TranscodeStage = "loading-encoder" | "transcoding";

export type TranscodeWebmToMp4Options = {
  onStage?: (stage: TranscodeStage) => void;
  onProgress?: (percent: number) => void;
  sourceDurationMs?: number;
  signal?: AbortSignal;
  colorSpace?: PredefinedColorSpace;
};

const DISPLAY_P3_H264_METADATA = "h264_metadata=colour_primaries=12:transfer_characteristics=13";

export function buildDisplayP3Mp4RemuxArgs(inputFilename: string, outputFilename: string): string[] {
  return [
    "-i",
    inputFilename,
    "-map",
    "0:v:0",
    "-c:v",
    "copy",
    "-bsf:v",
    DISPLAY_P3_H264_METADATA,
    "-color_primaries",
    "smpte432",
    "-color_trc",
    "iec61966-2-1",
    "-movflags",
    "+faststart",
    outputFilename,
  ];
}

export function buildWebmTranscodeArgs(
  inputFilename: string,
  outputFilename: string,
  colorSpace: PredefinedColorSpace = "display-p3",
): string[] {
  const isDisplayP3 = colorSpace === "display-p3";
  return [
    "-i",
    inputFilename,
    "-an",
    "-c:v",
    "libx264",
    // CRF controls quality; ultrafast minimizes >4K memory while producing a larger file.
    "-preset",
    "ultrafast",
    "-crf",
    "8",
    "-pix_fmt",
    "yuv420p",
    "-color_primaries",
    isDisplayP3 ? "smpte432" : "bt709",
    "-color_trc",
    "iec61966-2-1",
    "-colorspace",
    "bt709",
    "-color_range",
    "tv",
    ...(isDisplayP3 ? ["-bsf:v", `${DISPLAY_P3_H264_METADATA}:matrix_coefficients=1`] : []),
    "-movflags",
    "+faststart",
    outputFilename,
  ];
}

export function resolveTranscodeProgressPercent(
  progress: number,
  timeMicros: number,
  sourceDurationMs?: number,
): number {
  if (sourceDurationMs && sourceDurationMs > 0 && timeMicros > 0) {
    const elapsedMs = timeMicros / 1000;
    return Math.min(100, Math.max(0, Math.round((elapsedMs / sourceDurationMs) * 100)));
  }
  if (!Number.isFinite(progress) || progress <= 0) {
    return 0;
  }
  return Math.min(100, Math.max(0, Math.round(progress * 100)));
}

export async function getLabFfmpeg(): Promise<FFmpeg> {
  if (ffmpegInstance?.loaded) {
    return ffmpegInstance;
  }
  if (loadPromise) {
    return loadPromise;
  }

  loadPromise = (async () => {
    const ffmpeg = new FFmpeg();
    const { coreURL, wasmURL } = await resolveFfmpegCoreUrls();
    await ffmpeg.load({ coreURL, wasmURL });
    ffmpegInstance = ffmpeg;
    return ffmpeg;
  })();

  return loadPromise;
}

export async function transcodeWebmToMp4(webmBlob: Blob, options: TranscodeWebmToMp4Options = {}): Promise<Blob> {
  const { onStage, onProgress, sourceDurationMs, signal, colorSpace = "srgb" } = options;

  onStage?.("loading-encoder");
  const ffmpeg = await getLabFfmpeg();

  onStage?.("transcoding");
  onProgress?.(0);

  const progressHandler: ProgressEventCallback = ({ progress, time }) => {
    onProgress?.(resolveTranscodeProgressPercent(progress, time, sourceDurationMs));
  };
  const logs: string[] = [];
  const logHandler: LogEventCallback = ({ message }) => {
    logs.push(message);
    if (logs.length > 12) logs.shift();
  };

  ffmpeg.on("progress", progressHandler);
  ffmpeg.on("log", logHandler);

  try {
    await ffmpeg.writeFile("input.webm", await fetchFile(webmBlob));
    const exitCode = await ffmpeg.exec(buildWebmTranscodeArgs("input.webm", "output.mp4", colorSpace), undefined, {
      signal,
    });
    if (exitCode !== 0) {
      const detail = logs.slice(-4).join(" ").trim();
      throw new Error(`FFmpeg transcode failed with exit code ${exitCode}.${detail ? ` ${detail}` : ""}`);
    }

    const data = await ffmpeg.readFile("output.mp4");
    onProgress?.(100);

    const bytes = data instanceof Uint8Array ? Uint8Array.from(data) : new TextEncoder().encode(data);
    return new Blob([bytes], { type: "video/mp4" });
  } finally {
    ffmpeg.off("progress", progressHandler);
    ffmpeg.off("log", logHandler);
    await ffmpeg.deleteFile("input.webm").catch(() => undefined);
    await ffmpeg.deleteFile("output.mp4").catch(() => undefined);
  }
}

/** Correct Chromium's H.264 color tags without re-encoding or changing any pixels. */
export async function retagDisplayP3Mp4(mp4Blob: Blob, options: TranscodeWebmToMp4Options = {}): Promise<Blob> {
  const { onStage, onProgress, signal } = options;
  onStage?.("loading-encoder");
  const ffmpeg = await getLabFfmpeg();

  onStage?.("transcoding");
  onProgress?.(0);
  const logs: string[] = [];
  const logHandler: LogEventCallback = ({ message }) => {
    logs.push(message);
    if (logs.length > 12) logs.shift();
  };
  ffmpeg.on("log", logHandler);
  try {
    await ffmpeg.writeFile("input-native.mp4", await fetchFile(mp4Blob));
    const exitCode = await ffmpeg.exec(buildDisplayP3Mp4RemuxArgs("input-native.mp4", "output-p3.mp4"), undefined, {
      signal,
    });
    if (exitCode !== 0) {
      const detail = logs.slice(-4).join(" ").trim();
      throw new Error(
        `FFmpeg color metadata correction failed with exit code ${exitCode}.${detail ? ` ${detail}` : ""}`,
      );
    }
    const data = await ffmpeg.readFile("output-p3.mp4");
    onProgress?.(100);
    const bytes = data instanceof Uint8Array ? Uint8Array.from(data) : new TextEncoder().encode(data);
    return new Blob([bytes], { type: "video/mp4" });
  } finally {
    ffmpeg.off("log", logHandler);
    await ffmpeg.deleteFile("input-native.mp4").catch(() => undefined);
    await ffmpeg.deleteFile("output-p3.mp4").catch(() => undefined);
  }
}

/** Clears the cached ffmpeg instance (for tests). */
export function resetLabFfmpegForTests(): void {
  ffmpegInstance = null;
  loadPromise = null;
}
