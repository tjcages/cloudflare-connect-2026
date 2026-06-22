import { describe, expect, test, it } from "vitest";
import {
  ASSEMBLY_ORDER_TO_INDEX,
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
      assembly: { order: "sweep", durationMs: 999, spread: 5, speedMinMs: 50, speedMaxMs: 200 },
    } as never);
    expect(normalized.type).toBe("assembly");
    expect(normalized.assembly.order).toBe("sweep");
    expect(normalized.assembly.durationMs).toBe(999);
    expect(normalized.assembly.spread).toBe(1); // clamped 0..1
    expect(normalized.assembly.speedMinMs).toBe(100); // clamped to min 100
    expect(normalized.assembly.speedMaxMs).toBe(200);
  });

  it("forces speed max to be at least speed min", () => {
    const normalized = normalizePlaygroundRevealConfig({
      type: "assembly",
      assembly: { speedMinMs: 3000, speedMaxMs: 500 },
    } as never);
    expect(normalized.assembly.speedMinMs).toBe(3000);
    expect(normalized.assembly.speedMaxMs).toBe(3000);
  });

  it("ignores legacy assembly fields (from/glowSize/flight/overshoot)", () => {
    const normalized = normalizePlaygroundRevealConfig({
      type: "assembly",
      assembly: { from: "edge", glowSize: 12, flight: 0.4, overshoot: true } as never,
    } as never);
    expect(normalized.assembly).toEqual(DEFAULT_PLAYGROUND_REVEAL_CONFIG.assembly);
  });

  it("falls back to defaults for unknown order", () => {
    const normalized = normalizePlaygroundRevealConfig({
      type: "assembly",
      assembly: { order: "nope" },
    } as never);
    expect(normalized.assembly.order).toBe("center");
  });

  it("rejects an unknown reveal type", () => {
    expect(normalizePlaygroundRevealConfig({ type: "spiral" } as never).type).toBe("wave");
  });

  it("resolves duration from the active type", () => {
    const wave = normalizePlaygroundRevealConfig({ type: "wave", wave: { durationMs: 1200 } } as never);
    const assembly = normalizePlaygroundRevealConfig({ type: "assembly", assembly: { durationMs: 3400 } } as never);
    expect(resolvePlaygroundRevealDurationMs(wave)).toBe(1200);
    expect(resolvePlaygroundRevealDurationMs(assembly)).toBe(3400);
  });

  it("treats an assembly config as non-default", () => {
    const assembly = normalizePlaygroundRevealConfig({ type: "assembly" } as never);
    expect(isDefaultPlaygroundRevealConfig(assembly)).toBe(false);
  });

  it("maps order names to stable shader indices", () => {
    expect(ASSEMBLY_ORDER_TO_INDEX).toEqual({ center: 0, edges: 1, sweep: 2, random: 3 });
  });

  it("rounds fractional ms fields to integers", () => {
    const normalized = normalizePlaygroundRevealConfig({
      type: "assembly",
      assembly: { speedMinMs: 810.7, speedMaxMs: 3999.4 },
    } as never);
    expect(normalized.assembly.speedMinMs).toBe(811);
    expect(normalized.assembly.speedMaxMs).toBe(3999);
  });
});
