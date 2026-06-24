import { describe, it, expect } from "vitest";
import {
  normalizeTransform,
  normalizeBackground,
  normalizeGrid,
  normalizeAdjustments,
  DEFAULT_ADJUSTMENTS,
  normalizeStripe,
  normalizeStripes,
  DEFAULT_STRIPES,
  DEFAULT_TRANSFORM,
  DEFAULT_GRID,
  normalizeEngineConfig,
  DEFAULT_ENGINE_CONFIG,
  normalizeReveal,
  DEFAULT_REVEAL,
  normalizeFlames,
  DEFAULT_FLAMES,
  normalizeEdgeMask,
  DEFAULT_EDGE_MASK,
} from "./normalize";
import { serializeEngineConfig, parseEngineConfig } from "./serialize";

describe("simple normalizers", () => {
  it("transform clamps zoom and defaults missing fields", () => {
    expect(normalizeTransform({})).toEqual(DEFAULT_TRANSFORM);
    expect(normalizeTransform({ zoom: 0 }).zoom).toBe(0.1); // min 0.1
    expect(normalizeTransform({ zoom: 99 }).zoom).toBe(8); // max 8
    expect(normalizeTransform({ panX: -5 }).panX).toBe(-1); // min -1
    expect(normalizeTransform({ fit: "cover" }).fit).toBe("cover");
    expect(normalizeTransform({ fit: "bogus" as any }).fit).toBe("stretch"); // invalid → default
  });
  it("background coerces to a 24-bit int", () => {
    expect(normalizeBackground({ color: 0xff8833 }).color).toBe(0xff8833);
    expect(normalizeBackground({}).color).toBe(0xffffff);
    expect(normalizeBackground({ color: -1 }).color).toBe(0x000000); // clamp ≥ 0
    expect(normalizeBackground({ color: 0x1ffffff }).color).toBe(0xffffff); // clamp ≤ 0xffffff
  });
  it("grid clamps sizes and gaps", () => {
    expect(normalizeGrid({})).toEqual(DEFAULT_GRID);
    expect(normalizeGrid({ cellWidth: 0 }).cellWidth).toBe(1); // min 1
    expect(normalizeGrid({ cellWidth: 999 }).cellWidth).toBe(64); // max 64
    expect(normalizeGrid({ cellWidth: 10, gapX: 20 }).gapX).toBe(10); // gap ≤ cellWidth
    expect(normalizeGrid({ orientation: "horizontal" }).orientation).toBe("horizontal");
  });
});
describe("adjustments normalizer", () => {
  it("defaults to identity adjustments", () => {
    expect(normalizeAdjustments({})).toEqual(DEFAULT_ADJUSTMENTS);
    expect(DEFAULT_ADJUSTMENTS).toMatchObject({ contrast: 1, gamma: 1, whitePoint: 1, blackPoint: 0, invert: false });
  });
  it("clamps to documented ranges", () => {
    expect(normalizeAdjustments({ contrast: -5 }).contrast).toBe(0); // 0..4
    expect(normalizeAdjustments({ contrast: 99 }).contrast).toBe(4);
    expect(normalizeAdjustments({ gamma: 0 }).gamma).toBe(0.05); // min 0.05, no upper clamp
    expect(normalizeAdjustments({ gamma: 100 }).gamma).toBe(100);
    expect(normalizeAdjustments({ blurRadius: 9 }).blurRadius).toBe(4); // 0..4
    expect(normalizeAdjustments({ posterizeLevels: 99 }).posterizeLevels).toBe(16); // 0..16, int
    expect(normalizeAdjustments({ whitePoint: 0, blackPoint: 0.5 }).whitePoint).toBeCloseTo(0.51); // wp ≥ bp+0.01
    expect(normalizeAdjustments({ invert: 1 as any }).invert).toBe(true);
  });
});
describe("stripes normalizer", () => {
  it("normalizes a stripe, clamping startFrom and width", () => {
    expect(normalizeStripe({ color: 0xff8833, startFrom: 2, width: 0 })).toEqual({
      color: 0xff8833,
      startFrom: 1,
      width: 1,
    });
  });
  it("empty/absent stripe list falls back to the provided defaults", () => {
    expect(normalizeStripes(undefined, DEFAULT_STRIPES)).toEqual(DEFAULT_STRIPES);
    expect(normalizeStripes([], DEFAULT_STRIPES)).toEqual(DEFAULT_STRIPES);
    expect(normalizeStripes([{ color: 0x010203, startFrom: 0.5, width: 3 }], DEFAULT_STRIPES)).toEqual([
      { color: 0x010203, startFrom: 0.5, width: 3 },
    ]);
  });
});
describe("normalizeEngineConfig", () => {
  it("fills a complete config from {}", () => {
    expect(normalizeEngineConfig({})).toEqual(DEFAULT_ENGINE_CONFIG);
    expect(DEFAULT_ENGINE_CONFIG.stripesEnabled).toBe(true);
  });
  it("merges partials through sub-normalizers", () => {
    const c = normalizeEngineConfig({ adjustments: { contrast: 2 } });
    expect(c.adjustments.contrast).toBe(2);
    expect(c.transform).toEqual(DEFAULT_ENGINE_CONFIG.transform);
  });
});
describe("sparkle normalizer", () => {
  it("defaults sparkle when omitted", () => {
    const c = normalizeEngineConfig({});
    expect(c.sparkle.gaps).toEqual({ enabled: false, coverage: 0.22, speed: 1 });
    expect(c.sparkle.width).toEqual({ enabled: false, coverage: 0.3, speed: 1, swingPx: 1.25 });
  });
  it("clamps sparkle.gaps.coverage to 0..1 and speed to >=0.05", () => {
    expect(normalizeEngineConfig({ sparkle: { gaps: { coverage: 9 } } }).sparkle.gaps.coverage).toBe(1);
    expect(normalizeEngineConfig({ sparkle: { gaps: { speed: 0 } } }).sparkle.gaps.speed).toBe(0.05);
  });
  it("clamps sparkle.width.swingPx to 0..40", () => {
    expect(normalizeEngineConfig({ sparkle: { width: { swingPx: 999 } } }).sparkle.width.swingPx).toBe(40);
  });
});
describe("reveal normalizer", () => {
  it("defaults to DEFAULT_REVEAL when called with {}", () => {
    expect(normalizeReveal({})).toEqual(DEFAULT_REVEAL);
    expect(DEFAULT_REVEAL.enabled).toBe(false);
    expect(DEFAULT_REVEAL.type).toBe("wave");
  });
  it("normalizeEngineConfig({}) includes DEFAULT_REVEAL", () => {
    expect(normalizeEngineConfig({}).reveal).toEqual(DEFAULT_REVEAL);
  });
  it("clamps wave.durationMs to 100..30000", () => {
    expect(normalizeReveal({ wave: { durationMs: 50 } }).wave.durationMs).toBe(100);
    expect(normalizeReveal({ wave: { durationMs: 99999 } }).wave.durationMs).toBe(30000);
    expect(normalizeReveal({ wave: { durationMs: 2000 } }).wave.durationMs).toBe(2000);
  });
  it("clamps wave.softness to 0..1", () => {
    expect(normalizeReveal({ wave: { softness: -0.5 } }).wave.softness).toBe(0);
    expect(normalizeReveal({ wave: { softness: 2 } }).wave.softness).toBe(1);
  });
  it("clamps wave.waviness to 0..1", () => {
    expect(normalizeReveal({ wave: { waviness: -1 } }).wave.waviness).toBe(0);
    expect(normalizeReveal({ wave: { waviness: 5 } }).wave.waviness).toBe(1);
  });
  it("clamps assembly.speedMinMs to 100..30000", () => {
    expect(normalizeReveal({ assembly: { speedMinMs: 50 } }).assembly.speedMinMs).toBe(100);
    expect(normalizeReveal({ assembly: { speedMinMs: 99999 } }).assembly.speedMinMs).toBe(30000);
  });
  it("clamps assembly.speedMaxMs and enforces >= speedMinMs", () => {
    expect(normalizeReveal({ assembly: { speedMinMs: 1000, speedMaxMs: 500 } }).assembly.speedMaxMs).toBe(1000);
    expect(normalizeReveal({ assembly: { speedMaxMs: 99999 } }).assembly.speedMaxMs).toBe(30000);
  });
  it("clamps assembly.staggerMs to 0..30000", () => {
    expect(normalizeReveal({ assembly: { staggerMs: -100 } }).assembly.staggerMs).toBe(0);
    expect(normalizeReveal({ assembly: { staggerMs: 99999 } }).assembly.staggerMs).toBe(30000);
  });
  it("clamps assembly.sliceSizePx to 8..200", () => {
    expect(normalizeReveal({ assembly: { sliceSizePx: 1 } }).assembly.sliceSizePx).toBe(8);
    expect(normalizeReveal({ assembly: { sliceSizePx: 9999 } }).assembly.sliceSizePx).toBe(200);
    expect(normalizeReveal({ assembly: {} }).assembly.sliceSizePx).toBe(40);
  });
  it("clamps assembly.scatterPx to 0..300, defaults to 50", () => {
    expect(normalizeReveal({ assembly: { scatterPx: -10 } }).assembly.scatterPx).toBe(0);
    expect(normalizeReveal({ assembly: { scatterPx: 9999 } }).assembly.scatterPx).toBe(300);
    expect(normalizeReveal({ assembly: {} }).assembly.scatterPx).toBe(50);
  });
  it("clamps assembly.angleJitterDeg to 0..90, defaults to 22", () => {
    expect(normalizeReveal({ assembly: { angleJitterDeg: -10 } }).assembly.angleJitterDeg).toBe(0);
    expect(normalizeReveal({ assembly: { angleJitterDeg: 9999 } }).assembly.angleJitterDeg).toBe(90);
    expect(normalizeReveal({ assembly: {} }).assembly.angleJitterDeg).toBe(22);
  });
  it("unknown wave.position falls back to default", () => {
    expect(normalizeReveal({ wave: { position: "bogus" as any } }).wave.position).toBe(DEFAULT_REVEAL.wave.position);
  });
  it("unknown type falls back to default", () => {
    expect(normalizeReveal({ type: "bogus" as any }).type).toBe("wave");
  });
  it("round-trips reveal through serialize/parse", () => {
    const config = normalizeEngineConfig({
      reveal: { enabled: true, type: "assembly", wave: { durationMs: 2000 }, assembly: { sliceSizePx: 50 } },
    });
    const serialized = serializeEngineConfig(config);
    const parsed = parseEngineConfig(serialized);
    expect(parsed.reveal).toEqual(config.reveal);
  });
});
describe("flames normalizer", () => {
  it("defaults to DEFAULT_FLAMES when called with {}", () => {
    expect(normalizeFlames({})).toEqual(DEFAULT_FLAMES);
    expect(DEFAULT_FLAMES.enabled).toBe(false);
    expect(DEFAULT_FLAMES.direction).toBe("up");
    expect(DEFAULT_FLAMES.minWidthRatio).toBe(0.0223);
    expect(DEFAULT_FLAMES.maxWidthRatio).toBe(0.0453);
    expect(DEFAULT_FLAMES.minHeightRatio).toBe(0.0245);
    expect(DEFAULT_FLAMES.maxHeightRatio).toBe(0.08);
    expect(DEFAULT_FLAMES.baseSpeedPxPerSec).toBe(40);
    expect(DEFAULT_FLAMES.speedVariation).toBe(1);
    expect(DEFAULT_FLAMES.spawnIntervalMs).toBe(50);
    expect(DEFAULT_FLAMES.spawnJitterMs).toBe(80);
    expect(DEFAULT_FLAMES.maxActive).toBe(48);
    expect(DEFAULT_FLAMES.edgeSharpness).toBe(1);
    expect(DEFAULT_FLAMES.opacityMin).toBe(0.3);
    expect(DEFAULT_FLAMES.opacityMax).toBe(1);
  });
  it("normalizeEngineConfig({}) includes DEFAULT_FLAMES", () => {
    expect(normalizeEngineConfig({}).flames).toEqual(DEFAULT_FLAMES);
  });
  it("clamps minWidthRatio to 0.001..0.5", () => {
    expect(normalizeFlames({ minWidthRatio: 0 }).minWidthRatio).toBe(0.001);
    expect(normalizeFlames({ minWidthRatio: 0.6 }).minWidthRatio).toBe(0.5);
    expect(normalizeFlames({ minWidthRatio: 0.1 }).minWidthRatio).toBe(0.1);
  });
  it("enforces maxWidthRatio >= minWidthRatio", () => {
    expect(normalizeFlames({ minWidthRatio: 0.3, maxWidthRatio: 0.1 }).maxWidthRatio).toBe(0.3);
  });
  it("clamps baseSpeedPxPerSec to 1..500", () => {
    expect(normalizeFlames({ baseSpeedPxPerSec: 0 }).baseSpeedPxPerSec).toBe(1);
    expect(normalizeFlames({ baseSpeedPxPerSec: 999 }).baseSpeedPxPerSec).toBe(500);
  });
  it("clamps maxActive to integer 1..200", () => {
    expect(normalizeFlames({ maxActive: 0 }).maxActive).toBe(1);
    expect(normalizeFlames({ maxActive: 999 }).maxActive).toBe(200);
    expect(normalizeFlames({ maxActive: 5.7 }).maxActive).toBe(6);
  });
  it("enforces opacityMax >= opacityMin", () => {
    expect(normalizeFlames({ opacityMin: 0.8, opacityMax: 0.2 }).opacityMax).toBe(0.8);
  });
  it("bogus direction falls back to 'up'", () => {
    expect(normalizeFlames({ direction: "diagonal" as any }).direction).toBe("up");
    expect(normalizeFlames({ direction: "down" }).direction).toBe("down");
    expect(normalizeFlames({ direction: "left" }).direction).toBe("left");
    expect(normalizeFlames({ direction: "right" }).direction).toBe("right");
  });
});
describe("edgeMask normalizer", () => {
  it("defaults to DEFAULT_EDGE_MASK when called with {}", () => {
    expect(normalizeEdgeMask({})).toEqual(DEFAULT_EDGE_MASK);
    expect(DEFAULT_EDGE_MASK.enabled).toBe(false);
    expect(DEFAULT_EDGE_MASK.start).toBe(0);
    expect(DEFAULT_EDGE_MASK.end).toBe(0.1);
    expect(DEFAULT_EDGE_MASK.power).toBe(1);
  });
  it("normalizeEngineConfig({}) includes DEFAULT_EDGE_MASK", () => {
    expect(normalizeEngineConfig({}).edgeMask).toEqual(DEFAULT_EDGE_MASK);
  });
  it("clamps start to 0..0.5", () => {
    expect(normalizeEdgeMask({ start: -0.1 }).start).toBe(0);
    expect(normalizeEdgeMask({ start: 0.6 }).start).toBe(0.5);
    expect(normalizeEdgeMask({ start: 0.3 }).start).toBe(0.3);
  });
  it("enforces end >= start + 0.001", () => {
    expect(normalizeEdgeMask({ start: 0.3, end: 0.1 }).end).toBe(0.301);
    expect(normalizeEdgeMask({ start: 0.3, end: 0.3 }).end).toBe(0.301);
  });
  it("clamps end to (start+0.001)..0.5", () => {
    expect(normalizeEdgeMask({ end: 0.6 }).end).toBe(0.5);
    expect(normalizeEdgeMask({ start: 0.2, end: 0.8 }).end).toBe(0.5);
  });
  it("clamps power to 0.1..4", () => {
    expect(normalizeEdgeMask({ power: 0 }).power).toBe(0.1);
    expect(normalizeEdgeMask({ power: 5 }).power).toBe(4);
    expect(normalizeEdgeMask({ power: 2 }).power).toBe(2);
  });
  it("enabled defaults false when undefined, false when explicitly false", () => {
    expect(normalizeEdgeMask({}).enabled).toBe(false);
    expect(normalizeEdgeMask({ enabled: false }).enabled).toBe(false);
    expect(normalizeEdgeMask({ enabled: true }).enabled).toBe(true);
  });
});
