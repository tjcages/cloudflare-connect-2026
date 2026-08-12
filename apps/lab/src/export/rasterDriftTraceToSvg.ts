import { twizzlerSvgPathCubic } from "../twizzler";

export type RasterDriftField = {
  width: number;
  height: number;
  /** Row-major drift intensity in the 0–255 range. */
  intensity: ArrayLike<number>;
};

export type RasterDriftTraceStrategy = "A2" | "B2" | "C2" | "A3" | "B3" | "C3" | "A4" | "B4" | "C4";

export type RasterDriftFidelityParameters = {
  quantiles: number[];
  minimumThresholdGap: number;
  opacityScale: number;
  opacityGamma: number;
  minimumOpacity: number;
  maximumOpacity: number;
  red: string;
  minimumComponentCellsLow: number;
  minimumComponentCellsHigh: number;
  minimumAreaLow: number;
  minimumAreaHigh: number;
  simplifyToleranceLow: number;
  simplifyToleranceHigh: number;
  morphologyRadius: -1 | 0 | 1;
};

export type RasterDriftCandidateScore = {
  id: string;
  parameters: RasterDriftFidelityParameters;
  rgbMae: number;
  inkIou: number;
  vectorCoverage: number;
};

export type RasterDriftCandidateSelection = RasterDriftCandidateScore & {
  classification: "improvement" | "diagnostic";
};

export const A3_FIDELITY_PARAMETERS: RasterDriftFidelityParameters = {
  quantiles: [0.08, 0.25, 0.44, 0.62, 0.78, 0.91],
  minimumThresholdGap: 5,
  opacityScale: 1,
  opacityGamma: 1,
  minimumOpacity: 0.03,
  maximumOpacity: 0.97,
  red: "#ff0000",
  minimumComponentCellsLow: 2,
  minimumComponentCellsHigh: 3,
  minimumAreaLow: 2,
  minimumAreaHigh: 3,
  simplifyToleranceLow: 0.44,
  simplifyToleranceHigh: 0.36,
  morphologyRadius: 0,
};

type Point = { x: number; y: number };
type RidgePoint = Point & { intensity: number };
type RidgeTrack = { points: RidgePoint[]; misses: number };
type StyledRidge = { points: Point[]; meanIntensity: number; maxIntensity: number; span: number };
type Edge = { start: Point; end: Point; direction: number; used: boolean };

type ContourOptions = {
  blockSize: number;
  threshold: number;
  maximumThreshold?: number;
  minimumArea: number;
  minimumComponentCells?: number;
  dilationPasses?: number;
  erosionPasses?: number;
  simplifyTolerance: number;
  sampleMode: "maximum" | "average";
};

type RidgeOptions = {
  xStep: number;
  threshold: number;
  maximumTracks: number;
  peakSpacing?: number;
  smoothingRadius?: number;
  minimumSpan?: number;
  maximumMisses?: number;
  maximumJump?: number;
};

const FORBIDDEN_RASTER_CONTENT = /<(?:image|canvas)\b|data\s*:/i;

function clampByte(value: number): number {
  return Math.max(0, Math.min(255, Number.isFinite(value) ? value : 0));
}

function number(value: number): string {
  return Number(value.toFixed(2)).toString();
}

function pointKey(point: Point): string {
  return `${point.x},${point.y}`;
}

function fieldValue(field: RasterDriftField, x: number, y: number): number {
  const safeX = Math.max(0, Math.min(field.width - 1, Math.round(x)));
  const safeY = Math.max(0, Math.min(field.height - 1, Math.round(y)));
  return clampByte(Number(field.intensity[safeY * field.width + safeX] ?? 0));
}

function blockValues(
  field: RasterDriftField,
  blockSize: number,
  sampleMode: ContourOptions["sampleMode"],
): { width: number; height: number; values: Uint8Array } {
  const width = Math.ceil(field.width / blockSize);
  const height = Math.ceil(field.height / blockSize);
  const values = new Uint8Array(width * height);
  for (let blockY = 0; blockY < height; blockY += 1) {
    for (let blockX = 0; blockX < width; blockX += 1) {
      let value = sampleMode === "maximum" ? 0 : 0;
      let count = 0;
      for (let y = blockY * blockSize; y < Math.min(field.height, (blockY + 1) * blockSize); y += 1) {
        for (let x = blockX * blockSize; x < Math.min(field.width, (blockX + 1) * blockSize); x += 1) {
          const sample = fieldValue(field, x, y);
          value = sampleMode === "maximum" ? Math.max(value, sample) : value + sample;
          count += 1;
        }
      }
      values[blockY * width + blockX] = Math.round(sampleMode === "average" ? value / Math.max(1, count) : value);
    }
  }
  return { width, height, values };
}

function removeCollinear(points: ReadonlyArray<Point>): Point[] {
  if (points.length <= 3) return [...points];
  return points.filter((point, index) => {
    const previous = points[(index - 1 + points.length) % points.length]!;
    const next = points[(index + 1) % points.length]!;
    return (point.x - previous.x) * (next.y - point.y) !== (point.y - previous.y) * (next.x - point.x);
  });
}

