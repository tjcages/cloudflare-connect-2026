import {
  buildTwizzlerLines,
  outlinePolylinePolygon,
  resolveTwizzlerRibbonColorMode,
  ribbonGradientXYSpan,
  type TwizzlerSettings,
} from "../twizzler";
import {
  TWIZZLER_GRADIENT_FIELD_RASTER_HEIGHT,
  TWIZZLER_GRADIENT_FIELD_RASTER_WIDTH,
  TWIZZLER_GRADIENT_FIELD_SVG_COLS,
  TWIZZLER_GRADIENT_FIELD_SVG_ROWS,
  twizzlerGradientSvgImage,
  twizzlerGradientSvgStops,
  type TwizzlerGradientStop,
} from "../twizzlerGradient";

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

function aabbIntersectsArtboard(
  minX: number,
  minY: number,
  maxX: number,
  maxY: number,
  artboardWidth: number,
  artboardHeight: number,
  margin = 1,
): boolean {
  if (maxX < -margin || minX > artboardWidth + margin) return false;
  if (maxY < -margin || minY > artboardHeight + margin) return false;
  return true;
}

function pointsAabb(points: readonly Point2[]): { minX: number; minY: number; maxX: number; maxY: number } | null {
  if (points.length === 0) return null;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const p of points) {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }
  return { minX, minY, maxX, maxY };
}

function fiberIntersectsArtboard(
  scaledPoints: readonly Point2[],
  strokeWidth: number,
  artboardWidth: number,
  artboardHeight: number,
): boolean {
  const box = pointsAabb(scaledPoints);
  if (!box) return false;
  const pad = strokeWidth * 0.5;
  return aabbIntersectsArtboard(
    box.minX - pad,
    box.minY - pad,
    box.maxX + pad,
    box.maxY + pad,
    artboardWidth,
    artboardHeight,
  );
}

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

function linearGradientDef(id: string, x1: number, x2: number, stops: readonly TwizzlerGradientStop[]): string {
  const left = number(x1, 1);
  const right = number(Math.max(x2, x1 + 0.001), 1);
  return [
    `    <linearGradient id="${id}" gradientUnits="userSpaceOnUse" x1="${left}" y1="0" x2="${right}" y2="0">`,
    twizzlerGradientSvgStops(stops),
    "    </linearGradient>",
  ].join("\n");
}

