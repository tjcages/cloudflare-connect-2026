import type { CursorTrailPixelBounds } from "./cursorTrail";

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function smokeSeededUnit(seed: number, salt: number): number {
  const x = Math.sin(seed * 12.9898 + salt * 78.233) * 43758.5453;
  return x - Math.floor(x);
}

/** Irregular smoke front: ripples the ring radius by angle. */
export function smokeAngularRadiusWobble(
  seed: number,
  angle: number,
  progress: number,
  amplitude: number,
): number {
  const spin = progress * Math.PI * 2;
  return (
    amplitude *
    (Math.sin(angle * 3 + seed * 0.71 + spin * 0.35) * 0.38 +
      Math.sin(angle * 6 + seed * 1.19 - spin * 0.55) * 0.32 +
      Math.sin(angle * 11 + seed * 2.07 + spin) * 0.22)
  );
}

/** Breaks up solid bands into wispy smoke pockets. */
export function smokeStrengthBreakup(
  seed: number,
  x: number,
  y: number,
  progress: number,
  jitter: number,
): number {
  if (jitter <= 0) {
    return 1;
  }
  const n1 = smokeSeededUnit(seed, x * 0.17 + y * 0.23 + progress * 48);
  const n2 = smokeSeededUnit(seed, x * 0.41 + y * 0.09 - progress * 29 + seed * 0.13);
  const density = n1 * n2;
  return 1 - jitter * (1 - density);
}

export function smokeSoftRingFalloff(distanceFromRing: number, halfStroke: number): number {
  if (halfStroke <= 0) {
    return 0;
  }
  const reach = halfStroke * 1.4;
  if (distanceFromRing >= reach) {
    return 0;
  }
  const t = 1 - distanceFromRing / reach;
  const smooth = t * t * (3 - 2 * t);
  return smooth * (0.25 + 0.75 * t);
}

export type SmokyRingModulation = {
  seed: number;
  waveProgress: number;
  radiusWobbleAmplitude: number;
  strengthJitter: number;
  softness: number;
};

export function blendEffectBlackChannel(channel: number, alpha: number): number {
  return Math.round(channel * (1 - alpha));
}

export function smoothRingFalloff(distanceFromRing: number, halfStroke: number): number {
  if (halfStroke <= 0 || distanceFromRing >= halfStroke) {
    return 0;
  }
  const t = 1 - distanceFromRing / halfStroke;
  return t * t * (3 - 2 * t);
}

function mergeEffectBounds(
  bounds: CursorTrailPixelBounds,
  minX: number,
  maxX: number,
  minY: number,
  maxY: number,
): CursorTrailPixelBounds {
  return {
    dirtyMinX: Math.min(bounds.dirtyMinX, minX),
    dirtyMinY: Math.min(bounds.dirtyMinY, minY),
    dirtyMaxX: Math.max(bounds.dirtyMaxX, maxX),
    dirtyMaxY: Math.max(bounds.dirtyMaxY, maxY),
  };
}

