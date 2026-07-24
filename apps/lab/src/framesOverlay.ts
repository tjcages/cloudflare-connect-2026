import type { CellGridReadback, EngineConfig, Stripe } from "@necatikcl/stripes-engine";
import { cssColorForHex, p3ColorForHex } from "./components/colorLibrary";

export type FrameCell = {
  col: number;
  row: number;
};

export type FrameGroup = {
  cells: FrameCell[];
  peakLuminance: number;
  peakColor: number | null;
};

function fract(value: number): number {
  return value - Math.floor(value);
}

function sparkleHash(px: number, py: number): number {
  let p3x = fract(px * 0.1031);
  let p3y = fract(py * 0.103);
  let p3z = fract(px * 0.0973);
  const dotValue = p3x * (p3y + 33.33) + p3y * (p3z + 33.33) + p3z * (p3x + 33.33);
  p3x = fract(p3x + dotValue);
  p3y = fract(p3y + dotValue);
  p3z = fract(p3z + dotValue);
  return fract((p3x + p3y) * p3z);
}

function randomColumnMotionTarget(col: number, cycleIndex: number, staggerPx: number): number {
  const patternSeed = staggerPx * 0.61803398875;
  return sparkleHash(col + patternSeed + 307, cycleIndex + patternSeed + 401) * 2 - 1;
}

export function frameColumnMotionOffset(
  col: number,
  timeSec: number,
  motion: EngineConfig["sparkle"]["motion"],
): number {
  if (!motion.enabled || motion.amplitudePx <= 0 || motion.maxOffsetPx <= 0) return 0;
  const patternSeed = motion.staggerPx * 0.61803398875;
  const columnRate = 0.65 + sparkleHash(col + patternSeed + 89, patternSeed + 113) * 0.7;
  const columnPhase = sparkleHash(col + patternSeed + 179, patternSeed + 233) * 7;
  const randomTime = timeSec * Math.max(motion.speed, 0.05) * columnRate + columnPhase;
  const cycleIndex = Math.floor(randomTime);
  const cycleT = fract(randomTime);
  const easedT = cycleT * cycleT * (3 - 2 * cycleT);
  const from = randomColumnMotionTarget(col, cycleIndex, motion.staggerPx);
  const to = randomColumnMotionTarget(col, cycleIndex + 1, motion.staggerPx);
  const wave = from + (to - from) * easedT;
  return wave * Math.min(Math.max(motion.amplitudePx, 0), Math.max(motion.maxOffsetPx, 0));
}

