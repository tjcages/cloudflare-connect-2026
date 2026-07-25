import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { MainToWorkerMessage, WorkerToMainMessage } from "./protocol";

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

function emit(message: WorkerToMainMessage): void {
  for (const listener of [...workerListeners]) listener({ data: message });
}

function registeredId(): string {
  const register = workerPosts.find((message) => message.type === "register");
  if (!register || register.type !== "register") throw new Error("no register message");
  return register.id;
}

beforeEach(() => {
  workerPosts.length = 0;
  workerListeners.length = 0;
  vi.stubGlobal(
    "IntersectionObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
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
  vi.unstubAllGlobals();
});

describe("shared coordinator water activity", () => {
  it("routes a waterActivity message to the registering instance's callback", () => {
    const onWaterActivity = vi.fn();
    const handle = registerSharedShader({
      canvas: document.createElement("canvas"),
      src: "logo.png",
      mediaKind: "image",
      onWaterActivity,
    });

    emit({ type: "waterActivity", id: registeredId(), activity: 0.37 });
    expect(onWaterActivity).toHaveBeenCalledWith(0.37);

    handle.unregister();
  });

  it("ignores water activity for unknown or unregistered instances", () => {
    const onWaterActivity = vi.fn();
    const handle = registerSharedShader({
      canvas: document.createElement("canvas"),
      src: "logo.png",
      mediaKind: "image",
      onWaterActivity,
    });
    const id = registeredId();

    emit({ type: "waterActivity", id: "shared-nope", activity: 0.5 });
    expect(onWaterActivity).not.toHaveBeenCalled();

    handle.unregister();
    emit({ type: "waterActivity", id, activity: 0.5 });
    expect(onWaterActivity).not.toHaveBeenCalled();
  });
});