function perpendicularDistance(point: Point, start: Point, end: Point): number {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  if (dx === 0 && dy === 0) return Math.hypot(point.x - start.x, point.y - start.y);
  return Math.abs(dy * point.x - dx * point.y + end.x * start.y - end.y * start.x) / Math.hypot(dx, dy);
}

function simplifyOpen(points: ReadonlyArray<Point>, tolerance: number): Point[] {
  if (points.length <= 2) return [...points];
  let maximumDistance = 0;
  let splitIndex = 0;
  const first = points[0]!;
  const last = points.at(-1)!;
  for (let index = 1; index < points.length - 1; index += 1) {
    const distance = perpendicularDistance(points[index]!, first, last);
    if (distance > maximumDistance) {
      maximumDistance = distance;
      splitIndex = index;
    }
  }
  if (maximumDistance <= tolerance) return [first, last];
  const left = simplifyOpen(points.slice(0, splitIndex + 1), tolerance);
  const right = simplifyOpen(points.slice(splitIndex), tolerance);
  return [...left.slice(0, -1), ...right];
}

function polygonArea(points: ReadonlyArray<Point>): number {
  let area = 0;
  for (let index = 0; index < points.length; index += 1) {
    const current = points[index]!;
    const next = points[(index + 1) % points.length]!;
    area += current.x * next.y - next.x * current.y;
  }
  return Math.abs(area) * 0.5;
}

function simplifyLoop(points: ReadonlyArray<Point>, tolerance: number): Point[] {
  const collinear = removeCollinear(points);
  if (collinear.length <= 4 || tolerance <= 0) return collinear;
  const simplified = simplifyOpen([...collinear, collinear[0]!], tolerance);
  if (simplified.length > 1 && pointKey(simplified[0]!) === pointKey(simplified.at(-1)!)) simplified.pop();
  return simplified;
}

function chooseNextEdge(edges: ReadonlyArray<Edge>, incomingDirection: number): Edge | undefined {
  const turnPriority = [1, 0, 3, 2];
  for (const turn of turnPriority) {
    const direction = (incomingDirection + turn) % 4;
    const edge = edges.find((candidate) => !candidate.used && candidate.direction === direction);
    if (edge) return edge;
  }
  return edges.find((edge) => !edge.used);
}

function removeSmallMaskComponents(mask: Uint8Array, width: number, height: number, minimumCells: number): void {
  if (minimumCells <= 1) return;
  const visited = new Uint8Array(mask.length);
  const neighbors = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ] as const;
  for (let start = 0; start < mask.length; start += 1) {
    if (!mask[start] || visited[start]) continue;
    const component: number[] = [];
    const queue = [start];
    visited[start] = 1;
    for (let cursor = 0; cursor < queue.length; cursor += 1) {
      const index = queue[cursor]!;
      component.push(index);
      const x = index % width;
      const y = Math.floor(index / width);
      for (const [offsetX, offsetY] of neighbors) {
        const nextX = x + offsetX;
        const nextY = y + offsetY;
        if (nextX < 0 || nextX >= width || nextY < 0 || nextY >= height) continue;
        const next = nextY * width + nextX;
        if (!mask[next] || visited[next]) continue;
        visited[next] = 1;
        queue.push(next);
      }
    }
    if (component.length < minimumCells) {
      for (const index of component) mask[index] = 0;
    }
  }
}

function dilateMask(mask: Uint8Array, width: number, height: number, passes: number): void {
  const neighbors = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ] as const;
  for (let pass = 0; pass < passes; pass += 1) {
    const source = mask.slice();
    for (let index = 0; index < source.length; index += 1) {
      if (source[index]) continue;
      const x = index % width;
      const y = Math.floor(index / width);
      if (
        neighbors.some(([offsetX, offsetY]) => {
          const nextX = x + offsetX;
          const nextY = y + offsetY;
          return nextX >= 0 && nextX < width && nextY >= 0 && nextY < height && source[nextY * width + nextX];
        })
      ) {
        mask[index] = 1;
      }
    }
  }
}

function erodeMask(mask: Uint8Array, width: number, height: number, passes: number): void {
  const neighbors = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ] as const;
  for (let pass = 0; pass < passes; pass += 1) {
    const source = mask.slice();
    for (let index = 0; index < source.length; index += 1) {
      if (!source[index]) continue;
      const x = index % width;
      const y = Math.floor(index / width);
      if (
        neighbors.some(([offsetX, offsetY]) => {
          const nextX = x + offsetX;
          const nextY = y + offsetY;
          return nextX < 0 || nextX >= width || nextY < 0 || nextY >= height || !source[nextY * width + nextX];
        })
      ) {
        mask[index] = 0;
      }
    }
  }
}

