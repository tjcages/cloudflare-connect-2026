/** @vitest-environment happy-dom */
import { act, render, waitFor } from "@testing-library/react";
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

  it("reveal effect fires on content change but NOT on equivalent re-renders (inline config objects)", async () => {
    // Guard for the reveal-replay-every-render bug:
    // onRevealReplay is called each time revealPlaybackRef is bumped.
    // We assert it is NOT called again when re-rendering with a new object that has the same content,
    // and IS called when the reveal config content actually changes.
    const replayKeys: number[] = [];
    const onRevealReplay = (key: number) => replayKeys.push(key);

    // Initial render with reveal enabled — captures the initial bump (mount)
    const revealOn = {
      enabled: true,
      wave: { position: "center" as const, durationMs: 1100, softness: 0.08, waviness: 0.35, noiseScale: 0.5 },
    };
    const { rerender } = render(
      <StripesShader src="test.mp4" mediaKind="image" config={{ reveal: revealOn }} onRevealReplay={onRevealReplay} />,
    );

    // Wait for any async effects to settle
    await act(async () => {
      await Promise.resolve();
    });

    const afterMountCount = replayKeys.length;
    // At least one bump on mount (initial effect run)
    expect(afterMountCount).toBeGreaterThanOrEqual(1);

    // Re-render with a NEW object that has the SAME reveal content — must NOT bump again
    await act(async () => {
      rerender(
        <StripesShader
          src="test.mp4"
          mediaKind="image"
          config={{
            reveal: {
              enabled: true,
              wave: { position: "center", durationMs: 1100, softness: 0.08, waviness: 0.35, noiseScale: 0.5 },
            },
          }}
          onRevealReplay={onRevealReplay}
        />,
      );
      await Promise.resolve();
    });

    // Count must NOT have increased — same content, different object reference
    expect(replayKeys.length).toBe(afterMountCount);

    // Re-render with CHANGED reveal content (durationMs differs) — MUST bump
    await act(async () => {
      rerender(
        <StripesShader
          src="test.mp4"
          mediaKind="image"
          config={{
            reveal: {
              enabled: true,
              wave: { position: "center", durationMs: 2000, softness: 0.08, waviness: 0.35, noiseScale: 0.5 },
            },
          }}
          onRevealReplay={onRevealReplay}
        />,
      );
      await Promise.resolve();
    });

    // Must have bumped exactly once more
    expect(replayKeys.length).toBe(afterMountCount + 1);
  });
});
