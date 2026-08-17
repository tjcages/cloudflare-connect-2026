import {
  COMET_LOGO_BACKGROUND_POINT_COUNT,
  COMET_LOGO_POINTS,
  COMET_LOGO_SPARK_ANCHOR_INDICES,
  COMET_LOGO_SPARK_POINT_COUNT,
} from "./points";

export type CometLogoShapePoint = readonly [number, number];

export type CometLogoShape = {
  id: string;
  points: readonly CometLogoShapePoint[];
  sparkAnchorIndices: readonly number[];
};

export type CometLogoShapeInput = {
  id?: string;
  points: readonly CometLogoShapePoint[];
  sparkAnchorIndices?: readonly number[];
};

export type CometLogoShapeBounds = {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  width: number;
  height: number;
};

const MIN_SHAPE_POINT_COUNT = 3;

export function cometLogoShapeBounds(points: readonly CometLogoShapePoint[]): CometLogoShapeBounds {
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const [x, y] of points) {
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }
  return { minX, maxX, minY, maxY, width: maxX - minX, height: maxY - minY };
}

export function normalizeCometLogoShape(input: CometLogoShapeInput): CometLogoShape {
  const points = (input.points ?? [])
    .filter((point) => point && Number.isFinite(point[0]) && Number.isFinite(point[1]))
    .map(([x, y]): CometLogoShapePoint => [x, y]);
  if (points.length < MIN_SHAPE_POINT_COUNT) {
    throw new Error(`A comet logo shape needs at least ${MIN_SHAPE_POINT_COUNT} finite points, got ${points.length}.`);
  }
  const requested = input.sparkAnchorIndices;
  const anchors = requested
    ? [...new Set(requested.filter((index) => Number.isInteger(index) && index >= 0 && index < points.length))].sort(
        (a, b) => a - b,
      )
    : [];
  return {
    id: typeof input.id === "string" && input.id.trim() !== "" ? input.id.trim() : "custom",
    points,
    sparkAnchorIndices: anchors.length > 0 ? anchors : points.map((_, index) => index),
  };
}

export const COMET_LOGO_DEFAULT_SHAPE: CometLogoShape = normalizeCometLogoShape({
  id: "cloudflare",
  points: COMET_LOGO_POINTS,
  sparkAnchorIndices: COMET_LOGO_SPARK_ANCHOR_INDICES,
});

export const COMET_LOGO_DEFAULT_SHAPE_HEIGHT = cometLogoShapeBounds(COMET_LOGO_DEFAULT_SHAPE.points).height;

export type CometLogoPointCounts = {
  logo: number;
  render: number;
  activeRender: number;
};

export function cometLogoPointCounts(shape: CometLogoShape): CometLogoPointCounts {
  const logo = shape.points.length;
  const render = logo + COMET_LOGO_BACKGROUND_POINT_COUNT;
  return { logo, render, activeRender: render + COMET_LOGO_SPARK_POINT_COUNT };
}

export function cometLogoPoolPointCount(logoDensity: number, shape: CometLogoShape): number {
  return Math.max(1, Math.round(logoDensity * shape.points.length));
}

type Polyline = CometLogoShapePoint[];

export type CometLogoTracedShapeOptions = {
  id?: string;
  pointCount?: number;
  height?: number;
  sparkAnchorStride?: number;
};

export type CometLogoSvgPathShapeOptions = CometLogoTracedShapeOptions;

export type CometLogoImageShapeOptions = CometLogoTracedShapeOptions & {
  threshold?: number;
  invert?: boolean;
  sampleSize?: number;
  minContourFraction?: number;
};

function fitShapePoints(points: readonly CometLogoShapePoint[], height: number): CometLogoShapePoint[] {
  const bounds = cometLogoShapeBounds(points);
  const scale = bounds.height > 0 ? height / bounds.height : 1;
  const centerX = (bounds.minX + bounds.maxX) / 2;
  const centerY = (bounds.minY + bounds.maxY) / 2;
  return points.map(([x, y]): CometLogoShapePoint => [(x - centerX) * scale, (centerY - y) * scale]);
}

function polylineLength(points: Polyline): number {
  let total = 0;
  for (let index = 1; index < points.length; index += 1) {
    total += Math.hypot(points[index][0] - points[index - 1][0], points[index][1] - points[index - 1][1]);
  }
  return total;
}

