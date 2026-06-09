import {
  mergeCursorTrailPixelBounds,
  type CursorTrailPixelBounds,
} from "./cursorTrail";
import {
  DEFAULT_PLAYGROUND_CLICK_WAVE_CONFIG,
  normalizePlaygroundClickWaveConfig,
  type PlaygroundClickWaveConfig,
} from "./playgroundClickWaveConfig";

export type ClickWavePoint = {
  x: number;
  y: number;
};

export type ClickWaveSample = ClickWavePoint & {
  radius: number;
  strokeWidth: number;
  /** 0 at birth, 1 when the ripple finishes. */
  waveProgress: number;
  /** Radial push strength for this frame (display px), strongest at birth. */
  pushPower: number;
  /** Subtle white brighten on the ring; fades slower than push. */
  whitePower: number;
  /** Life-based multiplier for interior slice whites (independent of ring white). */
  sliceWhitePower: number;
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

function clampInt(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Math.round(value)));
}

function blendChannel(channel: number, alpha: number): number {
  return Math.round(channel + (255 - channel) * alpha);
}

function seededUnit(seed: number, salt: number): number {
  const x = Math.sin(seed * 12.9898 + salt * 78.233) * 43758.5453;
  return x - Math.floor(x);
}

function ringFalloff(distanceFromRing: number, halfStroke: number): number {
  if (halfStroke <= 0 || distanceFromRing >= halfStroke) {
    return 0;
  }
  const t = 1 - distanceFromRing / halfStroke;
  return t * t * (3 - 2 * t);
}

function easeOutQuad(progress: number): number {
  const t = clamp01(progress);
  return 1 - (1 - t) * (1 - t);
}

/** Ring white: strong at click birth, cools as the ripple expands. */
function computeRingWhiteFalloff(progress: number, eased: number): number {
  const life = 1 - progress;
  const birthBoost = 1.35 - 0.35 * eased;
  return life * life * birthBoost;
}

/** Slice white: hotter than the ring at birth, fades faster with expansion progress. */
function computeSliceWhitePower(progress: number, eased: number): number {
  const life = 1 - progress;
  const birthBoost = 1.9 - 0.9 * eased;
  return life * life * birthBoost;
}

function displayToEffectCoord(value: number, displaySize: number, effectSize: number): number {
  return displaySize > 0 ? (value * effectSize) / displaySize : value;
}

function effectToDisplayCoord(value: number, effectSize: number, displaySize: number): number {
  return effectSize > 0 ? (value * displaySize) / effectSize : value;
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

export type ClickWaveGridContext = {
  gridCellWidth: number;
  gridCellHeight: number;
};

type WaveCellGrid = {
  cols: number;
  rows: number;
  cellWidth: number;
  cellHeight: number;
  effectCellW: number;
  effectCellH: number;
};

function resolveWaveCellGrid(
  displayWidth: number,
  displayHeight: number,
  grid: ClickWaveGridContext,
  effectWidth: number,
  effectHeight: number,
): WaveCellGrid {
  const cellWidth = Math.max(1, grid.gridCellWidth);
  const cellHeight = Math.max(1, grid.gridCellHeight);
  const cols = Math.max(1, Math.ceil(displayWidth / cellWidth));
  const rows = Math.max(1, Math.ceil(displayHeight / cellHeight));
  return {
    cols,
    rows,
    cellWidth,
    cellHeight,
    effectCellW: effectWidth / cols,
    effectCellH: effectHeight / rows,
  };
}

function displayCellOverlapsDisk(
  col: number,
  row: number,
  cellGrid: WaveCellGrid,
  centerX: number,
  centerY: number,
  radius: number,
): boolean {
  const left = col * cellGrid.cellWidth;
  const top = row * cellGrid.cellHeight;
  const closestX = Math.max(left, Math.min(centerX, left + cellGrid.cellWidth));
  const closestY = Math.max(top, Math.min(centerY, top + cellGrid.cellHeight));
  return Math.hypot(closestX - centerX, closestY - centerY) <= radius;
}

function displayCellIntersectsRing(
  col: number,
  row: number,
  cellGrid: WaveCellGrid,
  centerX: number,
  centerY: number,
  radius: number,
  halfStroke: number,
): boolean {
  const left = col * cellGrid.cellWidth;
  const top = row * cellGrid.cellHeight;
  const right = left + cellGrid.cellWidth;
  const bottom = top + cellGrid.cellHeight;
  const probeX = [left, right, (left + right) * 0.5];
  const probeY = [top, bottom, (top + bottom) * 0.5];
  for (const x of probeX) {
    for (const y of probeY) {
      const distance = Math.hypot(x - centerX, y - centerY);
      if (Math.abs(distance - radius) <= halfStroke) {
        return true;
      }
    }
  }
  return false;
}

function fillEffectCellBlock(
  pixels: Uint8ClampedArray,
  effectWidth: number,
  effectHeight: number,
  col: number,
  row: number,
  cellGrid: WaveCellGrid,
  alpha: number,
): void {
  if (alpha <= 0) {
    return;
  }

  const x0 = Math.max(0, Math.floor(col * cellGrid.effectCellW));
  const y0 = Math.max(0, Math.floor(row * cellGrid.effectCellH));
  const x1 = Math.min(effectWidth - 1, Math.max(x0, Math.ceil((col + 1) * cellGrid.effectCellW) - 1));
  const y1 = Math.min(effectHeight - 1, Math.max(y0, Math.ceil((row + 1) * cellGrid.effectCellH) - 1));

  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const idx = (y * effectWidth + x) * 4;
      pixels[idx] = blendChannel(pixels[idx] ?? 0, alpha);
      pixels[idx + 1] = blendChannel(pixels[idx + 1] ?? 0, alpha);
      pixels[idx + 2] = blendChannel(pixels[idx + 2] ?? 0, alpha);
    }
  }
}

