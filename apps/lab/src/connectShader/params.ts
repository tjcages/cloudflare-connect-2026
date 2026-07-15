import { CONNECT_SHADER_DEFAULTS, type ConnectShaderConfig, type ConnectShapeType } from "./config";

/** Material / mesh params editable in the lab (excludes camera + post-FX). */
export type ConnectShaderParams = Omit<
  ConnectShaderConfig,
  | "shapeType"
  | "cameraZ"
  | "cameraY"
  | "cameraFov"
  | "postEnabled"
  | "postPreset"
  | "postBlur"
  | "postBokeh"
  | "postBokehThreshold"
  | "postChroma"
  | "postVignette"
  | "postGrain"
  | "postContrast"
  | "postSaturation"
  | "postExposure"
  | "postSharpness"
  | "postWarmth"
  | "postProgBlur"
  | "postProgFocus"
  | "postFlare"
  | "postFlareSpread"
  | "postFlareThreshold"
  | "postFlareX"
  | "postFlareY"
>;

const {
  shapeType: _shapeType,
  cameraZ: _cameraZ,
  cameraY: _cameraY,
  cameraFov: _cameraFov,
  postEnabled: _postEnabled,
  postPreset: _postPreset,
  postBlur: _postBlur,
  postBokeh: _postBokeh,
  postBokehThreshold: _postBokehThreshold,
  postChroma: _postChroma,
  postVignette: _postVignette,
  postGrain: _postGrain,
  postContrast: _postContrast,
  postSaturation: _postSaturation,
  postExposure: _postExposure,
  postSharpness: _postSharpness,
  postWarmth: _postWarmth,
  postProgBlur: _postProgBlur,
  postProgFocus: _postProgFocus,
  postFlare: _postFlare,
  postFlareSpread: _postFlareSpread,
  postFlareThreshold: _postFlareThreshold,
  postFlareX: _postFlareX,
  postFlareY: _postFlareY,
  ...CONNECT_SHADER_PARAM_DEFAULTS_RAW
} = CONNECT_SHADER_DEFAULTS;

export const CONNECT_SHADER_PARAM_DEFAULTS: ConnectShaderParams = CONNECT_SHADER_PARAM_DEFAULTS_RAW;

/** Changing these requires rebuilding mesh / emitter geometry. */
export const CONNECT_GEOMETRY_PARAM_KEYS = new Set<keyof ConnectShaderParams>([
  "shapeWidth",
  "cylinderLength",
  "twistX",
  "twistY",
  "shapeRadius",
  "shapeConeRadiusStart",
  "shapeConeRadiusEnd",
  "shapeTube",
  "shapeBend",
  "shapePitch",
  "shapeAmplitude",
  "shapeTurns",
  "shapeWaveFreq",
  "shapeMeshQuality",
  "emitCount",
]);

const COLOR_KEYS = new Set<keyof ConnectShaderParams>([
  "fillColor",
  "fillColor2",
  "lineColor",
  "paleColor",
  "salmonColor",
  "orangeColor",
  "amberColor",
  "deepColor",
  "emitPaleColor",
  "emitSalmonColor",
  "emitOrangeColor",
  "emitAmberColor",
  "emitDeepColor",
]);

function isHexColor(value: unknown): value is string {
  return typeof value === "string" && /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(value.trim());
}

