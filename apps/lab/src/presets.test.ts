import { describe, it, expect } from "vitest";
import { addPreset, createPreset, findPresetByName, removePreset, type ConfigPreset } from "./presets";
import type { EngineConfig } from "@necatikcl/stripes-engine";

const cfg = (tag: string): EngineConfig => ({ tag }) as unknown as EngineConfig;

const preset = (name: string, tag = name): ConfigPreset => createPreset(name, cfg(tag));

const presetWithLab = (name: string): ConfigPreset =>
  createPreset(name, cfg(name), {
    backgroundFillMode: "gradient",
    stripePalette: "Background Ramp",
    backgroundRampEasing: "custom:0.1,0,0.2,1",
    thresholdDistributionEasing: "easeOutQuad",
    drawerOpen: { Stripes: true },
    twizzlerEnabled: true,
    twizzler: {
      color: "#d71920",
      opacity: 0.7,
      scale: 0.6,
      centerY: 0.4,
      amplitude: 0.3,
      lineCount: 80,
      lineWidth: 1.5,
      pointSpacing: 16,
      leftHeight: 0.25,
      rightHeight: 0.75,
      edgeFluctuation: 0.1,
      edgeSpeed: 0.5,
      edgeTaper: 0.2,
      wrinkles: 5,
      wrinkleStrength: 0.08,
      bendPosition: 0.65,
      bendAmount: -0.2,
      twist: 1.5,
      noiseScaleX: 0.002,
      noiseScaleY: 0.015,
      speed: 0,
      drift: 0.2,
    },
    twizzlerMap: {
      backgroundLevel: 0.06,
      ribbonLevel: 0.58,
      shoulderLevel: 0.01,
      shoulderWidth: 9,
      topOffsetPx: 0,
      bottomOffsetPx: 0,
      topSpread: 1,
      bottomSpread: 1,
      flowEnabled: true,
      flowDirection: "topToBottom",
      flowAmplitude: 0.32,
      flowSpeed: 1.2,
      flowSpacing: 0.12,
      flowBandWidth: 0.04,
      flowSoftness: 0.5,
      flowOpacity: 0.6,
      flowPhase: 0.2,
    },
  });

describe("preset library transforms", () => {
  it("finds the startup default preset case-insensitively", () => {
    expect(findPresetByName([preset("Alternate"), preset("Default")], "default")?.name).toBe("Default");
  });
  it("addPreset appends a new preset", () => {
    const next = addPreset([preset("a")], preset("b"));
    expect(next.map((p) => p.name)).toEqual(["a", "b"]);
  });

  it("addPreset overwrites a preset with the same name", () => {
    const next = addPreset([preset("a", "old")], preset("a", "new"));
    expect(next).toHaveLength(1);
    expect((next[0].config as unknown as { tag: string }).tag).toBe("new");
  });

  it("addPreset preserves full lab UI settings on presets", () => {
    const next = addPreset([], presetWithLab("full"));

    expect(next[0]).toMatchObject({ kind: "stripes-engine-lab-settings", version: 2 });
    expect(next[0].lab).toMatchObject({
      backgroundFillMode: "gradient",
      stripePalette: "Background Ramp",
      backgroundRampEasing: "custom:0.1,0,0.2,1",
      thresholdDistributionEasing: "easeOutQuad",
      drawerOpen: { Stripes: true },
      twizzlerEnabled: true,
      twizzler: { color: "#d71920", speed: 0, wrinkles: 5 },
      twizzlerMap: { flowDirection: "topToBottom", flowAmplitude: 0.32, shoulderWidth: 9 },
    });
  });

  it("removePreset drops the matching name", () => {
    const next = removePreset([preset("a"), preset("b")], "a");
    expect(next.map((p) => p.name)).toEqual(["b"]);
  });

  it("transforms do not mutate the input array", () => {
    const input = [preset("a")];
    addPreset(input, preset("b"));
    removePreset(input, "a");
    expect(input.map((p) => p.name)).toEqual(["a"]);
  });
});
