import { describe, expect, it } from "vitest";
import { badgeIdentityLayout } from "./badge-identity";
import {
  BADGE_SHARE_HEIGHT,
  BADGE_SHARE_WIDTH,
  badgeShareHeadline,
  badgeTweetUrl,
} from "./badge-share";

describe("badge identity layout", () => {
  it("sizes name and company much larger than the previous footer type", () => {
    const layout = badgeIdentityLayout(768, 1152, 0.28);
    const s = 768 / 1024;
    expect(layout.nameSize).toBe(Math.round(140 * s));
    expect(layout.companySize).toBe(Math.round(72 * s));
    expect(layout.roleSize).toBe(Math.round(36 * s));
    expect(layout.nameSize).toBeGreaterThan(Math.round(72 * s));
    expect(layout.companySize).toBeGreaterThan(Math.round(40 * s));
    expect(layout.companyY).toBeGreaterThan(layout.nameY + layout.nameSize);
    expect(layout.roleBoxY).toBeGreaterThan(
      layout.companyY + layout.companySize
    );
    expect(layout.roleBoxH).toBeGreaterThan(layout.roleSize);
    expect(layout.roleBoxY + layout.roleBoxH).toBeLessThan(1152);
  });
});

describe("badge share copy", () => {
  it("builds a possessive headline and an X intent URL", () => {
    expect(badgeShareHeadline("Tyler")).toBe("Tyler's Connect 2026 badge");
    expect(badgeShareHeadline("  Ada  ")).toBe("Ada's Connect 2026 badge");
    expect(badgeShareHeadline("")).toBe("My Connect 2026 badge");
    expect(BADGE_SHARE_WIDTH / BADGE_SHARE_HEIGHT).toBeCloseTo(16 / 9, 5);
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
});
