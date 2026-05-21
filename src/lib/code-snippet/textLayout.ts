import { measureNaturalWidth, prepareWithSegments, type PreparedTextWithSegments } from "@chenglou/pretext";
import { CODE_SNIPPET_PRETEXT_FONT } from "../../fonts/codeSnippet";
import type { CodeSnippetToken } from "./highlight";

export const CODE_SNIPPET_PADDING_PX = 20;
export const CODE_SNIPPET_LINE_HEIGHT_PX = 20;
export const CODE_SNIPPET_MIN_TOKEN_GAP_PX = 4;

export type PositionedCodeSpan = {
  x: number;
  y: number;
  text: string;
  colorHex: string;
};

const preparedCache = new Map<string, PreparedTextWithSegments>();

let canvasMeasureContext: CanvasRenderingContext2D | null | undefined;
let canvasMeasureReliable: boolean | undefined;

const measureWithCanvas = (displayText: string): number | null => {
  if (typeof document === "undefined") {
    return null;
  }
  if (canvasMeasureContext === undefined) {
    const canvas = document.createElement("canvas");
    canvasMeasureContext = canvas.getContext("2d");
    if (canvasMeasureContext) {
      canvasMeasureContext.font = CODE_SNIPPET_PRETEXT_FONT;
    }
  }
  if (!canvasMeasureContext) {
    return null;
  }
  const width = canvasMeasureContext.measureText(displayText).width;
  return Number.isFinite(width) && width > 0 ? width : null;
};

const isCanvasMeasureReliable = (): boolean => {
  if (canvasMeasureReliable !== undefined) {
    return canvasMeasureReliable;
  }
  const narrow = measureWithCanvas("i");
  const wide = measureWithCanvas("ii");
  canvasMeasureReliable = narrow !== null && wide !== null && wide > narrow + 0.01;
  return canvasMeasureReliable;
};

let cachedSpaceWidth: number | null = null;

const getSpaceWidth = (_innerWidth?: number): number => {
  if (cachedSpaceWidth !== null) {
    return cachedSpaceWidth;
  }
  const canvasWidth = isCanvasMeasureReliable() ? measureWithCanvas(" ") : null;
  if (canvasWidth !== null) {
    cachedSpaceWidth = canvasWidth;
    return canvasWidth;
  }
  const prepared = getPreparedForToken(" ");
  if (prepared) {
    const width = measureNaturalWidth(prepared);
    if (Number.isFinite(width) && width > 0) {
      cachedSpaceWidth = width;
      return width;
    }
  }
  cachedSpaceWidth = FALLBACK_CHAR_WIDTH_PX;
  return cachedSpaceWidth;
};

/** Pretext line width ignores trailing whitespace; add it back for per-token layout boxes. */
const measureWithPretextIncludingEdgeSpaces = (displayText: string, innerWidth?: number): number | null => {
  const leading = displayText.match(/^\s*/)?.[0].length ?? 0;
  const trailing = displayText.match(/\s*$/)?.[0].length ?? 0;
  const core = displayText.slice(leading, displayText.length - trailing);
  if (!core.length) {
    return (leading + trailing) * getSpaceWidth(innerWidth);
  }

  const prepared = getPreparedForToken(core);
  if (!prepared) {
    return null;
  }
  const maxReasonableWidth = innerWidth === undefined ? core.length * 24 : Math.max(innerWidth / 3, core.length * 12);
  const coreWidth = measureNaturalWidth(prepared);
  if (!Number.isFinite(coreWidth) || coreWidth <= 0 || coreWidth > maxReasonableWidth) {
    return null;
  }

  const spaceWidth = getSpaceWidth(innerWidth);
  return coreWidth + (leading + trailing) * spaceWidth;
};

const getPreparedForToken = (displayText: string): PreparedTextWithSegments | null => {
  const cached = preparedCache.get(displayText);
  if (cached) {
    return cached;
  }
  try {
    const prepared = prepareWithSegments(displayText, CODE_SNIPPET_PRETEXT_FONT);
    if (Number.isFinite(measureNaturalWidth(prepared)) && measureNaturalWidth(prepared) > 0) {
      preparedCache.set(displayText, prepared);
      return prepared;
    }
  } catch {
    /* Canvas unavailable */
  }
  return null;
};

/** Fallback char width when Canvas measureText is unavailable (e.g. Vitest happy-dom). */
const FALLBACK_CHAR_WIDTH_PX = 7.2;

