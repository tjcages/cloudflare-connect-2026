/**
 * Convert lab SVG export markup to EPSF-3.0 for Illustrator / print.
 * Geometry source of truth stays SVG (rain + Twizzler paths, masks, 1D ramps).
 * 2D field PNGs rasterize as DeviceRGB images; display-p3 CSS is ignored (sRGB fills).
 */

type SvgAttrs = Record<string, string>;

type SvgEl = {
  tag: string;
  attrs: SvgAttrs;
  children: SvgEl[];
  text: string;
};

type Rgb = { r: number; g: number; b: number };

type Paint = {
  fill: string | null;
  fillOpacity: number;
  opacity: number;
  fillRule: "nonzero" | "evenodd";
  stroke: string | null;
  strokeWidth: number;
  mask: string | null;
  clipPath: string | null;
};

type LinearGradientDef = {
  kind: "linearGradient";
  id: string;
  userSpace: boolean;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  stops: Array<{ offset: number; color: Rgb }>;
};

type PatternDef = {
  kind: "pattern";
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  imageHref: string | null;
};

type MaskDef = {
  kind: "mask" | "clipPath";
  id: string;
  children: SvgEl[];
};

type PaintDef = LinearGradientDef | PatternDef | MaskDef;

const SKIP_PAINT_TAGS = new Set([
  "defs",
  "style",
  "lineargradient",
  "radialgradient",
  "pattern",
  "mask",
  "clippath",
  "stop",
  "title",
  "desc",
  "metadata",
]);

function assertNever(value: never): never {
  throw new Error(`unhandled EPS paint variant: ${String(value)}`);
}

function psNumber(value: number): string {
  if (!Number.isFinite(value)) return "0";
  const rounded = Number(value.toFixed(4));
  return Object.is(rounded, -0) ? "0" : String(rounded);
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function parseAttrs(raw: string): SvgAttrs {
  const attrs: SvgAttrs = {};
  const re = /([A-Za-z_:][\w:.-]*)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(raw))) {
    attrs[match[1]!.toLowerCase()] = match[2] ?? match[3] ?? match[4] ?? "";
  }
  return attrs;
}

function parseSvgFragment(xml: string): SvgEl[] {
  const nodes: SvgEl[] = [];
  const stack: SvgEl[] = [];
  const re = /<!--[\s\S]*?-->|<!\[CDATA\[[\s\S]*?\]\]>|<\/?([A-Za-z][\w:-]*)([^>]*?)(\/)?>/g;
  let last = 0;
  let match: RegExpExecArray | null;
  const pushText = (from: number, to: number) => {
    const text = xml.slice(from, to);
    if (!text.trim()) return;
    const parent = stack[stack.length - 1];
    if (parent) parent.text += text;
  };
  while ((match = re.exec(xml))) {
    pushText(last, match.index);
    last = match.index + match[0].length;
    if (match[0].startsWith("<!--") || match[0].startsWith("<![CDATA[")) continue;
    const tag = match[1]!.toLowerCase();
    const selfClosing = Boolean(match[3]) || match[0].endsWith("/>");
    if (match[0].startsWith("</")) {
      const open = stack.pop();
      if (!open) continue;
      const parent = stack[stack.length - 1];
      if (parent) parent.children.push(open);
      else nodes.push(open);
      continue;
    }
    const el: SvgEl = { tag, attrs: parseAttrs(match[2] ?? ""), children: [], text: "" };
    if (selfClosing) {
      const parent = stack[stack.length - 1];
      if (parent) parent.children.push(el);
      else nodes.push(el);
    } else {
      stack.push(el);
    }
  }
  while (stack.length > 0) {
    const open = stack.pop()!;
    const parent = stack[stack.length - 1];
    if (parent) parent.children.push(open);
    else nodes.push(open);
  }
  return nodes;
}

function findSvgRoot(nodes: readonly SvgEl[]): SvgEl | null {
  for (const node of nodes) {
    if (node.tag === "svg") return node;
    const nested = findSvgRoot(node.children);
    if (nested) return nested;
  }
  return null;
}

function attr(el: SvgEl, name: string): string | undefined {
  return el.attrs[name.toLowerCase()];
}

function numAttr(el: SvgEl, name: string, fallback = 0): number {
  const raw = attr(el, name);
  if (raw === undefined || raw === "") return fallback;
  const value = Number.parseFloat(raw);
  return Number.isFinite(value) ? value : fallback;
}