function traceContours(field: RasterDriftField, options: ContourOptions): Point[][] {
  const grid = blockValues(field, options.blockSize, options.sampleMode);
  const mask = new Uint8Array(grid.values.length);
  for (let index = 0; index < grid.values.length; index += 1) {
    const value = grid.values[index] ?? 0;
    mask[index] = value >= options.threshold && value < (options.maximumThreshold ?? 256) ? 1 : 0;
  }
  removeSmallMaskComponents(mask, grid.width, grid.height, options.minimumComponentCells ?? 1);
  dilateMask(mask, grid.width, grid.height, options.dilationPasses ?? 0);
  erodeMask(mask, grid.width, grid.height, options.erosionPasses ?? 0);
  const active = (x: number, y: number) =>
    x >= 0 && x < grid.width && y >= 0 && y < grid.height ? (mask[y * grid.width + x] ?? 0) === 1 : false;
  const edges: Edge[] = [];
  const addEdge = (start: Point, end: Point, direction: number) => {
    edges.push({ start, end, direction, used: false });
  };
  for (let y = 0; y < grid.height; y += 1) {
    for (let x = 0; x < grid.width; x += 1) {
      if (!active(x, y)) continue;
      if (!active(x, y - 1)) addEdge({ x, y }, { x: x + 1, y }, 0);
      if (!active(x + 1, y)) addEdge({ x: x + 1, y }, { x: x + 1, y: y + 1 }, 1);
      if (!active(x, y + 1)) addEdge({ x: x + 1, y: y + 1 }, { x, y: y + 1 }, 2);
      if (!active(x - 1, y)) addEdge({ x, y: y + 1 }, { x, y }, 3);
    }
  }

  const outgoing = new Map<string, Edge[]>();
  for (const edge of edges) {
    const candidates = outgoing.get(pointKey(edge.start)) ?? [];
    candidates.push(edge);
    outgoing.set(pointKey(edge.start), candidates);
  }

  const loops: Point[][] = [];
  for (const firstEdge of edges) {
    if (firstEdge.used) continue;
    const points: Point[] = [firstEdge.start];
    let edge: Edge | undefined = firstEdge;
    const startKey = pointKey(firstEdge.start);
    while (edge && !edge.used) {
      edge.used = true;
      points.push(edge.end);
      if (pointKey(edge.end) === startKey) break;
      edge = chooseNextEdge(outgoing.get(pointKey(edge.end)) ?? [], edge.direction);
    }
    if (points.length < 4 || pointKey(points.at(-1)!) !== startKey) continue;
    points.pop();
    const scaled = simplifyLoop(
      points.map((point) => ({ x: point.x * options.blockSize, y: point.y * options.blockSize })),
      options.simplifyTolerance,
    );
    if (scaled.length >= 3 && polygonArea(scaled) >= options.minimumArea) loops.push(scaled);
  }
  return loops;
}

function smoothLoopPath(loop: ReadonlyArray<Point>): string {
  const first = loop[0]!;
  const last = loop.at(-1)!;
  const start = { x: (last.x + first.x) * 0.5, y: (last.y + first.y) * 0.5 };
  let path = `M${number(start.x)} ${number(start.y)}`;
  for (let index = 0; index < loop.length; index += 1) {
    const point = loop[index]!;
    const next = loop[(index + 1) % loop.length]!;
    const end = { x: (point.x + next.x) * 0.5, y: (point.y + next.y) * 0.5 };
    path += `Q${number(point.x)} ${number(point.y)} ${number(end.x)} ${number(end.y)}`;
  }
  return `${path}Z`;
}

function loopsPath(loops: ReadonlyArray<ReadonlyArray<Point>>, smooth = false): string {
  return loops
    .map((loop) => {
      if (smooth) return smoothLoopPath(loop);
      const first = loop[0]!;
      return `M${number(first.x)} ${number(first.y)}${loop
        .slice(1)
        .map((point) => `L${number(point.x)} ${number(point.y)}`)
        .join("")}Z`;
    })
    .join("");
}

function detectColumnPeaks(field: RasterDriftField, x: number, threshold: number, peakSpacing: number): RidgePoint[] {
  const candidates: RidgePoint[] = [];
  for (let y = 1; y < field.height - 1; y += 1) {
    const value = fieldValue(field, x, y);
    if (value < threshold || value < fieldValue(field, x, y - 1) || value < fieldValue(field, x, y + 1)) continue;
    candidates.push({ x, y, intensity: value / 255 });
  }
  candidates.sort((a, b) => b.intensity - a.intensity || a.y - b.y);
  const selected: RidgePoint[] = [];
  for (const candidate of candidates) {
    if (selected.every((point) => Math.abs(point.y - candidate.y) >= peakSpacing)) selected.push(candidate);
    if (selected.length >= 160) break;
  }
  return selected.sort((a, b) => a.y - b.y);
}

function ridgeSlope(track: RidgeTrack): number {
  const points = track.points.slice(-8);
  if (points.length < 2) return 0;
  const meanX = points.reduce((sum, point) => sum + point.x, 0) / points.length;
  const meanY = points.reduce((sum, point) => sum + point.y, 0) / points.length;
  let covariance = 0;
  let variance = 0;
  for (const point of points) {
    covariance += (point.x - meanX) * (point.y - meanY);
    variance += (point.x - meanX) ** 2;
  }
  return Math.max(-1.6, Math.min(1.6, covariance / Math.max(1, variance)));
}

function predictedY(track: RidgeTrack, x: number): number {
  const last = track.points.at(-1)!;
  return last.y + ridgeSlope(track) * (x - last.x);
}