/**
 * Export Twizzler fibers as filled SVG ribbons (auto outline-stroke).
 *
 * Modes (`ribbonColorMode`):
 * - solid: one filled path / fiber
 * - sharedLinear: one pack 1D X ramp, masked by all ribbon silhouettes (Figma-editable)
 * - sharedGradient: one pack 2D color-field PNG sized to the SVG frame, masked by ribbons
 * - fiberGradient: per-fiber 2D field fitted to each ribbon’s AABB
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
        const scaledSeg = [
          { x: a0.x * scaleX, y: a0.y * scaleY },
          { x: a1.x * scaleX, y: a1.y * scaleY },
        ];
        if (!fiberIntersectsArtboard(scaledSeg, strokeWidth, targetWidth, targetHeight)) continue;
        const c0 = parseRgb(a0.color ?? line.color);
        const c1 = parseRgb(a1.color ?? line.color);
        const rgb = {
          r: Math.round((c0.r + c1.r) * 0.5),
          g: Math.round((c0.g + c1.g) * 0.5),
          b: Math.round((c0.b + c1.b) * 0.5),
        };
        const d = outlinePolylineFillPath(scaledSeg, strokeWidth);
        if (!d) continue;
        segmentPaths.push(`      <path d="${d}" ${filledPathAttrs(rgb, opacity)} />`);
      }
      if (segmentPaths.length === 0) continue;
      fiberBlocks.push([`    <g data-fiber="${fiberIndex}">`, segmentPaths.join("\n"), "    </g>"].join("\n"));
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
      if (!fiberIntersectsArtboard(scaled, strokeWidth, targetWidth, targetHeight)) continue;
      const d = outlinePolylineFillPath(scaled, strokeWidth);
      if (!d) continue;
      const rgb = parseRgb(line.color);
      const opacity = Math.max(0.01, Math.min(1, line.opacity));
      fiberBlocks.push(`    <path data-fiber="${fiberIndex}" d="${d}" ${filledPathAttrs(rgb, opacity)} />`);
    }
    return [
      `  <g data-layer="twizzler" data-color-mode="solid" fill-rule="nonzero">`,
      fiberBlocks.join("\n"),
      "  </g>",
    ].join("\n");
  }

  if (colorMode === "sharedLinear" || colorMode === "sharedGradient") {
    // One gradient plane + ribbon mask (Figma-editable 1D ramp, or 2D field PNG).
    const packGradId = "twizzler-pack-grad";
    const packMaskId = "twizzler-pack-mask";
    const maskPaths: string[] = [];
    for (let fiberIndex = 0; fiberIndex < ordered.length; fiberIndex += 1) {
      const line = ordered[fiberIndex]!;
      if (line.points.length < 2) continue;
      const strokeWidth = Math.max(settings.minLineWidth, line.strokeWidth) * strokeScale;
      const scaled = line.points.map((p) => ({ x: p.x * scaleX, y: p.y * scaleY }));
      if (!fiberIntersectsArtboard(scaled, strokeWidth, targetWidth, targetHeight)) continue;
      const d = outlinePolylineFillPath(scaled, strokeWidth);
      if (!d) continue;
      const opacity = Math.max(0.01, Math.min(1, line.opacity));
      maskPaths.push(
        `      <path data-fiber="${fiberIndex}" d="${d}" fill="white" fill-opacity="${number(opacity, 3)}" stroke="none" />`,
      );
    }
    const w = number(targetWidth, 1);
    const h = number(targetHeight, 1);
    const packFill =
      colorMode === "sharedLinear" ? linearGradientDef(packGradId, 0, targetWidth, settings.gradientStops) : null;
    const packPaint =
      colorMode === "sharedLinear"
        ? `    <rect data-pack-gradient="true" x="0" y="0" width="${w}" height="${h}" fill="url(#${packGradId})" mask="url(#${packMaskId})" />`
        : twizzlerGradientSvgImage(
            packGradId,
            0,
            0,
            targetWidth,
            targetHeight,
            settings.gradientStops,
            TWIZZLER_GRADIENT_FIELD_RASTER_WIDTH,
            TWIZZLER_GRADIENT_FIELD_RASTER_HEIGHT,
            `data-pack-gradient="true" mask="url(#${packMaskId})"`,
          );
    const defLines = [
      packFill,
      `    <mask id="${packMaskId}" maskUnits="userSpaceOnUse" x="0" y="0" width="${w}" height="${h}">`,
      `      <rect x="0" y="0" width="${w}" height="${h}" fill="black" />`,
      maskPaths.join("\n"),
      "    </mask>",
    ].filter((line): line is string => line !== null);
    return [
      `  <g data-layer="twizzler" data-color-mode="${colorMode}">`,
      "    <defs>",
      ...defLines,
      "    </defs>",
      packPaint,
      "  </g>",
    ].join("\n");
  }

  // fiberGradient — 2D field stretched into each ribbon’s AABB (one image, not a tiling pattern).
  const defs: string[] = [];
  const fiberBlocks: string[] = [];
  for (let fiberIndex = 0; fiberIndex < ordered.length; fiberIndex += 1) {
    const line = ordered[fiberIndex]!;
    if (line.points.length < 2) continue;
    const strokeWidth = Math.max(settings.minLineWidth, line.strokeWidth) * strokeScale;
    const scaled = line.points.map((p) => ({ x: p.x * scaleX, y: p.y * scaleY }));
    if (!fiberIntersectsArtboard(scaled, strokeWidth, targetWidth, targetHeight)) continue;
    const d = outlinePolylineFillPath(scaled, strokeWidth);
    if (!d) continue;
    const opacity = Math.max(0.01, Math.min(1, line.opacity));
    const span = ribbonGradientXYSpan(scaled, strokeWidth) ?? { x1: 0, y1: 0, x2: targetWidth, y2: targetHeight };
    const boxX = span.x1;
    const boxY = span.y1;
    const boxW = Math.max(span.x2 - span.x1, 0.001);
    const boxH = Math.max(span.y2 - span.y1, 0.001);
    const gradId = `twizzler-fiber-${fiberIndex}-grad`;
    const maskId = `twizzler-fiber-${fiberIndex}-mask`;
    defs.push(
      [
        `    <mask id="${maskId}" maskUnits="userSpaceOnUse" x="${number(boxX, 1)}" y="${number(boxY, 1)}" width="${number(boxW, 1)}" height="${number(boxH, 1)}">`,
        `      <path data-fiber="${fiberIndex}" d="${d}" fill="white" fill-opacity="${number(opacity, 3)}" stroke="none" />`,
        "    </mask>",
      ].join("\n"),
    );
    fiberBlocks.push(
      twizzlerGradientSvgImage(
        gradId,
        boxX,
        boxY,
        boxW,
        boxH,
        settings.gradientStops,
        TWIZZLER_GRADIENT_FIELD_SVG_COLS,
        TWIZZLER_GRADIENT_FIELD_SVG_ROWS,
        `data-fiber="${fiberIndex}" mask="url(#${maskId})"`,
      ),
    );
  }

  return [
    `  <g data-layer="twizzler" data-color-mode="fiberGradient" fill-rule="nonzero">`,
    defs.length > 0 ? `    <defs>\n${defs.join("\n")}\n    </defs>` : "",
    fiberBlocks.join("\n"),
    "  </g>",
  ]
    .filter(Boolean)
    .join("\n");
}
