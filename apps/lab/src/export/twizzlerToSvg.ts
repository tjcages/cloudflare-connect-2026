import { buildTwizzlerLines, type TwizzlerSettings } from "../twizzler";

function number(value: number): string {
  return Number(value.toFixed(2)).toString();
}

function pathData(points: ReadonlyArray<{ x: number; y: number }>): string {
  if (points.length === 0) return "";
  return `M${points.map(({ x, y }) => `${number(x)} ${number(y)}`).join(" ")}`;
}

/**
 * Export Twizzler fibers as SVG vector `<path>` strokes (same geometry as canvas).
 * Uses a horizontal peach→coral gradient + per-fiber opacity so the SVG stays editable.
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
  const pathsByOpacity = new Map<string, string[]>();
  for (const line of lines) {
    const opacity = number(line.opacity);
    const paths = pathsByOpacity.get(opacity) ?? [];
    paths.push(pathData(line.points));
    pathsByOpacity.set(opacity, paths);
  }
  const dash =
    settings.stippleSize > 0.01
      ? ` stroke-dasharray="${number(settings.stippleSize)} ${number(settings.stippleGap)}"`
      : "";
  const paths = [...pathsByOpacity]
    .map(
      ([opacity, pathDataValues]) =>
        `    <path d="${pathDataValues.join(" ")}" stroke="url(#twizzlerStroke)" stroke-opacity="${opacity}"${dash} />`,
    )
    .join("\n");
  return [
    `  <g data-layer="twizzler" fill="none" stroke-width="${number(settings.lineWidth)}" stroke-linecap="round" stroke-linejoin="round" transform="scale(${number(scaleX)} ${number(scaleY)})">`,
    `    <defs>`,
    `      <linearGradient id="twizzlerStroke" x1="0" y1="0" x2="${number(sourceWidth)}" y2="0" gradientUnits="userSpaceOnUse">`,
    `        <stop offset="0%" stop-color="${settings.colorFar}" />`,
    `        <stop offset="28%" stop-color="${settings.colorEdge}" />`,
    `        <stop offset="72%" stop-color="${settings.colorNear}" />`,
    `        <stop offset="100%" stop-color="${settings.colorNear}" />`,
    `      </linearGradient>`,
    `    </defs>`,
    paths,
    "  </g>",
  ].join("\n");
}
