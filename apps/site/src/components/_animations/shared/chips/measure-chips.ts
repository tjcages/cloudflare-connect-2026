import type { Anchor } from "@/components/_animations/shared/snake-pulse/geometry";
import { resolveZoom } from "@/utils/zoom";

export type ChipCenter = { id: string; cx: number; cy: number; r: number };

export function measureChips<T extends string>(
  root: HTMLElement,
  ids: readonly T[]
): Record<T, ChipCenter> | null {
  const zoom = resolveZoom(root);
  const cr = root.getBoundingClientRect();
  const out = {} as Record<T, ChipCenter>;
  for (const id of ids) {
    const el = root.querySelector<HTMLElement>(`[data-chip-id="${id}"]`);
    if (!el) return null;
    const r = el.getBoundingClientRect();
    out[id] = {
      id,
      cx: (r.left + r.width / 2 - cr.left) / zoom,
      cy: (r.top + r.height / 2 - cr.top) / zoom,
      r: Math.min(r.width, r.height) / 2 / zoom,
    };
  }
  return out;
}

export function sideAnchors(
  a: ChipCenter,
  b: ChipCenter
): { from: Anchor; to: Anchor } {
  if (b.cx >= a.cx) {
    return {
      from: { x: a.cx + a.r, y: a.cy, side: "right" },
      to: { x: b.cx - b.r, y: b.cy, side: "left" },
    };
  }
  return {
    from: { x: a.cx - a.r, y: a.cy, side: "left" },
    to: { x: b.cx + b.r, y: b.cy, side: "right" },
  };
}
