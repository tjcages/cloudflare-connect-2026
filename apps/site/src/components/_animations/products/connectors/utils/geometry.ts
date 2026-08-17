import { CELL_SIZE, PLATE_INSET } from "../../../constants";
import type {
  Anchor,
  Point,
} from "@/components/_animations/shared/snake-pulse/geometry";

export type BoxGeom = { position: Point; size: number };

type BoxRect = {
  left: number;
  right: number;
  top: number;
  bottom: number;
  cx: number;
  cy: number;
  width: number;
};

export function boxRect({ position, size }: BoxGeom): BoxRect {
  const width = CELL_SIZE * size;
  const left = position.x;
  const top = position.y;
  return {
    left,
    right: left + width,
    top,
    bottom: top + CELL_SIZE,
    cx: left + width / 2,
    cy: top + CELL_SIZE / 2,
    width,
  };
}

export function resolveAnchors(
  source: BoxGeom,
  target: BoxGeom
): { from: Anchor; to: Anchor } {
  const s = boxRect(source);
  const t = boxRect(target);
  if (t.cx >= s.cx) {
    return {
      from: { x: s.right - PLATE_INSET, y: s.cy, side: "right" },
      to: { x: t.left + PLATE_INSET, y: t.cy, side: "left" },
    };
  }
  return {
    from: { x: s.left + PLATE_INSET, y: s.cy, side: "left" },
    to: { x: t.right - PLATE_INSET, y: t.cy, side: "right" },
  };
}

export function buildConnections<
  T extends { id: string; connectTo?: string[] },
>(boxes: T[]): Edge<T>[] {
  const seen = new Set<string>();
  return buildDirectedEdges(boxes).filter(({ source, target }) => {
    const key = [source.id, target.id].sort().join(" ");
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export type Edge<T> = { source: T; target: T };

export function edgeKey<T extends { id: string }>(edge: Edge<T>): string {
  return `${edge.source.id}->${edge.target.id}`;
}

export function buildDirectedEdges<
  T extends { id: string; connectTo?: string[] },
>(boxes: T[]): Edge<T>[] {
  const byId = new Map(boxes.map((b) => [b.id, b]));
  const edges: Edge<T>[] = [];
  for (const source of boxes) {
    for (const targetId of source.connectTo ?? []) {
      const target = byId.get(targetId);
      if (target) edges.push({ source, target });
    }
  }
  return edges;
}

export function findRoots<T extends { id: string; connectTo?: string[] }>(
  boxes: T[]
): string[] {
  const targets = new Set<string>();
  for (const box of boxes) {
    for (const id of box.connectTo ?? []) targets.add(id);
  }
  return boxes.filter((box) => !targets.has(box.id)).map((box) => box.id);
}
