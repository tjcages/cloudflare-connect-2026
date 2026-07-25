import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { MainToWorkerMessage, WorkerToMainMessage } from "./protocol";
import type { SharedEngineOptions } from "../engine";

const engineStub = {
  resize: vi.fn(),
  setDpr: vi.fn(),
  outputWidth: 16,
  outputHeight: 16,
  renderFrame: vi.fn(),
  setFieldScale: vi.fn(),
  setSource: vi.fn(),
  updateSourceFrame: vi.fn(),
  setConfig: vi.fn(),
  setCursor: vi.fn(),
  click: vi.fn(),
  triggerReveal: vi.fn(),
  rebuild: vi.fn(),
  getPerf: vi.fn(),
  getWaterActivity: vi.fn(() => 0),
  dispose: vi.fn(),
  isP3: true,
  maxFps: 60,
};

const createStripesEngineShared = vi.fn((_opts: SharedEngineOptions) => engineStub);

vi.mock("../engine", () => ({ createStripesEngineShared }));

const fakeGl = {
  MAX_TEXTURE_SIZE: 0x0d33,
  getExtension: () => null,
  getParameter: () => 4096,
};

class FakeOffscreenCanvas {
  width: number;
  height: number;
  constructor(width: number, height: number) {
    this.width = width;
    this.height = height;
  }
  getContext() {
    return fakeGl;
  }
  addEventListener() {}
  transferToImageBitmap() {
    return {} as ImageBitmap;
  }
}

type Listener = (event: { data: MainToWorkerMessage }) => void;

let listeners: Listener[] = [];
let posted: WorkerToMainMessage[] = [];

function send(message: MainToWorkerMessage): void {
  for (const listener of listeners) listener({ data: message });
}

beforeEach(async () => {
  vi.clearAllMocks();
  listeners = [];
  posted = [];
  vi.resetModules();
  vi.stubGlobal("OffscreenCanvas", FakeOffscreenCanvas);
  vi.stubGlobal("self", {
    postMessage: (message: WorkerToMainMessage) => {
      posted.push(message);
    },
    addEventListener: (_type: string, listener: Listener) => {
      listeners.push(listener);
    },
    close: () => {},
  });
  await import("./sharedWorker");
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("shared worker water activity", () => {
  it("hands the shared engine an onWaterActivity callback on register", () => {
    send({ type: "register", id: "shared-0", cssWidth: 100, cssHeight: 100, dpr: 1 });
    expect(createStripesEngineShared).toHaveBeenCalledTimes(1);
    expect(createStripesEngineShared.mock.calls[0][0].onWaterActivity).toBeTypeOf("function");
  });

  it("posts a per-instance waterActivity message when the engine reports a change", () => {
    send({ type: "register", id: "shared-0", cssWidth: 100, cssHeight: 100, dpr: 1 });
    send({ type: "register", id: "shared-1", cssWidth: 100, cssHeight: 100, dpr: 1 });

    createStripesEngineShared.mock.calls[0][0].onWaterActivity?.(0.42);
    createStripesEngineShared.mock.calls[1][0].onWaterActivity?.(0.9);

    expect(posted).toContainEqual({ type: "waterActivity", id: "shared-0", activity: 0.42 });
    expect(posted).toContainEqual({ type: "waterActivity", id: "shared-1", activity: 0.9 });
  });

  it("posts nothing for water activity until the engine reports", () => {
    send({ type: "register", id: "shared-0", cssWidth: 100, cssHeight: 100, dpr: 1 });
    send({ type: "tick" });
    expect(posted.some((message) => message.type === "waterActivity")).toBe(false);
  });
});
