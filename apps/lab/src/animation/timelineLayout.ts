export const TIMELINE_LAYOUT_STORAGE_KEY = "stripes-lab-timeline-layout-v1";

export const DEFAULT_TIMELINE_LAYOUT = {
  height: 330,
  inspectorWidth: 260,
} as const;

export type TimelineLayout = {
  height: number;
  inspectorWidth: number;
};

type TimelineLayoutStorage = Pick<Storage, "getItem" | "setItem">;

function finiteOr(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

export function clampTimelineHeight(height: number, viewportHeight: number): number {
  const maximum = Math.max(180, finiteOr(viewportHeight, 720) - 96);
  return Math.min(maximum, Math.max(180, finiteOr(height, DEFAULT_TIMELINE_LAYOUT.height)));
}

export function clampTimelineInspectorWidth(width: number, workspaceWidth: number): number {
  const maximum = Math.max(220, Math.min(520, finiteOr(workspaceWidth, 900) - 160));
  return Math.min(maximum, Math.max(220, finiteOr(width, DEFAULT_TIMELINE_LAYOUT.inspectorWidth)));
}

export function normalizeTimelineLayout(value: unknown): TimelineLayout {
  const candidate = value && typeof value === "object" ? (value as Partial<TimelineLayout>) : {};
  return {
    height: Math.min(1200, Math.max(180, finiteOr(candidate.height, DEFAULT_TIMELINE_LAYOUT.height))),
    inspectorWidth: Math.min(
      520,
      Math.max(220, finiteOr(candidate.inspectorWidth, DEFAULT_TIMELINE_LAYOUT.inspectorWidth)),
    ),
  };
}

export function loadTimelineLayout(storage?: TimelineLayoutStorage): TimelineLayout {
  const target = storage ?? (typeof window === "undefined" ? undefined : window.localStorage);
  if (!target) return { ...DEFAULT_TIMELINE_LAYOUT };
  try {
    const stored = target.getItem(TIMELINE_LAYOUT_STORAGE_KEY);
    return stored ? normalizeTimelineLayout(JSON.parse(stored)) : { ...DEFAULT_TIMELINE_LAYOUT };
  } catch {
    return { ...DEFAULT_TIMELINE_LAYOUT };
  }
}

export function saveTimelineLayout(layout: TimelineLayout, storage?: TimelineLayoutStorage): void {
  const target = storage ?? (typeof window === "undefined" ? undefined : window.localStorage);
  if (!target) return;
  try {
    target.setItem(TIMELINE_LAYOUT_STORAGE_KEY, JSON.stringify(normalizeTimelineLayout(layout)));
  } catch {
    // The editor remains usable if storage is unavailable or full.
  }
}
