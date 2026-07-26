import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { render, cleanup } from "@testing-library/react";

const sharedHandleStub = {
  setConfig: vi.fn(),
  triggerReveal: vi.fn(),
  unregister: vi.fn(),
};
const registerSharedShader = vi.fn(() => sharedHandleStub);

vi.mock("../shared/coordinator", () => ({
  registerSharedShader,
}));

const createStripesEngine = vi.fn();
vi.mock("../engine", () => ({
  createStripesEngine,
}));

import { StripesShader } from "./StripesShader";

type ObserverStub = {
  callback: IntersectionObserverCallback;
  options: IntersectionObserverInit | undefined;
  observed: Element[];
  disconnected: boolean;
};
let observers: ObserverStub[] = [];

beforeEach(() => {
  vi.clearAllMocks();
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
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("<StripesShader>", () => {
  it("mounts a canvas and registers with the shared coordinator", async () => {
    const { container } = render(<StripesShader src="logo.png" />);
    const canvas = container.querySelector("canvas");
    expect(canvas).not.toBeNull();
    await vi.waitFor(() => expect(registerSharedShader).toHaveBeenCalledTimes(1));
    expect(registerSharedShader).toHaveBeenCalledWith(expect.objectContaining({ canvas, src: "logo.png" }));
  });

  it("never touches the main-thread engine, so it stays out of the React entry's static graph", async () => {
    render(<StripesShader src="logo.png" />);
    await vi.waitFor(() => expect(registerSharedShader).toHaveBeenCalled());
    expect(createStripesEngine).not.toHaveBeenCalled();
  });

  it("sizes the canvas from the width/height props", () => {
    const { container } = render(<StripesShader src="logo.png" width={320} height={240} />);
    const canvas = container.querySelector("canvas")!;
    expect(canvas.style.width).toBe("320px");
    expect(canvas.style.height).toBe("240px");
  });

  it("leaves the render gate to the coordinator, observing nothing itself", async () => {
    render(<StripesShader src="logo.png" />);
    await vi.waitFor(() => expect(registerSharedShader).toHaveBeenCalled());
    expect(observers).toHaveLength(0);
  });

  it("loads no media on the main thread, handing the source to the coordinator", async () => {
    render(<StripesShader src="logo.png" mediaKind="image" />);
    await vi.waitFor(() => expect(registerSharedShader).toHaveBeenCalled());
    expect(document.querySelector("video")).toBeNull();
    expect(registerSharedShader).toHaveBeenCalledWith(expect.objectContaining({ mediaKind: "image" }));
  });

  it("forwards rootMargin and preloadRootMargin to registerSharedShader", async () => {
    render(<StripesShader src="logo.png" rootMargin="10% 0px" preloadRootMargin="200% 0px" />);
    await vi.waitFor(() => expect(registerSharedShader).toHaveBeenCalled());
    expect(registerSharedShader).toHaveBeenCalledWith(
      expect.objectContaining({ rootMargin: "10% 0px", preloadRootMargin: "200% 0px" }),
    );
  });

  it("forwards revealDelayMs and the media playback props to registerSharedShader", async () => {
    render(
      <StripesShader
        src="clip.mp4"
        mediaKind="video"
        revealDelayMs={250}
        autoPlay={false}
        loop={false}
        muted={false}
      />,
    );
    await vi.waitFor(() => expect(registerSharedShader).toHaveBeenCalled());
    expect(registerSharedShader).toHaveBeenCalledWith(
      expect.objectContaining({
        mediaKind: "video",
        revealDelayMs: 250,
        autoPlay: false,
        loop: false,
        muted: false,
      }),
    );
  });

  it("forwards onWaterActivity to registerSharedShader", async () => {
    const onWaterActivity = vi.fn();
    render(<StripesShader src="logo.png" onWaterActivity={onWaterActivity} />);
    await vi.waitFor(() => expect(registerSharedShader).toHaveBeenCalled());
    const opts = registerSharedShader.mock.calls[0][0] as { onWaterActivity?: (activity: number) => void };
    expect(opts.onWaterActivity).toBeTypeOf("function");
    opts.onWaterActivity?.(0.42);
    expect(onWaterActivity).toHaveBeenCalledWith(0.42);
  });

  it("reads onWaterActivity through a ref so a new handler identity is honored", async () => {
    const first = vi.fn();
    const second = vi.fn();
    const { rerender } = render(<StripesShader src="logo.png" onWaterActivity={first} />);
    await vi.waitFor(() => expect(registerSharedShader).toHaveBeenCalled());
    const opts = registerSharedShader.mock.calls[0][0] as { onWaterActivity?: (activity: number) => void };
    rerender(<StripesShader src="logo.png" onWaterActivity={second} />);
    opts.onWaterActivity?.(0.8);
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledWith(0.8);
    expect(registerSharedShader).toHaveBeenCalledTimes(1);
  });

  it("resolves the dark theme before registering and calling setConfig", async () => {
    const config = { stripesEnabled: false, renderColorA: 0x222222, dark: { renderColorA: 0x101010 } };
    render(<StripesShader src="logo.png" config={config} theme="dark" />);
    await vi.waitFor(() => expect(registerSharedShader).toHaveBeenCalled());
    expect(registerSharedShader).toHaveBeenCalledWith(
      expect.objectContaining({ config: { stripesEnabled: false, renderColorA: 0x101010 } }),
    );
    expect(sharedHandleStub.setConfig).toHaveBeenCalledWith({ stripesEnabled: false, renderColorA: 0x101010 });
  });

  it("strips dark for the default light theme", async () => {
    const config = { renderColorA: 0x222222, dark: { renderColorA: 0x101010 } };
    render(<StripesShader src="logo.png" config={config} />);
    await vi.waitFor(() => expect(registerSharedShader).toHaveBeenCalled());
    expect(registerSharedShader).toHaveBeenCalledWith(expect.objectContaining({ config: { renderColorA: 0x222222 } }));
  });

  it("recolors in place when the theme prop flips", async () => {
    const config = { renderColorA: 0x222222, dark: { renderColorA: 0x101010 } };
    const { rerender } = render(<StripesShader src="logo.png" config={config} theme="light" />);
    await vi.waitFor(() => expect(registerSharedShader).toHaveBeenCalled());
    sharedHandleStub.setConfig.mockClear();
    rerender(<StripesShader src="logo.png" config={config} theme="dark" />);
    expect(sharedHandleStub.setConfig).toHaveBeenCalledWith({ renderColorA: 0x101010 });
    expect(registerSharedShader).toHaveBeenCalledTimes(1);
  });

  it("unregisters the shared instance on unmount", async () => {
    const { unmount } = render(<StripesShader src="logo.png" />);
    await vi.waitFor(() => expect(registerSharedShader).toHaveBeenCalled());
    unmount();
    expect(sharedHandleStub.unregister).toHaveBeenCalledTimes(1);
  });
});
