import {
  DEFAULT_STRIPE_DENSITY,
  DEFAULT_STRIPE_DUOTONE_OPTIONS,
  DEFAULT_STRIPE_THRESHOLD,
} from "./stripeFilterOptions";

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
  | "example9";

export type PlaygroundTextureId = BuiltinPlaygroundTextureId | `upload:${string}`;

export type PlaygroundDuotoneDefaults = {
  ignoreColorHex: string;
  ignoreTolerance: number;
  gamma: number;
  threshold: number;
  density: number;
};

export type PlaygroundTextureOption = {
  id: BuiltinPlaygroundTextureId;
  label: string;
  url: string;
  mediaKind: PlaygroundMediaKind;
  /** Canvas and sampling scale relative to native source dimensions. */
  displayScale: number;
  duotone: PlaygroundDuotoneDefaults;
};

/** Sample textures served from `public/playground/`. */
export const PLAYGROUND_TEXTURES: readonly PlaygroundTextureOption[] = [
  {
    id: "example",
    label: "example",
    url: "/playground/example.mp4",
    mediaKind: "video",
    displayScale: 1,
    duotone: {
      ignoreColorHex: "#000000",
      ignoreTolerance: DEFAULT_STRIPE_DUOTONE_OPTIONS.ignoreTolerance,
      gamma: 1,
      threshold: DEFAULT_STRIPE_THRESHOLD,
      density: DEFAULT_STRIPE_DENSITY,
    },
  },
  {
    id: "example2",
    label: "example 2",
    url: "/playground/example2.mp4",
    mediaKind: "video",
    displayScale: 1,
    duotone: {
      ignoreColorHex: "#ffffff",
      ignoreTolerance: 0.16,
      gamma: 0.3,
      threshold: DEFAULT_STRIPE_THRESHOLD,
      density: DEFAULT_STRIPE_DENSITY,
    },
  },
  {
    id: "example3",
    label: "example 3",
    url: "/playground/example3.mp4",
    mediaKind: "video",
    displayScale: 1,
    duotone: {
      ignoreColorHex: "#000000",
      ignoreTolerance: 0.015,
      gamma: 4,
      threshold: 0.05,
      density: 1.05,
    },
  },
  {
    id: "example4",
    label: "example 4",
    url: "/playground/example4.mp4",
    mediaKind: "video",
    displayScale: 1,
    duotone: {
      ignoreColorHex: "#000000",
      ignoreTolerance: 0.1,
      gamma: 1.2,
      threshold: 0.64,
      density: 0.3,
    },
  },
  {
    id: "example5",
    label: "example 5",
    url: "/playground/example5.mp4",
    mediaKind: "video",
    displayScale: 1,
    duotone: {
      ignoreColorHex: "#000000",
      ignoreTolerance: 0.095,
      gamma: 1.15,
      threshold: 0.99,
      density: 0.6,
    },
  },
  {
    id: "example6",
    label: "example 6",
    url: "/playground/example6.mp4",
    mediaKind: "video",
    displayScale: 1,
    duotone: {
      ignoreColorHex: "#000000",
      ignoreTolerance: 0.235,
      gamma: 1,
      threshold: 0.99,
      density: 0.55,
    },
  },
  {
    id: "example7",
    label: "example 7",
    url: "/playground/example7.mp4",
    mediaKind: "video",
    displayScale: 1,
    duotone: {
      ignoreColorHex: "#000000",
      ignoreTolerance: 0.415,
      gamma: 1.9,
      threshold: 0.99,
      density: 0.65,
    },
  },
  {
    id: "example8",
    label: "example 8",
    url: "/playground/example8.mp4",
    mediaKind: "video",
    displayScale: 1,
    duotone: {
      ignoreColorHex: "#ffffff",
      ignoreTolerance: DEFAULT_STRIPE_DUOTONE_OPTIONS.ignoreTolerance,
      gamma: 1,
      threshold: DEFAULT_STRIPE_THRESHOLD,
      density: DEFAULT_STRIPE_DENSITY,
    },
  },
  {
    id: "example9",
    label: "example 9",
    url: "/playground/example9.mp4",
    mediaKind: "video",
    displayScale: 1,
    duotone: {
      ignoreColorHex: "#ffffff",
      ignoreTolerance: DEFAULT_STRIPE_DUOTONE_OPTIONS.ignoreTolerance,
      gamma: 1,
      threshold: DEFAULT_STRIPE_THRESHOLD,
      density: DEFAULT_STRIPE_DENSITY,
    },
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

export function detectUploadMediaKind(file: File): PlaygroundMediaKind | null {
  if (file.type.startsWith("image/")) {
    return "image";
  }
  if (file.type.startsWith("video/")) {
    return "video";
  }
  return null;
}