export function buildFrameGroups(
  readback: CellGridReadback,
  luminanceThreshold: number,
  groupDistanceCells = 1,
  stripes: readonly Stripe[] = [],
  highlightedStripeCount = 3,
): FrameGroup[] {
  const { cols, rows, values, colors } = readback;
  const thresholdByte = Math.round(Math.max(0, Math.min(1, luminanceThreshold)) * 255);
  const groupDistance = Math.round(Math.max(0, Math.min(8, groupDistanceCells)));
  const sortedStripes = [...stripes].sort((a, b) => a.startFrom - b.startFrom);
  const highlightedBands = new Set(
    sortedStripes
      .map((stripe, band) => ({ stripe, band }))
      .filter(({ stripe }) => stripe.width >= 0.5 && stripe.opacity > 0.001)
      .sort((a, b) => b.stripe.startFrom - a.stripe.startFrom || b.band - a.band)
      .slice(0, Math.max(1, Math.round(highlightedStripeCount)))
      .map(({ band }) => band),
  );
  const active = new Uint8Array(cols * rows);
  const luminance = new Uint8Array(cols * rows);
  const displayColors = colors ? new Int32Array(cols * rows).fill(-1) : null;
  const isHighlightedStripe = (value: number) => {
    if (sortedStripes.length === 0) return true;
    const normalizedValue = value / 255;
    let band = -1;
    for (let index = 0; index < sortedStripes.length; index++) {
      if (sortedStripes[index].startFrom <= normalizedValue) band = index;
    }
    return highlightedBands.has(band);
  };

  for (let readbackRow = 0; readbackRow < rows; readbackRow++) {
    const displayRow = rows - 1 - readbackRow;
    for (let col = 0; col < cols; col++) {
      const readbackIndex = readbackRow * cols + col;
      const displayIndex = displayRow * cols + col;
      const value = values[readbackIndex] ?? 0;
      luminance[displayIndex] = value;
      if (value >= thresholdByte && isHighlightedStripe(value)) {
        active[displayIndex] = 1;
      }
      if (displayColors && colors) {
        const colorIndex = readbackIndex * 4;
        displayColors[displayIndex] =
          ((colors[colorIndex] ?? 0) << 16) | ((colors[colorIndex + 1] ?? 0) << 8) | (colors[colorIndex + 2] ?? 0);
      }
    }
  }

  const groups: FrameGroup[] = [];
  const queue: FrameCell[] = [];

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const startIndex = row * cols + col;
      if (active[startIndex] === 0) continue;
      active[startIndex] = 0;
      queue.length = 0;
      queue.push({ col, row });
      const cells: FrameCell[] = [];
      let peakByte = luminance[startIndex] ?? 0;
      let peakColor = displayColors ? displayColors[startIndex] : null;

      for (let cursor = 0; cursor < queue.length; cursor++) {
        const cell = queue[cursor];
        cells.push(cell);
        for (let rowOffset = -groupDistance; rowOffset <= groupDistance; rowOffset++) {
          for (let colOffset = -groupDistance; colOffset <= groupDistance; colOffset++) {
            if (rowOffset === 0 && colOffset === 0) continue;
            const nextCol = cell.col + colOffset;
            const nextRow = cell.row + rowOffset;
            if (nextCol < 0 || nextCol >= cols || nextRow < 0 || nextRow >= rows) continue;
            const nextIndex = nextRow * cols + nextCol;
            if (active[nextIndex] === 0) continue;
            active[nextIndex] = 0;
            const nextLuminance = luminance[nextIndex] ?? 0;
            if (nextLuminance > peakByte) {
              peakByte = nextLuminance;
              peakColor = displayColors ? displayColors[nextIndex] : null;
            }
            queue.push({ col: nextCol, row: nextRow });
          }
        }
      }

      groups.push({
        cells,
        peakLuminance: peakByte / 255,
        peakColor: peakColor !== null && peakColor >= 0 ? peakColor : null,
      });
    }
  }

  return groups;
}

function cssColor(color: number, alpha = 1): string {
  const r = (color >> 16) & 255;
  const g = (color >> 8) & 255;
  const b = color & 255;
  const resolved = cssColorForHex(colorHex(color));
  if (alpha >= 1) return resolved;
  const p3 = resolved.match(/^color\(display-p3\s+(.+)\)$/);
  return p3 ? `color(display-p3 ${p3[1]} / ${alpha})` : `rgb(${r} ${g} ${b} / ${alpha})`;
}

function colorHex(color: number): string {
  return `#${color.toString(16).padStart(6, "0")}`;
}

type FrameBounds = {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  frameX: number;
  frameY: number;
  frameWidth: number;
  frameHeight: number;
};

