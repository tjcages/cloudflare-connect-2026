import type { EdgeMaskConfig } from "../config/types";

export function edgeMaskAlpha(u: number, v: number, config: EdgeMaskConfig): number {
  if (!config.enabled) {
    return 1;
  }
  const start = config.start;
  const end = Math.max(config.end, start + 0.0001);
  const ramp = (inset: number, side: boolean) => {
    if (!side) return 1;
    const t = Math.min(1, Math.max(0, (inset - start) / (end - start)));
    return t ** config.power;
  };
  return (
    ramp(u, config.sides.left) *
    ramp(1 - u, config.sides.right) *
    ramp(v, config.sides.bottom) *
    ramp(1 - v, config.sides.top)
  );
}