function smoothRidge(points: ReadonlyArray<RidgePoint>, radius: number): Point[] {
  return points.map((point, index) => {
    let weightedY = 0;
    let weight = 0;
    for (let offset = -radius; offset <= radius; offset += 1) {
      const sample = points[Math.max(0, Math.min(points.length - 1, index + offset))]!;
      const sampleWeight = radius + 1 - Math.abs(offset);
      weightedY += sample.y * sampleWeight;
      weight += sampleWeight;
    }
    return { x: point.x, y: weightedY / weight };
  });
}

function reconstructRidges(field: RasterDriftField, options: RidgeOptions): StyledRidge[] {
  const peakSpacing = Math.max(1, Math.round(options.peakSpacing ?? 3));
  const smoothingRadius = Math.max(1, Math.round(options.smoothingRadius ?? 8));
  const maximumMisses = Math.max(0, Math.round(options.maximumMisses ?? 2));
  const maximumJump = Math.max(1, options.maximumJump ?? 6);
  const minimumSpan = options.minimumSpan ?? Math.max(60, field.width * 0.12);
  let active: RidgeTrack[] = [];
  const completed: RidgeTrack[] = [];
  for (let x = 0; x < field.width; x += options.xStep) {
    const peaks = detectColumnPeaks(field, x, options.threshold, peakSpacing);
    const unmatched = new Set(peaks.map((_, index) => index));
    const orderedTracks = [...active].sort((a, b) => b.points.length - a.points.length);
    for (const track of orderedTracks) {
      const expectedY = predictedY(track, x);
      const slope = ridgeSlope(track);
      const last = track.points.at(-1)!;
      const deltaX = Math.max(1, x - last.x);
      let bestIndex = -1;
      let bestCost = Number.POSITIVE_INFINITY;
      for (const peakIndex of unmatched) {
        const peak = peaks[peakIndex]!;
        const distance = Math.abs(peak.y - expectedY);
        const slopeChange = Math.abs((peak.y - last.y) / deltaX - slope);
        const cost = distance + slopeChange * 3.5 - peak.intensity * 1.4;
        if (cost < bestCost && distance <= maximumJump + track.misses * 2.5) {
          bestCost = cost;
          bestIndex = peakIndex;
        }
      }
      if (bestIndex >= 0) {
        track.points.push(peaks[bestIndex]!);
        track.misses = 0;
        unmatched.delete(bestIndex);
      } else {
        track.misses += 1;
      }
    }
    const continuing: RidgeTrack[] = [];
    for (const track of active) {
      if (track.misses <= maximumMisses) continuing.push(track);
      else completed.push(track);
    }
    for (const peakIndex of unmatched) continuing.push({ points: [peaks[peakIndex]!], misses: 0 });
    active = continuing;
  }
  completed.push(...active);

  const styled = completed
    .filter((track) => track.points.length >= 12)
    .map((track): StyledRidge => {
      const intensityValues = track.points.map((point) => point.intensity);
      const meanIntensity = intensityValues.reduce((sum, value) => sum + value, 0) / intensityValues.length;
      const maxIntensity = Math.max(...intensityValues);
      const span = track.points.at(-1)!.x - track.points[0]!.x;
      const smoothed = smoothRidge(track.points, smoothingRadius);
      const simplified = simplifyOpen(smoothed, 0.72);
      return { points: simplified, meanIntensity, maxIntensity, span };
    })
    .filter(
      (track) =>
        track.points.length >= 3 && track.span >= minimumSpan && track.meanIntensity >= options.threshold / 310,
    )
    .sort(
      (a, b) =>
        b.span * Math.sqrt(b.meanIntensity * 0.65 + b.maxIntensity * 0.35) -
        a.span * Math.sqrt(a.meanIntensity * 0.65 + a.maxIntensity * 0.35),
    );
  return styled.slice(0, options.maximumTracks);
}

function svgPath(d: string, attributes: string): string {
  return `    <path d="${d}" ${attributes} />`;
}

function renderContourLevels(
  field: RasterDriftField,
  levels: ReadonlyArray<{
    threshold: number;
    maximumThreshold?: number;
    color: string;
    opacity: number;
    blockSize: number;
    minimumArea: number;
    minimumComponentCells?: number;
    dilationPasses?: number;
    erosionPasses?: number;
    tolerance: number;
    smooth?: boolean;
    sampleMode: ContourOptions["sampleMode"];
  }>,
): string[] {
  return levels.flatMap((level) => {
    const loops = traceContours(field, {
      blockSize: level.blockSize,
      threshold: level.threshold,
      maximumThreshold: level.maximumThreshold,
      minimumArea: level.minimumArea,
      minimumComponentCells: level.minimumComponentCells,
      dilationPasses: level.dilationPasses,
      erosionPasses: level.erosionPasses,
      simplifyTolerance: level.tolerance,
      sampleMode: level.sampleMode,
    });
    const d = loopsPath(loops, level.smooth);
    return d
      ? [
          svgPath(
            d,
            `fill="${level.color}" fill-opacity="${number(level.opacity)}" fill-rule="evenodd" data-threshold="${level.threshold}"${level.maximumThreshold ? ` data-maximum-threshold="${level.maximumThreshold}"` : ""} data-contours="${loops.length}" data-boundary="${level.smooth ? "smoothed" : "polygonal"}"`,
          ),
        ]
      : [];
  });
}

