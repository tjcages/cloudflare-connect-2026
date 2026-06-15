import { describe, expect, it } from "vitest";
import {
  accumulateClickWaveCellMap,
  accumulateCursorTrailCellMap,
  applyCursorTrailCell,
  clickDissolveProgress,
  clickRadiusWobble,
  clickStrengthBreakup,
  CURSOR_TRAIL_MAX_PUSH_CELLS,
  finalizeCursorTrailCellMap,
  rasterizeCursorTrailCellMap,
  resetCursorTrailCellMap,
  resolveCursorTrailPushScaleCells,
} from "./cursorTrailOverlay";
import { DEFAULT_PLAYGROUND_CLICK_WAVE_CONFIG } from "./playgroundClickWaveConfig";
import { DEFAULT_PLAYGROUND_CURSOR_TRAIL_CONFIG } from "./playgroundCursorTrailConfig";
import { buildStripeColors, buildStripeIndexLut, resolveStripesForLuminanceMode } from "./stripeColors";

// ---------------------------------------------------------------------------
// Helpers mirroring the module internals (not exported, so we inline them)
// ---------------------------------------------------------------------------

function falloff(distance: number, radius: number): number {
  if (radius <= 0 || distance >= radius) return 0;
  const t = 1 - distance / radius;
  return t * t * (3 - 2 * t);
}

function blendChannel(channel: number, alpha: number): number {
  return Math.round(channel + (255 - channel) * alpha);
}

/** Make a minimal, valid PlaygroundCursorTrailConfig suitable for rasterizer tests. */
function makeConfig(overrides: Partial<typeof DEFAULT_PLAYGROUND_CURSOR_TRAIL_CONFIG> = {}) {
  return { ...DEFAULT_PLAYGROUND_CURSOR_TRAIL_CONFIG, ...overrides };
}

// ---------------------------------------------------------------------------
// 1. Saturating accumulation parity
// ---------------------------------------------------------------------------
describe("rasterizeCursorTrailCellMap – saturating accumulation parity", () => {
  it("single sample: whiteAlpha at centre equals alpha * falloff(0, r) = alpha", () => {
    const cols = 10;
    const rows = 10;
    const displayWidth = 100;
    const displayHeight = 100;
    // Place a sample at display centre (50, 50) → cell centre (5, 5)
    const sampleAlpha = 0.6;
    const sampleRadius = 10; // px in display space → 1 cell radius after mapping
    const config = makeConfig({ pushStrengthPx: 0, pushLeadBlackAlpha: 0 });

    const map = rasterizeCursorTrailCellMap(
      [{ x: 50, y: 50, pushX: 50, pushY: 50, alpha: sampleAlpha, radius: sampleRadius, progress: 0, seed: 1 }],
      config,
      displayWidth,
      displayHeight,
      cols,
      rows,
      undefined,
      new Uint8Array(cols * rows * 3).fill(255),
    );

    // cell (5,5) is the exact centre → distance = 0 → falloff = 1
    const cellIdx = 5 * cols + 5;
    const expected = sampleAlpha * 1; // alpha * falloff(0)
    expect(map.whiteAlpha[cellIdx]).toBeCloseTo(expected, 5);
  });

  it("two overlapping samples: whiteAlpha matches sequential CPU blendChannel accumulation within 1/255", () => {
    const cols = 5;
    const rows = 5;
    const displayWidth = 50;
    const displayHeight = 50;
    // Place samples at display coords that map exactly to cell (2,2):
    // cellX = x * cols / displayWidth → 2 = x * 5 / 50 → x = 20
    const a1 = 0.5;
    const a2 = 0.4;
    // Use a large radius so effectRadius >> 1 and falloff at the exact centre = 1
    // effectRadius = max(1, sampleRadius * cols / displayWidth) = max(1, 50*5/50) = 5
    const sampleRadius = 50;
    const config = makeConfig({ pushStrengthPx: 0, pushLeadBlackAlpha: 0 });
    const cellColors = new Uint8Array(cols * rows * 3).fill(255);

    const map = rasterizeCursorTrailCellMap(
      [
        { x: 20, y: 20, pushX: 20, pushY: 20, alpha: a1, radius: sampleRadius, progress: 0, seed: 1 },
        { x: 20, y: 20, pushX: 20, pushY: 20, alpha: a2, radius: sampleRadius, progress: 0, seed: 1 },
      ],
      config,
      displayWidth,
      displayHeight,
      cols,
      rows,
      undefined,
      cellColors,
    );

    // At the exact centre (distance=0, falloff=1), cellAlpha = alpha * 1 = alpha.
    // Sequential CPU path on a 0-start channel:
    // After sample1: blendChannel(0, a1) / 255
    // After sample2: blendChannel(prev_byte, a2) / 255
    const afterFirst = blendChannel(0, a1);
    const afterSecond = blendChannel(afterFirst, a2);
    const cpuAlpha = afterSecond / 255;

    const cellIdx = 2 * cols + 2;
    // Rasterizer uses: wa = prev + (1-prev)*alpha
    // which equals: 1 - (1-a1)*(1-a2) when both falloff=1
    const ras = map.whiteAlpha[cellIdx] ?? 0;
    expect(Math.abs(ras - cpuAlpha)).toBeLessThanOrEqual(1 / 255);
  });

  it("three samples: product formula matches within 1/255", () => {
    const cols = 4;
    const rows = 4;
    const displayWidth = 40;
    const displayHeight = 40;
    const alphas = [0.3, 0.5, 0.25];
    const config = makeConfig({ pushStrengthPx: 0, pushLeadBlackAlpha: 0 });
    const cellColors = new Uint8Array(cols * rows * 3).fill(255);

    // Place samples at display coords mapping exactly to cell (2,2):
    // cellX = x * 4 / 40 = 2 → x = 20. Use large radius so falloff at exact centre = 1.
    const samples = alphas.map((a) => ({
      x: 20,
      y: 20,
      pushX: 20,
      pushY: 20,
      alpha: a,
      radius: 40, // effectRadius = max(1, 40*4/40) = 4 cells → falloff(0, 4) = 1
      progress: 0,
      seed: 1,
    }));

    const map = rasterizeCursorTrailCellMap(
      samples,
      config,
      displayWidth,
      displayHeight,
      cols,
      rows,
      undefined,
      cellColors,
    );

    // CPU sequential blend starting at 0
    let channel = 0;
    for (const a of alphas) {
      channel = blendChannel(channel, a);
    }
    const cpuAlpha = channel / 255;

    const cellIdx = 2 * cols + 2;
    const ras = map.whiteAlpha[cellIdx] ?? 0;
    expect(Math.abs(ras - cpuAlpha)).toBeLessThanOrEqual(1 / 255);
  });
});

