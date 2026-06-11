import { BufferImageSource, Texture } from "pixi.js";
import {
  COLOR_SATURATION_EPSILON,
  colorPixelPresence,
  DEFAULT_TEXTURE_LUMINANCE_BACKGROUND_COLOR,
  isNonBackgroundColorPixel,
  normalizeTextureLuminanceMode,
  pixelSaturation,
  type TextureLuminanceSettings,
} from "./colorWhiteness";
import { normalizePlaygroundCursorTrailConfig, type PlaygroundCursorTrailConfig } from "./playgroundCursorTrailConfig";
import type { CursorTrailSample } from "./cursorTrail";

export type CursorTrailCellMap = {
  cols: number;
  rows: number;
  whiteAlpha: Float32Array;
  pushX: Float32Array;
  pushY: Float32Array;
  /** 0..1 — positive divergence of the push field: where the source is stretched apart. */
  tear: Float32Array;
  color: Uint8Array;
  pushRange: number;
  nonEmpty: boolean;
};

/** Displacement cap in cell units so overlapping particles compound into a bounded shove. */
export const CURSOR_TRAIL_MAX_PUSH_CELLS = 2;

/** How aggressively positive divergence of the push field tears content toward background. */
export const CURSOR_TRAIL_TEAR_GAIN = 0.6;

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function falloff(distance: number, radius: number): number {
  if (radius <= 0 || distance >= radius) {
    return 0;
  }
  const t = 1 - distance / radius;
  return t * t * (3 - 2 * t);
}

function displayToEffectCoord(value: number, displaySize: number, effectSize: number): number {
  return displaySize > 0 ? (value * effectSize) / displaySize : value;
}

function resolveTrailBrightenRadiusCell(sample: CursorTrailSample, displayWidth: number, cols: number): number {
  return Math.max(1, displayToEffectCoord(sample.radius, displayWidth, cols));
}

// Push reaches beyond the bright core so the displacement ring stays visible around it.
function resolveTrailPushRadiusCell(
  sample: CursorTrailSample,
  config: PlaygroundCursorTrailConfig,
  displayWidth: number,
  cols: number,
): number {
  return Math.max(1, displayToEffectCoord(sample.radius * config.pushRadiusScale, displayWidth, cols));
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

function forRingCells(
  originX: number,
  originY: number,
  ring: number,
  cols: number,
  rows: number,
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
      if (x < 0 || y < 0 || x >= cols || y >= rows) {
        continue;
      }
      visit(x, y);
    }
  }
}

