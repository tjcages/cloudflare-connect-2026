import { buildTwizzlerLines, twizzlerSvgPathCubic, type TwizzlerLine, type TwizzlerSettings } from "../twizzler";

export type TwizzlerDriftStudy = "A" | "B" | "C";

export type TwizzlerDriftSample = {
  /** Absolute local TARGET/candidate mismatch, normalized to 0–1. */
  absolute: number;
  /** TARGET ink displaced from the generated fiber, normalized to 0–1. */
  targetDeficit: number;
  /** Generated-fiber ink not supported by TARGET at this location, normalized to 0–1. */
  candidateSurplus: number;
  /** Signed Y direction toward stronger nearby TARGET ink, normalized to -1–1. */
  targetDirectionY: number;
};

export type TwizzlerDriftSampler = (
  x: number,
  y: number,
  point: TwizzlerLine["points"][number],
  line: TwizzlerLine,
) => TwizzlerDriftSample;

export type TwizzlerDriftSvgOptions = {
  width: number;
  height: number;
  timeSec?: number;
  settings: Partial<TwizzlerSettings>;
  sample: TwizzlerDriftSampler;
  /** Number of original generated points represented by one exported point. */
  pointStride?: number;
  /** Exported points per independently styled cubic path. */
  segmentPointCount?: number;
};

type ScoredSegment = {
  path: string;
  displacedPath: string;
  absolute: number;
  targetDeficit: number;
  candidateSurplus: number;
  targetDirectionY: number;
  along: number;
  slope: number;
};

const FORBIDDEN_VECTOR_CONTENT = /<(?:image|canvas)\b|data\s*:/i;

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
}

function number(value: number): string {
  return Number(value.toFixed(3)).toString();
}

