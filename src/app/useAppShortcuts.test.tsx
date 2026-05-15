import { render } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { resetAppStoreDocumentToDefault, useAppStore } from "../store";
import { useAppShortcuts } from "./useAppShortcuts";

function ShortcutsHarness() {
  useAppShortcuts();
  return null;
}

describe("useAppShortcuts", () => {
  beforeEach(() => {
    resetAppStoreDocumentToDefault();
  });

  it("resets canvas zoom on meta + = (before browser page zoom can win)", () => {
    useAppStore.setState({ canvasZoom: 2, canvasPan: { x: 120, y: -40 } });
    render(<ShortcutsHarness />);

    document.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "=",
        code: "Equal",
        metaKey: true,
        bubbles: true,
        cancelable: true,
      }),
    );

    expect(useAppStore.getState().canvasZoom).toBe(1);
    expect(useAppStore.getState().canvasPan).toEqual({ x: 0, y: 0 });
  });

  it("resets canvas zoom on ctrl + =", () => {
    useAppStore.setState({ canvasZoom: 1.5 });
    render(<ShortcutsHarness />);

    document.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "=",
        code: "Equal",
        ctrlKey: true,
        bubbles: true,
        cancelable: true,
      }),
    );

    expect(useAppStore.getState().canvasZoom).toBe(1);
    expect(useAppStore.getState().canvasPan).toEqual({ x: 0, y: 0 });
  });

  it("resets canvas zoom when only legacy keyCode identifies the = key", () => {
    useAppStore.setState({ canvasZoom: 1.75 });
    render(<ShortcutsHarness />);

    const event = new KeyboardEvent("keydown", {
      code: "Equal",
      metaKey: true,
      shiftKey: false,
      bubbles: true,
      cancelable: true,
    });
    Object.defineProperty(event, "keyCode", { value: 187 });
    document.dispatchEvent(event);

    expect(useAppStore.getState().canvasZoom).toBe(1);
    expect(useAppStore.getState().canvasPan).toEqual({ x: 0, y: 0 });
  });

  it("resets canvas zoom on meta + 0 (alias for layouts such as Turkish Q)", () => {
    useAppStore.setState({ canvasZoom: 2 });
    render(<ShortcutsHarness />);

    document.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "0",
        code: "Digit0",
        metaKey: true,
        shiftKey: false,
        bubbles: true,
        cancelable: true,
      }),
    );

    expect(useAppStore.getState().canvasZoom).toBe(1);
    expect(useAppStore.getState().canvasPan).toEqual({ x: 0, y: 0 });
  });
});
