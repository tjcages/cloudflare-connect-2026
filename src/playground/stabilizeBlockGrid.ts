/**
 * Limit stripe-index changes per update so colors do not snap frame to frame.
 * Indices are contiguous (0 = background, 1…N), so a single-step move is a neighbor stripe.
 * `maxStep` caps how many indices a cell may move per update; 0 (or non-positive) snaps instantly.
 */
export function smoothBlockGridIndices(next: Uint8Array, previous: Uint8Array | undefined, maxStep = 1): Uint8Array {
  if (!previous || previous.length !== next.length || maxStep <= 0) {
    return new Uint8Array(next);
  }

  const out = new Uint8Array(next.length);
  for (let i = 0; i < next.length; i++) {
    const prev = previous[i] ?? 0;
    const target = next[i] ?? 0;
    const delta = target - prev;
    if (delta > 0) {
      out[i] = prev + Math.min(delta, maxStep);
    } else if (delta < 0) {
      out[i] = prev - Math.min(-delta, maxStep);
    } else {
      out[i] = prev;
    }
  }

  return out;
}
