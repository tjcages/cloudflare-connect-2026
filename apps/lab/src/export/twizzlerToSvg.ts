import { buildTwizzlerLines, twizzlerStrokeWidthScale, type TwizzlerSettings } from "../twizzler";

function number(value: number): string {
  return Number(value.toFixed(2)).toString();
}

function pathData(points: ReadonlyArray<{ x: number; y: number }>): string {
  if (points.length === 0) return "";
  return `M${points.map(({ x, y }) => `${number(x)} ${number(y)}`).join(" ")}`;
}

/**
 * Export Twizzler fibers as SVG vector `<path>` strokes (same geometry as canvas).
 * Near fibers are thicker + less fogged; far fibers blend toward white.
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
  const pathsByStyle = new Map<string, string[]>();
  for (const line of lines) {
    const opacity = number(line.opacity);
    const width = number(line.strokeWidth || settings.lineWidth * twizzlerStrokeWidthScale(line.nearness));
    const key = `${line.color}|${opacity}|${width}`;
    const paths = pathsByStyle.get(key) ?? [];
    paths.push(pathData(line.points));
    pathsByStyle.set(key, paths);
  }
  const paths = [...pathsByStyle]
    .map(([key, pathDataValues]) => {
      const [color, opacity, strokeWidth] = key.split("|");
      return `    <path d="${pathDataValues.join(" ")}" stroke="${color}" stroke-opacity="${opacity}" stroke-width="${strokeWidth}" />`;
    })
    .join("\n");
  return [
    `  <g data-layer="twizzler" fill="none" stroke-linecap="round" stroke-linejoin="round" transform="scale(${number(scaleX)} ${number(scaleY)})">`,
    paths,
    "  </g>",
  ].join("\n");
}