function resolveFrameBounds(
  group: FrameGroup,
  config: Pick<EngineConfig, "grid" | "sparkle">,
  width: number,
  height: number,
  timeSec: number,
): FrameBounds | null {
  if (group.cells.length === 0) return null;
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;

  for (const cell of group.cells) {
    const motionY = frameColumnMotionOffset(cell.col, timeSec, config.sparkle.motion);
    minX = Math.min(minX, cell.col * config.grid.cellWidth);
    maxX = Math.max(maxX, (cell.col + 1) * config.grid.cellWidth);
    minY = Math.min(minY, cell.row * config.grid.cellHeight + motionY);
    maxY = Math.max(maxY, (cell.row + 1) * config.grid.cellHeight + motionY);
  }

  minX = Math.max(0, Math.min(width, minX));
  minY = Math.max(0, Math.min(height, minY));
  maxX = Math.max(0, Math.min(width, maxX));
  maxY = Math.max(0, Math.min(height, maxY));
  if (maxX - minX < 1 || maxY - minY < 1) return null;
  return {
    minX,
    minY,
    maxX,
    maxY,
    frameX: Math.round(minX) + 0.5,
    frameY: Math.round(minY) + 0.5,
    frameWidth: Math.max(1, Math.round(maxX - minX) - 1),
    frameHeight: Math.max(1, Math.round(maxY - minY) - 1),
  };
}

function svgNumber(value: number): string {
  return Number(value.toFixed(4)).toString();
}

type FrameLabelMetrics = {
  width: number;
  ascent: number;
  descent: number;
};

function measureFrameLabel(label: string, fontSizePx: number): FrameLabelMetrics {
  const fallback = {
    width: label.length * fontSizePx * 0.6,
    ascent: fontSizePx * 0.75,
    descent: fontSizePx * 0.2,
  };
  if (typeof document === "undefined") return fallback;
  const context = document.createElement("canvas").getContext("2d");
  if (!context) return fallback;
  context.font = `${fontSizePx}px "Paper Mono", "SFMono-Regular", Menlo, Monaco, Consolas, monospace`;
  const metrics = context.measureText(label);
  return {
    width: metrics.width || fallback.width,
    ascent: metrics.actualBoundingBoxAscent || fallback.ascent,
    descent: metrics.actualBoundingBoxDescent || fallback.descent,
  };
}

export function framesOverlayToSvg(
  groups: readonly FrameGroup[],
  config: Pick<EngineConfig, "grid" | "sparkle" | "frames">,
  width: number,
  height: number,
  timeSec: number,
): string {
  if (!config.frames.enabled || groups.length === 0) return "";
  const frameHex = colorHex(config.frames.color);
  const coordinateHex = colorHex(config.frames.coordinateColor);
  const frameP3 = p3ColorForHex(frameHex);
  const coordinateP3 = p3ColorForHex(coordinateHex);
  const fontSizePx = Math.max(6, Math.min(48, Math.round(config.frames.fontSizePx)));
  const elements: string[] = [];

  for (const group of groups) {
    const bounds = resolveFrameBounds(group, config, width, height, timeSec);
    if (!bounds) continue;
    const { minX, minY, frameX, frameY, frameWidth, frameHeight } = bounds;
    const right = frameX + frameWidth;
    const bottom = frameY + frameHeight;
    const label = `${Math.round(minX)}, ${Math.round(minY)}`;
    const labelMetrics = measureFrameLabel(label, fontSizePx);
    const labelWidth = Math.ceil(labelMetrics.width) + 8;
    const labelHeight = fontSizePx + 6;
    const labelY = minY + labelHeight <= height ? minY : Math.max(0, minY - labelHeight);
    const labelBaselineY = labelY + labelHeight * 0.5 + (labelMetrics.ascent - labelMetrics.descent) * 0.5;
    elements.push(
      `  <rect class="frame-outline" x="${svgNumber(frameX)}" y="${svgNumber(frameY)}" width="${svgNumber(frameWidth)}" height="${svgNumber(frameHeight)}" fill="none" stroke="${frameHex}" style="stroke:${frameP3}" />`,
    );
    for (const [cornerX, cornerY] of [
      [frameX, frameY],
      [right, frameY],
      [frameX, bottom],
      [right, bottom],
    ] as const) {
      elements.push(
        `  <rect class="frame-corner" x="${svgNumber(cornerX - 1.5)}" y="${svgNumber(cornerY - 1.5)}" width="3" height="3" fill="${frameHex}" style="fill:${frameP3}" />`,
      );
    }
    elements.push(
      `  <rect class="frame-label-bg" x="${svgNumber(minX)}" y="${svgNumber(labelY)}" width="${svgNumber(labelWidth)}" height="${svgNumber(labelHeight)}" fill="${frameHex}" style="fill:${frameP3}" />`,
      `  <text class="frame-label" x="${svgNumber(minX + labelWidth * 0.5)}" y="${svgNumber(labelBaselineY)}" fill="${coordinateHex}" style="fill:${coordinateP3};font-family:'Paper Mono','SFMono-Regular',Menlo,Monaco,Consolas,monospace;font-size:${fontSizePx}px" text-anchor="middle">${label}</text>`,
    );
  }

  return elements.length > 0 ? [`<g data-layer="frames">`, ...elements, `</g>`].join("\n") : "";
}

