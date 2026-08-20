import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  badgeMarkSvg,
  extractSvgInner,
  paintSvgFills,
  paintSvgFillsWhite,
  parseSvgViewport,
  prepareBadgeLogo,
  readSvgFile,
  stripUnsafeSvg,
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

  it("paints fills white and wraps a black texture plate", () => {
    const prepared = prepareBadgeLogo(
      `<svg viewBox="0 0 40 20"><path fill="#123456" d="M0 0h40v20z"/></svg>`
    );
    expect(prepared.colorSvg).toContain("#123456");
    expect(prepared.colorSvg).toContain('width="40"');
    expect(prepared.colorSvg).toContain('height="20"');
    expect(prepared.markSvg).toContain('fill="white"');
    expect(prepared.markSvg).not.toContain("#123456");
    expect(prepared.textureSvg).toContain('fill="black"');
    expect(prepared.textureSvg).toContain('width="800"');
    expect(prepared.textureSvg).toContain('height="1200"');
    expect(prepared.textureSvg).toContain("<circle");
    expect(prepared.textureSvg).toContain('fill="black"');
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

  it("tints a mark to the theme fill", () => {
    const mark = badgeMarkSvg(
      `<svg viewBox="0 0 40 20"><path fill="#123456" d="M0 0h40v20z"/></svg>`,
      "#2563fe"
    );
    expect(mark).toContain("#2563fe");
    expect(mark).not.toContain("#123456");
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
    expect(prepared.textureSvg).toContain('fill="black"');
    expect(extractSvgInner(svg)).toContain("<path");
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
});
