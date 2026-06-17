import { DEFAULT_STRIPES, type Stripe } from "@necatikcl/stripes-shader";

export type PlaygroundMediaKind = "video" | "image";

export type BuiltinPlaygroundTextureId =
  | "example"
  | "example2"
  | "example3"
  | "example4"
  | "example5"
  | "example6"
  | "example7"
  | "example10";

export type PlaygroundTextureId = BuiltinPlaygroundTextureId | `upload:${string}`;

/** Default stripe list applied to newly uploaded videos/images before any saved config exists. */
export const DEFAULT_PLAYGROUND_UPLOAD_STRIPES: readonly Stripe[] = DEFAULT_STRIPES;

export type PlaygroundTextureOption = {
  id: BuiltinPlaygroundTextureId;
  label: string;
  url: string;
  mediaKind: PlaygroundMediaKind;
  /** Canvas and sampling scale relative to native source dimensions. */
  displayScale: number;
  stripes: readonly Stripe[];
};

/** Sample textures served from `public/playground/`. */
export const PLAYGROUND_TEXTURES: readonly PlaygroundTextureOption[] = [
  {
    id: "example10",
    label: "example 10",
    url: "/playground/example10.jpg",
    mediaKind: "image",
    displayScale: 1,
    stripes: DEFAULT_STRIPES,
  },
  {
    id: "example5",
    label: "example 5",
    url: "/playground/example5.mp4",
    mediaKind: "video",
    displayScale: 1,
    stripes: DEFAULT_STRIPES,
  },
  {
    id: "example",
    label: "example",
    url: "/playground/example.mp4",
    mediaKind: "video",
    displayScale: 1,
    stripes: DEFAULT_STRIPES,
  },
  {
    id: "example2",
    label: "example 2",
    url: "/playground/example2.mp4",
    mediaKind: "video",
    displayScale: 1,
    stripes: DEFAULT_STRIPES,
  },
  {
    id: "example3",
    label: "example 3",
    url: "/playground/example3.mp4",
    mediaKind: "video",
    displayScale: 1,
    stripes: DEFAULT_STRIPES,
  },
  {
    id: "example4",
    label: "example 4",
    url: "/playground/example4.mp4",
    mediaKind: "video",
    displayScale: 1,
    stripes: DEFAULT_STRIPES,
  },
  {
    id: "example6",
    label: "example 6",
    url: "/playground/example6.mp4",
    mediaKind: "video",
    displayScale: 1,
    stripes: DEFAULT_STRIPES,
  },
  {
    id: "example7",
    label: "example 7",
    url: "/playground/example7.mp4",
    mediaKind: "video",
    displayScale: 1,
    stripes: DEFAULT_STRIPES,
  },
] as const;

export const DEFAULT_PLAYGROUND_TEXTURE_ID: PlaygroundTextureId = "example5";

export function isUploadTextureId(id: string): id is `upload:${string}` {
  return id.startsWith("upload:");
}

export function getPlaygroundTextureOption(id: BuiltinPlaygroundTextureId): PlaygroundTextureOption {
  const option = PLAYGROUND_TEXTURES.find((entry) => entry.id === id);
  if (!option) {
    throw new Error(`Unknown playground texture: ${id}`);
  }
  return option;
}

const IMAGE_EXTENSIONS = new Set([
  "avif",
  "bmp",
  "gif",
  "heic",
  "heif",
  "ico",
  "jpeg",
  "jpg",
  "png",
  "svg",
  "tif",
  "tiff",
  "webp",
]);

const VIDEO_EXTENSIONS = new Set(["3gp", "3g2", "avi", "m4v", "mkv", "mov", "mp4", "mpeg", "mpg", "ogv", "webm"]);

function fileExtension(fileName: string): string {
  const match = /\.([^.]+)$/i.exec(fileName);
  return match ? match[1]!.toLowerCase() : "";
}

export function detectUploadMediaKind(file: File): PlaygroundMediaKind | null {
  if (file.type.startsWith("image/")) {
    return "image";
  }
  if (file.type.startsWith("video/")) {
    return "video";
  }
  const extension = fileExtension(file.name);
  if (IMAGE_EXTENSIONS.has(extension)) {
    return "image";
  }
  if (VIDEO_EXTENSIONS.has(extension)) {
    return "video";
  }
  return null;
}

export function formatUploadRejectionMessage(fileName: string): string {
  const name = fileName.trim() || "This file";
  return `${name} is not recognized as an image or video. Choose a common image (JPEG, PNG, WebP, GIF, HEIC, …) or video (MP4, MOV, WebM, …). If the extension looks correct, try re-exporting the file so the browser can read it.`;
}

export type PlaygroundTextureLoadFailureReason = "decode" | "dimensions" | "missing" | "unavailable";

export function formatTextureLoadErrorMessage(options: {
  label: string;
  mediaKind: PlaygroundMediaKind;
  reason: PlaygroundTextureLoadFailureReason;
}): string {
  const name = options.label.trim() || "This texture";
  switch (options.reason) {
    case "dimensions":
      return `${name} loaded but has no usable pixel size. The file may be empty or corrupt — try re-exporting it.`;
    case "missing":
      return `${name} is no longer in browser storage — the file data may have been cleared. Upload it again from your computer.`;
    case "unavailable":
      return `No textures are available to load. Pick a built-in example from the Texture menu or upload an image or video.`;
    case "decode":
    default:
      if (options.mediaKind === "video") {
        return `${name} could not be played. Your browser may not support this video codec — try exporting as H.264 in an MP4 or WebM.`;
      }
      return `${name} could not be decoded as an image. The file may be corrupt or use a format your browser cannot render — try JPEG, PNG, or WebP.`;
  }
}

/** File picker hint: MIME groups plus common extensions macOS often omits from `file.type`. */
export const PLAYGROUND_TEXTURE_UPLOAD_ACCEPT =
  "image/*,video/*,.avif,.bmp,.gif,.heic,.heif,.ico,.jpeg,.jpg,.png,.svg,.tif,.tiff,.webp,.3gp,.3g2,.avi,.m4v,.mkv,.mov,.mp4,.mpeg,.mpg,.ogv,.webm";
