import type { TimelineEasing } from "./timelineModel";

export const TIMELINE_EASING_PRESETS_STORAGE_KEY = "stripes-engine-lab-timeline-easing-presets-v1";

export type TimelineEasingPreset = {
  id: string;
  name: string;
  easing: TimelineEasing;
};

export function normalizeTimelineEasingPresets(value: unknown): TimelineEasingPreset[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry) => {
    if (!entry || typeof entry !== "object") return [];
    const candidate = entry as Partial<TimelineEasingPreset>;
    const name = typeof candidate.name === "string" ? candidate.name.trim().slice(0, 40) : "";
    if (!name || typeof candidate.id !== "string" || typeof candidate.easing !== "string") return [];
    return [{ id: candidate.id, name, easing: candidate.easing as TimelineEasing }];
  });
}

export function loadTimelineEasingPresets(): TimelineEasingPreset[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const stored = localStorage.getItem(TIMELINE_EASING_PRESETS_STORAGE_KEY);
    return stored ? normalizeTimelineEasingPresets(JSON.parse(stored)) : [];
  } catch {
    return [];
  }
}

export function saveTimelineEasingPresets(presets: readonly TimelineEasingPreset[]): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(TIMELINE_EASING_PRESETS_STORAGE_KEY, JSON.stringify(presets));
  } catch {
    // Preset editing remains usable when browser storage is unavailable.
  }
}

export function upsertTimelineEasingPreset(
  presets: readonly TimelineEasingPreset[],
  name: string,
  easing: TimelineEasing,
): { preset: TimelineEasingPreset; presets: TimelineEasingPreset[] } {
  const normalizedName = name.trim().slice(0, 40);
  const existing = presets.find((preset) => preset.name.toLocaleLowerCase() === normalizedName.toLocaleLowerCase());
  const preset: TimelineEasingPreset = {
    id: existing?.id ?? `easing-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    name: normalizedName,
    easing,
  };
  return {
    preset,
    presets: existing
      ? presets.map((candidate) => (candidate.id === existing.id ? preset : candidate))
      : [...presets, preset],
  };
}