// ---------------------------------------------------------------------------
// 2. Falloff profile + coordinate mapping
// ---------------------------------------------------------------------------
describe("rasterizeCursorTrailCellMap – falloff profile and display→cell mapping", () => {
  it("peak lands at the mapped cell centre (distance 0, falloff 1)", () => {
    const cols = 16;
    const rows = 9;
    const displayWidth = 160;
    const displayHeight = 90;
    // Sample at display (80, 45) → cell (8, 4.5) → integer cell nearest is (8, 4) or (8, 5)
    const sampleAlpha = 0.8;
    const sampleRadius = 20; // display px
    const config = makeConfig({ pushStrengthPx: 0, pushLeadBlackAlpha: 0 });
    const cellColors = new Uint8Array(cols * rows * 3).fill(255);

    const map = rasterizeCursorTrailCellMap(
      [{ x: 80, y: 45, pushX: 80, pushY: 45, alpha: sampleAlpha, radius: sampleRadius, progress: 0, seed: 1 }],
      config,
      displayWidth,
      displayHeight,
      cols,
      rows,
      undefined,
      cellColors,
    );

    // Cell coordinate for sample centre
    const cellX = (80 * cols) / displayWidth; // = 8
    const cellY = (45 * rows) / displayHeight; // = 4.5
    const nearestX = Math.round(cellX); // 8
    const nearestY = Math.round(cellY); // 5 (rounds .5 up)

    // The maximum whiteAlpha should be at or near the centre cell
    const cellIdx = nearestY * cols + nearestX;
    const centreValue = map.whiteAlpha[cellIdx] ?? 0;

    // All surrounding cells should have <= the centre value
    for (let y = Math.max(0, nearestY - 3); y <= Math.min(rows - 1, nearestY + 3); y++) {
      for (let x = Math.max(0, nearestX - 3); x <= Math.min(cols - 1, nearestX + 3); x++) {
        const v = map.whiteAlpha[y * cols + x] ?? 0;
        expect(v).toBeLessThanOrEqual(centreValue + 1e-6);
      }
    }
  });

  it("alpha at distance d equals sample.alpha * falloff(d, cellRadius)", () => {
    const cols = 20;
    const rows = 20;
    const displayWidth = 200;
    const displayHeight = 200;
    // Centre at display (100,100) → cell (10,10)
    const sampleAlpha = 0.7;
    const sampleRadius = 40; // display px → cell radius = 40 * (20/200) = 4 cells
    const config = makeConfig({ pushStrengthPx: 0, pushLeadBlackAlpha: 0 });
    const cellColors = new Uint8Array(cols * rows * 3).fill(255);

    const map = rasterizeCursorTrailCellMap(
      [{ x: 100, y: 100, pushX: 100, pushY: 100, alpha: sampleAlpha, radius: sampleRadius, progress: 0, seed: 1 }],
      config,
      displayWidth,
      displayHeight,
      cols,
      rows,
      undefined,
      cellColors,
    );

    const cellRadius = sampleRadius * (cols / displayWidth); // = 4
    const centreX = (100 * cols) / displayWidth; // = 10
    const centreY = (100 * rows) / displayHeight; // = 10

    // Check a cell at d ≈ 2 cells from centre
    const testX = 12;
    const testY = 10;
    const d = Math.hypot(testX - centreX, testY - centreY); // = 2
    const expectedAlpha = sampleAlpha * falloff(d, cellRadius);
    const actual = map.whiteAlpha[testY * cols + testX] ?? 0;
    expect(actual).toBeCloseTo(expectedAlpha, 5);
  });

  it("whiteAlpha is zero for cells at distance >= effective cell radius", () => {
    const cols = 10;
    const rows = 10;
    const displayWidth = 100;
    const displayHeight = 100;
    const sampleRadius = 10; // display px → 1 cell radius
    const config = makeConfig({ pushStrengthPx: 0, pushLeadBlackAlpha: 0 });
    const cellColors = new Uint8Array(cols * rows * 3).fill(255);

    const map = rasterizeCursorTrailCellMap(
      [{ x: 50, y: 50, pushX: 50, pushY: 50, alpha: 1, radius: sampleRadius, progress: 0, seed: 1 }],
      config,
      displayWidth,
      displayHeight,
      cols,
      rows,
      undefined,
      cellColors,
    );

    const centreX = (50 * cols) / displayWidth; // = 5
    const centreY = (50 * rows) / displayHeight; // = 5
    const cellRadius = sampleRadius * (cols / displayWidth); // = 1

    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        const d = Math.hypot(x - centreX, y - centreY);
        if (d >= cellRadius) {
          expect(map.whiteAlpha[y * cols + x]).toBe(0);
        }
      }
    }
  });
});

