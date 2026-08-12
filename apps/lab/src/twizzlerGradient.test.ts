import { describe, expect, it } from "vitest";
import {
  addTwizzlerGradientStop,
  applyTwizzlerGradientStops,
  defaultTwizzlerGradientStops,
  moveTwizzlerGradientStop,
  nearestTwizzlerGradientStopId,
  normalizeTwizzlerGradientStops,
  offsetFromClientX,
  parseTwizzlerGradientStops,
  removeTwizzlerGradientStop,
  recolorTwizzlerGradientStop,
  sampleTwizzlerGradientColor,
  serializeTwizzlerGradientStops,
  twizzlerGradientCss,
  twizzlerGradientSvgStops,
  withTwizzlerGradientEndpointColors,
  TWIZZLER_GRADIENT_STOP_MAX,
} from "./twizzlerGradient";

describe("twizzlerGradient", () => {
  it("synthesizes colorFar@0 → colorNear@1 when stops are missing", () => {
    expect(normalizeTwizzlerGradientStops(undefined, "#FEA700", "#F46021")).toEqual([
      { id: "far", offset: 0, color: "#fea700" },
      { id: "near", offset: 1, color: "#f46021" },
    ]);
  });

  it("keeps custom offsets and middle colors", () => {
    const stops = normalizeTwizzlerGradientStops(
      [
        { id: "a", offset: 0.15, color: "#ff0000" },
        { id: "b", offset: 0.5, color: "#00ff00" },
        { id: "c", offset: 0.9, color: "#0000ff" },
      ],
      "#fea700",
      "#f46021",
    );
    expect(stops.map((s) => [s.offset, s.color])).toEqual([
      [0.15, "#ff0000"],
      [0.5, "#00ff00"],
      [0.9, "#0000ff"],
    ]);
  });

  it("round-trips serialize/parse", () => {
    const original = [
      { id: "a", offset: 0, color: "#111111" },
      { id: "b", offset: 0.4, color: "#abcdef" },
      { id: "c", offset: 1, color: "#ffffff" },
    ];
    const parsed = parseTwizzlerGradientStops(serializeTwizzlerGradientStops(original), "#fea700", "#f46021");
    expect(parsed).toEqual(original);
  });

  it("samples between stops and clamps outside the first/last offset", () => {
    const stops = [
      { id: "a", offset: 0.25, color: "#000000" },
      { id: "b", offset: 0.75, color: "#ffffff" },
    ];
    expect(sampleTwizzlerGradientColor(stops, 0)).toBe("#000000");
    expect(sampleTwizzlerGradientColor(stops, 1)).toBe("#ffffff");
    expect(sampleTwizzlerGradientColor(stops, 0.5)).toBe("#808080");
  });

  it("adds, moves, recolors, and refuses to drop below two stops", () => {
    const base = defaultTwizzlerGradientStops("#fea700", "#f46021");
    const added = addTwizzlerGradientStop(base, 0.4);
    expect(added).toHaveLength(3);
    expect(added[1]?.offset).toBeCloseTo(0.4);
    const moved = moveTwizzlerGradientStop(added, added[1]!.id, 0.62);
    expect(moved.find((s) => s.id === added[1]!.id)?.offset).toBeCloseTo(0.62);
    const recolored = recolorTwizzlerGradientStop(moved, "far", "#112233");
    expect(recolored[0]?.color).toBe("#112233");
    expect(removeTwizzlerGradientStop(base, "far")).toHaveLength(2);
    expect(removeTwizzlerGradientStop(added, added[1]!.id)).toHaveLength(2);
  });

  it("caps at max stops", () => {
    let stops = defaultTwizzlerGradientStops("#111111", "#eeeeee");
    for (let i = 0; i < 12; i += 1) stops = addTwizzlerGradientStop(stops, (i + 1) / 20);
    expect(stops.length).toBe(TWIZZLER_GRADIENT_STOP_MAX);
  });

  it("patches endpoint colors without moving middle stops", () => {
    const patched = withTwizzlerGradientEndpointColors(
      [
        { id: "a", offset: 0.1, color: "#111111" },
        { id: "m", offset: 0.5, color: "#00ff00" },
        { id: "b", offset: 0.9, color: "#222222" },
      ],
      "#abcdef",
      "#fedcba",
    );
    expect(patched.map((s) => [s.offset, s.color])).toEqual([
      [0.1, "#abcdef"],
      [0.5, "#00ff00"],
      [0.9, "#fedcba"],
    ]);
  });

  it("maps pointer X to 0–1 and finds the nearest handle", () => {
    expect(offsetFromClientX(150, { left: 100, width: 200 })).toBeCloseTo(0.25);
    const id = nearestTwizzlerGradientStopId(
      [
        { id: "a", offset: 0, color: "#000000" },
        { id: "b", offset: 1, color: "#ffffff" },
      ],
      298,
      { left: 100, width: 200 },
      14,
    );
    expect(id).toBe("b");
  });

  it("emits CSS and SVG stops at custom offsets", () => {
    const stops = [
      { id: "a", offset: 0.2, color: "#ff0000" },
      { id: "b", offset: 0.8, color: "#0000ff" },
    ];
    expect(twizzlerGradientCss(stops)).toContain("#ff0000 20.00%");
    expect(twizzlerGradientCss(stops)).toContain("#0000ff 80.00%");
    const svg = twizzlerGradientSvgStops(stops);
    expect(svg).toContain('offset="0.2"');
    expect(svg).toContain('offset="0.8"');
    expect(svg).toContain("rgb(255,0,0)");
    expect(svg).toContain("rgb(0,0,255)");
  });

  it("applies every stop to a Canvas2D gradient", () => {
    const added: Array<[number, string]> = [];
    const gradient = {
      addColorStop: (offset: number, color: string) => {
        added.push([offset, color]);
      },
    } as CanvasGradient;
    applyTwizzlerGradientStops(gradient, [
      { id: "b", offset: 0.7, color: "#00ff00" },
      { id: "a", offset: 0.1, color: "#ff0000" },
    ]);
    expect(added).toEqual([
      [0.1, "#ff0000"],
      [0.7, "#00ff00"],
    ]);
  });
});
