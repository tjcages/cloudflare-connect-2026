import { twizzlerSvgPathCubic } from "../twizzler";

export type RasterDriftField = {
  width: number;
  height: number;
  /** Row-major drift intensity in the 0–255 range. */
  intensity: ArrayLike<number>;
};

export type RasterDriftTraceStrategy = "A2" | "B2" | "C2";

type Point = { x: number; y: number };
type RidgePoint = Point & { intensity: number };
type RidgeTrack = { points: RidgePoint[]; misses: number };
type StyledRidge = { points: Point[]; meanIntensity: number; maxIntensity: number; span: number };
type Edge = { start: Point; end: Point; direction: number; used: boolean };

type ContourOptions = {
  blockSize: number;
  threshold: number;
  minimumArea: number;
  simplifyTolerance: number;
  sampleMode: "maximum" | "average";
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

function traceContours(field: RasterDriftField, options: ContourOptions): Point[][] {
  const grid = blockValues(field, options.blockSize, options.sampleMode);
  const active = (x: number, y: number) =>
    x >= 0 && x < grid.width && y >= 0 && y < grid.height
      ? (grid.values[y * grid.width + x] ?? 0) >= options.threshold
      : false;
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

function loopsPath(loops: ReadonlyArray<ReadonlyArray<Point>>): string {
  return loops
    .map((loop) => {
      const first = loop[0]!;
      return `M${number(first.x)} ${number(first.y)}${loop
        .slice(1)
        .map((point) => `L${number(point.x)} ${number(point.y)}`)
        .join("")}Z`;
    })
    .join("");
}

function detectColumnPeaks(field: RasterDriftField, x: number, threshold: number): RidgePoint[] {
  const candidates: RidgePoint[] = [];
  for (let y = 1; y < field.height - 1; y += 1) {
    const value = fieldValue(field, x, y);
    if (value < threshold || value < fieldValue(field, x, y - 1) || value < fieldValue(field, x, y + 1)) continue;
    candidates.push({ x, y, intensity: value / 255 });
  }
  candidates.sort((a, b) => b.intensity - a.intensity || a.y - b.y);
  const selected: RidgePoint[] = [];
  for (const candidate of candidates) {
    if (selected.every((point) => Math.abs(point.y - candidate.y) >= 2)) selected.push(candidate);
    if (selected.length >= 112) break;
  }
  return selected.sort((a, b) => a.y - b.y);
}

function predictedY(track: RidgeTrack): number {
  const points = track.points;
  const last = points.at(-1)!;
  if (points.length < 2) return last.y;
  const previous = points.at(-2)!;
  return last.y + Math.max(-7, Math.min(7, last.y - previous.y));
}

function smoothRidge(points: ReadonlyArray<RidgePoint>): Point[] {
  return points.map((point, index) => {
    let weightedY = 0;
    let weight = 0;
    for (let offset = -2; offset <= 2; offset += 1) {
      const sample = points[Math.max(0, Math.min(points.length - 1, index + offset))]!;
      const sampleWeight = 3 - Math.abs(offset);
      weightedY += sample.y * sampleWeight;
      weight += sampleWeight;
    }
    return { x: point.x, y: weightedY / weight };
  });
}

function reconstructRidges(
  field: RasterDriftField,
  options: { xStep: number; threshold: number; maximumTracks: number },
): StyledRidge[] {
  let active: RidgeTrack[] = [];
  const completed: RidgeTrack[] = [];
  for (let x = 0; x < field.width; x += options.xStep) {
    const peaks = detectColumnPeaks(field, x, options.threshold);
    const unmatched = new Set(peaks.map((_, index) => index));
    const orderedTracks = [...active].sort((a, b) => b.points.length - a.points.length);
    for (const track of orderedTracks) {
      const expectedY = predictedY(track);
      let bestIndex = -1;
      let bestDistance = Number.POSITIVE_INFINITY;
      for (const peakIndex of unmatched) {
        const peak = peaks[peakIndex]!;
        const distance = Math.abs(peak.y - expectedY) - peak.intensity * 1.5;
        if (distance < bestDistance && Math.abs(peak.y - expectedY) <= 7 + track.misses * 3) {
          bestDistance = distance;
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
      if (track.misses <= 2) continuing.push(track);
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
      const smoothed = smoothRidge(track.points);
      const simplified = simplifyOpen(smoothed, 0.48);
      return { points: simplified, meanIntensity, maxIntensity, span };
    })
    .filter((track) => track.points.length >= 3 && track.span >= 33 && track.meanIntensity >= options.threshold / 310)
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
    color: string;
    opacity: number;
    blockSize: number;
    minimumArea: number;
    tolerance: number;
    sampleMode: ContourOptions["sampleMode"];
  }>,
): string[] {
  return levels.flatMap((level) => {
    const loops = traceContours(field, {
      blockSize: level.blockSize,
      threshold: level.threshold,
      minimumArea: level.minimumArea,
      simplifyTolerance: level.tolerance,
      sampleMode: level.sampleMode,
    });
    const d = loopsPath(loops);
    return d
      ? [
          svgPath(
            d,
            `fill="${level.color}" fill-opacity="${number(level.opacity)}" fill-rule="evenodd" data-threshold="${level.threshold}" data-contours="${loops.length}"`,
          ),
        ]
      : [];
  });
}

function renderRidges(ridges: ReadonlyArray<StyledRidge>, limit = ridges.length): string[] {
  return ridges.slice(0, limit).map((ridge, index) => {
    const energy = Math.min(1, ridge.meanIntensity * 0.62 + ridge.maxIntensity * 0.38);
    const color = energy > 0.62 ? "#d40718" : energy > 0.35 ? "#ef2430" : "#ff5d61";
    return svgPath(
      twizzlerSvgPathCubic(ridge.points),
      `fill="none" stroke="${color}" stroke-opacity="${number(0.18 + energy * 0.76)}" stroke-width="${number(0.32 + energy * 1.18)}" stroke-linecap="round" data-ridge="${index}" data-energy="${number(energy)}"`,
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
      const ridges = reconstructRidges(field, { xStep: 3, threshold: 18, maximumTracks: 360 });
      content = ['  <g data-strategy="B2" data-layer="editable-cubic-ridges">', ...renderRidges(ridges), "  </g>"];
      break;
    }
    case "C2": {
      const ridges = reconstructRidges(field, { xStep: 3, threshold: 28, maximumTracks: 210 });
      content = [
        '  <g data-strategy="C2">',
        '    <g data-layer="low-frequency-contours">',
        ...renderContourLevels(field, [
          {
            threshold: 9,
            color: "#ff665d",
            opacity: 0.16,
            blockSize: 4,
            minimumArea: 28,
            tolerance: 1.2,
            sampleMode: "average",
          },
          {
            threshold: 31,
            color: "#ee2830",
            opacity: 0.28,
            blockSize: 4,
            minimumArea: 20,
            tolerance: 1,
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
  assertRasterDriftTraceSvg(svg, { requireCubic: strategy !== "A2" });
  return svg;
}

export function rasterDriftTraceStudiesToSvg(field: RasterDriftField): Record<RasterDriftTraceStrategy, string> {
  return {
    A2: rasterDriftTraceToSvg("A2", field),
    B2: rasterDriftTraceToSvg("B2", field),
    C2: rasterDriftTraceToSvg("C2", field),
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