// ---------------------------------------------------------------------------
// 3. Push accumulation + encoding round-trip
// ---------------------------------------------------------------------------
describe("rasterizeCursorTrailCellMap – push accumulation and encoding", () => {
  it("push vector at a cell equals dhat * pushStrengthPx*(cols/displayWidth) * alpha * falloff", () => {
    const cols = 10;
    const rows = 10;
    const displayWidth = 100;
    const displayHeight = 100;
    const pushStrengthPx = 5;
    const sampleAlpha = 0.8;
    const sampleRadius = 30; // display px → 3 cell radii
    const config = makeConfig({ pushStrengthPx, pushLeadBlackAlpha: 0, pushRadiusScale: 1 });
    const cellColors = new Uint8Array(cols * rows * 3).fill(255);

    const map = rasterizeCursorTrailCellMap(
      [{ x: 50, y: 50, pushX: 50, pushY: 50, alpha: sampleAlpha, radius: sampleRadius, progress: 0, seed: 1 }],
      config,
      displayWidth,
      displayHeight,
      cols,
      rows,
      undefined,
      cellColors,
    );

    const centreX = (50 * cols) / displayWidth; // = 5
    const centreY = (50 * rows) / displayHeight; // = 5
    const pushRadius = sampleRadius * (cols / displayWidth); // = 3
    const pushScale = pushStrengthPx * (cols / displayWidth);

    // Test cell (7, 5) — to the right, distance = 2
    const testX = 7;
    const testY = 5;
    const dx = testX - centreX;
    const dy = testY - centreY;
    const distance = Math.hypot(dx, dy);
    const fo = falloff(distance, pushRadius);
    const force = pushScale * sampleAlpha * fo;
    const expectedPushX = (dx / distance) * force;
    const expectedPushY = (dy / distance) * force;

    const cellIdx = testY * cols + testX;
    expect(map.pushX[cellIdx]).toBeCloseTo(expectedPushX, 5);
    expect(map.pushY[cellIdx]).toBeCloseTo(expectedPushY, 5);
  });

  it("pushRange equals the max absolute component across all cells", () => {
    const cols = 10;
    const rows = 10;
    const displayWidth = 100;
    const displayHeight = 100;
    const config = makeConfig({ pushStrengthPx: 8, pushLeadBlackAlpha: 0, pushRadiusScale: 1 });
    const cellColors = new Uint8Array(cols * rows * 3).fill(255);

    const map = rasterizeCursorTrailCellMap(
      [{ x: 50, y: 50, pushX: 50, pushY: 50, alpha: 1, radius: 30, progress: 0, seed: 1 }],
      config,
      displayWidth,
      displayHeight,
      cols,
      rows,
      undefined,
      cellColors,
    );

    let maxAbs = 0;
    const cellCount = cols * rows;
    for (let i = 0; i < cellCount; i++) {
      const ax = Math.abs(map.pushX[i] ?? 0);
      const ay = Math.abs(map.pushY[i] ?? 0);
      if (ax > maxAbs) maxAbs = ax;
      if (ay > maxAbs) maxAbs = ay;
    }

    expect(map.pushRange).toBeCloseTo(maxAbs, 5);
  });

  it("tears cells where the push field stretches the source apart (positive divergence)", () => {
    const cols = 20;
    const rows = 20;
    const displayWidth = 200;
    const displayHeight = 200;
    const config = makeConfig({ pushStrengthPx: 10, pushRadiusScale: 1 });
    const cellColors = new Uint8Array(cols * rows * 3).fill(255);
    const sampleRadius = 60; // display px → 6 cell radii

    const map = rasterizeCursorTrailCellMap(
      [{ x: 100, y: 100, pushX: 100, pushY: 100, alpha: 1, radius: sampleRadius, progress: 0, seed: 1 }],
      config,
      displayWidth,
      displayHeight,
      cols,
      rows,
      undefined,
      cellColors,
    );

    const centreX = 10;
    const centreY = 10;
    const r = 6;

    // The outward field diverges near the centre → tear opens there.
    const nearCentre = map.tear[centreY * cols + (centreX + 1)] ?? 0;
    expect(nearCentre).toBeGreaterThan(0.05);

    // Outside the push radius (+1 cell for the difference stencil) nothing tears.
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        const d = Math.hypot(x - centreX, y - centreY);
        const tear = map.tear[y * cols + x] ?? 0;
        expect(tear).toBeLessThanOrEqual(1);
        if (d > r + 1.5) {
          expect(tear).toBe(0);
        }
      }
    }
  });

  it("caps the accumulated offset magnitude at the configured push strength in cells", () => {
    const cols = 10;
    const rows = 10;
    const displayWidth = 100;
    const displayHeight = 100;
    const pushStrengthPx = 6;
    const pushScale = pushStrengthPx * (cols / displayWidth); // 0.6 cells
    const config = makeConfig({ pushStrengthPx, pushRadiusScale: 1 });
    const cellColors = new Uint8Array(cols * rows * 3).fill(255);

    // Two full-strength samples at the same spot would accumulate past the cap uncapped.
    const map = rasterizeCursorTrailCellMap(
      [
        { x: 50, y: 50, pushX: 50, pushY: 50, alpha: 1, radius: 30, progress: 0, seed: 1 },
        { x: 50, y: 50, pushX: 50, pushY: 50, alpha: 1, radius: 30, progress: 0, seed: 1 },
      ],
      config,
      displayWidth,
      displayHeight,
      cols,
      rows,
      undefined,
      cellColors,
    );

    let sawCapped = false;
    for (let i = 0; i < cols * rows; i++) {
      const length = Math.hypot(map.pushX[i] ?? 0, map.pushY[i] ?? 0);
      expect(length).toBeLessThanOrEqual(pushScale + 1e-6);
      if (Math.abs(length - pushScale) < 1e-6) {
        sawCapped = true;
      }
    }
    expect(sawCapped).toBe(true);
    expect(map.pushRange).toBeLessThanOrEqual(pushScale + 1e-6);
  });

  it("byte encoding round-trip recovers push vector within range/127 and keeps zero exact", () => {
    const cols = 10;
    const rows = 10;
    const displayWidth = 100;
    const displayHeight = 100;
    const config = makeConfig({ pushStrengthPx: 6, pushLeadBlackAlpha: 0, pushRadiusScale: 1 });
    const cellColors = new Uint8Array(cols * rows * 3).fill(255);

    const map = rasterizeCursorTrailCellMap(
      [{ x: 50, y: 50, pushX: 50, pushY: 50, alpha: 0.9, radius: 25, progress: 0, seed: 1 }],
      config,
      displayWidth,
      displayHeight,
      cols,
      rows,
      undefined,
      cellColors,
    );

    const pushRange = map.pushRange > 0 ? map.pushRange : 1;
    const cellCount = cols * rows;

    // Encoding as CursorTrailOverlay.sync does; decode as the shader does.
    const encode = (v: number) => Math.max(0, Math.min(255, Math.round(128 + (v / pushRange) * 127)));
    const decode = (byte: number) => ((byte - 128) / 127) * pushRange;

    // Zero push must survive the round trip exactly — otherwise every untouched
    // cell decodes to a nonzero offset and the shader treats it as displaced.
    expect(decode(encode(0))).toBe(0);

    for (let i = 0; i < cellCount; i++) {
      const px = map.pushX[i] ?? 0;
      const py = map.pushY[i] ?? 0;
      if (Math.abs(px) < 1e-9 && Math.abs(py) < 1e-9) continue;

      // Max quantization error per channel is pushRange / 127
      expect(Math.abs(decode(encode(px)) - px)).toBeLessThanOrEqual(pushRange / 127 + 1e-9);
      expect(Math.abs(decode(encode(py)) - py)).toBeLessThanOrEqual(pushRange / 127 + 1e-9);
    }
  });
});

