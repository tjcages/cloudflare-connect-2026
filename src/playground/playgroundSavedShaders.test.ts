import { describe, expect, it } from "vitest";
import {
  findSavedShaderBySource,
  mergeSavedShaderLists,
  normalizeSavedShader,
  normalizeSavedShaderLabel,
  normalizeSavedShaders,
  parseSavedShaderPresetId,
  savedShaderPresetId,
  SAVED_SHADER_LABEL_MAX_LENGTH,
  type PlaygroundSavedShader,
} from "./playgroundSavedShaders";

function shader(overrides: Partial<PlaygroundSavedShader> = {}): PlaygroundSavedShader {
  return { id: "a", label: "A", source: "void mainImage(){}", createdAt: 1, ...overrides };
}

describe("savedShaderPresetId", () => {
  it("namespaces ids and round-trips them", () => {
    expect(savedShaderPresetId("abc")).toBe("saved:abc");
    expect(parseSavedShaderPresetId("saved:abc")).toBe("abc");
    expect(parseSavedShaderPresetId("waveforms")).toBeNull();
    expect(parseSavedShaderPresetId("custom")).toBeNull();
  });
});

describe("normalizeSavedShaderLabel", () => {
  it("falls back to a default and trims/clamps long labels", () => {
    expect(normalizeSavedShaderLabel("")).toBe("Saved shader");
    expect(normalizeSavedShaderLabel("   ")).toBe("Saved shader");
    expect(normalizeSavedShaderLabel("  My   Shader  ")).toBe("My Shader");
    expect(normalizeSavedShaderLabel("x".repeat(200))).toHaveLength(SAVED_SHADER_LABEL_MAX_LENGTH);
  });
});

describe("normalizeSavedShader", () => {
  it("rejects entries without usable source", () => {
    expect(normalizeSavedShader(null)).toBeNull();
    expect(normalizeSavedShader({ label: "x", source: "   " })).toBeNull();
  });

  it("backfills missing id, label, and createdAt", () => {
    const result = normalizeSavedShader({ source: "void mainImage(){}" });
    expect(result).not.toBeNull();
    expect(result!.id.length).toBeGreaterThan(0);
    expect(result!.label).toBe("Saved shader");
    expect(Number.isFinite(result!.createdAt)).toBe(true);
  });
});

describe("normalizeSavedShaders", () => {
  it("drops invalid entries and de-duplicates ids", () => {
    const list = normalizeSavedShaders([
      shader({ id: "a", source: "one" }),
      shader({ id: "a", source: "dup-id" }),
      { source: "" },
      "nope",
    ]);
    expect(list.map((entry) => entry.id)).toEqual(["a"]);
    expect(list[0]?.source).toBe("one");
  });

  it("returns an empty array for non-arrays", () => {
    expect(normalizeSavedShaders(undefined)).toEqual([]);
    expect(normalizeSavedShaders({})).toEqual([]);
  });
});

describe("mergeSavedShaderLists", () => {
  it("replaces by id and appends genuinely new entries", () => {
    const existing = [shader({ id: "a", label: "A", source: "one" })];
    const incoming = [
      shader({ id: "a", label: "A renamed", source: "one" }),
      shader({ id: "b", label: "B", source: "two" }),
    ];
    const merged = mergeSavedShaderLists(existing, incoming);
    expect(merged.map((entry) => entry.id)).toEqual(["a", "b"]);
    expect(merged[0]?.label).toBe("A renamed");
  });

  it("skips incoming entries that duplicate an existing label+source under a new id", () => {
    const existing = [shader({ id: "a", label: "A", source: "one" })];
    const incoming = [shader({ id: "z", label: "A", source: "one" })];
    const merged = mergeSavedShaderLists(existing, incoming);
    expect(merged.map((entry) => entry.id)).toEqual(["a"]);
  });
});

describe("findSavedShaderBySource", () => {
  it("matches ignoring surrounding whitespace", () => {
    const list = [shader({ id: "a", source: "void mainImage(){}" })];
    expect(findSavedShaderBySource(list, "\n void mainImage(){} \n")?.id).toBe("a");
    expect(findSavedShaderBySource(list, "different")).toBeUndefined();
  });
});
