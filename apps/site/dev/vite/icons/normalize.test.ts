import { describe, expect, it } from "vitest";
import { normalizeSvg } from "./normalize";
import { parsePalette } from "./palette";

const palette = parsePalette(`
:root {
  --color-orange-900: color(display-p3 0.92 0.34 0.16);
  --color-orange-800: color(display-p3 0.98 0.72 0.23);
  --color-purple-900: color(display-p3 0.57 0.22 0.99);
}
`);

const MONO = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
<path d="M1 2Z" fill="#9138FC" style="fill:#9138FC;fill:color(display-p3 0.5700 0.2200 0.9900);fill-opacity:1;"/>
<path d="M3 4Z" fill="#9138FC" style="fill:#9138FC;fill:color(display-p3 0.5700 0.2200 0.9900);fill-opacity:1;"/>
</svg>`;

const DUO = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
<path d="M1 2Z" stroke="#FAB83B" style="stroke:#FAB83B;stroke:color(display-p3 0.9800 0.7200 0.2300);stroke-opacity:1;" stroke-width="1.5"/>
<path d="M3 4Z" stroke="#EB5729" style="stroke:#EB5729;stroke:color(display-p3 0.9216 0.3412 0.1608);stroke-opacity:1;" stroke-width="1.5" stroke-linecap="square"/>
</svg>`;

describe("normalizeSvg — mono", () => {
  const { icon } = normalizeSvg(MONO, palette, "mono");

  it("is classified mono", () => {
    expect(icon.variant).toBe("mono");
  });
  it("keeps viewBox, drops width/height", () => {
    expect(icon.viewBox).toBe("0 0 24 24");
    expect(icon.body).not.toMatch(/width=/);
    expect(icon.body).not.toMatch(/height=/);
  });
  it("rewrites every paint to currentColor and removes display-p3 duplicates", () => {
    expect(icon.body).toMatch(/fill:currentColor/);
    expect(icon.body).not.toMatch(/display-p3/);
    expect(icon.body).not.toMatch(/#9138FC/i);
  });
  it("preserves non-color style decls", () => {
    expect(icon.body).toMatch(/fill-opacity:1/);
  });
});

describe("normalizeSvg — duo", () => {
  const { icon } = normalizeSvg(DUO, palette, "duo");

  it("is classified duo", () => {
    expect(icon.variant).toBe("duo");
  });
  it("maps Main (-700) to c1 and Secondary (-650) to c2", () => {
    // #EB5729 == orange-900 (Main) -> c1 ; #FAB83B == orange-800 (Secondary) -> c2
    expect(icon.body).toMatch(
      /stroke:var\(--icon-color-primary, currentColor\)/
    );
    expect(icon.body).toMatch(
      /stroke:var\(--icon-color-secondary, currentColor\)/
    );
    expect(icon.body).not.toMatch(/display-p3/);
  });
  it("preserves stroke-width and stroke-linecap", () => {
    expect(icon.body).toMatch(/stroke-width="1.5"/);
    expect(icon.body).toMatch(/stroke-linecap="square"/);
  });
});

describe("normalizeSvg — edges", () => {
  it("defaults viewBox when absent", () => {
    const { icon } = normalizeSvg(
      `<svg xmlns="http://www.w3.org/2000/svg"><path d="M0 0Z" fill="#9138FC" style="fill:color(display-p3 0.57 0.22 0.99)"/></svg>`,
      palette,
      "novb"
    );
    expect(icon.viewBox).toBe("0 0 24 24");
  });
  it('keeps fill="none"', () => {
    const { icon } = normalizeSvg(
      `<svg viewBox="0 0 24 24"><path d="M0 0Z" fill="none" stroke="#EB5729" style="stroke:color(display-p3 0.9216 0.3412 0.1608)"/></svg>`,
      palette,
      "none"
    );
    expect(icon.body).toMatch(/fill="none"/);
    expect(icon.variant).toBe("mono");
  });
});

describe("normalizeSvg — fallbacks", () => {
  it("leaves >2-color icons unchanged with a warning", () => {
    const svg = `<svg viewBox="0 0 24 24">
<path d="M0 0Z" fill="#111111"/>
<path d="M1 1Z" fill="#ee8800"/>
<path d="M2 2Z" fill="#22bb55"/>
</svg>`;
    const { icon, warnings } = normalizeSvg(svg, palette, "tri");
    expect(icon.variant).toBe("mono");
    expect(icon.body).toMatch(/#111111/);
    expect(warnings.length).toBeGreaterThan(0);
  });

  it("assigns duo roles by luminance when colors are unmatched (attribute-only, no style)", () => {
    const svg = `<svg viewBox="0 0 24 24">
<path d="M0 0Z" fill="#111111"/>
<path d="M1 1Z" fill="#eeeeee"/>
</svg>`;
    const { icon, warnings } = normalizeSvg(svg, palette, "lum");
    expect(icon.variant).toBe("duo");
    // darker (#111111) -> Main/c1 ; lighter (#eeeeee) -> Secondary/c2
    expect(icon.body).toMatch(/fill:var\(--icon-color-primary, currentColor\)/);
    expect(icon.body).toMatch(
      /fill:var\(--icon-color-secondary, currentColor\)/
    );
    expect(icon.body).not.toMatch(/#111111/);
    expect(warnings.length).toBeGreaterThan(0);
  });
});