function mergeCellBounds(
  bounds: CursorTrailPixelBounds,
  col: number,
  row: number,
  cellGrid: WaveCellGrid,
): CursorTrailPixelBounds {
  const minX = col * cellGrid.cellWidth;
  const minY = row * cellGrid.cellHeight;
  return mergeBounds(bounds, minX, minX + cellGrid.cellWidth, minY, minY + cellGrid.cellHeight);
}

function resolveSliceCellAlpha(
  sample: ClickWaveSample,
  config: PlaygroundClickWaveConfig,
  cellGrid: WaveCellGrid,
  col: number,
  row: number,
  centerX: number,
  centerY: number,
  radius: number,
): number {
  const cellCenterX = (col + 0.5) * cellGrid.cellWidth;
  const cellCenterY = (row + 0.5) * cellGrid.cellHeight;
  const dx = cellCenterX - centerX;
  const dy = cellCenterY - centerY;
  const distance = Math.hypot(dx, dy);

  const sliceSpan = Math.max(0, config.sliceCountMax - config.sliceCountMin);
  const sliceCount = config.sliceCountMin + Math.floor(seededUnit(sample.seed, 1) * (sliceSpan + 1));
  const sliceRotation = seededUnit(sample.seed, 3) * Math.PI * 2;
  const angle = Math.atan2(dy, dx) + sliceRotation;
  const sliceIdx =
    ((Math.floor(((angle + Math.PI) / (Math.PI * 2)) * sliceCount) % sliceCount) + sliceCount) % sliceCount;

  const skipSpan = Math.max(0, config.sliceSkipMax - config.sliceSkipMin);
  const skipChance = config.sliceSkipMin + seededUnit(sample.seed, 4) * skipSpan;
  const cellPick = seededUnit(sample.seed, col * 19.7 + row * 53.1 + sliceIdx * 7);
  if (cellPick < skipChance) {
    return 0;
  }

  const levelSpan = Math.max(0, config.sliceLevelMax - config.sliceLevelMin);
  const levelCount = config.sliceLevelMin + Math.floor(seededUnit(sample.seed, 8) * (levelSpan + 1));
  const sliceAmount = seededUnit(sample.seed, sliceIdx + 2);
  const cellAmount = seededUnit(sample.seed, col * 13 + row * 29 + 600);
  const bandCount = 4 + Math.floor(seededUnit(sample.seed, 9) * 5);
  const bandIdx = Math.min(bandCount - 1, Math.floor((distance / Math.max(radius, 1)) * bandCount));
  const bandAmount = seededUnit(sample.seed, sliceIdx * 41 + bandIdx + 700);
  const patchAmount = seededUnit(sample.seed, col * 7 + row * 23 + sliceIdx * 11 + 900);
  const mixed = sliceAmount * 0.28 + cellAmount * 0.24 + bandAmount * 0.24 + patchAmount * 0.24;
  const level = (2 + Math.floor(mixed * levelCount)) / (levelCount + 2);
  const radialMin = 0.78 - 0.2 * sample.waveProgress;
  const radialFade = radius > 0 ? radialMin + (1 - radialMin) * (distance / radius) : 1;

  return Math.min(1, sample.sliceWhitePower * config.sliceWhiteAlpha * level * radialFade);
}

