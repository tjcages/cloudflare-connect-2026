import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { MainToWorkerMessage, WorkerToMainMessage } from "./protocol";
import { REVEAL_VIEWPORT_ROOT_MARGIN, type GateRect } from "../core/visibility";

type Listener = (event: { data: WorkerToMainMessage }) => void;

const { workerPosts, workerListeners } = vi.hoisted(() => ({
  workerPosts: [] as MainToWorkerMessage[],
  workerListeners: [] as Listener[],
}));

vi.mock("./sharedWorker?worker&inline", () => ({
  default: class {
    postMessage(message: MainToWorkerMessage) {
      workerPosts.push(message);
    }
    addEventListener(_type: string, listener: Listener) {
      workerListeners.push(listener);
    }
    removeEventListener(_type: string, listener: Listener) {
      const i = workerListeners.indexOf(listener);
      if (i >= 0) workerListeners.splice(i, 1);
    }
    terminate() {}
  },
}));

import { registerSharedShader } from "./coordinator";
import { subscribeStripesStats, type StripesStats } from "./stats";

type ObserverStub = {
  options: IntersectionObserverInit | undefined;
  observed: Element[];
  disconnected: boolean;
  emit(entries: Partial<IntersectionObserverEntry>[]): void;
};

let observers: ObserverStub[] = [];
let handles: { unregister(): void }[] = [];

const VIEWPORT_HEIGHT = 800;
const VIEWPORT: GateRect = { top: 0, left: 0, right: 1200, bottom: VIEWPORT_HEIGHT };
const SHRUNK_VIEWPORT: GateRect = { top: 200, left: 0, right: 1200, bottom: 600 };

function emit(message: WorkerToMainMessage): void {
  for (const listener of [...workerListeners]) listener({ data: message });
}

function registeredId(): string {
  const register = workerPosts.find((message) => message.type === "register");
  if (!register || register.type !== "register") throw new Error("no register message");
  return register.id;
}

/** The observers a single registration creates, in construction order. */
function gates() {
  const [render, reveal, revealViewport, preload] = observers;
  return { render, reveal, revealViewport, preload };
}

function rect(top: number, height: number, left = 0, width = 400) {
  return { top, bottom: top + height, left, right: left + width, width, height, x: left, y: top };
}

/** An entry as an observer rooted at `root` would report it. */
function entryFor(element: ReturnType<typeof rect>, root: GateRect) {
  const visibleHeight = Math.max(0, Math.min(element.bottom, root.bottom) - Math.max(element.top, root.top));
  const visibleWidth = Math.max(0, Math.min(element.right, root.right) - Math.max(element.left, root.left));
  return {
    boundingClientRect: element as unknown as DOMRectReadOnly,
    rootBounds: root as unknown as DOMRectReadOnly,
    isIntersecting: visibleHeight > 0 && visibleWidth > 0,
  } satisfies Partial<IntersectionObserverEntry>;
}

/** Scroll the element to `top` and let every gate observe it, as a real scroll would. */
function scrollTo(top: number, height: number): void {
  const element = rect(top, height);
  gates().render.emit([entryFor(element, VIEWPORT)]);
  gates().reveal.emit([entryFor(element, VIEWPORT)]);
  gates().revealViewport.emit([entryFor(element, SHRUNK_VIEWPORT)]);
}

function gateMessages() {
  return workerPosts.filter((message) => message.type === "revealGate");
}

function visibilityMessages() {
  return workerPosts.filter((message) => message.type === "visibility");
}

beforeEach(() => {
  workerPosts.length = 0;
  workerListeners.length = 0;
  observers = [];
  handles = [];
  vi.stubGlobal(
    "IntersectionObserver",
    class {
      stub: ObserverStub;
      constructor(callback: IntersectionObserverCallback, options?: IntersectionObserverInit) {
        this.stub = {
          options,
          observed: [],
          disconnected: false,
          emit: (entries) => callback(entries as IntersectionObserverEntry[], this as unknown as IntersectionObserver),
        };
        observers.push(this.stub);
      }
      observe(target: Element) {
        this.stub.observed.push(target);
      }
      unobserve() {}
      disconnect() {
        this.stub.disconnected = true;
      }
    },
  );
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
});

afterEach(() => {
  for (const handle of handles) handle.unregister();
  handles = [];
  vi.unstubAllGlobals();
});

