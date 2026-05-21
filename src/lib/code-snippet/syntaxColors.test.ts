import { describe, expect, it } from "vitest";
import { getCodeSnippetSyntaxColors } from "./syntaxColors";

describe("getCodeSnippetSyntaxColors", () => {
  it("uses palette theme fill for accent and paired theme for strings", () => {
    const orange = getCodeSnippetSyntaxColors("orange");
    expect(orange.accentHex).toBe("#FF4802");
    expect(orange.stringHex).toBe("#9C37FF");
    expect(orange.mutedHex).toBe("#B3B3B3");
  });

  it("swaps accent and string for purple theme", () => {
    const purple = getCodeSnippetSyntaxColors("purple");
    expect(purple.accentHex).toBe("#9C37FF");
    expect(purple.stringHex).toBe("#FF4802");
  });
});
