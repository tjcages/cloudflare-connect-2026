import { connectorPath } from "./geometry";
import type { Anchor } from "./geometry";
import { measureRules, type RuleGrid, snapToGrid } from "./measure-rules";
import { samplePath } from "./sample-path";
import type { SnakeLayout } from "./snake";

const DEEP = 22;

export function buildConnector(
  anchorFrom: Anchor,
  anchorTo: Anchor,
  {
    deep = DEEP,
    bendX,
    root,
  }: { deep?: number; bendX?: number; root?: HTMLElement } = {}
): SnakeLayout {
  const grid: RuleGrid | null = root ? measureRules(root) : null;
  const align = (anchor: Anchor): Anchor =>
    grid
      ? {
          ...anchor,
          x: snapToGrid(grid.x, anchor.x),
          y: snapToGrid(grid.y, anchor.y),
        }
      : anchor;

  const from = align(anchorFrom);
  const to = align(anchorTo);
  const bend = bendX === undefined || !grid ? bendX : snapToGrid(grid.x, bendX);
  const dir = to.side === "left" ? 1 : -1;
  const deepSeg = `L${to.x + dir * deep} ${to.y}`;
  const d = `${connectorPath(from, to, undefined, bend)} ${deepSeg}`;
  const { points, len } = samplePath(d);
  return { points, from, to, endFraction: (len - deep) / len, d };
}
