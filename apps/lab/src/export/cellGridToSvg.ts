import { bandIndexForValue, stripeDotBandEligibility } from "@necatikcl/stripes-engine";
import { p3ColorForHex } from "../components/colorLibrary";

const ROW_WIDTH_GAP = 1;
const MIN_STRIPE_WIDTH_PX = 0.5;

type LabStripe = { hex: string; startFrom: number; width: number; opacity?: number };
type WidthSparkleSvgOptions = {
  enabled: boolean;
  coverage: number;
  swingPx: number;
  swingPeriodMin: number;
  swingPeriodMax: number;
};
type StripeDotsSvgOptions = {
  enabled: boolean;
  density: number;
  sizePx: number;
  brightness: number;
};
type StripeBorderSvgOptions = {
  enabled: boolean;
  minWidthPx: number;
  density: number;
};
type GridLinesSvgOptions = {
  enabled: boolean;
  brightness: number;
  density: number;
};
type SvgGradientOptions = {
  direction: "topToBottom" | "leftToRight" | "rightToLeft" | "bottomToTop";
  stopCount: number;
  stops: string[];
  hueDriftDeg?: number;
  saturationBoost?: number;
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

function fract(value: number): number {
  return value - Math.floor(value);
}

function sparkleHash(px: number, py: number): number {
  let p3x = fract(px * 0.1031);
  let p3y = fract(py * 0.103);
  let p3z = fract(px * 0.0973);
  const dotVal = p3x * (p3y + 33.33) + p3y * (p3z + 33.33) + p3z * (p3x + 33.33);
  p3x = fract(p3x + dotVal);
  p3y = fract(p3y + dotVal);
  p3z = fract(p3z + dotVal);
  return fract((p3x + p3y) * p3z);
}

function pulseEnvelope(localT: number): number {
  if (localT < 0 || localT > 1) return 0;
  const cosine = 0.5 - 0.5 * Math.cos(2 * Math.PI * localT);
  const c = Math.max(0, Math.min(1, cosine));
  return c * c * (3 - 2 * c);
}

function frameZeroShuffledWidth(
  col: number,
  row: number,
  defaultWidth: number,
  sparkle: WidthSparkleSvgOptions,
  maxCellPx: number,
): number {
  if (defaultWidth <= 0) return defaultWidth;
  if (sparkleHash(col + 17, row + 31) >= sparkle.coverage) return defaultWidth;
  const period =
    sparkle.swingPeriodMin + sparkleHash(col + 89, row + 113) * (sparkle.swingPeriodMax - sparkle.swingPeriodMin);
  const cyclePeriod = period / Math.max(sparkle.coverage, 0.001);
  const phaseOffset = sparkleHash(col + 53, row + 71) * cyclePeriod;
  const cycleIndex = Math.floor(phaseOffset / cyclePeriod);
  const localTime = phaseOffset - cycleIndex * cyclePeriod;
  if (localTime >= period) return defaultWidth;
  const h = sparkleHash(col + 53 + cycleIndex * 61, row + 71 + cycleIndex * 101);
  const maxWidth = Math.min(255, maxCellPx);
  const targetWidth = Math.max(1, Math.min(maxWidth, defaultWidth + (h * 2 - 1) * Math.max(sparkle.swingPx, 0)));
  return defaultWidth + (targetWidth - defaultWidth) * pulseEnvelope(localTime / period);
}

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

export function rotatedStripePath(
  cx: number,
  cy: number,
  halfNormal: number,
  halfAxis: number,
  angleDeg: number,
): string {
  const rad = (angleDeg * Math.PI) / 180;
  // The shader rotates in WebGL's Y-up coordinates. SVG's Y axis points down,
  // so mirror both basis vectors vertically to preserve the visible angle.
  const axis = { x: Math.sin(rad), y: -Math.cos(rad) };
  const normal = { x: Math.cos(rad), y: Math.sin(rad) };
  const point = (normalSign: number, axisSign: number) => {
    const x = cx + normal.x * halfNormal * normalSign + axis.x * halfAxis * axisSign;
    const y = cy + normal.y * halfNormal * normalSign + axis.y * halfAxis * axisSign;
    return `${formatSvgNumber(x)} ${formatSvgNumber(y)}`;
  };
  return `M${point(-1, -1)}L${point(1, -1)}L${point(1, 1)}L${point(-1, 1)}Z`;
}

function outlinedRotatedStripePath(
  cx: number,
  cy: number,
  halfNormal: number,
  halfAxis: number,
  angleDeg: number,
): string {
  const outer = rotatedStripePath(cx, cy, halfNormal, halfAxis, angleDeg);
  const innerHalfNormal = Math.max(0, halfNormal - 1);
  const innerHalfAxis = Math.max(0, halfAxis - 1);
  if (innerHalfNormal <= 0 || innerHalfAxis <= 0) return outer;
  return `${outer}${rotatedStripePath(cx, cy, innerHalfNormal, innerHalfAxis, angleDeg)}`;
}

function rectanglePath(x: number, y: number, width: number, height: number): string {
  return `M${formatSvgNumber(x)} ${formatSvgNumber(y)}h${formatSvgNumber(width)}v${formatSvgNumber(height)}h-${formatSvgNumber(width)}Z`;
}

function outlinedRectanglePath(x: number, y: number, width: number, height: number): string {
  const outer = rectanglePath(x, y, width, height);
  const innerWidth = Math.max(0, width - 2);
  const innerHeight = Math.max(0, height - 2);
  if (innerWidth <= 0 || innerHeight <= 0) return outer;
  return `${outer}${rectanglePath(x + 1, y + 1, innerWidth, innerHeight)}`;
}

function stripeBorderApplies(
  col: number,
  row: number,
  stripeWidth: number,
  border: StripeBorderSvgOptions | undefined,
): boolean {
  if (!border?.enabled || stripeWidth < border.minWidthPx) return false;
  const density = Math.max(0, Math.min(1, border.density));
  if (density <= 0.001) return false;
  return density >= 0.999 || sparkleHash(col + 17, row + 31) <= density;
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

function hexToRgb(value: string): [number, number, number] {
  const raw = normalizeSvgHex(value).replace(/^#/, "");
  return [
    Number.parseInt(raw.slice(0, 2), 16) / 255,
    Number.parseInt(raw.slice(2, 4), 16) / 255,
    Number.parseInt(raw.slice(4, 6), 16) / 255,
  ];
}

function rgbToHex([r, g, b]: [number, number, number]): string {
  return `#${[r, g, b]
    .map((channel) =>
      Math.round(Math.max(0, Math.min(1, channel)) * 255)
        .toString(16)
        .padStart(2, "0"),
    )
    .join("")}`;
}

function colorLightness([r, g, b]: [number, number, number]): number {
  return (Math.max(r, g, b) + Math.min(r, g, b)) * 0.5;
}

function withLightness(base: [number, number, number], targetLightness: number): [number, number, number] {
  const currentLightness = colorLightness(base);
  const target = Math.max(0, Math.min(1, targetLightness));
  if (currentLightness < 0.0001 || currentLightness > 0.9999) return [target, target, target];
  if (target < currentLightness) {
    const ratio = target / currentLightness;
    return [base[0] * ratio, base[1] * ratio, base[2] * ratio];
  }
  const ratio = (1 - target) / (1 - currentLightness);
  return [1 - (1 - base[0]) * ratio, 1 - (1 - base[1]) * ratio, 1 - (1 - base[2]) * ratio];
}

function rgbToHsl([r, g, b]: [number, number, number]): [number, number, number] {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) * 0.5;
  if (Math.abs(max - min) < 0.0001) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  const h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h / 6, s, l];
}

function hueToRgb(p: number, q: number, value: number): number {
  let t = value;
  if (t < 0) t += 1;
  if (t > 1) t -= 1;
  if (t < 1 / 6) return p + (q - p) * 6 * t;
  if (t < 1 / 2) return q;
  if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
  return p;
}

function hslToRgb([h, s, l]: [number, number, number]): [number, number, number] {
  const hue = ((h % 1) + 1) % 1;
  const sat = Math.max(0, Math.min(1, s));
  const light = Math.max(0, Math.min(1, l));
  if (sat < 0.0001) return [light, light, light];
  const q = light < 0.5 ? light * (1 + sat) : light + sat - light * sat;
  const p = 2 * light - q;
  return [hueToRgb(p, q, hue + 1 / 3), hueToRgb(p, q, hue), hueToRgb(p, q, hue - 1 / 3)];
}

function gradientRampTone(
  rgb: [number, number, number],
  gradient: SvgGradientOptions,
  rampT: number,
): [number, number, number] {
  const [h, s, l] = rgbToHsl(rgb);
  if (s <= 0.0001) return rgb;
  const t = Math.max(0, Math.min(1, rampT));
  const hue = h + ((gradient.hueDriftDeg ?? 0) * t) / 360;
  const satLift = Math.max(0, Math.min(1, gradient.saturationBoost ?? 0)) * Math.sin(t * Math.PI * 0.85);
  return hslToRgb([hue, Math.max(0, Math.min(1, s * (1 + satLift))), l]);
}

function stripeDotHex(stripeHex: string, dots: StripeDotsSvgOptions): string {
  return brightnessLiftHex(stripeHex, dots.brightness);
}

function brightnessLiftHex(stripeHex: string, brightness: number): string {
  if (brightness <= 0) return normalizeSvgHex(stripeHex);
  const [hue, saturation, stripeLightness] = rgbToHsl(hexToRgb(stripeHex));
  const lightnessLift = Math.max(0, Math.min(1, brightness));
  return rgbToHex(hslToRgb([hue, saturation, Math.min(1, stripeLightness + lightnessLift)]));
}

function stripeDotElement(input: {
  cx: number;
  cy: number;
  eligible: boolean;
  stripeWidth: number;
  stripeHex: string;
  stripeOpacity: number;
  dots: StripeDotsSvgOptions | undefined;
  blendStyle: string;
}): string {
  const { dots } = input;
  if (!dots?.enabled || !input.eligible || input.stripeWidth < 2 || input.stripeOpacity <= 0.001) {
    return "";
  }

  const hex = stripeDotHex(input.stripeHex, dots);
  const radius = Math.max(1, Math.min(2, dots.sizePx)) * 0.5;
  const style = [`fill:${p3SvgColor(hex)}`, input.blendStyle].filter(Boolean).join(";");
  return `  <circle class="stripe-dot" cx="${formatSvgNumber(input.cx)}" cy="${formatSvgNumber(input.cy)}" r="${formatSvgNumber(radius)}" fill="${hex}" fill-opacity="${formatSvgNumber(input.stripeOpacity)}" style="${style}" />`;
}

function gradientPositionAt(gradient: SvgGradientOptions, x: number, y: number, width: number, height: number): number {
  const nx = Math.max(0, Math.min(1, x / Math.max(1, width)));
  const ny = Math.max(0, Math.min(1, y / Math.max(1, height)));
  if (gradient.direction === "leftToRight") return nx;
  if (gradient.direction === "rightToLeft") return 1 - nx;
  if (gradient.direction === "bottomToTop") return 1 - ny;
  return ny;
}

function gradientColorAt(
  gradient: SvgGradientOptions,
  x: number,
  y: number,
  width: number,
  height: number,
): [number, number, number] {
  const stopCount = Math.max(2, Math.min(4, Math.round(gradient.stopCount)));
  const stops = gradient.stops.slice(0, stopCount).map(hexToRgb);
  while (stops.length < stopCount) stops.push(stops[stops.length - 1] ?? [0, 0, 0]);
  const t = gradientPositionAt(gradient, x, y, width, height);
  const scaled = t * (stopCount - 1);
  const index = Math.max(0, Math.min(stopCount - 2, Math.floor(scaled)));
  const localT = scaled - index;
  const a = stops[index] ?? [0, 0, 0];
  const b = stops[index + 1] ?? a;
  return [a[0] + (b[0] - a[0]) * localT, a[1] + (b[1] - a[1]) * localT, a[2] + (b[2] - a[2]) * localT];
}

function gradientAverageColor(gradient: SvgGradientOptions): [number, number, number] {
  const stopCount = Math.max(2, Math.min(4, Math.round(gradient.stopCount)));
  const stops = gradient.stops.slice(0, stopCount).map(hexToRgb);
  while (stops.length < stopCount) stops.push(stops[stops.length - 1] ?? [0, 0, 0]);
  return stops.reduce<[number, number, number]>(
    (sum, stop) => [sum[0] + stop[0] / stopCount, sum[1] + stop[1] / stopCount, sum[2] + stop[2] / stopCount],
    [0, 0, 0],
  );
}

function gradientRampStripeHex(
  gradient: SvgGradientOptions,
  x: number,
  y: number,
  width: number,
  height: number,
  stripeHex: string,
  rampT: number,
): string {
  const gradientRgb = gradientRampTone(gradientColorAt(gradient, x, y, width, height), gradient, rampT);
  const baseLightness = colorLightness(gradientAverageColor(gradient));
  const lightnessLift = Math.max(0, colorLightness(hexToRgb(stripeHex)) - baseLightness);
  const targetLightness = colorLightness(gradientRgb) + lightnessLift;
  return rgbToHex(withLightness(gradientRgb, targetLightness));
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
    streamGapWave?: {
      enabled: boolean;
      squeeze: number;
      wavelengthCells: number;
      phaseDeg: number;
    };
    backgroundHex?: string;
    letters?: LettersSvgOptions;
    gradient?: SvgGradientOptions;
    backgroundGradient?: SvgGradientOptions;
    /** Raster backdrop (e.g. Connect fill underlay) drawn behind stripes. */
    backgroundImageHref?: string;
    /** Ordered raster underlays drawn behind stripes. Later entries appear above earlier entries. */
    backgroundImageHrefs?: readonly string[];
    /** Trusted vector markup drawn above raster underlays and behind stripes. */
    backgroundSvgLayer?: string;
    blendMode?: SvgBlendMode;
    widthSparkle?: WidthSparkleSvgOptions;
    stripeDots?: StripeDotsSvgOptions;
    stripeBorder?: StripeBorderSvgOptions;
    gridLines?: GridLinesSvgOptions;
    framesSvgLayer?: string;
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
    streamGapWave,
    backgroundHex,
    letters,
    gradient,
    backgroundGradient,
    backgroundImageHref,
    backgroundImageHrefs,
    backgroundSvgLayer,
    blendMode,
    widthSparkle,
    stripeDots,
    stripeBorder,
    gridLines,
    framesSvgLayer,
  } = opts;
  const gapX = Math.max(0, opts.gapX ?? 0);
  const gapY = Math.max(0, opts.gapY ?? 0);
  const blendStyle = svgBlendStyle(blendMode);
  const dynamicGradientRamp = !!gradient && !useCellColors;
  const resolvedAngleDeg = normalizeAngleDeg(angleDeg, orientation);
  const overlapRotation = rotationMode === "overlap";
  const resolvedOverlapAmount = overlapRotation ? Math.max(0, Math.min(4, overlapAmount)) : 1;
  const arbitraryAngle = !isAxisAlignedAngle(resolvedAngleDeg);
  const effectiveOrientation: StripeOrientation = orientation;
  const axisAlignedHorizontal = Math.abs(resolvedAngleDeg - 90) < 0.001;
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
  const dotEligibleBands = stripeDotBandEligibility(engineStripes, stripeDots?.density ?? 0);

  const bandAt = (svgRow: number, col: number): number => {
    // readPixels is bottom-up while SVG is top-down, so flip the row.
    const rbIndex = (rows - 1 - svgRow) * cols + col;
    return bandIndexForValue((values[rbIndex] ?? 0) / 255, engineStripes);
  };

  const sparkleWidthAt = (col: number, row: number, baseWidth: number): number =>
    widthSparkle?.enabled
      ? frameZeroShuffledWidth(col, row, baseWidth, widthSparkle, Math.max(cellWidthPx, cellHeightPx))
      : baseWidth;

  const rampTForBand = (band: number): number =>
    band < 1 ? 0 : sortedStripes.length <= 1 ? 1 : (band - 1) / (sortedStripes.length - 1);

  const pathsByBand = new Map<number, string[]>();
  const cellColorPathGroups = new Map<string, { hex: string; opacity: number; style: string; segments: string[] }>();
  const addCellColorPath = (hex: string, opacity: number, style: string, segment: string) => {
    const key = `${hex}|${formatSvgNumber(opacity)}|${style}`;
    const group = cellColorPathGroups.get(key) ?? { hex, opacity, style, segments: [] };
    group.segments.push(segment);
    cellColorPathGroups.set(key, group);
  };
  const clippedStripeElements: Array<{ depth: number; opacity: number; element: string }> = [];
  const gradientRampPaths: string[] = [];
  const stripeBorderElements: string[] = [];
  const stripeDotElements: string[] = [];
  const gridLinePathGroups = new Map<string, string[]>();

  if (arbitraryAngle) {
    const rad = (resolvedAngleDeg * Math.PI) / 180;
    const axis = { x: Math.sin(rad), y: -Math.cos(rad) };
    const normal = { x: Math.cos(rad), y: Math.sin(rad) };
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
    const gapWaveStep = (Math.PI * 2) / Math.max(2, streamGapWave?.wavelengthCells ?? 16);
    const gapWaveAmplitude = streamGapWave?.enabled
      ? (Math.max(0, Math.min(1, streamGapWave.squeeze)) * stackCellPx) /
        Math.max(2 * Math.sin(gapWaveStep * 0.5), 0.001)
      : 0;
    const gapWavePhase = ((streamGapWave?.phaseDeg ?? 0) * Math.PI) / 180;
    const gapWaveMargin = Math.ceil(gapWaveAmplitude / stackCellPx) + 2;
    const minStack = Math.floor(Math.min(...stackCoords) / stackCellPx) - gapWaveMargin;
    const maxStack = Math.ceil(Math.max(...stackCoords) / stackCellPx) + gapWaveMargin;
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
      const stackCenter =
        (stackIndex + 0.5) * stackCellPx + Math.sin(stackIndex * gapWaveStep + gapWavePhase) * gapWaveAmplitude;
      for (let axisIndex = minAxis; axisIndex <= maxAxis; axisIndex++) {
        const axisCenter = (axisIndex + 0.5) * axisCellPx;
        const cx = center.x + normal.x * (stackCenter - stackSpanPx * 0.5) + axis.x * (axisCenter - axisSpanPx * 0.5);
        const cy = center.y + normal.y * (stackCenter - stackSpanPx * 0.5) + axis.y * (axisCenter - axisSpanPx * 0.5);
        const { value, rbIndex } = valueAtPixel(cx, cy);
        const band = bandIndexForValue(value, engineStripes);
        const stripe = band >= 1 ? sortedStripes[band - 1] : undefined;
        if (band < 1 || !stripe) continue;

        const opacity = Math.max(0, Math.min(1, stripe.opacity ?? 1));
        const sparkleCol = horizontalStacks ? axisIndex : stackIndex;
        const sparkleRow = horizontalStacks ? stackIndex : axisIndex;
        const stripeWidth = Math.max(
          MIN_STRIPE_WIDTH_PX,
          Math.min(sparkleWidthAt(sparkleCol, sparkleRow, stripe.width), drawableStackPx),
        );
        const halfNormal = stripeWidth * 0.5;
        const halfAxis = drawableAxisPx * 0.5 + halfNormal * resolvedOverlapAmount;
        const bordered = stripeBorderApplies(sparkleCol, sparkleRow, stripeWidth, stripeBorder);
        const segment = bordered
          ? outlinedRotatedStripePath(cx, cy, halfNormal, drawableAxisPx * 0.5, resolvedAngleDeg)
          : rotatedStripePath(cx, cy, halfNormal, halfAxis, resolvedAngleDeg);
        const borderAttributes = bordered ? ` class="stripe-border" fill-rule="evenodd"` : "";
        const stripeHex =
          useCellColors && colors
            ? cellColorHex(colors, rbIndex)
            : dynamicGradientRamp && gradient
              ? gradientRampStripeHex(gradient, cx, cy, width, height, stripe.hex, rampTForBand(band))
              : stripe.hex;
        const dotElement = stripeDotElement({
          cx,
          cy,
          eligible: dotEligibleBands[band - 1] === true,
          stripeWidth,
          stripeHex,
          stripeOpacity: opacity,
          dots: stripeDots,
          blendStyle,
        });

        if (useCellColors || dynamicGradientRamp) {
          const style = [`fill:${p3SvgColor(stripeHex)}`, blendStyle].filter(Boolean).join(";");
          clippedStripeElements.push({
            depth: value,
            opacity,
            element: [
              `  <path${borderAttributes} fill="${stripeHex}" fill-opacity="${formatSvgNumber(opacity)}" style="${style}" d="${segment}" />`,
              dotElement,
            ]
              .filter(Boolean)
              .join("\n"),
          });
        } else {
          pathsByBand.set(band, pathsByBand.get(band) ?? []);
          clippedStripeElements.push({
            depth: value,
            opacity,
            element: [
              `  <path class="${svgStripeClass(band)}${bordered ? " stripe-border" : ""}"${bordered ? ` fill-rule="evenodd"` : ""} d="${segment}" />`,
              dotElement,
            ]
              .filter(Boolean)
              .join("\n"),
          });
        }
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
        let effectiveStripeWidth: number;

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
            addCellColorPath(hex, opacity, style, segment);
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

        if (axisAlignedHorizontal) {
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

          effectiveStripeWidth = Math.max(
            MIN_STRIPE_WIDTH_PX,
            Math.min(sparkleWidthAt(col, rows - 1 - row, stripe.width), cellHeightPx),
          );
          const halfH = effectiveStripeWidth * 0.5;
          const rowCenter = row * cellHeightPx + cellHeightPx * 0.5;
          x = col * cellWidthPx + bandLeftPx;
          y = rowCenter - halfH;
          rectW = bandRightPx - bandLeftPx;
          rectH = effectiveStripeWidth;
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

          effectiveStripeWidth = Math.max(
            MIN_STRIPE_WIDTH_PX,
            Math.min(sparkleWidthAt(col, rows - 1 - row, stripe.width), cellWidthPx),
          );
          const halfW = effectiveStripeWidth * 0.5;
          const columnCenter = col * cellWidthPx + cellWidthPx * 0.5;
          x = columnCenter - halfW;
          y = row * cellHeightPx + bandTop;
          rectW = effectiveStripeWidth;
          rectH = bandBottom - bandTop;
        }

        const borderRow = rows - 1 - row;
        const bordered = stripeBorderApplies(col, borderRow, effectiveStripeWidth, stripeBorder);
        const segment = bordered ? outlinedRectanglePath(x, y, rectW, rectH) : rectanglePath(x, y, rectW, rectH);
        const dotCx = (col + 0.5) * cellWidthPx;
        const dotCy = (row + 0.5) * cellHeightPx;
        const dotStripeHex =
          useCellColors && colors
            ? cellColorHex(colors, rbIndex)
            : dynamicGradientRamp && gradient
              ? gradientRampStripeHex(gradient, dotCx, dotCy, width, height, stripe.hex, rampTForBand(band))
              : stripe.hex;
        const dotElement = stripeDotElement({
          cx: dotCx,
          cy: dotCy,
          eligible: dotEligibleBands[band - 1] === true,
          stripeWidth: effectiveStripeWidth,
          stripeHex: dotStripeHex,
          stripeOpacity: Math.max(0, Math.min(1, stripe.opacity ?? 1)),
          dots: stripeDots,
          blendStyle,
        });
        if (dotElement) stripeDotElements.push(dotElement);

        if (bordered) {
          const opacity = Math.max(0, Math.min(1, stripe.opacity ?? 1));
          if (useCellColors || dynamicGradientRamp) {
            const style = [`fill:${p3SvgColor(dotStripeHex)}`, blendStyle].filter(Boolean).join(";");
            stripeBorderElements.push(
              `  <path class="stripe-border" fill="${dotStripeHex}" fill-opacity="${formatSvgNumber(opacity)}" fill-rule="evenodd" style="${style}" d="${segment}" />`,
            );
          } else {
            pathsByBand.set(band, pathsByBand.get(band) ?? []);
            stripeBorderElements.push(
              `  <path class="${svgStripeClass(band)} stripe-border" fill-rule="evenodd" d="${segment}" />`,
            );
          }
          continue;
        }

        if (useCellColors && colors) {
          const hex = cellColorHex(colors, rbIndex);
          const opacity = Math.max(0, Math.min(1, stripe.opacity ?? 1));
          const style = [`fill:${p3SvgColor(hex)}`, blendStyle].filter(Boolean).join(";");
          addCellColorPath(hex, opacity, style, segment);
          continue;
        }
        if (dynamicGradientRamp && gradient) {
          const cx = x + rectW * 0.5;
          const cy = y + rectH * 0.5;
          const hex = gradientRampStripeHex(gradient, cx, cy, width, height, stripe.hex, rampTForBand(band));
          const opacity = Math.max(0, Math.min(1, stripe.opacity ?? 1));
          const style = [`fill:${p3SvgColor(hex)}`, blendStyle].filter(Boolean).join(";");
          gradientRampPaths.push(
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

  const gridLineDensity = Math.max(0, Math.min(1, gridLines?.density ?? 1));
  const addGridLineSegment = (hex: string, segment: string) => {
    const normalized = normalizeSvgHex(hex);
    const segments = gridLinePathGroups.get(normalized) ?? [];
    segments.push(segment);
    gridLinePathGroups.set(normalized, segments);
  };
  const gridLineHexAt = (row: number, col: number, x: number, y: number): string => {
    const safeRow = Math.max(0, Math.min(rows - 1, row));
    const safeCol = Math.max(0, Math.min(cols - 1, col));
    const rbIndex = (rows - 1 - safeRow) * cols + safeCol;
    const band = bandAt(safeRow, safeCol);
    const stripe = band >= 1 ? sortedStripes[band - 1] : undefined;
    const baseHex =
      useCellColors && colors
        ? cellColorHex(colors, rbIndex)
        : dynamicGradientRamp && gradient && stripe
          ? gradientRampStripeHex(gradient, x, y, width, height, stripe.hex, rampTForBand(band))
          : (stripe?.hex ?? backgroundHex ?? sortedStripes[0]?.hex ?? "#000000");
    return brightnessLiftHex(baseHex, gridLines?.brightness ?? 0);
  };
  if (gridLines?.enabled && gridLineDensity > 0.001 && rows > 0 && cols > 0) {
    for (let row = 0; row < rows; row++) {
      const shaderRow = rows - 1 - row;
      for (let col = 0; col < cols; col++) {
        const visible = gridLineDensity >= 0.999 || sparkleHash(col + 228, shaderRow + 338) <= gridLineDensity;
        if (!visible) continue;
        const x = col * cellWidthPx;
        const y = row * cellHeightPx;
        addGridLineSegment(
          gridLineHexAt(row, col, x + cellWidthPx * 0.5, y + cellHeightPx * 0.5),
          `M${x} ${y}h${cellWidthPx}v${cellHeightPx}h${-cellWidthPx}Z`,
        );
      }
    }
  }
  const gridLineLayer = [...gridLinePathGroups.entries()]
    .map(([hex, segments]) => {
      const style = [`stroke:${p3SvgColor(hex)}`, blendStyle].filter(Boolean).join(";");
      return `  <path class="grid-line" d="${segments.join(" ")}" fill="none" stroke="${hex}" stroke-width="1" stroke-linecap="square" stroke-linejoin="miter" style="${style}" />`;
    })
    .join("\n");

  const backgroundRect = backgroundGradient
    ? `  <rect width="${width}" height="${height}" fill="url(#backgroundGradient)" />`
    : backgroundHex
      ? `  <rect width="${width}" height="${height}" fill="${normalizeSvgHex(backgroundHex)}" style="fill:${p3SvgColor(backgroundHex)}" />`
      : "";
  const backgroundImages = [
    ...(typeof backgroundImageHref === "string" && backgroundImageHref.length > 0 ? [backgroundImageHref] : []),
    ...(backgroundImageHrefs ?? []).filter((href) => typeof href === "string" && href.length > 0),
  ]
    .map(
      (href) => `  <image href="${escapeXml(href)}" width="${width}" height="${height}" preserveAspectRatio="none" />`,
    )
    .join("\n");
  const letterLayer = buildTextLettersSvg(letters, {
    cols,
    rows,
    cellWidthPx,
    cellHeightPx,
    orientation: effectiveOrientation,
  });
  const gradientDefs = [
    backgroundGradient ? buildSvgGradientDef(backgroundGradient, "backgroundGradient") : "",
    gradient && !dynamicGradientRamp ? buildSvgGradientDef(gradient, "stripeGradient") : "",
  ]
    .filter(Boolean)
    .join("\n");

  if (useCellColors && !arbitraryAngle) {
    const styleBlock = letterLayer.style ? ["<style>", letterLayer.style, "</style>"].join("\n") : "";
    const compactCellColorPaths = [...cellColorPathGroups.values()]
      .map(
        ({ hex, opacity, style, segments }) =>
          `  <path fill="${hex}" fill-opacity="${formatSvgNumber(opacity)}" style="${style}" d="${segments.join(" ")}" />`,
      )
      .join("\n");
    const cellColorLayer = [
      compactCellColorPaths,
      stripeBorderElements.join("\n"),
      stripeDotElements.join("\n"),
      gridLineLayer,
      letterLayer.elements,
    ]
      .filter(Boolean)
      .join("\n");
    return [
      `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" overflow="hidden">`,
      gradientDefs,
      backgroundRect,
      backgroundImages,
      backgroundSvgLayer,
      styleBlock,
      cellColorLayer,
      framesSvgLayer,
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
          ...(p3Rules.length > 0 ? ["  @supports (fill: color(display-p3 1 1 1)) {", ...p3Rules, "  }"] : []),
          letterLayer.style,
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
  const stripeLayer = [
    pathElements,
    gradientRampPaths.join("\n"),
    clippedPathElements,
    stripeBorderElements.join("\n"),
    stripeDotElements.join("\n"),
    gridLineLayer,
    letterLayer.elements,
  ]
    .filter(Boolean)
    .join("\n");

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" overflow="hidden">`,
    gradientDefs,
    backgroundRect,
    backgroundImages,
    backgroundSvgLayer,
    styleBlock,
    stripeLayer,
    framesSvgLayer,
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