export const measureTokenWidth = (displayText: string, innerWidth?: number): number => {
  if (!displayText.length) {
    return 0;
  }
  if (isCanvasMeasureReliable()) {
    const canvasWidth = measureWithCanvas(displayText);
    if (canvasWidth !== null) {
      return canvasWidth;
    }
  }

  const pretextWidth = measureWithPretextIncludingEdgeSpaces(displayText, innerWidth);
  if (pretextWidth !== null) {
    return pretextWidth;
  }

  return displayText.length * FALLBACK_CHAR_WIDTH_PX;
};

export const clearCodeSnippetTextLayoutCache = (): void => {
  preparedCache.clear();
  cachedSpaceWidth = null;
  canvasMeasureReliable = undefined;
};

type LayoutSegment = {
  displayText: string;
  width: number;
  colorHex: string;
};

/** One justification unit; may contain multiple colored segments with no gap between them. */
type LayoutUnit = {
  segments: LayoutSegment[];
  width: number;
};

/** Punctuation-only tokens from the highlighter stick to the previous token (e.g. string + ";"). */
const ATTACHED_PUNCTUATION_RE = /^[;,.:]+$/;

/** Trim highlight whitespace; inter-token spacing comes from row justification. */
const normalizeTokenDisplayText = (text: string): string => text.trim().toUpperCase();

const measureLayoutUnits = (tokens: CodeSnippetToken[], innerWidth: number): LayoutUnit[] => {
  const units: LayoutUnit[] = [];

  for (const token of tokens) {
    const displayText = normalizeTokenDisplayText(token.text);
    if (!displayText.length) {
      continue;
    }

    const segment: LayoutSegment = {
      displayText,
      width: measureTokenWidth(displayText, innerWidth),
      colorHex: token.colorHex,
    };

    if (units.length > 0 && ATTACHED_PUNCTUATION_RE.test(displayText)) {
      const prev = units[units.length - 1]!;
      prev.segments.push(segment);
      prev.width += segment.width;
      continue;
    }

    units.push({ segments: [segment], width: segment.width });
  }

  return units;
};

const layoutJustifiedRow = (row: LayoutUnit[], innerWidth: number, y: number, minGap: number): PositionedCodeSpan[] => {
  const unitWidths = row.reduce((sum, unit) => sum + unit.width, 0);
  const gapCount = Math.max(0, row.length - 1);
  const minTotal = unitWidths + gapCount * minGap;
  const gap = gapCount === 0 ? 0 : minTotal <= innerWidth ? (innerWidth - unitWidths) / gapCount : minGap;

  const spans: PositionedCodeSpan[] = [];
  let x = 0;
  for (let i = 0; i < row.length; i++) {
    const unit = row[i]!;
    let segmentX = x;
    for (const segment of unit.segments) {
      spans.push({ x: segmentX, y, text: segment.displayText, colorHex: segment.colorHex });
      segmentX += segment.width;
    }
    x += unit.width;
    if (i < row.length - 1) {
      x += gap;
    }
  }
  return spans;
};

/** Split highlighted tokens on source newlines so each editor line is laid out separately. */
export const splitTokensBySourceLines = (tokens: CodeSnippetToken[]): CodeSnippetToken[][] => {
  const lines: CodeSnippetToken[][] = [[]];

  for (const token of tokens) {
    const parts = token.text.split("\n");
    for (let index = 0; index < parts.length; index += 1) {
      if (index > 0) {
        lines.push([]);
      }
      const part = parts[index];
      if (part.length > 0) {
        lines[lines.length - 1]!.push({ text: part, colorHex: token.colorHex });
      }
    }
  }

  return lines;
};

const splitShellFlagAtHyphens = (displayText: string, colorHex: string, innerWidth: number): LayoutSegment[] => {
  const bodyParts = displayText.slice(2).split("-");
  const segments: LayoutSegment[] = [];
  let chunk = "--";

  for (let index = 0; index < bodyParts.length; index += 1) {
    const suffix = index === 0 ? bodyParts[index]! : `-${bodyParts[index]!}`;
    const candidate = chunk + suffix;
    if (index > 0 && measureTokenWidth(candidate, innerWidth) > innerWidth && chunk.length > 2) {
      segments.push({
        displayText: chunk,
        width: measureTokenWidth(chunk, innerWidth),
        colorHex,
      });
      chunk = `--${bodyParts[index]!}`;
    } else {
      chunk = candidate;
    }
  }

  if (chunk.length > 0) {
    segments.push({
      displayText: chunk,
      width: measureTokenWidth(chunk, innerWidth),
      colorHex,
    });
  }
  return segments;
};

