import { createRef } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resetAppStoreDocumentToDefault, useAppStore } from "../store";
import { CanvasViewportToolbar } from "./CanvasViewportToolbar";

describe("CanvasViewportToolbar", () => {
  beforeEach(() => {
    resetAppStoreDocumentToDefault();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("resets the document after confirming clear", () => {
    vi.stubGlobal("confirm", vi.fn(() => true));
    useAppStore.setState({
      instances: [],
      selectedInstanceId: null,
      nextInstanceIndex: 99,
    });

    const ref = createRef<HTMLCanvasElement>();
    render(<CanvasViewportToolbar canvasRef={ref} />);

    fireEvent.click(screen.getByRole("button", { name: /Clear$/ }));

    expect(useAppStore.getState().instances).toHaveLength(15);
    expect(useAppStore.getState().nextInstanceIndex).toBe(17);
  });

  it("does not reset when clear is cancelled", () => {
    vi.stubGlobal("confirm", vi.fn(() => false));
    useAppStore.setState({
      instances: [],
      selectedInstanceId: null,
      nextInstanceIndex: 99,
    });

    const ref = createRef<HTMLCanvasElement>();
    render(<CanvasViewportToolbar canvasRef={ref} />);

    fireEvent.click(screen.getByRole("button", { name: /Clear$/ }));

    expect(useAppStore.getState().instances).toHaveLength(0);
    expect(useAppStore.getState().nextInstanceIndex).toBe(99);
  });
});
