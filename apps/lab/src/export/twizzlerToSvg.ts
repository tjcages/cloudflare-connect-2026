import { buildTwizzlerLines, type TwizzlerSettings } from "../twizzler";

function number(value: number): string {
  return Number(value.toFixed(2)).toString();
}

function pathData(points: ReadonlyArray<{ x: number; y: number }>): string {
  if (points.length === 0) return "";
  return `M${points.map(({ x, y }) => `${number(x)} ${number(y)}`).join(" ")}`;
}

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
  const paths = [...pathsByOpacity]
    .map(([opacity, pathDataValues]) => `    <path d="${pathDataValues.join(" ")}" stroke-opacity="${opacity}" />`)
    .join("\n");
  return [
    `  <g data-layer="twizzler" fill="none" stroke="${settings.color}" stroke-width="${number(settings.lineWidth)}" stroke-linecap="round" stroke-linejoin="round" transform="scale(${number(scaleX)} ${number(scaleY)})">`,
    paths,
    "  </g>",
  ].join("\n");
}
