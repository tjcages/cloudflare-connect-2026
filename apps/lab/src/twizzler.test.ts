import { describe, expect, it } from "vitest";
import {
  buildTwizzlerLines,
  normalizeTwizzlerColor,
  normalizeTwizzlerSettings,
  orangeWaveXRangeForCanvas,
  orangeWaveY,
  ribbonGradientXSpan,
  ribbonGradientXYSpan,
  TWIZZLER_DEFAULTS,
  twizzlerAnimationTime,
  twizzlerBendOffset,
  twizzlerDepthScale,
  twizzlerEdgeHeights,
  twizzlerLerpColor,
  twizzlerFaceAmount,
  twizzlerFiberNearness,
  twizzlerFogAmount,
  twizzlerFogColor,
  twizzlerDepthYBias,
  twizzlerGapWarpedAcross,
  twizzlerStrokeWidthScale,
  twizzlerUnevenAcross,
  twizzlerAmpHeat,
  twizzlerAmpNoiseY,
  twizzlerAmpSwell,
  twizzlerShaderPackY,
  twizzlerShaderPackPixelY,
  twizzlerShaderPackRecipe,
  twizzlerSvgPathCubic,
  twizzlerUsesFieldGradient,
  twizzlerUsesLinearRamp,
  twizzlerMarketingTwist,
  twizzlerMarketingWidth,
  twizzlerNearness,
  twizzlerNoise,
  twizzlerPathBend,
  twizzlerPointX,
} from "./twizzler";

function pixelEdge(width: number, t: number): number {
  return width * t;
}

