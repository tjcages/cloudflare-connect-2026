import { sanitizeThemedConfig, type ThemedEngineConfig } from "@necatikcl/stripes-engine";

export type SurfaceMode = "full" | "partial";
export type SurfaceAreaKind = "freeform" | "frame";

export type SurfacePoint = {
  x: number;
  y: number;
};

export type SurfaceArea = {
  id: string;
  name: string;
  kind: SurfaceAreaKind;
  points: SurfacePoint[];
  config: ThemedEngineConfig;
  visible: boolean;
};

export type SurfaceWorkspace = {
  mode: SurfaceMode;
  areas: SurfaceArea[];
  selectedAreaId: string | null;
  fullConfig: ThemedEngineConfig | null;
};

const SURFACE_WORKSPACE_KEY = "stripes-engine-lab-surface-workspace";
const MIN_POINT_DISTANCE = 0.006;
const MIN_POLYGON_AREA = 0.001;

export const EMPTY_SURFACE_WORKSPACE: SurfaceWorkspace = {
  mode: "full",
  areas: [],
  selectedAreaId: null,
  fullConfig: null,
};

function finiteUnit(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return Math.max(0, Math.min(1, value));
}

function normalizePoint(value: unknown): SurfacePoint | null {
  if (!value || typeof value !== "object") return null;
  const point = value as Partial<SurfacePoint>;
  const x = finiteUnit(point.x);
  const y = finiteUnit(point.y);
  return x === null || y === null ? null : { x, y };
}

export function polygonArea(points: readonly SurfacePoint[]): number {
  if (points.length < 3) return 0;
  let area = 0;
  for (let index = 0; index < points.length; index++) {
    const current = points[index]!;
    const next = points[(index + 1) % points.length]!;
    area += current.x * next.y - next.x * current.y;
  }
  return Math.abs(area) / 2;
}

export function pointInSurfaceArea(point: SurfacePoint, area: Pick<SurfaceArea, "points">): boolean {
  let inside = false;
  const points = area.points;
  for (
    let currentIndex = 0, previousIndex = points.length - 1;
    currentIndex < points.length;
    previousIndex = currentIndex++
  ) {
    const current = points[currentIndex]!;
    const previous = points[previousIndex]!;
    const crosses =
      current.y > point.y !== previous.y > point.y &&
      point.x < ((previous.x - current.x) * (point.y - current.y)) / (previous.y - current.y) + current.x;
    if (crosses) inside = !inside;
  }
  return inside;
}

export function findSurfaceAreaAtPoint(areas: readonly SurfaceArea[], point: SurfacePoint): SurfaceArea | null {
  return areas.find((area) => area.visible && pointInSurfaceArea(point, area)) ?? null;
}

export function appendSurfacePoint(points: readonly SurfacePoint[], next: SurfacePoint): SurfacePoint[] {
  const normalized = {
    x: Math.max(0, Math.min(1, next.x)),
    y: Math.max(0, Math.min(1, next.y)),
  };
  const previous = points.at(-1);
  if (previous && Math.hypot(normalized.x - previous.x, normalized.y - previous.y) < MIN_POINT_DISTANCE)
    return [...points];
  return [...points, normalized];
}

export function finishSurfacePath(points: readonly SurfacePoint[]): SurfacePoint[] | null {
  const normalized: SurfacePoint[] = [];
  for (const point of points) {
    const next = normalizePoint(point);
    if (!next) continue;
    const previous = normalized.at(-1);
    if (previous && Math.hypot(next.x - previous.x, next.y - previous.y) < MIN_POINT_DISTANCE) continue;
    normalized.push(next);
  }
  return normalized.length >= 3 && polygonArea(normalized) >= MIN_POLYGON_AREA ? normalized : null;
}

export function surfaceFramePoints(anchor: SurfacePoint, opposite: SurfacePoint): SurfacePoint[] {
  const first = normalizePoint(anchor) ?? { x: 0, y: 0 };
  const second = normalizePoint(opposite) ?? { x: 0, y: 0 };
  const left = Math.min(first.x, second.x);
  const right = Math.max(first.x, second.x);
  const top = Math.min(first.y, second.y);
  const bottom = Math.max(first.y, second.y);
  return [
    { x: left, y: top },
    { x: right, y: top },
    { x: right, y: bottom },
    { x: left, y: bottom },
  ];
}

export function finishSurfaceFrame(anchor: SurfacePoint, opposite: SurfacePoint): SurfacePoint[] | null {
  const points = surfaceFramePoints(anchor, opposite);
  return polygonArea(points) >= MIN_POLYGON_AREA ? points : null;
}