function applyWaveRingCellWhites(
  pixels: Uint8ClampedArray,
  effectWidth: number,
  effectHeight: number,
  sample: ClickWaveSample,
  config: PlaygroundClickWaveConfig,
  cellGrid: WaveCellGrid,
  bounds: CursorTrailPixelBounds,
): CursorTrailPixelBounds {
  const whitePower = sample.whitePower;
  if (whitePower <= 0) {
    return bounds;
  }

  const centerX = sample.x;
  const centerY = sample.y;
  const radius = sample.radius;
  const halfStroke = sample.strokeWidth * 0.5;
  if (radius <= 0 || halfStroke <= 0) {
    return bounds;
  }

  let nextBounds = bounds;
  for (let row = 0; row < cellGrid.rows; row++) {
    for (let col = 0; col < cellGrid.cols; col++) {
      if (!displayCellIntersectsRing(col, row, cellGrid, centerX, centerY, radius, halfStroke)) {
        continue;
      }

      const cellCenterX = (col + 0.5) * cellGrid.cellWidth;
      const cellCenterY = (row + 0.5) * cellGrid.cellHeight;
      const distance = Math.hypot(cellCenterX - centerX, cellCenterY - centerY);
      const ringAlpha = whitePower * ringFalloff(Math.abs(distance - radius), halfStroke);
      if (ringAlpha <= 0) {
        continue;
      }

      nextBounds = mergeCellBounds(nextBounds, col, row, cellGrid);
      fillEffectCellBlock(pixels, effectWidth, effectHeight, col, row, cellGrid, ringAlpha);
    }
  }

  return nextBounds;
}

