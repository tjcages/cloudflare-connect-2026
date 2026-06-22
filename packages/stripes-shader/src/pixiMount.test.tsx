/** @vitest-environment jsdom */
import { act, render, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import Pixi from "./pixiMount";

const { initMock, resizeMock, renderMock, destroyMock, ApplicationMock, releaseInit } = vi.hoisted(() => {
  const initMock = vi.fn();
  const resizeMock = vi.fn();
  const renderMock = vi.fn();
  const destroyMock = vi.fn();
  let resolveInit: (() => void) | null = null;

  class ApplicationMock {
    canvas = document.createElement("canvas");
    // Real Pixi leaves `renderer` undefined until `init` resolves; mirror that so the
    // unmount-during-init path is exercised faithfully (isDestroyed → true mid-init).
    renderer: { resize: typeof resizeMock; resolution: number } | undefined = undefined;
    ticker = { stop: vi.fn() };
    stage = {};

    init = initMock.mockImplementation(
      async (options: { width: number; height: number; canvas: HTMLCanvasElement }) => {
        this.canvas = options.canvas;
        await new Promise<void>((resolve) => {
          resolveInit = resolve;
        });
        this.renderer = { resize: resizeMock, resolution: 1 };
      },
    );

    render = renderMock;
    destroy = destroyMock;
  }

  return {
    initMock,
    resizeMock,
    renderMock,
    destroyMock,
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
    destroyMock.mockClear();
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

  it("remounts with a fresh canvas when the React key changes", async () => {
    const ticker = vi.fn();
    const { rerender } = render(<Pixi key="scene-a" tickers={[ticker]} layoutWidth={640} layoutHeight={360} />);

    await waitFor(() => {
      expect(initMock).toHaveBeenCalledTimes(1);
    });

    await act(async () => {
      releaseInit();
    });

    expect(ticker).toHaveBeenCalledTimes(1);
    const canvas = document.querySelector("canvas");

    rerender(<Pixi key="scene-b" tickers={[ticker]} layoutWidth={1280} layoutHeight={720} />);

    await waitFor(() => {
      expect(initMock).toHaveBeenCalledTimes(2);
    });

    await act(async () => {
      releaseInit();
    });

    expect(ticker).toHaveBeenCalledTimes(2);
    expect(document.querySelector("canvas")).not.toBe(canvas);
  });

  it("destroys the app when unmounted before async init resolves (no leaked WebGL context)", async () => {
    const { unmount } = render(<Pixi key="scene-a" tickers={[]} layoutWidth={640} layoutHeight={360} />);

    await waitFor(() => {
      expect(initMock).toHaveBeenCalledTimes(1);
    });

    // Unmount while init is still pending — at this point the renderer is undefined,
    // so the synchronous cleanup cannot destroy the app yet.
    unmount();
    expect(destroyMock).not.toHaveBeenCalled();

    // Once the in-flight init resolves and produces a real context, it must be torn down.
    await act(async () => {
      releaseInit();
    });

    await waitFor(() => {
      expect(destroyMock).toHaveBeenCalledTimes(1);
    });
  });

  it("notifies onContextLost (and preventDefaults) when the canvas loses its WebGL context", async () => {
    const onContextLost = vi.fn();
    render(<Pixi tickers={[]} layoutWidth={640} layoutHeight={360} onContextLost={onContextLost} />);

    await waitFor(() => {
      expect(initMock).toHaveBeenCalledTimes(1);
    });

    const canvas = document.querySelector("canvas");
    expect(canvas).not.toBeNull();
    const event = new Event("webglcontextlost", { cancelable: true });
    canvas?.dispatchEvent(event);

    expect(onContextLost).toHaveBeenCalledTimes(1);
    expect(event.defaultPrevented).toBe(true);
  });
});
