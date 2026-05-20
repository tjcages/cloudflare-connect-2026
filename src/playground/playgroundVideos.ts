import {
  DEFAULT_STRIPE_DENSITY,
  DEFAULT_STRIPE_DUOTONE_OPTIONS,
  DEFAULT_STRIPE_THRESHOLD,
} from "./stripeFilterOptions";

export type PlaygroundVideoId = "example" | "example2" | "example3" | "example4";

export type PlaygroundDuotoneDefaults = {
  ignoreColorHex: string;
  ignoreTolerance: number;
  gamma: number;
  threshold: number;
  density: number;
};

export type PlaygroundVideoOption = {
  id: PlaygroundVideoId;
  label: string;
  url: string;
  /** Canvas and sampling scale relative to native video dimensions. */
  displayScale: number;
  duotone: PlaygroundDuotoneDefaults;
};

/** Sample videos served from `public/playground/`. */
export const PLAYGROUND_VIDEOS: readonly PlaygroundVideoOption[] = [
  {
    id: "example",
    label: "example",
    url: "/playground/example.mp4",
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
    displayScale: 1,
    duotone: {
      ignoreColorHex: "#000000",
      ignoreTolerance: 0.015,
      gamma: 4,
      threshold: 0.05,
      density: 1.05,
    },
  },
] as const;

export const DEFAULT_PLAYGROUND_VIDEO_ID: PlaygroundVideoId = "example4";

export function getPlaygroundVideoOption(id: PlaygroundVideoId): PlaygroundVideoOption {
  const option = PLAYGROUND_VIDEOS.find((entry) => entry.id === id);
  if (!option) {
    throw new Error(`Unknown playground video: ${id}`);
  }
  return option;
}
