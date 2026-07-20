import { describe, it, expect } from "vitest";
import { normalizeEngineConfig } from "./config/normalize";
import type { EngineConfig } from "./config/types";

function topologyKey(cfg: EngineConfig): string {
  const revealKind = !cfg.reveal.enabled
    ? "none"
    : cfg.reveal.type === "wave"
      ? "wave"
      : cfg.reveal.type === "assembly"
        ? "scatter"
        : cfg.reveal.type === "vortex"
          ? "vortex"
          : "warp";
  return `${cfg.stripesEnabled}:${revealKind}:${cfg.flames.enabled}`;
}

function needsRebuild(prev: EngineConfig, next: EngineConfig): boolean {
  return topologyKey(prev) !== topologyKey(next);
}

describe("setConfig topology gating", () => {
  it("param-only changes (stripes, adjustments) do not trigger rebuild", () => {
    const a = normalizeEngineConfig({ adjustments: { brightness: 0.1 } });
    const b = normalizeEngineConfig({ adjustments: { brightness: 0.5 } });
    expect(needsRebuild(a, b)).toBe(false);
  });

  it("progress-only change (same topology) does not trigger rebuild", () => {
    const a = normalizeEngineConfig({ reveal: { enabled: true, type: "wave" } });
    const b = normalizeEngineConfig({ reveal: { enabled: true, type: "wave", wave: { softness: 0.3 } } });
    expect(needsRebuild(a, b)).toBe(false);
  });

  it("flipping reveal.enabled triggers rebuild", () => {
    const off = normalizeEngineConfig({ reveal: { enabled: false } });
    const on = normalizeEngineConfig({ reveal: { enabled: true, type: "wave" } });
    expect(needsRebuild(off, on)).toBe(true);
    expect(needsRebuild(on, off)).toBe(true);
  });

  it("switching reveal.type between wave and assembly triggers rebuild", () => {
    const wave = normalizeEngineConfig({ reveal: { enabled: true, type: "wave" } });
    const assembly = normalizeEngineConfig({ reveal: { enabled: true, type: "assembly" } });
    expect(needsRebuild(wave, assembly)).toBe(true);
    expect(needsRebuild(assembly, wave)).toBe(true);
  });

  it("flipping flames.enabled triggers rebuild", () => {
    const off = normalizeEngineConfig({ flames: { enabled: false } });
    const on = normalizeEngineConfig({ flames: { enabled: true } });
    expect(needsRebuild(off, on)).toBe(true);
    expect(needsRebuild(on, off)).toBe(true);
  });

  it("flames param-only change (same enabled) does not trigger rebuild", () => {
    const a = normalizeEngineConfig({ flames: { enabled: true, baseSpeedPxPerSec: 100 } });
    const b = normalizeEngineConfig({ flames: { enabled: true, baseSpeedPxPerSec: 200 } });
    expect(needsRebuild(a, b)).toBe(false);
  });

  it("toggling stripesEnabled triggers rebuild", () => {
    const on = normalizeEngineConfig({ stripesEnabled: true });
    const off = normalizeEngineConfig({ stripesEnabled: false });
    expect(needsRebuild(on, off)).toBe(true);
    expect(needsRebuild(off, on)).toBe(true);
  });

  it("same topology repeated does not trigger rebuild", () => {
    const a = normalizeEngineConfig({ reveal: { enabled: true, type: "assembly" } });
    const b = normalizeEngineConfig({
      reveal: { enabled: true, type: "assembly", assembly: { staggerMs: 1234 } },
    });
    expect(needsRebuild(a, b)).toBe(false);
  });

  it("reveal disabled → wave enabled is ONE rebuild; wave → assembly is ANOTHER", () => {
    const disabled = normalizeEngineConfig({});
    const wave = normalizeEngineConfig({ reveal: { enabled: true, type: "wave" } });
    const assembly = normalizeEngineConfig({ reveal: { enabled: true, type: "assembly" } });
    expect(needsRebuild(disabled, wave)).toBe(true);
    expect(needsRebuild(wave, assembly)).toBe(true);
    expect(needsRebuild(assembly, assembly)).toBe(false);
  });

  it("switching wave <-> turbulence triggers rebuild", () => {
    const wave = normalizeEngineConfig({ reveal: { enabled: true, type: "wave" } });
    const turbulence = normalizeEngineConfig({ reveal: { enabled: true, type: "turbulence" } });
    expect(needsRebuild(wave, turbulence)).toBe(true);
    expect(needsRebuild(turbulence, wave)).toBe(true);
  });

  it("switching assembly <-> glitch triggers rebuild", () => {
    const assembly = normalizeEngineConfig({ reveal: { enabled: true, type: "assembly" } });
    const glitch = normalizeEngineConfig({ reveal: { enabled: true, type: "glitch" } });
    expect(needsRebuild(assembly, glitch)).toBe(true);
    expect(needsRebuild(glitch, assembly)).toBe(true);
  });

  it("switching vortex <-> glitch triggers rebuild", () => {
    const vortex = normalizeEngineConfig({ reveal: { enabled: true, type: "vortex" } });
    const glitch = normalizeEngineConfig({ reveal: { enabled: true, type: "glitch" } });
    expect(needsRebuild(vortex, glitch)).toBe(true);
    expect(needsRebuild(glitch, vortex)).toBe(true);
  });

  it("fluid is an invalid type and normalizes to assembly (no topology change vs assembly)", () => {
    const fluid = normalizeEngineConfig({ reveal: { enabled: true, type: "fluid" as never } });
    const assembly = normalizeEngineConfig({ reveal: { enabled: true, type: "assembly" } });
    expect(fluid.reveal.type).toBe("assembly");
    expect(needsRebuild(fluid, assembly)).toBe(false);
  });

  it("turbulence <-> glitch and param changes do not trigger rebuild", () => {
    const a = normalizeEngineConfig({
      reveal: { enabled: true, type: "turbulence", turbulence: { intensity: 0.5 } },
    });
    const b = normalizeEngineConfig({
      reveal: { enabled: true, type: "glitch", glitch: { intensity: 2 } },
    });
    expect(needsRebuild(a, b)).toBe(false);
  });

  it("switching flames.direction between linear directions does not trigger a topology rebuild (particle-pool reset only)", () => {
    const up = normalizeEngineConfig({ flames: { enabled: true, direction: "up" } });
    const left = normalizeEngineConfig({ flames: { enabled: true, direction: "left" } });
    expect(needsRebuild(up, left)).toBe(false);
    expect(needsRebuild(left, up)).toBe(false);
  });
});
