import { describe, expect, it } from "vitest";

import {
  COLOR_PRESET_CUSTOM_ID,
  findColorPreset,
  mergeColorPresetLists,
  normalizeColorPreset,
  normalizeColorPresets,
  resolveColorPresetId,
  type PlaygroundColorPreset,
} from "./playgroundColorPresets";
import { normalizeStripe, type Stripe } from "./stripeColors";

function stripe(hex: string, startFrom: number, width: number): Stripe {
  return normalizeStripe({ hex, startFrom, width });
}

function preset(overrides: Partial<PlaygroundColorPreset> = {}): PlaygroundColorPreset {
  return {
    id: "p1",
    label: "Sunset",
    stripes: [stripe("#102030", 0, 3), stripe("#EB5729", 0.5, 4)],
    createdAt: 1,
    ...overrides,
  };
}

describe("normalizeColorPreset", () => {
  it("drops entries without stripes", () => {
    expect(normalizeColorPreset({ id: "x", label: "Empty", stripes: [] })).toBeNull();
    expect(normalizeColorPreset(null)).toBeNull();
  });

  it("fills missing id, label, and createdAt", () => {
    const normalized = normalizeColorPreset({ stripes: [{ hex: "#FFFFFF", startFrom: 0, width: 2 }] });
    expect(normalized).not.toBeNull();
    expect(normalized!.id.length).toBeGreaterThan(0);
    expect(normalized!.label).toBe("Color preset");
    expect(typeof normalized!.createdAt).toBe("number");
  });

  it("keeps overlay stripes only when present and non-empty", () => {
    const withOverlay = normalizeColorPreset({
      stripes: [{ hex: "#000000", startFrom: 0, width: 2 }],
      overlayStripes: [{ hex: "#111111", startFrom: 0.9, width: 5 }],
    });
    expect(withOverlay!.overlayStripes).toHaveLength(1);
    const withoutOverlay = normalizeColorPreset({
      stripes: [{ hex: "#000000", startFrom: 0, width: 2 }],
      overlayStripes: [],
    });
    expect(withoutOverlay!.overlayStripes).toBeUndefined();
  });
});

describe("normalizeColorPresets", () => {
  it("dedupes by id and drops invalid entries", () => {
    const list = normalizeColorPresets([
      preset({ id: "a" }),
      preset({ id: "a", label: "dupe" }),
      { id: "b", label: "no stripes", stripes: [] },
      preset({ id: "c" }),
    ]);
    expect(list.map((entry) => entry.id)).toEqual(["a", "c"]);
  });
});

describe("findColorPreset / resolveColorPresetId", () => {
  it("matches on stripe color, threshold, and width regardless of hex case", () => {
    const presets = [preset({ id: "a" })];
    const stripes = [stripe("#102030", 0, 3), stripe("#eb5729", 0.5, 4)];
    expect(findColorPreset(presets, stripes, [])?.id).toBe("a");
    expect(resolveColorPresetId(presets, stripes, [])).toBe("a");
  });

  it("returns custom when nothing matches", () => {
    const presets = [preset({ id: "a" })];
    expect(resolveColorPresetId(presets, [stripe("#000000", 0, 1)], [])).toBe(COLOR_PRESET_CUSTOM_ID);
  });

  it("requires overlay stripes to match when the preset stored them", () => {
    const overlay = [stripe("#abcdef", 0.9, 6)];
    const presets = [preset({ id: "a", overlayStripes: overlay })];
    const stripes = [stripe("#102030", 0, 3), stripe("#EB5729", 0.5, 4)];
    expect(findColorPreset(presets, stripes, [])).toBeUndefined();
    expect(findColorPreset(presets, stripes, overlay)?.id).toBe("a");
  });
});

describe("mergeColorPresetLists", () => {
  it("replaces by id and appends new entries", () => {
    const existing = [preset({ id: "a", label: "old" })];
    const incoming = [preset({ id: "a", label: "new" }), preset({ id: "b", label: "fresh" })];
    const merged = mergeColorPresetLists(existing, incoming);
    expect(merged.map((entry) => `${entry.id}:${entry.label}`)).toEqual(["a:new", "b:fresh"]);
  });

  it("skips duplicate palettes imported under a different id", () => {
    const existing = [preset({ id: "a", label: "Sunset" })];
    const incoming = [preset({ id: "z", label: "Sunset" })];
    expect(mergeColorPresetLists(existing, incoming)).toHaveLength(1);
  });
});
