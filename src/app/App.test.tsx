import { act, createEvent, fireEvent, render, screen, waitFor } from "@testing-library/react";
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

  it("copies the composed canvas as PNG", async () => {
    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: "Copy PNG" }));

    await waitFor(() => {
      expect(copyDocumentPng).toHaveBeenCalledWith(
        expect.objectContaining({
          scale: 1,
          instances: expect.arrayContaining([expect.objectContaining({ type: "icon-box" })]),
        }),
      );
    });
  });

  it("copies the composed canvas as a 2x retina PNG", async () => {
    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: "Copy 2x Retina PNG" }));

    await waitFor(() => {
      expect(copyDocumentPng).toHaveBeenCalledWith(expect.objectContaining({ scale: 2 }));
    });
  });

  it("switches sidebar tabs without unmounting the canvas", () => {
    render(<App />);

    expect(screen.getByRole("img", { name: "Component builder canvas" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("tab", { name: "components" }));

    expect(screen.getByText("Current instances")).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Component builder canvas" })).toBeInTheDocument();
  });

  it("drops an icon-box onto the canvas at a snapped position", () => {
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

    const dropEvent = createEvent.drop(canvas);
    Object.defineProperty(dropEvent, "clientX", { value: 43 });
    Object.defineProperty(dropEvent, "clientY", { value: 79 });
    Object.defineProperty(dropEvent, "dataTransfer", {
      value: {
        getData: (type: string) => (type === "application/x-component-type" ? "icon-box" : ""),
      },
    });
    fireEvent(canvas, dropEvent);

    expect(screen.getByText("icon-box 2")).toBeInTheDocument();
    expect(screen.getByText("x: 40, y: 80")).toBeInTheDocument();
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
    fireEvent.click(screen.getByRole("button", { name: "Delete icon-box 1" }));

    expect(screen.queryByText("icon-box 1")).not.toBeInTheDocument();
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