function resamplePolyline(points: Polyline, count: number): Polyline {
  if (points.length < 2 || count < 1) return points.slice(0, count);
  const total = polylineLength(points);
  if (total <= 0) return Array.from({ length: count }, () => points[0]);
  const step = total / count;
  const out: Polyline = [];
  let segment = 1;
  let walked = 0;
  let segmentStart = 0;
  for (let index = 0; index < count; index += 1) {
    const target = index * step;
    while (segment < points.length) {
      const length = Math.hypot(
        points[segment][0] - points[segment - 1][0],
        points[segment][1] - points[segment - 1][1],
      );
      if (segmentStart + length >= target || segment === points.length - 1) {
        walked = length;
        break;
      }
      segmentStart += length;
      segment += 1;
    }
    const t = walked > 0 ? Math.min(1, Math.max(0, (target - segmentStart) / walked)) : 0;
    const a = points[segment - 1];
    const b = points[Math.min(points.length - 1, segment)];
    out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
  }
  return out;
}

function allocatePointCounts(weights: readonly number[], pointCount: number): number[] {
  const count = weights.length;
  if (count === 0) return [];
  const minimum = Math.max(1, Math.min(3, Math.floor(pointCount / count)));
  const total = weights.reduce((sum, weight) => sum + weight, 0);
  if (total <= 0) return weights.map(() => Math.max(1, Math.floor(pointCount / count)));
  const counts = weights.map((weight) => Math.max(minimum, Math.floor((weight / total) * pointCount)));
  let assigned = counts.reduce((sum, value) => sum + value, 0);
  while (assigned > pointCount) {
    let victim = -1;
    for (let index = 0; index < count; index += 1) {
      if (counts[index] <= 1) continue;
      if (victim < 0 || counts[index] > counts[victim]) victim = index;
    }
    if (victim < 0) break;
    counts[victim] -= 1;
    assigned -= 1;
  }
  while (assigned < pointCount) {
    let winner = 0;
    for (let index = 1; index < count; index += 1) {
      if (weights[index] / counts[index] > weights[winner] / counts[winner]) winner = index;
    }
    counts[winner] += 1;
    assigned += 1;
  }
  return counts;
}

function resolveTracedPointCount(options: CometLogoTracedShapeOptions): number {
  return Math.max(MIN_SHAPE_POINT_COUNT, Math.round(options.pointCount ?? COMET_LOGO_POINTS.length));
}

function shapeFromPolylines(polylines: readonly Polyline[], options: CometLogoTracedShapeOptions): CometLogoShape {
  const usable = polylines.filter((line) => line.length >= 2 && polylineLength(line) > 0);
  if (usable.length === 0) throw new Error("The comet logo artwork produced no traceable outline.");
  const pointCount = resolveTracedPointCount(options);
  const stride = Math.max(1, Math.round(options.sparkAnchorStride ?? 1));
  const counts = allocatePointCounts(usable.map(polylineLength), pointCount);
  const points: CometLogoShapePoint[] = [];
  for (let index = 0; index < usable.length; index += 1) {
    if (counts[index] <= 0) continue;
    points.push(...resamplePolyline(usable[index], counts[index]));
  }
  const anchors: number[] = [];
  for (let index = 0; index < points.length; index += stride) anchors.push(index);
  return normalizeCometLogoShape({
    id: options.id,
    points: fitShapePoints(points, options.height ?? COMET_LOGO_DEFAULT_SHAPE_HEIGHT),
    sparkAnchorIndices: anchors,
  });
}

function withHiddenSvg<T>(svg: SVGSVGElement, read: (svg: SVGSVGElement) => T): T {
  svg.style.position = "absolute";
  svg.style.width = "0";
  svg.style.height = "0";
  svg.style.visibility = "hidden";
  document.body.appendChild(svg);
  try {
    return read(svg);
  } finally {
    svg.remove();
  }
}

function sampleGeometryElements(svg: SVGSVGElement, pointCount: number): Polyline[] {
  const elements = [
    ...svg.querySelectorAll<SVGGeometryElement>("path, circle, ellipse, line, polyline, polygon, rect"),
  ];
  const measured = elements
    .map((element) => ({ element, length: element.getTotalLength() }))
    .filter((entry) => Number.isFinite(entry.length) && entry.length > 0);
  if (measured.length === 0) throw new Error("The comet logo SVG has no geometry with a measurable length.");
  const total = measured.reduce((sum, entry) => sum + entry.length, 0);
  return measured.map((entry) => {
    const matrix = entry.element.getCTM();
    const samples = Math.max(16, Math.min(4096, Math.round((entry.length / total) * pointCount * 6)));
    const line: Polyline = [];
    for (let step = 0; step < samples; step += 1) {
      const at = entry.element.getPointAtLength((step / samples) * entry.length);
      const point = matrix ? new DOMPoint(at.x, at.y).matrixTransform(matrix) : at;
      line.push([point.x, point.y]);
    }
    line.push(line[0]);
    return line;
  });
}

export function cometLogoShapeFromSvgPath(
  pathData: string,
  options: CometLogoSvgPathShapeOptions = {},
): CometLogoShape {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
  path.setAttribute("d", pathData);
  svg.appendChild(path);
  const polylines = withHiddenSvg(svg, (mounted) => sampleGeometryElements(mounted, resolveTracedPointCount(options)));
  return shapeFromPolylines(polylines, options);
}

