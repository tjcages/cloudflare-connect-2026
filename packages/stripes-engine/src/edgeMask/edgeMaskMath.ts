import type { EdgeMaskConfig } from "../config/types";

export function edgeMaskAlpha(u: number, v: number, config: EdgeMaskConfig): number {
  if (!config.enabled) {
    return 1;
  }
  const start = config.start;
  const end = Math.max(config.end, start + 0.0001);
  const ramp = (inset: number) => {
    const t = Math.min(1, Math.max(0, (inset - start) / (end - start)));
    return t ** config.power;
  };
  const insetX = Math.min(u, 1 - u);
  const insetY = Math.min(v, 1 - v);
  return ramp(insetX) * ramp(insetY);
}
