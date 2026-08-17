import fs from "node:fs";

export type Role = "main" | "secondary" | "other";

export interface Palette {
  /** Canonical token (e.g. "orange-900") for a paint value, or null if unknown. */
  match(paint: string): string | null;
  roleOf(token: string): Role;
}

interface P3 {
  b: number;
  g: number;
  r: number;
  token: string;
}

const EPS_SQ = 0.02 ** 2 * 3; // ~0.02 per channel tolerance

function normHex(hex: string): string {
  let h = hex.trim().toLowerCase().replace("#", "");
  if (h.length === 3) {
    h = h
      .split("")
      .map((c) => c + c)
      .join("");
  }
  return h.slice(0, 6);
}

export function parsePalette(css: string): Palette {
  const p3s: P3[] = [];
  const hexes = new Map<string, string>();

  // Only numbered shade tokens (e.g. "orange-900") are indexed; named stops
  // such as "neutral-white" are intentionally skipped.
  const p3Re =
    /--color-([a-z]+-\d+)\s*:\s*color\(display-p3\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)\s*\)/g;
  for (const m of css.matchAll(p3Re)) {
    p3s.push({ token: m[1], r: +m[2], g: +m[3], b: +m[4] });
  }

  const hexRe = /--color-([a-z]+-\d+)\s*:\s*(#[0-9a-fA-F]{3,8})\b/g;
  for (const m of css.matchAll(hexRe)) {
    hexes.set(normHex(m[2]), m[1]);
  }

  const matchP3 = (r: number, g: number, b: number): string | null => {
    let best: string | null = null;
    let bestD = EPS_SQ;
    for (const p of p3s) {
      const d = (p.r - r) ** 2 + (p.g - g) ** 2 + (p.b - b) ** 2;
      if (d <= bestD) {
        bestD = d;
        best = p.token;
      }
    }
    return best;
  };

  return {
    match(paint: string): string | null {
      const p = paint.trim();
      const p3 = /color\(display-p3\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)\s*\)/.exec(
        p
      );
      if (p3) {
        return matchP3(+p3[1], +p3[2], +p3[3]);
      }
      if (p.startsWith("#")) {
        return hexes.get(normHex(p)) ?? null;
      }
      return null;
    },
    roleOf(token: string): Role {
      if (token.endsWith("-900")) {
        return "main";
      }
      if (token.endsWith("-800")) {
        return "secondary";
      }
      return "other";
    },
  };
}

export function loadPalette(cssPath: string): Palette {
  return parsePalette(fs.readFileSync(cssPath, "utf8"));
}
