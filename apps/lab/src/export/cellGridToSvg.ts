import { bandIndexForValue } from "@necatikcl/stripes-engine";
import { p3ColorForHex } from "../components/colorLibrary";

const ROW_WIDTH_GAP = 1;
const MIN_STRIPE_WIDTH_PX = 0.5;

type LabStripe = { hex: string; startFrom: number; width: number; opacity?: number };
type SvgGradientOptions = {
  direction: "topToBottom" | "leftToRight" | "rightToLeft" | "bottomToTop";
  stopCount: number;
  stops: string[];
};
type SvgBlendMode = "normal" | "multiply" | "screen" | "overlay" | "darken" | "lighten" | "difference" | "exclusion";
type StripeOrientation = "vertical" | "horizontal";
type GridRotationMode = "cell" | "overlap";
type LettersSvgOptions = {
  enabled: boolean;
  mode: "random" | "text";
  color: number;
  text: string;
  textCopies: number;
  fontFamily: string;
  sizeScale: number;
};

type CellReadback = {
  cols: number;
  rows: number;
  values: Uint8Array;
  colors: Uint8Array | null;
};

function svgStripeClass(band: number): string {
  return `fill-stripe-${band}`;
}

function sameStripeBand(a: number, b: number): boolean {
  if (a < 1 || b < 1) return false;
  return a === b;
}

function normalizeAngleDeg(value: number | undefined, orientation: StripeOrientation): number {
  const fallback = orientation === "horizontal" ? 90 : 0;
  if (!Number.isFinite(value)) return fallback;
  return (((value as number) % 180) + 180) % 180;
}

function isAxisAlignedAngle(angleDeg: number): boolean {
  return Math.abs(angleDeg - 0) < 0.001 || Math.abs(angleDeg - 90) < 0.001 || Math.abs(angleDeg - 180) < 0.001;
}

function rotatedStripePath(cx: number, cy: number, halfNormal: number, halfAxis: number, angleDeg: number): string {
  const rad = (angleDeg * Math.PI) / 180;
  const axis = { x: Math.sin(rad), y: Math.cos(rad) };
  const normal = { x: Math.cos(rad), y: -Math.sin(rad) };
  const point = (normalSign: number, axisSign: number) => {
    const x = cx + normal.x * halfNormal * normalSign + axis.x * halfAxis * axisSign;
    const y = cy + normal.y * halfNormal * normalSign + axis.y * halfAxis * axisSign;
    return `${formatSvgNumber(x)} ${formatSvgNumber(y)}`;
  };
  return `M${point(-1, -1)}L${point(1, -1)}L${point(1, 1)}L${point(-1, 1)}Z`;
}

function cellColorHex(colors: Uint8Array, cellIndex: number): string {
  const offset = cellIndex * 4;
  const r = colors[offset] ?? 0;
  const g = colors[offset + 1] ?? 0;
  const b = colors[offset + 2] ?? 0;
  return `#${[r, g, b].map((channel) => channel.toString(16).padStart(2, "0")).join("")}`;
}

function escapeXml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function formatSvgNumber(value: number): string {
  return Number(value.toFixed(4)).toString();
}