function xmlText(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

function mean(values: ReadonlyArray<number>): number {
  return values.reduce((sum, value) => sum + value, 0) / Math.max(1, values.length);
}

function simplifyPoints(points: TwizzlerLine["points"], stride: number): TwizzlerLine["points"] {
  if (points.length <= 2 || stride <= 1) return points;
  const simplified = points.filter((_, index) => index % stride === 0);
  const last = points.at(-1);
  if (last && simplified.at(-1) !== last) simplified.push(last);
  return simplified;
}

function scoreSegments(options: TwizzlerDriftSvgOptions): ScoredSegment[] {
  const { lines } = buildTwizzlerLines(options.width, options.height, options.timeSec ?? 0, options.settings);
  const stride = Math.max(1, Math.round(options.pointStride ?? 4));
  const segmentPointCount = Math.max(3, Math.round(options.segmentPointCount ?? 17));
  const segments: ScoredSegment[] = [];

  for (const line of lines) {
    const points = simplifyPoints(line.points, stride);
    for (let start = 0; start < points.length - 1; start += segmentPointCount - 1) {
      const segmentPoints = points.slice(start, Math.min(points.length, start + segmentPointCount));
      if (segmentPoints.length < 2) continue;
      const samples = segmentPoints.map((point) => options.sample(point.x, point.y, point, line));
      const absolutes = samples.map((sample) => clamp01(sample.absolute));
      const deficits = samples.map((sample) => clamp01(sample.targetDeficit));
      const surpluses = samples.map((sample) => clamp01(sample.candidateSurplus));
      const absolute = clamp01(mean(absolutes) * 0.62 + Math.max(...absolutes) * 0.38);
      const targetDeficit = clamp01(mean(deficits) * 0.7 + Math.max(...deficits) * 0.3);
      const candidateSurplus = clamp01(mean(surpluses) * 0.7 + Math.max(...surpluses) * 0.3);
      const targetDirectionY = Math.max(-1, Math.min(1, mean(samples.map((sample) => sample.targetDirectionY))));
      const displacement = targetDirectionY * (1.25 + targetDeficit * 7);
      const displacedPoints = segmentPoints.map((point) => ({ x: point.x, y: point.y + displacement }));
      const first = segmentPoints[0]!;
      const last = segmentPoints.at(-1)!;
      segments.push({
        path: twizzlerSvgPathCubic(segmentPoints),
        displacedPath: twizzlerSvgPathCubic(displacedPoints),
        absolute,
        targetDeficit,
        candidateSurplus,
        targetDirectionY,
        along: mean(segmentPoints.map((point) => point.along)),
        slope: (last.y - first.y) / Math.max(1, last.x - first.x),
      });
    }
  }
  return segments;
}

function path(pathData: string, color: string, opacity: number, width: number, extra = ""): string {
  return `    <path d="${pathData}" fill="none" stroke="${color}" stroke-opacity="${number(opacity)}" stroke-width="${number(width)}"${extra} />`;
}

function renderAbsoluteStudy(segments: ReadonlyArray<ScoredSegment>): string {
  const paths = segments.map((segment) => {
    const energy = Math.pow(segment.absolute, 0.72);
    const color = energy > 0.62 ? "#ef1919" : energy > 0.32 ? "#f53535" : "#ff6b64";
    return path(segment.path, color, 0.055 + energy * 0.82, 0.22 + energy * 1.55);
  });
  return [
    '  <g data-study="A" data-layer="absolute-drift" stroke-linecap="round" stroke-linejoin="round">',
    ...paths,
    "  </g>",
  ].join("\n");
}

function renderSignedStudy(segments: ReadonlyArray<ScoredSegment>): string {
  const bandPaths: string[] = [];
  const deficitPaths: string[] = [];
  const surplusPaths: string[] = [];
  for (const segment of segments) {
    const combined = Math.max(segment.absolute * 0.7, segment.targetDeficit, segment.candidateSurplus);
    if (combined > 0.045) {
      bandPaths.push(path(segment.path, "#ff7b45", 0.035 + combined * 0.15, 1.4 + combined * 2.8));
    }
    if (segment.targetDeficit > 0.025) {
      deficitPaths.push(
        path(
          segment.displacedPath,
          "#ff9a3d",
          0.09 + segment.targetDeficit * 0.76,
          0.25 + segment.targetDeficit * 1.35,
          ` data-displacement-y="${number(segment.targetDirectionY)}"`,
        ),
      );
    }
    if (segment.candidateSurplus > 0.02 || segment.absolute > 0.15) {
      const energy = Math.max(segment.candidateSurplus, segment.absolute * 0.58);
      surplusPaths.push(path(segment.path, "#e31919", 0.08 + energy * 0.8, 0.24 + energy * 1.25));
    }
  }
  return [
    '  <g data-study="B" data-layer="signed-drift" stroke-linecap="round" stroke-linejoin="round">',
    '    <g data-error-band="generated-fiber">',
    ...bandPaths,
    "    </g>",
    '    <g data-sign="target-deficit" data-encoding="displaced-generated-fiber">',
    ...deficitPaths,
    "    </g>",
    '    <g data-sign="candidate-surplus">',
    ...surplusPaths,
    "    </g>",
    "  </g>",
  ].join("\n");
}

function renderThresholdStudy(segments: ReadonlyArray<ScoredSegment>): string {
  const visible = segments.filter((segment) => {
    const heroFan = segment.along >= 0.55 && segment.along <= 0.94 && segment.slope < -0.12;
    const threshold = heroFan ? 0.14 : segment.along > 0.5 ? 0.24 : 0.34;
    return segment.absolute >= threshold;
  });
  const sparse = visible.filter((segment) => segment.absolute < 0.48);
  const dense = visible.filter((segment) => segment.absolute >= 0.48 && segment.absolute < 0.68);
  const hero = visible.filter(
    (segment) => segment.absolute >= 0.68 || (segment.along >= 0.55 && segment.along <= 0.94 && segment.slope < -0.12),
  );
  const group = (name: string, values: ReadonlyArray<ScoredSegment>, color: string, alpha: number, width: number) => [
    `    <g data-threshold="${name}">`,
    ...values.map((segment) => {
      const energy = Math.pow(segment.absolute, 0.65);
      return path(segment.path, color, alpha + energy * 0.48, width + energy * 1.15);
    }),
    "    </g>",
  ];
  return [
    '  <g data-study="C" data-layer="threshold-drift" stroke-linecap="round" stroke-linejoin="round">',
    ...group("sparse", sparse, "#ff7a70", 0.12, 0.28),
    ...group("dense", dense, "#f12d2d", 0.24, 0.42),
    ...group("hero-fan", hero, "#c90616", 0.42, 0.58),
    "  </g>",
  ].join("\n");
}

function studyDescription(study: TwizzlerDriftStudy): string {
  switch (study) {
    case "A":
      return "Absolute raster mismatch sampled onto generated cubic Twizzler fiber segments; opacity and weight encode error.";
    case "B":
      return "Signed generated-fiber error bands. Warm paths displace toward nearby TARGET ink; red paths encode candidate surplus. TARGET-only curves are not reconstructed or raster-traced.";
    case "C":
      return "Thresholded high-error cubic segments with sparse, dense, and diagonal hero-fan tiers.";
    default: {
      const _exhaustive: never = study;
      return _exhaustive;
    }
  }
}

export function twizzlerDriftToSvg(study: TwizzlerDriftStudy, options: TwizzlerDriftSvgOptions): string {
  const width = Math.max(1, Math.round(options.width));
  const height = Math.max(1, Math.round(options.height));
  const segments = scoreSegments({ ...options, width, height });
  let content: string;
  switch (study) {
    case "A":
      content = renderAbsoluteStudy(segments);
      break;
    case "B":
      content = renderSignedStudy(segments);
      break;
    case "C":
      content = renderThresholdStudy(segments);
      break;
    default: {
      const _exhaustive: never = study;
      content = _exhaustive;
      break;
    }
  }
  const svg = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-labelledby="title description">`,
    `  <title id="title">CF-16 vector pixel drift study ${study}</title>`,
    `  <desc id="description">${xmlText(studyDescription(study))}</desc>`,
    `  <metadata data-rain="off" data-geometry="twizzler-catmull-rom-cubic">vector-only; no embedded raster</metadata>`,
    `  <path d="M0 0H${width}V${height}H0Z" fill="#ffffff" />`,
    content,
    "</svg>",
  ].join("\n");
  assertVectorOnlyTwizzlerDriftSvg(svg);
  return svg;
}

export function twizzlerDriftStudiesToSvg(options: TwizzlerDriftSvgOptions): Record<TwizzlerDriftStudy, string> {
  return {
    A: twizzlerDriftToSvg("A", options),
    B: twizzlerDriftToSvg("B", options),
    C: twizzlerDriftToSvg("C", options),
  };
}

export function assertVectorOnlyTwizzlerDriftSvg(svg: string): void {
  if (!svg.includes("<svg") || !svg.includes("<path")) {
    throw new Error("Twizzler drift export must be an SVG containing path geometry.");
  }
  if (FORBIDDEN_VECTOR_CONTENT.test(svg)) {
    throw new Error("Twizzler drift export must not contain images, canvas elements, or data URIs.");
  }
}
