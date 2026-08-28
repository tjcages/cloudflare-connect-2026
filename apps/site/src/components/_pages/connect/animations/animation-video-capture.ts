const encoderSafeDimension = (value: number) => {
  const floored = Math.max(1, Math.floor(value));
  return floored > 2 ? floored - (floored % 2) : floored;
};

/**
 * Preserve the complete source frame. Video codecs require even dimensions,
 * so at most one pixel is removed from either edge.
 */
export function resolveAnimationCaptureSize(
  width: number,
  height: number
): { width: number; height: number } {
  return {
    width: encoderSafeDimension(Number.isFinite(width) ? width : 1),
    height: encoderSafeDimension(Number.isFinite(height) ? height : 1),
  };
}
