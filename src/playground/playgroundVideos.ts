export type PlaygroundVideoId = "question" | "lock";

export type PlaygroundVideoOption = {
  id: PlaygroundVideoId;
  label: string;
  url: string;
};

/** Sample videos served from `public/playground/`. */
export const PLAYGROUND_VIDEOS: readonly PlaygroundVideoOption[] = [
  { id: "question", label: "question", url: "/playground/question.mp4" },
  { id: "lock", label: "lock", url: "/playground/lock.mp4" },
] as const;

export const DEFAULT_PLAYGROUND_VIDEO_ID: PlaygroundVideoId = "question";

export function getPlaygroundVideoOption(id: PlaygroundVideoId): PlaygroundVideoOption {
  const option = PLAYGROUND_VIDEOS.find((entry) => entry.id === id);
  if (!option) {
    throw new Error(`Unknown playground video: ${id}`);
  }
  return option;
}
