import { describe, it, expect } from "vitest";
import { addPreset, removePreset, type ConfigPreset } from "./presets";
import type { EngineConfig } from "@necatikcl/stripes-engine";

const cfg = (tag: string): EngineConfig => ({ tag }) as unknown as EngineConfig;

const preset = (name: string, tag = name): ConfigPreset => ({
  name,
  config: cfg(tag),
});

describe("preset library transforms", () => {
  it("addPreset appends a new preset", () => {
    const next = addPreset([preset("a")], preset("b"));
    expect(next.map((p) => p.name)).toEqual(["a", "b"]);
  });

  it("addPreset overwrites a preset with the same name", () => {
    const next = addPreset([preset("a", "old")], preset("a", "new"));
    expect(next).toHaveLength(1);
    expect((next[0].config as unknown as { tag: string }).tag).toBe("new");
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
