import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { CONNECT_HERO_RAIN_DEFAULT } from "../hero/rain-control-settings";
import { CONNECT_HERO_TWIZZLER_DEFAULTS } from "../hero/twizzler-defaults";
import {
  LOGIN_PANEL_TARGETS,
  LOGIN_RAIN_DEFAULT,
  LOGIN_TWIZZLER_DEFAULTS,
} from "./login-shader";

const loginPageSource = readFileSync(
  resolve(dirname(fileURLToPath(import.meta.url)), "LoginPage.astro"),
  "utf8"
);

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

  it("stacks a globe-sized shader above the form on mobile", () => {
    expect(loginPageSource).toContain("max-lg:flex-col");
    expect(loginPageSource).toContain("max-lg:order-1");
    expect(loginPageSource).toContain("max-lg:h-[52svh]");
    expect(loginPageSource).toContain("lg:min-h-svh");
    expect(loginPageSource).toContain("max-lg:order-2");
  });
});
