import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { render, cleanup } from "@testing-library/react";

const engineStub = {
  start: vi.fn(),
  stop: vi.fn(),
  settle: vi.fn(),
  setConfig: vi.fn(),
  setSource: vi.fn(),
  triggerReveal: vi.fn(),
  resize: vi.fn(),
  dispose: vi.fn(),
  renderFrame: vi.fn(),
};

vi.mock("../engine", () => ({
  createStripesEngine: vi.fn(() => engineStub),
}));

const sharedHandleStub = {
  setConfig: vi.fn(),
  triggerReveal: vi.fn(),
  unregister: vi.fn(),
};
const registerSharedShader = vi.fn(() => sharedHandleStub);

vi.mock("../shared/coordinator", () => ({
  registerSharedShader,
}));

import { StripesShader } from "./StripesShader";
import { createStripesEngine } from "../engine";

const images: HTMLImageElement[] = [];

type ObserverStub = {
  callback: IntersectionObserverCallback;
  options: IntersectionObserverInit | undefined;
  observed: Element[];
  disconnected: boolean;
};
let observers: ObserverStub[] = [];

/** Deliver an intersection change to every live observer, as the browser would. */
function setIntersecting(isIntersecting: boolean): void {
  for (const observer of observers) {
    if (observer.disconnected) continue;
    const entries = observer.observed.map((target) => ({ target, isIntersecting })) as unknown[];
    observer.callback(entries as IntersectionObserverEntry[], null as unknown as IntersectionObserver);
  }
}

