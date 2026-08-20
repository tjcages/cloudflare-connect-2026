import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  extractSvgInner,
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
    expect(prepared.markSvg).toContain('fill="white"');
    expect(prepared.markSvg).not.toContain("#123456");
    expect(prepared.textureSvg).toContain('fill="black"');
    expect(prepared.textureSvg).toContain('width="800"');
    expect(prepared.textureSvg).toContain('height="320"');
    expect(paintSvgFillsWhite(`fill="#abc" stroke="#def"`)).toBe(
      `fill="white" stroke="white"`
    );
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
});
