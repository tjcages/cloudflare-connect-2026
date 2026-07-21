import { describe, expect, it } from "vitest";
import { normalizeEngineConfig } from "./normalize";
import { diffEngineConfig, resolveThemedConfig, sanitizeThemedConfig } from "./theme";
import type { ThemedEngineConfig } from "./theme";

describe("resolveThemedConfig", () => {
  it("returns the config unchanged (minus dark) for light", () => {
    const themed: ThemedEngineConfig = { stripesEnabled: false, dark: { stripesEnabled: true } };
    expect(resolveThemedConfig(themed, "light")).toEqual({ stripesEnabled: false });
    expect(resolveThemedConfig(themed)).toEqual({ stripesEnabled: false });
  });

  it("deep-merges dark over the base without touching sibling fields", () => {
    const themed: ThemedEngineConfig = {
      background: { transparent: true, color: 0xffffff, gradient: { enabled: false } } as never,
      dark: { background: { color: 0x111111 } },
    };
    const resolved = resolveThemedConfig(themed, "dark");
    expect(resolved.background).toMatchObject({ transparent: true, color: 0x111111 });
  });

  it("replaces arrays atomically", () => {
    const themed: ThemedEngineConfig = {
      renderParams: [0.1, 0.2, 0.3, 0.4],
      dark: { renderParams: [0.9, 0.9, 0.9, 0.9] },
    };
    expect(resolveThemedConfig(themed, "dark").renderParams).toEqual([0.9, 0.9, 0.9, 0.9]);
  });

  it("does not mutate its input", () => {
    const themed: ThemedEngineConfig = { background: { color: 1 } as never, dark: { background: { color: 2 } } };
    const snapshot = JSON.stringify(themed);
    resolveThemedConfig(themed, "dark");
    expect(JSON.stringify(themed)).toBe(snapshot);
  });
});

describe("diffEngineConfig", () => {
  it("returns an empty diff for identical configs", () => {
    const base = normalizeEngineConfig();
    expect(diffEngineConfig(base, normalizeEngineConfig())).toEqual({});
  });

  it("emits only changed leaves, atomically for arrays", () => {
    const base = normalizeEngineConfig();
    const edited = normalizeEngineConfig({
      ...base,
      background: { ...base.background, color: 0x123456 },
      stripes: base.stripes.map((s, i) => (i === 0 ? { ...s, color: 0xff0000 } : s)),
    });
    const diff = diffEngineConfig(base, edited);
    expect(diff).toEqual({
      background: { color: 0x123456 },
      stripes: edited.stripes,
    });
  });

  it("round-trips: merge(base, diff(base, edited)) equals edited", () => {
    const base = normalizeEngineConfig();
    const edited = normalizeEngineConfig({
      ...base,
      stripesEnabled: false,
      renderColorA: 0xabcdef,
      colors: { ...base.colors, mode: "colors" },
      reveal: { ...base.reveal, type: "water" },
    });
    const diff = diffEngineConfig(base, edited);
    const merged = resolveThemedConfig({ ...base, dark: diff }, "dark");
    expect(normalizeEngineConfig(merged)).toEqual(edited);
  });
});

describe("sanitizeThemedConfig", () => {
  it("normalizes the base and re-derives a sparse dark diff", () => {
    const input: ThemedEngineConfig = {
      stripesEnabled: false,
      dark: { renderColorA: 0x101010, junk: true } as never,
    };
    const out = sanitizeThemedConfig(input);
    expect(out.stripesEnabled).toBe(false);
    expect(out.dark).toEqual({ renderColorA: 0x101010 });
  });

  it("drops an empty or no-op dark entirely", () => {
    expect(sanitizeThemedConfig({ dark: {} })).not.toHaveProperty("dark");
    expect(sanitizeThemedConfig({ stripesEnabled: true, dark: { stripesEnabled: true } })).not.toHaveProperty("dark");
  });
});

describe("normalizeEngineConfig with a themed input", () => {
  it("strips dark (unknown keys never reach the engine)", () => {
    const out = normalizeEngineConfig({ dark: { stripesEnabled: false } } as never);
    expect(out).not.toHaveProperty("dark");
    expect(out.stripesEnabled).toBe(true);
  });
});
