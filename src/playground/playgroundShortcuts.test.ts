import { describe, expect, it } from "vitest";
import { shouldToggleStripesFromShortcut } from "./playgroundShortcuts";

describe("shouldToggleStripesFromShortcut", () => {
  it("accepts Shift+S outside editable fields", () => {
    const event = new KeyboardEvent("keydown", { key: "S", code: "KeyS", shiftKey: true });

    expect(shouldToggleStripesFromShortcut(event)).toBe(true);
  });

  it("ignores Shift+S while editing text", () => {
    const input = document.createElement("input");
    const event = new KeyboardEvent("keydown", { key: "S", code: "KeyS", shiftKey: true });
    Object.defineProperty(event, "target", { value: input });

    expect(shouldToggleStripesFromShortcut(event)).toBe(false);
  });
});
