import { FFmpeg, type ProgressEventCallback } from "@ffmpeg/ffmpeg";
import { fetchFile } from "@ffmpeg/util";
import coreURL from "@ffmpeg/core?url";
import wasmURL from "@ffmpeg/core/wasm?url";

let ffmpegInstance: FFmpeg | null = null;
let loadPromise: Promise<FFmpeg> | null = null;

export type TranscodeStage = "loading-encoder" | "transcoding";

export type TranscodeWebmToMp4Options = {
  onStage?: (stage: TranscodeStage) => void;
  onProgress?: (percent: number) => void;
  sourceDurationMs?: number;
  signal?: AbortSignal;
};

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

export async function getPlaygroundFfmpeg(): Promise<FFmpeg> {
  if (ffmpegInstance?.loaded) {
    return ffmpegInstance;
  }
  if (loadPromise) {
    return loadPromise;
  }

  loadPromise = (async () => {
    const ffmpeg = new FFmpeg();
    await ffmpeg.load({ coreURL, wasmURL });
    ffmpegInstance = ffmpeg;
    return ffmpeg;
  })();

  return loadPromise;
}

export async function transcodeWebmToMp4(webmBlob: Blob, options: TranscodeWebmToMp4Options = {}): Promise<Blob> {
  const { onStage, onProgress, sourceDurationMs, signal } = options;

  onStage?.("loading-encoder");
  const ffmpeg = await getPlaygroundFfmpeg();

  onStage?.("transcoding");
  onProgress?.(0);

  const progressHandler: ProgressEventCallback = ({ progress, time }) => {
    onProgress?.(resolveTranscodeProgressPercent(progress, time, sourceDurationMs));
  };

  ffmpeg.on("progress", progressHandler);

  try {
    await ffmpeg.writeFile("input.webm", await fetchFile(webmBlob));
    const exitCode = await ffmpeg.exec(
      [
        "-i",
        "input.webm",
        "-an",
        "-c:v",
        "libx264",
        "-preset",
        "ultrafast",
        "-crf",
        "23",
        "-pix_fmt",
        "yuv420p",
        "-movflags",
        "+faststart",
        "output.mp4",
      ],
      undefined,
      { signal },
    );
    if (exitCode !== 0) {
      throw new Error(`FFmpeg transcode failed with exit code ${exitCode}.`);
    }

    const data = await ffmpeg.readFile("output.mp4");
    onProgress?.(100);

    const bytes = data instanceof Uint8Array ? Uint8Array.from(data) : new TextEncoder().encode(data);
    return new Blob([bytes], { type: "video/mp4" });
  } finally {
    ffmpeg.off("progress", progressHandler);
    await ffmpeg.deleteFile("input.webm").catch(() => undefined);
    await ffmpeg.deleteFile("output.mp4").catch(() => undefined);
  }
}

/** Clears the cached ffmpeg instance (for tests). */
export function resetPlaygroundFfmpegForTests(): void {
  ffmpegInstance = null;
  loadPromise = null;
}
