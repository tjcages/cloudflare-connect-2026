import type { Palette } from "./palette";

export interface NormalizedIcon {
  body: string;
  variant: "mono" | "duo";
  viewBox: string;
}

export interface NormalizeResult {
  icon: NormalizedIcon;
  warnings: string[];
}

const PAINTS = ["fill", "stroke"] as const;
type PaintProp = (typeof PAINTS)[number];

const TAG_RE = /<([a-zA-Z][\w-]*)\b([^>]*?)(\/?)>/g;

interface ColorInfo {
  hex: string | null;
  id: string;
  token: string | null;
}

function splitSvg(svg: string): { viewBox: string; body: string } {
  const open = /<svg\b([^>]*)>/i.exec(svg);
  const vb = open ? /viewBox\s*=\s*"([^"]+)"/i.exec(open[1]) : null;
  const viewBox = vb ? vb[1] : "0 0 24 24";
  const body = svg
    .replace(/^[\s\S]*?<svg\b[^>]*>/i, "")
    .replace(/<\/svg>\s*$/i, "")
    .trim();
  return { viewBox, body };
}

function luminance(hex: string): number {
  const h = hex.replace("#", "");
  const full =
    h.length === 3
      ? h
          .split("")
          .map((c) => c + c)
          .join("")
      : h;
  const r = Number.parseInt(full.slice(0, 2), 16) / 255;
  const g = Number.parseInt(full.slice(2, 4), 16) / 255;
  const b = Number.parseInt(full.slice(4, 6), 16) / 255;
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function attrColor(attrs: string, prop: PaintProp): string | null {
  return (
    new RegExp(`(?:^|\\s)${prop}\\s*=\\s*"([^"]+)"`, "i").exec(attrs)?.[1] ??
    null
  );
}

function styleColors(
  attrs: string,
  prop: PaintProp
): { hex: string | null; p3: string | null } {
  const style = /style\s*=\s*"([^"]*)"/i.exec(attrs)?.[1] ?? "";
  const re = new RegExp(`(?:^|;)\\s*${prop}\\s*:\\s*([^;]+)`, "gi");
  let hex: string | null = null;
  let p3: string | null = null;
  let m = re.exec(style);
  while (m) {
    const v = m[1].trim();
    if (v.startsWith("#")) {
      hex = v;
    } else if (v.startsWith("color(")) {
      p3 = v;
    }
    m = re.exec(style);
  }
  return { hex, p3 };
}

function colorOf(
  attrs: string,
  prop: PaintProp,
  palette: Palette
): ColorInfo | null {
  const sd = styleColors(attrs, prop);
  const attr = attrColor(attrs, prop);
  const hex = sd.hex ?? (attr?.startsWith("#") ? attr : null);
  const p3 = sd.p3 ?? (attr?.startsWith("color(") ? attr : null);
  const raw = p3 ?? hex ?? attr;
  if (!raw || raw === "none") {
    return null;
  }
  const token =
    (p3 && palette.match(p3)) || (hex && palette.match(hex)) || null;
  const id = token ?? `lit:${(hex ?? p3 ?? raw).toLowerCase()}`;
  return { id, token, hex };
}

export function normalizeSvg(
  svg: string,
  palette: Palette,
  name: string
): NormalizeResult {
  const warnings: string[] = [];
  const { viewBox, body } = splitSvg(svg);

  const colors = new Map<string, ColorInfo>();
  let m: RegExpExecArray | null = TAG_RE.exec(body);
  while (m) {
    for (const prop of PAINTS) {
      const c = colorOf(m[2], prop, palette);
      if (c && !colors.has(c.id)) {
        colors.set(c.id, c);
      }
    }
    m = TAG_RE.exec(body);
  }
  TAG_RE.lastIndex = 0;

  const ids = [...colors.keys()];
  let variant: "mono" | "duo" = "mono";
  const target = new Map<string, string>();

  if (ids.length <= 1) {
    for (const id of ids) {
      target.set(id, "currentColor");
    }
  } else if (ids.length === 2) {
    variant = "duo";
    const a = colors.get(ids[0]) as ColorInfo;
    const b = colors.get(ids[1]) as ColorInfo;
    const ra = a.token ? palette.roleOf(a.token) : "other";
    const rb = b.token ? palette.roleOf(b.token) : "other";
    let mainId: string;
    let secId: string;
    if (ra === "main" || rb === "secondary") {
      mainId = a.id;
      secId = b.id;
    } else if (rb === "main" || ra === "secondary") {
      mainId = b.id;
      secId = a.id;
    } else {
      warnings.push(
        `${name}: duo colors did not match a -900/-800 palette pair; assigned Main/Secondary by luminance.`
      );
      const la = a.hex ? luminance(a.hex) : 1;
      const lb = b.hex ? luminance(b.hex) : 1;
      mainId = la <= lb ? a.id : b.id;
      secId = la <= lb ? b.id : a.id;
    }
    target.set(mainId, "var(--icon-color-primary, currentColor)");
    target.set(secId, "var(--icon-color-secondary, currentColor)");
  } else {
    warnings.push(
      `${name}: ${ids.length} colors found; left unthemed (treated as full-color).`
    );
    return { icon: { body, viewBox, variant: "mono" }, warnings };
  }

  const out = body.replace(
    TAG_RE,
    (_full, tag: string, attrs: string, close: string) => {
      let next = attrs;

      const styleRaw = /style\s*=\s*"([^"]*)"/i.exec(attrs)?.[1] ?? "";
      const styleDecls: string[] = [];
      for (const decl of styleRaw.split(";")) {
        const d = decl.trim();
        if (!d) {
          continue;
        }
        const propName = d.split(":")[0].trim().toLowerCase();
        if (propName === "fill" || propName === "stroke") {
          continue; // drop color decls (incl. display-p3 dup)
        }
        styleDecls.push(d);
      }
      next = next.replace(/\s*style\s*=\s*"[^"]*"/i, "");

      for (const prop of PAINTS) {
        const attrVal = attrColor(attrs, prop);
        if (attrVal && attrVal !== "none") {
          next = next.replace(
            new RegExp(`\\s*${prop}\\s*=\\s*"[^"]*"`, "i"),
            ""
          );
        }
        const c = colorOf(attrs, prop, palette);
        if (c) {
          const value = target.get(c.id);
          if (value) {
            styleDecls.push(`${prop}:${value}`);
          }
        }
      }

      next = next.replace(/\s{2,}/g, " ").replace(/\s+$/, "");
      const styleAttr = styleDecls.length
        ? ` style="${styleDecls.join(";")}"`
        : "";
      return `<${tag}${next}${styleAttr}${close ? " /" : ""}>`;
    }
  );
  TAG_RE.lastIndex = 0;

  return { icon: { body: out.trim(), viewBox, variant }, warnings };
}
