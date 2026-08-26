import {
  buildTwizzlerLines,
  twizzlerSvgPathCubic,
  type TwizzlerSettings,
} from "@tjcages/connect-twizzler";

const VIDEO_MIME_TYPES = [
  "video/mp4;codecs=avc1",
  "video/mp4",
  "video/webm;codecs=vp9",
  "video/webm;codecs=vp8",
  "video/webm",
] as const;

const escapeXml = (value: string) =>
  value.replaceAll("&", "&amp;").replaceAll('"', "&quot;");

export function buildWaveformSvg(
  width: number,
  height: number,
  timeSec: number,
  input: TwizzlerSettings
): string {
  const safeWidth = Math.max(1, Math.round(width));
  const safeHeight = Math.max(1, Math.round(height));
  const { settings, lines } = buildTwizzlerLines(
    safeWidth,
    safeHeight,
    timeSec,
    input
  );
  const paths = [...lines]
    .sort((a, b) => a.nearness - b.nearness)
    .map((line, index) => {
      if (line.points.length < 2) return "";
      const path = twizzlerSvgPathCubic(line.points);
      const opacity = Math.max(0, Math.min(1, line.opacity * settings.opacity));
      const width = Math.max(settings.minLineWidth, line.strokeWidth);
      return `  <path data-fiber="${index}" d="${escapeXml(path)}" fill="none" stroke="${escapeXml(line.color)}" stroke-opacity="${opacity.toFixed(3)}" stroke-width="${width.toFixed(2)}" stroke-linecap="round" stroke-linejoin="round" />`;
    })
    .filter(Boolean)
    .join("\n");

  return [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<svg xmlns="http://www.w3.org/2000/svg" width="${safeWidth}" height="${safeHeight}" viewBox="0 0 ${safeWidth} ${safeHeight}">`,
    `  <rect width="100%" height="100%" fill="${escapeXml(settings.backgroundColor)}" />`,
    `  <g data-layer="connect-waveform">`,
    paths,
    `  </g>`,
    `</svg>`,
  ].join("\n");
}

export function downloadText(contents: string, filename: string, type: string) {
  const url = URL.createObjectURL(new Blob([contents], { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

const pickVideoMimeType = () =>
  VIDEO_MIME_TYPES.find((type) => MediaRecorder.isTypeSupported(type));

export async function recordShaderStack({
  twizzlerCanvas,
  rainCanvas,
  durationSec,
  onProgress,
}: {
  twizzlerCanvas: HTMLCanvasElement;
  rainCanvas: HTMLCanvasElement;
  durationSec: number;
  onProgress?: (progress: number) => void;
}): Promise<{ blob: Blob; extension: "mp4" | "webm" }> {
  if (typeof MediaRecorder === "undefined") {
    throw new Error("Video recording is not supported in this browser.");
  }
  const mimeType = pickVideoMimeType();
  if (!mimeType) {
    throw new Error("This browser has no supported video encoder.");
  }

  const width = Math.max(1, twizzlerCanvas.width, rainCanvas.width);
  const height = Math.max(1, twizzlerCanvas.height, rainCanvas.height);
  const output = document.createElement("canvas");
  output.width = width;
  output.height = height;
  const context = output.getContext("2d", { alpha: false });
  if (!context) throw new Error("Could not create the export canvas.");

  const stream = output.captureStream(60);
  const recorder = new MediaRecorder(stream, {
    mimeType,
    videoBitsPerSecond: Math.min(
      50_000_000,
      Math.max(12_000_000, width * height * 60 * 0.16)
    ),
  });
  const chunks: BlobPart[] = [];
  recorder.addEventListener("dataavailable", (event) => {
    if (event.data.size > 0) chunks.push(event.data);
  });

  const complete = new Promise<Blob>((resolve, reject) => {
    recorder.addEventListener("stop", () => {
      if (chunks.length === 0) {
        reject(new Error("The browser produced an empty video."));
        return;
      }
      resolve(new Blob(chunks, { type: mimeType }));
    });
    recorder.addEventListener("error", () =>
      reject(new Error("Video recording failed."))
    );
  });

  const durationMs = Math.max(1, durationSec) * 1000;
  const startedAt = performance.now();
  recorder.start();

  await new Promise<void>((resolve) => {
    const paint = (now: number) => {
      const elapsed = now - startedAt;
      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, width, height);
      context.drawImage(twizzlerCanvas, 0, 0, width, height);
      context.drawImage(rainCanvas, 0, 0, width, height);
      onProgress?.(Math.min(1, elapsed / durationMs));
      if (elapsed < durationMs) requestAnimationFrame(paint);
      else resolve();
    };
    requestAnimationFrame(paint);
  });

  recorder.stop();
  const blob = await complete;
  for (const track of stream.getTracks()) track.stop();
  return { blob, extension: mimeType.startsWith("video/mp4") ? "mp4" : "webm" };
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
