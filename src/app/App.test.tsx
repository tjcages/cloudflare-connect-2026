import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { generateGrid } from "../grid/generator";
import { App } from "./App";

vi.mock("../grid/generator", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../grid/generator")>();

  return {
    ...actual,
    generateGrid: vi.fn(actual.generateGrid),
  };
});

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
    workerInstances.length = 0;
    vi.stubGlobal("Worker", vi.fn(function WorkerMock() {
      return createTestWorker();
    }));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("copies SVG with the configured stroke color", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", {
      clipboard: {
        writeText,
      },
    });
    render(<App />);

    fireEvent.change(screen.getByLabelText("Stroke color"), { target: { value: "#123456" } });
    await act(async () => {
      resolveLatestWorker();
    });
    fireEvent.click(screen.getByRole("button", { name: "Copy as SVG" }));

    await waitFor(() => {
      expect(writeText).toHaveBeenCalledWith(expect.stringContaining('stroke="#123456"'));
    });
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
