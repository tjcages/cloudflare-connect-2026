import {
  COLOR_SATURATION_EPSILON,
  colorPixelPresence,
  DEFAULT_TEXTURE_LUMINANCE_BACKGROUND_COLOR,
  isNonBackgroundColorPixel,
  normalizeTextureLuminanceMode,
  pixelSaturation,
  type TextureLuminanceSettings,
} from "./colorWhiteness";
import {
  DEFAULT_PLAYGROUND_CURSOR_TRAIL_CONFIG,
  normalizePlaygroundCursorTrailConfig,
  type PlaygroundCursorTrailConfig,
} from "./playgroundCursorTrailConfig";
import { applyPushLeadBlackShellOnEffectPixels } from "./playgroundPointerEffectWhites";

export type CursorTrailPoint = {
  x: number;
  y: number;
};

export type CursorTrailSample = CursorTrailPoint & {
  alpha: number;
  radius: number;
  pushX: number;
  pushY: number;
};

export type CursorTrailPixelBounds = {
  dirtyMinX: number;
  dirtyMinY: number;
  dirtyMaxX: number;
  dirtyMaxY: number;
};

type CursorTrailDrop = CursorTrailPoint & {
  ageMs: number;
  lifeMs: number;
  radius: number;
  vx: number;
  vy: number;
  spin: number;
  seed: number;
};

export type CursorTrailState = {
  current: CursorTrailPoint;
  velocity: CursorTrailPoint;
  target: CursorTrailPoint | null;
  drops: CursorTrailDrop[];
  hasPointer: boolean;
  clearFramesRemaining: number;
  emitRemainder: number;
  lastEmit: CursorTrailPoint | null;
  nextSeed: number;
};

const CLEAR_REBUILD_FRAMES = 10;
const MAX_DT_MS = 48;

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function clampInt(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Math.round(value)));
}

function blendChannel(channel: number, alpha: number): number {
  return Math.round(channel + (255 - channel) * alpha);
}

function blendChannelToward(channel: number, target: number, alpha: number): number {
  return Math.round(channel + (target - channel) * alpha);
}

function brightenRgbPreservingHue(r: number, g: number, b: number): { r: number; g: number; b: number } {
  const maxC = Math.max(r, g, b);
  if (maxC <= 0) {
    return { r: 255, g: 255, b: 255 };
  }
  const scale = 255 / maxC;
  return {
    r: Math.round(Math.min(255, r * scale)),
    g: Math.round(Math.min(255, g * scale)),
    b: Math.round(Math.min(255, b * scale)),
  };
}

function forRingPixels(
  originX: number,
  originY: number,
  ring: number,
  width: number,
  height: number,
  visit: (x: number, y: number) => void,
): void {
  if (ring === 0) {
    visit(originX, originY);
    return;
  }

  for (let dy = -ring; dy <= ring; dy++) {
    for (let dx = -ring; dx <= ring; dx++) {
      if (Math.max(Math.abs(dx), Math.abs(dy)) !== ring) {
        continue;
      }
      const x = originX + dx;
      const y = originY + dy;
      if (x < 0 || y < 0 || x >= width || y >= height) {
        continue;
      }
      visit(x, y);
    }
  }
}

/** Nearest saturated foreground color from a particle center; skips neutral/white picks. */
function resolveColorsModeTrailRgb(
  source: Uint8ClampedArray,
  width: number,
  height: number,
  centerX: number,
  centerY: number,
  backgroundColor: number,
  maxRadius: number,
): { r: number; g: number; b: number } | null {
  const originX = Math.min(width - 1, Math.max(0, Math.round(centerX)));
  const originY = Math.min(height - 1, Math.max(0, Math.round(centerY)));

  for (let ring = 0; ring <= maxRadius; ring++) {
    let bestPresence = -1;
    let bestR = 0;
    let bestG = 0;
    let bestB = 0;
    let found = false;

    forRingPixels(originX, originY, ring, width, height, (x, y) => {
      const idx = (y * width + x) * 4;
      const r = source[idx] ?? 0;
      const g = source[idx + 1] ?? 0;
      const b = source[idx + 2] ?? 0;
      if (!isNonBackgroundColorPixel(r, g, b, backgroundColor)) {
        return;
      }
      if (pixelSaturation(r, g, b) <= COLOR_SATURATION_EPSILON) {
        return;
      }

      const presence = colorPixelPresence(r, g, b, backgroundColor);
      if (presence > bestPresence) {
        bestPresence = presence;
        bestR = r;
        bestG = g;
        bestB = b;
        found = true;
      }
    });

    if (found) {
      return { r: bestR, g: bestG, b: bestB };
    }
  }

  return null;
}