export function clearFramesOverlay(canvas: HTMLCanvasElement): void {
  const context = canvas.getContext("2d");
  if (!context) return;
  context.setTransform(1, 0, 0, 1, 0, 0);
  context.clearRect(0, 0, canvas.width, canvas.height);
}

export function renderFramesOverlay(
  canvas: HTMLCanvasElement,
  groups: readonly FrameGroup[],
  config: Pick<EngineConfig, "grid" | "sparkle" | "frames">,
  cssWidth: number,
  cssHeight: number,
  timeSec: number,
): void {
  const pixelRatioX = canvas.width / Math.max(1, cssWidth);
  const pixelRatioY = canvas.height / Math.max(1, cssHeight);
  const context = canvas.getContext("2d");
  if (!context) return;

  context.setTransform(1, 0, 0, 1, 0, 0);
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.setTransform(pixelRatioX, 0, 0, pixelRatioY, 0, 0);
  context.lineWidth = 1;
  const fontSizePx = Math.max(6, Math.min(48, Math.round(config.frames.fontSizePx)));
  context.font = `${fontSizePx}px "Paper Mono", "SFMono-Regular", Menlo, Monaco, Consolas, monospace`;
  context.textAlign = "center";
  context.textBaseline = "alphabetic";

  for (const group of groups) {
    const bounds = resolveFrameBounds(group, config, cssWidth, cssHeight, timeSec);
    if (!bounds) continue;
    const { minX, minY, frameX, frameY, frameWidth, frameHeight } = bounds;
    const frameColor = config.frames.color;
    context.strokeStyle = cssColor(frameColor, 0.92);
    context.strokeRect(frameX, frameY, frameWidth, frameHeight);
    context.fillStyle = cssColor(frameColor, 0.92);
    const cornerSize = 3;
    const cornerOffset = cornerSize / 2;
    for (const [cornerX, cornerY] of [
      [frameX, frameY],
      [frameX + frameWidth, frameY],
      [frameX, frameY + frameHeight],
      [frameX + frameWidth, frameY + frameHeight],
    ] as const) {
      context.fillRect(cornerX - cornerOffset, cornerY - cornerOffset, cornerSize, cornerSize);
    }

    const label = `${Math.round(minX)}, ${Math.round(minY)}`;
    const metrics = context.measureText(label);
    const labelWidth = Math.ceil(metrics.width) + 8;
    const labelHeight = fontSizePx + 6;
    const labelY = minY + labelHeight <= cssHeight ? minY : Math.max(0, minY - labelHeight);
    const ascent = metrics.actualBoundingBoxAscent || fontSizePx * 0.75;
    const descent = metrics.actualBoundingBoxDescent || fontSizePx * 0.2;
    const labelBaselineY = labelY + labelHeight * 0.5 + (ascent - descent) * 0.5;
    context.fillStyle = cssColor(frameColor);
    context.fillRect(minX, labelY, labelWidth, labelHeight);
    context.fillStyle = cssColor(config.frames.coordinateColor);
    context.fillText(label, minX + labelWidth * 0.5, labelBaselineY);
  }
}
