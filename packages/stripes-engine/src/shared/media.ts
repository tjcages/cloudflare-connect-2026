export function loadImageFrame(src: string): Promise<ImageBitmap> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.addEventListener(
      "load",
      () => {
        createImageBitmap(img, { colorSpaceConversion: "none", imageOrientation: "flipY" }).then(resolve, reject);
      },
      { once: true },
    );
    img.addEventListener("error", () => reject(new Error(`Failed to load image: ${src}`)), { once: true });
    img.src = src;
  });
}

export type VideoFramePumpOptions = {
  src: string;
  loop: boolean;
  muted: boolean;
  autoPlay: boolean;
  /**
   * The instance's current frame cap, read fresh on every decoded frame so a
   * later `setConfig` is honored. `0` means uncapped.
   *
   * `requestVideoFrameCallback` fires once per *decoded* frame, so a 60fps
   * source drives 60 `createImageBitmap` copies, transfers and texture uploads
   * per second even when the shader only paints at 30 — half of that work is
   * thrown away. Grabbing on the render cadence removes the waste and changes
   * nothing on screen.
   */
  getMaxFps?: () => number;
};

export type VideoFramePump = {
  start(onFrame: (bmp: ImageBitmap) => void): void;
  stop(): void;
  dispose(): void;
  readonly video: HTMLVideoElement;
};

type RvfcVideo = HTMLVideoElement & {
  requestVideoFrameCallback?: (cb: (now: number, metadata: unknown) => void) => number;
  cancelVideoFrameCallback?: (handle: number) => void;
};

export function createVideoFramePump(opts: VideoFramePumpOptions): VideoFramePump {
  const video = document.createElement("video") as RvfcVideo;
  video.muted = opts.muted;
  video.loop = opts.loop;
  video.playsInline = true;
  video.crossOrigin = "anonymous";
  video.preload = "auto";
  video.src = opts.src;

  let running = false;
  let disposed = false;
  let rvfcHandle = 0;
  let intervalHandle: ReturnType<typeof setInterval> | null = null;
  let inFlight = false;
  // Negative infinity, not 0: the very first decoded frame must always be taken
  // however close to the time origin the pump happens to start.
  let lastGrabMs = Number.NEGATIVE_INFINITY;
  const supportsRvfc = typeof video.requestVideoFrameCallback === "function";

  function dueForGrab(): boolean {
    const maxFps = opts.getMaxFps?.() ?? 0;
    if (!(maxFps > 0)) return true;
    const now = performance.now();
    const interval = 1000 / maxFps;
    if (now - lastGrabMs < interval - 1) return false;
    lastGrabMs += interval;
    if (now - lastGrabMs >= interval) lastGrabMs = now;
    return true;
  }

  function grab(onFrame: (bmp: ImageBitmap) => void): void {
    if (disposed || inFlight) return;
    if (video.readyState < 2) return;
    if (!dueForGrab()) return;
    inFlight = true;
    createImageBitmap(video, { colorSpaceConversion: "none", imageOrientation: "flipY" }).then(
      (bmp) => {
        inFlight = false;
        if (disposed || !running) {
          bmp.close();
          return;
        }
        onFrame(bmp);
      },
      () => {
        inFlight = false;
      },
    );
  }

  function start(onFrame: (bmp: ImageBitmap) => void): void {
    if (disposed || running) return;
    running = true;
    if (opts.autoPlay) void video.play().catch(() => {});
    if (supportsRvfc) {
      const tick = () => {
        if (!running || disposed) return;
        grab(onFrame);
        rvfcHandle = video.requestVideoFrameCallback!(tick);
      };
      rvfcHandle = video.requestVideoFrameCallback!(tick);
      return;
    }
    intervalHandle = setInterval(() => {
      if (!running || disposed) return;
      grab(onFrame);
    }, 1000 / 30);
  }

  function stop(): void {
    if (!running) return;
    running = false;
    // Cancelling the frame callback only stops *reading* frames — the element
    // keeps decoding its whole 60fps stream in the background for as long as it
    // is playing. Pause it too, or an offscreen video burns a full decode on
    // every page. It resumes from the same position, and since these are
    // ambient loops with nothing to stay in sync with, that is invisible.
    if (opts.autoPlay) video.pause();
    if (rvfcHandle && typeof video.cancelVideoFrameCallback === "function") {
      video.cancelVideoFrameCallback(rvfcHandle);
    }
    rvfcHandle = 0;
    if (intervalHandle !== null) {
      clearInterval(intervalHandle);
      intervalHandle = null;
    }
  }

  function dispose(): void {
    if (disposed) return;
    stop();
    disposed = true;
    video.pause();
    video.removeAttribute("src");
    video.load();
  }

  return {
    start,
    stop,
    dispose,
    get video() {
      return video;
    },
  };
}
