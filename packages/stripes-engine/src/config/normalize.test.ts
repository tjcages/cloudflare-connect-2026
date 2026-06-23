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
  it("clamps wave.noiseScale to 0.1..50", () => {
    expect(normalizeReveal({ wave: { noiseScale: 0 } }).wave.noiseScale).toBe(0.1);
    expect(normalizeReveal({ wave: { noiseScale: 100 } }).wave.noiseScale).toBe(50);
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
  it("unknown wave.position falls back to default", () => {
    expect(normalizeReveal({ wave: { position: "bogus" as any } }).wave.position).toBe(DEFAULT_REVEAL.wave.position);
  });
  it("unknown assembly.order falls back to default", () => {
    expect(normalizeReveal({ assembly: { order: "bogus" as any } }).assembly.order).toBe(DEFAULT_REVEAL.assembly.order);
  });
  it("unknown type falls back to default", () => {
    expect(normalizeReveal({ type: "bogus" as any }).type).toBe("wave");
  });
  it("round-trips reveal through serialize/parse", () => {
    const config = normalizeEngineConfig({
      reveal: { enabled: true, type: "assembly", wave: { durationMs: 2000 }, assembly: { order: "sweep" } },
    });
    const serialized = serializeEngineConfig(config);
    const parsed = parseEngineConfig(serialized);
    expect(parsed.reveal).toEqual(config.reveal);
  });
});
