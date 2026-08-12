import {
  buildTwizzlerLines,
  outlinePolylinePolygon,
  resolveTwizzlerRibbonColorMode,
  type TwizzlerSettings,
} from "../twizzler";

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
 */
export function outlinePolylineFillPath(points: readonly Point2[], strokeWidth: number): string | null {
  const poly = outlinePolylinePolygon(points, strokeWidth);
  if (!poly || poly.length < 3) return null;
  const parts: string[] = [`M${number(poly[0]!.x, 1)},${number(poly[0]!.y, 1)}`];
  for (let i = 1; i < poly.length; i += 1) {
    parts.push(`L${number(poly[i]!.x, 1)},${number(poly[i]!.y, 1)}`);
  }
  parts.push("Z");
  return parts.join("");
}

function filledPathAttrs(rgb: { r: number; g: number; b: number }, opacity: number): string {
  return `fill="rgb(${rgb.r},${rgb.g},${rgb.b})" fill-opacity="${number(opacity, 3)}" stroke="none"`;
}

function linearGradientDef(id: string, width: number, colorFar: string, colorNear: string): string {
  const far = parseRgb(colorFar);
  const near = parseRgb(colorNear);
  return [
    `    <linearGradient id="${id}" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="${number(width, 1)}" y2="0">`,
    `      <stop offset="0" stop-color="rgb(${far.r},${far.g},${far.b})" />`,
    `      <stop offset="1" stop-color="rgb(${near.r},${near.g},${near.b})" />`,
    "    </linearGradient>",
  ].join("\n");
}

/**
 * Export Twizzler fibers as filled SVG ribbons (auto outline-stroke).
 *
 * Modes (`ribbonColorMode`):
 * - solid: one filled path / fiber
 * - sharedGradient: one pack X linearGradient; all fibers `fill=url(#…)` (#3)
 * - fiberGradient: per-fiber X linearGradient defs (#1)
 * - baked: segmented X/Y/Z fills (highest fidelity)
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
  const strokeScale = (scaleX + scaleY) * 0.5;
  const colorMode = resolveTwizzlerRibbonColorMode(settings);
  const ordered = [...lines].sort((a, b) => a.nearness - b.nearness);

  if (colorMode === "baked") {
    const fiberBlocks: string[] = [];
    for (let fiberIndex = 0; fiberIndex < ordered.length; fiberIndex += 1) {
      const line = ordered[fiberIndex]!;
      if (line.points.length < 2) continue;
      const strokeWidth = Math.max(settings.minLineWidth, line.strokeWidth) * strokeScale;
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
      fiberBlocks.push(
        [`    <g data-fiber="${fiberIndex}">`, segmentPaths.join("\n"), "    </g>"].join("\n"),
      );
    }
    return [
      `  <g data-layer="twizzler" data-color-mode="baked" fill-rule="nonzero">`,
      fiberBlocks.join("\n"),
      "  </g>",
    ].join("\n");
  }

  if (colorMode === "solid") {
    const fiberBlocks: string[] = [];
    for (let fiberIndex = 0; fiberIndex < ordered.length; fiberIndex += 1) {
      const line = ordered[fiberIndex]!;
      if (line.points.length < 2) continue;
      const strokeWidth = Math.max(settings.minLineWidth, line.strokeWidth) * strokeScale;
      const scaled = line.points.map((p) => ({ x: p.x * scaleX, y: p.y * scaleY }));
      const d = outlinePolylineFillPath(scaled, strokeWidth);
      if (!d) continue;
      const rgb = parseRgb(line.color);
      const opacity = Math.max(0.01, Math.min(1, line.opacity));
      fiberBlocks.push(
        `    <path data-fiber="${fiberIndex}" d="${d}" ${filledPathAttrs(rgb, opacity)} />`,
      );
    }
    return [
      `  <g data-layer="twizzler" data-color-mode="solid" fill-rule="nonzero">`,
      fiberBlocks.join("\n"),
      "  </g>",
    ].join("\n");
  }

  // sharedGradient | fiberGradient — high-quality X ramp in userSpaceOnUse.
  const defs: string[] = [];
  const fiberBlocks: string[] = [];
  const packGradId = "twizzler-pack-grad";
  if (colorMode === "sharedGradient") {
    defs.push(linearGradientDef(packGradId, targetWidth, settings.colorFar, settings.colorNear));
  }

  for (let fiberIndex = 0; fiberIndex < ordered.length; fiberIndex += 1) {
    const line = ordered[fiberIndex]!;
    if (line.points.length < 2) continue;
    const strokeWidth = Math.max(settings.minLineWidth, line.strokeWidth) * strokeScale;
    const scaled = line.points.map((p) => ({ x: p.x * scaleX, y: p.y * scaleY }));
    const d = outlinePolylineFillPath(scaled, strokeWidth);
    if (!d) continue;
    const opacity = Math.max(0.01, Math.min(1, line.opacity));
    const gradId =
      colorMode === "sharedGradient" ? packGradId : `twizzler-fiber-${fiberIndex}-grad`;
    if (colorMode === "fiberGradient") {
      defs.push(linearGradientDef(gradId, targetWidth, settings.colorFar, settings.colorNear));
    }
    fiberBlocks.push(
      `    <path data-fiber="${fiberIndex}" d="${d}" fill="url(#${gradId})" fill-opacity="${number(opacity, 3)}" stroke="none" />`,
    );
  }

  return [
    `  <g data-layer="twizzler" data-color-mode="${colorMode}" fill-rule="nonzero">`,
    defs.length > 0 ? `    <defs>\n${defs.join("\n")}\n    </defs>` : "",
    fiberBlocks.join("\n"),
    "  </g>",
  ]
    .filter(Boolean)
    .join("\n");
}