function resolveColorsModeTrailRgbCell(
  cellColors: Uint8Array,
  cols: number,
  rows: number,
  centerX: number,
  centerY: number,
  backgroundColor: number,
  maxRadius: number,
): { r: number; g: number; b: number } | null {
  const originX = Math.min(cols - 1, Math.max(0, Math.round(centerX)));
  const originY = Math.min(rows - 1, Math.max(0, Math.round(centerY)));

  for (let ring = 0; ring <= maxRadius; ring++) {
    let bestPresence = -1;
    let bestR = 0;
    let bestG = 0;
    let bestB = 0;
    let found = false;

    forRingCells(originX, originY, ring, cols, rows, (x, y) => {
      const idx = (y * cols + x) * 3;
      const r = cellColors[idx] ?? 0;
      const g = cellColors[idx + 1] ?? 0;
      const b = cellColors[idx + 2] ?? 0;
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

export function applyCursorTrailCell(storedLuma: number, whiteAlpha: number, inverted: boolean): number {
  return inverted ? storedLuma * (1 - whiteAlpha) : storedLuma + (1 - storedLuma) * whiteAlpha;
}

export function rasterizeCursorTrailCellMap(
  samples: readonly CursorTrailSample[],
  rawConfig: PlaygroundCursorTrailConfig,
  displayWidth: number,
  displayHeight: number,
  cols: number,
  rows: number,
  luminanceSettings: TextureLuminanceSettings | undefined,
  cellColors: Uint8Array | undefined,
  out?: CursorTrailCellMap,
): CursorTrailCellMap {
  const config = normalizePlaygroundCursorTrailConfig(rawConfig);
  const cellCount = cols * rows;

  let result: CursorTrailCellMap;
  if (out && out.cols === cols && out.rows === rows) {
    result = out;
    result.whiteAlpha.fill(0);
    result.pushX.fill(0);
    result.pushY.fill(0);
    result.tear.fill(0);
    result.color.fill(255);
    result.pushRange = 0;
    result.nonEmpty = false;
  } else {
    result = {
      cols,
      rows,
      whiteAlpha: new Float32Array(cellCount),
      pushX: new Float32Array(cellCount),
      pushY: new Float32Array(cellCount),
      tear: new Float32Array(cellCount),
      color: new Uint8Array(cellCount * 3).fill(255),
      pushRange: 0,
      nonEmpty: false,
    };
  }

  if (!config.enabled || cols <= 0 || rows <= 0 || samples.length === 0) {
    return result;
  }

  const colorsMode = normalizeTextureLuminanceMode(luminanceSettings?.mode) === "colors";
  const backgroundColor = luminanceSettings?.backgroundColor ?? DEFAULT_TEXTURE_LUMINANCE_BACKGROUND_COLOR;
  const maxSearchRadius = Math.max(cols, rows);

  const pushScale = config.pushStrengthPx * (cols / Math.max(1, displayWidth));
  // Strongest contribution wins per cell, approximating the CPU path's sequential color blending.
  const colorStrength = colorsMode ? new Float32Array(cellCount) : null;

  for (const sample of samples) {
    const alpha = clamp01(sample.alpha);
    if (alpha <= 0) {
      continue;
    }

    const centerX = displayToEffectCoord(sample.x, displayWidth, cols);
    const centerY = displayToEffectCoord(sample.y, displayHeight, rows);
    const effectRadius = resolveTrailBrightenRadiusCell(sample, displayWidth, cols);
    if (effectRadius <= 0) {
      continue;
    }

    const minX = Math.max(0, Math.floor(centerX - effectRadius));
    const maxX = Math.min(cols - 1, Math.ceil(centerX + effectRadius));
    const minY = Math.max(0, Math.floor(centerY - effectRadius));
    const maxY = Math.min(rows - 1, Math.ceil(centerY + effectRadius));

    const sampleColorRaw =
      colorsMode && cellColors
        ? resolveColorsModeTrailRgbCell(cellColors, cols, rows, centerX, centerY, backgroundColor, maxSearchRadius)
        : null;
    const brightSample = sampleColorRaw
      ? brightenRgbPreservingHue(sampleColorRaw.r, sampleColorRaw.g, sampleColorRaw.b)
      : null;

    if (colorsMode && !brightSample) {
      continue;
    }

    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        const distance = Math.hypot(x - centerX, y - centerY);
        const fo = falloff(distance, effectRadius);
        if (fo <= 0) {
          continue;
        }
        const cellAlpha = alpha * fo;
        if (cellAlpha <= 0) {
          continue;
        }

        const cellIdx = y * cols + x;
        const prev = result.whiteAlpha[cellIdx] ?? 0;
        result.whiteAlpha[cellIdx] = prev + (1 - prev) * cellAlpha;

        if (brightSample && colorStrength && cellAlpha > (colorStrength[cellIdx] ?? 0)) {
          colorStrength[cellIdx] = cellAlpha;
          const colorIdx = cellIdx * 3;
          result.color[colorIdx] = brightSample.r;
          result.color[colorIdx + 1] = brightSample.g;
          result.color[colorIdx + 2] = brightSample.b;
        }

        result.nonEmpty = true;
      }
    }
  }

  if (config.pushStrengthPx > 0) {
    for (const sample of samples) {
      const alpha = clamp01(sample.alpha);
      if (alpha <= 0) {
        continue;
      }

      const centerX = displayToEffectCoord(sample.x, displayWidth, cols);
      const centerY = displayToEffectCoord(sample.y, displayHeight, rows);
      const pushRadius = resolveTrailPushRadiusCell(sample, config, displayWidth, cols);
      if (pushRadius <= 0) {
        continue;
      }

      const minX = Math.max(0, Math.floor(centerX - pushRadius));
      const maxX = Math.min(cols - 1, Math.ceil(centerX + pushRadius));
      const minY = Math.max(0, Math.floor(centerY - pushRadius));
      const maxY = Math.min(rows - 1, Math.ceil(centerY + pushRadius));

      for (let y = minY; y <= maxY; y++) {
        for (let x = minX; x <= maxX; x++) {
          const dx = x - centerX;
          const dy = y - centerY;
          const distance = Math.hypot(dx, dy);
          if (distance <= 0 || distance >= pushRadius) {
            continue;
          }
          const force = pushScale * alpha * falloff(distance, pushRadius);
          const cellIdx = y * cols + x;
          result.pushX[cellIdx] = (result.pushX[cellIdx] ?? 0) + (dx / distance) * force;
          result.pushY[cellIdx] = (result.pushY[cellIdx] ?? 0) + (dy / distance) * force;
          result.nonEmpty = true;
        }
      }
    }

    // Cap the accumulated offset at the configured push strength (and at the shader's
    // neighborhood-search reach) so overlapping particles compound into a bounded shove.
    const pushCap = Math.min(pushScale, CURSOR_TRAIL_MAX_PUSH_CELLS);
    let maxPush = 0;
    for (let i = 0; i < cellCount; i++) {
      let px = result.pushX[i] ?? 0;
      let py = result.pushY[i] ?? 0;
      const length = Math.hypot(px, py);
      if (length > pushCap && length > 0) {
        const scale = pushCap / length;
        px *= scale;
        py *= scale;
        result.pushX[i] = px;
        result.pushY[i] = py;
      }
      const ax = Math.abs(px);
      const ay = Math.abs(py);
      if (ax > maxPush) {
        maxPush = ax;
      }
      if (ay > maxPush) {
        maxPush = ay;
      }
    }
    result.pushRange = maxPush;

    // Tear = positive divergence of the push field (central differences): where the
    // displacement stretches the source apart, content thins toward background.
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        const i = y * cols + x;
        const left = x > 0 ? i - 1 : i;
        const right = x < cols - 1 ? i + 1 : i;
        const up = y > 0 ? i - cols : i;
        const down = y < rows - 1 ? i + cols : i;
        const spanX = (x > 0 ? 1 : 0) + (x < cols - 1 ? 1 : 0);
        const spanY = (y > 0 ? 1 : 0) + (y < rows - 1 ? 1 : 0);
        const divX = spanX > 0 ? ((result.pushX[right] ?? 0) - (result.pushX[left] ?? 0)) / spanX : 0;
        const divY = spanY > 0 ? ((result.pushY[down] ?? 0) - (result.pushY[up] ?? 0)) / spanY : 0;
        const divergence = divX + divY;
        if (divergence > 0) {
          result.tear[i] = Math.min(1, divergence * CURSOR_TRAIL_TEAR_GAIN);
        }
      }
    }
  } else {
    result.pushRange = 0;
  }

  if (!result.nonEmpty) {
    result.pushRange = 0;
  }

  return result;
}

