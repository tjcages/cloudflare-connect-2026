export const CONNECT_ANIMATION_VIDEO_MAX_EDGE_PX = 3840;
export const CONNECT_ANIMATION_VIDEO_MAX_PIXELS = 3840 * 2160;

const encoderSafeDimension = (value: number) => {
  const floored = Math.max(1, Math.floor(value));
  return floored > 2 ? floored - (floored % 2) : floored;
};

/**
 * Keep canvas recording inside a broadly supported UHD encoder envelope.
 * `MediaRecorder.isTypeSupported()` only validates the container/codec; the
 * concrete hardware encoder can still fail at runtime for oversized canvases.
 */
export function resolveAnimationCaptureSize(
  width: number,
  height: number
): { width: number; height: number } {
  const sourceWidth = Number.isFinite(width) ? Math.max(1, width) : 1;
  const sourceHeight = Number.isFinite(height) ? Math.max(1, height) : 1;
  const edgeScale = Math.min(
    1,
    CONNECT_ANIMATION_VIDEO_MAX_EDGE_PX / sourceWidth,
    CONNECT_ANIMATION_VIDEO_MAX_EDGE_PX / sourceHeight
  );
  const pixelScale = Math.min(
    1,
    Math.sqrt(CONNECT_ANIMATION_VIDEO_MAX_PIXELS / (sourceWidth * sourceHeight))
  );
  const scale = Math.min(edgeScale, pixelScale);

  return {
    width: encoderSafeDimension(sourceWidth * scale),
    height: encoderSafeDimension(sourceHeight * scale),
  };
}