export function cometLogoShapeFromSvg(markup: string, options: CometLogoSvgPathShapeOptions = {}): CometLogoShape {
  const parsed = new DOMParser().parseFromString(markup, "image/svg+xml");
  if (parsed.querySelector("parsererror")) throw new Error("The comet logo SVG could not be parsed.");
  const root = parsed.documentElement;
  if (!(root instanceof SVGSVGElement)) throw new Error("The comet logo file is not an SVG document.");
  for (const unsafe of root.querySelectorAll("script, foreignObject, image, animate, set")) unsafe.remove();
  for (const element of [root, ...root.querySelectorAll("*")]) {
    for (const attribute of [...element.attributes]) {
      if (attribute.name.toLowerCase().startsWith("on")) element.removeAttribute(attribute.name);
    }
  }
  const svg = document.importNode(root, true) as SVGSVGElement;
  const polylines = withHiddenSvg(svg, (mounted) => sampleGeometryElements(mounted, resolveTracedPointCount(options)));
  return shapeFromPolylines(polylines, options);
}

const CELL_SEGMENTS: readonly (readonly [number, number][])[] = [
  [],
  [[3, 0]],
  [[0, 1]],
  [[3, 1]],
  [[1, 2]],
  [],
  [[0, 2]],
  [[3, 2]],
  [[2, 3]],
  [[0, 2]],
  [],
  [[1, 2]],
  [[3, 1]],
  [[0, 1]],
  [[3, 0]],
  [],
];

function traceContours(field: Float32Array, width: number, height: number, threshold: number): Polyline[] {
  const segments: [CometLogoShapePoint, CometLogoShapePoint][] = [];
  const at = (x: number, y: number) => field[y * width + x];
  const crossing = (a: number, b: number) => {
    const span = b - a;
    return Math.abs(span) < 1e-9 ? 0.5 : Math.min(1, Math.max(0, (threshold - a) / span));
  };
  for (let y = 0; y < height - 1; y += 1) {
    for (let x = 0; x < width - 1; x += 1) {
      const v00 = at(x, y);
      const v10 = at(x + 1, y);
      const v11 = at(x + 1, y + 1);
      const v01 = at(x, y + 1);
      let index =
        (v00 > threshold ? 1 : 0) | (v10 > threshold ? 2 : 0) | (v11 > threshold ? 4 : 0) | (v01 > threshold ? 8 : 0);
      let pairs = CELL_SEGMENTS[index];
      if (index === 5 || index === 10) {
        const average = (v00 + v10 + v11 + v01) / 4;
        const flipped = index === 5 ? average <= threshold : average > threshold;
        pairs = flipped
          ? [
              [0, 1],
              [2, 3],
            ]
          : [
              [3, 0],
              [1, 2],
            ];
      }
      if (pairs.length === 0) continue;
      const edge = (id: number): CometLogoShapePoint => {
        if (id === 0) return [x + crossing(v00, v10), y];
        if (id === 1) return [x + 1, y + crossing(v10, v11)];
        if (id === 2) return [x + crossing(v01, v11), y + 1];
        return [x, y + crossing(v00, v01)];
      };
      for (const [from, to] of pairs) segments.push([edge(from), edge(to)]);
    }
  }
  if (segments.length === 0) return [];

  const key = (point: CometLogoShapePoint) => `${Math.round(point[0] * 1e4)}:${Math.round(point[1] * 1e4)}`;
  const ends = new Map<string, number[]>();
  segments.forEach((segment, index) => {
    for (const point of segment) {
      const id = key(point);
      const list = ends.get(id);
      if (list) list.push(index);
      else ends.set(id, [index]);
    }
  });
  const used = new Array<boolean>(segments.length).fill(false);
  const nextFrom = (id: string, skip: number): number => {
    for (const candidate of ends.get(id) ?? []) {
      if (candidate !== skip && !used[candidate]) return candidate;
    }
    return -1;
  };
  const contours: Polyline[] = [];
  for (let start = 0; start < segments.length; start += 1) {
    if (used[start]) continue;
    used[start] = true;
    const line: Polyline = [segments[start][0], segments[start][1]];
    let cursor = start;
    for (;;) {
      const tail = line[line.length - 1];
      const next = nextFrom(key(tail), cursor);
      if (next < 0) break;
      used[next] = true;
      const [a, b] = segments[next];
      line.push(key(a) === key(tail) ? b : a);
      cursor = next;
    }
    cursor = start;
    for (;;) {
      const head = line[0];
      const next = nextFrom(key(head), cursor);
      if (next < 0) break;
      used[next] = true;
      const [a, b] = segments[next];
      line.unshift(key(a) === key(head) ? b : a);
      cursor = next;
    }
    contours.push(line);
  }
  return contours;
}

