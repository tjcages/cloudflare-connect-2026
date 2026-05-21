import { describe, expect, it } from "vitest";
import { formatCodeSnippet, resolvePrettierParser } from "./formatCode";

describe("resolvePrettierParser", () => {
  it("maps explicit languages", () => {
    expect(resolvePrettierParser("javascript", "")).toBe("babel");
    expect(resolvePrettierParser("typescript", "")).toBe("typescript");
    expect(resolvePrettierParser("json", "")).toBe("json");
    expect(resolvePrettierParser("bash", "")).toBeNull();
    expect(resolvePrettierParser("text", "")).toBeNull();
  });

  it("infers json and typescript for auto", () => {
    expect(resolvePrettierParser("auto", '{"a":1}')).toBe("json");
    expect(resolvePrettierParser("auto", "type Foo = { x: number }")).toBe("typescript");
    expect(resolvePrettierParser("auto", "const x = 1")).toBe("babel");
  });
});

describe("formatCodeSnippet", () => {
  it("formats javascript on paste-like input", async () => {
    const formatted = await formatCodeSnippet("const x=1", "javascript");
    expect(formatted).toContain("const x = 1");
  });

  it("returns original code when parser unavailable", async () => {
    const raw = "echo hello";
    expect(await formatCodeSnippet(raw, "bash")).toBe(raw);
  });
});