function adaptiveIntensityThresholds(
  field: RasterDriftField,
  quantiles = [0.08, 0.25, 0.44, 0.62, 0.78, 0.91],
  minimumGap = 5,
): number[] {
  const histogram = new Uint32Array(256);
  let sampleCount = 0;
  for (let index = 0; index < field.width * field.height; index += 1) {
    const value = Math.round(clampByte(Number(field.intensity[index] ?? 0)));
    if (value < 4) continue;
    histogram[value] = (histogram[value] ?? 0) + 1;
    sampleCount += 1;
  }
  const thresholds: number[] = [];
  let cumulative = 0;
  let quantileIndex = 0;
  for (let value = 4; value < histogram.length && quantileIndex < quantiles.length; value += 1) {
    cumulative += histogram[value] ?? 0;
    while (quantileIndex < quantiles.length && cumulative >= sampleCount * quantiles[quantileIndex]!) {
      const previous = thresholds.at(-1) ?? 0;
      thresholds.push(Math.min(252, Math.max(value, previous + minimumGap)));
      quantileIndex += 1;
    }
  }
  while (thresholds.length < quantiles.length) {
    thresholds.push(Math.min(252, (thresholds.at(-1) ?? 4) + minimumGap));
  }
  return thresholds;
}

function fidelityParameterKey(parameters: RasterDriftFidelityParameters): string {
  return JSON.stringify(parameters);
}

function renderFidelityBands(field: RasterDriftField, id: string, parameters: RasterDriftFidelityParameters): string[] {
  const thresholds = adaptiveIntensityThresholds(field, parameters.quantiles, parameters.minimumThresholdGap);
  const lowBandCount = Math.ceil(thresholds.length / 3);
  return [
    `  <g data-strategy="${id}" data-layer="optimized-a3-fidelity-bands" data-thresholds="${thresholds.join(",")}" data-parameter-key="${fidelityParameterKey(parameters).replaceAll('"', "&quot;")}">`,
    ...renderContourLevels(
      field,
      thresholds.map((threshold, index) => {
        const maximumThreshold = thresholds[index + 1];
        const representativeIntensity = (threshold + (maximumThreshold ?? 255)) * 0.5;
        const normalizedIntensity = representativeIntensity / 255;
        return {
          threshold,
          maximumThreshold,
          color: parameters.red,
          opacity: Math.max(
            parameters.minimumOpacity,
            Math.min(
              parameters.maximumOpacity,
              Math.pow(normalizedIntensity, parameters.opacityGamma) * parameters.opacityScale,
            ),
          ),
          blockSize: 1,
          minimumArea: index < lowBandCount ? parameters.minimumAreaLow : parameters.minimumAreaHigh,
          minimumComponentCells:
            index < lowBandCount ? parameters.minimumComponentCellsLow : parameters.minimumComponentCellsHigh,
          dilationPasses: parameters.morphologyRadius > 0 && index < lowBandCount ? parameters.morphologyRadius : 0,
          erosionPasses: parameters.morphologyRadius < 0 && index >= lowBandCount ? -parameters.morphologyRadius : 0,
          tolerance: index < lowBandCount ? parameters.simplifyToleranceLow : parameters.simplifyToleranceHigh,
          sampleMode: "maximum" as const,
        };
      }),
    ),
    "  </g>",
  ];
}

export function rasterDriftFidelityToSvg(
  field: RasterDriftField,
  id: string,
  parameters: RasterDriftFidelityParameters,
): string {
  if (!/^[A-Za-z0-9_-]+$/.test(id)) throw new Error("Raster drift fidelity id must be alphanumeric.");
  if (
    field.width <= 0 ||
    field.height <= 0 ||
    field.intensity.length < field.width * field.height ||
    parameters.quantiles.length < 2
  ) {
    throw new Error("Raster drift fidelity field and parameters must be complete.");
  }
  const svg = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${field.width}" height="${field.height}" viewBox="0 0 ${field.width} ${field.height}" role="img" aria-labelledby="title description">`,
    `  <title id="title">CF-16 optimized raster drift fidelity ${id}</title>`,
    '  <desc id="description">Automated A3-topology parameter search result rendered as disjoint filled contour paths.</desc>',
    '  <metadata data-rain="off" data-source="optimized-raster-drift-trace">vector paths only; raster pixels are not embedded</metadata>',
    `  <path d="M0 0H${field.width}V${field.height}H0Z" fill="#ffffff" />`,
    ...renderFidelityBands(field, id, parameters),
    "</svg>",
  ].join("\n");
  assertRasterDriftTraceSvg(svg);
  return svg;
}

