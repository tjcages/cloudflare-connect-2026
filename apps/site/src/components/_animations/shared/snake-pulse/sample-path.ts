import type { Point } from "./geometry";

export const SAMPLES = 240;

export const lerpPoint = (a: Point, b: Point, t: number): Point => ({
  x: a.x + (b.x - a.x) * t,
  y: a.y + (b.y - a.y) * t,
});

let probePath: SVGPathElement | null = null;

function getProbePath(): SVGPathElement {
  if (probePath) return probePath;

  const ns = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(ns, "svg");
  svg.setAttribute(
    "style",
    "position:absolute;width:0;height:0;overflow:hidden"
  );

  const path = document.createElementNS(ns, "path");
  svg.appendChild(path);
  document.body.appendChild(svg);

  probePath = path;
  return path;
}

const SAMPLE_CACHE_LIMIT = 64;
const sampleCache = new Map<string, { points: Point[]; len: number }>();

export function samplePath(d: string): { points: Point[]; len: number } {
  const cached = sampleCache.get(d);
  if (cached) return cached;

  const path = getProbePath();
  path.setAttribute("d", d);

  const len = path.getTotalLength();
  const points: Point[] = [];
  for (let i = 0; i <= SAMPLES; i++) {
    const p = path.getPointAtLength((i / SAMPLES) * len);
    points.push({ x: p.x, y: p.y });
  }

  const result = { points, len };
  if (sampleCache.size >= SAMPLE_CACHE_LIMIT) {
    const oldestKey = sampleCache.keys().next().value;
    if (oldestKey !== undefined) sampleCache.delete(oldestKey);
  }
  sampleCache.set(d, result);
  return result;
}
