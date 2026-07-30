export const COMET_LOGO_CYCLE_DURATION_SEC = 9.2;
export const COMET_LOGO_LAYER_COUNT = 5;
export const COMET_LOGO_EMERGENCE_END = 0.1;
export const COMET_LOGO_RELEASE_START = 0.78;
export const COMET_LOGO_CAPTURE_RISE_END = 0.035;
export const COMET_LOGO_CAPTURE_FALL_START = 0.075;
export const COMET_LOGO_CAPTURE_END = 0.17;

export type CometLogoLayerLifecycle = {
  progress: number;
  emergence: number;
  release: number;
  opacity: number;
};

export type CometLogoAnimationState = {
  timeSec: number;
  cycleProgress: number;
};

function positiveFraction(value: number): number {
  return ((value % 1) + 1) % 1;
}

function smoothstep(edge0: number, edge1: number, value: number): number {
  const progress = Math.max(0, Math.min(1, (value - edge0) / (edge1 - edge0)));
  return progress * progress * (3 - 2 * progress);
}

export function cometLogoLayerProgress(timeSec: number, layerIndex: number): number {
  return positiveFraction(timeSec / COMET_LOGO_CYCLE_DURATION_SEC + layerIndex / COMET_LOGO_LAYER_COUNT);
}

export function cometLogoCaptureEnvelope(progress: number): number {
  const rise = smoothstep(0, COMET_LOGO_CAPTURE_RISE_END, progress);
  const fall = 1 - smoothstep(COMET_LOGO_CAPTURE_FALL_START, COMET_LOGO_CAPTURE_END, progress);
  return rise * fall;
}

export function cometLogoLayerLifecycle(timeSec: number, layerIndex: number): CometLogoLayerLifecycle {
  const progress = cometLogoLayerProgress(timeSec, layerIndex);
  const emergence = smoothstep(0, COMET_LOGO_EMERGENCE_END, progress);
  const release = smoothstep(COMET_LOGO_RELEASE_START, 1, progress);
  return {
    progress,
    emergence,
    release,
    opacity: emergence,
  };
}

export function createCometLogoAnimationState(timeSec = 0): CometLogoAnimationState {
  return {
    timeSec,
    cycleProgress: positiveFraction(timeSec / COMET_LOGO_CYCLE_DURATION_SEC),
  };
}

export function advanceCometLogoAnimation(_state: CometLogoAnimationState, timeSec: number): CometLogoAnimationState {
  return createCometLogoAnimationState(timeSec);
}
