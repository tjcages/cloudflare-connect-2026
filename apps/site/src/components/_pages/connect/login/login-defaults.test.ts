import { describe, expect, it } from "vitest";
import { CONNECT_HERO_RAIN_DEFAULT } from "../hero/rain-control-settings";
import { CONNECT_HERO_TWIZZLER_DEFAULTS } from "../hero/twizzler-defaults";
import {
  LOGIN_PANEL_TARGETS,
  LOGIN_RAIN_DEFAULT,
  LOGIN_TWIZZLER_DEFAULTS,
} from "./login-shader";

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
});
