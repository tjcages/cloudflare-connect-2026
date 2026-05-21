/** @vitest-environment jsdom */
import { act, render, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import Pixi from "./index";

const { initMock, resizeMock, renderMock, ApplicationMock, releaseInit } = vi.hoisted(() => {
  const initMock = vi.fn();
  const resizeMock = vi.fn();
  const renderMock = vi.fn();
  let resolveInit: (() => void) | null = null;

  class ApplicationMock {
    canvas = document.createElement("canvas");
    renderer = { resize: resizeMock };
    ticker = {};
    stage = {};

    init = initMock.mockImplementation(
      async (options: { width: number; height: number; canvas: HTMLCanvasElement }) => {
        this.canvas = options.canvas;
        await new Promise<void>((resolve) => {
          resolveInit = resolve;
        });
      },
    );

    render = renderMock;
    destroy = vi.fn();
  }

  return {
    initMock,
    resizeMock,
    renderMock,
    ApplicationMock,
    releaseInit: () => {
      resolveInit?.();
      resolveInit = null;
    },
  };
});

vi.mock("pixi.js", () => ({
  Application: ApplicationMock,
  WebGLRenderer: class WebGLRenderer {},
}));

describe("Pixi", () => {
  beforeEach(() => {
    initMock.mockClear();
    resizeMock.mockClear();
    renderMock.mockClear();
  });

  afterEach(() => {
    releaseInit();
  });

  it("applies the latest layout size after async init completes", async () => {
    const { rerender } = render(<Pixi tickers={[]} layoutWidth={641} layoutHeight={561} />);

    await waitFor(() => {
      expect(initMock).toHaveBeenCalledWith(
        expect.objectContaining({
          width: 641,
          height: 561,
        }),
      );
    });

    rerender(<Pixi tickers={[]} layoutWidth={801} layoutHeight={721} />);

    await act(async () => {
      releaseInit();
    });

    expect(resizeMock).toHaveBeenCalledWith(801, 721, 1);
    const canvas = document.querySelector("canvas");
    expect(canvas?.style.width).toBe("801px");
    expect(canvas?.style.height).toBe("721px");
  });
});
