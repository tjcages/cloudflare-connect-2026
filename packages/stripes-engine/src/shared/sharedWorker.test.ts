import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { MainToWorkerMessage, WorkerToMainMessage } from "./protocol";
import type { SharedEngineOptions } from "../engine";
import { SHRINK_HOLD_TICKS } from "./surfaceSize";

const engineStub = {
  resize: vi.fn(),
  setDpr: vi.fn(),
  outputWidth: 16,
  outputHeight: 16,
  renderFrame: vi.fn(),
  setPresentOrigin: vi.fn(),
  setFieldScale: vi.fn(),
  setSource: vi.fn(),
  updateSourceFrame: vi.fn(),
  setConfig: vi.fn(),
  setCursor: vi.fn(),
  click: vi.fn(),
  triggerReveal: vi.fn(),
  setRevealGate: vi.fn(),
  settle: vi.fn(),
  rebuild: vi.fn(),
  getPerf: vi.fn(),
  readFramesOverlay: vi.fn(() => null),
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

  it("settles an instance when it goes invisible, and not when it comes back", () => {
    send({ type: "register", id: "shared-0", cssWidth: 100, cssHeight: 100, dpr: 1 });
    send({ type: "visibility", id: "shared-0", visible: true });
    expect(engineStub.settle).not.toHaveBeenCalled();

    send({ type: "visibility", id: "shared-0", visible: false });
    expect(engineStub.settle).toHaveBeenCalledTimes(1);

    send({ type: "visibility", id: "shared-0", visible: true });
    expect(engineStub.settle).toHaveBeenCalledTimes(1);
  });

  it("resuming an invisible instance does not replay its reveal", () => {
    send({ type: "register", id: "shared-0", cssWidth: 100, cssHeight: 100, dpr: 1 });
    send({ type: "visibility", id: "shared-0", visible: true });
    send({ type: "source", id: "shared-0", frame: {} as ImageBitmap, isStream: false });
    expect(engineStub.triggerReveal).toHaveBeenCalledTimes(1);

    send({ type: "visibility", id: "shared-0", visible: false });
    send({ type: "visibility", id: "shared-0", visible: true });
    expect(engineStub.triggerReveal).toHaveBeenCalledTimes(1);
  });
});

describe("shared worker reveal gate", () => {
  it("holds the reveal clock at register, since the coordinator owns both gates", () => {
    send({ type: "register", id: "shared-0", cssWidth: 100, cssHeight: 100, dpr: 1 });
    expect(engineStub.setRevealGate).toHaveBeenCalledTimes(1);
    expect(engineStub.setRevealGate).toHaveBeenCalledWith(false);
  });

  it("forwards the coordinator's gate changes to the engine", () => {
    send({ type: "register", id: "shared-0", cssWidth: 100, cssHeight: 100, dpr: 1 });
    engineStub.setRevealGate.mockClear();

    send({ type: "revealGate", id: "shared-0", open: true });
    send({ type: "revealGate", id: "shared-0", open: false });

    expect(engineStub.setRevealGate.mock.calls).toEqual([[true], [false]]);
  });

  it("opening the gate never triggers a reveal — it only lets the clock run", () => {
    send({ type: "register", id: "shared-0", cssWidth: 100, cssHeight: 100, dpr: 1 });
    send({ type: "revealGate", id: "shared-0", open: true });
    send({ type: "revealGate", id: "shared-0", open: false });
    send({ type: "revealGate", id: "shared-0", open: true });
    expect(engineStub.triggerReveal).not.toHaveBeenCalled();
  });

  it("renders an instance whose reveal is still held, so ambient animation never freezes", () => {
    send({ type: "register", id: "shared-0", cssWidth: 100, cssHeight: 100, dpr: 1 });
    send({ type: "visibility", id: "shared-0", visible: true });
    send({ type: "tick" });
    expect(engineStub.renderFrame).toHaveBeenCalled();
  });

  it("packs every instance of a tick into one bitmap, stacked and flipped to bitmap coordinates", () => {
    send({ type: "register", id: "shared-0", cssWidth: 16, cssHeight: 16, dpr: 1 });
    send({ type: "register", id: "shared-1", cssWidth: 16, cssHeight: 16, dpr: 1 });
    send({ type: "visibility", id: "shared-0", visible: true });
    send({ type: "visibility", id: "shared-1", visible: true });
    posted.length = 0;
    send({ type: "tick" });

    // The backbuffer snaps up to the 64px size quantum, so the 32px column sits
    // against the bottom of a 64px buffer and the flip counts down from there.
    const frames = posted.filter((message) => message.type === "frame");
    expect(frames).toHaveLength(1);
    expect(frames[0].slots).toEqual([
      { id: "shared-0", sx: 0, sy: 48, width: 16, height: 16 },
      { id: "shared-1", sx: 0, sy: 32, width: 16, height: 16 },
    ]);
    expect(engineStub.setPresentOrigin.mock.calls).toEqual([
      [0, 0],
      [0, 16],
    ]);
  });

  it("follows the backbuffer down once a smaller tick has settled", () => {
    engineStub.maxFps = 0;
    engineStub.outputWidth = 512;
    engineStub.outputHeight = 512;
    send({ type: "register", id: "shared-0", cssWidth: 512, cssHeight: 512, dpr: 1 });
    send({ type: "visibility", id: "shared-0", visible: true });
    send({ type: "tick" });
    engineStub.outputWidth = 16;
    engineStub.outputHeight = 16;
    send({ type: "register", id: "shared-1", cssWidth: 16, cssHeight: 16, dpr: 1 });
    send({ type: "visibility", id: "shared-1", visible: true });
    send({ type: "visibility", id: "shared-0", visible: false });

    posted.length = 0;
    send({ type: "tick" });
    const held = posted.filter((message) => message.type === "frame");
    expect(held[0].slots[0]).toEqual({ id: "shared-1", sx: 0, sy: 496, width: 16, height: 16 });

    for (let i = 0; i < SHRINK_HOLD_TICKS; i++) send({ type: "tick" });
    const shrunk = posted.filter((message) => message.type === "frame");
    expect(shrunk[shrunk.length - 1].slots[0]).toEqual({ id: "shared-1", sx: 0, sy: 48, width: 16, height: 16 });
    engineStub.maxFps = 60;
  });

  it("splits a tick into several bitmaps rather than growing the backbuffer without bound", () => {
    engineStub.outputWidth = 2048;
    engineStub.outputHeight = 1900;
    for (const id of ["shared-0", "shared-1", "shared-2", "shared-3"]) {
      send({ type: "register", id, cssWidth: 2048, cssHeight: 1900, dpr: 1 });
      send({ type: "visibility", id, visible: true });
    }
    posted.length = 0;
    send({ type: "tick" });

    // A third slot would put the column past both the pixel ceiling and the
    // 4096 texture limit, so the tick flushes in pairs; every instance still
    // gets exactly one slot.
    const frames = posted.filter((message) => message.type === "frame");
    expect(frames.map((frame) => frame.slots.length)).toEqual([2, 2]);
    expect(frames.flatMap((frame) => frame.slots.map((slot) => slot.id))).toEqual([
      "shared-0",
      "shared-1",
      "shared-2",
      "shared-3",
    ]);
    engineStub.outputWidth = 16;
    engineStub.outputHeight = 16;
  });

  it("ignores a gate message for an unknown instance", () => {
    send({ type: "revealGate", id: "shared-nope", open: true });
    expect(engineStub.setRevealGate).not.toHaveBeenCalled();
    expect(posted.some((message) => message.type === "error")).toBe(false);
  });
});