// ---------------------------------------------------------------------------
// 5. Colors mode borrow
// ---------------------------------------------------------------------------
describe("rasterizeCursorTrailCellMap – colors mode color borrow", () => {
  it("center brighten: cells at the sample centre get the brightened borrowed color", () => {
    const cols = 8;
    const rows = 8;
    const displayWidth = 80;
    const displayHeight = 80;
    // Put a saturated red in cell (4,4)
    const cellColors = new Uint8Array(cols * rows * 3).fill(0);
    const colorCellIdx = (4 * cols + 4) * 3;
    cellColors[colorCellIdx] = 200;
    cellColors[colorCellIdx + 1] = 20;
    cellColors[colorCellIdx + 2] = 20;

    const config = makeConfig({ pushStrengthPx: 0, pushLeadBlackAlpha: 0 });

    const map = rasterizeCursorTrailCellMap(
      [{ x: 40, y: 40, pushX: 40, pushY: 40, alpha: 1, radius: 10, progress: 0, seed: 1 }],
      config,
      displayWidth,
      displayHeight,
      cols,
      rows,
      { mode: "colors", backgroundColor: 0x000000 },
      cellColors,
    );

    // Expected: brightenRgbPreservingHue(200, 20, 20) → scale = 255/200 = 1.275
    // r = round(min(255, 200*1.275)) = 255, g = round(min(255, 20*1.275)) = 26, b = 26
    const centreIdx = 4 * cols + 4;
    const colorR = map.color[centreIdx * 3] ?? 0;
    const colorG = map.color[centreIdx * 3 + 1] ?? 0;
    const colorB = map.color[centreIdx * 3 + 2] ?? 0;

    // The borrowed color should be heavily red-dominant
    expect(colorR).toBeGreaterThan(colorG);
    expect(colorR).toBeGreaterThan(colorB);
    expect(colorR).toBe(255); // max channel always maps to 255 after brighten
    // nonEmpty because there was a contribution
    expect(map.nonEmpty).toBe(true);
  });

  it("colors borrow: borrowed color matches brightenRgbPreservingHue of the nearest saturated color", () => {
    const cols = 6;
    const rows = 6;
    const displayWidth = 60;
    const displayHeight = 60;
    const cellColors = new Uint8Array(cols * rows * 3).fill(0);
    // Blue cell at (3,3)
    const blueIdx = (3 * cols + 3) * 3;
    cellColors[blueIdx] = 30;
    cellColors[blueIdx + 1] = 30;
    cellColors[blueIdx + 2] = 180;

    const config = makeConfig({ pushStrengthPx: 0, pushLeadBlackAlpha: 0 });

    const map = rasterizeCursorTrailCellMap(
      [{ x: 30, y: 30, pushX: 30, pushY: 30, alpha: 1, radius: 10, progress: 0, seed: 1 }],
      config,
      displayWidth,
      displayHeight,
      cols,
      rows,
      { mode: "colors", backgroundColor: 0x000000 },
      cellColors,
    );

    // brightenRgbPreservingHue(30, 30, 180): maxC=180, scale=255/180=1.4167
    // r = round(min(255, 30*1.4167)) = 43, g = 43, b = 255
    const centreIdx = 3 * cols + 3;
    const colorR = map.color[centreIdx * 3] ?? 0;
    const colorG = map.color[centreIdx * 3 + 1] ?? 0;
    const colorB = map.color[centreIdx * 3 + 2] ?? 0;

    expect(colorB).toBe(255);
    expect(colorR).toBeLessThan(colorB);
    expect(colorG).toBeLessThan(colorB);
  });

  it("skip-neutral: low-saturation cell colors are not borrowed (color stays white = 255,255,255)", () => {
    const cols = 6;
    const rows = 6;
    const displayWidth = 60;
    const displayHeight = 60;
    const cellColors = new Uint8Array(cols * rows * 3).fill(0);
    // Near-neutral gray at the sample position — saturation <= COLOR_SATURATION_EPSILON
    // pixelSaturation(r,g,b) = (max-min)/max ; for (200,200,200) → 0 → skipped
    const grayIdx = (3 * cols + 3) * 3;
    cellColors[grayIdx] = 200;
    cellColors[grayIdx + 1] = 200;
    cellColors[grayIdx + 2] = 200;

    const config = makeConfig({ pushStrengthPx: 0, pushLeadBlackAlpha: 0 });

    const map = rasterizeCursorTrailCellMap(
      [{ x: 30, y: 30, pushX: 30, pushY: 30, alpha: 0.9, radius: 10, progress: 0, seed: 1 }],
      config,
      displayWidth,
      displayHeight,
      cols,
      rows,
      { mode: "colors", backgroundColor: 0x000000 },
      cellColors,
    );

    // With no saturated color found, the rasterizer skips the sample entirely (nonEmpty stays false)
    expect(map.nonEmpty).toBe(false);
    // color defaults should remain at 255 (initialized fill)
    const centreIdx = 3 * cols + 3;
    expect(map.color[centreIdx * 3]).toBe(255);
    expect(map.color[centreIdx * 3 + 1]).toBe(255);
    expect(map.color[centreIdx * 3 + 2]).toBe(255);
  });

  it("skip-when-none: no saturated color anywhere → no whiteAlpha, but push still applies", () => {
    const cols = 6;
    const rows = 6;
    const displayWidth = 60;
    const displayHeight = 60;
    // All cells black = background, no saturated color
    const cellColors = new Uint8Array(cols * rows * 3).fill(0);

    const config = makeConfig({
      pushStrengthPx: 8,
      pushRadiusScale: 2,
    });

    const map = rasterizeCursorTrailCellMap(
      [{ x: 30, y: 30, pushX: 30, pushY: 30, alpha: 0.8, radius: 10, progress: 0, seed: 1 }],
      config,
      displayWidth,
      displayHeight,
      cols,
      rows,
      { mode: "colors", backgroundColor: 0x000000 },
      cellColors,
    );

    // No saturated color → the colors-mode sample is skipped entirely → whiteAlpha all zero
    const cellCount = cols * rows;
    for (let i = 0; i < cellCount; i++) {
      expect(map.whiteAlpha[i]).toBe(0);
    }

    // Push still applies (pushStrengthPx > 0) → nonEmpty and some push vector > 0
    expect(map.nonEmpty).toBe(true);
    const hasPush = Array.from(
      { length: cellCount },
      (_, i) => Math.abs(map.pushX[i] ?? 0) + Math.abs(map.pushY[i] ?? 0),
    ).some((v) => v > 0);
    expect(hasPush).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 6. applyCursorTrailCell algebra + LUT parity
// ---------------------------------------------------------------------------
describe("applyCursorTrailCell – algebra", () => {
  it("non-inverted: brighten l+(1-l)*A", () => {
    const luma = 0.5;
    const whiteAlpha = 0.3;
    expect(applyCursorTrailCell(luma, whiteAlpha, false)).toBeCloseTo(luma + (1 - luma) * whiteAlpha, 8);
  });

  it("inverted: darken l*(1-A)", () => {
    const luma = 0.5;
    const whiteAlpha = 0.3;
    expect(applyCursorTrailCell(luma, whiteAlpha, true)).toBeCloseTo(luma * (1 - whiteAlpha), 8);
  });

  it("with zero alpha: returns luma unchanged", () => {
    const luma = 0.7;
    expect(applyCursorTrailCell(luma, 0, false)).toBeCloseTo(luma, 8);
    expect(applyCursorTrailCell(luma, 0, true)).toBeCloseTo(luma, 8);
  });

  it("full whiteAlpha (1): non-inverted result is 1, inverted result is 0", () => {
    expect(applyCursorTrailCell(0.3, 1, false)).toBeCloseTo(1, 8);
    expect(applyCursorTrailCell(0.3, 1, true)).toBeCloseTo(0, 8);
  });

  it("sweep of luma values matches manual formula", () => {
    const wA = 0.4;
    for (let li = 0; li <= 10; li++) {
      const l = li / 10;
      expect(applyCursorTrailCell(l, wA, false)).toBeCloseTo(l + (1 - l) * wA, 8);
      expect(applyCursorTrailCell(l, wA, true)).toBeCloseTo(l * (1 - wA), 8);
    }
  });
});

describe("applyCursorTrailCell – LUT parity with buildStripeIndexLut / resolveStripesForLuminanceMode", () => {
  it("lut[floor(l*256)] via buildStripeIndexLut agrees with resolveStripeIndices on the same luma byte", () => {
    // Build a stripe list using the luminance mode resolver
    const stripeColors = buildStripeColors();
    const stripes = resolveStripesForLuminanceMode(stripeColors, "luminance");
    const lut = buildStripeIndexLut(stripes);

    // Cross-check: the LUT entry equals stripeIndexForLuminance(b/255, stripes)
    // for a representative set of luma bytes
    for (let b = 0; b < 256; b += 16) {
      const l = b / 255;
      let best = 0;
      let bestStart = -1;
      for (let i = 0; i < stripes.length; i++) {
        const entry = stripes[i]!;
        if (entry.startFrom <= l && entry.startFrom > bestStart) {
          best = i + 1;
          bestStart = entry.startFrom;
        }
      }
      expect(lut[b]).toBe(best);
    }
  });

  it("colors-mode stripe resolver + lut parity", () => {
    const stripeColors = buildStripeColors();
    const stripes = resolveStripesForLuminanceMode(stripeColors, "colors");
    const lut = buildStripeIndexLut(stripes);

    for (let b = 0; b < 256; b += 8) {
      const l = b / 255;
      let best = 0;
      let bestStart = -1;
      for (let i = 0; i < stripes.length; i++) {
        const entry = stripes[i]!;
        if (entry.startFrom <= l && entry.startFrom > bestStart) {
          best = i + 1;
          bestStart = entry.startFrom;
        }
      }
      expect(lut[b]).toBe(best);
    }
  });
});

// ---------------------------------------------------------------------------
// 7. Buffer reuse + nonEmpty
// ---------------------------------------------------------------------------
describe("rasterizeCursorTrailCellMap – buffer reuse and nonEmpty", () => {
  it("passing same-size out buffer returns the same object reference", () => {
    const cols = 4;
    const rows = 4;
    const config = makeConfig({ pushStrengthPx: 0, pushLeadBlackAlpha: 0 });
    const cellColors = new Uint8Array(cols * rows * 3).fill(255);

    const first = rasterizeCursorTrailCellMap(
      [{ x: 20, y: 20, pushX: 20, pushY: 20, alpha: 0.5, radius: 5, progress: 0, seed: 1 }],
      config,
      40,
      40,
      cols,
      rows,
      undefined,
      cellColors,
    );

    const second = rasterizeCursorTrailCellMap(
      [{ x: 20, y: 20, pushX: 20, pushY: 20, alpha: 0.5, radius: 5, progress: 0, seed: 1 }],
      config,
      40,
      40,
      cols,
      rows,
      undefined,
      cellColors,
      first,
    );

    expect(second).toBe(first);
  });

  it("buffer is cleared on reuse: old values do not persist", () => {
    const cols = 4;
    const rows = 4;
    const config = makeConfig({ pushStrengthPx: 0, pushLeadBlackAlpha: 0 });
    const cellColors = new Uint8Array(cols * rows * 3).fill(255);

    // First pass: sample at cell (2,2)
    const out = rasterizeCursorTrailCellMap(
      [{ x: 20, y: 20, pushX: 20, pushY: 20, alpha: 1, radius: 5, progress: 0, seed: 1 }],
      config,
      40,
      40,
      cols,
      rows,
      undefined,
      cellColors,
    );

    // Remember which cells were set
    const snapshotWhite = Float32Array.from(out.whiteAlpha);

    // Second pass: no samples — should clear all
    rasterizeCursorTrailCellMap(
      [],
      config,
      40,
      40,
      cols,
      rows,
      undefined,
      cellColors,
      out,
    );

    for (let i = 0; i < cols * rows; i++) {
      expect(out.whiteAlpha[i]).toBe(0);
    }
    // Confirm there actually were non-zero values in the first pass
    expect(snapshotWhite.some((v) => v > 0)).toBe(true);
  });

  it("empty samples → nonEmpty false and pushRange 0", () => {
    const cols = 4;
    const rows = 4;
    const config = makeConfig({ pushStrengthPx: 5, pushLeadBlackAlpha: 0.5 });
    const cellColors = new Uint8Array(cols * rows * 3).fill(255);

    const map = rasterizeCursorTrailCellMap(
      [],
      config,
      40,
      40,
      cols,
      rows,
      undefined,
      cellColors,
    );

    expect(map.nonEmpty).toBe(false);
    expect(map.pushRange).toBe(0);
  });

  it("any contribution → nonEmpty true", () => {
    const cols = 4;
    const rows = 4;
    const config = makeConfig({ pushStrengthPx: 0, pushLeadBlackAlpha: 0 });
    const cellColors = new Uint8Array(cols * rows * 3).fill(255);

    const map = rasterizeCursorTrailCellMap(
      [{ x: 20, y: 20, pushX: 20, pushY: 20, alpha: 0.3, radius: 10, progress: 0, seed: 1 }],
      config,
      40,
      40,
      cols,
      rows,
      undefined,
      cellColors,
    );

    expect(map.nonEmpty).toBe(true);
  });

  it("different-size out buffer triggers fresh allocation (new object)", () => {
    const config = makeConfig({ pushStrengthPx: 0, pushLeadBlackAlpha: 0 });
    const cellColors4 = new Uint8Array(4 * 4 * 3).fill(255);
    const cellColors6 = new Uint8Array(6 * 6 * 3).fill(255);

    const first = rasterizeCursorTrailCellMap(
      [{ x: 20, y: 20, pushX: 20, pushY: 20, alpha: 0.5, radius: 5, progress: 0, seed: 1 }],
      config,
      40,
      40,
      4,
      4,
      undefined,
      cellColors4,
    );

    const second = rasterizeCursorTrailCellMap(
      [{ x: 30, y: 30, pushX: 30, pushY: 30, alpha: 0.5, radius: 5, progress: 0, seed: 1 }],
      config,
      60,
      60,
      6,
      6,
      undefined,
      cellColors6,
      first, // different size → should not reuse
    );

    expect(second).not.toBe(first);
    expect(second.cols).toBe(6);
    expect(second.rows).toBe(6);
  });
});

// ---------------------------------------------------------------------------
// 8. Click wave accumulation (explosion ring)
// ---------------------------------------------------------------------------
function makeClickConfig(overrides: Partial<typeof DEFAULT_PLAYGROUND_CLICK_WAVE_CONFIG> = {}) {
  return { ...DEFAULT_PLAYGROUND_CLICK_WAVE_CONFIG, ...overrides };
}

function makeClickSample(
  overrides: Partial<{
    x: number;
    y: number;
    radius: number;
    strokeWidth: number;
    waveProgress: number;
    pushPower: number;
    whitePower: number;
    seed: number;
  }> = {},
) {
  return {
    x: 100,
    y: 100,
    radius: 60,
    strokeWidth: 20,
    waveProgress: 0.3,
    pushPower: 1,
    whitePower: 1,
    seed: 5,
    ...overrides,
  };
}

describe("accumulateClickWaveCellMap – explosion ring", () => {
  const cols = 20;
  const rows = 20;
  const displayWidth = 200;
  const displayHeight = 200;
  // Mapping: cell = display * (20 / 200); click at (100,100) → cell centre (10,10);
  // radius 60px → R = 6 cells; stroke 20px → halfStroke = 1 cell; wobble amplitude = 1.08 cells.

  const R = 6;
  const halfStroke = 1;
  const wobbleAmplitude = Math.max(1, R * 0.18);

  // Mirrors CLICK_BREAKUP_JITTER / CLICK_INTERIOR_FILL in cursorTrailOverlay.ts.
  const breakupJitter = 0.25;
  const interiorFill = 0.5;

  function expectedRingAlpha(sample: ReturnType<typeof makeClickSample>, whitePeak: number, x: number, y: number) {
    const dx = x - 10;
    const dy = y - 10;
    const distance = Math.hypot(dx, dy);
    const front = R + clickRadiusWobble(sample.seed, Math.atan2(dy, dx), sample.waveProgress, wobbleAmplitude);
    const breakup = clickStrengthBreakup(sample.seed, x, y, sample.waveProgress, breakupJitter);
    const fromFront = distance - front;
    let radial: number;
    if (fromFront > halfStroke) {
      radial = 0;
    } else if (fromFront > 0) {
      const t = 1 - fromFront / halfStroke;
      radial = t * t * (3 - 2 * t);
    } else {
      const interiorT = Math.max(0, Math.min(1, distance / Math.max(0.0001, front)));
      radial = interiorFill + (1 - interiorFill) * interiorT;
    }
    return Math.max(0, Math.min(1, whitePeak * breakup * radial));
  }

  it("fills the blast interior behind the wobbled front and leaves the far field dark", () => {
    const config = makeClickConfig({ stripeWhiteAlpha: 0.5, pushStrengthPx: 0 });
    const sample = makeClickSample();
    const map = resetCursorTrailCellMap(null, cols, rows);
    accumulateClickWaveCellMap(map, [sample], config, displayWidth, displayHeight, undefined, undefined);

    // Every cell matches the wobble + breakup + filled-radial recipe exactly.
    let nonZero = 0;
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        const expected = expectedRingAlpha(sample, 0.5, x, y);
        expect(map.whiteAlpha[y * cols + x]).toBeCloseTo(expected, 5);
        if (expected > 0) nonZero++;
      }
    }
    expect(nonZero).toBeGreaterThan(0);
    // Interior is now filled (origin lit at the fill floor), far corner still untouched.
    expect(map.whiteAlpha[10 * cols + 10]).toBeGreaterThan(0);
    expect(map.whiteAlpha[0]).toBe(0);
    expect(map.nonEmpty).toBe(true);
  });

  it("pushes outward with a monotonic interior ramp peaking at the wobbled front", () => {
    const config = makeClickConfig({ pushStrengthPx: 10, pushBandScale: 2, stripeWhiteAlpha: 0 });
    const sample = makeClickSample();
    const map = resetCursorTrailCellMap(null, cols, rows);
    accumulateClickWaveCellMap(map, [sample], config, displayWidth, displayHeight, undefined, undefined);

    // Along the +x axis (angle 0) the front sits at R + wobble(angle=0).
    const front = Math.max(0.5, R + clickRadiusWobble(sample.seed, 0, sample.waveProgress, wobbleAmplitude));
    const pushAt = (x: number) => map.pushX[10 * cols + x] ?? 0;
    const smooth = (t: number) => t * t * (3 - 2 * t);
    const pushScale = 10 * (cols / displayWidth); // 1 cell

    for (const x of [12, 14, 16]) {
      const d = x - 10;
      const w = d <= front
        ? smooth(d / front)
        : (() => {
            const band = 2;
            if (d - front >= band) return 0;
            const t = 1 - (d - front) / band;
            return t * t * (3 - 2 * t);
          })();
      expect(pushAt(x)).toBeCloseTo(pushScale * sample.pushPower * w, 5);
      // Outward on the +x axis → no vertical component.
      expect(map.pushY[10 * cols + x]).toBeCloseTo(0, 5);
    }
    // Interior ramp is monotonic toward the front.
    expect(pushAt(14)).toBeGreaterThan(pushAt(12));
    // Far outside everything: zero.
    expect(pushAt(19)).toBe(0);
  });

  it("opens a tear hole strictly inside the front after finalize, none beyond the band", () => {
    const config = makeClickConfig({ pushStrengthPx: 10, pushBandScale: 2, stripeWhiteAlpha: 0 });
    const map = resetCursorTrailCellMap(null, cols, rows);
    accumulateClickWaveCellMap(map, [makeClickSample()], config, displayWidth, displayHeight, undefined, undefined);
    finalizeCursorTrailCellMap(
      map,
      Math.min(resolveCursorTrailPushScaleCells(10, displayWidth, cols), CURSOR_TRAIL_MAX_PUSH_CELLS),
    );

    // Interior (between centre and front) diverges outward → tear opens.
    expect(map.tear[10 * cols + 13]).toBeGreaterThan(0);
    // Beyond front + wobble + push band (+1.5 for the difference stencil): nothing tears.
    for (let x = 0; x < cols; x++) {
      for (let y = 0; y < rows; y++) {
        const d = Math.hypot(x - 10, y - 10);
        if (d > R + wobbleAmplitude + 2 + 1.5) {
          expect(map.tear[y * cols + x]).toBe(0);
        }
      }
    }
  });

  it("dissolves cell by cell late in life instead of staying a solid ring", () => {
    const config = makeClickConfig({ stripeWhiteAlpha: 0.5, pushStrengthPx: 0 });
    const countLit = (waveProgress: number) => {
      const map = resetCursorTrailCellMap(null, cols, rows);
      accumulateClickWaveCellMap(
        map,
        [makeClickSample({ waveProgress })],
        config,
        displayWidth,
        displayHeight,
        undefined,
        undefined,
      );
      let lit = 0;
      for (let i = 0; i < cols * rows; i++) {
        if ((map.whiteAlpha[i] ?? 0) > 0) lit++;
      }
      return lit;
    };

    expect(clickDissolveProgress(0.3)).toBe(0);
    expect(clickDissolveProgress(0.95)).toBeGreaterThan(0.8);

    const early = countLit(0.3);
    const late = countLit(0.95);
    expect(early).toBeGreaterThan(0);
    // Most surviving ring cells have crumbled away near the end of life.
    expect(late).toBeLessThan(early * 0.5);
  });

  it("merges trail and click contributions into one reused map with saturating whiteAlpha", () => {
    const trailConfig = { ...DEFAULT_PLAYGROUND_CURSOR_TRAIL_CONFIG, pushStrengthPx: 0 };
    const clickConfig = makeClickConfig({ stripeWhiteAlpha: 0.5, pushStrengthPx: 0 });
    const sample = makeClickSample();
    // Trail particle parked on a ring cell → display (160,100) = cell (16,10).
    const trailSamples = [{ x: 160, y: 100, pushX: 160, pushY: 100, alpha: 0.4, radius: 10, progress: 0, seed: 1 }];
    const cellIdx = 10 * cols + 16;

    const trailOnly = resetCursorTrailCellMap(null, cols, rows);
    accumulateCursorTrailCellMap(trailOnly, trailSamples, trailConfig, displayWidth, displayHeight, undefined, undefined);
    const trailAlpha = trailOnly.whiteAlpha[cellIdx] ?? 0;
    expect(trailAlpha).toBeGreaterThan(0);

    const clickOnly = resetCursorTrailCellMap(null, cols, rows);
    accumulateClickWaveCellMap(clickOnly, [sample], clickConfig, displayWidth, displayHeight, undefined, undefined);
    const clickAlpha = clickOnly.whiteAlpha[cellIdx] ?? 0;

    let merged = resetCursorTrailCellMap(null, cols, rows);
    const reused = merged;
    accumulateCursorTrailCellMap(merged, trailSamples, trailConfig, displayWidth, displayHeight, undefined, undefined);
    accumulateClickWaveCellMap(merged, [sample], clickConfig, displayWidth, displayHeight, undefined, undefined);
    merged = finalizeCursorTrailCellMap(merged, 1);

    expect(merged).toBe(reused);
    expect(merged.whiteAlpha[cellIdx]).toBeCloseTo(trailAlpha + (1 - trailAlpha) * clickAlpha, 5);
    expect(merged.whiteAlpha[cellIdx]!).toBeLessThanOrEqual(1);
  });

  it("caps merged push magnitude via finalize", () => {
    const clickConfig = makeClickConfig({ pushStrengthPx: 100, pushBandScale: 2, stripeWhiteAlpha: 0 });
    const map = resetCursorTrailCellMap(null, cols, rows);
    accumulateClickWaveCellMap(
      map,
      [makeClickSample(), makeClickSample({ seed: 9 })],
      clickConfig,
      displayWidth,
      displayHeight,
      undefined,
      undefined,
    );
    finalizeCursorTrailCellMap(map, CURSOR_TRAIL_MAX_PUSH_CELLS);

    for (let i = 0; i < cols * rows; i++) {
      const length = Math.hypot(map.pushX[i] ?? 0, map.pushY[i] ?? 0);
      expect(length).toBeLessThanOrEqual(CURSOR_TRAIL_MAX_PUSH_CELLS + 1e-6);
    }
    expect(map.pushRange).toBeLessThanOrEqual(CURSOR_TRAIL_MAX_PUSH_CELLS + 1e-6);
  });

  it("wrapper rasterizeCursorTrailCellMap ≡ reset + accumulate + finalize", () => {
    const config = { ...DEFAULT_PLAYGROUND_CURSOR_TRAIL_CONFIG, pushStrengthPx: 6 };
    const samples = [
      { x: 50, y: 50, pushX: 50, pushY: 50, alpha: 0.8, radius: 25, progress: 0, seed: 1 },
      { x: 80, y: 60, pushX: 80, pushY: 60, alpha: 0.5, radius: 15, progress: 0, seed: 1 },
    ];

    const viaWrapper = rasterizeCursorTrailCellMap(
      samples,
      config,
      displayWidth,
      displayHeight,
      cols,
      rows,
      undefined,
      undefined,
    );

    const manual = resetCursorTrailCellMap(null, cols, rows);
    accumulateCursorTrailCellMap(manual, samples, config, displayWidth, displayHeight, undefined, undefined);
    finalizeCursorTrailCellMap(
      manual,
      Math.min(resolveCursorTrailPushScaleCells(config.pushStrengthPx, displayWidth, cols), CURSOR_TRAIL_MAX_PUSH_CELLS),
    );

    expect(Array.from(viaWrapper.whiteAlpha)).toEqual(Array.from(manual.whiteAlpha));
    expect(Array.from(viaWrapper.pushX)).toEqual(Array.from(manual.pushX));
    expect(Array.from(viaWrapper.pushY)).toEqual(Array.from(manual.pushY));
    expect(Array.from(viaWrapper.tear)).toEqual(Array.from(manual.tear));
    expect(viaWrapper.pushRange).toBe(manual.pushRange);
    expect(viaWrapper.nonEmpty).toBe(manual.nonEmpty);
  });
});
