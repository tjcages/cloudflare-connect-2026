import { describe, expect, it } from "vitest";
import { applyCanvasBackgroundCss } from "./canvasBackgroundCss";

describe("applyCanvasBackgroundCss", () => {
  it("applies raw CSS declarations and preserves canvas sizing", () => {
    const canvas = document.createElement("canvas");

    applyCanvasBackgroundCss(
      canvas,
      [
        "background: #D9D9D9;",
        "background: color(display-p3 0.851 0.851 0.851);",
        "background-image: linear-gradient(90deg, red, blue);",
        "width: 10px;",
      ].join("\n"),
      { width: 640, height: 360 },
    );

    expect(canvas.style.background).toContain("linear-gradient(90deg, red, blue)");
    expect(canvas.style.background).toContain("#D9D9D9");
    expect(canvas.style.backgroundImage).toBe("linear-gradient(90deg, red, blue)");
    expect(canvas.style.width).toBe("640px");
    expect(canvas.style.height).toBe("360px");
  });

  it("clears pasted declarations while preserving canvas sizing", () => {
    const canvas = document.createElement("canvas");
    canvas.style.background = "red";

    applyCanvasBackgroundCss(canvas, "   ", { width: 320, height: 180 });

    expect(canvas.style.background).toBe("");
    expect(canvas.style.width).toBe("320px");
    expect(canvas.style.height).toBe("180px");
  });
});
