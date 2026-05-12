import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_CONFIG } from "../grid/config";
import { App, GRID_GENERATION_DEBOUNCE_MS } from "./App";

class MockWorker {
  static instances: MockWorker[] = [];

  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: ((event: ErrorEvent) => void) | null = null;
  postMessage = vi.fn();
  terminate = vi.fn();

  constructor() {
    MockWorker.instances.push(this);
  }
}

describe("App grid generation", () => {
  beforeEach(() => {
    MockWorker.instances = [];
    vi.useFakeTimers();
    vi.stubGlobal("Worker", MockWorker);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("debounces oversized dimension changes into a worker instead of generating during input", () => {
    render(<App />);

    fireEvent.change(screen.getByLabelText("Width"), { target: { value: "8000" } });

    expect(screen.getByLabelText("Width")).toHaveValue(8000);
    expect(MockWorker.instances).toHaveLength(0);

    act(() => {
      vi.advanceTimersByTime(GRID_GENERATION_DEBOUNCE_MS);
    });

    expect(MockWorker.instances).toHaveLength(1);
    expect(MockWorker.instances[0].postMessage).toHaveBeenCalledWith({
      id: expect.any(Number),
      config: expect.objectContaining({
        seed: DEFAULT_CONFIG.seed,
        height: DEFAULT_CONFIG.height,
        density: DEFAULT_CONFIG.density,
        smallCellRatio: DEFAULT_CONFIG.smallCellRatio,
        largeCellRatio: DEFAULT_CONFIG.largeCellRatio,
        strokeColor: DEFAULT_CONFIG.strokeColor,
        width: 8000,
      }),
    });
  });

  it("updates stroke color without regenerating the grid", () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", {
      clipboard: {
        writeText,
      },
    });
    render(<App />);

    act(() => {
      vi.advanceTimersByTime(GRID_GENERATION_DEBOUNCE_MS);
    });
    expect(MockWorker.instances).toHaveLength(1);

    fireEvent.change(screen.getByLabelText("Stroke color"), { target: { value: "#123456" } });
    act(() => {
      vi.advanceTimersByTime(GRID_GENERATION_DEBOUNCE_MS);
    });

    expect(MockWorker.instances).toHaveLength(1);

    fireEvent.click(screen.getByRole("button", { name: "Copy as SVG" }));
    expect(writeText).toHaveBeenCalledWith(expect.stringContaining('stroke="#123456"'));
  });
});
