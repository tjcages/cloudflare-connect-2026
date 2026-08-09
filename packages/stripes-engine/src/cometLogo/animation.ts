export const COMET_LOGO_FORMATION_DURATION_SEC = 1.1;
export const COMET_LOGO_REJOIN_DURATION_SEC = 1.1;
const COMET_LOGO_FORMATION_CANCEL_THRESHOLD = 0.1;

export function cometLogoRejoinWindowSec(rejoinDurationSec: number, rejoinScale = 1.18, rejoinMargin = 0.45): number {
  return rejoinDurationSec * rejoinScale + rejoinMargin;
}

export type CometLogoAnimationMode = "field" | "forming" | "logo" | "rejoining";

export type CometLogoAnimationState = {
  fieldTimeSec: number;
  formation: number;
  formationVelocity: number;
  mode: CometLogoAnimationMode;
  rejoinProgress: number;
  rejoinStartFieldTimeSec: number;
  rejoinStartFormation: number;
  rejoinStartFormationVelocity: number;
  hovered: boolean;
  lastTimeSec: number | null;
};

export function createCometLogoAnimationState(timeSec = 0): CometLogoAnimationState {
  return {
    fieldTimeSec: timeSec,
    formation: 0,
    formationVelocity: 0,
    mode: "field",
    rejoinProgress: 0,
    rejoinStartFieldTimeSec: timeSec,
    rejoinStartFormation: 0,
    rejoinStartFormationVelocity: 0,
    hovered: false,
    lastTimeSec: null,
  };
}

export function advanceCometLogoAnimation(
  state: CometLogoAnimationState,
  timeSec: number,
  hovered: boolean,
  formationDurationSec = COMET_LOGO_FORMATION_DURATION_SEC,
  rejoinDurationSec = COMET_LOGO_REJOIN_DURATION_SEC,
  rejoinScale = 1.18,
  interrupt = 2,
  rejoinMargin = 0.45,
): CometLogoAnimationState {
  if (state.lastTimeSec === null) {
    return {
      fieldTimeSec: timeSec,
      formation: state.formation,
      formationVelocity: 0,
      mode: hovered ? "forming" : state.mode,
      rejoinProgress: state.rejoinProgress,
      rejoinStartFieldTimeSec: state.rejoinStartFieldTimeSec,
      rejoinStartFormation: state.rejoinStartFormation,
      rejoinStartFormationVelocity: state.rejoinStartFormationVelocity,
      hovered,
      lastTimeSec: timeSec,
    };
  }

  if (timeSec < state.lastTimeSec) {
    return {
      fieldTimeSec: timeSec,
      formation: 0,
      formationVelocity: 0,
      mode: hovered ? "forming" : "field",
      rejoinProgress: 0,
      rejoinStartFieldTimeSec: timeSec,
      rejoinStartFormation: 0,
      rejoinStartFormationVelocity: 0,
      hovered,
      lastTimeSec: timeSec,
    };
  }

  const deltaSec = Math.max(0, Math.min(0.1, timeSec - state.lastTimeSec));
  let mode = state.mode;
  let formation = state.formation;
  let formationVelocity = 0;
  let rejoinProgress = state.rejoinProgress;
  let rejoinStartFieldTimeSec = state.rejoinStartFieldTimeSec;
  let rejoinStartFormation = state.rejoinStartFormation;
  let rejoinStartFormationVelocity = state.rejoinStartFormationVelocity;

  if (mode === "field" && hovered) mode = "forming";

  if (mode === "forming") {
    if (!hovered && formation <= COMET_LOGO_FORMATION_CANCEL_THRESHOLD) {
      mode = "field";
      formation = 0;
      formationVelocity = 0;
      rejoinProgress = 0;
      rejoinStartFieldTimeSec = timeSec;
      rejoinStartFormation = 0;
      rejoinStartFormationVelocity = 0;
    } else if (!hovered && formation > 0) {
      mode = "rejoining";
      rejoinProgress = 0;
      rejoinStartFieldTimeSec = timeSec;
      rejoinStartFormation = formation;
      rejoinStartFormationVelocity = state.formationVelocity;
    } else {
      formation = Math.min(1, formation + deltaSec / Math.max(formationDurationSec, 0.001));
      if (formation > 1 - 0.000001) formation = 1;
      formationVelocity = deltaSec > 0 ? (formation - state.formation) / deltaSec : 0;
      if (formation === 1) mode = "logo";
    }
  } else if (mode === "logo" && !hovered) {
    mode = "rejoining";
    rejoinProgress = 0;
    rejoinStartFieldTimeSec = timeSec;
    rejoinStartFormation = 1;
    rejoinStartFormationVelocity = 0;
  } else if (mode === "rejoining") {
    const window = cometLogoRejoinWindowSec(Math.max(rejoinDurationSec, 0.001), rejoinScale, rejoinMargin);
    if (hovered && interrupt === 0) {
      mode = "forming";
      formation = 0;
      formationVelocity = 0;
      rejoinProgress = 0;
    } else if (hovered && interrupt === 1) {
      rejoinStartFieldTimeSec += 5 * deltaSec;
      const elapsed = timeSec - rejoinStartFieldTimeSec;
      if (elapsed <= 0) {
        mode = "forming";
        formation = Math.max(0, Math.min(1, rejoinStartFormation));
        formationVelocity = 0;
        rejoinProgress = 0;
        rejoinStartFieldTimeSec = timeSec;
      } else {
        rejoinProgress = Math.min(1, elapsed / window);
      }
    } else {
      rejoinProgress = Math.min(1, Math.max(0, timeSec - rejoinStartFieldTimeSec) / window);
      if (rejoinProgress > 1 - 0.000001) rejoinProgress = 1;
      if (rejoinProgress === 1) {
        formation = 0;
        formationVelocity = 0;
        rejoinProgress = 0;
        mode = hovered ? "forming" : "field";
      }
    }
  }

  return {
    fieldTimeSec: timeSec,
    formation,
    formationVelocity,
    mode,
    rejoinProgress,
    rejoinStartFieldTimeSec,
    rejoinStartFormation,
    rejoinStartFormationVelocity,
    hovered,
    lastTimeSec: timeSec,
  };
}