export class CursorTrailOverlay {
  texture!: Texture;
  pushTexture!: Texture;
  private colorBuffer!: Uint8Array;
  private pushBuffer!: Uint8Array;
  private cols = 0;
  private rows = 0;

  constructor(cols: number, rows: number) {
    this.allocate(cols, rows);
  }

  /**
   * Raw byte-buffer textures: canvas-element uploads pass through the browser's image
   * pipeline (color-space conversion), which corrupts non-grayscale data texels —
   * buffer uploads are spec-guaranteed verbatim.
   */
  private allocate(cols: number, rows: number): void {
    const width = Math.max(1, cols);
    const height = Math.max(1, rows);
    this.colorBuffer = new Uint8Array(width * height * 4);
    this.pushBuffer = new Uint8Array(width * height * 4);
    this.texture = new Texture({
      source: new BufferImageSource({
        resource: this.colorBuffer,
        width,
        height,
        alphaMode: "no-premultiply-alpha",
        scaleMode: "nearest",
      }),
    });
    this.pushTexture = new Texture({
      source: new BufferImageSource({
        resource: this.pushBuffer,
        width,
        height,
        alphaMode: "no-premultiply-alpha",
        scaleMode: "nearest",
      }),
    });
    this.cols = cols;
    this.rows = rows;
  }

  resize(cols: number, rows: number): void {
    if (this.cols === cols && this.rows === rows) {
      return;
    }
    this.texture.destroy(true);
    this.pushTexture.destroy(true);
    this.allocate(cols, rows);
  }

  sync(map: CursorTrailCellMap): void {
    const { cols, rows } = map;
    if (cols !== this.cols || rows !== this.rows) {
      this.resize(cols, rows);
    }
    const cellCount = cols * rows;
    const cd = this.colorBuffer;
    const pd = this.pushBuffer;

    const pushRange = map.pushRange > 0 ? map.pushRange : 1;

    for (let i = 0; i < cellCount; i++) {
      const colorIdx = i * 4;
      const cellColorIdx = i * 3;

      cd[colorIdx] = map.color[cellColorIdx] ?? 255;
      cd[colorIdx + 1] = map.color[cellColorIdx + 1] ?? 255;
      cd[colorIdx + 2] = map.color[cellColorIdx + 2] ?? 255;
      cd[colorIdx + 3] = Math.round((map.whiteAlpha[i] ?? 0) * 255);

      const px = map.pushX[i] ?? 0;
      const py = map.pushY[i] ?? 0;
      // Byte 128 must decode to exactly zero offset, or every untouched cell reads as pushed.
      pd[colorIdx] = Math.max(0, Math.min(255, Math.round(128 + (px / pushRange) * 127)));
      pd[colorIdx + 1] = Math.max(0, Math.min(255, Math.round(128 + (py / pushRange) * 127)));
      pd[colorIdx + 2] = Math.round((map.tear[i] ?? 0) * 255);
      pd[colorIdx + 3] = 255;
    }

    this.texture.source.update();
    this.pushTexture.source.update();
  }

  destroy(): void {
    this.texture.destroy(true);
    this.pushTexture.destroy(true);
  }
}
