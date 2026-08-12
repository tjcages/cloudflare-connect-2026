import { buildTwizzlerLines, type TwizzlerSettings } from "../twizzler";

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

/**
 * Export Twizzler fibers as true SVG vector segment strokes.
 * Matches canvas: one `<path>` per segment, butt caps, per-segment color/opacity
 * (same approach as orange-wave-vector.html) so X/Y/Z gradients survive export.
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

  const ordered = [...lines].sort((a, b) => a.nearness - b.nearness);
  const paths: string[] = [];

  for (const line of ordered) {
    if (line.points.length < 2) continue;
    const strokeWidth = number(Math.max(settings.minLineWidth, line.strokeWidth) * strokeScale);

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
      const cr = Math.round((c0.r + c1.r) * 0.5);
      const cg = Math.round((c0.g + c1.g) * 0.5);
      const cb = Math.round((c0.b + c1.b) * 0.5);
      const x0 = number(a0.x * scaleX, 1);
      const y0 = number(a0.y * scaleY, 1);
      const x1 = number(a1.x * scaleX, 1);
      const y1 = number(a1.y * scaleY, 1);
      paths.push(
        `    <path d="M${x0},${y0}L${x1},${y1}" fill="none" stroke="rgb(${cr},${cg},${cb})" stroke-width="${strokeWidth}" stroke-linecap="butt" opacity="${number(opacity, 3)}" />`,
      );
    }
  }

  return [
    `  <g data-layer="twizzler" fill="none" stroke-linecap="butt" stroke-linejoin="round">`,
    paths.join("\n"),
    "  </g>",
  ].join("\n");
}