export function selectRasterDriftFidelityCandidates(
  candidates: ReadonlyArray<RasterDriftCandidateScore>,
  baseline: Pick<RasterDriftCandidateScore, "rgbMae" | "inkIou"> &
    Partial<Pick<RasterDriftCandidateScore, "vectorCoverage">> & { sourceCoverage?: number },
  count = 3,
): RasterDriftCandidateSelection[] {
  const unique = [
    ...new Map(candidates.map((candidate) => [fidelityParameterKey(candidate.parameters), candidate])).values(),
  ];
  const quality = (candidate: RasterDriftCandidateScore) =>
    baseline.rgbMae - candidate.rgbMae + (candidate.inkIou - baseline.inkIou) * 100;
  const ordered = [...unique].sort(
    (a, b) => quality(b) - quality(a) || a.rgbMae - b.rgbMae || a.id.localeCompare(b.id),
  );
  const improvements = ordered.filter(
    (candidate) => candidate.rgbMae < baseline.rgbMae && candidate.inkIou > baseline.inkIou,
  );
  const coverageImprovements =
    baseline.vectorCoverage === undefined
      ? []
      : improvements.filter((candidate) => candidate.vectorCoverage > baseline.vectorCoverage!);
  coverageImprovements.sort((a, b) => {
    if (baseline.sourceCoverage !== undefined) {
      const coverageDistance =
        Math.abs(a.vectorCoverage - baseline.sourceCoverage) - Math.abs(b.vectorCoverage - baseline.sourceCoverage);
      if (coverageDistance !== 0) return coverageDistance;
    }
    return quality(b) - quality(a) || a.id.localeCompare(b.id);
  });
  const coverageSet = new Set(coverageImprovements);
  const metricOnlyImprovements = improvements.filter((candidate) => !coverageSet.has(candidate));
  const pareto = metricOnlyImprovements.filter(
    (candidate) =>
      !metricOnlyImprovements.some(
        (other) =>
          other !== candidate &&
          other.rgbMae <= candidate.rgbMae &&
          other.inkIou >= candidate.inkIou &&
          (other.rgbMae < candidate.rgbMae || other.inkIou > candidate.inkIou),
      ),
  );
  const improvementOrder = [
    ...coverageImprovements,
    ...pareto,
    ...metricOnlyImprovements.filter((candidate) => !pareto.includes(candidate)),
  ];
  const selected: RasterDriftCandidateSelection[] = improvementOrder
    .slice(0, count)
    .map((candidate) => ({ ...candidate, classification: "improvement" }));
  if (selected.length < count) {
    const selectedIds = new Set(selected.map((candidate) => candidate.id));
    const diagnostics = ordered
      .filter((candidate) => !selectedIds.has(candidate.id) && !improvements.includes(candidate))
      .sort((a, b) => {
        const penaltyA = Math.max(0, a.rgbMae - baseline.rgbMae) + Math.max(0, baseline.inkIou - a.inkIou) * 100;
        const penaltyB = Math.max(0, b.rgbMae - baseline.rgbMae) + Math.max(0, baseline.inkIou - b.inkIou) * 100;
        return penaltyA - penaltyB || a.id.localeCompare(b.id);
      });
    selected.push(
      ...diagnostics.slice(0, count - selected.length).map((candidate) => ({
        ...candidate,
        classification: "diagnostic" as const,
      })),
    );
  }
  return selected;
}

function renderRidges(ridges: ReadonlyArray<StyledRidge>, limit = ridges.length): string[] {
  return ridges.slice(0, limit).map((ridge, index) => {
    const energy = Math.min(1, ridge.meanIntensity * 0.62 + ridge.maxIntensity * 0.38);
    const color = energy > 0.62 ? "#d40718" : energy > 0.35 ? "#ef2430" : "#ff5d61";
    return svgPath(
      twizzlerSvgPathCubic(ridge.points),
      `fill="none" stroke="${color}" stroke-opacity="${number(0.1 + energy * 0.78)}" stroke-width="${number(0.24 + energy * 1.08)}" stroke-linecap="round" stroke-linejoin="round" data-ridge="${index}" data-energy="${number(energy)}"`,
    );
  });
}

function strategyDescription(strategy: RasterDriftTraceStrategy): string {
  switch (strategy) {
    case "A2":
      return "Exact quantized contour strategy: raster drift intensity is traced into nested filled vector path bands. Shapes preserve the source silhouette but are not editable Twizzler strands.";
    case "B2":
      return "Editable strand reconstruction strategy: line-like raster ridges are tracked across X, smoothed, simplified, and fitted as cubic Catmull-Rom paths.";
    case "C2":
      return "Hybrid strategy: low-frequency filled contour mass underlays selected cubic reconstructed high-error strands.";
    case "A3":
      return "Adaptive fidelity trace: cleaned, disjoint intensity bands preserve raster topology and white line channels without cumulative contour overfill.";
    case "B3":
      return "Dense editable reconstruction: direction-continuous ridge tracks preserve crossings independently and export as cubic Catmull-Rom strand paths.";
    case "C3":
      return "Disciplined hybrid: restrained high-threshold contour mass supports a denser layer of editable cubic high-error strands.";
    case "A4":
      return "Anti-aliased fidelity trace: additional adaptive red-opacity bands use simplified, smoothed contour boundaries while retaining thin channels.";
    case "B4":
      return "Ridge-protected fidelity trace: high-intensity contour erosion explicitly widens white channels through the central crossing fan.";
    case "C4":
      return "Color-calibrated fidelity trace: bounded uniform intensity bands reproduce the raster drift's pure-red-over-white hierarchy.";
    default: {
      const _exhaustive: never = strategy;
      return _exhaustive;
    }
  }
}

