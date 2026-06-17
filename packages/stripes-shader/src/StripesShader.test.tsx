/** @vitest-environment happy-dom */
import { render, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { StripesShader } from "./StripesShader";

// Mock pixi.js so we don't need a real WebGL environment.
// app.init never resolves → tickers never fire → no GPU code runs in tests.
// The <canvas> element is rendered as React JSX by pixiMount before init completes,
// so asserting container.querySelector("canvas") works once displaySize is known.
vi.mock("pixi.js", () => ({
  Application: class {
    canvas = document.createElement("canvas");
    renderer = { resize: vi.fn(), resolution: 1 };
    ticker = { stop: vi.fn(), add: vi.fn() };
    stage = { addChild: vi.fn() };
    // Never resolves → tickers never fire → GPU code never executes
    init = vi.fn().mockReturnValue(new Promise<void>(() => {}));
    render = vi.fn();
    destroy = vi.fn();
  },
  WebGLRenderer: class {},
  Filter: class {
    uniforms = {};
    destroy = vi.fn();
  },
  Sprite: class {
    texture = null;
    filters: unknown[] = [];
    anchor = { set: vi.fn() };
    position = { set: vi.fn() };
    scale = { set: vi.fn() };
  },
  Texture: class {
    static from = vi.fn();
    destroy = vi.fn();
  },
  VideoSource: class {
    on = vi.fn();
    off = vi.fn();
    destroy = vi.fn();
  },
  Container: class {
    addChild = vi.fn();
    removeChild = vi.fn();
    destroy = vi.fn();
  },
}));

describe("StripesShader", () => {
  it("mounts without throwing and renders a container div", () => {
    const { container } = render(<StripesShader src="test.mp4" config={{}} />);
    // The component renders a div while loading (media hasn't loaded yet in test env)
    expect(container.firstChild).toBeTruthy();
    const div = container.querySelector("div");
    expect(div).toBeTruthy();
  });

  it("accepts all optional props without throwing", () => {
    expect(() => {
      render(
        <StripesShader
          src="test.mp4"
          mediaKind="video"
          config={{ duotoneEnabled: true }}
          width={640}
          height={360}
          autoPlay={false}
          loop={false}
          muted={true}
          paused={true}
          className="test-class"
          style={{ border: "1px solid red" }}
        />,
      );
    }).not.toThrow();
  });

  it("renders a loading placeholder before media resolves", () => {
    const { container } = render(<StripesShader src="test.mp4" />);
    // Should show the loading state (aria-busy) since media hasn't loaded
    const busy = container.querySelector("[aria-busy='true']");
    expect(busy).toBeTruthy();
  });

  it("mounts a canvas once media resolves", async () => {
    // Stub HTMLVideoElement to report non-zero dimensions synchronously
    const origVideoWidth = Object.getOwnPropertyDescriptor(HTMLVideoElement.prototype, "videoWidth");
    const origVideoHeight = Object.getOwnPropertyDescriptor(HTMLVideoElement.prototype, "videoHeight");
    Object.defineProperty(HTMLVideoElement.prototype, "videoWidth", { configurable: true, get: () => 640 });
    Object.defineProperty(HTMLVideoElement.prototype, "videoHeight", { configurable: true, get: () => 360 });

    // Intercept video.load() to dispatch loadedmetadata after listeners are registered
    const origLoad = HTMLVideoElement.prototype.load;
    HTMLVideoElement.prototype.load = function () {
      Promise.resolve().then(() => {
        this.dispatchEvent(new Event("loadedmetadata"));
      });
    };

    const { container } = render(<StripesShader src="test.mp4" width={640} height={360} />);

    // pixiMount renders <canvas> as React JSX the moment displaySize is resolved;
    // app.init never resolves so no GPU tickers fire — purely a DOM smoke test.
    await waitFor(() => {
      expect(container.querySelector("canvas")).toBeTruthy();
    });

    // Restore originals
    HTMLVideoElement.prototype.load = origLoad;
    if (origVideoWidth) Object.defineProperty(HTMLVideoElement.prototype, "videoWidth", origVideoWidth);
    if (origVideoHeight) Object.defineProperty(HTMLVideoElement.prototype, "videoHeight", origVideoHeight);
  });
});