function hexLuma(hex: string): number {
  const n = Number.parseInt(hex.replace("#", ""), 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return (r * 299 + g * 587 + b * 114) / 1000;
}

describe("Twizzler", () => {
  it("produces deterministic noise in the p5-style 0–1 range", () => {
    const first = twizzlerNoise(0.21, 0.42, 0.63);
    expect(first).toBe(twizzlerNoise(0.21, 0.42, 0.63));
    expect(first).toBeGreaterThanOrEqual(0);
    expect(first).toBeLessThanOrEqual(1);
  });

  it("samples the orange-wave height function deterministically", () => {
    expect(orangeWaveY(0, 0, 0, 1)).toBe(orangeWaveY(0, 0, 0, 1));
    expect(Math.abs(orangeWaveY(0, 0, 0, 2))).toBeCloseTo(Math.abs(orangeWaveY(0, 0, 0, 1)) * 2, 5);
    // Soft envelope kills amplitude far from the ribbon core in X.
    expect(Math.abs(orangeWaveY(8.4, 0, 0, 1))).toBeLessThan(Math.abs(orangeWaveY(0, 0, 0, 1)) + 0.05);
  });

  it("normalizes its expanded user controls", () => {
    expect(normalizeTwizzlerColor("#FF0000")).toBe("#ff0000");
    expect(normalizeTwizzlerColor(null, "#fea700")).toBe("#fea700");
    expect(normalizeTwizzlerColor("nope", "#e92e28")).toBe("#e92e28");
    expect(
      normalizeTwizzlerSettings({
        scale: 8,
        lineCount: 0,
        wrinkles: 99,
        bendPosition: 2,
        bendAmount: -3,
        leftHeight: 4,
        rightHeight: -4,
      }),
    ).toMatchObject({
      scale: 8,
      lineCount: 1,
      wrinkles: 99,
      bendPosition: 1,
      bendAmount: -3,
      leftHeight: 4,
      rightHeight: -4,
    });
    // Extreme creative values still clamp at the new open ceilings.
    expect(normalizeTwizzlerSettings({ scale: 999, amplitude: 999, speed: 999 })).toMatchObject({
      scale: 50,
      amplitude: 20,
      speed: 40,
    });
  });

  it("preserves distinct far/near/edge when Leva-like colors are null or invalid", () => {
    const settings = normalizeTwizzlerSettings({
      color: null as unknown as string,
      colorFar: null as unknown as string,
      colorNear: undefined,
      colorEdge: "not-a-color",
      ribbonColorMode: "sharedGradient",
    });
    expect(settings.colorFar).toBe("#fea700");
    expect(settings.colorNear).toBe("#f46021");
    expect(settings.colorEdge).toBe("#e92e28");
    expect(settings.ribbonColorMode).toBe("sharedGradient");
  });

  it("keeps Shared field vs Shared gradient as distinct color modes (CF-74)", () => {
    expect(twizzlerUsesFieldGradient("sharedGradient")).toBe(true);
    expect(twizzlerUsesFieldGradient("fiberGradient")).toBe(true);
    expect(twizzlerUsesFieldGradient("sharedLinear")).toBe(false);
    expect(twizzlerUsesLinearRamp("sharedLinear")).toBe(true);
    expect(twizzlerUsesLinearRamp("sharedGradient")).toBe(false);
    expect(normalizeTwizzlerSettings({ ribbonColorMode: "sharedLinear" }).ribbonColorMode).toBe("sharedLinear");
  });

  it("maps Leva twizzlerColor* fields into sharedGradient endpoints", () => {
    // Mirrors levaSchema → normalizeTwizzlerSettings wiring.
    const fromLeva = normalizeTwizzlerSettings({
      color: "#112233",
      colorNear: "#112233",
      colorFar: "#abcdef",
      colorEdge: "#e92e28",
      ribbonColorMode: "sharedGradient",
    });
    expect(fromLeva.colorFar).toBe("#abcdef");
    expect(fromLeva.colorNear).toBe("#112233");
    expect(fromLeva.ribbonColorMode).toBe("sharedGradient");
    expect(fromLeva.gradientStops).toEqual([
      { id: "far", x: 0, y: 0.5, offset: 0, color: "#abcdef" },
      { id: "near", x: 1, y: 0.5, offset: 1, color: "#112233" },
    ]);
  });

  it("preserves custom 2D hotspot positions (CF-58)", () => {
    const settings = normalizeTwizzlerSettings({
      colorFar: "#fea700",
      colorNear: "#f46021",
      ribbonColorMode: "sharedGradient",
      gradientStops: [
        { id: "a", x: 0.2, y: 0.1, color: "#ff0000" },
        { id: "b", x: 0.55, y: 0.8, color: "#00ff00" },
        { id: "c", x: 0.85, y: 0.4, color: "#0000ff" },
      ],
    });
    expect(settings.gradientStops.map((s) => [s.x, s.y, s.offset, s.color])).toEqual([
      [0.2, 0.1, 0.2, "#ff0000"],
      [0.55, 0.8, 0.55, "#00ff00"],
      [0.85, 0.4, 0.85, "#0000ff"],
    ]);
    expect(settings.colorFar).toBe("#ff0000");
    expect(settings.colorNear).toBe("#0000ff");
  });

  it("zooms uniformly without locking L/R edges (no fitScale 2.2 cap)", () => {
    const base = buildTwizzlerLines(800, 800, 0, {
      lineCount: 24,
      pointSpacing: 10,
      speed: 0,
      scale: 1,
      centerY: 0.5,
    });
    const zoomed = buildTwizzlerLines(800, 800, 0, {
      lineCount: 24,
      pointSpacing: 10,
      speed: 0,
      scale: 10,
      centerY: 0.5,
    });
    const xSpan = (lines: typeof base.lines) => {
      const xs = lines.flatMap((line) => line.points.map((p) => p.x));
      return Math.max(...xs) - Math.min(...xs);
    };
    const ySpan = (lines: typeof base.lines) => {
      const ys = lines.flatMap((line) => line.points.map((p) => p.y));
      return Math.max(...ys) - Math.min(...ys);
    };
    const baseX = xSpan(base.lines);
    const baseY = ySpan(base.lines);
    const zoomX = xSpan(zoomed.lines);
    const zoomY = ySpan(zoomed.lines);
    // Both axes grow with zoom (not X-locked / Y-only stretch).
    expect(zoomX / baseX).toBeGreaterThan(6);
    expect(zoomY / baseY).toBeGreaterThan(6);
    // Aspect of the zoomed pack stays near the base pack (no vertical squash/stretch).
    const baseAspect = baseX / Math.max(1e-6, baseY);
    const zoomAspect = zoomX / Math.max(1e-6, zoomY);
    expect(zoomAspect / baseAspect).toBeGreaterThan(0.85);
    expect(zoomAspect / baseAspect).toBeLessThan(1.15);
  });

  it("applies Move X/Y/Z translates on the orange-wave pack", () => {
    const base = buildTwizzlerLines(800, 800, 0, {
      lineCount: 16,
      pointSpacing: 10,
      speed: 0,
      panX: 0,
      panY: 0,
      panZ: 0,
    });
    const moved = buildTwizzlerLines(800, 800, 0, {
      lineCount: 16,
      pointSpacing: 10,
      speed: 0,
      panX: 120,
      panY: -80,
      panZ: 0,
    });
    const mean = (lines: typeof base.lines, axis: "x" | "y") => {
      const vals = lines.flatMap((line) => line.points.map((p) => p[axis]));
      return vals.reduce((s, v) => s + v, 0) / Math.max(1, vals.length);
    };
    expect(mean(moved.lines, "x") - mean(base.lines, "x")).toBeCloseTo(120, 0);
    expect(mean(moved.lines, "y") - mean(base.lines, "y")).toBeCloseTo(-80, 0);

    const near = buildTwizzlerLines(800, 800, 0, {
      lineCount: 16,
      pointSpacing: 10,
      speed: 0,
      panZ: -1.5,
    });
    const far = buildTwizzlerLines(800, 800, 0, {
      lineCount: 16,
      pointSpacing: 10,
      speed: 0,
      panZ: 1.5,
    });
    const xSpan = (lines: typeof base.lines) => {
      const xs = lines.flatMap((line) => line.points.map((p) => p.x));
      return Math.max(...xs) - Math.min(...xs);
    };
    // Move Z > 0 = farther = smaller on screen (post-fit dolly).
    expect(xSpan(near.lines)).toBeGreaterThan(xSpan(far.lines) * 1.2);
  });

  it("places the full bend at the selected horizontal position", () => {
    expect(twizzlerBendOffset(0.6, 0.6, 0.25)).toBe(0.25);
    expect(Math.abs(twizzlerBendOffset(0.1, 0.6, 0.25))).toBeLessThan(0.002);
    expect(twizzlerBendOffset(0.6, 0.6, -0.25)).toBe(-0.25);
  });

  it("sums multiple bend lobes for the path", () => {
    const settings = {
      bendPosition: 0.2,
      bendAmount: 0.2,
      bend2Position: 0.8,
      bend2Amount: -0.15,
      bend3Position: 0.5,
      bend3Amount: 0,
    };
    expect(twizzlerPathBend(0.2, settings)).toBeCloseTo(0.2, 2);
    expect(twizzlerPathBend(0.8, settings)).toBeCloseTo(-0.15, 2);
  });

  it("scales depth toward the camera peak", () => {
    const settings = {
      depthPosition: 0.6,
      depthAmount: 1,
      depthWidth: 0.2,
      depth2Position: 0.2,
      depth2Amount: 0,
      depth2Width: 0.2,
    };
    expect(twizzlerDepthScale(0.6, settings)).toBeCloseTo(2, 5);
    expect(twizzlerDepthScale(0, settings)).toBeLessThan(1.05);
    expect(twizzlerDepthScale(0.6, { ...settings, depthAmount: 0 })).toBe(1);
  });

  it("lerps peach-to-coral by nearness", () => {
    expect(twizzlerLerpColor("#ffd2b5", "#e8481c", 0)).toBe("#ffd2b5");
    expect(twizzlerLerpColor("#ffd2b5", "#e8481c", 1)).toBe("#e8481c");
    expect(twizzlerNearness(1, { depthAmount: 1, depth2Amount: 0 })).toBe(0);
    expect(twizzlerNearness(2, { depthAmount: 1, depth2Amount: 0 })).toBe(1);
  });

  it("always spans from the exact left edge to the exact right edge", () => {
    expect(twizzlerPointX(0, 64, 1280)).toBe(0);
    expect(twizzlerPointX(64, 64, 1280)).toBe(1280);
  });

  it("animates the left and right edge heights independently", () => {
    const settings = { leftHeight: 0.3, rightHeight: 0.7, edgeFluctuation: 0.2, edgeSpeed: 1 };
    const start = twizzlerEdgeHeights(0, 0, settings);
    const later = twizzlerEdgeHeights(0.5, 0, settings);
    expect(start.left).not.toBe(start.right);
    expect(later.left).not.toBe(start.left);
    expect(later.right).not.toBe(start.right);
  });

  it("freezes every animation source when master speed is zero", () => {
    expect(twizzlerAnimationTime(12.5, 0)).toBe(0);
    expect(twizzlerAnimationTime(12.5, 0.8)).toBe(10);
  });

  it("builds an orange-wave ribbon with layered Z paths and solid stroke color", () => {
    const settings = normalizeTwizzlerSettings({
      amplitude: 1,
      scale: 1,
      centerY: 0.5,
      rotateXDeg: 12,
      rotateYDeg: -18,
      rotateZDeg: 0,
      color: "#f46021",
      colorFar: "#fea700",
      colorNear: "#f46021",
      colorEdge: "#e92e28",
    });
    const { lines } = buildTwizzlerLines(1600, 320, 0, {
      ...settings,
      lineCount: 40,
      pointSpacing: 10,
      speed: 0,
    });
    expect(lines.length).toBeGreaterThan(10);
    expect(lines.length).toBeLessThanOrEqual(40);
    expect(lines[0]?.points.length).toBeGreaterThan(10);
    expect(lines[0]?.color).toMatch(/^#[0-9a-f]{6}$/i);
    expect(lines[0]?.points[0]?.color).toMatch(/^#[0-9a-f]{6}$/i);
    expect(lines[0]?.nearness).toBeGreaterThanOrEqual(0);
    expect(lines[0]?.nearness).toBeLessThanOrEqual(1);
    expect(lines[0]?.strokeWidth).toBeGreaterThan(0);
    // Layers should span horizontally across most of the canvas.
    const xs = lines.flatMap((line) => line.points.map((p) => p.x));
    expect(Math.min(...xs)).toBeLessThan(pixelEdge(1600, 0.15));
    expect(Math.max(...xs)).toBeGreaterThan(pixelEdge(1600, 0.85));
  });

  it("keeps legacy marketing helpers available for experiment tooling", () => {
    const settings = normalizeTwizzlerSettings({
      amplitude: 0.55,
      depthSpread: 0.85,
      twist: 1.35,
      leftHeight: 0.7,
      rightHeight: 0.28,
      scale: 1,
      centerY: 0.52,
    });
    const leftW = twizzlerMarketingWidth(0.1, settings);
    const fanW = twizzlerMarketingWidth(0.9, settings);
    expect(fanW).toBeGreaterThan(leftW);
    const valleyFace = twizzlerFaceAmount(twizzlerMarketingTwist(0.4, settings, 0));
    const fanFace = twizzlerFaceAmount(twizzlerMarketingTwist(0.9, settings, 0));
    expect(fanFace).toBeGreaterThan(valleyFace);
  });

  it("fogs far fibers toward white and drops far fibers lowest on the right", () => {
    expect(twizzlerFogColor("#e8481c", 0)).toBe("#e8481c");
    expect(twizzlerFogColor("#e8481c", 1)).toBe("#ffffff");
    expect(twizzlerFogAmount(1)).toBe(0);
    expect(twizzlerFogAmount(0)).toBe(1);
    expect(twizzlerFogAmount(0.2)).toBeGreaterThan(0.7);
    expect(twizzlerStrokeWidthScale(1)).toBeGreaterThan(twizzlerStrokeWidthScale(0) * 5);
    // Right edge: far (nearness 0) must sit lower on screen than near (nearness 1).
    expect(twizzlerDepthYBias(0, 320, 0.85, 0.95, 1.5, 0)).toBeGreaterThan(
      twizzlerDepthYBias(1, 320, 0.85, 0.95, 1.5, 0),
    );
    expect(twizzlerDepthYBias(0, 320, 0.9, 0.95, 1.8, 1)).toBeGreaterThan(
      twizzlerDepthYBias(1, 320, 0.9, 0.95, 1.8, 1),
    );
    expect(twizzlerDepthYBias(0, 320, 1, 0.95, 2, 2)).toBeGreaterThan(twizzlerDepthYBias(1, 320, 1, 0.95, 2, 2));

    const slots = twizzlerUnevenAcross(12, 0.6);
    expect(slots).toHaveLength(12);
    expect(slots[0]).toBeLessThan(slots[slots.length - 1]);
    const evenGaps = Array.from({ length: 11 }, (_, i) => slots[i + 1]! - slots[i]!);
    const gapSpread = Math.max(...evenGaps) - Math.min(...evenGaps);
    expect(gapSpread).toBeGreaterThan(0.008);

    // Along-X gap warp varies packing, but stays near the nominal across (envelope).
    const gapSamples = [0.08, 0.22, 0.38, 0.55, 0.72, 0.9].map((x) => twizzlerGapWarpedAcross(0.65, x, 5, 0.85));
    const gapRange = Math.max(...gapSamples) - Math.min(...gapSamples);
    expect(gapRange).toBeGreaterThan(0.03);
    for (const sample of gapSamples) {
      expect(Math.abs(sample)).toBeLessThan(1.15);
    }

    // Heat patches scatter through Z: nearby across is similar, far across often differs.
    const h0 = twizzlerAmpHeat(0.4, -0.2, 1.0);
    const hNear = twizzlerAmpHeat(0.4, -0.15, 1.0);
    expect(Math.abs(h0 - hNear)).toBeLessThan(0.2);
    // Across the stack, heat must vary (not one pack-wide L→R field).
    const zSamples = [-0.9, -0.45, 0, 0.45, 0.9].map((z) => twizzlerAmpHeat(0.55, z, 1.0));
    expect(Math.max(...zSamples) - Math.min(...zSamples)).toBeGreaterThan(0.15);
    // Z-lobes: different depth bands peak at different X (not one synchronized swell).
    const early = [-0.78, -0.26, 0.26, 0.78].map((z) => twizzlerAmpSwell(0.25, z, 1.0));
    const late = [-0.78, -0.26, 0.26, 0.78].map((z) => twizzlerAmpSwell(0.7, z, 1.0));
    expect(Math.max(...early) - Math.min(...early)).toBeGreaterThan(0.15);
    expect(Math.max(...late) - Math.min(...late)).toBeGreaterThan(0.15);
    // Z-scattered amp relocates peaks: different across → different extremum X.
    const extremumX = (z: number) => {
      let bestX = 0;
      let best = -1e9;
      for (let i = 0; i <= 50; i += 1) {
        const x = i / 50;
        const y = twizzlerAmpNoiseY(x, z, 320, 1, 0.14, 1);
        if (Math.abs(y) > best) {
          best = Math.abs(y);
          bestX = x;
        }
      }
      return bestX;
    };
    const xs = [-0.9, -0.45, 0, 0.45, 0.9].map(extremumX);
    expect(Math.max(...xs) - Math.min(...xs)).toBeGreaterThan(0.08);
    expect(
      twizzlerSvgPathCubic([
        { x: 0, y: 0 },
        { x: 10, y: 5 },
        { x: 20, y: 0 },
        { x: 30, y: 8 },
      ]),
    ).toContain(" C");
    // Shader pack: different fiber phases peak at different X.
    expect(twizzlerShaderPackRecipe(3)).toBe(0);
    expect(twizzlerShaderPackRecipe(5)).toBe(2);
    const packSettings = { wrinkles: 2, centerY: 0.5 };
    const yA = twizzlerShaderPackY(0.35, 0.1, 0, packSettings, 0);
    const yB = twizzlerShaderPackY(0.35, 0.7, 0, packSettings, 0);
    expect(Math.abs(yA - yB)).toBeGreaterThan(0.01);
    // Pixel-faithful: mid-canvas X with fiber 0 should sit near centerY ± 0.25*wave*H.
    const pixelY = twizzlerShaderPackPixelY(800, 1600, 320, 0, 40, 0, packSettings, 0);
    expect(pixelY).toBeGreaterThan(0);
    expect(pixelY).toBeLessThan(320);

    const settings = normalizeTwizzlerSettings({
      depthAmount: 1.15,
      depthPosition: 0.86,
      depthWidth: 0.36,
      twist: 1.15,
    });
    // Across stack dominates nearness (do not wash out Z on the right).
    const farRight = twizzlerFiberNearness(-1, 0.95, settings, 0);
    const nearRight = twizzlerFiberNearness(1, 0.95, settings, 0);
    expect(nearRight).toBeGreaterThan(farRight + 0.35);
    const left = twizzlerFiberNearness(0, 0.1, settings, 0);
    const right = twizzlerFiberNearness(0, 0.95, settings, 0);
    expect(right).toBeGreaterThan(left);
  });

  it("expands world X for wide canvases without stretching the square shape", () => {
    expect(orangeWaveXRangeForCanvas(800, 800)).toBeCloseTo(6.8, 5);
    expect(orangeWaveXRangeForCanvas(4000, 800)).toBeCloseTo(6.8 * 5, 5);

    const common = {
      lineCount: 24,
      pointSpacing: 8,
      speed: 0,
      amplitude: 1,
      scale: 1,
      centerY: 0.5,
      rotateXDeg: 12,
      rotateYDeg: -18,
      rotateZDeg: 0,
      gradientXEnabled: false,
      gradientYEnabled: false,
      gradientZEnabled: false,
    };
    const square = buildTwizzlerLines(800, 800, 0, common);
    const banner = buildTwizzlerLines(4000, 800, 0, common);

    const midBand = (lines: typeof square.lines, width: number) =>
      lines.flatMap((line) => line.points.filter((p) => Math.abs(p.x - width * 0.5) < width * 0.08));
    const ySpan = (pts: { y: number }[]) => Math.max(...pts.map((p) => p.y)) - Math.min(...pts.map((p) => p.y));

    const squareMid = midBand(square.lines, 800);
    const bannerMid = midBand(banner.lines, 4000);
    expect(squareMid.length).toBeGreaterThan(10);
    expect(bannerMid.length).toBeGreaterThan(10);
    // HTML W/H screen map: same NDC → taller relative Y span on square, but both stay framed.
    expect(ySpan(bannerMid)).toBeGreaterThan(0);
    expect(ySpan(squareMid)).toBeGreaterThan(0);

    const bannerXs = banner.lines.flatMap((line) => line.points.map((p) => p.x));
    // HTML sx uses W — ribbon spans most of the wide canvas.
    expect(Math.min(...bannerXs)).toBeLessThan(pixelEdge(4000, 0.2));
    expect(Math.max(...bannerXs)).toBeGreaterThan(pixelEdge(4000, 0.8));

    const meanY = (pts: { y: number }[]) => pts.reduce((s, p) => s + p.y, 0) / pts.length;
    expect(meanY(bannerMid)).toBeGreaterThan(800 * 0.25);
    expect(meanY(bannerMid)).toBeLessThan(800 * 0.75);
    expect(meanY(squareMid)).toBeGreaterThan(800 * 0.25);
    expect(meanY(squareMid)).toBeLessThan(800 * 0.75);
  });

  it("applies HTML-faithful Rotate X/Y/Z (rotated coords, not origX bypass)", () => {
    const base = {
      lineCount: 20,
      pointSpacing: 10,
      speed: 0,
      scale: 1,
      centerY: 0.5,
      rotateXDeg: 0,
      rotateYDeg: 0,
      rotateZDeg: 0,
      gradientXEnabled: false,
      gradientYEnabled: false,
      gradientZEnabled: false,
    };
    const flat = buildTwizzlerLines(800, 800, 0, base);
    const yawed = buildTwizzlerLines(800, 800, 0, { ...base, rotateYDeg: -40 });
    const pitched = buildTwizzlerLines(800, 800, 0, { ...base, rotateXDeg: 35 });
    const meanX = (lines: typeof flat.lines) => {
      const xs = lines.flatMap((line) => line.points.map((p) => p.x));
      return xs.reduce((s, v) => s + v, 0) / Math.max(1, xs.length);
    };
    const ySpan = (lines: typeof flat.lines) => {
      const ys = lines.flatMap((line) => line.points.map((p) => p.y));
      return Math.max(...ys) - Math.min(...ys);
    };
    // Yaw must shift the pack horizontally (would be a no-op under the old origX path).
    expect(Math.abs(meanX(yawed.lines) - meanX(flat.lines))).toBeGreaterThan(8);
    // Pitch changes vertical extent via perspective.
    expect(Math.abs(ySpan(pitched.lines) - ySpan(flat.lines))).toBeGreaterThan(8);
  });

  it("keeps dense sampling on wide banners (orange-wave POINTS floor)", () => {
    const { lines } = buildTwizzlerLines(1600, 320, 0, {
      lineCount: 24,
      pointSpacing: 10,
      speed: 0,
      rotateXDeg: 0,
      rotateYDeg: 0,
      rotateZDeg: 0,
    });
    // Generation floor is ≥160; after opacity/depth cull some points may drop.
    expect(lines[0]?.points.length).toBeGreaterThanOrEqual(140);
    const square = buildTwizzlerLines(800, 800, 0, {
      lineCount: 24,
      pointSpacing: 10,
      speed: 0,
    });
    expect(square.lines[0]?.points.length).toBeGreaterThanOrEqual(160);
  });

  it("locks orange-wave hairline defaults (no factory lineWidth poison)", () => {
    expect(TWIZZLER_DEFAULTS).toMatchObject({
      lineCount: 56,
      lineWidth: 1.15,
      rotateXDeg: 12,
      rotateYDeg: -18,
      rotateZDeg: 0,
      fov: 1.05,
      camDist: 10.5,
      perspectiveWidth: 1.8,
      gradientXEnabled: true,
      gradientYEnabled: true,
      gradientZEnabled: true,
      gradientsEnabled: true,
      ribbonColorMode: "sharedGradient",
      gradientStops: [
        { id: "far", x: 0.08, y: 0.78, offset: 0.08, color: "#fea700" },
        { id: "peak", x: 0.5, y: 0.16, offset: 0.5, color: "#e92e28" },
        { id: "near", x: 0.92, y: 0.72, offset: 0.92, color: "#f46021" },
      ],
      gradientZStrength: 0.75,
      depthTerrain: 0,
      backgroundColor: "#ffffff",
    });
    const settings = normalizeTwizzlerSettings({});
    expect(settings.lineWidth).toBeCloseTo(1.15);
    expect(settings.lineCount).toBe(56);
  });

  it("disables baked axis gradients when ribbonColorMode is solid", () => {
    const { lines } = buildTwizzlerLines(400, 400, 0, {
      lineCount: 12,
      pointSpacing: 12,
      speed: 0,
      color: "#f46021",
      colorFar: "#fea700",
      colorNear: "#f46021",
      colorEdge: "#e92e28",
      ribbonColorMode: "solid",
      gradientXEnabled: true,
      gradientYEnabled: true,
      gradientZEnabled: true,
      backgroundColor: "#ffffff",
    });
    expect(lines.length).toBeGreaterThan(4);
    const colors = new Set(lines.flatMap((line) => line.points.map((p) => p.color)));
    expect(colors.size).toBe(1);
    expect([...colors][0]).toBe("#f46021");
  });

  it("migrates legacy gradientsEnabled false to solid ribbonColorMode", () => {
    const settings = normalizeTwizzlerSettings({ gradientsEnabled: false });
    expect(settings.ribbonColorMode).toBe("solid");
    expect(settings.gradientsEnabled).toBe(false);
  });

  it("fades Z gradient from foreground toward background color", () => {
    const { lines } = buildTwizzlerLines(600, 600, 0, {
      lineCount: 40,
      pointSpacing: 10,
      speed: 0,
      color: "#f46021",
      colorFar: "#f46021",
      colorNear: "#f46021",
      colorEdge: "#f46021",
      ribbonColorMode: "baked",
      gradientXEnabled: false,
      gradientYEnabled: false,
      gradientZEnabled: true,
      gradientZStrength: 1,
      gradientZCenter: 0,
      gradientZWidth: 0.95,
      backgroundColor: "#ffffff",
    });
    expect(lines.length).toBeGreaterThan(10);
    const sorted = [...lines].sort((a, b) => a.across - b.across);
    // Low across = Z_MIN (closer) keeps foreground; high across = Z_MAX fades to background.
    const nearLine = sorted[0]!;
    const farLine = sorted[sorted.length - 1]!;
    expect(hexLuma(farLine.color)).toBeGreaterThan(hexLuma(nearLine.color) + 20);
    expect(hexLuma(nearLine.color)).toBeLessThan(200);
  });

  it("ribbonGradientXSpan pads the fiber horizontal extent by half stroke", () => {
    const span = ribbonGradientXSpan(
      [
        { x: 40, y: 10 },
        { x: 120, y: 12 },
      ],
      8,
    );
    expect(span).toEqual({ x1: 36, x2: 124 });
  });

  it("ribbonGradientXYSpan pads the fiber AABB by half stroke", () => {
    const span = ribbonGradientXYSpan(
      [
        { x: 40, y: 10 },
        { x: 120, y: 50 },
      ],
      8,
    );
    expect(span).toEqual({ x1: 36, y1: 6, x2: 124, y2: 54 });
  });
});