export function rasterDriftTraceToSvg(strategy: RasterDriftTraceStrategy, field: RasterDriftField): string {
  if (
    !Number.isInteger(field.width) ||
    !Number.isInteger(field.height) ||
    field.width <= 0 ||
    field.height <= 0 ||
    field.intensity.length < field.width * field.height
  ) {
    throw new Error("Raster drift field dimensions and intensity data must be complete.");
  }
  let content: string[];
  switch (strategy) {
    case "A2":
      content = [
        '  <g data-strategy="A2" data-layer="quantized-contours">',
        ...renderContourLevels(field, [
          {
            threshold: 10,
            color: "#ff7272",
            opacity: 0.2,
            blockSize: 1,
            minimumArea: 2,
            tolerance: 0.42,
            sampleMode: "maximum",
          },
          {
            threshold: 38,
            color: "#ff4348",
            opacity: 0.3,
            blockSize: 1,
            minimumArea: 2,
            tolerance: 0.42,
            sampleMode: "maximum",
          },
          {
            threshold: 92,
            color: "#ef1726",
            opacity: 0.43,
            blockSize: 1,
            minimumArea: 3,
            tolerance: 0.38,
            sampleMode: "maximum",
          },
          {
            threshold: 170,
            color: "#c90018",
            opacity: 0.62,
            blockSize: 1,
            minimumArea: 3,
            tolerance: 0.34,
            sampleMode: "maximum",
          },
        ]),
        "  </g>",
      ];
      break;
    case "B2": {
      const ridges = reconstructRidges(field, { xStep: 4, threshold: 16, maximumTracks: 320 });
      content = ['  <g data-strategy="B2" data-layer="editable-cubic-ridges">', ...renderRidges(ridges), "  </g>"];
      break;
    }
    case "C2": {
      const ridges = reconstructRidges(field, { xStep: 4, threshold: 24, maximumTracks: 210 });
      content = [
        '  <g data-strategy="C2">',
        '    <g data-layer="low-frequency-contours">',
        ...renderContourLevels(field, [
          {
            threshold: 9,
            color: "#ff665d",
            opacity: 0.16,
            blockSize: 2,
            minimumArea: 18,
            tolerance: 0.75,
            sampleMode: "average",
          },
          {
            threshold: 31,
            color: "#ee2830",
            opacity: 0.28,
            blockSize: 2,
            minimumArea: 14,
            tolerance: 0.65,
            sampleMode: "average",
          },
        ]),
        "    </g>",
        '    <g data-layer="high-error-cubic-ridges">',
        ...renderRidges(ridges, 180),
        "    </g>",
        "  </g>",
      ];
      break;
    }
    case "A3": {
      content = renderFidelityBands(field, "A3", A3_FIDELITY_PARAMETERS);
      break;
    }
    case "B3": {
      const ridges = reconstructRidges(field, {
        xStep: 3,
        threshold: 10,
        maximumTracks: 260,
        peakSpacing: 2,
        smoothingRadius: 10,
        minimumSpan: 36,
        maximumMisses: 4,
        maximumJump: 8,
      });
      content = [
        '  <g data-strategy="B3" data-layer="dense-direction-continuous-cubic-ridges" data-crossing-order="independent">',
        ...renderRidges(ridges),
        "  </g>",
      ];
      break;
    }
    case "C3": {
      const ridges = reconstructRidges(field, {
        xStep: 3,
        threshold: 15,
        maximumTracks: 240,
        peakSpacing: 2,
        smoothingRadius: 9,
        minimumSpan: 42,
        maximumMisses: 4,
        maximumJump: 8,
      });
      content = [
        '  <g data-strategy="C3">',
        '    <g data-layer="restrained-contour-underlay">',
        ...renderContourLevels(field, [
          {
            threshold: 28,
            color: "#ef2933",
            opacity: 0.07,
            blockSize: 2,
            minimumArea: 26,
            minimumComponentCells: 3,
            tolerance: 0.8,
            sampleMode: "average",
          },
          {
            threshold: 78,
            color: "#c9081b",
            opacity: 0.12,
            blockSize: 2,
            minimumArea: 18,
            minimumComponentCells: 2,
            tolerance: 0.68,
            sampleMode: "average",
          },
        ]),
        "    </g>",
        '    <g data-layer="dense-high-error-cubic-ridges">',
        ...renderRidges(ridges, 220),
        "    </g>",
        "  </g>",
      ];
      break;
    }
    case "A4": {
      const thresholds = adaptiveIntensityThresholds(
        field,
        [0.04, 0.11, 0.2, 0.3, 0.41, 0.53, 0.64, 0.75, 0.86, 0.95],
        3,
      );
      content = [
        `  <g data-strategy="A4" data-layer="anti-aliased-fidelity-bands" data-thresholds="${thresholds.join(",")}">`,
        ...renderContourLevels(
          field,
          thresholds.map((threshold, index) => {
            const maximumThreshold = thresholds[index + 1];
            const representativeIntensity = (threshold + (maximumThreshold ?? 255)) * 0.5;
            return {
              threshold,
              maximumThreshold,
              color: "#ff0505",
              opacity: Math.max(0.025, Math.min(0.96, (representativeIntensity / 255) * 0.96)),
              blockSize: 1,
              minimumArea: index < 3 ? 2 : 3,
              minimumComponentCells: 2,
              tolerance: index < 4 ? 0.52 : 0.4,
              smooth: true,
              sampleMode: "maximum" as const,
            };
          }),
        ),
        "  </g>",
      ];
      break;
    }
    case "B4": {
      const thresholds = adaptiveIntensityThresholds(field, [0.06, 0.17, 0.3, 0.44, 0.58, 0.71, 0.83, 0.93], 4);
      content = [
        `  <g data-strategy="B4" data-layer="ridge-protected-fidelity-bands" data-channel-protection="high-band-erosion" data-thresholds="${thresholds.join(",")}">`,
        ...renderContourLevels(
          field,
          thresholds.map((threshold, index) => {
            const maximumThreshold = thresholds[index + 1];
            const representativeIntensity = (threshold + (maximumThreshold ?? 255)) * 0.5;
            return {
              threshold,
              maximumThreshold,
              color: "#ff0808",
              opacity: Math.max(0.025, Math.min(0.93, (representativeIntensity / 255) * 0.92)),
              blockSize: 1,
              minimumArea: index < 3 ? 2 : 3,
              minimumComponentCells: 2,
              erosionPasses: index >= 5 ? 1 : 0,
              tolerance: index < 4 ? 0.46 : 0.34,
              smooth: true,
              sampleMode: "maximum" as const,
            };
          }),
        ),
        "  </g>",
      ];
      break;
    }
    case "C4": {
      const thresholds = [4, 12, 24, 40, 60, 84, 112, 144, 180, 216, 240];
      content = [
        `  <g data-strategy="C4" data-layer="color-calibrated-fidelity-bands" data-thresholds="${thresholds.join(",")}">`,
        ...renderContourLevels(
          field,
          thresholds.map((threshold, index) => {
            const maximumThreshold = thresholds[index + 1];
            const representativeIntensity = (threshold + (maximumThreshold ?? 255)) * 0.5;
            return {
              threshold,
              maximumThreshold,
              color: "#ff0808",
              opacity: Math.max(0.02, Math.min(0.96, (representativeIntensity / 255) * 0.97)),
              blockSize: 1,
              minimumArea: index < 4 ? 2 : 3,
              minimumComponentCells: index < 3 ? 2 : 3,
              tolerance: index < 5 ? 0.4 : 0.3,
              smooth: true,
              sampleMode: "maximum" as const,
            };
          }),
        ),
        "  </g>",
      ];
      break;
    }
    default: {
      const _exhaustive: never = strategy;
      content = [_exhaustive];
      break;
    }
  }

  const svg = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${field.width}" height="${field.height}" viewBox="0 0 ${field.width} ${field.height}" role="img" aria-labelledby="title description">`,
    `  <title id="title">CF-16 raster drift vectorization ${strategy}</title>`,
    `  <desc id="description">${strategyDescription(strategy)}</desc>`,
    `  <metadata data-rain="off" data-source="raster-drift-trace">vector paths only; raster pixels are not embedded</metadata>`,
    `  <path d="M0 0H${field.width}V${field.height}H0Z" fill="#ffffff" />`,
    ...content,
    "</svg>",
  ].join("\n");
  assertRasterDriftTraceSvg(svg, {
    requireCubic: strategy === "B2" || strategy === "C2" || strategy === "B3" || strategy === "C3",
  });
  return svg;
}

