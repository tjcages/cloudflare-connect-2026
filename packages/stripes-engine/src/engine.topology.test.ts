import { describe, it, expect } from "vitest";
import { normalizeEngineConfig } from "./config/normalize";
import type { EngineConfig } from "./config/types";

function topologyKey(cfg: EngineConfig): string {
  const assemblyTopo = cfg.reveal.enabled && cfg.reveal.type === "assembly";
  return `${cfg.stripesEnabled}:${cfg.reveal.enabled}:${assemblyTopo}:${cfg.flames.enabled}`;
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
    const b = normalizeEngineConfig({ reveal: { enabled: true, type: "assembly", assembly: { staggerMs: 1234 } } });
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
});
