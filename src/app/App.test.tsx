import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { copyDocumentPng } from "../canvas/pngExport";
import { generateGrid } from "../grid/generator";
import { App } from "./App";

vi.mock("../grid/generator", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../grid/generator")>();

  return {
    ...actual,
    generateGrid: vi.fn(actual.generateGrid),
  };
});

vi.mock("../canvas/pngExport", () => ({
  copyDocumentPng: vi.fn().mockResolvedValue(undefined),
}));

type TestWorker = Worker & {
  postMessage: ReturnType<typeof vi.fn>;
  terminate: ReturnType<typeof vi.fn>;
};

const workerInstances: TestWorker[] = [];

const createTestWorker = () => {
  const worker = {
    onmessage: null,
    onmessageerror: null,
    onerror: null,
    postMessage: vi.fn(),
    terminate: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  } as unknown as TestWorker;

  workerInstances.push(worker);

  return worker;
};

const resolveLatestWorker = () => {
  const worker = workerInstances.at(-1);
  const latestRequest = worker?.postMessage.mock.calls.at(-1)?.[0];
  const generator = vi.mocked(generateGrid).getMockImplementation();

  if (!worker || !latestRequest || !generator) {
    return;
  }

  worker.onmessage?.({
    data: {
      grid: generator(latestRequest.config),
    },
  } as MessageEvent);
};

describe("App", () => {
  beforeEach(() => {
    vi.mocked(generateGrid).mockClear();
    vi.mocked(copyDocumentPng).mockClear();
    workerInstances.length = 0;
    vi.stubGlobal("Worker", vi.fn(function WorkerMock() {
      return createTestWorker();
    }));
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
      save: vi.fn(),
      restore: vi.fn(),
      scale: vi.fn(),
      clearRect: vi.fn(),
      fillRect: vi.fn(),
      strokeRect: vi.fn(),
      beginPath: vi.fn(),
      roundRect: vi.fn(),
      fill: vi.fn(),
      stroke: vi.fn(),
    } as unknown as CanvasRenderingContext2D);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("copies the composed canvas as 2x PNG from the single export button", async () => {
    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: "Copy PNG" }));

    await waitFor(() => {
      expect(copyDocumentPng).toHaveBeenCalledWith(
        expect.objectContaining({
          scale: 2,
          instances: expect.arrayContaining([expect.objectContaining({ type: "icon-box" })]),
        }),
      );
    });
    expect(screen.queryByRole("button", { name: "Copy 2x Retina PNG" })).not.toBeInTheDocument();
  });

  it("switches sidebar tabs without unmounting the canvas", () => {
    render(<App />);

    expect(screen.getByRole("img", { name: "Component builder canvas" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Grid" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("tab", { name: "Components" }));

    expect(screen.getByText("Current instances")).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Component builder canvas" })).toBeInTheDocument();
  });

  it("adds an icon-box from the sidebar with pointer drag at a snapped position", () => {
    render(<App />);
    fireEvent.click(screen.getByRole("tab", { name: "Components" }));
    const canvas = screen.getByRole("img", { name: "Component builder canvas" }) as HTMLCanvasElement;
    vi.spyOn(canvas, "getBoundingClientRect").mockReturnValue({
      bottom: 560,
      height: 560,
      left: 0,
      right: 800,
      top: 0,
      width: 800,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    });

    fireEvent.pointerDown(screen.getByRole("button", { name: "icon-box" }), { clientX: 10, clientY: 10 });
    fireEvent.pointerMove(canvas, { clientX: 43, clientY: 79 });
    fireEvent.pointerUp(canvas, { clientX: 43, clientY: 79 });

    expect(screen.getByText("x: 40, y: 80")).toBeInTheDocument();
  });

  it("clears the selected instance when clicking empty canvas", () => {
    render(<App />);
    const canvas = screen.getByRole("img", { name: "Component builder canvas" }) as HTMLCanvasElement;
    vi.spyOn(canvas, "getBoundingClientRect").mockReturnValue({
      bottom: 560,
      height: 560,
      left: 0,
      right: 800,
      top: 0,
      width: 800,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    });

    fireEvent.click(canvas, { clientX: 10, clientY: 10 });
    expect(screen.getByLabelText("Corner color")).toBeInTheDocument();

    fireEvent.click(canvas, { clientX: 240, clientY: 240 });

    expect(screen.queryByLabelText("Corner color")).not.toBeInTheDocument();
    expect(screen.getByText("Current instances")).toBeInTheDocument();
  });

  it("moves an existing instance with pointer drag at a snapped position", () => {
    render(<App />);
    const canvas = screen.getByRole("img", { name: "Component builder canvas" }) as HTMLCanvasElement;
    vi.spyOn(canvas, "getBoundingClientRect").mockReturnValue({
      bottom: 560,
      height: 560,
      left: 0,
      right: 800,
      top: 0,
      width: 800,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    });

    fireEvent.pointerDown(canvas, { clientX: 10, clientY: 10 });
    fireEvent.pointerMove(canvas, { clientX: 130, clientY: 90 });
    fireEvent.pointerUp(canvas, { clientX: 130, clientY: 90 });

    expect(screen.getByLabelText("Corner color")).toBeInTheDocument();
    expect(screen.getByText("x: 120, y: 80")).toBeInTheDocument();
  });

  it("selects, configures, backs out, and removes an icon-box instance", () => {
    render(<App />);
    const canvas = screen.getByRole("img", { name: "Component builder canvas" }) as HTMLCanvasElement;
    vi.spyOn(canvas, "getBoundingClientRect").mockReturnValue({
      bottom: 560,
      height: 560,
      left: 0,
      right: 800,
      top: 0,
      width: 800,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    });

    fireEvent.click(canvas, { clientX: 10, clientY: 10 });
    fireEvent.change(screen.getByLabelText("Corner color"), { target: { value: "#abcdef" } });

    expect(screen.getByTestId("corner-color-preview")).toHaveStyle({ backgroundColor: "#abcdef" });
    fireEvent.click(screen.getByRole("button", { name: "Back" }));
    fireEvent.click(screen.getByRole("button", { name: "Delete icon-box" }));

    expect(screen.getByText("No components on canvas.")).toBeInTheDocument();
  });

  it("does not regenerate the grid on the main thread while editing dimensions", () => {
    render(<App />);
    const widthInput = screen.getByLabelText("Width");
    const initialMainThreadGenerations = vi.mocked(generateGrid).mock.calls.length;

    fireEvent.change(widthInput, { target: { value: "8000" } });

    expect(widthInput).toHaveValue(8000);
    expect(generateGrid).toHaveBeenCalledTimes(initialMainThreadGenerations);
    expect(workerInstances.at(-1)?.postMessage).toHaveBeenCalledWith({
      config: expect.objectContaining({
        width: 8000,
      }),
    });
  });

  it("shows a subtle spinner instead of generation text while a worker request is pending", () => {
    render(<App />);

    fireEvent.change(screen.getByLabelText("Width"), { target: { value: "8000" } });

    expect(screen.queryByText("Generating...")).not.toBeInTheDocument();
    expect(screen.getByRole("status", { name: "Generating grid" })).toHaveClass("generation-spinner");
  });
});