function borderBackground(
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
): { r: number; g: number; b: number; alpha: number } {
  let r = 0;
  let g = 0;
  let b = 0;
  let alpha = 0;
  let opaque = 0;
  let samples = 0;
  const visit = (x: number, y: number) => {
    const offset = (y * width + x) * 4;
    const a = pixels[offset + 3];
    alpha += a;
    samples += 1;
    if (a < 128) return;
    r += pixels[offset];
    g += pixels[offset + 1];
    b += pixels[offset + 2];
    opaque += 1;
  };
  for (let x = 0; x < width; x += 1) {
    visit(x, 0);
    visit(x, height - 1);
  }
  for (let y = 1; y < height - 1; y += 1) {
    visit(0, y);
    visit(width - 1, y);
  }
  const divisor = Math.max(1, opaque);
  return { r: r / divisor, g: g / divisor, b: b / divisor, alpha: alpha / Math.max(1, samples) };
}

function inkField(pixels: Uint8ClampedArray, width: number, height: number, invert: boolean): Float32Array {
  const background = borderBackground(pixels, width, height);
  const keyedOnAlpha = background.alpha < 128;
  const raw = new Float32Array(width * height);
  for (let index = 0; index < raw.length; index += 1) {
    const offset = index * 4;
    const alpha = pixels[offset + 3] / 255;
    if (keyedOnAlpha) {
      raw[index] = alpha;
      continue;
    }
    const dr = (pixels[offset] - background.r) / 255;
    const dg = (pixels[offset + 1] - background.g) / 255;
    const db = (pixels[offset + 2] - background.b) / 255;
    raw[index] = alpha * Math.sqrt((dr * dr + dg * dg + db * db) / 3);
  }
  let scale = 1;
  if (!keyedOnAlpha) {
    const bins = new Int32Array(64);
    for (const value of raw) bins[Math.min(63, Math.max(0, Math.round(value * 63)))] += 1;
    const cutoff = raw.length * 0.95;
    let seen = 0;
    let bin = 0;
    for (; bin < bins.length; bin += 1) {
      seen += bins[bin];
      if (seen >= cutoff) break;
    }
    scale = Math.max(0.08, bin / 63);
  }
  const field = new Float32Array(raw.length);
  for (let index = 0; index < raw.length; index += 1) {
    const ink = Math.min(1, raw[index] / scale);
    field[index] = invert ? 1 - ink : ink;
  }
  return field;
}

function padField(field: Float32Array, width: number, height: number): Float32Array {
  const padded = new Float32Array((width + 2) * (height + 2));
  for (let y = 0; y < height; y += 1) {
    padded.set(field.subarray(y * width, (y + 1) * width), (y + 1) * (width + 2) + 1);
  }
  return padded;
}

export function cometLogoShapeFromImage(
  source: CanvasImageSource,
  options: CometLogoImageShapeOptions = {},
): CometLogoShape {
  const sampleSize = Math.max(32, Math.min(512, Math.round(options.sampleSize ?? 192)));
  const naturalWidth =
    "naturalWidth" in source ? source.naturalWidth : "width" in source ? Number(source.width) : sampleSize;
  const naturalHeight =
    "naturalHeight" in source ? source.naturalHeight : "height" in source ? Number(source.height) : sampleSize;
  if (!(naturalWidth > 0) || !(naturalHeight > 0)) throw new Error("The comet logo image has no pixels.");
  const scale = sampleSize / Math.max(naturalWidth, naturalHeight);
  const width = Math.max(3, Math.round(naturalWidth * scale));
  const height = Math.max(3, Math.round(naturalHeight * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) throw new Error("Could not read the comet logo image.");
  context.clearRect(0, 0, width, height);
  context.drawImage(source, 0, 0, width, height);
  const pixels = context.getImageData(0, 0, width, height).data;

  const field = inkField(pixels, width, height, options.invert === true);
  const contours = traceContours(padField(field, width, height), width + 2, height + 2, options.threshold ?? 0.5);
  if (contours.length === 0) {
    throw new Error("The comet logo image has no visible shape at this threshold. Try inverting it.");
  }
  const pointCount = resolveTracedPointCount(options);
  const ranked = contours.map((line) => ({ line, length: polylineLength(line) })).sort((a, b) => b.length - a.length);
  const floor = ranked[0].length * Math.max(0, Math.min(1, options.minContourFraction ?? 0.08));
  const kept = ranked
    .filter((entry) => entry.length >= floor)
    .slice(0, Math.max(1, Math.floor(pointCount / MIN_SHAPE_POINT_COUNT)))
    .map((entry) => entry.line);
  return shapeFromPolylines(kept, options);
}
