export const SVG_MAX_BYTES = 400_000;
/** 4:3 landscape — a bit wider than tall so the whole logo sits large and centered. */
export const BADGE_PLATE_W = 1600;
export const BADGE_PLATE_H = 1200;
export const BADGE_PLATE_VIEW_W = 800;
export const BADGE_PLATE_VIEW_H = 600;
/** Inset so the upload fills most of the landscape plate without clipping. */
export const BADGE_PLATE_LOGO_PAD = 0.05;
/** Pixel size of the longest edge when rasterizing the centered color mark. */
export const BADGE_MARK_RASTER = 2048;
/** Fallback plate when no SVG is loaded. */
export const BADGE_PRINT_FIELD_SRC = "/connect/badge-print-field.svg?v=43";

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

export function svgRasterSize(
  viewport: { w: number; h: number },
  longEdge = BADGE_MARK_RASTER
): { w: number; h: number } {
  const srcW = Math.max(viewport.w, 1);
  const srcH = Math.max(viewport.h, 1);
  if (srcW >= srcH) {
    return { w: longEdge, h: Math.max(1, Math.round(longEdge * (srcH / srcW))) };
  }
  return { w: Math.max(1, Math.round(longEdge * (srcW / srcH))), h: longEdge };
}

export function wrapSvg(
  inner: string,
  viewport: { x: number; y: number; w: number; h: number },
  fill?: string,
  pixelSize?: { w: number; h: number }
): string {
  const viewBox = `${viewport.x} ${viewport.y} ${viewport.w} ${viewport.h}`;
  const markW = Math.max(1, Math.round(pixelSize?.w ?? viewport.w));
  const markH = Math.max(1, Math.round(pixelSize?.h ?? viewport.h));
  const fillAttr = fill ? ` fill="${fill}"` : "";
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${markW}" height="${markH}" viewBox="${viewBox}" color="#111111" shape-rendering="geometricPrecision"${fillAttr}>${inner}</svg>`;
}

/** Place the upload large and centered in the 4:3 landscape plate. */
export function badgePlateLogoRect(viewport: { w: number; h: number }): {
  x: number;
  y: number;
  w: number;
  h: number;
} {
  const innerW = BADGE_PLATE_VIEW_W * (1 - BADGE_PLATE_LOGO_PAD * 2);
  const innerH = BADGE_PLATE_VIEW_H * (1 - BADGE_PLATE_LOGO_PAD * 2);
  const scale = Math.min(
    innerW / Math.max(viewport.w, 1),
    innerH / Math.max(viewport.h, 1)
  );
  const w = viewport.w * scale;
  const h = viewport.h * scale;
  return {
    x: (BADGE_PLATE_VIEW_W - w) / 2,
    y: (BADGE_PLATE_VIEW_H - h) / 2,
    w,
    h,
  };
}

/** Stylized SVG the stripe engine converts — landscape plate, logo centered. */
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
  const slot = badgePlateLogoRect(viewport);
  const stroke = Math.max(viewport.w, viewport.h) * 0.012;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${BADGE_PLATE_W}" height="${BADGE_PLATE_H}" viewBox="0 0 ${BADGE_PLATE_VIEW_W} ${BADGE_PLATE_VIEW_H}" preserveAspectRatio="xMidYMid meet"><defs><linearGradient id="badge-print-lit" x1="0.15" y1="0" x2="0.9" y2="1"><stop offset="0" stop-color="#b4b4b4"/><stop offset="0.42" stop-color="#5a5a5a"/><stop offset="1" stop-color="#1f1f1f"/></linearGradient></defs><rect width="${BADGE_PLATE_VIEW_W}" height="${BADGE_PLATE_VIEW_H}" fill="#000000"/><svg x="${slot.x}" y="${slot.y}" width="${slot.w}" height="${slot.h}" viewBox="${viewport.x} ${viewport.y} ${viewport.w} ${viewport.h}" preserveAspectRatio="xMidYMid meet"><g fill="url(#badge-print-lit)" stroke="#ffffff" stroke-width="${stroke}" paint-order="stroke fill">${inner}</g></svg></svg>`;
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
  return wrapSvg(inner, viewport, fill, svgRasterSize(viewport));
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
