import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { connectNavItems } from "@/components/header/connect/connect-nav";
import { connectResourceGroups } from "@/components/header/connect/resources-data";

const read = (relativePath: string) =>
  readFileSync(resolve(process.cwd(), relativePath), "utf8");

describe("Connect subpage polish", () => {
  it("keeps Badge and Sessions out of the top nav", () => {
    const labels = connectNavItems.map((item) => item.label);
    expect(labels).toEqual(["Agenda", "Speakers", "Resources"]);

    const mobileMenu = read("src/components/header/mobile/MobileMenu.tsx");
    expect(mobileMenu).not.toMatch(/label: "Badge"/);
    expect(mobileMenu).not.toMatch(/label: "Sessions"/);
  });

  it("keeps Badge inside the Resources dropdown", () => {
    const labels = connectResourceGroups.flatMap((group) =>
      group.items.map((item) => item.label)
    );
    expect(labels).toContain("Badge");
    expect(labels).toContain("Partner Summit");
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
    expect(university).toContain("AgendaStripeRoot");
    expect(university).toContain("AgendaStripeAperture");
    expect(university).toContain('slot="info"');
    expect(partner).toContain("AgendaStripeRoot");
    expect(partner).toContain("Partner Awards");
    expect(partner).toContain("Extend your stay");
    expect(partner).toContain("Stay for Connect");
  });

  it("adds hero shaders to Sponsors and FAQ via the shared subpage hero", () => {
    const sponsors = read("src/pages/connect/sponsors.astro");
    const faq = read("src/pages/connect/faq.astro");
    expect(sponsors).toContain("SubpageHero");
    expect(faq).toContain("SubpageHero");
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
    expect(copy).not.toMatch(/<span>\s*Copy email/);
  });
});
