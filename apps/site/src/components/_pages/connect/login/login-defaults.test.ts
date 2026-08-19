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

  it("uses the dash.cloudflare.com globe overlay copy", () => {
    expect(LOGIN_OVERLAY_COPY).toEqual({
      eyebrow: "Cloudflare Connect 2026",
      title: "Where the Internet’s builders connect.",
      body: "October 19–21, 2026 · Moscone West, San Francisco",
    });
  });

  it("keeps rain visible by disabling the hero top-fade mask", () => {
    expect(loginPageSource).toContain("hideTopFade={true}");
  });

  it("uses a full-bleed shader background and a floating callout on mobile", () => {
    expect(loginPageSource).toContain("max-lg:h-[42svh]");
    expect(loginPageSource).toContain('size="callout"');
    expect(loginPageSource).toContain("lg:hidden");
  });
});