function register(opts: Partial<Parameters<typeof registerSharedShader>[0]> = {}) {
  const handle = registerSharedShader({
    canvas: document.createElement("canvas"),
    src: "logo.png",
    mediaKind: "image",
    ...opts,
  });
  handles.push(handle);
  return handle;
}

describe("shared coordinator gate wiring", () => {
  it("splits the render gate from the reveal gate, observing the canvas with both", () => {
    const handle = register();
    const canvas = gates().render.observed[0];

    expect(gates().render.options?.rootMargin).toBe("0px");
    expect(gates().reveal.options?.rootMargin).toBe("0px");
    expect(gates().reveal.options?.threshold).toEqual([0, 0.25]);
    expect(gates().revealViewport.options?.rootMargin).toBe(REVEAL_VIEWPORT_ROOT_MARGIN);
    expect(gates().preload.options?.rootMargin).toBe("200% 0px");
    for (const gate of Object.values(gates())) expect(gate.observed).toEqual([canvas]);

    handle.unregister();
  });

  it("keeps rootMargin a public prop for the render gate without widening the reveal gate", () => {
    const handle = register({ rootMargin: "300% 0px", preloadRootMargin: "50% 0px" });
    expect(gates().render.options?.rootMargin).toBe("300% 0px");
    expect(gates().reveal.options?.rootMargin).toBe("0px");
    expect(gates().revealViewport.options?.rootMargin).toBe(REVEAL_VIEWPORT_ROOT_MARGIN);
    expect(gates().preload.options?.rootMargin).toBe("50% 0px");
    handle.unregister();
  });

  it("disconnects every gate on unregister", () => {
    const handle = register();
    handle.unregister();
    for (const gate of Object.values(gates())) expect(gate.disconnected).toBe(true);
  });
});

describe("render gate", () => {
  it("renders ambient animation at one visible pixel while the reveal is still held", () => {
    const handle = register();

    scrollTo(VIEWPORT_HEIGHT - 1, 400);

    expect(visibilityMessages()).toEqual([{ type: "visibility", id: registeredId(), visible: true }]);
    expect(gateMessages()).toEqual([]);

    handle.unregister();
  });

  it("stops rendering once nothing is on screen", () => {
    const handle = register();
    scrollTo(100, 400);
    scrollTo(VIEWPORT_HEIGHT + 50, 400);
    expect(visibilityMessages()).toEqual([
      { type: "visibility", id: registeredId(), visible: true },
      { type: "visibility", id: registeredId(), visible: false },
    ]);
    handle.unregister();
  });
});

describe("reveal gate", () => {
  it("opens once a quarter of a normal card is on screen, and closes again when it leaves", () => {
    const handle = register();
    const id = registeredId();

    scrollTo(VIEWPORT_HEIGHT - 99, 400);
    expect(gateMessages()).toEqual([]);

    scrollTo(VIEWPORT_HEIGHT - 100, 400);
    expect(gateMessages()).toEqual([{ type: "revealGate", id, open: true }]);

    scrollTo(VIEWPORT_HEIGHT + 20, 400);
    expect(gateMessages()).toEqual([
      { type: "revealGate", id, open: true },
      { type: "revealGate", id, open: false },
    ]);

    handle.unregister();
  });

  it("posts nothing while the gate state is unchanged, keeping scroll traffic low", () => {
    const handle = register();
    for (let top = VIEWPORT_HEIGHT - 100; top > 200; top -= 5) scrollTo(top, 400);
    expect(gateMessages()).toHaveLength(1);
    handle.unregister();
  });

  it("opens for an element five viewports tall, which no element-relative threshold could", () => {
    const handle = register();
    const id = registeredId();
    const tall = VIEWPORT_HEIGHT * 5;
    const element = rect(VIEWPORT_HEIGHT - 200, tall);

    // The element-relative observer is capped at intersectionRatio =
    // viewport/element = 0.2, so its `threshold: [0, 0.25]` delivers nothing
    // between entry and exit: it fires once at entry and then goes quiet.
    gates().reveal.emit([entryFor(rect(VIEWPORT_HEIGHT - 1, tall), VIEWPORT)]);
    expect(gateMessages()).toEqual([]);

    // Only the viewport-relative observer fires at the crossing, and that alone
    // opens the gate — without it this element would hold its reveal forever.
    gates().revealViewport.emit([entryFor(element, SHRUNK_VIEWPORT)]);
    expect(gateMessages()).toEqual([{ type: "revealGate", id, open: true }]);

    handle.unregister();
  });

  it("holds a five-viewport-tall element until a quarter of the viewport is covered", () => {
    const handle = register();
    const tall = VIEWPORT_HEIGHT * 5;
    scrollTo(VIEWPORT_HEIGHT - 199, tall);
    expect(gateMessages()).toEqual([]);
    scrollTo(VIEWPORT_HEIGHT - 200, tall);
    expect(gateMessages()).toEqual([{ type: "revealGate", id: registeredId(), open: true }]);
    handle.unregister();
  });

  it("falls back to the document viewport when rootBounds is null", () => {
    const root = document.documentElement;
    const width = Object.getOwnPropertyDescriptor(root, "clientWidth");
    const height = Object.getOwnPropertyDescriptor(root, "clientHeight");
    Object.defineProperty(root, "clientWidth", { value: 1200, configurable: true });
    Object.defineProperty(root, "clientHeight", { value: VIEWPORT_HEIGHT, configurable: true });

    const handle = register();
    gates().reveal.emit([
      { boundingClientRect: rect(100, 400) as unknown as DOMRectReadOnly, rootBounds: null, isIntersecting: true },
    ]);
    expect(gateMessages()).toEqual([{ type: "revealGate", id: registeredId(), open: true }]);

    handle.unregister();
    if (width) Object.defineProperty(root, "clientWidth", width);
    if (height) Object.defineProperty(root, "clientHeight", height);
  });
});