export function normalizeSurfaceAreaPoints(
  kind: SurfaceAreaKind,
  points: readonly SurfacePoint[],
): SurfacePoint[] | null {
  if (kind === "freeform") return finishSurfacePath(points);
  const normalized = points.map(normalizePoint).filter((point): point is SurfacePoint => point !== null);
  if (normalized.length < 2) return null;
  const xs = normalized.map((point) => point.x);
  const ys = normalized.map((point) => point.y);
  return finishSurfaceFrame({ x: Math.min(...xs), y: Math.min(...ys) }, { x: Math.max(...xs), y: Math.max(...ys) });
}

export function translateSurfaceAreaPoints(points: readonly SurfacePoint[], translation: SurfacePoint): SurfacePoint[] {
  if (points.length === 0) return [];
  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const requestedX = Number.isFinite(translation.x) ? translation.x : 0;
  const requestedY = Number.isFinite(translation.y) ? translation.y : 0;
  const x = Math.max(-minX, Math.min(1 - maxX, requestedX));
  const y = Math.max(-minY, Math.min(1 - maxY, requestedY));
  return points.map((point) => ({ x: point.x + x, y: point.y + y }));
}

function nextAreaName(areas: readonly SurfaceArea[], kind: SurfaceAreaKind): string {
  const prefix = kind === "frame" ? "Frame" : "Area";
  const used = new Set(areas.map((area) => area.name));
  let index = 1;
  while (used.has(`${prefix} ${index}`)) index++;
  return `${prefix} ${index}`;
}

function newAreaId(): string {
  return typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : `area-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function createSurfaceArea(
  kind: SurfaceAreaKind,
  points: readonly SurfacePoint[],
  config: ThemedEngineConfig,
  existingAreas: readonly SurfaceArea[],
): SurfaceArea | null {
  const finished = normalizeSurfaceAreaPoints(kind, points);
  if (!finished) return null;
  return {
    id: newAreaId(),
    name: nextAreaName(existingAreas, kind),
    kind,
    points: finished,
    config: sanitizeThemedConfig(config),
    visible: true,
  };
}

function normalizeArea(value: unknown): SurfaceArea | null {
  if (!value || typeof value !== "object") return null;
  const area = value as Partial<SurfaceArea>;
  const kind: SurfaceAreaKind = area.kind === "frame" ? "frame" : "freeform";
  const points = normalizeSurfaceAreaPoints(kind, Array.isArray(area.points) ? area.points : []);
  if (
    typeof area.id !== "string" ||
    area.id.trim() === "" ||
    typeof area.name !== "string" ||
    area.name.trim() === "" ||
    !points ||
    !area.config ||
    typeof area.config !== "object"
  )
    return null;
  return {
    id: area.id,
    name: area.name.trim(),
    kind,
    points,
    config: sanitizeThemedConfig(area.config),
    visible: area.visible !== false,
  };
}

export function normalizeSurfaceWorkspace(value: unknown): SurfaceWorkspace {
  if (!value || typeof value !== "object") return { ...EMPTY_SURFACE_WORKSPACE };
  const workspace = value as Partial<SurfaceWorkspace>;
  const areas = Array.isArray(workspace.areas)
    ? workspace.areas.map(normalizeArea).filter((area): area is SurfaceArea => area !== null)
    : [];
  const selectedAreaId =
    workspace.selectedAreaId === null
      ? null
      : typeof workspace.selectedAreaId === "string" && areas.some((area) => area.id === workspace.selectedAreaId)
        ? workspace.selectedAreaId
        : (areas[0]?.id ?? null);
  const fullConfig =
    workspace.fullConfig && typeof workspace.fullConfig === "object"
      ? sanitizeThemedConfig(workspace.fullConfig)
      : null;
  return {
    mode: workspace.mode === "partial" ? "partial" : "full",
    areas,
    selectedAreaId,
    fullConfig,
  };
}

export function loadSurfaceWorkspace(): SurfaceWorkspace {
  try {
    const raw = localStorage.getItem(SURFACE_WORKSPACE_KEY);
    return raw ? normalizeSurfaceWorkspace(JSON.parse(raw)) : { ...EMPTY_SURFACE_WORKSPACE };
  } catch {
    return { ...EMPTY_SURFACE_WORKSPACE };
  }
}

export function saveSurfaceWorkspace(workspace: SurfaceWorkspace): void {
  try {
    localStorage.setItem(SURFACE_WORKSPACE_KEY, JSON.stringify(normalizeSurfaceWorkspace(workspace)));
  } catch {}
}

export function moveSurfaceArea(areas: readonly SurfaceArea[], id: string, direction: -1 | 1): SurfaceArea[] {
  const index = areas.findIndex((area) => area.id === id);
  const target = index + direction;
  if (index < 0 || target < 0 || target >= areas.length) return [...areas];
  const next = [...areas];
  const [area] = next.splice(index, 1);
  next.splice(target, 0, area!);
  return next;
}
