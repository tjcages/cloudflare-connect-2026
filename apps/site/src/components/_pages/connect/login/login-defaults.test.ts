import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { REGISTER_URL } from "../data";
import { CONNECT_HERO_RAIN_DEFAULT } from "../hero/rain-control-settings";
import { CONNECT_HERO_TWIZZLER_DEFAULTS } from "../hero/twizzler-defaults";
import { LOGIN_OVERLAY_COPY } from "./login-copy";
import {
  LOGIN_DARK_APPEARANCE,
  LOGIN_MOBILE_SCRIM,
  LOGIN_MOBILE_TWIZZLER_CROP,
  LOGIN_MOBILE_TWIZZLER_DEFAULTS,
  LOGIN_PANEL_TARGETS,
  LOGIN_RAIN_DEFAULT,
  LOGIN_TWIZZLER_DEFAULTS,
} from "./login-shader";

const loginDir = dirname(fileURLToPath(import.meta.url));
const loginPageSource = readFileSync(resolve(loginDir, "LoginPage.astro"), "utf8");
const loginFormSource = readFileSync(
  resolve(loginDir, "DashboardLoginForm.tsx"),
  "utf8"
);
const loginCssSource = readFileSync(resolve(loginDir, "dash-login.css"), "utf8");
const loginPromoSource = readFileSync(resolve(loginDir, "LoginPromo.astro"), "utf8");

const twizzlerGeometry = (settings: typeof CONNECT_HERO_TWIZZLER_DEFAULTS) => {
  const {
    backgroundColor: _backgroundColor,
    color: _color,
    colorFar: _colorFar,
    colorNear: _colorNear,
    colorEdge: _colorEdge,
    gradientStops: _gradientStops,
    ...geometry
  } = settings;
  return geometry;
};

