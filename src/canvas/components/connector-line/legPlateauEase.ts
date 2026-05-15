const EDGE_TIME = 0.14;

/** Distance along the leg (normalized 0–1) covered in each ramp zone; chosen for C¹ join to the linear middle. */
const rampDistance = (): number => {
  const a = EDGE_TIME;
  const mid = 1 - 2 * a;
  return a / (2 * mid + 2 * a);
};

/**
 * Maps normalized time t∈[0,1] → blend u∈[0,1] for one connector leg (Motion `ease`).
 * Quadratic ramps use the first/last ~14% of **time**; the middle is linear in u (constant speed along the path).
 * Ramps join the middle with C¹ continuity.
 */
export const connectorLegPlateauEase = (t: number): number => {
  const u = Math.min(1, Math.max(0, t));
  const a = EDGE_TIME;
  const b = EDGE_TIME;
  const mid = 1 - a - b;
  const ramp = rampDistance();

  if (u <= a) {
    const p = u / a;
    return ramp * p * p;
  }
  if (u >= 1 - b) {
    const s = (u - (1 - b)) / b;
    return 1 - ramp + ramp * (2 * s - s * s);
  }
  return ramp + ((u - a) / mid) * (1 - 2 * ramp);
};
