const SCOOP = 6;
const ROUND = 1;

export function scoopPath(w: number, h: number): string {
  const s = SCOOP;
  const r = ROUND;
  return [
    `M ${s + r} 0`,
    `L ${w - s - r} 0`,
    `A ${r} ${r} 0 0 1 ${w - s} ${r}`,
    `A ${s} ${s} 0 0 0 ${w - r} ${s}`,
    `A ${r} ${r} 0 0 1 ${w} ${s + r}`,
    `L ${w} ${h - s - r}`,
    `A ${r} ${r} 0 0 1 ${w - r} ${h - s}`,
    `A ${s} ${s} 0 0 0 ${w - s} ${h - r}`,
    `A ${r} ${r} 0 0 1 ${w - s - r} ${h}`,
    `L ${s + r} ${h}`,
    `A ${r} ${r} 0 0 1 ${s} ${h - r}`,
    `A ${s} ${s} 0 0 0 ${r} ${h - s}`,
    `A ${r} ${r} 0 0 1 0 ${h - s - r}`,
    `L 0 ${s + r}`,
    `A ${r} ${r} 0 0 1 ${r} ${s}`,
    `A ${s} ${s} 0 0 0 ${s} ${r}`,
    `A ${r} ${r} 0 0 1 ${s + r} 0`,
    "Z",
  ].join(" ");
}