function normalizeSvgHex(value: string): string {
  const raw = value.trim().replace(/^#/, "");
  return /^[0-9a-fA-F]{6}$/.test(raw) ? `#${raw.toLowerCase()}` : "#000000";
}

function p3SvgColor(value: string): string {
  return p3ColorForHex(normalizeSvgHex(value));
}

function svgBlendStyle(blendMode: SvgBlendMode | undefined): string {
  return blendMode && blendMode !== "normal" ? `mix-blend-mode: ${blendMode};` : "";
}

function buildSvgGradientDef(gradient: SvgGradientOptions, id: string): string {
  const coords =
    gradient.direction === "leftToRight"
      ? { x1: "0", y1: "0", x2: "1", y2: "0" }
      : gradient.direction === "rightToLeft"
        ? { x1: "1", y1: "0", x2: "0", y2: "0" }
        : gradient.direction === "bottomToTop"
          ? { x1: "0", y1: "1", x2: "0", y2: "0" }
          : { x1: "0", y1: "0", x2: "0", y2: "1" };
  const stopCount = Math.max(2, Math.min(4, Math.round(gradient.stopCount)));
  const stops = gradient.stops.slice(0, stopCount);
  while (stops.length < stopCount) stops.push(stops[stops.length - 1] ?? "#000000");
  const stopEls = stops
    .map((stop, index) => {
      const offset = stopCount === 1 ? 0 : index / (stopCount - 1);
      const hex = normalizeSvgHex(stop);
      return `      <stop offset="${formatSvgNumber(offset)}" stop-color="${hex}" style="stop-color:${p3SvgColor(hex)}" />`;
    })
    .join("\n");
  return [
    "  <defs>",
    `    <linearGradient id="${id}" x1="${coords.x1}" y1="${coords.y1}" x2="${coords.x2}" y2="${coords.y2}">`,
    stopEls,
    "    </linearGradient>",
    "  </defs>",
  ].join("\n");
}

function stringSeed(value: string): number {
  let h = 2166136261;
  for (let i = 0; i < value.length; i++) {
    h ^= value.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(seed: number): () => number {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function fallbackLetter(char: string): string {
  const fallbacks: Record<string, string> = {
    ç: "c",
    Ç: "C",
    ğ: "g",
    Ğ: "G",
    ı: "i",
    İ: "I",
    ö: "o",
    Ö: "O",
    ş: "s",
    Ş: "S",
    ü: "u",
    Ü: "U",
  };
  return fallbacks[char] ?? char;
}

function sanitizeCssFontFamily(value: string): string {
  return value.replace(/[<>{};]/g, "").trim() || "monospace";
}

function buildTextLettersSvg(
  letters: LettersSvgOptions | undefined,
  opts: {
    cols: number;
    rows: number;
    cellWidthPx: number;
    cellHeightPx: number;
    orientation: StripeOrientation;
  },
): { style: string; elements: string } {
  if (!letters?.enabled || letters.mode !== "text" || letters.text.trim() === "") {
    return { style: "", elements: "" };
  }

  const { cols, rows, cellWidthPx, cellHeightPx, orientation } = opts;
  const textCopies = Math.max(1, Math.min(100, Math.round(letters.textCopies)));
  const sig = [cols, rows, orientation, textCopies, letters.text].join("|");
  const lines = letters.text.replace(/\r/g, "").split("\n");
  const maxLineLen = lines.reduce((max, line) => Math.max(max, [...line].length), 0);
  const glyphs: Array<{ col: number; row: number; char: string }> = [];
  let blockW = 0;
  let blockH = 0;

  lines.forEach((line, lineIndex) => {
    let offset = 0;
    for (const rawChar of line) {
      const char = rawChar === " " ? "" : fallbackLetter(rawChar);
      const localCol = orientation === "horizontal" ? offset : lineIndex;
      const localRow = orientation === "horizontal" ? lineIndex : maxLineLen - 1 - offset;
      blockW = Math.max(blockW, localCol + 1);
      blockH = Math.max(blockH, localRow + 1);
      if (char) glyphs.push({ col: localCol, row: localRow, char });
      offset++;
    }
    if (line.length === 0) {
      blockW = Math.max(blockW, orientation === "horizontal" ? 0 : lineIndex + 1);
      blockH = Math.max(blockH, orientation === "horizontal" ? lineIndex + 1 : 0);
    }
  });

  if (glyphs.length === 0 || blockW <= 0 || blockH <= 0 || blockW > cols || blockH > rows) {
    return { style: "", elements: "" };
  }

  const candidates: Array<{ col: number; row: number }> = [];
  for (let row = 0; row <= rows - blockH; row++) {
    for (let col = 0; col <= cols - blockW; col++) {
      candidates.push({ col, row });
    }
  }

  const random = mulberry32(stringSeed(sig));
  for (let i = candidates.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    const t = candidates[i];
    candidates[i] = candidates[j];
    candidates[j] = t;
  }

  const occupied = new Uint8Array(cols * rows);
  const fontSize = Math.max(1, Math.min(cellWidthPx, cellHeightPx) * Math.max(0.1, Math.min(1, letters.sizeScale)));
  const family = sanitizeCssFontFamily(letters.fontFamily);
  const color = `#${(letters.color & 0xffffff).toString(16).padStart(6, "0")}`;
  const elements: string[] = [];
  let placed = 0;

  for (const candidate of candidates) {
    if (placed >= textCopies) break;
    let fits = true;
    for (const glyph of glyphs) {
      const idx = (candidate.row + glyph.row) * cols + candidate.col + glyph.col;
      if (occupied[idx]) {
        fits = false;
        break;
      }
    }
    if (!fits) continue;

    for (const glyph of glyphs) {
      const col = candidate.col + glyph.col;
      const readbackRow = candidate.row + glyph.row;
      const svgRow = rows - 1 - readbackRow;
      const cellIndex = readbackRow * cols + col;
      const x = (col + 0.5) * cellWidthPx;
      const y = (svgRow + 0.5) * cellHeightPx;
      elements.push(
        `  <text class="letter-glyph" x="${x}" y="${y}" text-anchor="middle" dominant-baseline="middle">${escapeXml(glyph.char)}</text>`,
      );
      occupied[cellIndex] = 1;
    }
    placed++;
  }

  if (elements.length === 0) return { style: "", elements: "" };

  const style = [
    `  .letter-glyph {`,
    `    fill: ${color};`,
    `    font-family: ${family};`,
    `    font-size: ${fontSize}px;`,
    `    font-weight: 400;`,
    `    text-anchor: middle;`,
    `    dominant-baseline: middle;`,
    `    alignment-baseline: middle;`,
    `  }`,
  ].join("\n");

  return { style, elements: elements.join("\n") };
}

export function cellGridToSvg(
  readback: CellReadback,
  stripes: LabStripe[],
  opts: {
    cellWidthPx: number;
    cellHeightPx: number;
    gapX?: number;
    gapY?: number;
    useCellColors: boolean;
    orientation?: StripeOrientation;
    angleDeg?: number;
    rotationMode?: GridRotationMode;
    overlapAmount?: number;
    backgroundHex?: string;
    letters?: LettersSvgOptions;
    gradient?: SvgGradientOptions;
    backgroundGradient?: SvgGradientOptions;
    blendMode?: SvgBlendMode;
    canvasWidthPx?: number;
    canvasHeightPx?: number;
  },
): string {
  const { cols, rows, values, colors } = readback;
  const {
    cellWidthPx,
    cellHeightPx,
    useCellColors,
    orientation = "vertical",
    angleDeg,
    rotationMode = "cell",
    overlapAmount = 1,
    backgroundHex,
    letters,
    gradient,
    backgroundGradient,
    blendMode,
  } = opts;
  const gapX = Math.max(0, opts.gapX ?? 0);
  const gapY = Math.max(0, opts.gapY ?? 0);
  const blendStyle = svgBlendStyle(blendMode);
  const resolvedAngleDeg = normalizeAngleDeg(angleDeg, orientation);
  const overlapRotation = rotationMode === "overlap";
  const resolvedOverlapAmount = overlapRotation ? Math.max(0, Math.min(4, overlapAmount)) : 1;
  const arbitraryAngle = !isAxisAlignedAngle(resolvedAngleDeg);
  const effectiveOrientation: StripeOrientation = orientation;
  const gridWidth = cols * cellWidthPx;
  const gridHeight = rows * cellHeightPx;
  const width = Math.max(1, opts.canvasWidthPx ?? gridWidth);
  const height = Math.max(1, opts.canvasHeightPx ?? gridHeight);

  const sortedStripes = [...stripes].sort((a, b) => a.startFrom - b.startFrom);
  const engineStripes = stripes.map((s) => ({
    color: parseInt(s.hex.replace(/^#/, ""), 16) || 0,
    startFrom: s.startFrom,
    width: s.width,
    opacity: s.opacity ?? 1,
  }));

  const bandAt = (svgRow: number, col: number): number => {
    // readPixels is bottom-up while SVG is top-down, so flip the row.
    const rbIndex = (rows - 1 - svgRow) * cols + col;
    return bandIndexForValue((values[rbIndex] ?? 0) / 255, engineStripes);
  };

  const pathsByBand = new Map<number, string[]>();
  const cellColorPaths: string[] = [];
  const clippedStripeElements: Array<{ depth: number; opacity: number; element: string }> = [];

  if (arbitraryAngle) {
    const rad = (resolvedAngleDeg * Math.PI) / 180;
    const axis = { x: Math.sin(rad), y: Math.cos(rad) };
    const normal = { x: Math.cos(rad), y: -Math.sin(rad) };
    const horizontalStacks = effectiveOrientation === "horizontal";
    const stackCellPx = horizontalStacks ? cellHeightPx : cellWidthPx;
    const axisCellPx = horizontalStacks ? cellWidthPx : cellHeightPx;
    const stackGapPx = horizontalStacks ? gapY : gapX;
    const axisGapPx = horizontalStacks ? gapX : gapY;
    const stackSpanPx = horizontalStacks ? height : width;
    const axisSpanPx = horizontalStacks ? width : height;
    const center = { x: width * 0.5, y: height * 0.5 };
    const corners = [
      { x: 0, y: 0 },
      { x: width, y: 0 },
      { x: width, y: height },
      { x: 0, y: height },
    ];
    const stackCoords = corners.map((corner) => {
      const dx = corner.x - center.x;
      const dy = corner.y - center.y;
      return dx * normal.x + dy * normal.y + stackSpanPx * 0.5;
    });
    const axisCoords = corners.map((corner) => {
      const dx = corner.x - center.x;
      const dy = corner.y - center.y;
      return dx * axis.x + dy * axis.y + axisSpanPx * 0.5;
    });
    const minStack = Math.floor(Math.min(...stackCoords) / stackCellPx) - 2;
    const maxStack = Math.ceil(Math.max(...stackCoords) / stackCellPx) + 2;
    const minAxis = Math.floor(Math.min(...axisCoords) / axisCellPx) - 2;
    const maxAxis = Math.ceil(Math.max(...axisCoords) / axisCellPx) + 2;
    const drawableStackPx = Math.max(0.0001, stackCellPx - Math.min(stackGapPx, stackCellPx));
    const drawableAxisPx = Math.max(0.0001, axisCellPx - Math.min(axisGapPx, axisCellPx));

    const valueAtPixel = (x: number, y: number): { value: number; rbIndex: number } => {
      const sourceCol = Math.max(0, Math.min(cols - 1, Math.floor(x / Math.max(cellWidthPx, 0.0001))));
      const sourceRow = Math.max(0, Math.min(rows - 1, Math.floor(y / Math.max(cellHeightPx, 0.0001))));
      const rbIndex = (rows - 1 - sourceRow) * cols + sourceCol;
      return { value: (values[rbIndex] ?? 0) / 255, rbIndex };
    };

    for (let stackIndex = minStack; stackIndex <= maxStack; stackIndex++) {
      const stackCenter = (stackIndex + 0.5) * stackCellPx;
      for (let axisIndex = minAxis; axisIndex <= maxAxis; axisIndex++) {
        const axisCenter = (axisIndex + 0.5) * axisCellPx;
        const cx = center.x + normal.x * (stackCenter - stackSpanPx * 0.5) + axis.x * (axisCenter - axisSpanPx * 0.5);
        const cy = center.y + normal.y * (stackCenter - stackSpanPx * 0.5) + axis.y * (axisCenter - axisSpanPx * 0.5);
        const { value } = valueAtPixel(cx, cy);
        const band = bandIndexForValue(value, engineStripes);
        const stripe = band >= 1 ? sortedStripes[band - 1] : undefined;
        if (band < 1 || !stripe) continue;

        const opacity = Math.max(0, Math.min(1, stripe.opacity ?? 1));
        const stripeWidth = Math.max(MIN_STRIPE_WIDTH_PX, Math.min(stripe.width, drawableStackPx));
        const halfNormal = stripeWidth * 0.5;
        const halfAxis = drawableAxisPx * 0.5 + halfNormal * resolvedOverlapAmount;
        const segment = rotatedStripePath(cx, cy, halfNormal, halfAxis, resolvedAngleDeg);

        pathsByBand.set(band, pathsByBand.get(band) ?? []);
        clippedStripeElements.push({
          depth: value,
          opacity,
          element: `  <path class="${svgStripeClass(band)}" d="${segment}" />`,
        });
      }
    }
  } else {
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const band = bandAt(row, col);
        const stripe = band >= 1 ? sortedStripes[band - 1] : undefined;
        if (band < 1 || !stripe) continue;

        const rbIndex = (rows - 1 - row) * cols + col;
        let x: number;
        let y: number;
        let rectW: number;
        let rectH: number;

        if (arbitraryAngle) {
          const stripeWidth = Math.max(
            MIN_STRIPE_WIDTH_PX,
            Math.min(stripe.width, Math.max(cellWidthPx, cellHeightPx)),
          );
          const cx = col * cellWidthPx + cellWidthPx * 0.5;
          const cy = row * cellHeightPx + cellHeightPx * 0.5;
          const segment = rotatedStripePath(
            cx,
            cy,
            stripeWidth * 0.5,
            Math.hypot(cellWidthPx, cellHeightPx) * resolvedOverlapAmount,
            resolvedAngleDeg,
          );
          if (useCellColors && colors) {
            const hex = cellColorHex(colors, rbIndex);
            const opacity = Math.max(0, Math.min(1, stripe.opacity ?? 1));
            const style = [`fill:${p3SvgColor(hex)}`, blendStyle].filter(Boolean).join(";");
            cellColorPaths.push(
              `  <path fill="${hex}" fill-opacity="${formatSvgNumber(opacity)}" style="${style}" d="${segment}" />`,
            );
          } else {
            clippedStripeElements.push({
              depth: (values[rbIndex] ?? 0) / 255,
              opacity: stripe.opacity ?? 1,
              element: `  <path class="${svgStripeClass(band)}" d="${segment}" />`,
            });
            pathsByBand.set(band, pathsByBand.get(band) ?? []);
          }
          continue;
        }

        if (effectiveOrientation === "horizontal") {
          const bandLeft = col > 0 ? bandAt(row, col - 1) : 0;
          const bandRight = col < cols - 1 ? bandAt(row, col + 1) : 0;
          const chainBreaksLeft = !sameStripeBand(band, bandLeft);
          const chainBreaksRight = !sameStripeBand(band, bandRight);

          let bandLeftPx = chainBreaksLeft ? ROW_WIDTH_GAP * 0.5 : 0;
          let bandRightPx = cellWidthPx - (chainBreaksRight ? ROW_WIDTH_GAP * 0.5 : 0);
          if (bandRightPx - bandLeftPx < cellWidthPx) {
            bandLeftPx = 0;
            bandRightPx = cellWidthPx;
          }

          const stripeWidth = Math.max(MIN_STRIPE_WIDTH_PX, Math.min(stripe.width, cellHeightPx));
          const halfH = stripeWidth * 0.5;
          const rowCenter = row * cellHeightPx + cellHeightPx * 0.5;
          x = col * cellWidthPx + bandLeftPx;
          y = rowCenter - halfH;
          rectW = bandRightPx - bandLeftPx;
          rectH = stripeWidth;
        } else {
          const bandAbove = row > 0 ? bandAt(row - 1, col) : 0;
          const bandBelow = row < rows - 1 ? bandAt(row + 1, col) : 0;
          const chainBreaksAbove = !sameStripeBand(band, bandAbove);
          const chainBreaksBelow = !sameStripeBand(band, bandBelow);

          let bandTop = chainBreaksAbove ? ROW_WIDTH_GAP * 0.5 : 0;
          let bandBottom = cellHeightPx - (chainBreaksBelow ? ROW_WIDTH_GAP * 0.5 : 0);
          if (bandBottom - bandTop < cellHeightPx) {
            bandTop = 0;
            bandBottom = cellHeightPx;
          }

          const stripeWidth = Math.max(MIN_STRIPE_WIDTH_PX, Math.min(stripe.width, cellWidthPx));
          const halfW = stripeWidth * 0.5;
          const columnCenter = col * cellWidthPx + cellWidthPx * 0.5;
          x = columnCenter - halfW;
          y = row * cellHeightPx + bandTop;
          rectW = stripeWidth;
          rectH = bandBottom - bandTop;
        }

        const segment = `M${x} ${y}h${rectW}v${rectH}h-${rectW}Z`;
        if (useCellColors && colors) {
          const hex = cellColorHex(colors, rbIndex);
          const opacity = Math.max(0, Math.min(1, stripe.opacity ?? 1));
          const style = [`fill:${p3SvgColor(hex)}`, blendStyle].filter(Boolean).join(";");
          cellColorPaths.push(
            `  <path fill="${hex}" fill-opacity="${formatSvgNumber(opacity)}" style="${style}" d="${segment}" />`,
          );
          continue;
        }
        const list = pathsByBand.get(band) ?? [];
        list.push(segment);
        pathsByBand.set(band, list);
      }
    }
  }

  const backgroundRect = backgroundGradient
    ? `  <rect width="${width}" height="${height}" fill="url(#backgroundGradient)" />`
    : backgroundHex
      ? `  <rect width="${width}" height="${height}" fill="${normalizeSvgHex(backgroundHex)}" style="fill:${p3SvgColor(backgroundHex)}" />`
      : "";
  const letterLayer = buildTextLettersSvg(letters, {
    cols,
    rows,
    cellWidthPx,
    cellHeightPx,
    orientation: effectiveOrientation,
  });
  const gradientDefs = [
    backgroundGradient ? buildSvgGradientDef(backgroundGradient, "backgroundGradient") : "",
    gradient ? buildSvgGradientDef(gradient, "stripeGradient") : "",
  ]
    .filter(Boolean)
    .join("\n");

  if (useCellColors && !arbitraryAngle) {
    const styleBlock = letterLayer.style ? ["<style>", letterLayer.style, "</style>"].join("\n") : "";
    const cellColorLayer = [cellColorPaths.join("\n"), letterLayer.elements].filter(Boolean).join("\n");
    return [
      `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" overflow="hidden">`,
      gradientDefs,
      backgroundRect,
      styleBlock,
      cellColorLayer,
      `</svg>`,
    ]
      .filter(Boolean)
      .join("\n");
  }

  const usedBands = [...pathsByBand.keys()].sort((a, b) => a - b);
  const styleRules = usedBands.map((band) => {
    const stripe = sortedStripes[band - 1];
    if (gradient) {
      const opacity = Math.max(0, Math.min(1, stripe?.opacity ?? 1));
      return `  .${svgStripeClass(band)} { fill: url(#stripeGradient); fill-opacity: ${formatSvgNumber(opacity)};${blendStyle ? ` ${blendStyle}` : ""} }`;
    }
    const opacity = Math.max(0, Math.min(1, stripe?.opacity ?? 1));
    return `  .${svgStripeClass(band)} { fill: ${stripe?.hex ?? "#000000"}; fill-opacity: ${formatSvgNumber(opacity)};${blendStyle ? ` ${blendStyle}` : ""} }`;
  });
  const p3Rules = gradient
    ? []
    : usedBands.map((band) => {
        return `    .${svgStripeClass(band)} { fill: ${p3SvgColor(sortedStripes[band - 1]?.hex ?? "#000000")}; }`;
      });
  const styleBlock =
    usedBands.length > 0 || letterLayer.style
      ? [
          "<style>",
          ...styleRules,
          letterLayer.style,
          ...(p3Rules.length > 0 ? ["  @supports (fill: color(display-p3 1 1 1)) {", ...p3Rules, "  }"] : []),
          "</style>",
        ].join("\n")
      : "";
  const pathElements = usedBands
    .map((band) => `  <path class="${svgStripeClass(band)}" d="${(pathsByBand.get(band) ?? []).join(" ")}" />`)
    .filter((path) => !path.includes('d=""'))
    .join("\n");
  const orderedClippedStripeElements = overlapRotation
    ? clippedStripeElements
    : clippedStripeElements.sort((a, b) => a.depth - b.depth || a.opacity - b.opacity);
  const clippedPathElements = orderedClippedStripeElements.map((item) => item.element).join("\n");
  const stripeLayer = [pathElements, clippedPathElements, letterLayer.elements].filter(Boolean).join("\n");

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" overflow="hidden">`,
    gradientDefs,
    backgroundRect,
    styleBlock,
    stripeLayer,
    `</svg>`,
  ]
    .filter(Boolean)
    .join("\n");
}

export function downloadSvg(svg: string, filename = "stripes.svg"): void {
  const blob = new Blob([svg], { type: "image/svg+xml" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