describe("shared coordinator water activity", () => {
  it("routes a waterActivity message to the registering instance's callback", () => {
    const onWaterActivity = vi.fn();
    const handle = register({ onWaterActivity });

    emit({ type: "waterActivity", id: registeredId(), activity: 0.37 });
    expect(onWaterActivity).toHaveBeenCalledWith(0.37);

    handle.unregister();
  });

  it("ignores water activity for unknown or unregistered instances", () => {
    const onWaterActivity = vi.fn();
    const handle = register({ onWaterActivity });
    const id = registeredId();

    emit({ type: "waterActivity", id: "shared-nope", activity: 0.5 });
    expect(onWaterActivity).not.toHaveBeenCalled();

    handle.unregister();
    emit({ type: "waterActivity", id, activity: 0.5 });
    expect(onWaterActivity).not.toHaveBeenCalled();
  });
});

describe("shared coordinator export readback", () => {
  it("routes a live cell-grid response back to the requesting handle", async () => {
    const handle = register();
    const id = registeredId();
    const pending = handle.readCellGrid();
    const request = workerPosts.find((message) => message.type === "cellGridRequest");
    expect(request).toMatchObject({ type: "cellGridRequest", id });
    if (!request || request.type !== "cellGridRequest") throw new Error("no cell-grid request");

    const values = new Uint8Array([0, 127, 255]);
    emit({
      type: "cellGridResponse",
      id,
      requestId: request.requestId,
      cols: 3,
      rows: 1,
      values,
      colors: null,
    });

    await expect(pending).resolves.toEqual({ cols: 3, rows: 1, values, colors: null });
    handle.unregister();
  });
});

