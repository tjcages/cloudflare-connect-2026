import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { badgeIdentityLayout } from "./badge-identity";
import {
  badgeShareHeadline,
  badgeTweetUrl,
  keepShareNode,
} from "./badge-share";

describe("badge identity layout", () => {
  it("sizes name and company much larger than the previous footer type", () => {
    const layout = badgeIdentityLayout(768, 1152, 0.28);
    const s = 768 / 1024;
    const footer = Math.round(1152 * 0.28);
    expect(layout.nameSize).toBe(Math.round(116 * s));
    expect(layout.companySize).toBe(Math.round(72 * s));
    expect(layout.roleSize).toBe(Math.round(36 * s));
    expect(layout.nameY).toBeCloseTo(1152 - footer + 28 * s);
    expect(layout.nameSize).toBeGreaterThan(Math.round(72 * s));
    expect(layout.companySize).toBeGreaterThan(Math.round(40 * s));
    expect(layout.companyY).toBeGreaterThan(layout.nameY + layout.nameSize);
    expect(layout.roleBoxY).toBeGreaterThan(
      layout.companyY + layout.companySize
    );
    expect(layout.roleBoxH).toBeGreaterThan(layout.roleSize);
    expect(layout.roleBoxY + layout.roleBoxH).toBeLessThan(1152);
  });

  it("sets name and company in STK Bureau and tightens the speaker chip", () => {
    const source = readFileSync(
      resolve(
        process.cwd(),
        "src/components/_pages/connect/badge/badge-identity.ts"
      ),
      "utf8"
    );
    expect(source).toContain('400 ${layout.nameSize}px "STK Bureau Sans"');
    expect(source).toContain('600 ${layout.companySize}px "STK Bureau Sans"');
    expect(source).toContain('600 ${layout.roleSize}px "Paper Mono"');
    expect(source).toContain(
      "${identity.role.toUpperCase()} · ${identity.serial}"
    );
    expect(source).not.toContain("}  ·  ${");
  });
});

describe("badge share copy", () => {
  it("builds a possessive headline and an X intent URL", () => {
    expect(badgeShareHeadline("Tyler")).toBe("Tyler's Connect 2026 badge");
    expect(badgeShareHeadline("  Ada  ")).toBe("Ada's Connect 2026 badge");
    expect(badgeShareHeadline("")).toBe("My Connect 2026 badge");
    const url = badgeTweetUrl(
      "Tyler's Connect 2026 badge",
      "https://example.com/connect/badge?name=Tyler"
    );
    expect(url.startsWith("https://x.com/intent/post?text=")).toBe(true);
    expect(decodeURIComponent(url)).toContain("Tyler's Connect 2026 badge");
    expect(decodeURIComponent(url)).toContain(
      "https://example.com/connect/badge?name=Tyler"
    );
  });

  it("drops marked nodes from the hero screenshot", () => {
    expect(keepShareNode({ hasAttribute: () => false } as HTMLElement)).toBe(
      true
    );
    expect(
      keepShareNode({
        hasAttribute: (name: string) => name === "data-share-hide",
      } as HTMLElement)
    ).toBe(false);
  });
});
