import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  BADGE_MARK_RASTER,
  BADGE_PLATE_VIEW_H,
  BADGE_PLATE_VIEW_W,
  BADGE_PRINT_FIELD_SRC,
  badgeMarkSvg,
  badgePlateLogoRect,
  badgeShaderPlateSvg,
  extractSvgInner,
  paintSvgFills,
  paintSvgFillsWhite,
  parseSvgViewport,
  prepareBadgeLogo,
  readSvgFile,
  stripUnsafeSvg,
  svgRasterSize,
  SVG_MAX_BYTES,
} from "./badge-logo";

describe("badge logo SVG prep", () => {
  it("strips scripts, foreignObject, and on* handlers", () => {
    const raw = `<svg viewBox="0 0 10 10" onload="alert(1)"><script>alert(1)</script><foreignObject></foreignObject><path onclick="boom()" d="M0 0"/></svg>`;
    const safe = stripUnsafeSvg(raw);
    expect(safe).not.toMatch(/script/i);
    expect(safe).not.toMatch(/foreignObject/i);
    expect(safe).not.toMatch(/onload|onclick/i);
    expect(safe).toContain("<path");
  });

  it("reads viewBox and inner markup", () => {
    const svg = `<svg viewBox="0 0 20 10"><circle cx="10" cy="5" r="4"/></svg>`;
    expect(parseSvgViewport(svg)).toEqual({ x: 0, y: 0, w: 20, h: 10 });
    expect(extractSvgInner(svg)).toBe(`<circle cx="10" cy="5" r="4"/>`);
  });

  it("paints fills white and builds a full stylized SVG plate from the upload", () => {
    const prepared = prepareBadgeLogo(
      `<svg viewBox="0 0 40 20"><path fill="#123456" d="M0 0h40v20z"/></svg>`
    );
    expect(prepared.colorSvg).toContain("#123456");
    expect(prepared.colorSvg).toContain('width="40"');
    expect(prepared.colorSvg).toContain('height="20"');
    expect(prepared.markSvg).toContain('fill="white"');
    expect(prepared.markSvg).not.toContain("#123456");
    const plate = badgeShaderPlateSvg(
      `<svg viewBox="0 0 40 20"><path fill="#123456" d="M0 0h40v20z"/></svg>`
    );
    expect(plate).toContain("M0 0h40v20z");
    expect(plate).toContain('width="1600"');
    expect(plate).toContain('height="640"');
    expect(plate).toContain('viewBox="0 0 800 320"');
    expect(plate).toContain('viewBox="0 0 40 20"');
    expect(plate).toContain('preserveAspectRatio="xMidYMid meet"');
    expect(plate).toContain('fill="#000000"');
    expect(plate).toContain('stroke="#ffffff"');
    expect(plate).toContain("url(#badge-print-lit)");
    expect(plate).not.toContain("#123456");
    expect(paintSvgFillsWhite(`fill="#abc" stroke="#def"`)).toBe(
      `fill="white" stroke="white"`
    );
    expect(
      paintSvgFills(
        `fill="#5865F2" style="fill:#5865F2;fill:color(display-p3 0.3451 0.3961 0.9490);"`,
        "#f46021"
      )
    ).toContain("#f46021");
    expect(
      paintSvgFills(
        `fill="#5865F2" style="fill:#5865F2;fill:color(display-p3 0.3451 0.3961 0.9490);"`,
        "#f46021"
      )
    ).not.toContain("#5865F2");
    expect(paintSvgFillsWhite(`fill="currentColor"`)).toBe(`fill="white"`);
  });

  it("centers a landscape logo large in the 800×320 plate", () => {
    const slot = badgePlateLogoRect({ w: 40, h: 20 });
    expect(slot.w).toBeGreaterThan(BADGE_PLATE_VIEW_W * 0.6);
    expect(slot.h).toBeGreaterThan(BADGE_PLATE_VIEW_H * 0.7);
    expect(slot.x + slot.w / 2).toBeCloseTo(BADGE_PLATE_VIEW_W / 2, 5);
    expect(slot.y + slot.h / 2).toBeCloseTo(BADGE_PLATE_VIEW_H / 2, 5);
  });

  it("tints a mark to the theme fill", () => {
    const mark = badgeMarkSvg(
      `<svg viewBox="0 0 40 20"><path fill="#123456" d="M0 0h40v20z"/></svg>`,
      "#2563fe"
    );
    expect(mark).toContain("#2563fe");
    expect(mark).not.toContain("#123456");
    expect(mark).toContain('width="2048"');
    expect(mark).toContain('height="1024"');
    expect(mark).toContain('viewBox="0 0 40 20"');
  });

  it("rejects non-svg markup", () => {
    expect(() => prepareBadgeLogo("<div>nope</div>")).toThrow(/SVG/i);
  });

  it("rejects non-svg files and oversized uploads", async () => {
    await expect(
      readSvgFile(new File(["<svg></svg>"], "logo.png", { type: "image/png" }))
    ).rejects.toThrow(/SVG/i);
    await expect(
      readSvgFile(
        new File([new Uint8Array(SVG_MAX_BYTES + 1)], "logo.svg", {
          type: "image/svg+xml",
        })
      )
    ).rejects.toThrow(/400/);
    await expect(
      readSvgFile(
        new File(["<svg></svg>"], "logo.svg", {
          type: "image/svg+xml",
        })
      )
    ).resolves.toContain("<svg");
  });

  it("prepares the seeded Cloudflare mark", () => {
    const svg = readFileSync(
      resolve(process.cwd(), "public/connect/badge-demo-logo.svg"),
      "utf8"
    );
    const prepared = prepareBadgeLogo(svg);
    expect(prepared.markSvg).toContain('fill="white"');
    expect(extractSvgInner(svg)).toContain("<path");
    expect(badgeShaderPlateSvg(svg)).toContain("M29.818");
    const mark = badgeMarkSvg(svg, "#f46021");
    expect(mark).toContain(`width="${BADGE_MARK_RASTER}"`);
    expect(svgRasterSize({ w: 37, h: 17 })).toEqual({
      w: BADGE_MARK_RASTER,
      h: Math.round(BADGE_MARK_RASTER * (17 / 37)),
    });
  });

  it("prepares a Discord-style wordmark with p3 fills", () => {
    const svg = readFileSync(
      resolve(process.cwd(), "src/components/logo-cloud/_svg/logo-discord.svg"),
      "utf8"
    );
    const prepared = prepareBadgeLogo(svg);
    expect(prepared.colorSvg).toContain("#5865F2");
    expect(prepared.markSvg).toContain('width="106"');
    expect(prepared.markSvg).toContain('height="16"');
    expect(prepared.markSvg).toContain('fill="white"');
    expect(prepared.markSvg).not.toMatch(/#5865F2/i);
    expect(prepared.markSvg).not.toContain("display-p3");
  });

  it("rebuilds the shader plate when the SVG changes", () => {
    const rect = badgeShaderPlateSvg(
      `<svg viewBox="0 0 40 20"><path d="M0 0h40v20z"/></svg>`
    );
    const circle = badgeShaderPlateSvg(
      `<svg viewBox="0 0 40 20"><circle cx="20" cy="10" r="8"/></svg>`
    );
    expect(rect).toContain("M0 0h40v20z");
    expect(rect).not.toContain("<circle");
    expect(circle).toContain("<circle cx=\"20\"");
    expect(circle).not.toContain("M0 0h40v20z");
  });

  it("uses the full Connect-cloud SVG as the fallback stripe source", () => {
    const fieldPath = resolve(
      process.cwd(),
      "public/connect/badge-print-field.svg"
    );
    const field = readFileSync(fieldPath, "utf8");
    const overlay = readFileSync(
      resolve(process.cwd(), "public/connect/badge-demo-logo.svg"),
      "utf8"
    );
    expect(field).toContain('fill="#000000"');
    expect(field).toContain('stroke="#ffffff"');
    expect(field).toContain("url(#badge-print-lit)");
    expect(field).toContain('width="1600"');
    expect(field).toContain('height="640"');
    expect(field).toContain('viewBox="0 0 800 320"');
    expect(field).toContain('preserveAspectRatio="xMidYMid meet"');
    expect(field).toContain("M226.32 47.1364");
    expect(overlay).toContain("M29.818");
    expect(field).not.toContain("M29.818");
    expect(BADGE_PRINT_FIELD_SRC).toBe("/connect/badge-print-field.svg?v=wide");

    const shader = readFileSync(
      resolve(
        process.cwd(),
        "src/components/_pages/connect/badge/BadgePrintShader.tsx"
      ),
      "utf8"
    );
    expect(shader).toContain("src: string");
    expect(shader).toContain("image.src = src");
    expect(shader).toContain("engine.setSource(null)");
    expect(shader).toContain("blitPrintFrame");
    expect(shader).not.toContain("[canvasRef, height, maxDpr, src, width]");

    const preview = readFileSync(
      resolve(
        process.cwd(),
        "src/components/_pages/connect/badge/BadgeShaderSource.tsx"
      ),
      "utf8"
    );
    expect(preview).toContain("src={src}");

    const upload = readFileSync(
      resolve(
        process.cwd(),
        "src/components/_pages/connect/badge/BadgeLogoUpload.tsx"
      ),
      "utf8"
    );
    expect(upload).toContain("BadgeShaderSource");
    expect(upload).toContain("src={plateSrc}");
    expect(upload).toContain("group/source");
    expect(upload).toContain("group-hover/source:visible");
    expect(upload).toContain('aria-label="Preview shader source"');

    const page = readFileSync(
      resolve(
        process.cwd(),
        "src/components/_pages/connect/badge/BadgePage.tsx"
      ),
      "utf8"
    );
    expect(page).toContain("plateSrc={plateSrc}");
    expect(page).toContain("printSrc={plateSrc}");
    expect(page).toContain("h-760");
    expect(page).toContain("sourceZoom");
    expect(page).toContain('fit: "cover"');
    expect(page).toContain("whitePoint: 0.81");
    expect(page).toContain("400 : 800");

    const lanyard = readFileSync(
      resolve(
        process.cwd(),
        "src/components/_pages/connect/badge/BadgeLanyard.tsx"
      ),
      "utf8"
    );
    expect(lanyard).toContain('"contain"');
    expect(page).not.toContain("src={logoMarkSrc");
    expect(page).not.toContain("<BadgeShaderSource");
  });
});
