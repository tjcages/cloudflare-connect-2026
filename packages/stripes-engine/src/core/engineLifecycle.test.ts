import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createEngineLifecycle, type EngineLifecycleDeps } from "./engineLifecycle";

let pending: Map<number, FrameRequestCallback>;
let nextRafId: number;

function makeDeps(overrides: Partial<EngineLifecycleDeps> = {}) {
  return {
    frame: vi.fn(),
    onStart: vi.fn(),
    settle: vi.fn(),
    teardown: vi.fn(),
    supportsRaf: true,
    ...overrides,
  };
}

/** Run one queued rAF callback, as the browser would before the next paint. */
function flushFrame(): void {
  const [id, callback] = [...pending][0] ?? [];
  if (id === undefined || !callback) throw new Error("no frame armed");
  pending.delete(id);
  callback(0);
}

beforeEach(() => {
  pending = new Map();
  nextRafId = 1;
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
    const id = nextRafId++;
    pending.set(id, callback);
    return id;
  });
  vi.stubGlobal("cancelAnimationFrame", (id: number) => {
    pending.delete(id);
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("engine lifecycle", () => {
  it("arms the loop once and keeps re-arming it", () => {
    const deps = makeDeps();
    const lifecycle = createEngineLifecycle(deps);

    lifecycle.start();
    expect(deps.onStart).toHaveBeenCalledTimes(1);
    expect(pending.size).toBe(1);

    lifecycle.start();
    expect(deps.onStart).toHaveBeenCalledTimes(1);
    expect(pending.size).toBe(1);

    flushFrame();
    expect(deps.frame).toHaveBeenCalledTimes(1);
    expect(pending.size).toBe(1);
  });

  it("does not arm a loop on a surface without rAF", () => {
    const deps = makeDeps({ supportsRaf: false });
    createEngineLifecycle(deps).start();
    expect(pending.size).toBe(0);
    expect(deps.onStart).not.toHaveBeenCalled();
  });

  it("stop() cancels the loop AND settles", () => {
    const deps = makeDeps();
    const lifecycle = createEngineLifecycle(deps);
    lifecycle.start();

    lifecycle.stop();
    expect(pending.size).toBe(0);
    expect(deps.settle).toHaveBeenCalledTimes(1);
  });

  it("settles on stop() even when the loop was never running", () => {
    const deps = makeDeps();
    createEngineLifecycle(deps).stop();
    expect(deps.settle).toHaveBeenCalledTimes(1);
  });

  it("dispose() tears down WITHOUT settling — teardown must not call back into an unmounting host", () => {
    const deps = makeDeps();
    const lifecycle = createEngineLifecycle(deps);
    lifecycle.start();

    lifecycle.dispose();
    expect(pending.size).toBe(0);
    expect(deps.teardown).toHaveBeenCalledTimes(1);
    expect(deps.settle).not.toHaveBeenCalled();
  });

  it("settle() releases host state without touching the loop", () => {
    const deps = makeDeps();
    const lifecycle = createEngineLifecycle(deps);
    lifecycle.start();

    lifecycle.settle();
    expect(deps.settle).toHaveBeenCalledTimes(1);
    expect(pending.size).toBe(1);
    expect(deps.teardown).not.toHaveBeenCalled();
  });

  it("start() after stop() resumes the loop and never tears anything down", () => {
    const deps = makeDeps();
    const lifecycle = createEngineLifecycle(deps);
    lifecycle.start();
    lifecycle.stop();

    lifecycle.start();
    flushFrame();
    expect(deps.frame).toHaveBeenCalledTimes(1);
    expect(deps.onStart).toHaveBeenCalledTimes(2);
    expect(deps.teardown).not.toHaveBeenCalled();
  });
});
