export const LOGO_TEXTURE_W = 800;
export const LOGO_TEXTURE_H = 1200;
export const SVG_MAX_BYTES = 400_000;
/** Logo-free luminance plate. The stripe engine must never see an upload. */
export const BADGE_PRINT_FIELD_SRC = "/connect/badge-print-field.svg?v=flat";

const SCRIPT_RE = /<script\b[\s\S]*?<\/script>/gi;
const FOREIGN_RE = /<foreignObject\b[\s\S]*?<\/foreignObject>/gi;
const ON_ATTR_RE = /\son\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi;

export function stripUnsafeSvg(svgText: string): string {
  return svgText
    .replace(SCRIPT_RE, "")
    .replace(FOREIGN_RE, "")
    .replace(ON_ATTR_RE, "");
}

export function parseSvgViewport(svgText: string): {
  x: number;
  y: number;
  w: number;
  h: number;
} {
  const viewBox = svgText.match(
    /viewBox\s*=\s*["']\s*([-\d.]+)\s+([-\d.]+)\s+([-\d.]+)\s+([-\d.]+)/i
  );
  if (viewBox) {
    return {
      x: Number(viewBox[1]),
      y: Number(viewBox[2]),
      w: Number(viewBox[3]),
      h: Number(viewBox[4]),
    };
  }
  const width = Number(
    svgText.match(/<svg\b[^>]*\bwidth=["']([\d.]+)/i)?.[1]
  );
  const height = Number(
    svgText.match(/<svg\b[^>]*\bheight=["']([\d.]+)/i)?.[1]
  );
  if (width > 0 && height > 0) return { x: 0, y: 0, w: width, h: height };
  return { x: 0, y: 0, w: 100, h: 100 };
}

export function extractSvgInner(svgText: string): string {
  const match = svgText.match(/<svg\b[^>]*>([\s\S]*)<\/svg>/i);
  return match?.[1]?.trim() ?? "";
}

export function paintSvgFills(markup: string, color: string): string {
  const fill = `fill="${color}"`;
  const stroke = `stroke="${color}"`;
  const fillCss = `fill:${color}`;
  const strokeCss = `stroke:${color}`;
  return markup
    .replace(/\bfill="(?!none)[^"]*"/gi, fill)
    .replace(/\bstroke="(?!none)[^"]*"/gi, stroke)
    .replace(/fill:\s*(?!none)[^;"}]+/gi, fillCss)
    .replace(/stroke:\s*(?!none)[^;"}]+/gi, strokeCss);
}

export function paintSvgFillsWhite(markup: string): string {
  return paintSvgFills(markup, "white");
}

export function wrapSvg(
  inner: string,
  viewport: { x: number; y: number; w: number; h: number },
  fill?: string
): string {
  const viewBox = `${viewport.x} ${viewport.y} ${viewport.w} ${viewport.h}`;
  const markW = Math.max(1, Math.round(viewport.w));
  const markH = Math.max(1, Math.round(viewport.h));
  const fillAttr = fill ? ` fill="${fill}"` : "";
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${markW}" height="${markH}" viewBox="${viewBox}" color="#111111"${fillAttr}>${inner}</svg>`;
}

export function prepareBadgeLogo(svgText: string): {
  colorSvg: string;
  markSvg: string;
} {
  const safe = stripUnsafeSvg(svgText.trim());
  if (!/<svg[\s>]/i.test(safe)) {
    throw new Error("Upload an SVG file.");
  }
  const viewport = parseSvgViewport(safe);
  if (!(viewport.w > 0) || !(viewport.h > 0)) {
    throw new Error("That SVG has no size.");
  }
  const colorInner = extractSvgInner(safe);
  if (!colorInner) throw new Error("That SVG is empty.");
  const whiteInner = paintSvgFillsWhite(colorInner);
  const colorSvg = wrapSvg(colorInner, viewport);
  const markSvg = wrapSvg(whiteInner, viewport, "white");
  return { colorSvg, markSvg };
}

/** Even luma plate — no orbs or paths the stripe engine could silhouette. */
export function badgeTextureFieldMarkup(width: number, height: number): string {
  return `<rect width="${width}" height="${height}" fill="#9a9a9a"/>`;
}

export function badgePrintFieldSvg(): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${LOGO_TEXTURE_W}" height="${LOGO_TEXTURE_H}" viewBox="0 0 ${LOGO_TEXTURE_W} ${LOGO_TEXTURE_H}">${badgeTextureFieldMarkup(LOGO_TEXTURE_W, LOGO_TEXTURE_H)}</svg>`;
}

export function badgeMarkSvg(svgText: string, fill: string): string {
  const safe = stripUnsafeSvg(svgText.trim());
  if (!/<svg[\s>]/i.test(safe)) {
    throw new Error("Upload an SVG file.");
  }
  const viewport = parseSvgViewport(safe);
  const inner = paintSvgFills(extractSvgInner(safe), fill);
  if (!inner) throw new Error("That SVG is empty.");
  return wrapSvg(inner, viewport, fill);
}

export function svgToBlobUrl(svgText: string): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgText)}`;
}

export async function readSvgFile(file: File): Promise<string> {
  const namedSvg = file.name.toLowerCase().endsWith(".svg");
  if (file.type !== "image/svg+xml" && !namedSvg) {
    throw new Error("Choose an SVG file.");
  }
  if (file.size > SVG_MAX_BYTES) {
    throw new Error("SVG is too large (max 400 KB).");
  }
  return file.text();
}