describe("shared coordinator stats", () => {
  beforeEach(() => {
    vi.useFakeTimers({
      toFake: ["setTimeout", "clearTimeout", "setInterval", "clearInterval", "Date", "performance"],
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  /** presentFrame needs a real 2d context to count a blit; happy-dom has none. */
  function canvasWith2d(): HTMLCanvasElement {
    const canvas = document.createElement("canvas");
    const ctx = { canvas, clearRect: () => {}, drawImage: () => {} };
    canvas.getContext = (() => ctx) as unknown as HTMLCanvasElement["getContext"];
    return canvas;
  }

  function fakeBitmap(): ImageBitmap {
    return { width: 8, height: 8, close: () => {} } as unknown as ImageBitmap;
  }

  it("stays silent until a subscriber attaches", () => {
    const handle = register();
    vi.advanceTimersByTime(2000);
    expect(workerPosts.some((message) => message.type === "statsRequest")).toBe(false);
    handle.unregister();
  });

  it("reports gate state, size and observed blit rate per instance", () => {
    const handle = register({ canvas: canvasWith2d(), label: "cta", config: { maxFps: 30 } });
    const id = registeredId();
    const seen: StripesStats[] = [];
    const unsubscribe = subscribeStripesStats((stats) => seen.push(stats), { intervalMs: 1000 });

    gates().render.emit([{ isIntersecting: true } as IntersectionObserverEntry]);
    emit({ type: "frame", frame: fakeBitmap(), slots: [{ id, sx: 0, sy: 0, width: 8, height: 8 }] });
    emit({ type: "frame", frame: fakeBitmap(), slots: [{ id, sx: 0, sy: 0, width: 8, height: 8 }] });

    vi.advanceTimersByTime(1000);
    expect(workerPosts.some((message) => message.type === "statsRequest")).toBe(true);
    emit({
      type: "stats",
      instances: [{ id, visible: true, hasSource: true, maxFps: 30, outputWidth: 3360, outputHeight: 1440 }],
    });

    const stats = seen.at(-1)!;
    expect(stats.total).toBe(1);
    expect(stats.rendering).toBe(1);
    expect(stats.paused).toBe(0);
    expect(stats.megapixelsPerFrame).toBeCloseTo(4.8384, 3);
    expect(stats.instances[0].label).toBe("cta");
    expect(stats.instances[0].maxFps).toBe(30);
    expect(stats.instances[0].fps).toBeCloseTo(2, 1);

    unsubscribe();
    handle.unregister();
  });

  it("counts a gated-off instance as paused and excludes it from the pixel budget", () => {
    const handle = register();
    const id = registeredId();
    const seen: StripesStats[] = [];
    const unsubscribe = subscribeStripesStats((stats) => seen.push(stats), { intervalMs: 1000 });

    vi.advanceTimersByTime(1000);
    emit({
      type: "stats",
      instances: [{ id, visible: false, hasSource: true, maxFps: 30, outputWidth: 1200, outputHeight: 800 }],
    });

    const stats = seen.at(-1)!;
    expect(stats.rendering).toBe(0);
    expect(stats.paused).toBe(1);
    expect(stats.megapixelsPerFrame).toBe(0);

    unsubscribe();
    handle.unregister();
  });

  it("reports an empty snapshot on a page where nothing has registered", () => {
    const seen: StripesStats[] = [];
    const unsubscribe = subscribeStripesStats((stats) => seen.push(stats), { intervalMs: 1000 });

    vi.advanceTimersByTime(1000);

    expect(seen.at(-1)).toMatchObject({ total: 0, rendering: 0, paused: 0, megapixelsPerFrame: 0 });
    expect(seen.at(-1)!.instances).toEqual([]);

    unsubscribe();
  });

  it("crops each packed slot out of the shared backbuffer when blitting", () => {
    const calls: unknown[][] = [];
    const canvas = document.createElement("canvas");
    const ctx = {
      canvas,
      clearRect: () => {},
      drawImage: (...args: unknown[]) => calls.push(args),
    };
    canvas.getContext = (() => ctx) as unknown as HTMLCanvasElement["getContext"];

    const handle = register({ canvas });
    const id = registeredId();
    const frame = { width: 900, height: 320, close: () => {} } as unknown as ImageBitmap;

    emit({ type: "frame", frame, slots: [{ id, sx: 0, sy: 180, width: 900, height: 140 }] });

    // The worker already flipped the slot into bitmap coordinates; the display
    // canvas takes the instance's own size.
    expect(canvas.width).toBe(900);
    expect(canvas.height).toBe(140);
    expect(calls).toEqual([[frame, 0, 180, 900, 140, 0, 0, 900, 140]]);

    handle.unregister();
  });

  it("closes a shared bitmap once, however many slots it carries", () => {
    let closed = 0;
    const first = register({ canvas: canvasWith2d() });
    const firstId = registeredId();
    const second = register({ canvas: canvasWith2d() });
    const secondId = registeredId();
    const frame = { width: 8, height: 16, close: () => closed++ } as unknown as ImageBitmap;

    emit({
      type: "frame",
      frame,
      slots: [
        { id: firstId, sx: 0, sy: 8, width: 8, height: 8 },
        { id: secondId, sx: 0, sy: 0, width: 8, height: 8 },
      ],
    });

    expect(closed).toBe(1);

    first.unregister();
    second.unregister();
  });

  it("stops polling the worker once the last subscriber detaches", () => {
    const handle = register();
    const unsubscribe = subscribeStripesStats(() => {}, { intervalMs: 1000 });
    vi.advanceTimersByTime(1000);
    unsubscribe();

    const before = workerPosts.filter((message) => message.type === "statsRequest").length;
    vi.advanceTimersByTime(5000);
    expect(workerPosts.filter((message) => message.type === "statsRequest").length).toBe(before);

    handle.unregister();
  });
});
