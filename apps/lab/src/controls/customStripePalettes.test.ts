import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  clearCustomStripePalettes,
  customStripePaletteIdFromValue,
  customStripePaletteValue,
  findCustomStripePalette,
  loadCustomStripePalettes,
  saveCustomStripePalettes,
  upsertCustomStripePalette,
} from "./customStripePalettes";

const storage = new Map<string, string>();

beforeEach(() => {
  storage.clear();
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => storage.set(key, value),
    removeItem: (key: string) => storage.delete(key),
  });
});

describe("custom stripe palettes", () => {
  it("creates a palette with separate light and dark colors", () => {
    const result = upsertCustomStripePalette([], {
      name: "Cloudflare",
      light: ["#F46021", "#FFFFFF"],
      dark: ["#922D18", "#1F1F1F"],
    });

    expect(result?.palette).toEqual({
      id: "cloudflare",
      name: "Cloudflare",
      light: ["#f46021", "#ffffff"],
      dark: ["#922d18", "#1f1f1f"],
    });
    expect(customStripePaletteIdFromValue(customStripePaletteValue(result!.palette.id))).toBe("cloudflare");
    expect(findCustomStripePalette(result!.palettes, customStripePaletteValue("cloudflare"))).toEqual(result?.palette);
  });

  it("updates a same-name palette without duplicating it", () => {
    const first = upsertCustomStripePalette([], {
      name: "My Palette",
      light: ["#111111"],
      dark: ["#222222"],
    })!;
    const updated = upsertCustomStripePalette(first.palettes, {
      name: "my palette",
      light: ["#333333"],
      dark: ["#444444"],
    })!;

    expect(updated.palettes).toHaveLength(1);
    expect(updated.palette.id).toBe(first.palette.id);
    expect(updated.palette.light).toEqual(["#333333"]);
    expect(updated.palette.dark).toEqual(["#444444"]);
  });

  it("persists, sanitizes, and clears the palette library", () => {
    const result = upsertCustomStripePalette([], {
      name: "Saved",
      light: ["#abcdef"],
      dark: [],
    })!;

    saveCustomStripePalettes(result.palettes);
    expect(loadCustomStripePalettes()).toEqual([
      {
        id: "saved",
        name: "Saved",
        light: ["#abcdef"],
        dark: ["#abcdef"],
      },
    ]);

    clearCustomStripePalettes();
    expect(loadCustomStripePalettes()).toEqual([]);
  });
});
