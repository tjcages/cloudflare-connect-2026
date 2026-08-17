import { describe, expect, it } from "vitest";
import {
  AGENDA_TWIZZLER_CONTROL_DEFAULTS,
  AGENDA_TWIZZLER_TARGETS,
  isAgendaTwizzlerTarget,
} from "./agenda-twizzler-settings";

describe("agenda twizzler controls", () => {
  it("gives every agenda card a distinct target and persistence key", () => {
    expect(AGENDA_TWIZZLER_TARGETS.map(({ id }) => id)).toEqual([
      "agenda-mon",
      "agenda-tue",
      "agenda-wed",
    ]);
    expect(
      new Set(AGENDA_TWIZZLER_TARGETS.map(({ panelId }) => panelId)).size
    ).toBe(3);
  });

  it("keeps each temporary default independently editable", () => {
    expect(AGENDA_TWIZZLER_CONTROL_DEFAULTS["agenda-mon"]).not.toBe(
      AGENDA_TWIZZLER_CONTROL_DEFAULTS["agenda-tue"]
    );
    expect(
      AGENDA_TWIZZLER_CONTROL_DEFAULTS["agenda-mon"].gradientStops
    ).not.toBe(AGENDA_TWIZZLER_CONTROL_DEFAULTS["agenda-tue"].gradientStops);
  });

  it("recognizes only agenda shader targets", () => {
    expect(isAgendaTwizzlerTarget("agenda-wed")).toBe(true);
    expect(isAgendaTwizzlerTarget("twizzler")).toBe(false);
    expect(isAgendaTwizzlerTarget(null)).toBe(false);
  });
});
