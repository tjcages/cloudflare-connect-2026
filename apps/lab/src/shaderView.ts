/** View transform applied around ShaderToy `mainImage` for non-Connect presets. */
export type ShaderViewState = {
  distance: number;
  rotateXDeg: number;
  rotateYDeg: number;
  rotateZDeg: number;
  panX: number;
  panY: number;
  fov: number;
};

export const SHADER_VIEW_DEFAULTS: ShaderViewState = {
  distance: 30,
  rotateXDeg: 0,
  rotateYDeg: 0,
  rotateZDeg: 0,
  panX: 0,
  panY: 0,
  fov: 55,
};

const DISTANCE_MIN = 0.5;
const DISTANCE_MAX = 120;
const ROTATE_X_MIN = -89;
const ROTATE_X_MAX = 89;
const PAN_MIN = -40;
const PAN_MAX = 40;
const FOV_MIN = 20;
const FOV_MAX = 110;

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function normalizeYawDeg(value: number): number {
  return ((((value + 180) % 360) + 360) % 360) - 180;
}

export function normalizeShaderViewState(partial?: Partial<ShaderViewState> | null): ShaderViewState {
  return {
    distance: clamp(
      typeof partial?.distance === "number" && Number.isFinite(partial.distance)
        ? partial.distance
        : SHADER_VIEW_DEFAULTS.distance,
      DISTANCE_MIN,
      DISTANCE_MAX,
    ),
    rotateXDeg: clamp(
      typeof partial?.rotateXDeg === "number" && Number.isFinite(partial.rotateXDeg)
        ? partial.rotateXDeg
        : SHADER_VIEW_DEFAULTS.rotateXDeg,
      ROTATE_X_MIN,
      ROTATE_X_MAX,
    ),
    rotateYDeg: normalizeYawDeg(
      typeof partial?.rotateYDeg === "number" && Number.isFinite(partial.rotateYDeg)
        ? partial.rotateYDeg
        : SHADER_VIEW_DEFAULTS.rotateYDeg,
    ),
    rotateZDeg: normalizeYawDeg(
      typeof partial?.rotateZDeg === "number" && Number.isFinite(partial.rotateZDeg)
        ? partial.rotateZDeg
        : SHADER_VIEW_DEFAULTS.rotateZDeg,
    ),
    panX: clamp(
      typeof partial?.panX === "number" && Number.isFinite(partial.panX) ? partial.panX : SHADER_VIEW_DEFAULTS.panX,
      PAN_MIN,
      PAN_MAX,
    ),
    panY: clamp(
      typeof partial?.panY === "number" && Number.isFinite(partial.panY) ? partial.panY : SHADER_VIEW_DEFAULTS.panY,
      PAN_MIN,
      PAN_MAX,
    ),
    fov: clamp(
      typeof partial?.fov === "number" && Number.isFinite(partial.fov) ? partial.fov : SHADER_VIEW_DEFAULTS.fov,
      FOV_MIN,
      FOV_MAX,
    ),
  };
}

/** Uniform pack consumed by the ShaderToy wrapper. */
export type ShaderViewUniforms = {
  /** Radians yaw / pitch / roll. */
  orbitRad: [number, number, number];
  /** Normalized pan in screen units. */
  pan: [number, number];
  /** 1 = identity framing. */
  zoom: number;
};

/** Map panel camera controls → wrapper uniforms (identity at defaults). */
export function shaderViewToUniforms(state?: Partial<ShaderViewState> | null): ShaderViewUniforms {
  const view = normalizeShaderViewState(state);
  const distanceZoom = SHADER_VIEW_DEFAULTS.distance / Math.max(view.distance, 0.01);
  const fovZoom = SHADER_VIEW_DEFAULTS.fov / Math.max(view.fov, 1);
  const zoom = clamp(distanceZoom * fovZoom, 0.2, 5);
  return {
    orbitRad: [(view.rotateYDeg * Math.PI) / 180, (view.rotateXDeg * Math.PI) / 180, (view.rotateZDeg * Math.PI) / 180],
    pan: [view.panX / 40, view.panY / 40],
    zoom,
  };
}
