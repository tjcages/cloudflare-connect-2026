import { describe, expect, it } from "vitest";
import {
  addTwizzlerGradientStop,
  defaultTwizzlerGradientFieldStops,
  defaultTwizzlerGradientStops,
  gradientFieldClientPlane,
  moveTwizzlerGradientStop,
  nearestTwizzlerGradientStopId,
  nearestTwizzlerGradientStopIdPx,
  normalizeTwizzlerGradientStops,
  parseTwizzlerGradientStops,
  rasterizeTwizzlerGradientField,
  removeTwizzlerGradientStop,
  recolorTwizzlerGradientStop,
  sampleTwizzlerGradientColor,
  sampleTwizzlerGradientRampColor,
  serializeTwizzlerGradientStops,
  twizzlerGradientCss,
  twizzlerGradientSvgImage,
  twizzlerGradientSvgStops,
  offsetFromClientX,
  moveTwizzlerGradientStopOffset,
  uvFromClient,
  withTwizzlerGradientEndpointColors,
  TWIZZLER_GRADIENT_HANDLE_HIT_PX,
  TWIZZLER_GRADIENT_STOP_MAX,
} from "./twizzlerGradient";

describe("twizzlerGradient", () => {
  it("authors a 2D field default with an off-axis peak (CF-62)", () => {
    expect(defaultTwizzlerGradientFieldStops("#fea700", "#f46021", "#e92e28")).toEqual([
      { id: "far", x: 0.08, y: 0.78, offset: 0.08, color: "#fea700" },
      { id: "peak", x: 0.5, y: 0.16, offset: 0.5, color: "#e92e28" },
      { id: "near", x: 0.92, y: 0.72, offset: 0.92, color: "#f46021" },
    ]);
  });

  it("synthesizes colorFar@(0,0.5) → colorNear@(1,0.5) when stops are missing", () => {
    expect(normalizeTwizzlerGradientStops(undefined, "#FEA700", "#F46021")).toEqual([
      { id: "far", x: 0, y: 0.5, offset: 0, color: "#fea700" },
      { id: "near", x: 1, y: 0.5, offset: 1, color: "#f46021" },
    ]);
  });

  it("migrates 1D offset-only stops onto y = 0.5", () => {
    const stops = normalizeTwizzlerGradientStops(
      [
        { id: "a", offset: 0.15, color: "#ff0000" },
        { id: "b", offset: 0.5, color: "#00ff00" },
        { id: "c", offset: 0.9, color: "#0000ff" },
      ],
      "#fea700",
      "#f46021",
    );
    expect(stops.map((s) => [s.x, s.y, s.offset, s.color])).toEqual([
      [0.15, 0.5, 0.15, "#ff0000"],
      [0.5, 0.5, 0.5, "#00ff00"],
      [0.9, 0.5, 0.9, "#0000ff"],
    ]);
  });

  it("keeps explicit 2D hotspot positions", () => {
    const stops = normalizeTwizzlerGradientStops(
      [
        { id: "a", x: 0.2, y: 0.1, color: "#ff0000" },
        { id: "b", x: 0.8, y: 0.9, color: "#0000ff" },
      ],
      "#fea700",
      "#f46021",
    );
    expect(stops.map((s) => [s.x, s.y, s.offset, s.color])).toEqual([
      [0.2, 0.1, 0.2, "#ff0000"],
      [0.8, 0.9, 0.8, "#0000ff"],
    ]);
  });

  it("round-trips serialize/parse including y", () => {
    const original = [
      { id: "a", x: 0, y: 0.25, offset: 0, color: "#111111" },
      { id: "b", x: 0.4, y: 0.8, offset: 0.4, color: "#abcdef" },
      { id: "c", x: 1, y: 0.5, offset: 1, color: "#ffffff" },
    ];
    const parsed = parseTwizzlerGradientStops(serializeTwizzlerGradientStops(original), "#fea700", "#f46021");
    expect(parsed).toEqual(original);
  });

  it("keeps serialize(parse(serialize(x))) stable so Leva sanitize cannot loop", () => {
    const noisy = [
      { id: "a", x: 0.123456789, y: 0.987654321, offset: 0.123456789, color: "#fea700" },
      { id: "b", x: 0.5, y: 0.5, offset: 0.5, color: "#f46021" },
    ];
    const once = serializeTwizzlerGradientStops(noisy);
    const twice = serializeTwizzlerGradientStops(parseTwizzlerGradientStops(once, "#fea700", "#f46021"));
    expect(twice).toBe(once);
    expect(once).toContain('"x":0.1235');
  });

  it("samples IDW in 2D and returns an exact hotspot color", () => {
    const stops = [
      { id: "a", x: 0.5, y: 0, offset: 0.5, color: "#000000" },
      { id: "b", x: 0.5, y: 1, offset: 0.5, color: "#ffffff" },
    ];
    expect(sampleTwizzlerGradientColor(stops, 0.5, 0)).toBe("#000000");
    expect(sampleTwizzlerGradientColor(stops, 0.5, 1)).toBe("#ffffff");
    expect(sampleTwizzlerGradientColor(stops, 0.5, 0.5)).toBe("#808080");
  });

  it("adds, moves, recolors, and refuses to drop the last hotspot", () => {
    const base = defaultTwizzlerGradientStops("#fea700", "#f46021");
    const added = addTwizzlerGradientStop(base, 0.4, 0.7);
    expect(added).toHaveLength(3);
    const created = added.find((s) => s.id !== "far" && s.id !== "near")!;
    expect(created.x).toBeCloseTo(0.4);
    expect(created.y).toBeCloseTo(0.7);
    expect(created.color).toBe("#f77720");
    const moved = moveTwizzlerGradientStop(added, created.id, 0.62, 0.2);
    const afterMove = moved.find((s) => s.id === created.id);
    expect(afterMove?.x).toBeCloseTo(0.62);
    expect(afterMove?.y).toBeCloseTo(0.2);
    expect(afterMove?.offset).toBeCloseTo(0.62);
    const recolored = recolorTwizzlerGradientStop(moved, "far", "#112233");
    expect(recolored.find((s) => s.id === "far")?.color).toBe("#112233");
    expect(removeTwizzlerGradientStop(base, "far")).toHaveLength(1);
    expect(removeTwizzlerGradientStop(added, created.id)).toHaveLength(2);
    const last = removeTwizzlerGradientStop(base, "far");
    expect(removeTwizzlerGradientStop(last, last[0]!.id)).toHaveLength(1);
  });

  it("caps at max hotspots", () => {
    let stops = defaultTwizzlerGradientStops("#111111", "#eeeeee");
    for (let i = 0; i < 20; i += 1) stops = addTwizzlerGradientStop(stops, (i + 1) / 20, 0.4);
    expect(stops.length).toBe(TWIZZLER_GRADIENT_STOP_MAX);
  });

  it("patches leftmost/rightmost hotspot colors without moving the rest", () => {
    const patched = withTwizzlerGradientEndpointColors(
      [
        { id: "a", x: 0.1, y: 0.2, offset: 0.1, color: "#111111" },
        { id: "m", x: 0.5, y: 0.9, offset: 0.5, color: "#00ff00" },
        { id: "b", x: 0.9, y: 0.4, offset: 0.9, color: "#222222" },
      ],
      "#abcdef",
      "#fedcba",
    );
    expect(patched.map((s) => [s.x, s.y, s.color])).toEqual([
      [0.1, 0.2, "#abcdef"],
      [0.5, 0.9, "#00ff00"],
      [0.9, 0.4, "#fedcba"],
    ]);
  });

  it("maps pointer UV and finds the nearest hotspot in 2D", () => {
    expect(uvFromClient(150, 140, { left: 100, top: 100, width: 200, height: 80 })).toEqual({
      x: 0.25,
      y: 0.5,
    });
    const id = nearestTwizzlerGradientStopId(
      [
        { id: "a", x: 0, y: 0.5, offset: 0, color: "#000000" },
        { id: "b", x: 1, y: 0.5, offset: 1, color: "#ffffff" },
      ],
      0.97,
      0.52,
      0.08,
    );
    expect(id).toBe("b");
  });

  it("hits an existing hotspot in screen pixels even when the click is off-center", () => {
    const bounds = { left: 0, top: 0, width: 336, height: 120 };
    const plane = gradientFieldClientPlane(bounds, 168, 120, 12);
    const stops = [
      { id: "a", x: 0.5, y: 0.5, offset: 0.5, color: "#fea700" },
      { id: "b", x: 0.9, y: 0.2, offset: 0.9, color: "#f46021" },
    ];
    const hx = plane.left + 0.5 * plane.width;
    const hy = plane.top + 0.5 * plane.height;
    expect(nearestTwizzlerGradientStopIdPx(stops, hx + 18, hy + 10, plane)).toBe("a");
    expect(nearestTwizzlerGradientStopIdPx(stops, hx + TWIZZLER_GRADIENT_HANDLE_HIT_PX + 8, hy, plane)).toBeNull();
  });

  it("defaults new hotspots to unused Orange/Red library colors", () => {
    const base = defaultTwizzlerGradientStops("#fea700", "#f46021");
    const first = addTwizzlerGradientStop(base, 0.3, 0.3);
    const second = addTwizzlerGradientStop(first, 0.7, 0.7);
    const colors = second.map((s) => s.color);
    expect(colors).toContain("#f77720");
    expect(colors).toContain("#e92e28");
  });

  it("rasterizes a 2D field that is not a 1D left-to-right ramp", () => {
    const stops = [
      { id: "top", x: 0.5, y: 0, offset: 0.5, color: "#ff0000" },
      { id: "bottom", x: 0.5, y: 1, offset: 0.5, color: "#0000ff" },
    ];
    const pixels = rasterizeTwizzlerGradientField(stops, 4, 4);
    const rgbAt = (col: number, row: number) => {
      const i = (row * 4 + col) * 4;
      return { r: pixels[i]!, g: pixels[i + 1]!, b: pixels[i + 2]! };
    };
    const top = rgbAt(2, 0);
    const bottom = rgbAt(2, 3);
    expect(top.r).toBeGreaterThan(top.b + 40);
    expect(bottom.b).toBeGreaterThan(bottom.r + 40);
  });

  it("emits a frame-sized PNG image (not a tiling pattern) (CF-79)", () => {
    const stops = [
      { id: "a", x: 0.2, y: 0.1, offset: 0.2, color: "#ff0000" },
      { id: "b", x: 0.8, y: 0.9, offset: 0.8, color: "#0000ff" },
    ];
    const svg = twizzlerGradientSvgImage("pack", 0, 0, 400, 200, stops, 4, 3);
    expect(svg).toContain('id="pack"');
    expect(svg).toMatch(/<image [^>]*x="0"[^>]*y="0"[^>]*width="400"[^>]*height="200"/);
    expect(svg).toContain('preserveAspectRatio="none"');
    expect(svg).not.toContain("<pattern");
    expect(svg).not.toContain("patternUnits");
    expect(svg).not.toContain("<stop ");
    expect(svg).not.toContain("linearGradient");
    expect(svg).not.toContain("<rect ");
    expect((svg.match(/<image /g) ?? []).length).toBe(1);
    expect(svg).toContain("data:image/png;base64,");
    const href = svg.match(/href="(data:image\/png;base64,[^"]+)"/)?.[1];
    expect(href).toBeTruthy();
    const binary = atob(href!.slice("data:image/png;base64,".length));
    const png = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) png[i] = binary.charCodeAt(i);
    expect([...png.slice(0, 8)]).toEqual([137, 80, 78, 71, 13, 10, 26, 10]);
    const width = (png[16]! << 24) | (png[17]! << 16) | (png[18]! << 8) | png[19]!;
    const height = (png[20]! << 24) | (png[21]! << 16) | (png[22]! << 8) | png[23]!;
    expect(width).toBe(4);
    expect(height).toBe(3);
  });

  it("emits a 1D CSS/SVG ramp from stop offsets (CF-74)", () => {
    const stops = [
      { id: "a", x: 0, y: 0.2, offset: 0, color: "#ff0000" },
      { id: "b", x: 0.5, y: 0.9, offset: 0.5, color: "#00ff00" },
      { id: "c", x: 1, y: 0.4, offset: 1, color: "#0000ff" },
    ];
    expect(twizzlerGradientCss(stops)).toContain("linear-gradient(90deg");
    expect(twizzlerGradientCss(stops)).toContain("#00ff00 50.00%");
    expect(twizzlerGradientSvgStops(stops)).toContain('<stop offset="0.5" stop-color="rgb(0,255,0)" />');
    expect(sampleTwizzlerGradientRampColor(stops, 0)).toBe("#ff0000");
    expect(sampleTwizzlerGradientRampColor(stops, 1)).toBe("#0000ff");
    expect(offsetFromClientX(150, { left: 100, width: 200 })).toBe(0.25);
    const slid = moveTwizzlerGradientStopOffset(stops, "b", 0.35);
    expect(slid.find((s) => s.id === "b")).toMatchObject({ offset: 0.35, x: 0.35, y: 0.9 });
  });
});