const splitSegmentToFitWidth = (displayText: string, colorHex: string, innerWidth: number): LayoutSegment[] => {
  if (!displayText.length) {
    return [];
  }
  if (/^--[\w-]+$/.test(displayText) && measureTokenWidth(displayText, innerWidth) > innerWidth) {
    return splitShellFlagAtHyphens(displayText, colorHex, innerWidth);
  }
  if (
    (/^--[\w-]+$/.test(displayText) || /^\/[\w./-]+$/.test(displayText) || displayText.includes("/")) &&
    measureTokenWidth(displayText, innerWidth) <= innerWidth
  ) {
    const width = measureTokenWidth(displayText, innerWidth);
    return [{ displayText, width, colorHex }];
  }
  if (measureTokenWidth(displayText, innerWidth) <= innerWidth) {
    const width = measureTokenWidth(displayText, innerWidth);
    return [{ displayText, width, colorHex }];
  }

  const segments: LayoutSegment[] = [];
  let chunk = "";
  for (const char of displayText) {
    const candidate = chunk + char;
    if (chunk.length > 0 && measureTokenWidth(candidate, innerWidth) > innerWidth) {
      segments.push({
        displayText: chunk,
        width: measureTokenWidth(chunk, innerWidth),
        colorHex,
      });
      chunk = char;
    } else {
      chunk = candidate;
    }
  }
  if (chunk.length > 0) {
    segments.push({
      displayText: chunk,
      width: measureTokenWidth(chunk, innerWidth),
      colorHex,
    });
  }
  return segments;
};

const layoutUnitFromSegments = (segments: LayoutSegment[]): LayoutUnit => ({
  segments,
  width: segments.reduce((sum, segment) => sum + segment.width, 0),
});

/** Break an over-wide unit into smaller units so rows can wrap. */
const expandUnitsToFitWidth = (units: LayoutUnit[], innerWidth: number): LayoutUnit[] => {
  const expanded: LayoutUnit[] = [];

  for (const unit of units) {
    if (unit.width <= innerWidth) {
      expanded.push(unit);
      continue;
    }

    const nextSegments: LayoutSegment[] = [];
    for (const segment of unit.segments) {
      const words = segment.displayText.split(/\s+/).filter((word) => word.length > 0);
      if (words.length === 0) {
        nextSegments.push(...splitSegmentToFitWidth(segment.displayText, segment.colorHex, innerWidth));
        continue;
      }
      for (const word of words) {
        nextSegments.push(...splitSegmentToFitWidth(word, segment.colorHex, innerWidth));
      }
    }

    for (const segment of nextSegments) {
      expanded.push(layoutUnitFromSegments([segment]));
    }
  }

  return expanded;
};

const wrapUnitsToRows = (units: LayoutUnit[], innerWidth: number, minGap: number): LayoutUnit[][] => {
  const rows: LayoutUnit[][] = [];
  let current: LayoutUnit[] = [];
  let currentWidth = 0;

  const flush = () => {
    if (current.length > 0) {
      rows.push(current);
      current = [];
      currentWidth = 0;
    }
  };

  for (const unit of units) {
    const nextWidth = currentWidth + (current.length > 0 ? minGap : 0) + unit.width;
    if (current.length > 0 && nextWidth > innerWidth) {
      flush();
    }
    const gapBefore = current.length > 0 ? minGap : 0;
    current.push(unit);
    currentWidth += gapBefore + unit.width;
  }
  flush();
  return rows;
};

export const layoutCodeSnippetTokens = (input: {
  tokens: CodeSnippetToken[];
  innerWidth: number;
  innerHeight: number;
}): PositionedCodeSpan[] => {
  const { tokens, innerWidth, innerHeight } = input;
  if (tokens.length === 0 || innerWidth <= 0 || innerHeight <= 0) {
    return [];
  }

  const minGap = CODE_SNIPPET_MIN_TOKEN_GAP_PX;
  const sourceLines = splitTokensBySourceLines(tokens);
  const spans: PositionedCodeSpan[] = [];
  let rowY = 0;

  for (const lineTokens of sourceLines) {
    if (lineTokens.length === 0) {
      rowY += CODE_SNIPPET_LINE_HEIGHT_PX;
      continue;
    }

    const units = expandUnitsToFitWidth(measureLayoutUnits(lineTokens, innerWidth), innerWidth);
    const visualRows = wrapUnitsToRows(units, innerWidth, minGap);

    for (const row of visualRows) {
      spans.push(...layoutJustifiedRow(row, innerWidth, rowY, minGap));
      rowY += CODE_SNIPPET_LINE_HEIGHT_PX;
    }
  }

  return spans;
};
