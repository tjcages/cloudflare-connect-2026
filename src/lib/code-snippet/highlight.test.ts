import { describe, expect, it } from "vitest";
import { tokenizeCodeSnippet } from "./highlight";

describe("tokenizeCodeSnippet", () => {
  it("colors identifiers with theme accent and strings with paired palette", () => {
    const tokens = tokenizeCodeSnippet('import { DurableObject } from "cloudflare:workers";', "typescript", "orange");
    expect(tokens.length).toBeGreaterThan(0);
    const durable = tokens.find((t) => t.text.includes("DurableObject"));
    const str = tokens.find((t) => t.text.includes("cloudflare"));
    expect(durable?.colorHex).toBe("#FF4802");
    expect(str?.colorHex).toBe("#9C37FF");
  });

  it("returns empty array for empty code", () => {
    expect(tokenizeCodeSnippet("", "auto", "orange")).toEqual([]);
  });

  it("tokenizes shell commands in auto mode without throwing", () => {
    const tokens = tokenizeCodeSnippet("wrangler deploy\n\n--outdir bundled/ --dry-run", "auto", "orange");
    expect(tokens.length).toBeGreaterThan(0);
    expect(tokens.map((t) => t.text).join("")).toContain("wrangler");
  });

  it("highlights shell subcommand in accent and flags in paired palette", () => {
    const tokens = tokenizeCodeSnippet("wrangler deploy\n\n--outdir bundled/ --dry-run", "auto", "orange");
    const muted = tokens.find((t) => t.text === "wrangler")?.colorHex;
    expect(tokens.find((t) => t.text === "wrangler")?.colorHex).toBe(muted);
    expect(tokens.find((t) => t.text === "deploy")?.colorHex).toBe("#FF4802");
    expect(tokens.find((t) => t.text === "bundled/")?.colorHex).toBe(muted);
    expect(tokens.find((t) => t.text === "--outdir")?.colorHex).toBe("#9C37FF");
    expect(tokens.find((t) => t.text === "--dry-run")?.colorHex).toBe("#9C37FF");
  });

  it("renders explicit text mode as one plain token", () => {
    const tokens = tokenizeCodeSnippet("wrangler deploy", "text", "orange");
    expect(tokens).toEqual([{ text: "wrangler deploy", colorHex: expect.any(String) }]);
  });
});
