export const CONNECTOR_RADIUS = 10;

export type Side = "left" | "right";
export type Point = { x: number; y: number };
export type Anchor = Point & { side: Side };

const sign = (n: number) => (n < 0 ? -1 : 1);

// Radius clamps to the shorter of the two segments, so corners never overshoot.
export function connectorPath(
  from: Point,
  to: Point,
  radius = CONNECTOR_RADIUS,
  bendX?: number
): string {
  if (from.y === to.y) {
    return `M${from.x} ${from.y} L${to.x} ${to.y}`;
  }

  const xm = bendX ?? (from.x + to.x) / 2;
  const r = Math.min(
    radius,
    Math.abs(from.x - xm),
    Math.abs(xm - to.x),
    Math.abs(from.y - to.y) / 2
  );
  const sx = sign(xm - from.x);
  const sy = sign(to.y - from.y);
  const sx2 = sign(to.x - xm);

  return [
    `M${from.x} ${from.y}`,
    `L${xm - sx * r} ${from.y}`,
    `Q${xm} ${from.y} ${xm} ${from.y + sy * r}`,
    `L${xm} ${to.y - sy * r}`,
    `Q${xm} ${to.y} ${xm + sx2 * r} ${to.y}`,
    `L${to.x} ${to.y}`,
  ].join(" ");
}