function parseHexRgb(value: string): Rgb | null {
  const raw = value.trim();
  const hex = raw.startsWith("#") ? raw.slice(1) : raw;
  if (/^[0-9a-fA-F]{3}$/.test(hex)) {
    return {
      r: Number.parseInt(hex[0]! + hex[0], 16) / 255,
      g: Number.parseInt(hex[1]! + hex[1], 16) / 255,
      b: Number.parseInt(hex[2]! + hex[2], 16) / 255,
    };
  }
  if (/^[0-9a-fA-F]{6}$/.test(hex)) {
    return {
      r: Number.parseInt(hex.slice(0, 2), 16) / 255,
      g: Number.parseInt(hex.slice(2, 4), 16) / 255,
      b: Number.parseInt(hex.slice(4, 6), 16) / 255,
    };
  }
  return null;
}

function parseColor(value: string | null | undefined): Rgb | null {
  if (!value) return null;
  const raw = value.trim().toLowerCase();
  if (!raw || raw === "none" || raw === "transparent") return null;
  if (raw === "white") return { r: 1, g: 1, b: 1 };
  if (raw === "black") return { r: 0, g: 0, b: 0 };
  if (raw.startsWith("url(")) return null;
  const rgb = raw.match(/^rgba?\(\s*([0-9.]+)\s*[, ]\s*([0-9.]+)\s*[, ]\s*([0-9.]+)/);
  if (rgb) {
    const toUnit = (part: string) => {
      const n = Number.parseFloat(part);
      return n > 1 ? clamp01(n / 255) : clamp01(n);
    };
    return { r: toUnit(rgb[1]!), g: toUnit(rgb[2]!), b: toUnit(rgb[3]!) };
  }
  return parseHexRgb(raw);
}

function isUrlFill(value: string | null): value is string {
  return Boolean(value && /^url\(#.+\)$/i.test(value.trim()));
}

function urlId(value: string): string {
  const match = value.trim().match(/^url\(#([^)]+)\)$/i);
  return match?.[1] ?? "";
}

function parseStyleMap(style: string | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  if (!style) return out;
  for (const part of style.split(";")) {
    const idx = part.indexOf(":");
    if (idx < 0) continue;
    const key = part.slice(0, idx).trim().toLowerCase();
    const val = part.slice(idx + 1).trim();
    if (key) out[key] = val;
  }
  return out;
}

function parseCssFills(css: string): Record<string, { fill?: string; fillOpacity?: number; stroke?: string }> {
  const out: Record<string, { fill?: string; fillOpacity?: number; stroke?: string }> = {};
  const stripped = css.replace(/@supports[^{]*\{[\s\S]*?\n\s*\}/g, "");
  const ruleRe = /\.([A-Za-z_][\w-]*)\s*\{([^}]*)\}/g;
  let match: RegExpExecArray | null;
  while ((match = ruleRe.exec(stripped))) {
    const props = parseStyleMap(match[2]);
    out[match[1]!] = {
      fill: props.fill,
      fillOpacity: props["fill-opacity"] ? Number.parseFloat(props["fill-opacity"]) : undefined,
      stroke: props.stroke,
    };
  }
  return out;
}

function collectStyleText(el: SvgEl, parts: string[]): void {
  if (el.tag === "style") {
    parts.push(el.text);
    return;
  }
  for (const child of el.children) collectStyleText(child, parts);
}

function collectDefs(el: SvgEl, defs: Map<string, SvgEl>): void {
  const id = attr(el, "id");
  if (id) defs.set(id, el);
  for (const child of el.children) collectDefs(child, defs);
}

function parseOffset(raw: string | undefined): number {
  if (!raw) return 0;
  const trimmed = raw.trim();
  if (trimmed.endsWith("%")) return clamp01(Number.parseFloat(trimmed) / 100);
  return clamp01(Number.parseFloat(trimmed));
}

function stopColor(el: SvgEl): Rgb {
  const style = parseStyleMap(attr(el, "style"));
  return (
    parseColor(attr(el, "stop-color")) ??
    parseColor(style["stop-color"]) ??
    parseHexRgb(style["stop-color"] ?? "") ?? { r: 0, g: 0, b: 0 }
  );
}

function asPaintDef(el: SvgEl): PaintDef | null {
  const id = attr(el, "id") ?? "";
  switch (el.tag) {
    case "lineargradient": {
      const units = (attr(el, "gradientunits") ?? "objectboundingbox").toLowerCase();
      const stops = el.children
        .filter((child) => child.tag === "stop")
        .map((child) => ({ offset: parseOffset(attr(child, "offset")), color: stopColor(child) }))
        .sort((a, b) => a.offset - b.offset);
      return {
        kind: "linearGradient",
        id,
        userSpace: units === "userspaceonuse",
        x1: numAttr(el, "x1", 0),
        y1: numAttr(el, "y1", 0),
        x2: numAttr(el, "x2", 1),
        y2: numAttr(el, "y2", 0),
        stops: stops.length > 0 ? stops : [{ offset: 0, color: { r: 0, g: 0, b: 0 } }],
      };
    }
    case "pattern": {
      const image = el.children.find((child) => child.tag === "image");
      return {
        kind: "pattern",
        id,
        x: numAttr(el, "x", 0),
        y: numAttr(el, "y", 0),
        width: numAttr(el, "width", 0),
        height: numAttr(el, "height", 0),
        imageHref: image ? (attr(image, "href") ?? attr(image, "xlink:href") ?? null) : null,
      };
    }
    case "mask":
    case "clippath":
      return { kind: el.tag === "mask" ? "mask" : "clipPath", id, children: el.children };
    default:
      return null;
  }
}

function defaultPaint(): Paint {
  return {
    fill: "#000000",
    fillOpacity: 1,
    opacity: 1,
    fillRule: "nonzero",
    stroke: null,
    strokeWidth: 1,
    mask: null,
    clipPath: null,
  };
}

function mergePaint(
  parent: Paint,
  el: SvgEl,
  css: Record<string, { fill?: string; fillOpacity?: number; stroke?: string }>,
): Paint {
  const style = parseStyleMap(attr(el, "style"));
  const classNames = (attr(el, "class") ?? "").split(/\s+/).filter(Boolean);
  let classFill: string | undefined;
  let classFillOpacity: number | undefined;
  let classStroke: string | undefined;
  for (const name of classNames) {
    const rule = css[name];
    if (!rule) continue;
    classFill = rule.fill ?? classFill;
    classFillOpacity = rule.fillOpacity ?? classFillOpacity;
    classStroke = rule.stroke ?? classStroke;
  }
  const fill = attr(el, "fill") ?? style.fill ?? classFill ?? parent.fill;
  const stroke = attr(el, "stroke") ?? style.stroke ?? classStroke ?? parent.stroke;
  const fillOpacityRaw = attr(el, "fill-opacity") ?? style["fill-opacity"];
  const opacityRaw = attr(el, "opacity") ?? style.opacity;
  const strokeWidthRaw = attr(el, "stroke-width") ?? style["stroke-width"];
  const fillRuleRaw = (attr(el, "fill-rule") ?? style["fill-rule"] ?? parent.fillRule).toLowerCase();
  const mask = attr(el, "mask") ?? style.mask ?? parent.mask;
  const clipPath = attr(el, "clip-path") ?? style["clip-path"] ?? parent.clipPath;
  return {
    fill: fill === undefined ? parent.fill : fill,
    fillOpacity:
      fillOpacityRaw !== undefined
        ? clamp01(Number.parseFloat(fillOpacityRaw))
        : (classFillOpacity ?? parent.fillOpacity),
    opacity: clamp01(parent.opacity * (opacityRaw !== undefined ? Number.parseFloat(opacityRaw) : 1)),
    fillRule: fillRuleRaw === "evenodd" ? "evenodd" : "nonzero",
    stroke: stroke === undefined ? parent.stroke : stroke,
    strokeWidth: strokeWidthRaw !== undefined ? Number.parseFloat(strokeWidthRaw) : parent.strokeWidth,
    mask,
    clipPath,
  };
}

function pathCommandsToPs(d: string): string {
  const tokens: string[] = [];
  const re = /([MmLlHhVvCcSsQqTtAaZz])|([+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?)/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(d))) tokens.push(match[1] ?? match[2]!);
  const out: string[] = ["newpath"];
  let i = 0;
  let cmd = "M";
  let cx = 0;
  let cy = 0;
  let sx = 0;
  let sy = 0;
  let lastCx = 0;
  let lastCy = 0;
  let lastQuadX = 0;
  let lastQuadY = 0;
  let lastWasCubic = false;
  let lastWasQuad = false;
  const read = (): number => {
    const n = Number.parseFloat(tokens[i] ?? "0");
    i += 1;
    return Number.isFinite(n) ? n : 0;
  };
  const isNum = () => tokens[i] !== undefined && !/^[A-Za-z]$/.test(tokens[i]!);
  while (i < tokens.length) {
    const token = tokens[i]!;
    if (/^[A-Za-z]$/.test(token)) {
      cmd = token;
      i += 1;
    }
    const rel = cmd === cmd.toLowerCase();
    const op = cmd.toUpperCase();
    switch (op) {
      case "M": {
        const x = read() + (rel ? cx : 0);
        const y = read() + (rel ? cy : 0);
        out.push(`${psNumber(x)} ${psNumber(y)} moveto`);
        cx = sx = x;
        cy = sy = y;
        lastWasCubic = false;
        lastWasQuad = false;
        cmd = rel ? "l" : "L";
        break;
      }
      case "L": {
        const x = read() + (rel ? cx : 0);
        const y = read() + (rel ? cy : 0);
        out.push(`${psNumber(x)} ${psNumber(y)} lineto`);
        cx = x;
        cy = y;
        lastWasCubic = false;
        lastWasQuad = false;
        break;
      }
      case "H": {
        const x = read() + (rel ? cx : 0);
        out.push(`${psNumber(x)} ${psNumber(cy)} lineto`);
        cx = x;
        lastWasCubic = false;
        lastWasQuad = false;
        break;
      }
      case "V": {
        const y = read() + (rel ? cy : 0);
        out.push(`${psNumber(cx)} ${psNumber(y)} lineto`);
        cy = y;
        lastWasCubic = false;
        lastWasQuad = false;
        break;
      }
      case "C": {
        const x1 = read() + (rel ? cx : 0);
        const y1 = read() + (rel ? cy : 0);
        const x2 = read() + (rel ? cx : 0);
        const y2 = read() + (rel ? cy : 0);
        const x = read() + (rel ? cx : 0);
        const y = read() + (rel ? cy : 0);
        out.push(
          `${psNumber(x1)} ${psNumber(y1)} ${psNumber(x2)} ${psNumber(y2)} ${psNumber(x)} ${psNumber(y)} curveto`,
        );
        lastCx = x2;
        lastCy = y2;
        cx = x;
        cy = y;
        lastWasCubic = true;
        lastWasQuad = false;
        break;
      }
      case "S": {
        const x2 = read() + (rel ? cx : 0);
        const y2 = read() + (rel ? cy : 0);
        const x = read() + (rel ? cx : 0);
        const y = read() + (rel ? cy : 0);
        const x1 = lastWasCubic ? 2 * cx - lastCx : cx;
        const y1 = lastWasCubic ? 2 * cy - lastCy : cy;
        out.push(
          `${psNumber(x1)} ${psNumber(y1)} ${psNumber(x2)} ${psNumber(y2)} ${psNumber(x)} ${psNumber(y)} curveto`,
        );
        lastCx = x2;
        lastCy = y2;
        cx = x;
        cy = y;
        lastWasCubic = true;
        lastWasQuad = false;
        break;
      }
      case "Q": {
        const x1 = read() + (rel ? cx : 0);
        const y1 = read() + (rel ? cy : 0);
        const x = read() + (rel ? cx : 0);
        const y = read() + (rel ? cy : 0);
        const c1x = cx + (2 / 3) * (x1 - cx);
        const c1y = cy + (2 / 3) * (y1 - cy);
        const c2x = x + (2 / 3) * (x1 - x);
        const c2y = y + (2 / 3) * (y1 - y);
        out.push(
          `${psNumber(c1x)} ${psNumber(c1y)} ${psNumber(c2x)} ${psNumber(c2y)} ${psNumber(x)} ${psNumber(y)} curveto`,
        );
        lastQuadX = x1;
        lastQuadY = y1;
        cx = x;
        cy = y;
        lastWasCubic = false;
        lastWasQuad = true;
        break;
      }
      case "T": {
        const x = read() + (rel ? cx : 0);
        const y = read() + (rel ? cy : 0);
        const x1 = lastWasQuad ? 2 * cx - lastQuadX : cx;
        const y1 = lastWasQuad ? 2 * cy - lastQuadY : cy;
        const c1x = cx + (2 / 3) * (x1 - cx);
        const c1y = cy + (2 / 3) * (y1 - cy);
        const c2x = x + (2 / 3) * (x1 - x);
        const c2y = y + (2 / 3) * (y1 - y);
        out.push(
          `${psNumber(c1x)} ${psNumber(c1y)} ${psNumber(c2x)} ${psNumber(c2y)} ${psNumber(x)} ${psNumber(y)} curveto`,
        );
        lastQuadX = x1;
        lastQuadY = y1;
        cx = x;
        cy = y;
        lastWasCubic = false;
        lastWasQuad = true;
        break;
      }
      case "A": {
        read();
        read();
        read();
        read();
        read();
        const x = read() + (rel ? cx : 0);
        const y = read() + (rel ? cy : 0);
        out.push(`${psNumber(x)} ${psNumber(y)} lineto`);
        cx = x;
        cy = y;
        lastWasCubic = false;
        lastWasQuad = false;
        break;
      }
      case "Z": {
        out.push("closepath");
        cx = sx;
        cy = sy;
        lastWasCubic = false;
        lastWasQuad = false;
        break;
      }
      default: {
        if (isNum()) read();
        break;
      }
    }
  }
  return out.join("\n");
}

function rectPathPs(x: number, y: number, width: number, height: number): string {
  const x2 = x + width;
  const y2 = y + height;
  return [
    "newpath",
    `${psNumber(x)} ${psNumber(y)} moveto`,
    `${psNumber(x2)} ${psNumber(y)} lineto`,
    `${psNumber(x2)} ${psNumber(y2)} lineto`,
    `${psNumber(x)} ${psNumber(y2)} lineto`,
    "closepath",
  ].join("\n");
}

function circlePathPs(cx: number, cy: number, r: number): string {
  return ["newpath", `${psNumber(cx)} ${psNumber(cy)} ${psNumber(r)} 0 360 arc`, "closepath"].join("\n");
}

function elementPathPs(el: SvgEl): string | null {
  switch (el.tag) {
    case "path": {
      const d = attr(el, "d");
      return d ? pathCommandsToPs(d) : null;
    }
    case "rect":
      return rectPathPs(numAttr(el, "x"), numAttr(el, "y"), numAttr(el, "width"), numAttr(el, "height"));
    case "circle":
      return circlePathPs(numAttr(el, "cx"), numAttr(el, "cy"), numAttr(el, "r"));
    case "ellipse": {
      const cx = numAttr(el, "cx");
      const cy = numAttr(el, "cy");
      const rx = numAttr(el, "rx");
      const ry = numAttr(el, "ry");
      return [
        "newpath",
        "gsave",
        `${psNumber(cx)} ${psNumber(cy)} translate`,
        `${psNumber(rx)} ${psNumber(ry)} scale`,
        "0 0 1 0 360 arc",
        "grestore",
        "closepath",
      ].join("\n");
    }
    case "polygon":
    case "polyline": {
      const points = (attr(el, "points") ?? "")
        .trim()
        .split(/[\s,]+/)
        .map(Number)
        .filter((n) => Number.isFinite(n));
      if (points.length < 4) return null;
      const lines = ["newpath", `${psNumber(points[0]!)} ${psNumber(points[1]!)} moveto`];
      for (let i = 2; i + 1 < points.length; i += 2) {
        lines.push(`${psNumber(points[i]!)} ${psNumber(points[i + 1]!)} lineto`);
      }
      if (el.tag === "polygon") lines.push("closepath");
      return lines.join("\n");
    }
    default:
      return null;
  }
}

function rgbPs(color: Rgb): string {
  return `${psNumber(color.r)} ${psNumber(color.g)} ${psNumber(color.b)} setrgbcolor`;
}

function withOpacity(ops: string[], opacity: number): string[] {
  if (opacity >= 0.999) return ops;
  return ["gsave", `[ /ca ${psNumber(opacity)} /CA ${psNumber(opacity)} /SetTransparency pdfmark`, ...ops, "grestore"];
}

function fillOp(rule: Paint["fillRule"]): string {
  return rule === "evenodd" ? "eofill" : "fill";
}

function clipOp(rule: Paint["fillRule"]): string {
  return rule === "evenodd" ? "eoclip" : "clip";
}

function decodeBase64(b64: string): Uint8Array {
  const binary = atob(b64);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) out[i] = binary.charCodeAt(i);
  return out;
}

function u32At(bytes: Uint8Array, offset: number): number {
  return ((bytes[offset]! << 24) | (bytes[offset + 1]! << 16) | (bytes[offset + 2]! << 8) | bytes[offset + 3]!) >>> 0;
}

function inflateStoredZlib(bytes: Uint8Array): Uint8Array | null {
  if (bytes.length < 6) return null;
  const parts: Uint8Array[] = [];
  let offset = 2;
  while (offset + 5 <= bytes.length) {
    const last = bytes[offset]! & 1;
    const size = bytes[offset + 1]! | (bytes[offset + 2]! << 8);
    offset += 5;
    if (offset + size > bytes.length - 4) return null;
    parts.push(bytes.subarray(offset, offset + size));
    offset += size;
    if (last) break;
  }
  const total = parts.reduce((sum, part) => sum + part.length, 0);
  const out = new Uint8Array(total);
  let dest = 0;
  for (const part of parts) {
    out.set(part, dest);
    dest += part.length;
  }
  return out;
}

function decodeStoredPng(bytes: Uint8Array): { width: number; height: number; rgba: Uint8Array } | null {
  const sig = [137, 80, 78, 71, 13, 10, 26, 10];
  if (bytes.length < 24) return null;
  for (let i = 0; i < 8; i += 1) if (bytes[i] !== sig[i]) return null;
  let offset = 8;
  let width = 0;
  let height = 0;
  const idat: Uint8Array[] = [];
  while (offset + 12 <= bytes.length) {
    const len = u32At(bytes, offset);
    const type = String.fromCharCode(bytes[offset + 4]!, bytes[offset + 5]!, bytes[offset + 6]!, bytes[offset + 7]!);
    const data = bytes.subarray(offset + 8, offset + 8 + len);
    if (type === "IHDR") {
      width = u32At(data, 0);
      height = u32At(data, 4);
      if (data[8] !== 8 || data[9] !== 6) return null;
    } else if (type === "IDAT") {
      idat.push(data);
    } else if (type === "IEND") {
      break;
    }
    offset += 12 + len;
  }
  if (width < 1 || height < 1 || idat.length === 0) return null;
  const compressed = new Uint8Array(idat.reduce((sum, part) => sum + part.length, 0));
  let dest = 0;
  for (const part of idat) {
    compressed.set(part, dest);
    dest += part.length;
  }
  const raw = inflateStoredZlib(compressed);
  if (!raw) return null;
  const stride = width * 4;
  const rgba = new Uint8Array(stride * height);
  for (let row = 0; row < height; row += 1) {
    const src = row * (stride + 1);
    if (raw[src] !== 0) return null;
    rgba.set(raw.subarray(src + 1, src + 1 + stride), row * stride);
  }
  return { width, height, rgba };
}

function pngDataUriToRgb(href: string): { width: number; height: number; rgb: Uint8Array } | null {
  const match = href.match(/^data:image\/png;base64,([A-Za-z0-9+/]+=*)$/);
  if (!match) return null;
  const decoded = decodeStoredPng(decodeBase64(match[1]!));
  if (!decoded) return null;
  const rgb = new Uint8Array(decoded.width * decoded.height * 3);
  for (let i = 0, j = 0; i < decoded.rgba.length; i += 4, j += 3) {
    rgb[j] = decoded.rgba[i]!;
    rgb[j + 1] = decoded.rgba[i + 1]!;
    rgb[j + 2] = decoded.rgba[i + 2]!;
  }
  return { width: decoded.width, height: decoded.height, rgb };
}

function hexImageData(rgb: Uint8Array): string {
  const lines: string[] = [];
  let line = "";
  for (let i = 0; i < rgb.length; i += 1) {
    line += rgb[i]!.toString(16).padStart(2, "0");
    if (line.length >= 64) {
      lines.push(line);
      line = "";
    }
  }
  if (line) lines.push(line);
  lines.push(">");
  return lines.join("\n");
}

function imagePs(x: number, y: number, width: number, height: number, href: string): string | null {
  const decoded = pngDataUriToRgb(href);
  if (!decoded) return null;
  return [
    "gsave",
    `${psNumber(x)} ${psNumber(y)} translate`,
    `${psNumber(width)} ${psNumber(height)} scale`,
    `${decoded.width} ${decoded.height} 8`,
    `[${decoded.width} 0 0 ${-decoded.height} 0 ${decoded.height}]`,
    "{ currentfile /ASCIIHexDecode filter } bind",
    "false 3",
    "colorimage",
    hexImageData(decoded.rgb),
    "grestore",
  ].join("\n");
}

function shadingPs(grad: LinearGradientDef, bbox: { x: number; y: number; width: number; height: number }): string {
  const x1 = grad.userSpace ? grad.x1 : bbox.x + grad.x1 * bbox.width;
  const y1 = grad.userSpace ? grad.y1 : bbox.y + grad.y1 * bbox.height;
  const x2 = grad.userSpace ? grad.x2 : bbox.x + grad.x2 * bbox.width;
  const y2 = grad.userSpace ? grad.y2 : bbox.y + grad.y2 * bbox.height;
  const stops = [...grad.stops];
  if (stops.length === 1) stops.push({ offset: 1, color: stops[0]!.color });
  const functions = [];
  for (let i = 0; i < stops.length - 1; i += 1) {
    const a = stops[i]!;
    const b = stops[i + 1]!;
    functions.push(
      `<< /FunctionType 2 /Domain [0 1] /C0 [${psNumber(a.color.r)} ${psNumber(a.color.g)} ${psNumber(a.color.b)}] /C1 [${psNumber(b.color.r)} ${psNumber(b.color.g)} ${psNumber(b.color.b)}] /N 1 >>`,
    );
  }
  const bounds = stops.slice(1, -1).map((stop) => psNumber(stop.offset));
  const encode = Array.from({ length: functions.length }, () => "0 1").join(" ");
  return [
    "<<",
    "  /ShadingType 2",
    "  /ColorSpace /DeviceRGB",
    `  /Coords [${psNumber(x1)} ${psNumber(y1)} ${psNumber(x2)} ${psNumber(y2)}]`,
    "  /Extend [true true]",
    "  /Function <<",
    "    /FunctionType 3",
    "    /Domain [0 1]",
    `    /Functions [${functions.join(" ")}]`,
    `    /Bounds [${bounds.join(" ")}]`,
    `    /Encode [${encode}]`,
    "  >>",
    ">> shfill",
  ].join("\n");
}

function isMaskBackground(el: SvgEl, paint: Paint): boolean {
  if (el.tag !== "rect") return false;
  const color = parseColor(paint.fill);
  return Boolean(color && color.r === 0 && color.g === 0 && color.b === 0);
}

function maskShapes(
  mask: MaskDef,
  css: Record<string, { fill?: string; fillOpacity?: number; stroke?: string }>,
): Array<{ path: string; opacity: number }> {
  const shapes: Array<{ path: string; opacity: number }> = [];
  const walk = (el: SvgEl, inherited: Paint) => {
    const paint = mergePaint(inherited, el, css);
    if (el.tag === "g") {
      for (const child of el.children) walk(child, paint);
      return;
    }
    if (isMaskBackground(el, paint)) return;
    const path = elementPathPs(el);
    if (!path) return;
    shapes.push({ path, opacity: clamp01(paint.fillOpacity * paint.opacity) });
  };
  for (const child of mask.children) walk(child, { ...defaultPaint(), fill: "white" });
  return shapes;
}

function bboxFor(el: SvgEl): { x: number; y: number; width: number; height: number } {
  if (el.tag === "rect" || el.tag === "image" || el.tag === "svg") {
    return {
      x: numAttr(el, "x"),
      y: numAttr(el, "y"),
      width: Math.max(0.001, numAttr(el, "width")),
      height: Math.max(0.001, numAttr(el, "height")),
    };
  }
  return { x: 0, y: 0, width: 1, height: 1 };
}

type EpsContext = {
  defs: Map<string, SvgEl>;
  css: Record<string, { fill?: string; fillOpacity?: number; stroke?: string }>;
  out: string[];
};

function paintDefFor(ctx: EpsContext, fill: string): PaintDef | null {
  const id = urlId(fill);
  const el = ctx.defs.get(id);
  return el ? asPaintDef(el) : null;
}

function emitClip(ctx: EpsContext, path: string, rule: Paint["fillRule"]): void {
  ctx.out.push("gsave", path, clipOp(rule), "newpath");
}

function emitFillPaint(ctx: EpsContext, el: SvgEl, paint: Paint, path: string, opacity: number): void {
  const fill = paint.fill;
  if (!fill || fill === "none") return;
  if (isUrlFill(fill)) {
    const def = paintDefFor(ctx, fill);
    if (!def) return;
    switch (def.kind) {
      case "linearGradient":
        ctx.out.push(...withOpacity([path, clipOp(paint.fillRule), "newpath", shadingPs(def, bboxFor(el))], opacity));
        return;
      case "pattern": {
        if (!def.imageHref) return;
        const image = imagePs(def.x, def.y, def.width, def.height, def.imageHref);
        if (!image) return;
        ctx.out.push(...withOpacity([path, clipOp(paint.fillRule), "newpath", image], opacity));
        return;
      }
      case "mask":
      case "clipPath":
        return;
      default: {
        const _never: never = def;
        return assertNever(_never);
      }
    }
  }
  const color = parseColor(fill);
  if (!color) return;
  ctx.out.push(...withOpacity([path, rgbPs(color), fillOp(paint.fillRule)], opacity));
}

function emitStroke(ctx: EpsContext, paint: Paint, path: string, opacity: number): void {
  if (!paint.stroke || paint.stroke === "none") return;
  const color = parseColor(paint.stroke);
  if (!color) return;
  ctx.out.push(
    ...withOpacity(
      [path, rgbPs(color), `${psNumber(Math.max(0.05, paint.strokeWidth))} setlinewidth`, "stroke"],
      opacity,
    ),
  );
}

function emitText(ctx: EpsContext, el: SvgEl, paint: Paint): void {
  const text = el.text.replace(/\s+/g, " ").trim();
  if (!text) return;
  const fill = parseColor(paint.fill);
  if (!fill) return;
  const style = parseStyleMap(attr(el, "style"));
  const fontSize = Number.parseFloat(style["font-size"] ?? "") || 12;
  const x = numAttr(el, "x");
  const y = numAttr(el, "y");
  const anchor = attr(el, "text-anchor") ?? "start";
  const escaped = text.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
  const align =
    anchor === "middle"
      ? ["dup stringwidth pop -2 div 0 rmoveto"]
      : anchor === "end"
        ? ["dup stringwidth pop neg 0 rmoveto"]
        : [];
  ctx.out.push(
    ...withOpacity(
      [
        "gsave",
        rgbPs(fill),
        `${psNumber(x)} ${psNumber(y)} translate`,
        "1 -1 scale",
        `/Helvetica findfont ${psNumber(fontSize)} scalefont setfont`,
        "0 0 moveto",
        `(${escaped})`,
        ...align,
        "show",
        "grestore",
      ],
      clamp01(paint.fillOpacity * paint.opacity),
    ),
  );
}

function withMaskOrClip(ctx: EpsContext, paint: Paint, emit: (opacity: number) => void): void {
  const maskRef = paint.mask && isUrlFill(paint.mask) ? paintDefFor(ctx, paint.mask) : null;
  const clipRef = paint.clipPath && isUrlFill(paint.clipPath) ? paintDefFor(ctx, paint.clipPath) : null;
  const shapes: Array<{ path: string; opacity: number }> = [];
  if (maskRef && (maskRef.kind === "mask" || maskRef.kind === "clipPath")) {
    shapes.push(...maskShapes(maskRef, ctx.css));
  }
  if (clipRef && (clipRef.kind === "mask" || clipRef.kind === "clipPath")) {
    shapes.push(...maskShapes(clipRef, ctx.css));
  }
  if (shapes.length === 0) {
    emit(clamp01(paint.fillOpacity * paint.opacity));
    return;
  }
  for (const shape of shapes) {
    emitClip(ctx, shape.path, paint.fillRule);
    emit(clamp01(paint.fillOpacity * paint.opacity * shape.opacity));
    ctx.out.push("grestore");
  }
}

function paintElement(ctx: EpsContext, el: SvgEl, inherited: Paint): void {
  if (SKIP_PAINT_TAGS.has(el.tag)) return;
  const paint = mergePaint(inherited, el, ctx.css);
  if (el.tag === "g" || el.tag === "svg") {
    const clip = paint.clipPath && isUrlFill(paint.clipPath) ? paintDefFor(ctx, paint.clipPath) : null;
    if (clip && (clip.kind === "mask" || clip.kind === "clipPath")) {
      const shapes = maskShapes(clip, ctx.css);
      for (const shape of shapes) emitClip(ctx, shape.path, paint.fillRule);
      for (const child of el.children) paintElement(ctx, child, { ...paint, clipPath: null });
      for (const _ of shapes) ctx.out.push("grestore");
      return;
    }
    for (const child of el.children) paintElement(ctx, child, paint);
    return;
  }
  if (el.tag === "image") {
    const href = attr(el, "href") ?? attr(el, "xlink:href");
    if (!href) return;
    const image = imagePs(numAttr(el, "x"), numAttr(el, "y"), numAttr(el, "width"), numAttr(el, "height"), href);
    if (!image) return;
    withMaskOrClip(ctx, paint, (opacity) => {
      ctx.out.push(...withOpacity([image], opacity));
    });
    return;
  }
  if (el.tag === "text") {
    withMaskOrClip(ctx, paint, () => emitText(ctx, el, paint));
    return;
  }
  const path = elementPathPs(el);
  if (!path) return;
  withMaskOrClip(ctx, paint, (opacity) => {
    emitFillPaint(ctx, el, paint, path, opacity);
    emitStroke(ctx, paint, path, opacity);
  });
}

function artboardSize(root: SvgEl): { width: number; height: number } {
  const viewBox = (attr(root, "viewbox") ?? "")
    .trim()
    .split(/[\s,]+/)
    .map(Number);
  const vbW = viewBox.length === 4 ? viewBox[2]! : Number.NaN;
  const vbH = viewBox.length === 4 ? viewBox[3]! : Number.NaN;
  const width = numAttr(root, "width", Number.isFinite(vbW) ? vbW : 1);
  const height = numAttr(root, "height", Number.isFinite(vbH) ? vbH : 1);
  return { width: Math.max(1, width), height: Math.max(1, height) };
}

export function svgToEps(svg: string): string {
  const root = findSvgRoot(parseSvgFragment(svg));
  if (!root) throw new Error("SVG export did not contain an <svg> root");
  const { width, height } = artboardSize(root);
  const cssParts: string[] = [];
  collectStyleText(root, cssParts);
  const defs = new Map<string, SvgEl>();
  collectDefs(root, defs);
  const ctx: EpsContext = {
    defs,
    css: parseCssFills(cssParts.join("\n")),
    out: [],
  };
  const boxW = Math.ceil(width);
  const boxH = Math.ceil(height);
  ctx.out.push(
    "gsave",
    `0 ${psNumber(height)} translate`,
    "1 -1 scale",
    rectPathPs(0, 0, width, height),
    "clip",
    "newpath",
  );
  paintElement(ctx, root, defaultPaint());
  ctx.out.push("grestore");
  return [
    "%!PS-Adobe-3.0 EPSF-3.0",
    `%%BoundingBox: 0 0 ${boxW} ${boxH}`,
    `%%HiResBoundingBox: 0 0 ${psNumber(width)} ${psNumber(height)}`,
    "%%Creator: connect-shader",
    "%%Title: stripes",
    "%%Pages: 1",
    "%%LanguageLevel: 3",
    "%%EndComments",
    "%%BeginProlog",
    "%%EndProlog",
    "%%Page: 1 1",
    ctx.out.join("\n"),
    "showpage",
    "%%EOF",
    "",
  ].join("\n");
}

export function downloadEps(eps: string, filename = "stripes.eps"): void {
  const blob = new Blob([eps], { type: "application/postscript" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
