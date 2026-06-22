import { describe, expect, test, it } from "vitest";
import {
  DEFAULT_PLAYGROUND_REVEAL_CONFIG,
  isDefaultPlaygroundRevealConfig,
  normalizePlaygroundRevealConfig,
  resolvePlaygroundRevealDurationMs,
} from "./playgroundRevealConfig";

describe("playground reveal config", () => {
  test("normalizes wave config values into supported ranges", () => {
    const config = normalizePlaygroundRevealConfig({
      wave: {
        position: "right bottom",
        durationMs: 50,
        softness: 2,
        waviness: -1,
        noiseScale: 0,
      },
    });

    expect(config).toEqual({
      enabled: false,
      type: "wave",
      wave: {
        position: "right bottom",
        durationMs: 100,
        softness: 1,
        waviness: 0,
        noiseScale: 0.1,
      },
      assembly: DEFAULT_PLAYGROUND_REVEAL_CONFIG.assembly,
    });
  });

  test("ignores legacy random-columns payload fields", () => {
    const config = normalizePlaygroundRevealConfig({
      enabled: true,
      preset: "randomColumns",
      randomColumns: { durationMs: 1800, stagger: 0.8, yShift: 0.35 },
    } as never);

    expect(config).toEqual({
      enabled: true,
      type: "wave",
      wave: { ...DEFAULT_PLAYGROUND_REVEAL_CONFIG.wave },
      assembly: { ...DEFAULT_PLAYGROUND_REVEAL_CONFIG.assembly },
    });
  });

  test("detects the default reveal config", () => {
    expect(isDefaultPlaygroundRevealConfig(DEFAULT_PLAYGROUND_REVEAL_CONFIG)).toBe(true);
    expect(
      isDefaultPlaygroundRevealConfig(
        normalizePlaygroundRevealConfig({
          enabled: true,
          wave: { ...DEFAULT_PLAYGROUND_REVEAL_CONFIG.wave },
        }),
      ),
    ).toBe(false);
    expect(
      isDefaultPlaygroundRevealConfig(
        normalizePlaygroundRevealConfig({
          wave: { ...DEFAULT_PLAYGROUND_REVEAL_CONFIG.wave, position: "left top" },
        }),
      ),
    ).toBe(false);
  });
});

describe("assembly reveal config", () => {
  it("defaults type to wave and provides assembly defaults", () => {
    const normalized = normalizePlaygroundRevealConfig(undefined);
    expect(normalized.type).toBe("wave");
    expect(normalized.assembly).toEqual(DEFAULT_PLAYGROUND_REVEAL_CONFIG.assembly);
  });

  it("treats a type-less legacy payload as wave (back-compat)", () => {
    const legacy = { enabled: true, wave: { position: "center" } } as never;
    expect(normalizePlaygroundRevealConfig(legacy).type).toBe("wave");
  });

  it("keeps a valid assembly type and clamps its fields", () => {
    const normalized = normalizePlaygroundRevealConfig({
      enabled: true,
      type: "assembly",
      assembly: { speedMinMs: 50, speedMaxMs: 200, staggerMs: 99_999 },
    } as never);
    expect(normalized.type).toBe("assembly");
    expect(normalized.assembly).toEqual({
      speedMinMs: 100, // clamped to min 100
      speedMaxMs: 200,
      staggerMs: 30_000, // clamped to max 30000
    });
  });

  it("forces speed max to be at least speed min", () => {
    const normalized = normalizePlaygroundRevealConfig({
      type: "assembly",
      assembly: { speedMinMs: 3000, speedMaxMs: 500 },
    } as never);
    expect(normalized.assembly.speedMinMs).toBe(3000);
    expect(normalized.assembly.speedMaxMs).toBe(3000);
  });

  it("clamps staggerMs down to zero and ignores legacy assembly fields", () => {
    const normalized = normalizePlaygroundRevealConfig({
      type: "assembly",
      assembly: { staggerMs: -100, order: "sweep", durationMs: 6000, spread: 0.5 } as never,
    } as never);
    expect(normalized.assembly.staggerMs).toBe(0);
    expect(normalized.assembly).toEqual({
      speedMinMs: DEFAULT_PLAYGROUND_REVEAL_CONFIG.assembly.speedMinMs,
      speedMaxMs: DEFAULT_PLAYGROUND_REVEAL_CONFIG.assembly.speedMaxMs,
      staggerMs: 0,
    });
  });

  it("rejects an unknown reveal type", () => {
    expect(normalizePlaygroundRevealConfig({ type: "spiral" } as never).type).toBe("wave");
  });

  it("resolves duration from the active type", () => {
    const wave = normalizePlaygroundRevealConfig({ type: "wave", wave: { durationMs: 1200 } } as never);
    const assembly = normalizePlaygroundRevealConfig({
      type: "assembly",
      assembly: { staggerMs: 1500, speedMaxMs: 2200 },
    } as never);
    expect(resolvePlaygroundRevealDurationMs(wave)).toBe(1200);
    expect(resolvePlaygroundRevealDurationMs(assembly)).toBe(3700);
  });

  it("treats an assembly config as non-default", () => {
    const assembly = normalizePlaygroundRevealConfig({ type: "assembly" } as never);
    expect(isDefaultPlaygroundRevealConfig(assembly)).toBe(false);
  });

  it("rounds fractional ms fields to integers", () => {
    const normalized = normalizePlaygroundRevealConfig({
      type: "assembly",
      assembly: { speedMinMs: 810.7, speedMaxMs: 3999.4, staggerMs: 2000.6 },
    } as never);
    expect(normalized.assembly.speedMinMs).toBe(811);
    expect(normalized.assembly.speedMaxMs).toBe(3999);
    expect(normalized.assembly.staggerMs).toBe(2001);
  });
});
