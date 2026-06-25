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
    expect(createStripesEngine).toHaveBeenCalledWith(canvas);
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
});
