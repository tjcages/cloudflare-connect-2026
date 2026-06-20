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
      assembly: { order: "sweep", from: "edge", durationMs: 999, spread: 5, glowSize: 1, flight: 9, overshoot: true },
    } as never);
    expect(normalized.type).toBe("assembly");
    expect(normalized.assembly.order).toBe("sweep");
    expect(normalized.assembly.from).toBe("edge");
    expect(normalized.assembly.durationMs).toBe(999);
    expect(normalized.assembly.spread).toBe(1); // clamped 0..1
    expect(normalized.assembly.glowSize).toBe(4); // clamped to min
    expect(normalized.assembly.flight).toBe(0.6); // clamped to max
    expect(normalized.assembly.overshoot).toBe(true);
  });

  it("falls back to defaults for unknown order/from", () => {
    const normalized = normalizePlaygroundRevealConfig({
      type: "assembly",
      assembly: { order: "nope", from: "bogus" },
    } as never);
    expect(normalized.assembly.order).toBe("center");
    expect(normalized.assembly.from).toBe("scatter");
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
});
