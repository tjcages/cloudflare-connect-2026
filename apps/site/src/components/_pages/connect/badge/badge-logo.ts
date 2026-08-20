export const LOGO_TEXTURE_W = 800;
export const LOGO_TEXTURE_H = 320;
export const LOGO_PAD = 0.14;
export const SVG_MAX_BYTES = 400_000;

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

export function paintSvgFillsWhite(markup: string): string {
  return markup
    .replace(/\bfill="(?!none)[^"]*"/gi, 'fill="white"')
    .replace(/\bstroke="(?!none)[^"]*"/gi, 'stroke="white"')
    .replace(/fill:\s*(?!none)[^;"]+/gi, "fill:white")
    .replace(/stroke:\s*(?!none)[^;"]+/gi, "stroke:white");
}

export function prepareBadgeLogo(svgText: string): {
  textureSvg: string;
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
  const inner = paintSvgFillsWhite(extractSvgInner(safe));
  if (!inner) throw new Error("That SVG is empty.");
  const viewBox = `${viewport.x} ${viewport.y} ${viewport.w} ${viewport.h}`;
  const markSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}" fill="white">${inner}</svg>`;
  const innerW = LOGO_TEXTURE_W * (1 - LOGO_PAD * 2);
  const innerH = LOGO_TEXTURE_H * (1 - LOGO_PAD * 2);
  const scale = Math.min(innerW / viewport.w, innerH / viewport.h);
  const drawnW = viewport.w * scale;
  const drawnH = viewport.h * scale;
  const x = (LOGO_TEXTURE_W - drawnW) / 2;
  const y = (LOGO_TEXTURE_H - drawnH) / 2;
  const textureSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="${LOGO_TEXTURE_W}" height="${LOGO_TEXTURE_H}" viewBox="0 0 ${LOGO_TEXTURE_W} ${LOGO_TEXTURE_H}"><rect width="${LOGO_TEXTURE_W}" height="${LOGO_TEXTURE_H}" fill="black"/><svg x="${x}" y="${y}" width="${drawnW}" height="${drawnH}" viewBox="${viewBox}" fill="white">${inner}</svg></svg>`;
  return { textureSvg, markSvg };
}

export function svgToBlobUrl(svgText: string): string {
  return URL.createObjectURL(new Blob([svgText], { type: "image/svg+xml" }));
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
