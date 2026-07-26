import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createVideoFramePump } from "./media";

type FrameCallback = (now: number, metadata: unknown) => void;

let pending: FrameCallback | null = null;
let play: ReturnType<typeof vi.fn>;
let pause: ReturnType<typeof vi.fn>;

/**
 * `requestVideoFrameCallback` fires once per decoded frame; driving it by hand
 * is what makes the grab cadence observable.
 */
function decodeFrame(): void {
  const callback = pending;
  pending = null;
  callback?.(performance.now(), {});
}

beforeEach(() => {
  pending = null;
  play = vi.fn(() => Promise.resolve());
  pause = vi.fn();
  vi.useFakeTimers({
    toFake: ["setTimeout", "clearTimeout", "setInterval", "clearInterval", "Date", "performance"],
  });
  vi.spyOn(document, "createElement").mockImplementation(
    () =>
      ({
        play,
        pause,
        load: () => {},
        removeAttribute: () => {},
        readyState: 4,
        requestVideoFrameCallback: (cb: FrameCallback) => {
          pending = cb;
          return 1;
        },
        cancelVideoFrameCallback: () => {
          pending = null;
        },
      }) as unknown as HTMLElement,
  );
  vi.stubGlobal("createImageBitmap", () =>
    Promise.resolve({ width: 4, height: 4, close: () => {} } as unknown as ImageBitmap),
  );
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function makePump(getMaxFps?: () => number) {
  return createVideoFramePump({ src: "texture.mp4", loop: true, muted: true, autoPlay: true, getMaxFps });
}

describe("video frame pump", () => {
  it("pauses the element when stopped so an offscreen video stops decoding", () => {
    const pump = makePump();
    pump.start(() => {});
    expect(play).toHaveBeenCalledTimes(1);

    pump.stop();
    expect(pause).toHaveBeenCalledTimes(1);
  });

  it("resumes playback when the render gate reopens", () => {
    const pump = makePump();
    pump.start(() => {});
    pump.stop();
    pump.start(() => {});

    expect(play).toHaveBeenCalledTimes(2);
  });

  it("grabs on the frame cap's cadence, not on every decoded frame", async () => {
    const onFrame = vi.fn();
    const pump = makePump(() => 30);
    pump.start(onFrame);

    // Two decodes 1/60s apart: a 30fps cap must take only the first.
    decodeFrame();
    await vi.advanceTimersByTimeAsync(0);
    vi.advanceTimersByTime(16);
    decodeFrame();
    await vi.advanceTimersByTimeAsync(0);
    expect(onFrame).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(20);
    decodeFrame();
    await vi.advanceTimersByTimeAsync(0);
    expect(onFrame).toHaveBeenCalledTimes(2);
  });

  it("grabs every decoded frame when uncapped", async () => {
    const onFrame = vi.fn();
    const pump = makePump(() => 0);
    pump.start(onFrame);

    decodeFrame();
    await vi.advanceTimersByTimeAsync(0);
    vi.advanceTimersByTime(16);
    decodeFrame();
    await vi.advanceTimersByTimeAsync(0);

    expect(onFrame).toHaveBeenCalledTimes(2);
  });
});
