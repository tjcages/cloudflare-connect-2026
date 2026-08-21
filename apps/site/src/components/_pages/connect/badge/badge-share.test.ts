import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { badgeIdentityLayout } from "./badge-identity";
import {
  BADGE_SHARE_DATE,
  BADGE_SHARE_HEADLINE,
  BADGE_SHARE_SURFACE,
  BADGE_SHARE_VENUE,
  badgeShareHeadline,
  badgeTweetUrl,
  keepShareNode,
  resolveShareSurface,
  sceneFitsShareCard,
  wrapShareTitle,
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
    expect(layout.roleBoxY + layout.roleBoxH).toBeCloseTo(1152 - layout.pad);
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
    const url = badgeTweetUrl("Tyler's Connect 2026 badge");
    expect(url.startsWith("https://x.com/intent/post?text=")).toBe(true);
    const text = decodeURIComponent(new URL(url).searchParams.get("text") ?? "");
    expect(text).toBe("Tyler's Connect 2026 badge");
    expect(text).not.toContain("http");
  });

  it("forces the 1200×800 capture layout when the live scene is narrower", () => {
    expect(
      sceneFitsShareCard({
        getBoundingClientRect: () => ({ width: 1200, height: 800 }),
      })
    ).toBe(true);
    expect(
      sceneFitsShareCard({
        getBoundingClientRect: () => ({ width: 1100, height: 800 }),
      })
    ).toBe(false);
    expect(
      sceneFitsShareCard({
        getBoundingClientRect: () => ({ width: 390, height: 540 }),
      })
    ).toBe(false);
  });

  it("drops marked nodes and canvases from the hero screenshot", () => {
    expect(keepShareNode({ hasAttribute: () => false } as HTMLElement)).toBe(
      true
    );
    expect(
      keepShareNode({
        hasAttribute: (name: string) => name === "data-share-hide",
      } as HTMLElement)
    ).toBe(false);
    expect(
      keepShareNode({
        nodeName: "CANVAS",
        hasAttribute: () => false,
      } as HTMLElement)
    ).toBe(false);
  });

  it("wraps the share title to the column width", () => {
    const ctx = {
      measureText: (text: string) => ({ width: text.length * 10 }),
    } as CanvasRenderingContext2D;
    expect(wrapShareTitle(ctx, "Let’s shape what’s next together", 500)).toEqual(
      ["Let’s shape what’s next together"]
    );
    expect(wrapShareTitle(ctx, "Let’s shape what’s next together", 80)).toEqual(
      ["Let’s", "shape", "what’s", "next", "together"]
    );
  });

  it("uses the themed page surface for the copied image", () => {
    const style = {
      backgroundColor: "rgba(0, 0, 0, 0)",
      getPropertyValue: (name: string) =>
        name === "--color-background-base" ? "#141414" : "",
    } as CSSStyleDeclaration;
    expect(resolveShareSurface(style)).toBe("#141414");

    expect(
      resolveShareSurface({
        backgroundColor: "rgb(255, 255, 255)",
        getPropertyValue: () => "",
      } as unknown as CSSStyleDeclaration)
    ).toBe("rgb(255, 255, 255)");
  });

  it("keeps poster copy for the share card lockup", () => {
    expect(BADGE_SHARE_HEADLINE).toBe("Let’s shape what’s\nnext together");
    expect([...BADGE_SHARE_VENUE]).toEqual([
      "Moscone Center",
      "San Francisco",
    ]);
    expect(BADGE_SHARE_DATE).toBe("October 20, 2026");
    const copy = readFileSync(
      resolve(
        process.cwd(),
        "src/components/_pages/connect/badge/BadgeShareCopy.tsx"
      ),
      "utf8"
    );
    expect(copy).toContain("ConnectCloud");
    expect(copy).toContain("text-orange-900");
    expect(copy).toContain("justify-between");
    expect(copy).toContain("data-share-copy");
    expect(copy).toContain("data-share-logo");
    expect(copy).toContain("data-share-stamp");
    expect(copy).toContain("Cloudflare");
    expect(copy).toContain("Connect 2026");
    expect(copy).toContain("BADGE_SHARE_HEADLINE");
    expect(copy).toContain("BADGE_SHARE_VENUE");
    expect(copy).toContain("BADGE_SHARE_DATE");
    expect(copy).not.toContain("Your Connect 2026 badge");
    expect(copy).not.toContain("See you at Cloudflare Connect 2026");
  });

  it("extends the share grid by two square rows to the hero bottom", () => {
    const grid = readFileSync(
      resolve(
        process.cwd(),
        "src/components/_pages/connect/badge/_svg/Grid.svg"
      ),
      "utf8"
    );
    expect(grid).toContain('viewBox="0 0 401 801"');
    expect(grid).toContain('height="800"');
    expect(grid).toContain("M0.5 720.5H400.5");
    expect(grid).toContain("M0.5 800.5H400.5");
    expect(grid).toContain("V800.5");
    expect(grid).not.toContain("V640.5");
  });

  it("composites the share scene instead of screenshotting the live hero", () => {
    expect(BADGE_SHARE_SURFACE).toBe("#ffffff");
    const source = readFileSync(
      resolve(
        process.cwd(),
        "src/components/_pages/connect/badge/badge-share.ts"
      ),
      "utf8"
    );
    expect(source).not.toContain("toCanvas(");
    expect(source).not.toContain("captureHeroShareFallback");
    expect(source).toContain("shareStamp");
    expect(source).toContain("BADGE_SHARE_FILE");
    expect(source).toContain("stampHeroGrid");
    expect(source).toContain("stampBackdrop");
    expect(source).toContain("stampShareCopy");
    expect(source).toContain("stampShareLogo");
    expect(source).toContain("wrapShareTitle");
    expect(source).toContain("data-share-backdrop");
    expect(source).toContain("data-share-copy");
    expect(source).toContain("data-share-logo");
    expect(source).toContain("data-share-stamp");
    expect(source).toContain("toDataURL");
    expect(source).toContain("destination-in");
    expect(source).not.toContain("stampShareTitle");
    expect(source).toContain("withDesktopShareLayout");
    expect(source).toContain("waitForDesktopShareSize");
    expect(source).toContain("sceneFitsShareCard");
    expect(source).not.toContain("innerWidth >= 992");
    expect(source).toContain("BADGE_SHARE_WIDTH");
    expect(source).toContain("BADGE_SHARE_HEIGHT");
    expect(source).toContain("shareCapturing");
    expect(source).toContain("1200");
    expect(source).toContain("800");
    expect(source).not.toContain("drawShareGrid");
  });
});
