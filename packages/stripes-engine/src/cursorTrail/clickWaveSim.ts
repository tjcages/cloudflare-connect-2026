import type { ClickWaveConfig } from "../config/types";
import { normalizeClickWave, DEFAULT_CLICK_WAVE } from "../config/normalize";

export type ClickWavePoint = {
  x: number;
  y: number;
};

export type ClickWaveSample = ClickWavePoint & {
  radius: number;
  strokeWidth: number;
  waveProgress: number;
  pushPower: number;
  whitePower: number;
  seed: number;
};

type ActiveClickWave = ClickWavePoint & {
  ageMs: number;
  lifeMs: number;
  seed: number;
};

export type ClickWaveState = {
  waves: ActiveClickWave[];
  clearFramesRemaining: number;
  nextSeed: number;
};

const CLEAR_REBUILD_FRAMES = 10;
const MAX_DT_MS = 48;

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function easeOutQuart(progress: number): number {
  const t = 1 - clamp01(progress);
  return 1 - t * t * t * t;
}

function smokeLifeCurve(progress: number): number {
  return Math.pow(Math.max(0, 1 - progress), 0.45);
}

function computeRingWhiteFalloff(progress: number, eased: number): number {
  const birthBoost = 1.35 - 0.35 * eased;
  return smokeLifeCurve(progress) * birthBoost;
}

export function createClickWaveState(): ClickWaveState {
  return {
    waves: [],
    clearFramesRemaining: 0,
    nextSeed: 1,
  };
}

export function addClickWave(state: ClickWaveState, point: ClickWavePoint, lifeMs: number): void {
  state.waves.push({
    x: point.x,
    y: point.y,
    ageMs: 0,
    lifeMs: Math.max(1, lifeMs),
    seed: state.nextSeed++,
  });
}

export function updateClickWave(
  state: ClickWaveState,
  dtMs: number,
  rawConfig: ClickWaveConfig = DEFAULT_CLICK_WAVE,
): { samples: ClickWaveSample[]; changed: boolean } {
  const config = normalizeClickWave(rawConfig);
  const dt = Math.max(0, Math.min(MAX_DT_MS, dtMs || 16.67));
  const hadWaves = state.waves.length > 0;

  if (!config.enabled) {
    state.waves = [];
    if (hadWaves) {
      state.clearFramesRemaining = CLEAR_REBUILD_FRAMES;
    }
    const isClearing = state.clearFramesRemaining > 0;
    if (isClearing) {
      state.clearFramesRemaining--;
    }
    return { samples: [], changed: isClearing };
  }

  if (state.waves.length > config.maxWaves) {
    state.waves.splice(0, state.waves.length - config.maxWaves);
  }

  const samples: ClickWaveSample[] = [];
  const nextWaves: ActiveClickWave[] = [];
  for (const wave of state.waves) {
    const ageMs = wave.ageMs + dt;
    if (ageMs >= wave.lifeMs) {
      continue;
    }

    const progress = ageMs / wave.lifeMs;
    const eased = easeOutQuart(progress);
    const radius = config.startRadiusPx + (config.maxRadiusPx - config.startRadiusPx) * eased;
    const strokeWidth = config.startStrokeWidthPx + (config.endStrokeWidthPx - config.startStrokeWidthPx) * progress;
    const life = 1 - progress;

    nextWaves.push({ ...wave, ageMs });
    samples.push({
      x: wave.x,
      y: wave.y,
      radius,
      strokeWidth: Math.max(config.endStrokeWidthPx, strokeWidth),
      waveProgress: progress,
      pushPower: life * life * (3 - 2 * life),
      whitePower: computeRingWhiteFalloff(progress, eased),
      seed: wave.seed,
    });
  }
  state.waves = nextWaves;

  if (hadWaves && nextWaves.length === 0) {
    state.clearFramesRemaining = CLEAR_REBUILD_FRAMES;
  }

  const isClearing = samples.length === 0 && state.clearFramesRemaining > 0;
  if (isClearing) {
    state.clearFramesRemaining--;
  }

  return {
    samples,
    changed: samples.length > 0 || isClearing,
  };
}