function falloff(distance: number, radius: number): number {
  if (radius <= 0 || distance >= radius) {
    return 0;
  }
  const t = 1 - distance / radius;
  return t * t * (3 - 2 * t);
}

function resolveTrailSampleRadius(
  sample: CursorTrailSample,
  config: PlaygroundCursorTrailConfig,
  displayWidth: number,
  effectWidth: number,
): number {
  const particleRadius = Math.max(1, displayToEffectCoord(sample.radius, displayWidth, effectWidth));
  const pushEnabled = config.pushStrengthPx > 0 || config.pushLeadBlackAlpha > 0;
  if (!pushEnabled) {
    return particleRadius;
  }
  return Math.max(
    particleRadius,
    displayToEffectCoord(sample.radius * config.pushRadiusScale, displayWidth, effectWidth),
  );
}

/** Keep displaced edge pixels from staying dark when push/black effects widen the disc. */
function overlayAlpha(sampleAlpha: number, distance: number, radius: number, pushEnabled: boolean): number {
  const core = sampleAlpha * falloff(distance, radius);
  if (!pushEnabled || core <= 0) {
    return core;
  }
  const rim = sampleAlpha * 0.45 * falloff(distance, radius);
  return Math.max(core, rim);
}

function seededUnit(seed: number, salt: number): number {
  const x = Math.sin(seed * 12.9898 + salt * 78.233) * 43758.5453;
  return x - Math.floor(x);
}