function applyWaveSliceCellWhites(
  pixels: Uint8ClampedArray,
  effectWidth: number,
  effectHeight: number,
  sample: ClickWaveSample,
  config: PlaygroundClickWaveConfig,
  cellGrid: WaveCellGrid,
  bounds: CursorTrailPixelBounds,
): CursorTrailPixelBounds {
  const whitePower = sample.whitePower;
  if (whitePower <= 0 || config.sliceWhiteAlpha <= 0 || sample.sliceWhitePower <= 0) {
    return bounds;
  }

  const centerX = sample.x;
  const centerY = sample.y;
  const radius = sample.radius;
  if (radius <= 0) {
    return bounds;
  }

  let nextBounds = bounds;
  for (let row = 0; row < cellGrid.rows; row++) {
    for (let col = 0; col < cellGrid.cols; col++) {
      if (!displayCellOverlapsDisk(col, row, cellGrid, centerX, centerY, radius)) {
        continue;
      }

      const cellAlpha = resolveSliceCellAlpha(
        sample,
        config,
        cellGrid,
        col,
        row,
        centerX,
        centerY,
        radius,
      );
      if (cellAlpha <= 0.015) {
        continue;
      }

      nextBounds = mergeCellBounds(nextBounds, col, row, cellGrid);
      fillEffectCellBlock(pixels, effectWidth, effectHeight, col, row, cellGrid, cellAlpha);
    }
  }

  return nextBounds;
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
  rawConfig: PlaygroundClickWaveConfig = DEFAULT_PLAYGROUND_CLICK_WAVE_CONFIG,
): { samples: ClickWaveSample[]; changed: boolean } {
  const config = normalizePlaygroundClickWaveConfig(rawConfig);
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
    const eased = easeOutQuad(progress);
    const radius = config.startRadiusPx + (config.maxRadiusPx - config.startRadiusPx) * eased;
    const strokeWidth =
      config.startStrokeWidthPx + (config.endStrokeWidthPx - config.startStrokeWidthPx) * progress;
    const life = 1 - progress;
    const pushFalloff = life * life * (3 - 2 * life);
    const ringWhiteFalloff = computeRingWhiteFalloff(progress, eased);
    const sliceWhitePower = computeSliceWhitePower(progress, eased);

    nextWaves.push({ ...wave, ageMs });
    samples.push({
      x: wave.x,
      y: wave.y,
      radius,
      strokeWidth: Math.max(config.endStrokeWidthPx, strokeWidth),
      waveProgress: progress,
      pushPower: config.pushStrengthPx * pushFalloff,
      whitePower: config.stripeWhiteAlpha * ringWhiteFalloff,
      sliceWhitePower,
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

export function applyClickWavesToEffectPixels(
  pixels: Uint8ClampedArray,
  effectWidth: number,
  effectHeight: number,
  displayWidth: number,
  displayHeight: number,
  samples: readonly ClickWaveSample[],
  rawConfig: PlaygroundClickWaveConfig = DEFAULT_PLAYGROUND_CLICK_WAVE_CONFIG,
  grid: ClickWaveGridContext,
): CursorTrailPixelBounds | null {
  const config = normalizePlaygroundClickWaveConfig(rawConfig);
  if (!config.enabled || effectWidth <= 0 || effectHeight <= 0 || samples.length === 0) {
    return null;
  }

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

  const effectPushScale = effectWidth / Math.max(1, displayWidth);
  const cellGrid = resolveWaveCellGrid(displayWidth, displayHeight, grid, effectWidth, effectHeight);

  for (const sample of samples) {
    const pushPower = sample.pushPower;
    if (pushPower <= 0) {
      continue;
    }

    const centerX = displayToEffectCoord(sample.x, displayWidth, effectWidth);
    const centerY = displayToEffectCoord(sample.y, displayHeight, effectHeight);
    const radius = Math.max(0, displayToEffectCoord(sample.radius, displayWidth, effectWidth));
    const halfStroke = Math.max(
      0.5,
      displayToEffectCoord(sample.strokeWidth, displayWidth, effectWidth) * 0.5 * config.pushBandScale,
    );
    if (radius <= 0 || halfStroke <= 0) {
      continue;
    }

    const reach = radius + halfStroke + 2;
    const minX = Math.max(0, Math.floor(centerX - reach));
    const maxX = Math.min(effectWidth - 1, Math.ceil(centerX + reach));
    const minY = Math.max(0, Math.floor(centerY - reach));
    const maxY = Math.min(effectHeight - 1, Math.ceil(centerY + reach));

    bounds = mergeBounds(
      bounds,
      effectToDisplayCoord(minX, effectWidth, displayWidth),
      effectToDisplayCoord(maxX, effectWidth, displayWidth),
      effectToDisplayCoord(minY, effectHeight, displayHeight),
      effectToDisplayCoord(maxY, effectHeight, displayHeight),
    );

    const pushScale = pushPower * effectPushScale;

    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        const dx = x - centerX;
        const dy = y - centerY;
        const distance = Math.hypot(dx, dy);
        if (distance <= 0) {
          continue;
        }

        const ringStrength = ringFalloff(Math.abs(distance - radius), halfStroke);
        if (ringStrength <= 0) {
          continue;
        }

        const force = pushScale * ringStrength;
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

  for (const sample of samples) {
    const whitePower = sample.whitePower;
    if (whitePower <= 0) {
      continue;
    }

    bounds = applyWaveRingCellWhites(
      pixels,
      effectWidth,
      effectHeight,
      sample,
      config,
      cellGrid,
      bounds,
    );
    bounds = applyWaveSliceCellWhites(
      pixels,
      effectWidth,
      effectHeight,
      sample,
      config,
      cellGrid,
      bounds,
    );
  }

  return bounds.dirtyMaxX >= 0 ? bounds : null;
}

export function mergePointerEffectBounds(
  a: CursorTrailPixelBounds | null,
  b: CursorTrailPixelBounds | null,
): CursorTrailPixelBounds | null {
  if (a && b) {
    return mergeCursorTrailPixelBounds(a, b);
  }
  return a ?? b;
}
