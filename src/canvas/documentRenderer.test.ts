import { describe, expect, it } from "vitest";
import { drawDocument, drawIconBox } from "./documentRenderer";
import { STROKE_COLOR, type ComponentInstance, type GeneratedGrid } from "../grid/types";

const createContext = () => {
  const calls: string[] = [];
  const context = {
    calls,
    fillStyle: "",
    strokeStyle: "",
    lineWidth: 0,
    shadowBlur: 0,
    shadowColor: "",
    shadowOffsetX: 0,
    shadowOffsetY: 0,
    save: () => calls.push("save"),
    restore: () => calls.push("restore"),
    scale: (x: number, y: number) => calls.push(`scale:${x}:${y}`),
    clearRect: (x: number, y: number, width: number, height: number) =>
      calls.push(`clearRect:${x}:${y}:${width}:${height}`),
    fillRect: (x: number, y: number, width: number, height: number) =>
      calls.push(`fillRect:${x}:${y}:${width}:${height}:${context.fillStyle}`),
    strokeRect: (x: number, y: number, width: number, height: number) =>
      calls.push(`strokeRect:${x}:${y}:${width}:${height}:${context.strokeStyle}`),
    beginPath: () => calls.push("beginPath"),
    roundRect: (x: number, y: number, width: number, height: number, radius: number) =>
      calls.push(`roundRect:${x}:${y}:${width}:${height}:${radius}`),
    fill: () =>
      calls.push(
        `fill:${context.fillStyle}:${context.shadowOffsetY}:${context.shadowBlur}:${context.shadowColor}`,
      ),
    stroke: () => calls.push(`stroke:${context.strokeStyle}:${context.lineWidth}`),
  };

  return context as unknown as CanvasRenderingContext2D & { calls: string[] };
};

const grid: GeneratedGrid = {
  config: {
    seed: "test",
    width: 120,
    height: 120,
    density: 0.5,
    smallCellRatio: 0.5,
    largeCellRatio: 0.5,
    strokeColor: STROKE_COLOR,
    gapMask: [],
    logicalWidth: 120,
    logicalHeight: 120,
    renderWidth: 121,
    renderHeight: 121,
    columns: 3,
    rows: 3,
  },
  cells: [
    {
      id: "cell-1",
      kind: "small",
      x: 0,
      y: 0,
      width: 40,
      height: 40,
    },
  ],
};

const iconBox: ComponentInstance = {
  id: "icon-box-1",
  type: "icon-box",
  name: "icon-box 1",
  x: 40,
  y: 40,
  props: {
    cornerColor: "#123456",
  },
};

describe("documentRenderer", () => {
  it("draws the document background, grid, then component layer", () => {
    const context = createContext();

    drawDocument(context, { grid, instances: [iconBox], scale: 2 });

    expect(context.calls).toEqual(
      expect.arrayContaining([
        "scale:2:2",
        "fillRect:0:0:120:120:#FFFFFF",
        `strokeRect:0.5:0.5:40:40:${STROKE_COLOR}`,
        "roundRect:48:48:64:64:10",
      ]),
    );
    expect(context.calls.indexOf("fillRect:0:0:120:120:#FFFFFF")).toBeLessThan(
      context.calls.indexOf(`strokeRect:0.5:0.5:40:40:${STROKE_COLOR}`),
    );
    expect(context.calls.indexOf(`strokeRect:0.5:0.5:40:40:${STROKE_COLOR}`)).toBeLessThan(
      context.calls.indexOf("roundRect:48:48:64:64:10"),
    );
  });

  it("draws icon-box shadow passes and configured corner markers", () => {
    const context = createContext();

    drawIconBox(context, iconBox);

    expect(context.calls).toEqual(
      expect.arrayContaining([
        "fill:#FFFFFF:12:24:rgba(0, 0, 0, 0.04)",
        "fill:#FFFFFF:6:12:rgba(0, 0, 0, 0.02)",
        "fill:#FFFFFF:3:6:rgba(0, 0, 0, 0.01)",
        "stroke:rgba(0, 0, 0, 0.04):1",
        "fill:#123456:0:0:transparent",
      ]),
    );
  });

  it("draws selected instances with a square outline", () => {
    const context = createContext();

    drawDocument(context, { grid, instances: [iconBox], selectedInstanceId: iconBox.id });

    expect(context.calls).toContain("strokeRect:40.5:40.5:79:79:#9FC8FF");
    expect(context.calls).not.toContain("roundRect:40.5:40.5:79:79:12");
  });
});
