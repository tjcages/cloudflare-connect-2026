import { describe, it, expect } from "vitest";
import {
  addPreset,
  createPreset,
  findPresetByName,
  loadBuiltinPresets,
  mergePresets,
  removePreset,
  type ConfigPreset,
} from "./presets";
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
      bend2Position: 0.3,
      bend2Amount: 0,
      bend3Position: 0.75,
      bend3Amount: 0,
      depthPosition: 0.65,
      depthAmount: 0,
      depthWidth: 0.25,
      depth2Position: 0.35,
      depth2Amount: 0,
      depth2Width: 0.25,
      depthSpread: 0,
      depthLift: 0,
      heatVariant: 1,
      hillRhythm: 1,
      packGapRatio: 4,
      yPerspective: 1.35,
      depthTerrain: 0,
      twist: 1.5,
      noiseScaleX: 0.002,
      noiseScaleY: 0.015,
      speed: 0,
      drift: 0.2,
      colorFar: "#ffd2b5",
      colorNear: "#d71920",
      colorEdge: "#ffe08a",
      stippleSize: 1.4,
      stippleGap: 2.2,
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

  it("removePreset keeps builtin presets", () => {
    const builtin = createPreset("Banner 5:1", cfg("banner"), undefined, true);
    const next = removePreset([builtin, preset("user")], "Banner 5:1");
    expect(next.map((p) => p.name)).toEqual(["Banner 5:1", "user"]);
  });

  it("mergePresets lets builtin names win over stored copies", () => {
    const builtin = createPreset("Banner 5:1", cfg("builtin"), undefined, true);
    const stored = createPreset("Banner 5:1", cfg("stored"));
    const merged = mergePresets([builtin], [stored, preset("user")]);
    const banner = findPresetByName(merged, "Banner 5:1");
    expect(banner?.builtin).toBe(true);
    expect((banner?.config as unknown as { tag: string } | undefined)?.tag).toBe("builtin");
  });

  it("loads the Banner 5:1 builtin preset from disk", () => {
    const builtins = loadBuiltinPresets();
    const banner = findPresetByName(builtins, "Banner 5:1");
    expect(banner?.builtin).toBe(true);
    expect(banner?.lab?.canvasWidth).toBe(1600);
    expect(banner?.lab?.canvasHeight).toBe(320);
    expect(banner?.lab?.shaderPresetId).toBe("twizzler-map");
    expect(banner?.lab?.twizzlerEnabled).toBe(true);
  });

  it("transforms do not mutate the input array", () => {
    const input = [preset("a")];
    addPreset(input, preset("b"));
    removePreset(input, "a");
    expect(input.map((p) => p.name)).toEqual(["a"]);
  });
});