describe("dashboard login shader", () => {
  it("keeps homepage hero Twizzler geometry under Dark Appearance ink", () => {
    expect(twizzlerGeometry(LOGIN_TWIZZLER_DEFAULTS)).toEqual(
      twizzlerGeometry(CONNECT_HERO_TWIZZLER_DEFAULTS)
    );
    expect(LOGIN_TWIZZLER_DEFAULTS).toMatchObject(LOGIN_DARK_APPEARANCE);
    expect(LOGIN_TWIZZLER_DEFAULTS.gradientStops.map((stop) => stop.color)).toEqual(
      [
        LOGIN_DARK_APPEARANCE.colorFar,
        LOGIN_DARK_APPEARANCE.colorEdge,
        LOGIN_DARK_APPEARANCE.colorNear,
      ]
    );
  });

  it("covers the tall promo pane with hero rain instead of width-fit", () => {
    expect(LOGIN_RAIN_DEFAULT.config.transform).toEqual({
      fit: "cover",
      zoom: 1,
      panX: 0,
      panY: 0,
    });
    expect(CONNECT_HERO_RAIN_DEFAULT.config.transform?.fit).toBe("width");
  });

  it("exposes only the hero Twizzler + rain panel targets", () => {
    expect(LOGIN_PANEL_TARGETS).toEqual(["twizzler", "rain"]);
  });

  it("uses homepage hero overlay type and register CTA", () => {
    expect(LOGIN_OVERLAY_COPY).toEqual({
      eyebrow: "Connect 2026",
      titleLines: ["Where the Internet's", "builders connect"],
      body: "October 19–21, 2026 · Moscone West, San Francisco",
      register: "Register Now",
      registerHref: REGISTER_URL,
    });
  });

  it("mask-blends the desktop shader top like the homepage hero", () => {
    expect(loginPageSource).toContain("hideTopFade={true}");
    expect(loginPageSource.match(/hideTopFade/g)?.length).toBe(1);
    expect(LOGIN_RAIN_DEFAULT.topFadePct).toBe(
      CONNECT_HERO_RAIN_DEFAULT.topFadePct
    );
    expect(LOGIN_RAIN_DEFAULT.topFadeOffsetPct).toBe(
      CONNECT_HERO_RAIN_DEFAULT.topFadeOffsetPct
    );
  });

  it("hides the promo pane below the dash lg breakpoint", () => {
    expect(loginPageSource).toContain("hidden");
    expect(loginPageSource).toContain("min-[1024px]:block");
    expect(loginPageSource).not.toContain("max-lg:h-[42svh]");
    expect(loginPromoSource).not.toContain('size="callout"');
  });

  it("shows a contained Connect card under the nav below lg", () => {
    expect(loginPageSource).toContain('layout="banner"');
    expect(loginPageSource).toContain("min-[1024px]:hidden");
    expect(loginPageSource).toContain("rounded-[12px]");
    expect(loginPageSource).toContain("ring-1 ring-[#d6d6d6]");
    expect(loginPageSource).toContain("px-16 pt-88 min-[1024px]:hidden");
    expect(loginPageSource).toContain('client:media="(max-width: 1023px)"');
    expect(loginPageSource).toContain('client:media="(min-width: 1024px)"');
    expect(loginPageSource).toContain("defaults={LOGIN_MOBILE_TWIZZLER_DEFAULTS}");
    expect(loginPageSource).toContain("LOGIN_MOBILE_SCRIM");
    expect(loginFormSource).toContain("pt-16 min-[1024px]:pt-96");
    expect(loginPromoSource).toContain("text-heading-h5");
    expect(loginPromoSource).toContain("text-body-small");
  });

  it("eases an orange left-to-right scrim over the mobile banner shader", () => {
    expect(LOGIN_MOBILE_SCRIM).toContain("linear-gradient(to right");
    expect(LOGIN_MOBILE_SCRIM).toContain("#f86a00");
    expect(LOGIN_MOBILE_SCRIM).toContain("rgb(248 106 0 / 0)");
  });

  it("zooms and frames the Twizzler for the short mobile banner only", () => {
    expect(LOGIN_MOBILE_TWIZZLER_DEFAULTS).toMatchObject({
      ...LOGIN_DARK_APPEARANCE,
      ...LOGIN_MOBILE_TWIZZLER_CROP,
    });
    expect(LOGIN_MOBILE_TWIZZLER_CROP.scale).toBeGreaterThan(
      LOGIN_TWIZZLER_DEFAULTS.scale
    );
    expect(LOGIN_MOBILE_TWIZZLER_CROP.camDist).toBeLessThan(
      LOGIN_TWIZZLER_DEFAULTS.camDist
    );
    expect(LOGIN_TWIZZLER_DEFAULTS.scale).toBe(
      CONNECT_HERO_TWIZZLER_DEFAULTS.scale
    );
    expect(LOGIN_TWIZZLER_DEFAULTS.camDist).toBe(
      CONNECT_HERO_TWIZZLER_DEFAULTS.camDist
    );
    expect(LOGIN_TWIZZLER_DEFAULTS.panX).toBe(0);
    expect(loginPageSource).toContain("defaults={LOGIN_TWIZZLER_DEFAULTS}");
  });

  it("fills the promo pane with the homepage hero shader stack", () => {
    expect(loginPageSource).toContain("absolute inset-0 z-0 h-full w-full");
    expect(loginPageSource).toContain("defaults={LOGIN_TWIZZLER_DEFAULTS}");
    expect(loginPageSource).toContain("rainDefaults={LOGIN_RAIN_DEFAULT}");
    expect(loginPageSource).not.toContain("aspect-square w-[42rem]");
    expect(loginPageSource).not.toContain("-right-[32%]");
    expect(loginPageSource).not.toContain("twizzler-poster");
    expect(loginPageSource).not.toContain("from-[#d9470f]");
  });

  it("uses the official Cloudflare cloud mark in the overlay header", () => {
    expect(loginPageSource).toContain('viewBox="0 0 460 271.2"');
    expect(loginPageSource).toContain("English");
    expect(loginPageSource).toContain("Sign up");
  });

  it("matches dash form chrome: SSO lock, split forgot links, orange sign-in", () => {
    expect(loginFormSource).toContain("Continue with SSO");
    expect(loginFormSource).toContain("forgot-email");
    expect(loginFormSource).toContain("forgot-password");
    expect(loginFormSource).toContain("subscriptionagreement");
    expect(loginFormSource).toContain("dash-login-signin");
    expect(loginCssSource).toContain("#f6821f");
    expect(loginCssSource).toContain(".dash-login-chrome");
    expect(loginCssSource).not.toMatch(/(?:^|\n)\.dash-login,/);
    expect(loginFormSource).not.toContain("There was a problem with verification");
  });

  it("styles the promo overlay like a smaller inverted homepage hero", () => {
    expect(loginPromoSource).toContain('from "@/components/Eyebrow"');
    expect(loginPromoSource).toContain('from "@/components/DottedLink"');
    expect(loginPromoSource).not.toContain('from "@/components/HoverArrow"');
    expect(loginPromoSource).not.toContain('from "@/components/Button"');
    expect(loginPromoSource).toContain("text-text-inverse hover:text-orange-300");
    expect(loginPromoSource).toContain('restColorVar="--color-text-inverse"');
    expect(loginPromoSource).toContain('hoverColorVar="--color-orange-300"');
    expect(loginPromoSource).toContain("text-heading-h3");
    expect(loginPromoSource).toContain("text-heading-h5");
    expect(loginPromoSource).toContain("text-body-medium");
    expect(loginPromoSource).toContain("text-body-small");
    expect(loginPromoSource).toContain("text-text-inverse");
    expect(loginPromoSource).toContain("LOGIN_OVERLAY_COPY.register");
    expect(loginPageSource).toContain(
      "flex h-full min-h-full items-start overflow-hidden"
    );
    expect(loginPageSource).toContain("pt-96");
    expect(loginPromoSource).toContain("pt-24");
    expect(loginFormSource).toContain("min-[1024px]:pt-96");
    expect(loginFormSource).toContain("min-[640px]:py-24");
  });

  it("uses Cookie Preferences like the live dash OneTrust control", () => {
    expect(loginPageSource).toContain("Cookie Preferences");
  });

  it("uses lab Dark Appearance cream-on-orange for the promo pane", () => {
    expect(loginPageSource).toContain("bg-[#f86a00]");
    expect(LOGIN_TWIZZLER_DEFAULTS.backgroundColor).toBe("#f86a00");
    expect(LOGIN_TWIZZLER_DEFAULTS.colorNear).toBe("#ffefd4");
  });

  it("avoids theme-reset Tailwind white/black color tokens", () => {
    expect(loginPageSource).not.toMatch(/\bbg-white\b/);
    expect(loginPageSource).not.toMatch(/\btext-white\b/);
    expect(loginFormSource).not.toMatch(/\bbg-white\b/);
    expect(loginFormSource).not.toMatch(/\btext-white\b/);
    expect(loginPromoSource).not.toMatch(/\bbg-white\b/);
    expect(loginPromoSource).not.toMatch(/\btext-white\b/);
  });
});
