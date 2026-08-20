import { describe, expect, it } from "vitest";
import {
  badgeSharePath,
  clampBadgeText,
  displayBadgeCompany,
  displayBadgeName,
  formatBadgeSerial,
  hashBadgeIdentity,
  parseBadgeSearch,
  resolveBadgeView,
  serializeBadgeSearch,
} from "./badge-params";
import {
  applyThemeToRain,
  applyThemeToTwizzler,
  BADGE_THEMES,
  DEFAULT_BADGE_THEME_ID,
  findBadgeTheme,
  hexToColorInt,
} from "./badge-themes";

describe("badge URL params", () => {
  it("parses name, company, theme, and role from the query string", () => {
    const params = parseBadgeSearch(
      "?name=Jane%20Doe&company=Cloudflare&theme=blue&role=speaker"
    );
    expect(params).toEqual({
      name: "Jane Doe",
      company: "Cloudflare",
      theme: "blue",
      role: "speaker",
    });
  });

  it("falls back to defaults for missing or unknown values", () => {
    expect(parseBadgeSearch("")).toEqual({
      name: "",
      company: "",
      theme: DEFAULT_BADGE_THEME_ID,
      role: "attendee",
    });
    expect(parseBadgeSearch("?theme=hot-pink&role=vip&name=").theme).toBe(
      DEFAULT_BADGE_THEME_ID
    );
    expect(parseBadgeSearch("?role=vip").role).toBe("attendee");
  });

  it("omits default theme and role from the share URL", () => {
    expect(
      serializeBadgeSearch({
        name: "Ada",
        company: "Acme",
        theme: "coral-classic",
        role: "attendee",
      })
    ).toBe("?name=Ada&company=Acme");
    expect(
      serializeBadgeSearch({
        name: "",
        company: "",
        theme: "coral-classic",
        role: "attendee",
      })
    ).toBe("");
    expect(
      badgeSharePath({
        name: "Ada",
        company: "Acme",
        theme: "purple",
        role: "staff",
      })
    ).toBe("/connect/badge?name=Ada&company=Acme&theme=purple&role=staff");
  });

  it("clamps typed fields and shows placeholders when empty", () => {
    expect(clampBadgeText("  Jane   Doe  extra", 8)).toBe("Jane Doe");
    expect(displayBadgeName("")).toBe("Your name");
    expect(displayBadgeCompany("  Cloudflare  ")).toBe("Cloudflare");
  });

  it("mints a stable serial from name + company", () => {
    const a = hashBadgeIdentity("Jane Doe", "Cloudflare");
    const b = hashBadgeIdentity("jane doe", "Cloudflare");
    const c = hashBadgeIdentity("Jane Doe", "Acme");
    expect(a).toBe(b);
    expect(a).not.toBe(c);
    expect(formatBadgeSerial(a)).toMatch(/^[0-9A-F]{6}$/);
    expect(
      resolveBadgeView(parseBadgeSearch("?name=Jane%20Doe&company=Cloudflare"))
        .serial
    ).toBe(formatBadgeSerial(a));
  });
});

describe("badge lab color schemes", () => {
  it("ships the lab Color preset ids", () => {
    expect(BADGE_THEMES.map((theme) => theme.id)).toEqual([
      "coral-classic",
      "brand",
      "red",
      "green",
      "blue",
      "purple",
      "soft-gold",
      "deep-ember",
      "light",
    ]);
    expect(BADGE_THEMES).toHaveLength(9);
  });

  it("ships Brand as the ninth Orange 700 swatch", () => {
    const theme = findBadgeTheme("brand");
    expect(theme.twizzler.colorNear).toBe("#f77720");
    expect(applyThemeToTwizzler(theme).color).toBe("#f77720");
  });

  it("applies Blue Pair/Accent/Deep ink to the Twizzler", () => {
    const theme = findBadgeTheme("blue");
    const settings = applyThemeToTwizzler(theme);
    expect(theme.stripePalette).toBe("Blue");
    expect(settings.colorNear).toBe("#1f72ff");
    expect(settings.colorFar).toBe("#38c5f6");
    expect(settings.colorEdge).toBe("#1c50d9");
    expect(settings.gradientStops[0]?.color).toBe("#38c5f6");
  });

  it("recolors rain stripes and unique-ifies the meteor seed", () => {
    const theme = findBadgeTheme("red");
    const rain = applyThemeToRain(theme, 42);
    expect(rain.stripes).toHaveLength(theme.stripeHexes.length);
    expect(rain.stripes?.[0]?.color).toBe(
      hexToColorInt(theme.stripeHexes[0] ?? "#000000")
    );
    expect(rain.background?.meteors?.seed).toBe(43);
    const other = applyThemeToRain(theme, 100);
    expect(other.background?.meteors?.seed).not.toBe(
      rain.background?.meteors?.seed
    );
  });

  it("keeps Default rain on the factory palette", () => {
    const theme = findBadgeTheme("coral-classic");
    expect(theme.stripeHexes[theme.stripeHexes.length - 1]).toBe("#f46021");
    expect(applyThemeToTwizzler(theme).color).toBe("#f46021");
  });

  it("exposes a metallic accent hex on every scheme", () => {
    for (const theme of BADGE_THEMES) {
      expect(theme.accent).toMatch(/^#[0-9a-fA-F]{6}$/);
    }
    expect(findBadgeTheme("coral-classic").accent).toBe("#f46021");
    expect(findBadgeTheme("blue").accent).toBe("#1f72ff");
    expect(findBadgeTheme("purple").accent).toBe(
      findBadgeTheme("purple").twizzler.colorNear
    );
  });
});
