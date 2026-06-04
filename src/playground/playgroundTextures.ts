import { DEFAULT_STRIPES, type Stripe } from "./stripeColors";

export type PlaygroundMediaKind = "video" | "image";

export type BuiltinPlaygroundTextureId =
  | "example"
  | "example2"
  | "example3"
  | "example4"
  | "example5"
  | "example6"
  | "example7"
  | "example8"
  | "example9"
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
  {
    id: "example8",
    label: "example 8",
    url: "/playground/example8.mp4",
    mediaKind: "video",
    displayScale: 1,
    stripes: DEFAULT_STRIPES,
  },
  {
    id: "example9",
    label: "example 9",
    url: "/playground/example9.mp4",
    mediaKind: "video",
    displayScale: 1,
    stripes: DEFAULT_STRIPES,
  },
] as const;

export const DEFAULT_PLAYGROUND_TEXTURE_ID: PlaygroundTextureId = "example10";

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

export function detectUploadMediaKind(file: File): PlaygroundMediaKind | null {
  if (file.type.startsWith("image/")) {
    return "image";
  }
  if (file.type.startsWith("video/")) {
    return "video";
  }
  return null;
}
