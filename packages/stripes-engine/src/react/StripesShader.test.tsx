import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, cleanup } from "@testing-library/react";
import { StripesShader } from "./StripesShader";

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

import { createStripesEngine } from "../engine";

beforeEach(() => {
  vi.clearAllMocks();
  cleanup();
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

  it("applies the config and resizes when width/height are given", () => {
    const config = { stripesEnabled: true, colors: { mode: "colors" as const } };
    render(<StripesShader src="logo.png" config={config} width={320} height={240} />);
    expect(engineStub.setConfig).toHaveBeenCalledWith(config);
    expect(engineStub.resize).toHaveBeenCalledWith(320, 240);
  });

  it("disposes the engine on unmount", () => {
    const { unmount } = render(<StripesShader src="logo.png" />);
    unmount();
    expect(engineStub.dispose).toHaveBeenCalled();
  });
});
