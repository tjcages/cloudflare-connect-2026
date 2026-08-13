import { describe, expect, it } from "vitest";
import {
  CANVAS_SIZE_OPTION_VALUES,
  canvasScaleLabel,
  canvasSizeOptionFor,
  parseCanvasSizeOption,
} from "./canvasSizeOptions";

describe("canvas size options", () => {
  it("keeps Custom as the final selector option", () => {
    expect(CANVAS_SIZE_OPTION_VALUES.at(-1)).toBe("custom");
  });

  it("maps persisted canvas settings to a selector value", () => {
    expect(canvasSizeOptionFor("original", 1)).toBe("original");
    expect(canvasSizeOptionFor("scale", 0.5)).toBe("scale:0.5");
    expect(canvasSizeOptionFor("manual", 1)).toBe("custom");
    expect(canvasSizeOptionFor("scale", 1.25)).toBe("custom");
  });

  it("parses only supported scale presets", () => {
    expect(parseCanvasSizeOption("original")).toEqual({ kind: "original" });
    expect(parseCanvasSizeOption("scale:2")).toEqual({ kind: "scale", scale: 2 });
    expect(parseCanvasSizeOption("scale:1.25")).toEqual({ kind: "custom" });
  });

  it("labels scale presets as percentages", () => {
    expect(canvasScaleLabel(0.25)).toBe("25%");
    expect(canvasScaleLabel(1)).toBe("100%");
    expect(canvasScaleLabel(3)).toBe("300%");
  });
});
