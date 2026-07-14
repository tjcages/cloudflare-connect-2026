import type { BackgroundStars } from "../config/types";
import { lerp, smooth } from "../core/math";

export interface Star {
  x: number;
  y: number;
  sizePx: number;
  scale: number;
  tiltRad: number;
  bornMs: number;
  lifeMs: number;
  phase: number;
  colorSeed: number;
  baseOpacity: number;
  opacity: number;
}

export interface StarsState {
  stars: Star[];
  lastStepMs: number;
  random: () => number;
}

export function createStarsState(random: () => number): StarsState {
  return { stars: [], lastStepMs: 0, random };
}

export function starsTargetCount(config: BackgroundStars, display: { width: number; height: number }): number {
  const n = Math.min(100, Math.max(0, config.density)) / 100;
  if (!config.enabled || n <= 0 || config.opacity <= 0 || config.sizePx <= 0) return 0;
  const area = Math.max(1, (display.width * display.height) / 8000);
  return Math.min(360, Math.max(1, Math.round((4 + area * 1.9) * n)));
}

function spawnStar(
  state: StarsState,
  config: BackgroundStars,
  display: { width: number; height: number },
  nowMs: number,
  backfill: boolean,
): Star {
  const a = Math.min(1, Math.max(0, config.sizeRandomness));
  const sizeJitter = lerp(1 - a, 1 + a, state.random());
  const speed = Math.max(0.05, config.twinkleSpeed);
  const lifeMs = lerp(750, 2200, state.random()) / speed;
  const bornMs = backfill ? nowMs - state.random() * lifeMs : nowMs;
  return {
    x: state.random() * display.width,
    y: state.random() * display.height,
    sizePx: Math.max(0.25, config.sizePx * Math.max(0.12, sizeJitter)),
    scale: 0,
    tiltRad: 0,
    bornMs,
    lifeMs,
    phase: state.random() * Math.PI * 2,
    colorSeed: state.random(),
    baseOpacity: lerp(0.55, 1, state.random()),
    opacity: 0,
  };
}

function updateStar(star: Star, config: BackgroundStars, nowMs: number): boolean {
  const age = nowMs - star.bornMs;
  if (age < 0 || age >= star.lifeMs) return false;
  const t = age / star.lifeMs;
  const scaleEnv = smooth(0, 0.28, t) * (1 - smooth(0.62, 1, t));
  const opacityEnv = smooth(0, 0.18, t) * (1 - smooth(0.72, 1, t));
  const speed = Math.max(0, config.twinkleSpeed);
  const tw = 0.5 + 0.5 * Math.sin((nowMs / 1000) * speed * Math.PI * 2 + star.phase);
  const amt = Math.min(1, Math.max(0, config.twinkleAmount));
  const scaleTwinkle = lerp(1, 0.78 + 0.22 * tw, amt);
  const opacityTwinkle = lerp(1, 0.65 + 0.35 * tw, amt);
  const tiltRad = (Math.min(89, Math.max(-89, config.tiltAngleDeg)) * Math.PI) / 180;
  star.scale = Math.min(1, Math.max(0, scaleEnv * scaleTwinkle));
  star.tiltRad = tiltRad;
  star.opacity = Math.min(1, Math.max(0, config.opacity * star.baseOpacity * opacityEnv * opacityTwinkle));
  return (star.scale > 0.001 && star.opacity > 0.001) || t < 0.96;
}

export function stepStars(
  state: StarsState,
  config: BackgroundStars,
  display: { width: number; height: number },
  nowMs: number,
): void {
  if (!config.enabled || display.width <= 0 || display.height <= 0) {
    state.stars.length = 0;
    state.lastStepMs = nowMs;
    return;
  }
  const target = starsTargetCount(config, display);
  if (target <= 0) {
    state.stars.length = 0;
    state.lastStepMs = nowMs;
    return;
  }
  const backfill = state.lastStepMs <= 0;
  state.lastStepMs = nowMs;
  state.stars = state.stars.filter((star) => updateStar(star, config, nowMs));
  if (state.stars.length > target) state.stars.length = target;
  while (state.stars.length < target) {
    const star = spawnStar(state, config, display, nowMs, backfill);
    updateStar(star, config, nowMs);
    state.stars.push(star);
  }
}
