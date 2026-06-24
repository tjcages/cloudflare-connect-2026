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
  normalizeCursorTrail,
  DEFAULT_CURSOR_TRAIL,
  normalizeClickWave,
  DEFAULT_CLICK_WAVE,
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
describe("cursorTrail normalizer", () => {
  it("defaults to DEFAULT_CURSOR_TRAIL when called with {}", () => {
    expect(normalizeCursorTrail({})).toEqual(DEFAULT_CURSOR_TRAIL);
    expect(DEFAULT_CURSOR_TRAIL.enabled).toBe(false);
    expect(DEFAULT_CURSOR_TRAIL.pushStrengthPx).toBe(48);
  });
  it("normalizeEngineConfig({}) includes DEFAULT_CURSOR_TRAIL", () => {
    expect(normalizeEngineConfig({}).cursorTrail).toEqual(DEFAULT_CURSOR_TRAIL);
  });
  it("omitted cursorTrail → enabled:false", () => {
    expect(normalizeEngineConfig({}).cursorTrail.enabled).toBe(false);
    expect(normalizeCursorTrail({}).enabled).toBe(false);
    expect(normalizeCursorTrail(undefined).enabled).toBe(false);
  });
  it("enabled:false stays false, enabled:true becomes true", () => {
    expect(normalizeCursorTrail({ enabled: false }).enabled).toBe(false);
    expect(normalizeCursorTrail({ enabled: true }).enabled).toBe(true);
  });
  it("clamps particleRadius to 0.5..80", () => {
    expect(normalizeCursorTrail({ particleRadius: 0 }).particleRadius).toBe(0.5);
    expect(normalizeCursorTrail({ particleRadius: 100 }).particleRadius).toBe(80);
    expect(normalizeCursorTrail({ particleRadius: 40 }).particleRadius).toBe(40);
  });
  it("clamps particleAlpha to 0..1", () => {
    expect(normalizeCursorTrail({ particleAlpha: -1 }).particleAlpha).toBe(0);
    expect(normalizeCursorTrail({ particleAlpha: 2 }).particleAlpha).toBe(1);
  });
  it("clamps particleLifeMs to 50..10000", () => {
    expect(normalizeCursorTrail({ particleLifeMs: 10 }).particleLifeMs).toBe(50);
    expect(normalizeCursorTrail({ particleLifeMs: 99999 }).particleLifeMs).toBe(10000);
  });
  it("clamps particleLifeJitterMs to 0..10000", () => {
    expect(normalizeCursorTrail({ particleLifeJitterMs: -1 }).particleLifeJitterMs).toBe(0);
    expect(normalizeCursorTrail({ particleLifeJitterMs: 99999 }).particleLifeJitterMs).toBe(10000);
  });
  it("clamps emitterVelocitySmoothing to 0..0.98", () => {
    expect(normalizeCursorTrail({ emitterVelocitySmoothing: -1 }).emitterVelocitySmoothing).toBe(0);
    expect(normalizeCursorTrail({ emitterVelocitySmoothing: 1 }).emitterVelocitySmoothing).toBe(0.98);
  });
  it("clamps particleVelocityScale to 0..2", () => {
    expect(normalizeCursorTrail({ particleVelocityScale: -1 }).particleVelocityScale).toBe(0);
    expect(normalizeCursorTrail({ particleVelocityScale: 5 }).particleVelocityScale).toBe(2);
  });
  it("clamps particleTangentVelocity to 0..20", () => {
    expect(normalizeCursorTrail({ particleTangentVelocity: -1 }).particleTangentVelocity).toBe(0);
    expect(normalizeCursorTrail({ particleTangentVelocity: 25 }).particleTangentVelocity).toBe(20);
  });
  it("clamps particleDamping to 0..1", () => {
    expect(normalizeCursorTrail({ particleDamping: -1 }).particleDamping).toBe(0);
    expect(normalizeCursorTrail({ particleDamping: 2 }).particleDamping).toBe(1);
  });
  it("clamps particleSpacingPx to 0.5..80", () => {
    expect(normalizeCursorTrail({ particleSpacingPx: 0 }).particleSpacingPx).toBe(0.5);
    expect(normalizeCursorTrail({ particleSpacingPx: 100 }).particleSpacingPx).toBe(80);
  });
  it("clamps maxEmitPerTick to integer 1..200", () => {
    expect(normalizeCursorTrail({ maxEmitPerTick: 0 }).maxEmitPerTick).toBe(1);
    expect(normalizeCursorTrail({ maxEmitPerTick: 999 }).maxEmitPerTick).toBe(200);
    expect(normalizeCursorTrail({ maxEmitPerTick: 5.7 }).maxEmitPerTick).toBe(6);
  });
  it("clamps spreadMinPx to 0..80", () => {
    expect(normalizeCursorTrail({ spreadMinPx: -1 }).spreadMinPx).toBe(0);
    expect(normalizeCursorTrail({ spreadMinPx: 100 }).spreadMinPx).toBe(80);
  });
  it("clamps spreadMaxPx to 0..120 and enforces >= spreadMinPx", () => {
    expect(normalizeCursorTrail({ spreadMinPx: 30, spreadMaxPx: 10 }).spreadMaxPx).toBe(30);
    expect(normalizeCursorTrail({ spreadMaxPx: 200 }).spreadMaxPx).toBe(120);
  });
  it("clamps spinStrength to 0..0.2", () => {
    expect(normalizeCursorTrail({ spinStrength: -1 }).spinStrength).toBe(0);
    expect(normalizeCursorTrail({ spinStrength: 1 }).spinStrength).toBe(0.2);
  });
  it("clamps densityRadiusMinScale to 0..3", () => {
    expect(normalizeCursorTrail({ densityRadiusMinScale: -1 }).densityRadiusMinScale).toBe(0);
    expect(normalizeCursorTrail({ densityRadiusMinScale: 5 }).densityRadiusMinScale).toBe(3);
  });
  it("clamps densityRadiusLifeScale to 0..3", () => {
    expect(normalizeCursorTrail({ densityRadiusLifeScale: -1 }).densityRadiusLifeScale).toBe(0);
    expect(normalizeCursorTrail({ densityRadiusLifeScale: 5 }).densityRadiusLifeScale).toBe(3);
  });
  it("clamps pushRadiusScale to 0..8", () => {
    expect(normalizeCursorTrail({ pushRadiusScale: -1 }).pushRadiusScale).toBe(0);
    expect(normalizeCursorTrail({ pushRadiusScale: 10 }).pushRadiusScale).toBe(8);
  });
  it("clamps pushStrengthPx to 0..120, default 48", () => {
    expect(normalizeCursorTrail({}).pushStrengthPx).toBe(48);
    expect(normalizeCursorTrail({ pushStrengthPx: -1 }).pushStrengthPx).toBe(0);
    expect(normalizeCursorTrail({ pushStrengthPx: 200 }).pushStrengthPx).toBe(120);
  });
  it("clamps pushLagPx to 0..80", () => {
    expect(normalizeCursorTrail({ pushLagPx: -1 }).pushLagPx).toBe(0);
    expect(normalizeCursorTrail({ pushLagPx: 100 }).pushLagPx).toBe(80);
  });
  it("clamps pushWobblePx to 0..80", () => {
    expect(normalizeCursorTrail({ pushWobblePx: -1 }).pushWobblePx).toBe(0);
    expect(normalizeCursorTrail({ pushWobblePx: 100 }).pushWobblePx).toBe(80);
  });
  it("clamps pushLeadBlackAlpha to 0..1", () => {
    expect(normalizeCursorTrail({ pushLeadBlackAlpha: -1 }).pushLeadBlackAlpha).toBe(0);
    expect(normalizeCursorTrail({ pushLeadBlackAlpha: 2 }).pushLeadBlackAlpha).toBe(1);
  });
});
describe("clickWave normalizer", () => {
  it("defaults to DEFAULT_CLICK_WAVE when called with {}", () => {
    expect(normalizeClickWave({})).toEqual(DEFAULT_CLICK_WAVE);
    expect(DEFAULT_CLICK_WAVE.enabled).toBe(false);
    expect(DEFAULT_CLICK_WAVE.pushStrengthPx).toBe(38);
  });
  it("normalizeEngineConfig({}) includes DEFAULT_CLICK_WAVE", () => {
    expect(normalizeEngineConfig({}).clickWave).toEqual(DEFAULT_CLICK_WAVE);
  });
  it("omitted clickWave → enabled:false", () => {
    expect(normalizeEngineConfig({}).clickWave.enabled).toBe(false);
    expect(normalizeClickWave({}).enabled).toBe(false);
    expect(normalizeClickWave(undefined).enabled).toBe(false);
  });
  it("enabled:false stays false, enabled:true becomes true", () => {
    expect(normalizeClickWave({ enabled: false }).enabled).toBe(false);
    expect(normalizeClickWave({ enabled: true }).enabled).toBe(true);
  });
  it("clamps lifeMs to 80..10000, default 630", () => {
    expect(normalizeClickWave({}).lifeMs).toBe(630);
    expect(normalizeClickWave({ lifeMs: 10 }).lifeMs).toBe(80);
    expect(normalizeClickWave({ lifeMs: 99999 }).lifeMs).toBe(10000);
    expect(normalizeClickWave({ lifeMs: 500 }).lifeMs).toBe(500);
  });
  it("clamps startRadiusPx to 1..120, default 6", () => {
    expect(normalizeClickWave({}).startRadiusPx).toBe(6);
    expect(normalizeClickWave({ startRadiusPx: 0 }).startRadiusPx).toBe(1);
    expect(normalizeClickWave({ startRadiusPx: 200 }).startRadiusPx).toBe(120);
  });
  it("clamps maxRadiusPx to 4..600, default 120", () => {
    expect(normalizeClickWave({}).maxRadiusPx).toBe(120);
    expect(normalizeClickWave({ maxRadiusPx: 1 }).maxRadiusPx).toBe(4);
    expect(normalizeClickWave({ maxRadiusPx: 9999 }).maxRadiusPx).toBe(600);
  });
  it("clamps startStrokeWidthPx to 0.5..80, default 24", () => {
    expect(normalizeClickWave({}).startStrokeWidthPx).toBe(24);
    expect(normalizeClickWave({ startStrokeWidthPx: 0 }).startStrokeWidthPx).toBe(0.5);
    expect(normalizeClickWave({ startStrokeWidthPx: 100 }).startStrokeWidthPx).toBe(80);
  });
  it("clamps endStrokeWidthPx to 0.25..40, default 12", () => {
    expect(normalizeClickWave({}).endStrokeWidthPx).toBe(12);
    expect(normalizeClickWave({ endStrokeWidthPx: 0 }).endStrokeWidthPx).toBe(0.25);
    expect(normalizeClickWave({ endStrokeWidthPx: 100 }).endStrokeWidthPx).toBe(40);
  });
  it("clamps maxWaves to integer 1..32, default 12", () => {
    expect(normalizeClickWave({}).maxWaves).toBe(12);
    expect(normalizeClickWave({ maxWaves: 0 }).maxWaves).toBe(1);
    expect(normalizeClickWave({ maxWaves: 100 }).maxWaves).toBe(32);
    expect(normalizeClickWave({ maxWaves: 5.7 }).maxWaves).toBe(6);
  });
  it("clamps pushStrengthPx to 0..200, default 38", () => {
    expect(normalizeClickWave({}).pushStrengthPx).toBe(38);
    expect(normalizeClickWave({ pushStrengthPx: -1 }).pushStrengthPx).toBe(0);
    expect(normalizeClickWave({ pushStrengthPx: 999 }).pushStrengthPx).toBe(200);
  });
  it("clamps pushBandScale to 1..8, default 3.2", () => {
    expect(normalizeClickWave({}).pushBandScale).toBe(3.2);
    expect(normalizeClickWave({ pushBandScale: 0 }).pushBandScale).toBe(1);
    expect(normalizeClickWave({ pushBandScale: 10 }).pushBandScale).toBe(8);
  });
  it("clamps stripeWhiteAlpha to 0..1, default 0.5", () => {
    expect(normalizeClickWave({}).stripeWhiteAlpha).toBe(0.5);
    expect(normalizeClickWave({ stripeWhiteAlpha: -1 }).stripeWhiteAlpha).toBe(0);
    expect(normalizeClickWave({ stripeWhiteAlpha: 2 }).stripeWhiteAlpha).toBe(1);
  });
});
