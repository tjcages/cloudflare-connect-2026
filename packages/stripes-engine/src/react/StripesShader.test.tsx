import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { render, cleanup } from "@testing-library/react";

const engineStub = {
  start: vi.fn(),
  stop: vi.fn(),
  setConfig: vi.fn(),
  setSource: vi.fn(),
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

beforeEach(() => {
  vi.clearAllMocks();
  images.length = 0;
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
  it("mounts a canvas and creates + starts the engine", () => {
    const { container } = render(<StripesShader src="logo.png" />);
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
    const { container } = render(<StripesShader src="logo.png" config={config} width={320} height={240} />);
    expect(engineStub.setConfig).toHaveBeenCalledWith(config);
    const canvas = container.querySelector("canvas")!;
    expect(canvas.style.width).toBe("320px");
    expect(canvas.style.height).toBe("240px");
  });

  it("loads the image source and calls setSource on load", () => {
    render(<StripesShader src="logo.png" />);
    expect(images.length).toBe(1);
    images[0].dispatchEvent(new Event("load"));
    expect(engineStub.setSource).toHaveBeenCalledWith(images[0]);
  });

  it("disposes the engine on unmount", () => {
    const { unmount } = render(<StripesShader src="logo.png" />);
    unmount();
    expect(engineStub.dispose).toHaveBeenCalled();
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
    render(<StripesShader src="logo.png" config={config} theme="dark" />);
    expect(engineStub.setConfig).toHaveBeenCalledWith({ stripesEnabled: false, renderColorA: 0x101010 });
  });

  it("strips dark for the default light theme", () => {
    const config = { renderColorA: 0x222222, dark: { renderColorA: 0x101010 } };
    render(<StripesShader src="logo.png" config={config} />);
    expect(engineStub.setConfig).toHaveBeenCalledWith({ renderColorA: 0x222222 });
  });

  it("recolors in place when the theme prop flips", () => {
    const config = { renderColorA: 0x222222, dark: { renderColorA: 0x101010 } };
    const { rerender } = render(<StripesShader src="logo.png" config={config} theme="light" />);
    engineStub.setConfig.mockClear();
    rerender(<StripesShader src="logo.png" config={config} theme="dark" />);
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
