import { describe, expect, it } from "vitest";
import { parsePalette } from "./palette";

const CSS = `
@theme static {
  --color-neutral-white: #ffffff;
  --color-neutral-0: #fdfdfd;
  --color-orange-900: oklch(0.662 0.227 35.853);
  --color-orange-800: oklch(0.825 0.176 76.57);
  --color-purple-900: oklch(0.589 0.282 300.261);
}
@layer theme {
  @supports (background: color(display-p3 0 0 0)) {
    :root {
      --color-orange-900: color(display-p3 0.92 0.34 0.16);
      --color-orange-800: color(display-p3 0.98 0.72 0.23);
      --color-purple-900: color(display-p3 0.57 0.22 0.99);
    }
  }
}
`;

describe("parsePalette", () => {
  const palette = parsePalette(CSS);

  it("matches a display-p3 paint to its token (tolerant of extra precision)", () => {
    expect(palette.match("color(display-p3 0.9216 0.3412 0.1608)")).toBe(
      "orange-900"
    );
    expect(palette.match("color(display-p3 0.5700 0.2200 0.9900)")).toBe(
      "purple-900"
    );
    expect(palette.match("color(display-p3 0.98 0.72 0.23)")).toBe(
      "orange-800"
    );
  });

  it("returns null for an unknown paint", () => {
    expect(palette.match("#123456")).toBeNull();
    expect(palette.match("color(display-p3 0.1 0.1 0.1)")).toBeNull();
  });

  it("matches a hex paint to its numbered token (case-insensitive)", () => {
    expect(palette.match("#fdfdfd")).toBe("neutral-0");
    expect(palette.match("#FDFDFD")).toBe("neutral-0");
  });

  it("returns null for a display-p3 paint just outside the epsilon", () => {
    // ~0.05 off orange-900 (0.92 0.34 0.16) — beyond the ~0.02/channel tolerance
    expect(palette.match("color(display-p3 0.97 0.34 0.16)")).toBeNull();
  });

  it("assigns Main to -700 and Secondary to -650", () => {
    expect(palette.roleOf("orange-900")).toBe("main");
    expect(palette.roleOf("orange-800")).toBe("secondary");
    expect(palette.roleOf("orange-500")).toBe("other");
  });
});