beforeEach(() => {
  vi.clearAllMocks();
  images.length = 0;
  observers = [];
  vi.stubGlobal(
    "IntersectionObserver",
    class {
      stub: ObserverStub;
      constructor(callback: IntersectionObserverCallback, options?: IntersectionObserverInit) {
        this.stub = { callback, options, observed: [], disconnected: false };
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
  const OrigImage = globalThis.Image;
  vi.stubGlobal(
    "Image",
    class extends OrigImage {
      constructor() {
        super();
        images.push(this as unknown as HTMLImageElement);
      }
    },
  );
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("<StripesShader>", () => {
  it("shares one context by default, without a sharedContext prop", async () => {
    render(<StripesShader src="logo.png" />);
    await vi.waitFor(() => expect(registerSharedShader).toHaveBeenCalledTimes(1));
    expect(createStripesEngine).not.toHaveBeenCalled();
  });

  it("mounts a canvas and creates + starts the engine", () => {
    const { container } = render(<StripesShader src="logo.png" sharedContext={false} />);
    const canvas = container.querySelector("canvas");
    expect(canvas).not.toBeNull();
    expect(createStripesEngine).toHaveBeenCalledTimes(1);
    expect(createStripesEngine).toHaveBeenCalledWith(canvas, {
      onWaterActivity: expect.any(Function),
    });
    expect(engineStub.start).toHaveBeenCalled();
  });

  it("applies the config and sizes the canvas from width/height props", () => {
    const config = { stripesEnabled: true, colors: { mode: "colors" as const } };
    const { container } = render(
      <StripesShader src="logo.png" sharedContext={false} config={config} width={320} height={240} />,
    );
    expect(engineStub.setConfig).toHaveBeenCalledWith(config);
    const canvas = container.querySelector("canvas")!;
    expect(canvas.style.width).toBe("320px");
    expect(canvas.style.height).toBe("240px");
  });

  it("loads the image source and calls setSource on load", () => {
    render(<StripesShader src="logo.png" sharedContext={false} />);
    expect(images.length).toBe(1);
    images[0].dispatchEvent(new Event("load"));
    expect(engineStub.setSource).toHaveBeenCalledWith(images[0]);
  });

  it("disposes the engine and disconnects the render gate on unmount", () => {
    const { unmount } = render(<StripesShader src="logo.png" sharedContext={false} />);
    unmount();
    expect(engineStub.dispose).toHaveBeenCalled();
    expect(observers[0].disconnected).toBe(true);
  });

  it("standalone observes the canvas with rootMargin, defaulting to the shared default", () => {
    const { container, unmount } = render(<StripesShader src="logo.png" sharedContext={false} />);
    expect(observers).toHaveLength(1);
    expect(observers[0].options?.rootMargin).toBe("200% 0px");
    expect(observers[0].observed).toEqual([container.querySelector("canvas")]);
    unmount();

    render(<StripesShader src="logo.png" sharedContext={false} rootMargin="0px" />);
    expect(observers[1].options?.rootMargin).toBe("0px");
  });

  it("standalone pauses the render loop when the canvas leaves the gate and resumes on return", () => {
    render(<StripesShader src="logo.png" sharedContext={false} />);
    engineStub.start.mockClear();

    setIntersecting(false);
    expect(engineStub.stop).toHaveBeenCalledTimes(1);
    expect(engineStub.start).not.toHaveBeenCalled();

    setIntersecting(true);
    expect(engineStub.start).toHaveBeenCalledTimes(1);
    expect(engineStub.stop).toHaveBeenCalledTimes(1);
  });

  it("standalone keeps the context and the reveal across a pause/resume cycle", () => {
    render(<StripesShader src="logo.png" sharedContext={false} />);
    images[0].dispatchEvent(new Event("load"));
    engineStub.setSource.mockClear();

    engineStub.start.mockClear();
    setIntersecting(false);
    setIntersecting(true);
    expect(engineStub.stop).toHaveBeenCalledTimes(1);
    expect(engineStub.start).toHaveBeenCalledTimes(1);

    // A resumed instance continues: no second context, no re-load of the source
    // and no fresh reveal trigger — only the paused loop is re-armed.
    expect(createStripesEngine).toHaveBeenCalledTimes(1);
    expect(engineStub.dispose).not.toHaveBeenCalled();
    expect(engineStub.setSource).not.toHaveBeenCalled();
    expect(engineStub.triggerReveal).not.toHaveBeenCalled();
    expect(images).toHaveLength(1);
  });

  it("standalone re-observes on a rootMargin change without recreating the engine", () => {
    const { rerender } = render(<StripesShader src="logo.png" sharedContext={false} rootMargin="200% 0px" />);
    rerender(<StripesShader src="logo.png" sharedContext={false} rootMargin="0px" />);
    expect(observers[0].disconnected).toBe(true);
    expect(observers[1].options?.rootMargin).toBe("0px");
    expect(createStripesEngine).toHaveBeenCalledTimes(1);
    expect(engineStub.dispose).not.toHaveBeenCalled();
  });

  it("shared mode leaves the render gate to the coordinator", async () => {
    render(<StripesShader src="logo.png" />);
    await vi.waitFor(() => expect(registerSharedShader).toHaveBeenCalled());
    expect(observers).toHaveLength(0);
  });

  it("shared mode forwards rootMargin and preloadRootMargin to registerSharedShader", async () => {
    render(<StripesShader src="logo.png" sharedContext rootMargin="10% 0px" preloadRootMargin="200% 0px" />);
    await vi.waitFor(() => expect(registerSharedShader).toHaveBeenCalled());
    expect(registerSharedShader).toHaveBeenCalledWith(
      expect.objectContaining({ rootMargin: "10% 0px", preloadRootMargin: "200% 0px" }),
    );
  });

  it("shared mode forwards onWaterActivity to registerSharedShader", async () => {
    const onWaterActivity = vi.fn();
    render(<StripesShader src="logo.png" sharedContext onWaterActivity={onWaterActivity} />);
    await vi.waitFor(() => expect(registerSharedShader).toHaveBeenCalled());
    const opts = registerSharedShader.mock.calls[0][0] as { onWaterActivity?: (activity: number) => void };
    expect(opts.onWaterActivity).toBeTypeOf("function");
    opts.onWaterActivity?.(0.42);
    expect(onWaterActivity).toHaveBeenCalledWith(0.42);
  });

  it("shared mode reads onWaterActivity through a ref so a new handler identity is honored", async () => {
    const first = vi.fn();
    const second = vi.fn();
    const { rerender } = render(<StripesShader src="logo.png" sharedContext onWaterActivity={first} />);
    await vi.waitFor(() => expect(registerSharedShader).toHaveBeenCalled());
    const opts = registerSharedShader.mock.calls[0][0] as { onWaterActivity?: (activity: number) => void };
    rerender(<StripesShader src="logo.png" sharedContext onWaterActivity={second} />);
    opts.onWaterActivity?.(0.8);
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledWith(0.8);
    expect(registerSharedShader).toHaveBeenCalledTimes(1);
  });

  it("resolves the dark theme before calling setConfig", () => {
    const config = { stripesEnabled: false, renderColorA: 0x222222, dark: { renderColorA: 0x101010 } };
    render(<StripesShader src="logo.png" sharedContext={false} config={config} theme="dark" />);
    expect(engineStub.setConfig).toHaveBeenCalledWith({ stripesEnabled: false, renderColorA: 0x101010 });
  });

  it("strips dark for the default light theme", () => {
    const config = { renderColorA: 0x222222, dark: { renderColorA: 0x101010 } };
    render(<StripesShader src="logo.png" sharedContext={false} config={config} />);
    expect(engineStub.setConfig).toHaveBeenCalledWith({ renderColorA: 0x222222 });
  });

  it("recolors in place when the theme prop flips", () => {
    const config = { renderColorA: 0x222222, dark: { renderColorA: 0x101010 } };
    const { rerender } = render(<StripesShader src="logo.png" sharedContext={false} config={config} theme="light" />);
    engineStub.setConfig.mockClear();
    rerender(<StripesShader src="logo.png" sharedContext={false} config={config} theme="dark" />);
    expect(engineStub.setConfig).toHaveBeenCalledWith({ renderColorA: 0x101010 });
  });

  it("shared mode passes the resolved config to registerSharedShader and setConfig", async () => {
    const config = { renderColorA: 0x222222, dark: { renderColorA: 0x101010 } };
    render(<StripesShader src="logo.png" sharedContext config={config} theme="dark" />);
    await vi.waitFor(() => expect(registerSharedShader).toHaveBeenCalled());
    expect(registerSharedShader).toHaveBeenCalledWith(expect.objectContaining({ config: { renderColorA: 0x101010 } }));
    expect(sharedHandleStub.setConfig).toHaveBeenCalledWith({ renderColorA: 0x101010 });
  });
});
