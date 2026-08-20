export const SVG_MAX_BYTES = 400_000;
export const BADGE_PLATE_W = 800;
export const BADGE_PLATE_H = 1200;
/** Fallback plate when no SVG is loaded. */
export const BADGE_PRINT_FIELD_SRC = "/connect/badge-print-field.svg?v=cloud";

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

export function badgePlateCrop(viewport: {
  x: number;
  y: number;
  w: number;
  h: number;
}) {
  const cropW = Math.max(viewport.w * 0.52, 1);
  const cropH = cropW * (BADGE_PLATE_H / BADGE_PLATE_W);
  return {
    x: viewport.x + viewport.w * 0.36,
    y: viewport.y + (viewport.h - cropH) * 0.32,
    w: cropW,
    h: cropH,
  };
}

/** Tight rim-lit crop of the upload — this is what the stripe engine converts. */
export function badgeShaderPlateSvg(svgText: string): string {
  const safe = stripUnsafeSvg(svgText.trim());
  if (!/<svg[\s>]/i.test(safe)) {
    throw new Error("Upload an SVG file.");
  }
  const viewport = parseSvgViewport(safe);
  if (!(viewport.w > 0) || !(viewport.h > 0)) {
    throw new Error("That SVG has no size.");
  }
  const inner = paintSvgFills(
    extractSvgInner(safe),
    "url(#badge-print-lit)"
  );
  if (!inner) throw new Error("That SVG is empty.");
  const crop = badgePlateCrop(viewport);
  const stroke = Math.max(crop.w, crop.h) * 0.01;
  const pad = Math.max(crop.w, crop.h) * 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${BADGE_PLATE_W}" height="${BADGE_PLATE_H}" viewBox="${crop.x} ${crop.y} ${crop.w} ${crop.h}" preserveAspectRatio="xMidYMid slice"><defs><linearGradient id="badge-print-lit" x1="0.15" y1="0" x2="0.9" y2="1"><stop offset="0" stop-color="#b4b4b4"/><stop offset="0.42" stop-color="#5a5a5a"/><stop offset="1" stop-color="#1f1f1f"/></linearGradient></defs><rect x="${crop.x - pad}" y="${crop.y - pad}" width="${crop.w + pad * 2}" height="${crop.h + pad * 2}" fill="#000000"/><g fill="url(#badge-print-lit)" stroke="#ffffff" stroke-width="${stroke}" paint-order="stroke fill">${inner}</g></svg>`;
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
