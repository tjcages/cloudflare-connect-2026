import { buildTwizzlerLines, twizzlerUsesLineGradients, type TwizzlerSettings } from "../twizzler";

function number(value: number, digits = 2): string {
  return Number(value.toFixed(digits)).toString();
}

function parseRgb(hex: string): { r: number; g: number; b: number } {
  const normalized = hex.replace("#", "").trim();
  const full =
    normalized.length === 3
      ? normalized
          .split("")
          .map((ch) => ch + ch)
          .join("")
      : normalized.padStart(6, "0").slice(0, 6);
  const value = Number.parseInt(full, 16);
  if (!Number.isFinite(value)) return { r: 244, g: 96, b: 33 };
  return { r: (value >> 16) & 255, g: (value >> 8) & 255, b: value & 255 };
}

type Point2 = { x: number; y: number };

/**
 * Outline a centerline polyline into a closed fill path (Figma "Outline Stroke").
 * Uses averaged segment tangents at joints and butt-style end caps.
 */
export function outlinePolylineFillPath(points: readonly Point2[], strokeWidth: number): string | null {
  if (points.length < 2 || strokeWidth <= 0) return null;
  const half = strokeWidth * 0.5;
  const left: Point2[] = [];
  const right: Point2[] = [];

  for (let i = 0; i < points.length; i += 1) {
    const p = points[i]!;
    const prev = points[Math.max(0, i - 1)]!;
    const next = points[Math.min(points.length - 1, i + 1)]!;
    let dx = next.x - prev.x;
    let dy = next.y - prev.y;
    const len = Math.hypot(dx, dy);
    if (len < 1e-8) {
      dx = 1;
      dy = 0;
    } else {
      dx /= len;
      dy /= len;
    }
    const nx = -dy * half;
    const ny = dx * half;
    left.push({ x: p.x + nx, y: p.y + ny });
    right.push({ x: p.x - nx, y: p.y - ny });
  }

  const parts: string[] = [`M${number(left[0]!.x, 1)},${number(left[0]!.y, 1)}`];
  for (let i = 1; i < left.length; i += 1) {
    parts.push(`L${number(left[i]!.x, 1)},${number(left[i]!.y, 1)}`);
  }
  for (let i = right.length - 1; i >= 0; i -= 1) {
    parts.push(`L${number(right[i]!.x, 1)},${number(right[i]!.y, 1)}`);
  }
  parts.push("Z");
  return parts.join("");
}

function filledPathAttrs(rgb: { r: number; g: number; b: number }, opacity: number): string {
  return `fill="rgb(${rgb.r},${rgb.g},${rgb.b})" fill-opacity="${number(opacity, 3)}" stroke="none"`;
}

/**
 * Export Twizzler fibers as filled SVG ribbons (auto outline-stroke).
 *
 * - Gradients on: one `<g data-fiber>` per line with filled segment quads (color variation).
 * - Gradients off (solid): one filled path per fiber — light for Figma, still individually selectable.
 */
export function twizzlerToSvgLayer(
  sourceWidth: number,
  sourceHeight: number,
  targetWidth: number,
  targetHeight: number,
  timeSec: number,
  input: Partial<TwizzlerSettings>,
): string {
  const { settings, lines } = buildTwizzlerLines(sourceWidth, sourceHeight, timeSec, input);
  const scaleX = targetWidth / Math.max(1, sourceWidth);
  const scaleY = targetHeight / Math.max(1, sourceHeight);
  // Uniform stroke scale when export target matches source aspect; otherwise average.
  const strokeScale = (scaleX + scaleY) * 0.5;
  const useGradients = twizzlerUsesLineGradients(settings);

  const ordered = [...lines].sort((a, b) => a.nearness - b.nearness);
  const fiberBlocks: string[] = [];

  for (let fiberIndex = 0; fiberIndex < ordered.length; fiberIndex += 1) {
    const line = ordered[fiberIndex]!;
    if (line.points.length < 2) continue;
    const strokeWidth = Math.max(settings.minLineWidth, line.strokeWidth) * strokeScale;

    if (!useGradients) {
      const scaled = line.points.map((p) => ({ x: p.x * scaleX, y: p.y * scaleY }));
      const d = outlinePolylineFillPath(scaled, strokeWidth);
      if (!d) continue;
      const rgb = parseRgb(line.color);
      const opacity = Math.max(0.01, Math.min(1, line.opacity));
      fiberBlocks.push(`    <path data-fiber="${fiberIndex}" d="${d}" ${filledPathAttrs(rgb, opacity)} />`);
      continue;
    }

    const segmentPaths: string[] = [];
    for (let i = 1; i < line.points.length; i += 1) {
      const a0 = line.points[i - 1]!;
      const a1 = line.points[i]!;
      const alpha0 = a0.alpha ?? line.opacity;
      const alpha1 = a1.alpha ?? line.opacity;
      if (alpha0 < 0.008 || alpha1 < 0.008) continue;

      const opacity = Math.min(1, (alpha0 + alpha1) * 0.5 * 1.45 * settings.opacity);
      if (opacity < 0.01) continue;

      const c0 = parseRgb(a0.color ?? line.color);
      const c1 = parseRgb(a1.color ?? line.color);
      const rgb = {
        r: Math.round((c0.r + c1.r) * 0.5),
        g: Math.round((c0.g + c1.g) * 0.5),
        b: Math.round((c0.b + c1.b) * 0.5),
      };
      const d = outlinePolylineFillPath(
        [
          { x: a0.x * scaleX, y: a0.y * scaleY },
          { x: a1.x * scaleX, y: a1.y * scaleY },
        ],
        strokeWidth,
      );
      if (!d) continue;
      segmentPaths.push(`      <path d="${d}" ${filledPathAttrs(rgb, opacity)} />`);
    }

    if (segmentPaths.length === 0) continue;
    fiberBlocks.push([`    <g data-fiber="${fiberIndex}">`, segmentPaths.join("\n"), "    </g>"].join("\n"));
  }

  return [`  <g data-layer="twizzler" fill-rule="nonzero">`, fiberBlocks.join("\n"), "  </g>"].join("\n");
}
