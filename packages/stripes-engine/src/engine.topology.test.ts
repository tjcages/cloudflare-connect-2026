import { describe, it, expect } from "vitest";
import { normalizeEngineConfig } from "./config/normalize";
import { constellationCaps } from "./cursorTrail/constellationSim";
import { meteorsCaps } from "./meteors/meteorsSim";
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
          : cfg.reveal.type === "water"
            ? "water"
            : "warp";
  const caps =
    cfg.cursorTrail.enabled && cfg.cursorTrail.type === "constellation"
      ? constellationCaps(cfg.cursorTrail.constellation)
      : null;
  const trailKey = `${cfg.cursorTrail.enabled}:${cfg.cursorTrail.type}:${
    caps ? `${caps.maxStars}|${caps.maxLinks}|${caps.maxPulses}` : "off"
  }`;
  const meteorsKey = cfg.background.meteors.enabled ? String(meteorsCaps(cfg.background.meteors).maxActive) : "off";
  return `${cfg.stripesEnabled}:${revealKind}:${cfg.flames.enabled}:${trailKey}:${meteorsKey}`;
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

  it("switching water <-> wave triggers rebuild", () => {
    const water = normalizeEngineConfig({ reveal: { enabled: true, type: "water" } });
    const wave = normalizeEngineConfig({ reveal: { enabled: true, type: "wave" } });
    expect(needsRebuild(water, wave)).toBe(true);
    expect(needsRebuild(wave, water)).toBe(true);
  });

  it("switching water <-> glitch triggers rebuild", () => {
    const water = normalizeEngineConfig({ reveal: { enabled: true, type: "water" } });
    const glitch = normalizeEngineConfig({ reveal: { enabled: true, type: "glitch" } });
    expect(needsRebuild(water, glitch)).toBe(true);
    expect(needsRebuild(glitch, water)).toBe(true);
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

  it("switching cursorTrail.type to constellation triggers rebuild", () => {
    const dflt = normalizeEngineConfig({ cursorTrail: { enabled: true, type: "default" } });
    const web = normalizeEngineConfig({ cursorTrail: { enabled: true, type: "constellation" } });
    expect(needsRebuild(dflt, web)).toBe(true);
    expect(needsRebuild(web, dflt)).toBe(true);
  });

  it("constellation style params do not trigger rebuild, but caps do", () => {
    const thin = normalizeEngineConfig({
      cursorTrail: { enabled: true, type: "constellation", constellation: { linkThicknessPx: 0.6 } },
    });
    const thick = normalizeEngineConfig({
      cursorTrail: { enabled: true, type: "constellation", constellation: { linkThicknessPx: 6 } },
    });
    const capped = normalizeEngineConfig({
      cursorTrail: { enabled: true, type: "constellation", constellation: { maxLinks: 24 } },
    });
    expect(needsRebuild(thin, thick)).toBe(false);
    expect(needsRebuild(thin, capped)).toBe(true);
  });

  it("toggling background meteors triggers rebuild", () => {
    const off = normalizeEngineConfig({});
    const on = normalizeEngineConfig({ background: { meteors: { enabled: true } } });
    expect(needsRebuild(off, on)).toBe(true);
    expect(needsRebuild(on, off)).toBe(true);
  });

  it("meteor style params do not trigger rebuild, but maxActive does", () => {
    const soft = normalizeEngineConfig({ background: { meteors: { enabled: true, pushPx: 2 } } });
    const hard = normalizeEngineConfig({
      background: { meteors: { enabled: true, pushPx: 18, ratePerSec: 40, brightness: 2 } },
    });
    const capped = normalizeEngineConfig({ background: { meteors: { enabled: true, maxActive: 12 } } });
    expect(needsRebuild(soft, hard)).toBe(false);
    expect(needsRebuild(soft, capped)).toBe(true);
  });
});