function clampNumber(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function normalizeConnectShaderParams(value: unknown): ConnectShaderParams {
  const record = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  const next = { ...CONNECT_SHADER_PARAM_DEFAULTS };

  for (const key of Object.keys(CONNECT_SHADER_PARAM_DEFAULTS) as Array<keyof ConnectShaderParams>) {
    const raw = record[key];
    const fallback = CONNECT_SHADER_PARAM_DEFAULTS[key];
    if (COLOR_KEYS.has(key)) {
      next[key] = (isHexColor(raw) ? raw.trim() : fallback) as never;
      continue;
    }
    if (typeof fallback === "boolean") {
      next[key] = (typeof raw === "boolean" ? raw : fallback) as never;
      continue;
    }
    if (typeof fallback === "number") {
      next[key] = (typeof raw === "number" && Number.isFinite(raw) ? raw : fallback) as never;
    }
  }

  next.speed = clampNumber(next.speed, 0, 3);
  next.shapeWidth = clampNumber(next.shapeWidth, 8, 48);
  next.cylinderLength = clampNumber(next.cylinderLength, 40, 260);
  next.twistX = clampNumber(next.twistX, 0.05, 2.5);
  next.twistY = clampNumber(next.twistY, 0.05, 2.5);
  next.shapeRadius = clampNumber(next.shapeRadius, 3, 36);
  next.shapeConeRadiusStart = clampNumber(next.shapeConeRadiusStart, 0.5, 36);
  next.shapeConeRadiusEnd = clampNumber(next.shapeConeRadiusEnd, 0, 36);
  next.shapeTube = clampNumber(next.shapeTube, 0.5, 14);
  next.shapeBend = clampNumber(next.shapeBend, 0, 160);
  next.shapePitch = clampNumber(next.shapePitch, 6, 90);
  next.shapeAmplitude = clampNumber(next.shapeAmplitude, 0, 24);
  next.shapeTurns = clampNumber(next.shapeTurns, 0.25, 5);
  next.shapeWaveFreq = clampNumber(next.shapeWaveFreq, 0.5, 8);
  next.wavesX = clampNumber(next.wavesX, 0.2, 24);
  next.wavesY = clampNumber(next.wavesY, 0.2, 24);
  next.displacementHeight = clampNumber(next.displacementHeight, 0, 24);
  next.speedX = clampNumber(next.speedX, 0, 0.6);
  next.speedY = clampNumber(next.speedY, 0, 0.6);
  next.fillGradScale = clampNumber(next.fillGradScale, 0.2, 6);
  next.fillAlpha = clampNumber(next.fillAlpha, 0, 1);
  next.fillLow = clampNumber(next.fillLow, 0, 1);
  next.fillHigh = clampNumber(next.fillHigh, 0, 1);
  next.fillRadius = clampNumber(next.fillRadius, 0, 2);
  next.lineCount = clampNumber(next.lineCount, 20, 1500);
  next.lineWidth = clampNumber(next.lineWidth, 0.4, 4);
  next.lineAlpha = clampNumber(next.lineAlpha, 0, 1);
  next.lineFadeLow = clampNumber(next.lineFadeLow, 0, 1);
  next.lineFadeHigh = clampNumber(next.lineFadeHigh, 0, 1);
  next.hatchAngle = clampNumber(next.hatchAngle, 0, 180);
  next.hatchLift = clampNumber(next.hatchLift, 0, 14);
  next.hatchSpacing = clampNumber(next.hatchSpacing, 0.02, 0.8);
  next.hatchCell = clampNumber(next.hatchCell, 0.2, 12);
  next.hatchFill = clampNumber(next.hatchFill, 0.1, 1);
  next.dashMin = clampNumber(next.dashMin, 0.01, 1);
  next.dashMax = clampNumber(next.dashMax, 0.05, 1);
  next.hatchDensity = clampNumber(next.hatchDensity, 0, 8);
  next.densityFloor = clampNumber(next.densityFloor, 0, 1);
  next.hatchDrift = clampNumber(next.hatchDrift, 0, 40);
  next.waveGate = clampNumber(next.waveGate, 0, 1);
  next.envCenter = clampNumber(next.envCenter, 0, 1.2);
  next.envSlope = clampNumber(next.envSlope, -1, 1);
  next.envWidth = clampNumber(next.envWidth, 0.03, 0.6);
  next.emitCount = Math.round(clampNumber(next.emitCount, 500, 40000));
  next.emitAmount = clampNumber(next.emitAmount, 0, 1);
  next.emitSpeed = clampNumber(next.emitSpeed, 0, 6);
  next.emitDist = clampNumber(next.emitDist, 0, 50);
  next.emitFall = clampNumber(next.emitFall, 0, 80);
  next.emitSize = clampNumber(next.emitSize, 0.2, 16);
  next.emitStretch = clampNumber(next.emitStretch, 1, 20);
  next.emitAlpha = clampNumber(next.emitAlpha, 0, 1);
  next.renderDpr = clampNumber(next.renderDpr, 0.5, 3);
  next.shapeMeshQuality = clampNumber(next.shapeMeshQuality, 0.25, 3);

  return next;
}

export function connectConfigFromParams(params: ConnectShaderParams, shapeType: ConnectShapeType): ConnectShaderConfig {
  return {
    ...CONNECT_SHADER_DEFAULTS,
    ...params,
    shapeType,
  };
}
