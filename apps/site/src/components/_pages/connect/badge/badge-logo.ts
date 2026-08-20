export const SVG_MAX_BYTES = 400_000;
export const RASTER_MAX_BYTES = 2_000_000;
export const PNG_MAX_BYTES = RASTER_MAX_BYTES;
export const LOGO_FILE_ACCEPT =
  "image/svg+xml,.svg,image/png,.png,image/jpeg,.jpg,.jpeg,image/webp,.webp";
export const LOGO_FILE_ERROR = "Choose an SVG, PNG, JPEG, or WebP file.";
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
export const BADGE_PRINT_FIELD_SRC = "/connect/badge-print-field.svg?v=dark";
/** 0 = dim mark. 1 = the previous brighter ramp. Default stays dark. */
export const BADGE_PLATE_LIGHT_DEFAULT = 0.1;

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
  const width = Number(svgText.match(/<svg\b[^>]*\bwidth=["']([\d.]+)/i)?.[1]);
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
    return {
      w: longEdge,
      h: Math.max(1, Math.round(longEdge * (srcH / srcW))),
    };
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

function grayHex(value: number): string {
  const v = Math.round(Math.max(0, Math.min(255, value)));
  const hex = v.toString(16).padStart(2, "0");
  return `#${hex}${hex}${hex}`;
}

/** Luminance stops for the logo fill. 0 is dim; 1 is the previous brighter ramp. */
export function badgePlateLitStops(light: number): {
  hi: string;
  mid: string;
  lo: string;
} {
  const t = Math.max(0, Math.min(1, light));
  return {
    hi: grayHex(48 + t * 132),
    mid: grayHex(14 + t * 76),
    lo: grayHex(4 + t * 27),
  };
}

/** Stylized SVG the stripe engine converts — landscape plate, logo centered. */
export function badgeShaderPlateSvg(
  svgText: string,
  light = BADGE_PLATE_LIGHT_DEFAULT
): string {
  const safe = stripUnsafeSvg(svgText.trim());
  if (!/<svg[\s>]/i.test(safe)) {
    throw new Error("Upload an SVG file.");
  }
  const viewport = parseSvgViewport(safe);
  if (!(viewport.w > 0) || !(viewport.h > 0)) {
    throw new Error("That SVG has no size.");
  }
  const inner = paintSvgFills(extractSvgInner(safe), "url(#badge-print-lit)");
  if (!inner) throw new Error("That SVG is empty.");
  const slot = badgePlateLogoRect(viewport);
  const stroke = Math.max(viewport.w, viewport.h) * 0.012;
  const lit = badgePlateLitStops(light);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${BADGE_PLATE_W}" height="${BADGE_PLATE_H}" viewBox="0 0 ${BADGE_PLATE_VIEW_W} ${BADGE_PLATE_VIEW_H}" preserveAspectRatio="xMidYMid meet"><defs><linearGradient id="badge-print-lit" x1="0.15" y1="0" x2="0.9" y2="1"><stop offset="0" stop-color="${lit.hi}"/><stop offset="0.42" stop-color="${lit.mid}"/><stop offset="1" stop-color="${lit.lo}"/></linearGradient></defs><rect width="${BADGE_PLATE_VIEW_W}" height="${BADGE_PLATE_VIEW_H}" fill="#000000"/><svg x="${slot.x}" y="${slot.y}" width="${slot.w}" height="${slot.h}" viewBox="${viewport.x} ${viewport.y} ${viewport.w} ${viewport.h}" preserveAspectRatio="xMidYMid meet"><g fill="url(#badge-print-lit)" stroke="#ffffff" stroke-width="${stroke}" paint-order="stroke fill">${inner}</g></svg></svg>`;
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

export function bytesToDataUrl(mime: string, bytes: Uint8Array): string {
  const chunk = 0x8000;
  let binary = "";
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return `data:${mime};base64,${btoa(binary)}`;
}

const PNG_SIGNATURE = [137, 80, 78, 71, 13, 10, 26, 10];

export function parsePngSize(bytes: Uint8Array): { w: number; h: number } {
  if (bytes.length < 24) {
    throw new Error("That PNG is invalid.");
  }
  for (let i = 0; i < PNG_SIGNATURE.length; i++) {
    if (bytes[i] !== PNG_SIGNATURE[i]) {
      throw new Error("That PNG is invalid.");
    }
  }
  const w =
    ((bytes[16] ?? 0) << 24) |
    ((bytes[17] ?? 0) << 16) |
    ((bytes[18] ?? 0) << 8) |
    (bytes[19] ?? 0);
  const h =
    ((bytes[20] ?? 0) << 24) |
    ((bytes[21] ?? 0) << 16) |
    ((bytes[22] ?? 0) << 8) |
    (bytes[23] ?? 0);
  if (!(w > 0) || !(h > 0)) {
    throw new Error("That PNG has no size.");
  }
  return { w, h };
}

function fileNameIs(file: File, ...exts: string[]): boolean {
  const name = file.name.toLowerCase();
  return exts.some((ext) => name.endsWith(ext));
}

function isPngFile(file: File): boolean {
  return file.type === "image/png" || fileNameIs(file, ".png");
}

function isJpegFile(file: File): boolean {
  return (
    file.type === "image/jpeg" ||
    file.type === "image/jpg" ||
    fileNameIs(file, ".jpg", ".jpeg")
  );
}

function isWebpFile(file: File): boolean {
  return file.type === "image/webp" || fileNameIs(file, ".webp");
}

function isSvgFile(file: File): boolean {
  return file.type === "image/svg+xml" || fileNameIs(file, ".svg");
}

function isRasterHint(file: File): boolean {
  return isPngFile(file) || isJpegFile(file) || isWebpFile(file);
}

function ascii(bytes: Uint8Array, start: number, end: number): string {
  return String.fromCharCode(...bytes.subarray(start, end));
}

function u16be(bytes: Uint8Array, offset: number): number {
  return ((bytes[offset] ?? 0) << 8) | (bytes[offset + 1] ?? 0);
}

function u16le(bytes: Uint8Array, offset: number): number {
  return (bytes[offset] ?? 0) | ((bytes[offset + 1] ?? 0) << 8);
}

function u24le(bytes: Uint8Array, offset: number): number {
  return (
    (bytes[offset] ?? 0) |
    ((bytes[offset + 1] ?? 0) << 8) |
    ((bytes[offset + 2] ?? 0) << 16)
  );
}

function u32le(bytes: Uint8Array, offset: number): number {
  return (
    (bytes[offset] ?? 0) |
    ((bytes[offset + 1] ?? 0) << 8) |
    ((bytes[offset + 2] ?? 0) << 16) |
    ((bytes[offset + 3] ?? 0) << 24)
  );
}

function hasPngSignature(bytes: Uint8Array): boolean {
  if (bytes.length < PNG_SIGNATURE.length) return false;
  return PNG_SIGNATURE.every((value, i) => bytes[i] === value);
}

function hasJpegSignature(bytes: Uint8Array): boolean {
  return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8;
}

function hasWebpSignature(bytes: Uint8Array): boolean {
  return (
    bytes.length >= 12 &&
    ascii(bytes, 0, 4) === "RIFF" &&
    ascii(bytes, 8, 12) === "WEBP"
  );
}

type RasterFormat = "png" | "jpeg" | "webp";

function detectRasterFormat(
  file: File,
  bytes: Uint8Array
): RasterFormat | null {
  if (hasPngSignature(bytes)) return "png";
  if (hasJpegSignature(bytes)) return "jpeg";
  if (hasWebpSignature(bytes)) return "webp";
  if (isPngFile(file)) return "png";
  if (isJpegFile(file)) return "jpeg";
  if (isWebpFile(file)) return "webp";
  return null;
}

function rasterMime(format: RasterFormat): string {
  switch (format) {
    case "png":
      return "image/png";
    case "jpeg":
      return "image/jpeg";
    case "webp":
      return "image/webp";
    default: {
      const _exhaustive: never = format;
      return _exhaustive;
    }
  }
}

function rasterSize(
  format: RasterFormat,
  bytes: Uint8Array
): { w: number; h: number } {
  switch (format) {
    case "png":
      return parsePngSize(bytes);
    case "jpeg":
      return parseJpegSize(bytes);
    case "webp":
      return parseWebpSize(bytes);
    default: {
      const _exhaustive: never = format;
      return _exhaustive;
    }
  }
}

/** SOF0–SOF15 except DHT (C4), JPEG-JPG (C8), and DAC (CC). */
function isJpegSofMarker(marker: number): boolean {
  if (marker < 0xc0 || marker > 0xcf) return false;
  return marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc;
}

export function parseJpegSize(bytes: Uint8Array): { w: number; h: number } {
  if (!hasJpegSignature(bytes)) {
    throw new Error("That JPEG is invalid.");
  }
  let i = 2;
  while (i + 8 < bytes.length) {
    if (bytes[i] !== 0xff) {
      i += 1;
      continue;
    }
    const marker = bytes[i + 1] ?? 0;
    if (marker === 0xff) {
      i += 1;
      continue;
    }
    if (
      marker === 0xd8 ||
      marker === 0xd9 ||
      (marker >= 0xd0 && marker <= 0xd7)
    ) {
      i += 2;
      continue;
    }
    const length = u16be(bytes, i + 2);
    if (length < 2 || i + 2 + length > bytes.length) {
      throw new Error("That JPEG is invalid.");
    }
    if (isJpegSofMarker(marker)) {
      const h = u16be(bytes, i + 5);
      const w = u16be(bytes, i + 7);
      if (!(w > 0) || !(h > 0)) {
        throw new Error("That JPEG has no size.");
      }
      return { w, h };
    }
    i += 2 + length;
  }
  throw new Error("That JPEG has no size.");
}

export function parseWebpSize(bytes: Uint8Array): { w: number; h: number } {
  if (!hasWebpSignature(bytes)) {
    throw new Error("That WebP is invalid.");
  }
  let offset = 12;
  while (offset + 8 <= bytes.length) {
    const type = ascii(bytes, offset, offset + 4);
    const size = u32le(bytes, offset + 4);
    const data = offset + 8;
    if (type === "VP8X" && data + 10 <= bytes.length) {
      const w = 1 + u24le(bytes, data + 4);
      const h = 1 + u24le(bytes, data + 7);
      if (!(w > 0) || !(h > 0)) {
        throw new Error("That WebP has no size.");
      }
      return { w, h };
    }
    if (type === "VP8 " && data + 10 <= bytes.length) {
      if (
        bytes[data + 3] === 0x9d &&
        bytes[data + 4] === 0x01 &&
        bytes[data + 5] === 0x2a
      ) {
        const w = u16le(bytes, data + 6) & 0x3fff;
        const h = u16le(bytes, data + 8) & 0x3fff;
        if (!(w > 0) || !(h > 0)) {
          throw new Error("That WebP has no size.");
        }
        return { w, h };
      }
    }
    if (type === "VP8L" && data + 5 <= bytes.length && bytes[data] === 0x2f) {
      const b0 = bytes[data + 1] ?? 0;
      const b1 = bytes[data + 2] ?? 0;
      const b2 = bytes[data + 3] ?? 0;
      const b3 = bytes[data + 4] ?? 0;
      const w = 1 + (b0 | ((b1 & 0x3f) << 8));
      const h = 1 + ((b1 >> 6) | (b2 << 2) | ((b3 & 0x0f) << 10));
      if (!(w > 0) || !(h > 0)) {
        throw new Error("That WebP has no size.");
      }
      return { w, h };
    }
    offset += 8 + size + (size & 1);
  }
  throw new Error("That WebP has no size.");
}

export type BadgeLogoFile =
  | { kind: "svg"; fileName: string; sourceSvg: string }
  | {
      kind: "raster";
      fileName: string;
      dataUrl: string;
      width: number;
      height: number;
    };

export async function readSvgFile(file: File): Promise<string> {
  if (!isSvgFile(file)) {
    throw new Error(LOGO_FILE_ERROR);
  }
  if (file.size > SVG_MAX_BYTES) {
    throw new Error("SVG is too large (max 400 KB).");
  }
  return file.text();
}

export async function readLogoFile(file: File): Promise<BadgeLogoFile> {
  if (isSvgFile(file) && !isRasterHint(file)) {
    const sourceSvg = await readSvgFile(file);
    return { kind: "svg", fileName: file.name, sourceSvg };
  }
  if (file.size > RASTER_MAX_BYTES) {
    throw new Error("Image is too large (max 2 MB).");
  }
  const bytes = new Uint8Array(await file.arrayBuffer());
  const format = detectRasterFormat(file, bytes);
  if (format) {
    const size = rasterSize(format, bytes);
    return {
      kind: "raster",
      fileName: file.name,
      dataUrl: bytesToDataUrl(rasterMime(format), bytes),
      width: size.w,
      height: size.h,
    };
  }
  if (isSvgFile(file)) {
    const sourceSvg = await readSvgFile(file);
    return { kind: "svg", fileName: file.name, sourceSvg };
  }
  throw new Error(LOGO_FILE_ERROR);
}

export function badgeLogoPreviewSrc(logo: BadgeLogoFile): string {
  switch (logo.kind) {
    case "raster":
      return logo.dataUrl;
    case "svg":
      return svgToBlobUrl(logo.sourceSvg);
    default: {
      const _exhaustive: never = logo;
      return _exhaustive;
    }
  }
}

function lumaTransfer(light: number): { slope: string; intercept: string } {
  const lit = badgePlateLitStops(light);
  const lo = Number.parseInt(lit.lo.slice(1, 3), 16) / 255;
  const hi = Number.parseInt(lit.hi.slice(1, 3), 16) / 255;
  return {
    slope: (hi - lo).toFixed(4),
    intercept: lo.toFixed(4),
  };
}

/** Landscape plate with a PNG (or other raster) contained and dimmed. */
export function badgeShaderPlateRaster(
  dataUrl: string,
  viewport: { w: number; h: number },
  light = BADGE_PLATE_LIGHT_DEFAULT
): string {
  const slot = badgePlateLogoRect(viewport);
  const transfer = lumaTransfer(light);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${BADGE_PLATE_W}" height="${BADGE_PLATE_H}" viewBox="0 0 ${BADGE_PLATE_VIEW_W} ${BADGE_PLATE_VIEW_H}" preserveAspectRatio="xMidYMid meet"><defs><filter id="badge-print-dim" color-interpolation-filters="sRGB"><feColorMatrix type="saturate" values="0"/><feComponentTransfer><feFuncR type="linear" slope="${transfer.slope}" intercept="${transfer.intercept}"/><feFuncG type="linear" slope="${transfer.slope}" intercept="${transfer.intercept}"/><feFuncB type="linear" slope="${transfer.slope}" intercept="${transfer.intercept}"/></feComponentTransfer></filter></defs><rect width="${BADGE_PLATE_VIEW_W}" height="${BADGE_PLATE_VIEW_H}" fill="#000000"/><image href="${dataUrl}" x="${slot.x}" y="${slot.y}" width="${slot.w}" height="${slot.h}" preserveAspectRatio="xMidYMid meet" filter="url(#badge-print-dim)"/></svg>`;
}
