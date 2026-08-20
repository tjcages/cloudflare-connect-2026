import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { connectResourceGroups } from "@/components/header/connect/resources-data";

const read = (relativePath: string) =>
  readFileSync(resolve(process.cwd(), relativePath), "utf8");

describe("Connect subpage polish", () => {
  it("keeps Badge and Sessions out of the top nav", () => {
    const nav = read("src/components/header/connect/connect-nav.ts");
    const mobileMenu = read("src/components/header/mobile/MobileMenu.tsx");
    expect(nav).toContain('label: "Agenda"');
    expect(nav).toContain('label: "Speakers"');
    expect(nav).toContain('label: "Resources"');
    expect(nav).not.toContain('label: "Badge"');
    expect(nav).not.toContain('label: "Sessions"');
    expect(mobileMenu).not.toMatch(/label: "Badge"/);
    expect(mobileMenu).not.toMatch(/label: "Sessions"/);
  });

  it("keeps Badge out of the Resources dropdown", () => {
    const labels = connectResourceGroups.flatMap((group) =>
      group.items.map((item) => item.label)
    );
    expect(labels).not.toContain("Badge");
    expect(labels).toContain("Partner Summit");
    expect(labels).toContain("FAQs");
  });

  it("paints Partner Summit and FAQ dropdown icons as orange/yellow duo-tone", () => {
    const buildings = read("src/components/icon/_svg/buildings.svg");
    const info = read("src/components/icon/_svg/info-simple.svg");
    expect(buildings).toMatch(/#f46021/i);
    expect(buildings).toMatch(/#fea700/i);
    expect(info).toMatch(/#f46021/i);
    expect(info).toMatch(/#fea700/i);
    expect(info).not.toMatch(/stroke="black"/);
  });

  it("mounts the homepage hero shader stack on subpage heroes", () => {
    const hero = read(
      "src/components/_pages/connect/shared/SubpageHero.astro"
    );
    expect(hero).toContain("ConnectHeroTwizzler");
    expect(hero).toContain('posterSrc="/connect/twizzler-poster.png"');
    expect(hero).toContain("w-full");
    expect(hero).toContain("isolate");
    expect(hero).toContain("overflow-hidden");
    expect(hero).toContain("max-w-1200");
  });

  it("adds agenda stripe accents to University schedule and Partner Summit cards", () => {
    const university = read("src/pages/connect/cloudflare-university.astro");
    const partner = read("src/pages/connect/partner-summit.astro");
    const partnerData = read(
      "src/components/_pages/connect/page-data/partner.ts"
    );
    expect(university).toContain("AgendaStripeRoot");
    expect(university).toContain("AgendaStripeAperture");
    expect(university).toContain('slot="info"');
    expect(partner).toContain("AgendaStripeRoot");
    expect(partner).toContain("Partner Awards");
    expect(partner).toContain("Extend your stay");
    expect(partner).toContain("partnerStay");
    expect(partnerData).toContain("Stay for Connect");
  });

  it("adds hero shaders to Sponsors via the shared subpage hero", () => {
    const sponsors = read("src/pages/connect/sponsors.astro");
    expect(sponsors).toContain("SubpageHero");
  });

  it("keeps the FAQ hero title, description, and CTAs without the shader band", () => {
    const faq = read("src/pages/connect/faq.astro");
    const hero = read(
      "src/components/_pages/connect/shared/SubpageHero.astro"
    );
    expect(faq).toContain("SubpageHero");
    expect(faq).toContain("shader={false}");
    expect(faq).not.toContain("Answers by topic");
    expect(faq).toContain('layout="headerless"');
    expect(hero).toContain("shader = true");
    expect(hero).toContain("ConnectHeroTwizzler");
  });

  it("balances subpage hero description copy", () => {
    const hero = read(
      "src/components/_pages/connect/shared/SubpageHero.astro"
    );
    expect(hero).toContain("text-balance");
  });

  it("starts Convince your boss at the templates section with an icon-only copy control", () => {
    const page = read("src/pages/connect/convince-your-boss.astro");
    const copy = read(
      "src/components/_pages/connect/convince/CopyTemplate.tsx"
    );
    expect(page).not.toContain("SubpageHero");
    expect(page).toContain('id="templates"');
    expect(copy).toContain('variant="secondary"');
    expect(copy).toContain("CopyFeedbackIcon");
    expect(copy).toContain("Copy email");
    expect(copy).toContain("size-32");
    expect(copy).toContain("[&>span]:px-0!");
    expect(copy).not.toMatch(/<span>\s*Copy email/);
  });
});