export function rasterDriftTraceStudiesToSvg(
  field: RasterDriftField,
): Record<Extract<RasterDriftTraceStrategy, "A2" | "B2" | "C2">, string> {
  return {
    A2: rasterDriftTraceToSvg("A2", field),
    B2: rasterDriftTraceToSvg("B2", field),
    C2: rasterDriftTraceToSvg("C2", field),
  };
}

export function rasterDriftTracePass3StudiesToSvg(
  field: RasterDriftField,
): Record<Extract<RasterDriftTraceStrategy, "A3" | "B3" | "C3">, string> {
  return {
    A3: rasterDriftTraceToSvg("A3", field),
    B3: rasterDriftTraceToSvg("B3", field),
    C3: rasterDriftTraceToSvg("C3", field),
  };
}

export function rasterDriftTracePass4StudiesToSvg(
  field: RasterDriftField,
): Record<Extract<RasterDriftTraceStrategy, "A4" | "B4" | "C4">, string> {
  return {
    A4: rasterDriftTraceToSvg("A4", field),
    B4: rasterDriftTraceToSvg("B4", field),
    C4: rasterDriftTraceToSvg("C4", field),
  };
}

export function assertRasterDriftTraceSvg(svg: string, options: { requireCubic?: boolean } = {}): void {
  if (!svg.includes("<svg") || !/<path\b[^>]*\bd="[^"]+"/i.test(svg)) {
    throw new Error("Raster drift trace must be an SVG containing path geometry.");
  }
  if (FORBIDDEN_RASTER_CONTENT.test(svg)) {
    throw new Error("Raster drift trace must not contain images, canvas elements, or data URIs.");
  }
  if (options.requireCubic && !/<path\b[^>]*\bd="[^"]*\bC/i.test(svg)) {
    throw new Error("Raster drift strand reconstruction must contain cubic path commands.");
  }
}

export function countRasterDriftSvgPaths(svg: string): number {
  return svg.match(/<path\b/g)?.length ?? 0;
}
