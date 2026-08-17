import { resolveZoom } from "@/utils/zoom";

export type RuleGrid = { x: number[]; y: number[] };

const MAX_THICKNESS = 2;
const MIN_LENGTH = 24;
// Past this a connector is not running along the rule, it merely passes near it.
const SNAP_RANGE = 2;

/**
 * The optical centres of every hairline inside `root`, in the connector's own
 * coordinate space. Rules are authored two ways — `left-1/2 w-px` starts on the
 * integer and centres on X.5, while a translated `h-px` centres on the integer —
 * so the centre is measured rather than derived.
 */
export function measureRules(root: HTMLElement): RuleGrid {
  const zoom = resolveZoom(root);
  const rootRect = root.getBoundingClientRect();
  const grid: RuleGrid = { x: [], y: [] };

  for (const el of root.querySelectorAll<HTMLElement>("div")) {
    const rect = el.getBoundingClientRect();
    if (
      rect.width > 0 &&
      rect.width <= MAX_THICKNESS &&
      rect.height >= MIN_LENGTH
    ) {
      grid.x.push((rect.left - rootRect.left + rect.width / 2) / zoom);
    }
    if (
      rect.height > 0 &&
      rect.height <= MAX_THICKNESS &&
      rect.width >= MIN_LENGTH
    ) {
      grid.y.push((rect.top - rootRect.top + rect.height / 2) / zoom);
    }
  }
  return grid;
}

export function snapToGrid(centres: number[], value: number): number {
  let best = value;
  let bestGap = SNAP_RANGE;
  for (const centre of centres) {
    const gap = Math.abs(centre - value);
    if (gap < bestGap) {
      bestGap = gap;
      best = centre;
    }
  }
  return best;
}