function mergeBounds(
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

export function mergeCursorTrailPixelBounds(
  a: CursorTrailPixelBounds,
  b: CursorTrailPixelBounds,
): CursorTrailPixelBounds {
  return {
    dirtyMinX: Math.min(a.dirtyMinX, b.dirtyMinX),
    dirtyMinY: Math.min(a.dirtyMinY, b.dirtyMinY),
    dirtyMaxX: Math.max(a.dirtyMaxX, b.dirtyMaxX),
    dirtyMaxY: Math.max(a.dirtyMaxY, b.dirtyMaxY),
  };
}

export function resolveCursorTrailRebuildBounds(
  current: CursorTrailPixelBounds | null,
  previous: CursorTrailPixelBounds | null,
): CursorTrailPixelBounds | null {
  if (current && previous) {
    return mergeCursorTrailPixelBounds(current, previous);
  }
  return current ?? previous;
}

function pushCenterForDrop(drop: CursorTrailDrop, config: PlaygroundCursorTrailConfig): CursorTrailPoint {
  const speed = Math.hypot(drop.vx, drop.vy);
  const lagX = speed > 0 ? (-drop.vx / speed) * config.pushLagPx : 0;
  const lagY = speed > 0 ? (-drop.vy / speed) * config.pushLagPx : 0;
  const wobbleX = Math.cos(drop.seed * 1.37 + drop.ageMs * 0.01) * config.pushWobblePx;
  const wobbleY = Math.sin(drop.seed * 1.91 + drop.ageMs * 0.012) * config.pushWobblePx;
  return {
    x: drop.x + lagX + wobbleX,
    y: drop.y + lagY + wobbleY,
  };
}

function emitParticle(
  state: CursorTrailState,
  point: CursorTrailPoint,
  emitterVelocity: CursorTrailPoint,
  speed: number,
  config: PlaygroundCursorTrailConfig,
): CursorTrailDrop {
  const seed = state.nextSeed++;
  const angle = seededUnit(seed, 1) * Math.PI * 2;
  const spread = config.spreadMinPx + seededUnit(seed, 2) * (config.spreadMaxPx - config.spreadMinPx);
  const tangent = speed > 0 ? { x: -emitterVelocity.y / speed, y: emitterVelocity.x / speed } : { x: 0, y: 0 };
  const side = seededUnit(seed, 3) * 2 - 1;
  return {
    x: point.x + Math.cos(angle) * spread,
    y: point.y + Math.sin(angle) * spread,
    vx: emitterVelocity.x * config.particleVelocityScale + tangent.x * side * config.particleTangentVelocity,
    vy: emitterVelocity.y * config.particleVelocityScale + tangent.y * side * config.particleTangentVelocity,
    ageMs: 0,
    lifeMs: config.particleLifeMs + seededUnit(seed, 4) * config.particleLifeJitterMs,
    radius: config.particleRadius * (0.75 + seededUnit(seed, 5) * 0.8),
    spin: (seededUnit(seed, 6) * 2 - 1) * config.spinStrength,
    seed,
  };
}

function displayToEffectCoord(value: number, displaySize: number, effectSize: number): number {
  return displaySize > 0 ? (value * effectSize) / displaySize : value;
}

function effectToDisplayCoord(value: number, effectSize: number, displaySize: number): number {
  return effectSize > 0 ? (value * displaySize) / effectSize : value;
}

export function createCursorTrailState(): CursorTrailState {
  return {
    current: { x: 0, y: 0 },
    velocity: { x: 0, y: 0 },
    target: null,
    drops: [],
    hasPointer: false,
    clearFramesRemaining: 0,
    emitRemainder: 0,
    lastEmit: null,
    nextSeed: 1,
  };
}

export function setCursorTrailTarget(state: CursorTrailState, target: CursorTrailPoint | null): void {
  state.target = target;
  if (!target) {
    state.hasPointer = false;
    return;
  }

  if (!state.hasPointer) {
    state.current = { ...target };
    state.velocity = { x: 0, y: 0 };
    state.lastEmit = { ...target };
  }
  state.hasPointer = true;
}

export function updateCursorTrail(
  state: CursorTrailState,
  dtMs: number,
  rawConfig: PlaygroundCursorTrailConfig = DEFAULT_PLAYGROUND_CURSOR_TRAIL_CONFIG,
): { samples: CursorTrailSample[]; changed: boolean } {
  const config = normalizePlaygroundCursorTrailConfig(rawConfig);
  const dt = Math.max(0, Math.min(MAX_DT_MS, dtMs || 16.67));
  const hadDrops = state.drops.length > 0;
  const dtScale = dt / 16.67;

  if (!config.enabled) {
    state.drops = [];
    state.emitRemainder = 0;
    if (hadDrops) {
      state.clearFramesRemaining = CLEAR_REBUILD_FRAMES;
    }
    const isClearing = state.clearFramesRemaining > 0;
    if (isClearing) {
      state.clearFramesRemaining--;
    }
    return { samples: [], changed: isClearing };
  }

  if (state.target) {
    const previousCurrent = state.current;
    state.current = { ...state.target };
    const rawVelocity = {
      x: (state.current.x - previousCurrent.x) / dtScale,
      y: (state.current.y - previousCurrent.y) / dtScale,
    };
    state.velocity = {
      x: state.velocity.x * config.emitterVelocitySmoothing + rawVelocity.x * (1 - config.emitterVelocitySmoothing),
      y: state.velocity.y * config.emitterVelocitySmoothing + rawVelocity.y * (1 - config.emitterVelocitySmoothing),
    };
    const speed = Math.hypot(state.velocity.x, state.velocity.y);
    const previous = state.lastEmit ?? state.current;
    const distance = Math.hypot(state.current.x - previous.x, state.current.y - previous.y);
    const emitCount = Math.min(
      config.maxEmitPerTick,
      Math.floor(distance / config.particleSpacingPx + state.emitRemainder) + 1,
    );
    state.emitRemainder = (distance / config.particleSpacingPx + state.emitRemainder) % 1;

    for (let i = 0; i < emitCount; i++) {
      const t = emitCount <= 1 ? 1 : i / (emitCount - 1);
      const point = {
        x: previous.x + (state.current.x - previous.x) * t,
        y: previous.y + (state.current.y - previous.y) * t,
      };
      state.drops.push(emitParticle(state, point, state.velocity, speed, config));
    }
    state.lastEmit = { ...state.current };
  }

  const samples: CursorTrailSample[] = [];
  const nextDrops: CursorTrailDrop[] = [];
  for (const drop of state.drops) {
    const ageMs = drop.ageMs + dt;
    if (ageMs >= drop.lifeMs) {
      continue;
    }

    const life = 1 - ageMs / drop.lifeMs;
    const curl = Math.sin(drop.x * 0.017 + drop.y * 0.013 + drop.seed) * drop.spin * dtScale;
    const nextVx = (drop.vx - drop.vy * curl) * config.particleDamping;
    const nextVy = (drop.vy + drop.vx * curl) * config.particleDamping;
    const next = {
      ...drop,
      ageMs,
      vx: nextVx,
      vy: nextVy,
      x: drop.x + nextVx * dtScale,
      y: drop.y + nextVy * dtScale,
    };
    const pushCenter = pushCenterForDrop(next, config);
    nextDrops.push(next);
    samples.push({
      x: next.x,
      y: next.y,
      pushX: pushCenter.x,
      pushY: pushCenter.y,
      radius: next.radius * (config.densityRadiusMinScale + life * config.densityRadiusLifeScale),
      alpha: config.particleAlpha * life * life,
    });
  }
  state.drops = nextDrops;

  if (hadDrops && nextDrops.length === 0) {
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

export function downsamplePixelsNearest(
  source: Uint8ClampedArray,
  sourceWidth: number,
  sourceHeight: number,
  target: Uint8ClampedArray,
  targetWidth: number,
  targetHeight: number,
): void {
  for (let y = 0; y < targetHeight; y++) {
    const sourceY = Math.min(sourceHeight - 1, Math.floor((y * sourceHeight) / targetHeight));
    for (let x = 0; x < targetWidth; x++) {
      const sourceX = Math.min(sourceWidth - 1, Math.floor((x * sourceWidth) / targetWidth));
      const sourceIdx = (sourceY * sourceWidth + sourceX) * 4;
      const targetIdx = (y * targetWidth + x) * 4;
      target[targetIdx] = source[sourceIdx] ?? 0;
      target[targetIdx + 1] = source[sourceIdx + 1] ?? 0;
      target[targetIdx + 2] = source[sourceIdx + 2] ?? 0;
      target[targetIdx + 3] = source[sourceIdx + 3] ?? 255;
    }
  }
}

export function upscalePixelsNearest(
  source: Uint8ClampedArray,
  sourceWidth: number,
  sourceHeight: number,
  target: Uint8ClampedArray,
  targetWidth: number,
  targetHeight: number,
): void {
  for (let y = 0; y < targetHeight; y++) {
    const sourceY = Math.min(sourceHeight - 1, Math.floor((y * sourceHeight) / targetHeight));
    for (let x = 0; x < targetWidth; x++) {
      const sourceX = Math.min(sourceWidth - 1, Math.floor((x * sourceWidth) / targetWidth));
      const sourceIdx = (sourceY * sourceWidth + sourceX) * 4;
      const targetIdx = (y * targetWidth + x) * 4;
      target[targetIdx] = source[sourceIdx] ?? 0;
      target[targetIdx + 1] = source[sourceIdx + 1] ?? 0;
      target[targetIdx + 2] = source[sourceIdx + 2] ?? 0;
      target[targetIdx + 3] = source[sourceIdx + 3] ?? 255;
    }
  }
}

export function applyCursorTrailToEffectPixels(
  pixels: Uint8ClampedArray,
  effectWidth: number,
  effectHeight: number,
  displayWidth: number,
  displayHeight: number,
  samples: readonly CursorTrailSample[],
  rawConfig: PlaygroundCursorTrailConfig = DEFAULT_PLAYGROUND_CURSOR_TRAIL_CONFIG,
  luminanceSettings?: TextureLuminanceSettings,
): CursorTrailPixelBounds | null {
  const config = normalizePlaygroundCursorTrailConfig(rawConfig);
  if (!config.enabled || effectWidth <= 0 || effectHeight <= 0 || samples.length === 0) {
    return null;
  }

  const colorsMode = normalizeTextureLuminanceMode(luminanceSettings?.mode) === "colors";
  const backgroundColor = luminanceSettings?.backgroundColor ?? DEFAULT_TEXTURE_LUMINANCE_BACKGROUND_COLOR;
  const maxSearchRadius = Math.max(effectWidth, effectHeight);

  const source = new Uint8ClampedArray(pixels);
  const pixelCount = effectWidth * effectHeight;
  const offsetX = new Float32Array(pixelCount);
  const offsetY = new Float32Array(pixelCount);

  let bounds: CursorTrailPixelBounds = {
    dirtyMinX: displayWidth,
    dirtyMinY: displayHeight,
    dirtyMaxX: -1,
    dirtyMaxY: -1,
  };

  const pushScale = config.pushStrengthPx * (effectWidth / Math.max(1, displayWidth));
  const pushEnabled = config.pushStrengthPx > 0 || config.pushLeadBlackAlpha > 0;
  const toDisplayX = (effectX: number) => effectToDisplayCoord(effectX, effectWidth, displayWidth);
  const toDisplayY = (effectY: number) => effectToDisplayCoord(effectY, effectHeight, displayHeight);

  if (config.pushLeadBlackAlpha > 0) {
    for (const sample of samples) {
      const alpha = clamp01(sample.alpha);
      if (alpha <= 0) {
        continue;
      }

      const centerX = displayToEffectCoord(sample.x, displayWidth, effectWidth);
      const centerY = displayToEffectCoord(sample.y, displayHeight, effectHeight);
      const pushRadius = resolveTrailSampleRadius(sample, config, displayWidth, effectWidth);
      if (pushRadius <= 0) {
        continue;
      }

      bounds = applyPushLeadBlackShellOnEffectPixels(
        pixels,
        effectWidth,
        effectHeight,
        centerX,
        centerY,
        pushRadius,
        0.74,
        config.pushLeadBlackAlpha * alpha,
        bounds,
        toDisplayX,
        toDisplayY,
      );
    }
  }

  if (config.pushStrengthPx > 0) {
    for (const sample of samples) {
      const alpha = clamp01(sample.alpha);
      if (alpha <= 0) {
        continue;
      }

      const centerX = displayToEffectCoord(sample.x, displayWidth, effectWidth);
      const centerY = displayToEffectCoord(sample.y, displayHeight, effectHeight);
      const pushRadius = resolveTrailSampleRadius(sample, config, displayWidth, effectWidth);
      if (pushRadius <= 0) {
        continue;
      }

      const minX = Math.max(0, Math.floor(centerX - pushRadius));
      const maxX = Math.min(effectWidth - 1, Math.ceil(centerX + pushRadius));
      const minY = Math.max(0, Math.floor(centerY - pushRadius));
      const maxY = Math.min(effectHeight - 1, Math.ceil(centerY + pushRadius));

      bounds = mergeBounds(
        bounds,
        effectToDisplayCoord(minX, effectWidth, displayWidth),
        effectToDisplayCoord(maxX, effectWidth, displayWidth),
        effectToDisplayCoord(minY, effectHeight, displayHeight),
        effectToDisplayCoord(maxY, effectHeight, displayHeight),
      );

      for (let y = minY; y <= maxY; y++) {
        for (let x = minX; x <= maxX; x++) {
          const dx = x - centerX;
          const dy = y - centerY;
          const distance = Math.hypot(dx, dy);
          if (distance <= 0 || distance >= pushRadius) {
            continue;
          }

          const force = pushScale * alpha * falloff(distance, pushRadius);
          const idx = y * effectWidth + x;
          offsetX[idx] += (dx / distance) * force;
          offsetY[idx] += (dy / distance) * force;
        }
      }
    }

    for (let idx = 0; idx < pixelCount; idx++) {
      const dx = offsetX[idx] ?? 0;
      const dy = offsetY[idx] ?? 0;
      if (Math.abs(dx) < 0.01 && Math.abs(dy) < 0.01) {
        continue;
      }

      const x = idx % effectWidth;
      const y = Math.floor(idx / effectWidth);
      const sourceX = clampInt(x - dx, 0, effectWidth - 1);
      const sourceY = clampInt(y - dy, 0, effectHeight - 1);
      const sourceIdx = (sourceY * effectWidth + sourceX) * 4;
      const pixelIdx = idx * 4;
      pixels[pixelIdx] = source[sourceIdx] ?? 0;
      pixels[pixelIdx + 1] = source[sourceIdx + 1] ?? 0;
      pixels[pixelIdx + 2] = source[sourceIdx + 2] ?? 0;
      pixels[pixelIdx + 3] = source[sourceIdx + 3] ?? 255;
    }
  }

  for (const sample of samples) {
    const alpha = clamp01(sample.alpha);
    if (alpha <= 0) {
      continue;
    }

    const centerX = displayToEffectCoord(sample.x, displayWidth, effectWidth);
    const centerY = displayToEffectCoord(sample.y, displayHeight, effectHeight);
    const effectRadius = resolveTrailSampleRadius(sample, config, displayWidth, effectWidth);
    if (effectRadius <= 0) {
      continue;
    }

    const minX = Math.max(0, Math.floor(centerX - effectRadius));
    const maxX = Math.min(effectWidth - 1, Math.ceil(centerX + effectRadius));
    const minY = Math.max(0, Math.floor(centerY - effectRadius));
    const maxY = Math.min(effectHeight - 1, Math.ceil(centerY + effectRadius));

    bounds = mergeBounds(
      bounds,
      effectToDisplayCoord(minX, effectWidth, displayWidth),
      effectToDisplayCoord(maxX, effectWidth, displayWidth),
      effectToDisplayCoord(minY, effectHeight, displayHeight),
      effectToDisplayCoord(maxY, effectHeight, displayHeight),
    );

    const sampleColor = colorsMode
      ? resolveColorsModeTrailRgb(source, effectWidth, effectHeight, centerX, centerY, backgroundColor, maxSearchRadius)
      : null;
    const brightSample = sampleColor ? brightenRgbPreservingHue(sampleColor.r, sampleColor.g, sampleColor.b) : null;

    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        const distance = Math.hypot(x - centerX, y - centerY);
        const pixelAlpha = overlayAlpha(alpha, distance, effectRadius, pushEnabled);
        if (pixelAlpha <= 0) {
          continue;
        }

        const idx = (y * effectWidth + x) * 4;
        if (colorsMode) {
          if (!brightSample) {
            continue;
          }
          pixels[idx] = blendChannelToward(pixels[idx] ?? 0, brightSample.r, pixelAlpha);
          pixels[idx + 1] = blendChannelToward(pixels[idx + 1] ?? 0, brightSample.g, pixelAlpha);
          pixels[idx + 2] = blendChannelToward(pixels[idx + 2] ?? 0, brightSample.b, pixelAlpha);
        } else {
          pixels[idx] = blendChannel(pixels[idx] ?? 0, pixelAlpha);
          pixels[idx + 1] = blendChannel(pixels[idx + 1] ?? 0, pixelAlpha);
          pixels[idx + 2] = blendChannel(pixels[idx + 2] ?? 0, pixelAlpha);
        }
      }
    }
  }

  return bounds.dirtyMaxX >= 0 ? bounds : null;
}

export function buildDisplayFrameWithCursorTrail(
  cachedEffectBase: Uint8ClampedArray,
  effectWidth: number,
  effectHeight: number,
  displayWidth: number,
  displayHeight: number,
  samples: readonly CursorTrailSample[],
  config: PlaygroundCursorTrailConfig,
  workingEffect?: Uint8ClampedArray,
  displayPixels?: Uint8ClampedArray,
  luminanceSettings?: TextureLuminanceSettings,
): { data: Uint8ClampedArray; bounds: CursorTrailPixelBounds | null } {
  const effect = workingEffect ?? new Uint8ClampedArray(cachedEffectBase);
  if (effect !== cachedEffectBase) {
    effect.set(cachedEffectBase);
  }

  const bounds =
    samples.length > 0
      ? applyCursorTrailToEffectPixels(
          effect,
          effectWidth,
          effectHeight,
          displayWidth,
          displayHeight,
          samples,
          config,
          luminanceSettings,
        )
      : null;

  const output = displayPixels ?? new Uint8ClampedArray(displayWidth * displayHeight * 4);
  upscalePixelsNearest(effect, effectWidth, effectHeight, output, displayWidth, displayHeight);
  return { data: output, bounds };
}
