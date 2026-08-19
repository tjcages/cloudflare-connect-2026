import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { CONNECT_HERO_RAIN_DEFAULT } from "../hero/rain-control-settings";
import { CONNECT_HERO_TWIZZLER_DEFAULTS } from "../hero/twizzler-defaults";
import { LOGIN_OVERLAY_COPY } from "./login-copy";
import {
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
const loginPromoSource = readFileSync(resolve(loginDir, "LoginPromo.astro"), "utf8");

describe("dashboard login shader", () => {
  it("starts from the homepage hero Twizzler defaults", () => {
    expect(LOGIN_TWIZZLER_DEFAULTS).toEqual(CONNECT_HERO_TWIZZLER_DEFAULTS);
  });

  it("starts from the homepage hero rain defaults", () => {
    expect(LOGIN_RAIN_DEFAULT).toBe(CONNECT_HERO_RAIN_DEFAULT);
  });

  it("exposes only the hero Twizzler + rain panel targets", () => {
    expect(LOGIN_PANEL_TARGETS).toEqual(["twizzler", "rain"]);
  });

  it("uses the dash.cloudflare.com globe overlay copy and register CTA", () => {
    expect(LOGIN_OVERLAY_COPY).toEqual({
      eyebrow: "Cloudflare Connect 2026",
      title: "Where the Internet’s builders connect.",
      body: "October 19–21, 2026 · Moscone West, San Francisco",
      register: "Register now",
      registerHref: "https://www.cloudflare.com/connect/",
    });
  });

  it("keeps rain visible by disabling the hero top-fade mask", () => {
    expect(loginPageSource).toContain("hideTopFade={true}");
  });

  it("hides the promo pane below the dash lg breakpoint", () => {
    expect(loginPageSource).toContain("hidden");
    expect(loginPageSource).toContain("min-[1024px]:block");
    expect(loginPageSource).not.toContain("max-lg:h-[42svh]");
    expect(loginPromoSource).not.toContain('size="callout"');
  });

  it("puts the hero shader in the dash globe canvas slot", () => {
    expect(loginPageSource).toContain("aspect-square w-[42rem]");
    expect(loginPageSource).toContain("-right-[32%]");
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
    expect(loginFormSource).toContain("#f6821f");
    expect(loginFormSource).not.toContain("There was a problem with verification");
  });

  it("keeps Register now on the promo pane", () => {
    expect(loginPromoSource).toContain("LOGIN_OVERLAY_COPY.register");
  });
});