/** Thin black band on a ring in effect pixel space (runs before push displacement). */
export function applyThinBlackRingOnEffectPixels(
  pixels: Uint8ClampedArray,
  effectWidth: number,
  effectHeight: number,
  centerX: number,
  centerY: number,
  ringRadius: number,
  halfStroke: number,
  peakAlpha: number,
  bounds: CursorTrailPixelBounds,
  toDisplayX: (effectX: number) => number,
  toDisplayY: (effectY: number) => number,
  smoke?: SmokyRingModulation,
): CursorTrailPixelBounds {
  if (peakAlpha <= 0 || halfStroke <= 0 || ringRadius <= 0) {
    return bounds;
  }

  const reach = ringRadius + halfStroke * (smoke?.softness ?? 1) * 1.5 + 2;
  const minX = Math.max(0, Math.floor(centerX - reach));
  const maxX = Math.min(effectWidth - 1, Math.ceil(centerX + reach));
  const minY = Math.max(0, Math.floor(centerY - reach));
  const maxY = Math.min(effectHeight - 1, Math.ceil(centerY + reach));

  let nextBounds = mergeEffectBounds(
    bounds,
    toDisplayX(minX),
    toDisplayX(maxX),
    toDisplayY(minY),
    toDisplayY(maxY),
  );

  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      const dx = x - centerX;
      const dy = y - centerY;
      const distance = Math.hypot(dx, dy);
      const angle = Math.atan2(dy, dx);
      const wobble = smoke
        ? smokeAngularRadiusWobble(smoke.seed, angle, smoke.waveProgress, smoke.radiusWobbleAmplitude)
        : 0;
      const effectiveRadius = ringRadius + wobble;
      const strokeScale = smoke
        ? smoke.softness * (0.72 + 0.56 * smokeSeededUnit(smoke.seed, Math.floor(angle * 6.5) * 17))
        : 1;
      const falloff = smoke
        ? smokeSoftRingFalloff(Math.abs(distance - effectiveRadius), halfStroke * strokeScale)
        : smoothRingFalloff(Math.abs(distance - effectiveRadius), halfStroke);
      let ringAlpha = peakAlpha * falloff;
      if (smoke && ringAlpha > 0) {
        ringAlpha *= smokeStrengthBreakup(smoke.seed, x, y, smoke.waveProgress, smoke.strengthJitter);
      }
      if (ringAlpha <= 0.02) {
        continue;
      }

      const idx = (y * effectWidth + x) * 4;
      pixels[idx] = blendEffectBlackChannel(pixels[idx] ?? 0, ringAlpha);
      pixels[idx + 1] = blendEffectBlackChannel(pixels[idx + 1] ?? 0, ringAlpha);
      pixels[idx + 2] = blendEffectBlackChannel(pixels[idx + 2] ?? 0, ringAlpha);
    }
  }

  return nextBounds;
}

/** Black shell on the outer edge of a push disc (runs before push displacement). */
export function applyPushLeadBlackShellOnEffectPixels(
  pixels: Uint8ClampedArray,
  effectWidth: number,
  effectHeight: number,
  centerX: number,
  centerY: number,
  pushRadius: number,
  innerRadiusFraction: number,
  peakAlpha: number,
  bounds: CursorTrailPixelBounds,
  toDisplayX: (effectX: number) => number,
  toDisplayY: (effectY: number) => number,
): CursorTrailPixelBounds {
  if (peakAlpha <= 0 || pushRadius <= 0) {
    return bounds;
  }

  const innerRadius = pushRadius * innerRadiusFraction;
  const shellSpan = Math.max(0.5, pushRadius - innerRadius);
  const minX = Math.max(0, Math.floor(centerX - pushRadius));
  const maxX = Math.min(effectWidth - 1, Math.ceil(centerX + pushRadius));
  const minY = Math.max(0, Math.floor(centerY - pushRadius));
  const maxY = Math.min(effectHeight - 1, Math.ceil(centerY + pushRadius));

  let nextBounds = mergeEffectBounds(
    bounds,
    toDisplayX(minX),
    toDisplayX(maxX),
    toDisplayY(minY),
    toDisplayY(maxY),
  );

  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      const distance = Math.hypot(x - centerX, y - centerY);
      if (distance < innerRadius || distance > pushRadius) {
        continue;
      }

      const shellT = (distance - innerRadius) / shellSpan;
      const ringAlpha = peakAlpha * (0.35 + 0.65 * shellT);
      if (ringAlpha <= 0) {
        continue;
      }

      const idx = (y * effectWidth + x) * 4;
      pixels[idx] = blendEffectBlackChannel(pixels[idx] ?? 0, ringAlpha);
      pixels[idx + 1] = blendEffectBlackChannel(pixels[idx + 1] ?? 0, ringAlpha);
      pixels[idx + 2] = blendEffectBlackChannel(pixels[idx + 2] ?? 0, ringAlpha);
    }
  }

  return nextBounds;
}
